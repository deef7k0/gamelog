/**
 * ScanDex proxy: a game box's barcode → the IGDB game and platform it is.
 *
 * ScanDex (https://scandex.gamery.app) authenticates with a personal access
 * token. Like the Twitch secret behind `igdb`, that token must never reach the
 * app bundle — anyone can unzip an APK — so the app asks this function and this
 * function holds the token.
 *
 * Deploy:
 *   supabase secrets set SCANDEX_API_TOKEN=xxx --project-ref <ref>
 *   supabase functions deploy scandex --project-ref <ref> --use-api
 * and run migration 0027, which creates the answer cache this writes.
 *
 * The app sends:
 *   POST /functions/v1/scandex { "barcode": "00711719577966" }
 * and gets one of:
 *   { "status": "matched", "game": { "igdbId": 26758, "name": "Super Mario Odyssey" },
 *     "platform": { "igdbId": 130, "name": "Nintendo Switch" } }
 *   { "status": "unmatched" }   ScanDex knows the barcode, with no game on it
 *   { "status": "missing" }     ScanDex has never seen it
 *
 * ## Only for signed-in people
 *
 * JWT verification is on by default, but the anon key *is* a valid JWT — it
 * ships in the bundle, so on its own it would make this a free ScanDex relay on
 * your token for anybody who unzipped the app. So the caller must resolve to a
 * real user, which the anon key does not.
 *
 * ## Asked once per barcode
 *
 * Answers are cached in `scandex_lookups` (0027), shared by everyone and written
 * only here, with the service role. A match is kept for `MATCH_TTL_DAYS`; "never
 * seen" and "no game" for `MISS_TTL_DAYS`, because ScanDex's catalogue grows.
 * A failed request is never cached — that would turn one bad minute into days
 * of "unknown".
 */
import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';

const SCANDEX_BASE = 'https://scandex.gamery.app/api/v2';
const MATCH_TTL_DAYS = 30;
const MISS_TTL_DAYS = 3;
/** A scan is someone standing with a box in their hand; do not hang on a slow third party. */
const TIMEOUT_MS = 8000;

type Answer =
  | {
      status: 'matched';
      game: { igdbId: number; name: string };
      platform: { igdbId: number | null; name: string | null };
    }
  | { status: 'unmatched' }
  | { status: 'missing' };

type CachedRow = {
  status: 'matched' | 'unmatched' | 'missing';
  igdb_game_id: number | null;
  game_name: string | null;
  igdb_platform_id: number | null;
  platform_name: string | null;
  fetched_at: string;
};

/** A failure worth telling the app about, with the status to send it with. */
class ScanDexError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

// ---------------------------------------------------------------------------
// Barcodes — the same GS1 rules as the app's `lib/barcode.ts`, restated because
// an Edge Function is deployed on its own and cannot import from `src/`.
// ---------------------------------------------------------------------------

function checkDigit(body: string): number {
  let total = 0;
  for (let index = 0; index < body.length; index++) {
    const fromRight = body.length - index;
    total += Number(body[index]) * (fromRight % 2 === 1 ? 3 : 1);
  }
  return (10 - (total % 10)) % 10;
}

/** Any valid GTIN-8/12/13/14 → GTIN-14, or null. The app already sends GTIN-14. */
function toGtin14(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const code = raw.trim();
  if (!/^\d{8}$|^\d{12,14}$/.test(code)) return null;
  if (checkDigit(code.slice(0, -1)) !== Number(code[code.length - 1])) return null;
  return code.padStart(14, '0');
}

/**
 * The form ScanDex's documentation queries by: EAN-13, the 13-digit code with
 * UPC-A's leading zero ("0711719577966"). It says leading zeros are handled
 * either way; sending the documented shape leaves nothing to that promise.
 */
function scandexValue(gtin14: string): string {
  return gtin14.startsWith('0') ? gtin14.slice(1) : gtin14;
}

// ---------------------------------------------------------------------------
// ScanDex
// ---------------------------------------------------------------------------

async function askScanDex(token: string, gtin14: string): Promise<Answer> {
  let response: Response;
  try {
    response = await fetch(
      `${SCANDEX_BASE}/lookup?${new URLSearchParams({ value: scandexValue(gtin14) })}`,
      {
        headers: { Authorization: token, Accept: 'application/json' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
      }
    );
  } catch (error) {
    throw new ScanDexError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'ScanDex took too long to answer.'
        : 'Could not reach ScanDex.',
      504
    );
  }

  if (response.status === 404) return { status: 'missing' };
  if (response.status === 401 || response.status === 403) {
    // The token is wrong or revoked — a setup problem, not the barcode's fault.
    throw new ScanDexError('ScanDex refused the access token. Check SCANDEX_API_TOKEN.', 500);
  }
  if (response.status === 429) throw new ScanDexError('ScanDex is rate limiting requests.', 503);
  if (!response.ok) throw new ScanDexError(`ScanDex lookup failed (${response.status}).`, 502);

  const data = (await response.json().catch(() => null)) as {
    igdb_metadata?: {
      id?: unknown;
      name?: unknown;
      platform?: { id?: unknown; name?: unknown } | null;
    } | null;
  } | null;

  const meta = data?.igdb_metadata;
  if (!meta || typeof meta.id !== 'number' || typeof meta.name !== 'string') {
    return { status: 'unmatched' };
  }
  return {
    status: 'matched',
    game: { igdbId: meta.id, name: meta.name },
    platform: {
      igdbId: typeof meta.platform?.id === 'number' ? meta.platform.id : null,
      name: typeof meta.platform?.name === 'string' ? meta.platform.name : null,
    },
  };
}

// ---------------------------------------------------------------------------
// The cache
// ---------------------------------------------------------------------------

function isFresh(row: CachedRow): boolean {
  const days = row.status === 'matched' ? MATCH_TTL_DAYS : MISS_TTL_DAYS;
  return Date.now() - new Date(row.fetched_at).getTime() < days * 24 * 60 * 60_000;
}

function fromRow(row: CachedRow): Answer {
  if (row.status !== 'matched' || row.igdb_game_id === null)
    return { status: row.status } as Answer;
  return {
    status: 'matched',
    game: { igdbId: row.igdb_game_id, name: row.game_name ?? '' },
    platform: { igdbId: row.igdb_platform_id, name: row.platform_name },
  };
}

function toRow(barcode: string, answer: Answer) {
  return {
    barcode,
    status: answer.status,
    igdb_game_id: answer.status === 'matched' ? answer.game.igdbId : null,
    game_name: answer.status === 'matched' ? answer.game.name.slice(0, 300) : null,
    igdb_platform_id: answer.status === 'matched' ? answer.platform.igdbId : null,
    platform_name:
      answer.status === 'matched' ? (answer.platform.name?.slice(0, 120) ?? null) : null,
    fetched_at: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  const token = Deno.env.get('SCANDEX_API_TOKEN')?.trim();
  if (!token) {
    /* The single most likely thing to be wrong on a fresh deploy, so it says
       exactly what to run rather than surfacing as ScanDex's 401. */
    return jsonResponse(
      { error: 'SCANDEX_API_TOKEN is not set. Run: supabase secrets set SCANDEX_API_TOKEN=…' },
      500
    );
  }

  if (!(await userFromRequest(request))) {
    return jsonResponse({ error: 'Sign in to look up barcodes.' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  const barcode = toGtin14(body.barcode);
  if (!barcode) return jsonResponse({ error: 'That is not a valid EAN or UPC barcode.' }, 400);

  const admin = adminClient();

  /* A cache failure costs a ScanDex call, never the answer: both reads and
     writes here are best-effort. */
  const cached = await admin
    .from('scandex_lookups')
    .select('status, igdb_game_id, game_name, igdb_platform_id, platform_name, fetched_at')
    .eq('barcode', barcode)
    .maybeSingle<CachedRow>();
  if (cached.error) console.warn('[scandex] cache read failed:', cached.error.message);
  if (cached.data && isFresh(cached.data)) return jsonResponse(fromRow(cached.data));

  let answer: Answer;
  try {
    answer = await askScanDex(token, barcode);
  } catch (error) {
    const status = error instanceof ScanDexError ? error.status : 502;
    const message = error instanceof Error ? error.message : 'ScanDex lookup failed.';
    // The barcode is a product code, not personal data; the token is never logged.
    console.warn('[scandex] lookup failed:', barcode, message);
    return jsonResponse({ error: message }, status);
  }

  const written = await admin.from('scandex_lookups').upsert(toRow(barcode, answer));
  if (written.error) console.warn('[scandex] cache write failed:', written.error.message);

  return jsonResponse(answer);
});
