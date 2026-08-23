import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useSyncExternalStore } from 'react';

import { directArtwork, fetchSteamArtwork, type SteamArtworkType } from '@/lib/games/steam-artwork';

/**
 * Steam CDN artwork for one game, with the hashed-path fallback handled for you.
 *
 * ## How this avoids making any requests
 *
 * The direct URL is a pure string, correct for ~95% of appids, so the first
 * render hands `<Image>` a URL with no network involved — no HEAD probe, no
 * lookup, nothing. The only signal that an appid needs the hashed path is the
 * image itself failing, so `onFailed` is what drives resolution:
 *
 * ```tsx
 * const art = useSteamArtwork(game.steamAppId);
 * <Image source={{ uri: art.library }} onError={art.onFailed} />
 * ```
 *
 * That 404 costs one round trip per game per week and nothing after it. The
 * alternative — probing every appid up front — spends fifty requests to
 * discover that forty-eight of them were already right.
 *
 * ## Why a module store rather than TanStack Query
 *
 * A poster grid mounts fifty of these at once and they all want the same
 * batching window and the same AsyncStorage map. One shared store means fifty
 * failures collapse into one API call; fifty `useQuery`s keyed by appid would
 * mean fifty. TanStack is still right for anything that is *a request per
 * screen* — this is closer to a cache with subscribers.
 */

/** Cache lifetime. Steam re-cuts store art rarely; a week is well inside that. */
const TTL_MS = 7 * 24 * 60 * 60 * 1000;

const CACHE_VERSION = 1;
const CACHE_KEY = `steam-artwork:v${CACHE_VERSION}`;

/** How long failures are collected before one batched lookup goes out. */
const BATCH_WINDOW_MS = 60;

type Resolved = Record<SteamArtworkType, string>;
type Entry = { urls: Resolved; storedAt: number };

/**
 * appid → resolved URLs. The single source every subscriber reads.
 *
 * Module scope, so it survives navigation and every screen shares one copy.
 */
const memory = new Map<string, Entry>();

/** appids whose direct URL failed and which are waiting for the next batch. */
const pending = new Set<string>();
/** appids already looked up this session, so a permanent 404 is not retried forever. */
const attempted = new Set<string>();

const subscribers = new Set<() => void>();
let batchTimer: ReturnType<typeof setTimeout> | null = null;
let hydrated = false;

function notify() {
  for (const callback of subscribers) callback();
}

/**
 * Load the persisted map once, on first use.
 *
 * One AsyncStorage read for the whole cache rather than one per appid: fifty
 * posters mounting together would otherwise be fifty round trips to disk before
 * anything drew.
 */
async function hydrate(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw) as Record<string, Entry>;
    const now = Date.now();
    let changed = false;

    for (const [appId, entry] of Object.entries(parsed)) {
      if (!entry?.urls || now - entry.storedAt > TTL_MS) {
        changed = true;
        continue;
      }
      memory.set(appId, entry);
    }

    if (memory.size > 0) notify();
    // Expired rows are dropped on the next write rather than in a second pass.
    if (changed) void persist();
  } catch {
    // A corrupt or unreadable cache is not worth surfacing: every entry in it
    // is reconstructible from a URL pattern.
  }
}

async function persist(): Promise<void> {
  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(memory)));
  } catch {
    // Out of disk, or storage unavailable. The in-memory map still works for
    // this session, which is the part that affects what you see.
  }
}

/** Run the queued lookups as one call, then wake every subscriber. */
async function flush(): Promise<void> {
  batchTimer = null;

  const batch = [...pending];
  pending.clear();
  if (batch.length === 0) return;

  const resolved = await fetchSteamArtwork(batch);
  const now = Date.now();

  for (const appId of batch) {
    const urls = resolved.get(appId);
    if (!urls) {
      /* Steam has no record of this appid, or the call failed. Logged once so a
         bad id can be looked at, and not retried this session — `attempted`
         already holds it. The caller falls through to IGDB art. */
      console.warn(`[steam-artwork] no Steam assets for appid ${appId}`);
      continue;
    }
    memory.set(appId, { urls, storedAt: now });
  }

  notify();
  void persist();
}

function queue(appId: string): void {
  if (attempted.has(appId)) return;
  attempted.add(appId);
  pending.add(appId);

  if (batchTimer === null) {
    batchTimer = setTimeout(() => void flush(), BATCH_WINDOW_MS);
  }
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  void hydrate();
  return () => subscribers.delete(callback);
}

export type SteamArtwork = Resolved & {
  /**
   * Hand to `<Image onError>`. Queues the hashed-path lookup for this appid.
   *
   * Safe to call repeatedly — an appid is only ever looked up once per session.
   */
  onFailed: () => void;
};

/**
 * Steam artwork URLs for one appid, or nulls when there is no appid.
 *
 * Returns immediately and never suspends: the direct URLs are available
 * synchronously, and a resolved hashed URL replaces them through a re-render if
 * and when the lookup lands.
 */
export function useSteamArtwork(appId: string | null | undefined): SteamArtwork | null {
  const key = appId ? String(appId) : null;

  const entry = useSyncExternalStore(
    subscribe,
    () => (key ? (memory.get(key) ?? null) : null),
    () => null
  );

  const onFailed = useCallback(() => {
    if (key) queue(key);
  }, [key]);

  if (!key) return null;

  // Resolved URLs when the lookup has landed; the free direct ones until then.
  return { ...(entry?.urls ?? directArtwork(key)), onFailed };
}

/**
 * Warm the cache for a screenful of games.
 *
 * Call on a library or grid mount with the appids about to be rendered. It does
 * **not** fetch anything by itself — it only pulls the persisted map into
 * memory, so posters whose hashed URL was resolved on a previous run draw the
 * right image on first paint instead of flashing a 404 and correcting.
 *
 * Deliberately not a network prefetch. Prefetching would spend a request on
 * every appid to discover that almost none of them needed one.
 */
export async function primeSteamArtwork(): Promise<void> {
  await hydrate();
}

/**
 * Drop the persisted map. For a "clear cache" affordance or a test.
 */
export async function clearSteamArtworkCache(): Promise<void> {
  memory.clear();
  attempted.clear();
  pending.clear();
  hydrated = false;
  notify();
  try {
    await AsyncStorage.removeItem(CACHE_KEY);
  } catch {
    // Nothing useful to do; the in-memory clear already took effect.
  }
}
