/**
 * A game's Steam store page, read on the server: its Awards section, and its
 * recent events and announcements.
 *
 * Deploy:
 *   supabase functions deploy steam-store
 * No secrets: both are public pages. Migration 0039 adds the cache this
 * writes; without it the function still answers and asks Steam every time.
 *
 * The app sends one of two actions, each for one Steam appid:
 *   POST /functions/v1/steam-store { "action": "awards", "appid": 632470 }
 *   POST /functions/v1/steam-store { "action": "events", "appid": 632470 }
 *
 * ## Why a function, and not the phone
 *
 * - The awards are in the store page's HTML. A phone fetching ~250 KB of
 *   somebody else's page to read one block, on every game page it opens, is
 *   the wrong place for it; here the first person to open a game pays and
 *   everybody after reads a row of 0039 for a week.
 * - The events endpoint is undocumented and answers CORS for Steam's own
 *   origin only, so the web build could never call it, and the app keeps
 *   Steam's undocumented endpoints off the phone (CLAUDE.md, § Gotchas).
 * - Only Steam's own pages are fetched, for a numeric appid. Nothing a caller
 *   sends becomes a URL, so this cannot be used as a relay.
 *
 * ## Age-gated games
 *
 * A mature game's page (Elden Ring, Baldur's Gate 3, The Witcher 3) redirects
 * to Steam's age check. The request carries the cookies a browser sets once
 * somebody has given a birth date there; without them those games — the ones
 * with the most awards — would have none. The function reads only the Awards
 * block of such a page and nothing of the mature content behind the gate.
 *
 * ## Asked for a real user
 *
 * The anon key is a valid JWT and ships in the bundle, so it is refused, as
 * `opencritic` and `scandex` refuse it: the function spends Steam's patience,
 * and only signed-in people should spend it.
 */

import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';
import {
  eventsEndpoint,
  isStorePage,
  parseAwards,
  parseEvents,
  storePageUrl,
} from '../_shared/steam-store.ts';

/**
 * Who is asking. Steam serves the full page, Awards included, to this — checked
 * on 2026-10-16 — so there is no need to pose as a browser.
 */
const USER_AGENT = 'GameLog/1.0 (game page awards and news; Supabase Edge Function)';

/** What a browser holds after somebody has passed the age check. See above. */
const AGE_COOKIES = 'birthtime=631152001; lastagecheckage=1-0-1990; wants_mature_content=1';

const TIMEOUT_MS = 10_000;

/** How many events a game page shows. */
const EVENT_COUNT = 10;

const HOUR_MS = 60 * 60_000;
const DAY_MS = 24 * HOUR_MS;

/**
 * How long each answer is kept.
 *
 * Awards change when a game wins something, a few times in its life: a week.
 * A page with none is kept as long — most of the catalogue has none and will
 * go on having none. News is the opposite, and an hour old is already old.
 * "Unavailable" (Steam down, the app gone, an unexpected page) is kept
 * briefly, so a failure is not asked again by everybody who opens the game but
 * is not remembered for a week either.
 */
const TTL: Record<Kind, Record<Status, number>> = {
  awards: { found: 7 * DAY_MS, none: 7 * DAY_MS, unavailable: 6 * HOUR_MS },
  events: { found: HOUR_MS, none: 6 * HOUR_MS, unavailable: 30 * 60_000 },
};

type Kind = 'awards' | 'events';
type Status = 'found' | 'none' | 'unavailable';
type Answer = { status: Status; appId: number } & Record<string, unknown>;

type CachedRow = { status: Status; payload: Answer | null; fetched_at: string };

class Unavailable extends Error {}

async function steamFetch(url: string): Promise<Response> {
  const response = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      Cookie: AGE_COOKIES,
      'Accept-Language': 'en-US,en;q=0.8',
    },
    redirect: 'follow',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!response.ok) throw new Unavailable(`Steam answered ${response.status}.`);
  return response;
}

async function readAwards(appId: number): Promise<Answer> {
  const pageUrl = storePageUrl(appId);
  const response = await steamFetch(pageUrl);

  /* A removed or region-locked app lands on the store's front page; an age
     check that the cookies did not satisfy lands on `/agecheck/`. */
  if (!new URL(response.url).pathname.startsWith(`/app/${appId}`)) {
    throw new Unavailable(`Steam sent the page elsewhere (${new URL(response.url).pathname}).`);
  }
  const html = await response.text();
  if (!isStorePage(html)) throw new Unavailable('Steam did not answer with a store page.');

  const awards = parseAwards(html, pageUrl, appId);
  const found = awards.awardsImages.length > 0 || awards.steamAwards.length > 0;
  return { status: found ? 'found' : 'none', ...awards };
}

async function readEvents(appId: number): Promise<Answer> {
  const response = await steamFetch(eventsEndpoint(appId, EVENT_COUNT));
  const raw: unknown = await response.json().catch(() => null);
  if (!raw || typeof raw !== 'object' || (raw as { success?: unknown }).success !== 1) {
    throw new Unavailable('Steam did not answer with events.');
  }

  const events = parseEvents(raw, appId, EVENT_COUNT);
  return { status: events.events.length > 0 ? 'found' : 'none', ...events };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  if (!(await userFromRequest(request))) {
    return jsonResponse({ error: 'Sign in to read Steam pages.' }, 401);
  }

  let body: { action?: unknown; appid?: unknown };
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  const kind = body.action;
  if (kind !== 'awards' && kind !== 'events') {
    return jsonResponse({ error: 'action must be "awards" or "events".' }, 400);
  }
  const appId = Number(body.appid);
  if (!Number.isInteger(appId) || appId <= 0 || appId > 100_000_000) {
    return jsonResponse({ error: 'appid must be a Steam app id.' }, 400);
  }

  /* A cache failure — the table missing included — costs a request to Steam,
     never the answer: both the read and the write are best-effort. */
  const admin = adminClient();
  const cached = await admin
    .from('steam_store_cache')
    .select('status, payload, fetched_at')
    .eq('appid', appId)
    .eq('kind', kind)
    .maybeSingle<CachedRow>();
  if (cached.error) console.warn('[steam-store] cache read failed:', cached.error.message);

  const row = cached.data;
  if (row && Date.now() - new Date(row.fetched_at).getTime() < TTL[kind][row.status]) {
    return jsonResponse(row.payload ?? { status: row.status, appId });
  }

  let answer: Answer;
  try {
    answer = kind === 'awards' ? await readAwards(appId) : await readEvents(appId);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Steam request failed.';
    console.warn(`[steam-store] ${kind} for ${appId}:`, message);
    /* A stale answer beats none: Steam being down for an hour should not take
       a week-old list of awards off every page. */
    if (row?.payload) return jsonResponse(row.payload);
    answer = { status: 'unavailable', appId };
  }

  const written = await admin.from('steam_store_cache').upsert({
    appid: appId,
    kind,
    status: answer.status,
    payload: answer,
    fetched_at: new Date().toISOString(),
  });
  if (written.error) console.warn('[steam-store] cache write failed:', written.error.message);

  return jsonResponse(answer);
});
