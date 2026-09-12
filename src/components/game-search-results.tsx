import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { GameListItem } from '@/components/game-list-item';
import { EmptyState, ErrorState } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  enabledProviders,
  gameSortOptions,
  searchGames,
  sortGames,
  type GameSearchResult,
  type GameSort,
} from '@/lib/games';

/** Below this a search matches half the catalogue; IGDB is asked for nothing. */
export const MIN_QUERY_LENGTH = 2;

/**
 * Relevance leads and is the default: IGDB's own ranking for a title query is
 * better than anything derivable here, and a search for "zelda" wants the Zelda
 * games, not the highest-rated game with a Z in it. The rest exist for the
 * searches relevance handles badly — a franchise name, or a genre word that
 * matches forty things.
 */
const SORTS = gameSortOptions(['default', 'newest', 'rating', 'title'], {
  default: 'Relevance',
});

export type GameSearchResultsProps = {
  /** The search term. Debounce it in the caller, which owns the text field. */
  query: string;
  /**
   * What tapping a result does. Omitted, rows link to the game page.
   *
   * The two screens that search for games want opposite things — browse opens
   * the game, the collection picker wants the game back — so the behaviour is a
   * prop and everything else here is shared.
   */
  onSelect?: (game: GameSearchResult) => void;
  /** Per-row marker: "Added" once a game is already in the collection. */
  badgeFor?: (game: GameSearchResult) => string | null;
  /** Whether tapping a row does anything, e.g. while an add is in flight. */
  isDisabled?: (game: GameSearchResult) => boolean;
  /** Shown before the query is long enough to run. */
  prompt?: { title: string; message?: string };
};

/**
 * Game search results, from the query down: the sort row, the four load states
 * and the list itself.
 *
 * Deliberately does *not* own the text field. The Search tab shares one field
 * between its Games and People modes, so lifting the input in here would either
 * clear it on every mode switch or force a second field to exist alongside it.
 * Input is per-screen; results are not.
 */
export function GameSearchResults({
  query,
  onSelect,
  badgeFor,
  isDisabled,
  prompt,
}: GameSearchResultsProps) {
  const [sort, setSort] = useState<GameSort>('default');
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const games = useQuery({
    // Shared key: the picker and the Search tab hit the same cache, so opening
    // the picker for a term you just searched costs nothing.
    queryKey: ['search', 'games', query],
    queryFn: ({ signal }) => searchGames(query, signal),
    enabled: isQueryable,
    /*
     * Refine, don't wipe.
     *
     * Every debounce tick is a new query key, so without a placeholder each
     * natural pause mid-word put `isLoading` back to true and tore the whole
     * list down to a centred spinner — typing "elden ring" produced two full
     * page-wipes. Keeping the previous page means the results narrow in place,
     * which is what a reader believes is happening anyway.
     */
    placeholderData: keepPreviousData,
  });

  const ordered = useMemo(() => sortGames(games.data ?? [], sort), [games.data, sort]);

  /* Empty only when the provider list is empty — i.e. IGDB disabled. Naming no
     source at all read as "Nothing on  for zelda", with the gap where the
     provider should have been. */
  const providerNames =
    enabledProviders()
      .map((provider) => provider.label)
      .join(' and ') || 'the catalogue';

  if (!isQueryable) {
    return (
      <EmptyState
        title={prompt?.title ?? 'Find a game'}
        message={
          prompt?.message ??
          `Searching ${providerNames}. Type at least ${MIN_QUERY_LENGTH} characters.`
        }
      />
    );
  }

  /* A skeleton, not a spinner (DESIGN.md § 22). The shape of a result row is
     fully known before the response arrives, so the wait can show what is
     coming instead of only that something is. */
  if (games.isLoading) return <ResultsSkeleton />;
  if (games.isError) return <ErrorState error={games.error} onRetry={() => games.refetch()} />;

  return (
    <FlatList
      data={ordered}
      keyExtractor={(game) => game.id}
      keyboardShouldPersistTaps="handled"
      contentContainerStyle={styles.content}
      renderItem={({ item }) => (
        <GameListItem
          game={item}
          badge={badgeFor?.(item) ?? null}
          onPress={onSelect ? () => onSelect(item) : undefined}
          disabled={isDisabled?.(item)}
        />
      )}
      ListHeaderComponent={
        // Only once there is more than one result to reorder — a sort row above
        // a single hit is chrome that does nothing.
        ordered.length > 1 ? (
          <View style={styles.sorts}>
            <SortBar
              options={SORTS}
              value={sort}
              onChange={setSort}
              accessibilityLabel="Sort search results"
            />
          </View>
        ) : null
      }
      ListEmptyComponent={
        <EmptyState
          title="No games found"
          /* A zero result on a catalogue this size is nearly always a typo, an
             abbreviation ("botw"), or a subtitle that does not match — so the
             message says what to try instead of just reporting the absence. */
          message={`Nothing on ${providerNames} for “${query}”. Check the spelling, or try the full title rather than an abbreviation.`}
        />
      }
    />
  );
}

/** Four result rows' worth of structure, while the first search is in flight. */
function ResultsSkeleton() {
  const theme = useTheme();

  return (
    <View
      style={styles.content}
      accessibilityRole="progressbar"
      accessibilityLabel="Searching the catalogue">
      {[0, 1, 2, 3].map((row) => (
        <View key={row} style={styles.skeletonRow}>
          <View
            style={[styles.skeletonPoster, { backgroundColor: theme.skeleton }]}
            /* Matches `<Poster>`'s 2:3 at the width `GameListItem` uses, so the
               list does not resize when the real rows land. */
          />
          <View style={styles.skeletonText}>
            <View
              style={[styles.skeletonLine, { width: '70%', backgroundColor: theme.skeleton }]}
            />
            <View
              style={[styles.skeletonLine, { width: '40%', backgroundColor: theme.skeleton }]}
            />
            <View
              style={[styles.skeletonLine, { width: '55%', backgroundColor: theme.skeleton }]}
            />
          </View>
        </View>
      ))}
    </View>
  );
}

const SKELETON_POSTER = 84;

const styles = StyleSheet.create({
  /* `flexGrow: 1` so `ListEmptyComponent` centres rather than pinning to the
     top — `EmptyState` fills its parent, and a content-sized container gave it
     nothing to fill. */
  content: { padding: Spacing.x16, gap: Spacing.x8, paddingBottom: Spacing.x48, flexGrow: 1 },
  sorts: { paddingBottom: Spacing.x4 },
  skeletonRow: { flexDirection: 'row', gap: Spacing.x12, paddingVertical: Spacing.x16 },
  skeletonPoster: {
    width: SKELETON_POSTER,
    height: SKELETON_POSTER * 1.5,
    borderRadius: Radius.image,
  },
  skeletonText: { flex: 1, gap: Spacing.x8, paddingTop: Spacing.x4 },
  skeletonLine: { height: 12, borderRadius: Radius.xs },
});
