/**
 * OpenCritic proxy — what the critics wrote, and what they scored.
 *
 * ## Why this function exists at all
 *
 * **IGDB does not publish per-outlet critic reviews.** It has
 * `aggregated_rating` — one averaged number and the count behind it — and that
 * is the whole of it. There is no field anywhere in the IGDB schema that says
 * "IGN gave this 90", let alone what IGN wrote, so the game page's critic rail
 * cannot be built from the catalogue the rest of the app runs on.
 *
 * OpenCritic publishes exactly that — each review's outlet, author, score and a
 * snippet of its text — and it authenticates with a key, which must never reach
 * the app bundle: anyone can unzip an APK. Same posture as `igdb` and `itad`:
 * the app talks to this function and this function holds the key.
 *
 * ## Deploy
 *
 *   supabase secrets set OPENCRITIC_API_KEY=xxx
 *   supabase functions deploy opencritic --project-ref <ref> --use-api
 *
 * Keys come from RapidAPI's OpenCritic listing. **Until this is deployed the
 * critic rail simply does not render** — `getCriticSummary` catches the failure
 * and returns nothing, and the page drops the section rather than showing an
 * error or, worse, inventing outlets. That is the same degradation ITAD has: a
 * missing key costs a section, never a broken screen.
 *
 * Migration 0035 adds the answer cache this writes. It is optional — without
 * the table every request goes upstream — and strongly worth running: one game
 * is three upstream requests and RapidAPI meters them per day.
 *
 * ## Requests
 *
 *   POST /functions/v1/opencritic
 *     { "action": "summary", "title": "Hades II", "year": 2025, "key": "igdb:113112" }
 *
 * answers `{ "found": false }` or
 *
 *   { "found": true, "average": 94, "count": 146, "recommended": 99,
 *     "tier": "Mighty", "url": "https://opencritic.com/game/…",
 *     "reviews": [{ "outlet": "IGN", "score": 100, "url": "…",
 *                   "snippet": "…", "author": "…", "date": "2025-09-24T…" }] }
 *
 * `search` and `reviews` are the two older actions, kept so a build that still
 * calls them keeps working.
 *
 * ## Only for signed-in people
 *
 * JWT verification is on by default, but the anon key *is* a valid JWT — it
 * ships in the bundle, so on its own it would make this a free OpenCritic relay
 * on your quota for anybody who unzipped the app. The caller must resolve to a
 * real user, which the anon key does not. Same check as `scandex`.
 */
import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';

const RAPIDAPI_HOST = 'opencritic-api.p.rapidapi.com';
const BASE = `https://${RAPIDAPI_HOST}`;

/**
 * How many reviews come back.
 *
 * A major release carries over a hundred and the rail shows a short row of
 * cards, so this is cut server-side: fetching a hundred to render twelve is a
 * hundred rows of JSON over a phone connection for nothing.
 */
const REVIEW_LIMIT = 12;

/** A quote, not the article: the card shows six lines of it. */
const SNIPPET_MAX = 600;

/**
 * How close OpenCritic's best title match has to be (its own edit distance —
 * lower is closer).
 *
 * 0.15 is tight. A wrong match is worse than no match: it would print another
 * game's reviews under this game's name, which is the one failure this whole
 * section cannot survive.
 */
const MAX_TITLE_DISTANCE = 0.15;

/**
 * How far apart the two catalogues' release years may be.
 *
 * The title is the only join there is, and titles repeat: "Prey" is a 2006 game
 * and a 2017 one, and OpenCritic — which starts around 2013 — only has the
 * second. One year of slack covers a release that straddles New Year or a
 * console version that came later; more than that is a different game.
 */
const MAX_YEAR_GAP = 1;

/** A game still collecting reviews is re-read sooner than one that has settled. */
const FRESH_RELEASE_DAYS = 90;
const FRESH_TTL_DAYS = 2;
const SETTLED_TTL_DAYS = 14;
const MISSING_TTL_DAYS = 3;

/** Do not hang a game page on a slow third party. */
const TIMEOUT_MS = 8000;

type ReviewOut = {
  outlet: string;
  /** 0-100, or null for an outlet that publishes a verdict and no number. */
  score: number | null;
  url: string | null;
  snippet: string | null;
  author: string | null;
  /** ISO timestamp. */
  date: string | null;
};

type Summary = {
  found: true;
  id: number;
  average: number | null;
  count: number;
  recommended: number | null;
  /** OpenCritic's own band: "Mighty", "Strong", "Fair", "Weak". */
  tier: string | null;
  /** The game's page on OpenCritic, for the attribution link. */
  url: string | null;
  /** When OpenCritic says the game first released, for the cache's lifetime. */
  released: string | null;
  reviews: ReviewOut[];
};

type Answer = Summary | { found: false };

type UpstreamReview = {
  score?: number | null;
  snippet?: string | null;
  externalUrl?: string | null;
  publishedDate?: string | null;
  alias?: string | null;
  Outlet?: { name?: string | null } | null;
  Authors?: { name?: string | null }[] | null;
};

type UpstreamGame = {
  topCriticScore?: number;
  numReviews?: number;
  percentRecommended?: number;
  tier?: string;
  url?: string;
  firstReleaseDate?: string;
};

class UpstreamError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function upstream<T>(key: string, path: string): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${BASE}${path}`, {
      headers: { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': RAPIDAPI_HOST },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    throw new UpstreamError(
      error instanceof Error && error.name === 'TimeoutError'
        ? 'OpenCritic took too long to answer.'
        : 'Could not reach OpenCritic.',
      504
    );
  }

  if (response.status === 429) {
    throw new UpstreamError('OpenCritic’s daily request quota is used up.', 503);
  }
  if (response.status === 401 || response.status === 403) {
    throw new UpstreamError('OpenCritic refused the key. Check OPENCRITIC_API_KEY.', 500);
  }
  if (!response.ok) throw new UpstreamError(`OpenCritic failed (${response.status}).`, 502);

  return (await response.json()) as T;
}

/**
 * Resolve a title to an OpenCritic game id, or null.
 *
 * OpenCritic has no cross-reference to IGDB or Steam, so the only join
 * available is the name. `dist` on each result is OpenCritic's own edit
 * distance, and anything past the threshold is rejected rather than guessed at.
 */
async function findGame(key: string, title: string): Promise<{ id: number; name: string } | null> {
  const params = new URLSearchParams({ criteria: title });
  const results = await upstream<{ id?: number; name?: string; dist?: number }[]>(
    key,
    `/game/search?${params}`
  );

  const best = Array.isArray(results) ? results[0] : null;
  if (!best?.id) return null;
  if (typeof best.dist === 'number' && best.dist > MAX_TITLE_DISTANCE) return null;
  return { id: best.id, name: best.name ?? '' };
}

/** One line of plain text, trimmed to a quote's length. */
function cleanSnippet(raw: string | null | undefined): string | null {
  if (typeof raw !== 'string') return null;
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length < 20) return null;
  if (text.length <= SNIPPET_MAX) return text;
  /* Cut on a word, and say that it was cut. */
  const cut = text.slice(0, SNIPPET_MAX);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(' '), SNIPPET_MAX - 40)).trimEnd()}…`;
}

function toReview(entry: UpstreamReview): ReviewOut | null {
  const outlet = entry.Outlet?.name?.trim();
  if (!outlet) return null;

  const score = typeof entry.score === 'number' ? Math.round(entry.score) : null;
  const snippet = cleanSnippet(entry.snippet);
  /* A row with neither a number nor a sentence has nothing to show. */
  if (score === null && snippet === null) return null;

  const author = entry.Authors?.find((person) => person?.name?.trim())?.name ?? entry.alias;

  return {
    outlet,
    score,
    url: typeof entry.externalUrl === 'string' && entry.externalUrl ? entry.externalUrl : null,
    snippet,
    author: typeof author === 'string' && author.trim() ? author.trim() : null,
    date: typeof entry.publishedDate === 'string' ? entry.publishedDate : null,
  };
}

/**
 * The summary and the reviews for one OpenCritic id.
 *
 * Reviews keep OpenCritic's own order — it leads with the outlets people have
 * heard of — and the ones with something to quote come first: the rail is made
 * of sentences, and a card holding only a number is the weakest one in it.
 * Sorting by score instead (which this did while it fed a bar chart) made every
 * well-reviewed game a row of identical 100s.
 */
async function readGame(key: string, id: number): Promise<Summary> {
  const [game, raw] = await Promise.all([
    upstream<UpstreamGame>(key, `/game/${id}`),
    upstream<UpstreamReview[]>(key, `/reviews/game/${id}`),
  ]);

  const all = (Array.isArray(raw) ? raw : [])
    .map(toReview)
    .filter((entry): entry is ReviewOut => entry !== null);

  /* One card per outlet: a second review from the same masthead (another
     platform's version) says the same thing again. */
  const seen = new Set<string>();
  const unique = all.filter((entry) => {
    if (seen.has(entry.outlet)) return false;
    seen.add(entry.outlet);
    return true;
  });

  const quoted = unique.filter((entry) => entry.snippet !== null);
  const bare = unique.filter((entry) => entry.snippet === null);

  return {
    found: true,
    id,
    average: typeof game.topCriticScore === 'number' ? Math.round(game.topCriticScore) : null,
    count: typeof game.numReviews === 'number' ? game.numReviews : all.length,
    recommended:
      typeof game.percentRecommended === 'number' ? Math.round(game.percentRecommended) : null,
    tier: typeof game.tier === 'string' && game.tier ? game.tier : null,
    url: typeof game.url === 'string' && game.url ? game.url : null,
    released: typeof game.firstReleaseDate === 'string' ? game.firstReleaseDate : null,
    reviews: [...quoted, ...bare].slice(0, REVIEW_LIMIT),
  };
}

function yearOf(iso: string | null): number | null {
  if (!iso) return null;
  const year = new Date(iso).getUTCFullYear();
  return Number.isFinite(year) ? year : null;
}

async function summarise(key: string, title: string, year: number | null): Promise<Answer> {
  const game = await findGame(key, title);
  if (!game) return { found: false };

  const summary = await readGame(key, game.id);

  const released = yearOf(summary.released);
  if (year !== null && released !== null && Math.abs(released - year) > MAX_YEAR_GAP) {
    return { found: false };
  }
  return summary;
}

// ---------------------------------------------------------------------------
// The cache (0035)
// ---------------------------------------------------------------------------

type CachedRow = {
  status: 'matched' | 'missing';
  payload: Summary | null;
  fetched_at: string;
};

const DAY_MS = 24 * 60 * 60_000;

function isFresh(row: CachedRow): boolean {
  const age = Date.now() - new Date(row.fetched_at).getTime();
  if (row.status === 'missing' || !row.payload) return age < MISSING_TTL_DAYS * DAY_MS;

  const released = row.payload.released ? new Date(row.payload.released).getTime() : NaN;
  const settling = Number.isFinite(released) && Date.now() - released < FRESH_RELEASE_DAYS * DAY_MS;
  return age < (settling ? FRESH_TTL_DAYS : SETTLED_TTL_DAYS) * DAY_MS;
}

function cacheKeyFor(key: unknown, title: string): string {
  if (typeof key === 'string' && /^[a-z]+:[\w.-]{1,80}$/.test(key)) return key;
  return `title:${title.toLowerCase().slice(0, 180)}`;
}

// ---------------------------------------------------------------------------

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  const key = Deno.env.get('OPENCRITIC_API_KEY')?.trim();
  if (!key) {
    return jsonResponse({ error: 'OPENCRITIC_API_KEY is not set on this project.' }, 500);
  }

  if (!(await userFromRequest(request))) {
    return jsonResponse({ error: 'Sign in to read critic reviews.' }, 401);
  }

  let body: { action?: string; title?: string; id?: number; year?: number; key?: string };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  try {
    if (body.action === 'summary') {
      const title = body.title?.trim();
      if (!title) return jsonResponse({ error: 'summary needs a title.' }, 400);
      const year = typeof body.year === 'number' && Number.isFinite(body.year) ? body.year : null;
      const cacheKey = cacheKeyFor(body.key, title);

      /* A cache failure — the table missing included — costs an upstream call,
         never the answer: both the read and the write are best-effort. */
      const admin = adminClient();
      const cached = await admin
        .from('critic_review_cache')
        .select('status, payload, fetched_at')
        .eq('cache_key', cacheKey)
        .maybeSingle<CachedRow>();
      if (cached.error) console.warn('[opencritic] cache read failed:', cached.error.message);
      if (cached.data && isFresh(cached.data)) {
        return jsonResponse(cached.data.payload ?? { found: false });
      }

      const answer = await summarise(key, title, year);

      const written = await admin.from('critic_review_cache').upsert({
        cache_key: cacheKey,
        status: answer.found ? 'matched' : 'missing',
        opencritic_id: answer.found ? answer.id : null,
        payload: answer.found ? answer : null,
        fetched_at: new Date().toISOString(),
      });
      if (written.error) console.warn('[opencritic] cache write failed:', written.error.message);

      return jsonResponse(answer);
    }

    /* The two older actions, for a build that still asks in two steps. */
    if (body.action === 'search') {
      const title = body.title?.trim();
      if (!title) return jsonResponse({ error: 'search needs a title.' }, 400);
      const game = await findGame(key, title);
      return jsonResponse(game ? { found: true, id: game.id, name: game.name } : { found: false });
    }

    if (body.action === 'reviews') {
      if (typeof body.id !== 'number') return jsonResponse({ error: 'reviews needs an id.' }, 400);
      const summary = await readGame(key, body.id);
      return jsonResponse({
        average: summary.average,
        count: summary.count,
        recommended: summary.recommended,
        reviews: summary.reviews,
      });
    }

    return jsonResponse({ error: `Unknown action: ${body.action}` }, 400);
  } catch (error) {
    const status = error instanceof UpstreamError ? error.status : 502;
    const message = error instanceof Error ? error.message : 'OpenCritic request failed.';
    console.warn('[opencritic] request failed:', message);
    return jsonResponse({ error: message }, status);
  }
});
