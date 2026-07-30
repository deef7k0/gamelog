import type { SortOption } from '@/components/ui/sort-bar';

/**
 * Client-side ordering for a list of games.
 *
 * Separate from `lib/gaming/format.ts`'s `LibrarySort`, which is deliberately
 * *server*-side: a linked Steam library can run to nine hundred rows and is
 * ordered by Postgres. These sorts apply to results already in memory and
 * capped at a hundred or so — a studio catalogue, a collection, a page of
 * search results — where re-sorting an array is cheaper than a round trip and
 * IGDB has no matching `sort` clause anyway.
 */
export type GameSort = 'default' | 'newest' | 'oldest' | 'rating' | 'title';

/** The minimum a value needs to be sortable by any of the options above. */
export type SortableGame = {
  title: string;
  releaseYear: number | null;
  score: number | null;
};

/**
 * `default` is named after its behaviour, not its meaning, because the meaning
 * differs per screen — relevance in search, stored position in a collection.
 * Screens override the label; none of them should override the key.
 */
export const GAME_SORT_LABEL: Record<GameSort, string> = {
  default: 'Default',
  newest: 'Newest',
  oldest: 'Oldest',
  rating: 'Top rated',
  title: 'A–Z',
};

export function gameSortOptions(
  keys: readonly GameSort[],
  overrides: Partial<Record<GameSort, string>> = {}
): SortOption<GameSort>[] {
  return keys.map((key) => ({ key, label: overrides[key] ?? GAME_SORT_LABEL[key] }));
}

/**
 * Missing values sort last, whichever direction the comparison runs.
 *
 * An unreleased game with no year is not "the oldest", and an unrated one is
 * not "the worst" — treating null as -Infinity would put every incomplete row
 * at one end of the list and bury the answer the reader asked for.
 */
function compareNullable(a: number | null, b: number | null, direction: 1 | -1): number {
  if (a === null && b === null) return 0;
  if (a === null) return 1;
  if (b === null) return -1;
  return (a - b) * direction;
}

/**
 * A newly ordered array. Never sorts in place — the input is usually a query
 * result held by TanStack Query, and mutating it would reorder the cache.
 */
export function sortGames<T extends SortableGame>(games: readonly T[], sort: GameSort): T[] {
  if (sort === 'default') return [...games];

  // Ties break on title so the order is stable across renders. Array.sort is
  // only guaranteed stable within one call, and the same list re-sorted after a
  // refetch should not shuffle equal-ranked rows.
  const byTitle = (a: T, b: T) => a.title.localeCompare(b.title);

  return [...games].sort((a, b) => {
    switch (sort) {
      case 'newest':
        return compareNullable(a.releaseYear, b.releaseYear, -1) || byTitle(a, b);
      case 'oldest':
        return compareNullable(a.releaseYear, b.releaseYear, 1) || byTitle(a, b);
      case 'rating':
        return compareNullable(a.score, b.score, -1) || byTitle(a, b);
      case 'title':
        return byTitle(a, b);
    }
  });
}
