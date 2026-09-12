import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useSyncExternalStore } from 'react';

import { parseGameId } from '@/lib/games';
import { getSquareCover, SGDB_ENABLED } from '@/lib/games/steamgriddb';

/**
 * A game's square (1:1) cover, remembered across launches.
 *
 * ## The problem this exists to solve
 *
 * The first version was a `useQuery` per slot, and it had a flaw you could see:
 * every square slot painted the IGDB portrait, then a beat later swapped it for
 * the square. A cover appearing and then being replaced reads as a bug however
 * fast it is, and it happened **every time** the slot mounted — a query cache
 * does not survive a cold start, so scrolling back to the same review row did it
 * again tomorrow.
 *
 * The fix is not a faster request; it is knowing the answer *before the first
 * paint*. So this is a module store persisted to AsyncStorage and read through
 * `useSyncExternalStore`, not a query:
 *
 *  - The **first** time the app ever sees a game, `resolved` is false and the
 *    caller shows its own placeholder — never the IGDB cover, so there is
 *    nothing to swap away from.
 *  - The answer, **including "there is no square art"**, is written to disk.
 *  - Every sighting after that resolves from memory on the first render. No
 *    request, no swap, no flash — this run or any future one.
 *
 * Caching the misses is half the value. "This game has no square cover" is the
 * common answer and it is just as expensive to re-derive as a hit; without it,
 * every game SteamGridDB does not have would re-ask on every mount forever.
 *
 * ## Why a store rather than TanStack Query
 *
 * Same reasoning as `use-steam-artwork`, which this deliberately mirrors. A
 * mosaic wall mounts eighty of these at once and they all want one AsyncStorage
 * map and one set of subscribers; eighty `useQuery`s keyed by game would be
 * eighty cache entries that all evaporate on quit. TanStack is right for *a
 * request per screen* — this is a cache with subscribers.
 */

/**
 * Cache lifetime.
 *
 * 30 days, far longer than `use-steam-artwork`'s week, because the underlying
 * fact barely moves: a game either has community square art or it does not, and
 * a new upload appearing is not something a reader is waiting on. The expiry
 * exists so a game that gains art eventually picks it up, not so the cache stays
 * fresh.
 */
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

const CACHE_VERSION = 1;
const CACHE_KEY = `sgdb-square:v${CACHE_VERSION}`;

/** `url: null` is a real, cached answer — "SteamGridDB has no square for this". */
type Entry = { url: string | null; storedAt: number };

const memory = new Map<string, Entry>();
/** Keys with a lookup in flight, so eighty tiles for one game make one request. */
const inflight = new Set<string>();
const subscribers = new Set<() => void>();

/**
 * The hydration itself, not a boolean.
 *
 * A flag would be a race: the second caller would see `hydrated = true` while
 * the first one's disk read was still in flight, decide the cache was empty and
 * fire a request for a game already on disk. Holding the promise means everyone
 * awaits the same read, and awaiting a settled promise is free.
 */
let hydration: Promise<void> | null = null;
/** Coalesces the writes a screenful of resolutions would otherwise each make. */
let persistTimer: ReturnType<typeof setTimeout> | null = null;

function notify(): void {
  for (const callback of subscribers) callback();
}

function hydrate(): Promise<void> {
  hydration ??= readCache();
  return hydration;
}

/**
 * Load the persisted map once, on first use.
 *
 * One read for the whole cache rather than one per game: eighty mosaic tiles
 * mounting together would otherwise be eighty round trips to disk before
 * anything drew.
 */
async function readCache(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) {
      notify();
      return;
    }

    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();

    for (const [key, entry] of Object.entries(parsed)) {
      if (!entry || now - entry.storedAt > TTL_MS) continue;
      memory.set(key, entry);
    }
  } catch {
    /* A corrupt or unreadable cache is not worth surfacing: every entry in it is
       reconstructible from one request. */
  } finally {
    /* Unconditional, and it must be. Callers hold their placeholder until
       `resolved` goes true, and for a game that is not in the cache the only
       thing that moves them off it is a notify — including the empty-cache and
       parse-failure paths, which is what makes a first run draw at all. */
    notify();
  }
}

function schedulePersist(): void {
  if (persistTimer !== null) return;

  persistTimer = setTimeout(() => {
    persistTimer = null;
    void AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory))).catch(() => {
      /* Out of disk, or storage unavailable. The in-memory map still works for
         this session, which is the part that affects what you see. */
    });
  }, 400);
}

/**
 * Resolve one game, unless it is already known or already being asked about.
 *
 * Awaits hydration first, so a game whose answer is sitting on disk is never
 * re-fetched because the read had not landed yet.
 */
function ensure(key: string, steamAppId: number | undefined, title: string | undefined): void {
  if (memory.has(key) || inflight.has(key)) return;
  inflight.add(key);

  void (async () => {
    try {
      await hydrate();
      if (memory.has(key)) return;

      const url = await getSquareCover({ steamAppId, title });
      memory.set(key, { url, storedAt: Date.now() });
      schedulePersist();
    } finally {
      inflight.delete(key);
      notify();
    }
  })();
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  void hydrate();
  return () => {
    subscribers.delete(callback);
  };
}

export type SquareCoverArgs = {
  /** App-wide game id (`igdb:1234`). The cache key, and the Steam appid source. */
  gameId?: string | null;
  /** The game's title, which is the resolution path almost every game has. */
  title?: string | null;
  /** Skip the lookup entirely — for a slot that is not showing art yet. */
  enabled?: boolean;
};

export type SquareCover = {
  /** The square cover, or null when there is none. Meaningless until `resolved`. */
  uri: string | null;
  /**
   * Whether the answer is known.
   *
   * **Callers must not draw artwork until this is true.** That is the whole
   * contract: falling back to the IGDB cover while it is false is exactly the
   * swap this hook was written to remove. Show a neutral box, a skeleton, or the
   * container's own fill — anything that is not a *different piece of artwork*.
   *
   * False only on the first sighting of a game, ever, and for the few hundred
   * milliseconds AsyncStorage takes to hand over its map at cold start.
   */
  resolved: boolean;
};

/** Resolved and empty — for a slot with nothing to look up. */
const NOTHING: SquareCover = { uri: null, resolved: true };

export function useSquareCover({ gameId, title, enabled = true }: SquareCoverArgs): SquareCover {
  const parsed = gameId ? parseGameId(gameId) : null;
  /* Only a legacy `steam:` row carries an appid — everything added since the
     catalogue cutover is `igdb:`, which is why the title path does the work. */
  const steamAppId = parsed?.source === 'steam' ? Number(parsed.sourceId) || undefined : undefined;

  /*
   * `SGDB_ENABLED` short-circuits everything, and it has to be here rather than
   * one layer down.
   *
   * `getSquareCover` already returns null without a key — but it returns it
   * *asynchronously*, which would leave every slot in the app unresolved for a
   * frame and make a build with no key flash a placeholder before every cover.
   * A null key here means `key` is null, which means `NOTHING`, which means
   * resolved-and-empty on the very first render.
   */
  const key =
    enabled && SGDB_ENABLED ? (gameId ?? (title ? `title:${title.toLowerCase()}` : null)) : null;

  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (memory.get(key) ?? null) : null),
    /* The server snapshot. Nothing is cached during a prerender, and returning a
       stable value is what keeps `useSyncExternalStore` from looping there. */
    () => null
  );

  /*
   * The request, fired from an effect and setting no state.
   *
   * `ensure` writes to the module map and notifies through the store, so the
   * re-render comes from `useSyncExternalStore` rather than from a `setState`
   * inside an effect — which the React Compiler rules forbid outright
   * (CLAUDE.md, "No setState in effects").
   */
  useEffect(() => {
    if (!key) return;
    ensure(key, steamAppId, title ?? undefined);
  }, [key, steamAppId, title]);

  if (!key) return NOTHING;
  if (!entry) return { uri: null, resolved: false };
  return { uri: entry.url, resolved: true };
}

/** Drop the persisted map. For a "clear cache" affordance or a test. */
export async function clearSquareCoverCache(): Promise<void> {
  memory.clear();
  inflight.clear();
  hydration = null;
  notify();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing useful to do; the in-memory clear already took effect.
  }
}
