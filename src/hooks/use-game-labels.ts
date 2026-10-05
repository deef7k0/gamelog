import { useEffect, useSyncExternalStore } from 'react';

import type { GameLabel } from '@/constants/game-labels';
import { getLabelledGameIds } from '@/lib/api';

/**
 * Which games carry a label, for the badge on a cover.
 *
 * ## Why a store and not a query
 *
 * The question is asked by `<Poster>`, which is on nearly every screen and
 * fifty times on the busy ones, and the answer is one short list of ids shared
 * by all of them. Fifty `useQuery`s would be fifty observers on one cache entry;
 * this is one fetch, one `Set`, and a subscription that costs a function in a
 * list — the same reasoning as `use-steam-artwork` and `use-square-cover`,
 * which sit beside this in `<Poster>` for the same reason.
 *
 * ## What a cover does while the answer is unknown
 *
 * Nothing. The badge is an addition to artwork that is already drawn, so a
 * cover paints without it and gains it when the list lands — there is no
 * placeholder to hold and nothing to swap. A failed fetch, or a database that
 * has not run 0034, is the same as an empty list: no badges, and no error on a
 * screen that only wanted to show a cover.
 */

/** How long the list is trusted before the next cover to mount refreshes it. */
const FRESH_MS = 10 * 60_000;

type Entry = { ids: Set<string>; loadedAt: number; loading: boolean };

const entries = new Map<GameLabel, Entry>();
const subscribers = new Set<() => void>();

function notify(): void {
  for (const callback of subscribers) callback();
}

function entryFor(label: GameLabel): Entry {
  let entry = entries.get(label);
  if (!entry) {
    entry = { ids: new Set(), loadedAt: 0, loading: false };
    entries.set(label, entry);
  }
  return entry;
}

/** Fetch the list unless it is fresh or already on its way. */
function ensure(label: GameLabel, force = false): void {
  const entry = entryFor(label);
  if (entry.loading) return;
  if (!force && entry.loadedAt > 0 && Date.now() - entry.loadedAt < FRESH_MS) return;

  entry.loading = true;
  void getLabelledGameIds(label)
    .then((ids) => {
      entry.ids = new Set(ids);
    })
    .catch(() => {
      /* Kept as it was: a badge that was showing stays, and one that was not
         stays away. The next mount after `FRESH_MS` asks again. */
    })
    .finally(() => {
      entry.loading = false;
      entry.loadedAt = Date.now();
      notify();
    });
}

function subscribe(callback: () => void): () => void {
  subscribers.add(callback);
  return () => {
    subscribers.delete(callback);
  };
}

/**
 * Whether a game carries a label.
 *
 * A null id answers false without asking for anything, which is how a surface
 * opts out: a cover in a collection or on a review passes no id and never
 * subscribes to anything but the function itself.
 */
export function useGameLabel(gameId: string | null | undefined, label: GameLabel): boolean {
  /*
   * The request, fired from an effect and setting no state: `ensure` writes to
   * the module map and notifies through the store, so the re-render comes from
   * `useSyncExternalStore` (CLAUDE.md, "No setState in effects"). The first
   * cover to mount with an id starts the one fetch; the rest find it in flight.
   */
  useEffect(() => {
    if (gameId) ensure(label);
  }, [gameId, label]);

  /* `subscribe` is the module's own function, so its identity never changes and
     React does not resubscribe a cover on every render. */
  return useSyncExternalStore(
    subscribe,
    () => (gameId ? entryFor(label).ids.has(gameId) : false),
    () => false
  );
}

/** Reflect a moderator's change at once, before the next refresh confirms it. */
export function setGameLabelLocally(gameId: string, label: GameLabel, on: boolean): void {
  const entry = entryFor(label);
  const ids = new Set(entry.ids);
  if (on) ids.add(gameId);
  else ids.delete(gameId);
  entry.ids = ids;
  notify();
}

/** Re-read a label's list — after a write, or a pull to refresh. */
export function refreshGameLabel(label: GameLabel): void {
  ensure(label, true);
}
