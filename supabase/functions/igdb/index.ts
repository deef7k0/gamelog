/**
 * IGDB proxy.
 *
 * IGDB authenticates through Twitch's client-credentials flow, which needs a
 * `client_secret`. That secret must never reach the app bundle — anyone can
 * unzip an APK — so the exchange happens here instead, and the app only ever
 * talks to this function using its own Supabase session.
 *
 * Deploy:
 *   supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy
 *   supabase functions deploy igdb
 *
 * The app sends an IGDB endpoint plus an APIcalypse query body:
 *   POST /functions/v1/igdb  { "endpoint": "games", "query": "search \"halo\"; fields name;" }
 *
 * JWT verification is on by default, so an unauthenticated caller cannot use
 * this as a free IGDB relay.
 */

const TWITCH_TOKEN_URL = 'https://id.twitch.tv/oauth2/token';
const IGDB_BASE = 'https://api.igdb.com/v4';

/** Only these IGDB endpoints may be proxied — this is not an open relay. */
const ALLOWED_ENDPOINTS = new Set([
  'games',
  'covers',
  'screenshots',
  'genres',
  'platforms',
  'involved_companies',
  'companies',
  'game_videos',
  'franchises',
  'search',
  // Industry showcases and awards shows, for the News tab. Adding an endpoint
  // here has no effect until the function is redeployed:
  //   supabase functions deploy igdb --project-ref <ref> --use-api
  'events',
  // Cast, franchise and studio sections on the game Overview tab. Franchise and
  // studio catalogues are queried through `games` with a `where` filter, so only
  // `characters` is strictly new — the rest are allowed for direct lookups.
  'characters',
  'collections',
  // The monthly popularity chart. Returns game ids and scores only — the ids
  // are resolved through `games`, which is already allowed. `popularity_types`
  // is the lookup table naming each type id; allowed so the mapping can be
  // checked without another deploy.
  'popularity_primitives',
  'popularity_types',
]);

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type CachedToken = { token: string; expiresAt: number };

/**
 * Twitch app access tokens last ~60 days. Holding it in module scope means a
 * warm instance reuses it instead of minting one per request; a cold start just
 * fetches again. Refreshed a minute early to avoid an expiry race.
 */
let cachedToken: CachedToken | null = null;

async function getAccessToken(clientId: string, clientSecret: string): Promise<string> {
  const now = Date.now();
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.token;
  }

  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'client_credentials',
  });

  const response = await fetch(`${TWITCH_TOKEN_URL}?${params}`, { method: 'POST' });
  if (!response.ok) {
    throw new Error(`Twitch token request failed (${response.status})`);
  }

  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    token: json.access_token,
    expiresAt: now + json.expires_in * 1000,
  };
  return cachedToken.token;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const clientId = Deno.env.get('TWITCH_CLIENT_ID');
  const clientSecret = Deno.env.get('TWITCH_CLIENT_SECRET');

  if (!clientId || !clientSecret) {
    return jsonResponse(
      {
        error:
          'IGDB is not configured. Run: supabase secrets set ' +
          'TWITCH_CLIENT_ID=... TWITCH_CLIENT_SECRET=...',
      },
      500
    );
  }

  let payload: { endpoint?: string; query?: string };
  try {
    payload = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  const { endpoint, query } = payload;
  if (!endpoint || !query) {
    return jsonResponse({ error: 'Both `endpoint` and `query` are required.' }, 400);
  }

  if (!ALLOWED_ENDPOINTS.has(endpoint)) {
    return jsonResponse({ error: `Endpoint "${endpoint}" is not allowed.` }, 400);
  }

  try {
    const token = await getAccessToken(clientId, clientSecret);

    const igdbResponse = await fetch(`${IGDB_BASE}/${endpoint}`, {
      method: 'POST',
      headers: {
        'Client-ID': clientId,
        Authorization: `Bearer ${token}`,
        Accept: 'application/json',
      },
      body: query,
    });

    const text = await igdbResponse.text();

    if (!igdbResponse.ok) {
      // A 401 usually means a stale cached token; drop it so the next call
      // mints a fresh one rather than failing repeatedly.
      if (igdbResponse.status === 401) cachedToken = null;
      return jsonResponse({ error: `IGDB error (${igdbResponse.status}): ${text}` }, 502);
    }

    return new Response(text, {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});
