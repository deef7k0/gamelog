import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { GameListItem } from '@/components/game-list-item';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Spacing } from '@/constants/theme';
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
  });

  const ordered = useMemo(() => sortGames(games.data ?? [], sort), [games.data, sort]);

  const providerNames = enabledProviders()
    .map((provider) => provider.label)
    .join(' and ');

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

  if (games.isLoading) return <LoadingState />;
  if (games.isError) return <ErrorState error={games.error} />;

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
          message={`Nothing on ${providerNames} for “${query}”.`}
        />
      }
    />
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, gap: Spacing.x8, paddingBottom: Spacing.x48 },
  sorts: { paddingBottom: Spacing.x4 },
});
