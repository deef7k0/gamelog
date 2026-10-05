import AsyncStorage from '@react-native-async-storage/async-storage';
import { hashKey } from '@tanstack/react-query';
import { AppState } from 'react-native';

import { queryClient } from './query-client';
import { decodeRow, encodeRow, pickEvictions, type RowInfo } from './query-persist-rules';

/**
 * The query cache, kept on the device between launches.
 *
 * ## What it is for
 *
 * A cold start used to be a spinner on every tab: the cache lived in memory, so
 * a new process knew nothing, and Home waited on a dozen requests to draw what
 * it had drawn an hour before. Now every query a screen has loaded is written
 * to AsyncStorage, read back before the first screen mounts, and shown at once —
 * and because a restored query carries the time its data really arrived, it is
 * stale, so mounting it refetches in the background and the answer overwrites
 * what was restored. That is SimpMusic's cached-copy-first, applied to every
 * screen instead of one (see `query-persist-rules.ts`).
 *
 * The other half of that rule is the screens': a restored page whose refetch
 * fails must stay a page. Guards read `isLoadingError`, not `isError` —
 * CLAUDE.md § Loading.
 *
 * ## One row per query, not one blob
 *
 * TanStack's own persister writes the whole cache as a single value, rewritten
 * in full on every change. Two things here rule that out. Android reads a row
 * through a 2 MB window, so one value past that is unreadable and takes the
 * entire cache with it, silently; and re-serialising a megabyte on the JS
 * thread each time one query settles is the kind of work this file exists to
 * remove. A row per query writes what changed and nothing else.
 *
 * ## One account's rows at a time
 *
 * Rows are namespaced by user id and wiped when the account changes. They have
 * to be: `['feed']` has no id in its key, and a shared handset must not paint
 * one person's feed for the next. Restoring therefore waits for the session,
 * which is why the auth store calls it.
 */

const PREFIX = 'gamelog:query:';

/**
 * Whether the last launch that restored this cache went on to run.
 *
 * `pending` is written before rows are read and `ok` once the app has been up
 * for `HEALTHY_AFTER_MS` or has been put in the background. A launch that
 * finds `pending` knows the previous one died early — and restored data is the
 * one thing a launch does that an earlier build did not, so it is thrown away
 * rather than given a second chance to do it again. Without this, one row an
 * older build wrote in a shape a newer screen cannot read would crash the app
 * at launch, every launch, until the app was reinstalled.
 */
const BOOT_KEY = 'gamelog:query-boot';
const HEALTHY_AFTER_MS = 4_000;

/** Writes are gathered for this long, so a screenful of queries is one write. */
const FLUSH_MS = 1_500;

/** Rows encoded between yields to the UI, when a flush has many. */
const ENCODE_BATCH = 4;

/**
 * The longest a launch will wait on the disk before drawing without it.
 *
 * Restoring is one `multiGet` and a parse — tens of milliseconds. A device
 * where it is not must not be held on the splash screen for a convenience:
 * rows that arrive late are still applied, under whatever has already loaded.
 */
const RESTORE_BUDGET_MS = 1_200;

let activeUser: string | null = null;
let attached = false;
/** True while rows are being put into the cache, so they are not written back. */
let restoring = false;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

/** What is on disk for the active user, by query hash. */
const index = new Map<string, RowInfo>();
/** Hashes whose data changed since the last flush. */
const dirty = new Set<string>();

const rowKey = (userId: string, hash: string) => `${PREFIX}${userId}:${hash}`;

const pause = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function warn(step: string, error: unknown) {
  if (__DEV__) console.warn(`[query-persist] ${step} failed:`, error);
}

/** Start listening for data worth keeping. Idempotent. */
function attach() {
  if (attached) return;
  attached = true;

  queryClient.getQueryCache().subscribe((event) => {
    if (restoring || !activeUser) return;
    /* `success` is a fetch that returned and a `setQueryData` alike — an
       optimistic write is on screen, so it is what a relaunch should show. */
    if (event.type !== 'updated' || event.action.type !== 'success') return;

    dirty.add(event.query.queryHash);
    flushTimer ??= setTimeout(() => void flush(), FLUSH_MS);
  });

  /* Leaving the app is the last moment a write is certain to be allowed, and a
     launch that got this far was a healthy one. */
  AppState.addEventListener('change', (state) => {
    if (state === 'active') return;
    void markHealthy();
    if (flushTimer) {
      clearTimeout(flushTimer);
      void flush();
    }
  });
}

async function markHealthy() {
  try {
    await AsyncStorage.setItem(BOOT_KEY, 'ok');
  } catch (error) {
    warn('marking the launch healthy', error);
  }
}

/** Write every query that changed, and evict what no longer fits. */
async function flush() {
  flushTimer = null;

  const user = activeUser;
  const hashes = [...dirty];
  dirty.clear();
  if (!user || hashes.length === 0) return;

  const cache = queryClient.getQueryCache();
  const writes = new Map<string, string>();
  const removals = new Set<string>();

  for (let i = 0; i < hashes.length; i += 1) {
    /* Serialising is the only real work here, and it is on the JS thread. */
    if (i > 0 && i % ENCODE_BATCH === 0) await pause(0);

    const hash = hashes[i];
    const query = cache.get(hash);
    if (!query || query.state.status !== 'success') continue;

    const row = encodeRow({
      queryKey: query.queryKey,
      data: query.state.data,
      updatedAt: query.state.dataUpdatedAt,
    });

    if (row) {
      writes.set(hash, row);
      index.set(hash, { chars: row.length, updatedAt: query.state.dataUpdatedAt });
    } else if (index.delete(hash)) {
      /* It fitted once and no longer does. The old row would be restored as
         if it were current, so it goes. */
      removals.add(hash);
    }
  }

  /* The account changed while this was encoding: these rows are nobody's. */
  if (activeUser !== user) return;

  for (const hash of pickEvictions(index)) {
    index.delete(hash);
    writes.delete(hash);
    removals.add(hash);
  }

  try {
    /* Removals first: on a full database they are what makes the room. */
    if (removals.size > 0) {
      await AsyncStorage.multiRemove([...removals].map((hash) => rowKey(user, hash)));
    }
    if (writes.size > 0) {
      await AsyncStorage.multiSet([...writes].map(([hash, row]) => [rowKey(user, hash), row]));
    }
  } catch (error) {
    /* Almost always "database or disk is full". A cache that cannot be written
       is not worth reasoning about row by row: start it again from nothing. */
    warn('writing', error);
    await forgetQueryCache();
  }
}

/** Delete every row this cache has written, for every account. */
export async function forgetQueryCache(): Promise<void> {
  index.clear();
  dirty.clear();
  try {
    const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
    if (keys.length > 0) await AsyncStorage.multiRemove(keys);
  } catch (error) {
    warn('clearing', error);
  }
}

async function readRows(userId: string): Promise<void> {
  const allKeys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(PREFIX));
  const prefix = rowKey(userId, '');
  let own = allKeys.filter((key) => key.startsWith(prefix));
  const foreign = allKeys.filter((key) => !key.startsWith(prefix));

  const diedEarly = (await AsyncStorage.getItem(BOOT_KEY)) === 'pending';
  if (diedEarly) {
    await AsyncStorage.multiRemove(allKeys);
    own = [];
  } else if (foreign.length > 0) {
    /* Another account's rows: a sign-out removes them, so these are from a
       session that ended some other way. Nothing will ever read them. */
    await AsyncStorage.multiRemove(foreign);
  }

  await AsyncStorage.setItem(BOOT_KEY, 'pending');
  setTimeout(() => void markHealthy(), HEALTHY_AFTER_MS);

  if (own.length === 0) return;

  const rows = await AsyncStorage.multiGet(own);
  /* The account changed while the disk was being read. */
  if (activeUser !== userId) return;

  const now = Date.now();
  const dead: string[] = [];

  restoring = true;
  try {
    for (const [key, raw] of rows) {
      const hash = key.slice(prefix.length);
      const row = decodeRow(raw, now);

      /* A row filed under a hash that is not its key's would never be read
         again and never be rewritten. */
      if (!row || !raw || hashKey(row.queryKey) !== hash) {
        dead.push(key);
        continue;
      }

      index.set(hash, { chars: raw.length, updatedAt: row.updatedAt });

      /* Only when the launch outran the disk: never put an old copy over an
         answer that has already arrived. */
      const known = queryClient.getQueryState(row.queryKey);
      if (known && known.dataUpdatedAt >= row.updatedAt) continue;

      queryClient.setQueryData(row.queryKey, row.data, { updatedAt: row.updatedAt });
    }
  } finally {
    restoring = false;
  }

  if (dead.length > 0) await AsyncStorage.multiRemove(dead);
}

/**
 * Fill the query cache from the device for this account, and keep it written
 * from here on. Resolves when the rows are in — or when `RESTORE_BUDGET_MS` has
 * passed, whichever is first — and never rejects: a launch without its cache
 * is a slower launch, not a failed one.
 *
 * `null` is the signed-out app, which has no queries and keeps none.
 */
export async function restoreQueryCache(userId: string | null): Promise<void> {
  attach();
  activeUser = userId;
  index.clear();
  dirty.clear();
  if (!userId) return;

  const read = readRows(userId).catch((error) => warn('restoring', error));
  await Promise.race([read, pause(RESTORE_BUDGET_MS)]);
}

/**
 * The account changed — a sign-in, a sign-out, or one user replacing another.
 *
 * Everything in memory and on disk belonged to whoever was here before, and
 * several keys do not say whose they are, so all of it goes; what the new
 * account loads is written under its own id from this point.
 */
export async function switchQueryCacheUser(userId: string | null): Promise<void> {
  attach();
  activeUser = userId;
  if (flushTimer) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }
  queryClient.clear();
  await forgetQueryCache();
}
