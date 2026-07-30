import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { appendToList, getList } from '@/lib/api';
import { getGameById, type GameSearchResult } from '@/lib/games';

/**
 * Pick a game to add to a collection.
 *
 * Its own screen rather than a trip to the Search tab. "Add games" used to push
 * `/search`, which dropped you into the general search with no memory of where
 * you came from: tapping a result opened the game page, and the collection was
 * never touched. Search there is for browsing; this is a picker, and a picker
 * has to return something.
 *
 * So one tap does the whole job — resolve the game, write the row, invalidate
 * the collection, and go back to it. No confirmation step: adding is one row in
 * a list the owner can remove from, which is not worth an "are you sure".
 */
export default function AddToListScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();

  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  // Already in the collection. Used to mark those rows rather than to block
  // them: `appendToList` upserts, so a double tap is harmless either way.
  const existing = new Set((list.data?.items ?? []).map((item) => item.game_id));

  const add = useMutation({
    mutationFn: async (result: GameSearchResult) => {
      /*
       * Search returns a `GameSearchResult`, which is the subset of a game a
       * result row needs. `list_items` has a foreign key to `games`, and that
       * cache row wants the description, screenshots and store URL too — so the
       * full record is fetched before the write rather than caching a thin row
       * that every later screen would have to top up.
       */
      const game = await getGameById(result.id);
      if (!game) throw new Error(`Could not load “${result.title}” from IGDB.`);

      await appendToList(id!, game);
    },
    onSuccess: () => {
      // The same three keys the collection screen invalidates after an edit —
      // the list itself, the profile's list rail, and favourites, which is just
      // a collection with a fixed kind and can be the target here too.
      queryClient.invalidateQueries({ queryKey: ['list', id] });
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['favorites'] });
      // Straight back to the collection, which refetches with the new game in
      // it — the point of the flow is seeing the shelf you just changed.
      router.back();
    },
  });

  if (!id) {
    return (
      <Screen edges={['bottom']} padded>
        <EmptyState title="Collection not found" />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: list.data ? `Add to ${list.data.title}` : 'Add games' }} />

      <View style={styles.header}>
        <TextField
          value={input}
          onChangeText={setInput}
          placeholder="Search games…"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        {add.isError && (
          <Text variant="caption" color="danger">
            {add.error instanceof Error ? add.error.message : 'Could not add that game.'}
          </Text>
        )}
      </View>

      <GameSearchResults
        query={query}
        onSelect={(game) => add.mutate(game)}
        badgeFor={(game) => (existing.has(game.id) ? 'Already in this collection' : null)}
        // Everything locks while a write is in flight: the rows are one tap
        // each and the screen closes on success, so a second tap during the
        // round trip would queue an add the user never sees the result of.
        isDisabled={() => add.isPending}
        prompt={{
          title: 'Add a game',
          message: 'Search IGDB, then tap a game to add it to this collection.',
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.four, gap: Spacing.two },
});
