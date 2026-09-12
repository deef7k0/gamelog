import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Modal, StyleSheet, View } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { appendToList, getLists } from '@/lib/api';
import type { Game } from '@/lib/games';
import { useAuth } from '@/store/auth';

/** The mosaic beside each row. Fixed dp — artwork does not ride the ladder. */
const ROW_MOSAIC = 48;

export type AddToCollectionProps = {
  game: Game;
  visible: boolean;
  onClose: () => void;
};

/**
 * Pick which collection a game goes into.
 *
 * ## Why a sheet and not the `add-to-list` route
 *
 * That route is the mirror of this one and answers the opposite question: it
 * starts from a *collection* and picks a game. This starts from a game and picks
 * a collection, so the list it shows is the viewer's own collections rather than
 * the catalogue, and the thing being chosen is already known. Sending a game
 * page to `/add-to-list` would arrive with nothing selected and a search field —
 * the exact "picking is not browsing" mistake CLAUDE.md records.
 *
 * ## What is offered, and what is not
 *
 * Favourites and wishlists are excluded. They are singletons with their own
 * controls in the same action row two buttons to the left, and offering them
 * here would give one fact two switches that disagree — press Favourite, then
 * add to "Favourites" from this sheet, and the star does not light.
 *
 * Tier lists and award shows *are* offered. A tier list holds the game
 * untiered until its owner sorts it, and an award show's trigger mirrors
 * `list_items` from the ballot — so adding a game directly to one is honest in
 * both cases, and refusing would mean explaining a schema detail to somebody who
 * only wants a game on a shelf.
 *
 * ## Adding twice is not an error
 *
 * `appendToList` upserts on `(list_id, game_id)`, so tapping a collection the game
 * is already in is a no-op rather than a duplicate row. The sheet therefore does
 * not mark those rows: knowing which of your collections already hold this game
 * would cost a second query per open, to prevent an action that is already
 * harmless.
 */
export function AddToCollection({ game, visible, onClose }: AddToCollectionProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const lists = useQuery({
    queryKey: ['lists', userId],
    queryFn: () => getLists(userId!),
    enabled: !!userId && visible,
  });

  /* Singletons out — see the docblock. Everything else the viewer owns is a
     shelf they built on purpose and can put this on. */
  const collections = (lists.data ?? []).filter(
    (list) => list.kind !== 'favorites' && list.kind !== 'wishlist'
  );

  const add = useMutation({
    /* `appendToList`, not `addToList`. The latter defaults `position` to 0, which
       is right for a wishlist toggle and wrong here: every game added that way
       lands in the same slot, so a ranked collection's numbering becomes
       whatever Postgres felt like. This counts first and puts the game at the
       end, which is where somebody adding to a shelf expects it. */
    mutationFn: async (listId: string) => {
      await appendToList(listId, game);
    },
    onSuccess: (_result, listId) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      queryClient.invalidateQueries({ queryKey: ['list', listId] });
      queryClient.invalidateQueries({ queryKey: ['list-membership'] });
      onClose();
    },
  });

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}>
      <View style={[styles.sheet, { backgroundColor: theme.background }]}>
        <View style={styles.head}>
          <View style={styles.headText}>
            <Text variant="h2">Add to collection</Text>
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              {game.title}
            </Text>
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close"
            onPress={onClose}
            scaleTo={0.9}
            hitSlop={Spacing.x8}
            style={StyleSheet.flatten(styles.close)}>
            <Ionicons name="close" size={22} color={theme.text} />
          </PressableScale>
        </View>

        {add.isError && (
          <Text variant="bodySmall" color="danger" style={styles.gutter}>
            {add.error instanceof Error ? add.error.message : 'Could not add that.'}
          </Text>
        )}

        {lists.isLoading ? (
          <LoadingState />
        ) : collections.length === 0 ? (
          /* No collections yet, so the sheet offers the thing that would make it
             useful rather than an apology. `replace` is wrong here — the game
             page should still be behind the new-collection modal. */
          <View style={styles.empty}>
            <Text variant="h4">No collections yet</Text>
            <Text variant="body" color="textSecondary" style={styles.emptyText}>
              Make one and this game can be its first entry.
            </Text>
            <Button
              title="New collection"
              icon="add"
              onPress={() => {
                onClose();
                router.push('/new-list');
              }}
            />
          </View>
        ) : (
          <View style={styles.rows}>
            {collections.map((list) => (
              <PressableScale
                key={list.id}
                accessibilityRole="button"
                accessibilityLabel={`Add ${game.title} to ${list.title}`}
                disabled={add.isPending}
                onPress={() => add.mutate(list.id)}
                scaleTo={0.98}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.surface }])}>
                <CollectionMosaic
                  covers={list.mosaic}
                  size={ROW_MOSAIC}
                  title={list.title}
                  award={list.kind === 'awards'}
                />

                <View style={styles.rowText}>
                  <Text variant="h5" numberOfLines={1}>
                    {list.title}
                  </Text>
                  <Text variant="bodySmall" color="textMuted">
                    {list.itemCount} {list.itemCount === 1 ? 'game' : 'games'}
                  </Text>
                </View>

                <Ionicons name="add-circle-outline" size={22} color={withAlpha(theme.text, 0.7)} />
              </PressableScale>
            ))}
          </View>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  sheet: { flex: 1, paddingTop: Spacing.x24, gap: Spacing.x16 },
  head: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x12,
    paddingHorizontal: Spacing.x16,
  },
  headText: { flex: 1, gap: 2 },
  close: {
    width: TapTarget,
    height: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gutter: { paddingHorizontal: Spacing.x16 },

  rows: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 1 },

  empty: { alignItems: 'center', gap: Spacing.x12, padding: Spacing.x24 },
  emptyText: { textAlign: 'center' },
});
