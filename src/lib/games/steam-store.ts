import { supabase } from '../supabase';

/**
 * A game's Steam store page, as the `steam-store` Edge Function reads it: the
 * publisher's Awards section and Steam's own awards, and the page's recent
 * events and announcements.
 *
 * ## Nothing here talks to Steam
 *
 * The awards are in the page's HTML and the events behind an undocumented
 * endpoint that answers CORS for Steam's own origin only; both are read on the
 * server, once for everybody, and kept in 0039's cache. The parser is
 * `supabase/functions/_shared/steam-store.ts`, under `npm test` against real
 * pages. The types below are its answers, restated: the app does not import
 * from `supabase/`.
 *
 * ## Everything here degrades to nothing
 *
 * No Steam listing, a page with no awards, a function not yet deployed, Steam
 * being down: each is a section that is not drawn. A failure throws, so it is
 * not saved on the device as "nothing" and is asked again next time — Steam
 * being unreachable included; "Steam has none" is an answer, `null`, and is
 * saved.
 */

/** One image from the publisher's Awards section, as the page names it. */
export type SteamAwardImage = {
  url: string;
  /** A larger copy (`extras_big`), when the page names one. */
  largeUrl: string | null;
  alt: string | null;
  width: number | null;
  height: number | null;
};

/** "The Steam Awards 2022 · Winner · Game of the Year Award". */
export type SteamAwardBanner = {
  year: number | null;
  result: string | null;
  awards: string[];
  url: string | null;
};

export type SteamAwards = {
  appId: number;
  /** The store page they were read from — where the card links. */
  pageUrl: string;
  awardsImages: SteamAwardImage[];
  steamAwards: SteamAwardBanner[];
};

export type SteamEventKind = 'update' | 'news' | 'event' | 'release' | 'sale' | 'stream';

export type SteamEvent = {
  id: string;
  title: string;
  kind: SteamEventKind;
  type: number;
  /** Seconds since the epoch. */
  startsAt: number;
  endsAt: number | null;
  postedAt: number | null;
  summary: string | null;
  /** 400×225, the size Steam's own lists use. */
  imageUrl: string | null;
  imageLargeUrl: string | null;
  url: string;
};

export type SteamEvents = {
  appId: number;
  newsUrl: string;
  events: SteamEvent[];
};

type Status = 'found' | 'none' | 'unavailable';

async function ask<T>(
  action: 'awards' | 'events',
  appId: string,
  signal?: AbortSignal
): Promise<(T & { status: Status }) | null> {
  const appid = Number(appId);
  if (!Number.isInteger(appid) || appid <= 0) return null;

  const { data, error } = await supabase.functions.invoke('steam-store', {
    body: { action, appid },
    ...(signal ? { signal } : {}),
  });

  if (error) {
    /* supabase-js hands a non-2xx response back on `error.context`; a 404 is
       the function not being deployed on this project. Thrown either way, so
       neither is kept as an answer. */
    const context = (error as { context?: unknown }).context;
    const status = context instanceof Response ? context.status : null;
    throw new Error(
      status === 404
        ? 'The steam-store function is not deployed.'
        : `Steam request failed: ${error.message}`
    );
  }
  if (!data || typeof data !== 'object' || !('status' in data)) {
    throw new Error('The steam-store function answered in a shape this app does not read.');
  }

  const answer = data as T & { status: Status };
  /* Steam unreachable or the page gone is not "this game has none": thrown, so
     the phone does not keep it for a day. The function keeps it six hours, so
     asking again costs it a row, not a request to Steam. */
  if (answer.status === 'unavailable') throw new Error('Steam did not answer for this game.');
  return answer.status === 'found' ? answer : null;
}

/** The game's awards on Steam, or null when its page has none. */
export async function getSteamAwards(
  appId: string,
  signal?: AbortSignal
): Promise<SteamAwards | null> {
  const answer = await ask<SteamAwards>('awards', appId, signal);
  if (!answer) return null;
  return {
    appId: answer.appId,
    pageUrl: answer.pageUrl,
    awardsImages: Array.isArray(answer.awardsImages) ? answer.awardsImages : [],
    steamAwards: Array.isArray(answer.steamAwards) ? answer.steamAwards : [],
  };
}

/** The game's recent events and announcements on Steam, newest first. */
export async function getSteamEvents(
  appId: string,
  signal?: AbortSignal
): Promise<SteamEvents | null> {
  const answer = await ask<SteamEvents>('events', appId, signal);
  if (!answer || !Array.isArray(answer.events)) return null;
  /* One row an event, each with an id and a title: the rail keys on the id,
     and two rows with one key are a render error rather than a repeat. */
  const seen = new Set<string>();
  const events = answer.events.filter((event) => {
    const id = typeof event?.id === 'string' ? event.id : null;
    if (!id || seen.has(id) || typeof event.title !== 'string' || !event.title) return false;
    seen.add(id);
    return true;
  });
  if (events.length === 0) return null;
  return { appId: answer.appId, newsUrl: answer.newsUrl, events };
}

/**
 * Where an event is in its life, against the clock now — not when the server
 * read it, which may be an hour ago.
 *
 * Only an `event` or a `stream` has a window worth saying: Steam gives every
 * post an end time, and a news post's is its start plus a placeholder.
 */
export function eventPhaseOf(
  event: Pick<SteamEvent, 'kind' | 'startsAt' | 'endsAt'>,
  nowSeconds: number
): 'upcoming' | 'live' | null {
  if (event.kind !== 'event' && event.kind !== 'stream') return null;
  if (event.startsAt > nowSeconds) return 'upcoming';
  if (event.endsAt !== null && event.endsAt > nowSeconds) return 'live';
  return null;
}

/** The kind of post, in a word. */
export const EVENT_KIND_LABEL: Record<SteamEventKind, string> = {
  update: 'Update',
  news: 'News',
  event: 'Event',
  release: 'Release',
  sale: 'Sale',
  stream: 'Stream',
};
