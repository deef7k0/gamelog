/**
 * OpenCritic proxy — per-outlet critic scores.
 *
 * ## Why this function exists at all
 *
 * **IGDB does not publish per-outlet critic reviews.** It has
 * `aggregated_rating` — one averaged number and the count behind it — and that
 * is the whole of it. There is no field anywhere in the IGDB schema that says
 * "IGN gave this 90", so the widget's expandable list of named outlets cannot be
 * built from the catalogue the rest of the app runs on.
 *
 * OpenCritic does publish exactly that, and it authenticates with a key, which
 * must never reach the app bundle — anyone can unzip an APK. Same posture as
 * `igdb` and `itad`: the app talks to this function and this function holds the
 * key.
 *
 * ## Deploy
 *
 *   supabase secrets set OPENCRITIC_API_KEY=xxx
 *   supabase functions deploy opencritic --project-ref <ref> --use-api
 *
 * Keys come from RapidAPI's OpenCritic listing. **Until this is deployed the
 * critic list simply does not render** — `getCriticReviews` catches the failure
 * and returns an empty array, and the widget drops the section rather than
 * showing an error or, worse, inventing outlets. That is the same degradation
 * ITAD has: a missing key costs a section, never a broken screen.
 *
 * ## Requests
 *
 *   POST /functions/v1/opencritic { "action": "search", "title": "Hades II" }
 *   POST /functions/v1/opencritic { "action": "reviews", "id": 14520 }
 *
 * JWT verification is on by default, so an unauthenticated caller cannot use
 * this as a free OpenCritic relay.
 */

const RAPIDAPI_HOST = 'opencritic-api.p.rapidapi.com';
const BASE = `https://${RAPIDAPI_HOST}`;

/**
 * How many outlet scores come back.
 *
 * A major release carries over a hundred reviews and the widget shows a short
 * ranked list, so this is cut server-side: fetching a hundred to render eight is
 * a hundred rows of JSON over a phone connection for nothing.
 */
const REVIEW_LIMIT = 12;

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

function upstream(key: string): HeadersInit {
  return { 'X-RapidAPI-Key': key, 'X-RapidAPI-Host': RAPIDAPI_HOST };
}

/**
 * Resolve a title to an OpenCritic game id.
 *
 * OpenCritic has no cross-reference to IGDB or Steam, so the only join
 * available is the name. `dist` on each result is OpenCritic's own edit
 * distance — lower is closer — and anything above the threshold below is
 * rejected rather than guessed at, because a near-miss here attaches another
 * game's reviews to this page.
 */
async function search(key: string, title: string): Promise<Response> {
  const params = new URLSearchParams({ criteria: title });
  const response = await fetch(`${BASE}/game/search?${params}`, { headers: upstream(key) });

  if (!response.ok) {
    return jsonResponse({ error: `OpenCritic search failed (${response.status}).` }, 502);
  }

  const results = (await response.json()) as { id?: number; name?: string; dist?: number }[];
  const best = Array.isArray(results) ? results[0] : null;

  /* 0.15 is tight. A wrong match is worse than no match: it would print another
     game's critic scores under this game's name, which is the one failure mode
     this whole section cannot survive. */
  if (!best?.id || (typeof best.dist === 'number' && best.dist > 0.15)) {
    return jsonResponse({ found: false });
  }

  return jsonResponse({ found: true, id: best.id, name: best.name ?? null });
}

/**
 * The named reviews for one OpenCritic game id.
 *
 * Returns a flat, already-trimmed shape rather than OpenCritic's own — the
 * client should not have to know that the outlet's name lives at
 * `Outlet.name` and the score at `score`, nor carry the ~30 other fields each
 * review ships with.
 */
async function reviews(key: string, id: number): Promise<Response> {
  const [gameResponse, reviewResponse] = await Promise.all([
    fetch(`${BASE}/game/${id}`, { headers: upstream(key) }),
    fetch(`${BASE}/reviews/game/${id}`, { headers: upstream(key) }),
  ]);

  if (!gameResponse.ok || !reviewResponse.ok) {
    return jsonResponse({ error: 'OpenCritic reviews failed.' }, 502);
  }

  const game = (await gameResponse.json()) as {
    topCriticScore?: number;
    numReviews?: number;
    percentRecommended?: number;
  };

  const raw = (await reviewResponse.json()) as {
    score?: number;
    Outlet?: { name?: string };
    externalUrl?: string;
  }[];

  const list = (Array.isArray(raw) ? raw : [])
    /* Not every review carries a number — some outlets publish a verdict and no
       score, and OpenCritic represents that as a missing `score`. A row with no
       number has nothing to draw in a bar chart, so it is dropped here rather
       than rendered as a zero. */
    .filter((entry) => typeof entry.score === 'number' && entry.Outlet?.name)
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0))
    .slice(0, REVIEW_LIMIT)
    .map((entry) => ({
      outlet: entry.Outlet!.name!,
      score: Math.round(entry.score!),
      url: entry.externalUrl ?? null,
    }));

  return jsonResponse({
    average: typeof game.topCriticScore === 'number' ? Math.round(game.topCriticScore) : null,
    count: typeof game.numReviews === 'number' ? game.numReviews : list.length,
    recommended:
      typeof game.percentRecommended === 'number' ? Math.round(game.percentRecommended) : null,
    reviews: list,
  });
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  const key = Deno.env.get('OPENCRITIC_API_KEY');
  if (!key) {
    return jsonResponse({ error: 'OPENCRITIC_API_KEY is not set on this project.' }, 500);
  }

  try {
    const body = (await request.json()) as { action?: string; title?: string; id?: number };

    if (body.action === 'search') {
      if (!body.title?.trim()) return jsonResponse({ error: 'search needs a title.' }, 400);
      return await search(key, body.title.trim());
    }

    if (body.action === 'reviews') {
      if (typeof body.id !== 'number') return jsonResponse({ error: 'reviews needs an id.' }, 400);
      return await reviews(key, body.id);
    }

    return jsonResponse({ error: `Unknown action: ${body.action}` }, 400);
  } catch (error) {
    return jsonResponse({ error: error instanceof Error ? error.message : 'Bad request.' }, 400);
  }
});
