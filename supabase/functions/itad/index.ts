/**
 * IsThereAnyDeal proxy.
 *
 * ITAD authenticates with an API key. Like the Twitch `client_secret` behind
 * `igdb`, that key must never reach the app bundle — anyone can unzip an APK —
 * so the app talks to this function and this function holds the key.
 *
 * Deploy:
 *   supabase secrets set ITAD_API_KEY=xxx
 *   supabase functions deploy itad --project-ref <ref> --use-api
 *
 * Get a key by registering an app at https://isthereanydeal.com/apps/ — the
 * "API key" on that page is what this wants. ITAD also issues an OAuth client
 * id and secret, but those are only for endpoints that act on *a user's* data
 * (their waitlist, their collection). Prices and lookups are app-authenticated,
 * so the key alone is enough and `ITAD_CLIENT_ID` / `ITAD_CLIENT_SECRET` are
 * deliberately not read here — see the note in supabase/functions/README.md.
 *
 * The app sends one of two actions:
 *   POST /functions/v1/itad { "action": "lookup", "appid": 292030 }
 *   POST /functions/v1/itad { "action": "lookup", "title": "Mafia" }
 *   POST /functions/v1/itad { "action": "prices", "ids": ["018d…"], "country": "US" }
 *
 * JWT verification is on by default, so an unauthenticated caller cannot use
 * this as a free ITAD relay — same posture as `igdb`.
 */

const ITAD_BASE = 'https://api.isthereanydeal.com';

/** Prices are quoted in USD for now; see `country` on the price request. */
const DEFAULT_COUNTRY = 'US';

/**
 * How many stores' prices come back per game.
 *
 * ITAD tracks around forty shops and a popular game is listed on most of them.
 * The UI shows a row of store buttons, not a price-comparison table, so this is
 * cut server-side rather than in the client: fetching forty to render eight is
 * forty rows of JSON over a phone connection for no reason. 0 would mean
 * unlimited.
 */
const PRICE_CAPACITY = 12;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

/**
 * Look a game up in ITAD's catalogue, by Steam appid or by exact title.
 *
 * The appid path is the reliable one and is what the app tries first: it is an
 * identity match, where a title match is a string comparison against a
 * catalogue with three entries called "Mafia". IGDB gives us the Steam appid
 * through `external_games`, so most games resolve that way; the title path is
 * the fallback for a game that has no Steam listing at all.
 */
async function lookup(key: string, body: { appid?: number; title?: string }): Promise<Response> {
  const params = new URLSearchParams({ key });

  if (typeof body.appid === 'number' && Number.isFinite(body.appid)) {
    params.set('appid', String(body.appid));
  } else if (typeof body.title === 'string' && body.title.trim()) {
    params.set('title', body.title.trim());
  } else {
    return jsonResponse({ error: 'lookup needs an appid or a title.' }, 400);
  }

  const response = await fetch(`${ITAD_BASE}/games/lookup/v1?${params}`);
  if (!response.ok) {
    return jsonResponse({ error: `ITAD lookup failed (${response.status}).` }, 502);
  }

  const data = (await response.json()) as { found?: boolean; game?: { id?: string; slug?: string; title?: string } };
  if (data?.found && data.game?.id) {
    return jsonResponse(data);
  }

  // Fallback to fuzzy search if exact lookup failed and a title is present
  if (typeof body.title === 'string' && body.title.trim()) {
    const searchParams = new URLSearchParams({
      key,
      title: body.title.trim(),
      results: '1',
    });
    const searchResp = await fetch(`${ITAD_BASE}/games/search/v1?${searchParams}`);
    if (searchResp.ok) {
      const searchResults = (await searchResp.json()) as Array<{ id?: string; slug?: string; title?: string }>;
      if (Array.isArray(searchResults) && searchResults.length > 0 && searchResults[0]?.id) {
        return jsonResponse({
          found: true,
          game: {
            id: searchResults[0].id,
            slug: searchResults[0].slug,
            title: searchResults[0].title,
          },
        });
      }
    }
  }

  return jsonResponse(data);
}

/**
 * Current prices for one or more ITAD game ids.
 *
 * `POST /games/prices/v3` takes the ids as a JSON array body and everything
 * else as query parameters — an unusual split, and the reason `country` and
 * `capacity` are not in the body below.
 */
async function prices(
  key: string,
  body: { ids?: unknown; country?: unknown }
): Promise<Response> {
  const ids = Array.isArray(body.ids)
    ? body.ids.filter((id): id is string => typeof id === 'string' && id.length > 0)
    : [];

  if (ids.length === 0) {
    return jsonResponse({ error: 'prices needs at least one game id.' }, 400);
  }
  // One game page asks for one game. A cap keeps this from being used to pull
  // the catalogue through a signed-in session.
  if (ids.length > 20) {
    return jsonResponse({ error: 'prices accepts at most 20 ids.' }, 400);
  }

  const country =
    typeof body.country === 'string' && /^[A-Za-z]{2}$/.test(body.country)
      ? body.country.toUpperCase()
      : DEFAULT_COUNTRY;

  const params = new URLSearchParams({
    key,
    country,
    capacity: String(PRICE_CAPACITY),
    // Non-deal prices are wanted too: the row shows where a game *is sold*, and
    // a store at full price is still an answer to that.
    deals: 'false',
    // Voucher prices need a code pasted at checkout to be real. Showing one as
    // "the price" and then having the store disagree is worse than a higher
    // honest number.
    vouchers: 'false',
  });

  const response = await fetch(`${ITAD_BASE}/games/prices/v3?${params}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(ids),
  });

  if (!response.ok) {
    return jsonResponse({ error: `ITAD prices failed (${response.status}).` }, 502);
  }

  return jsonResponse(await response.json());
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Use POST.' }, 405);
  }

  const key = Deno.env.get('ITAD_API_KEY');
  if (!key) {
    /*
     * A clear message rather than a 502 from ITAD. This is the single most
     * likely thing to be wrong on a fresh deploy, and "prices failed (401)"
     * sends you looking at the wrong layer.
     */
    return jsonResponse(
      { error: 'ITAD_API_KEY is not set. Run: supabase secrets set ITAD_API_KEY=…' },
      500
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  try {
    switch (body.action) {
      case 'lookup':
        return await lookup(key, body as { appid?: number; title?: string });
      case 'prices':
        return await prices(key, body);
      default:
        return jsonResponse({ error: 'action must be "lookup" or "prices".' }, 400);
    }
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'ITAD request failed.' }, 502);
  }
});
