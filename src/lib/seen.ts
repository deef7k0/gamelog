/**
 * A short memory of complete records that went past on their way into a list,
 * so the page for one of them does not download it again.
 *
 * ## The waste this removes
 *
 * A list is fetched as whole records and drawn as rows. Tapping a row opens a
 * page that asks the network for one record — the same one, by the same
 * fields, that the list held a moment ago — and waits on a spinner for it.
 * Keeping the record as it goes past lets that page start from it
 * (`initialData`), on screen in the frame it opens.
 *
 * Two things use it: games (`games/seen-games.ts`) and reviews
 * (`api/seen-logs.ts`). Each says, where it remembers, why the record it keeps
 * is complete — **a partial record must never be remembered**, because the
 * page would be told that was all there is.
 *
 * ## When it was seen rides along
 *
 * `recall` returns the time with the record and the page passes it on as
 * `initialDataUpdatedAt`. The page's own `staleTime` then decides, as it does
 * for any query: seen just now, nothing is fetched; seen a while ago, it paints
 * at once and is refreshed behind.
 *
 * In memory only, and capped — this is one sitting's records. What survives a
 * relaunch is the query cache (`query-persist.ts`), where an opened page
 * already is.
 */
export type Seen<T> = { value: T; at: number };

export type SeenStore<T> = {
  /** Keep a complete record. A newer sighting replaces an older one. */
  remember: (value: T, at?: number) => void;
  /** The record and when it was seen, or `null`. */
  recall: (id: string | null | undefined) => Seen<T> | null;
  clear: () => void;
};

export function createSeen<T extends { id: string }>(limit: number): SeenStore<T> {
  const seen = new Map<string, Seen<T>>();

  return {
    remember(value, at = Date.now()) {
      /* Delete first: a Map keeps insertion order, so re-inserting is what
         moves a record seen again to the young end. */
      seen.delete(value.id);
      seen.set(value.id, { value, at });

      if (seen.size > limit) {
        const oldest = seen.keys().next().value;
        if (oldest !== undefined) seen.delete(oldest);
      }
    },
    recall(id) {
      return id ? (seen.get(id) ?? null) : null;
    },
    clear() {
      seen.clear();
    },
  };
}
