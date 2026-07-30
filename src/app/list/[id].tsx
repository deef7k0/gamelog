import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Share, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CollectionHeader } from '@/components/collection-header';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteList,
  getList,
  getProfile,
  removeFromList,
  reorderList,
  TIERS,
  type ListItem,
} from '@/lib/api';
import { gameSortOptions, sortGames, type GameSort } from '@/lib/games';
import { useAuth } from '@/store/auth';

const POSTER = 58;

/** Four across, matching the library, studio and Top 10 grids. */
const GRID_COLUMNS = 4;
const GRID_GAP = Spacing.two;

/**
 * `default` is the collection's own order — the sequence the owner arranged, or
 * the ranking if it is a ranked list — so it leads and is what the screen opens
 * on. Everything else is a temporary way of reading the same shelf; none of it
 * is written back.
 */
const SORTS = gameSortOptions(['default', 'title', 'newest', 'oldest', 'rating'], {
  default: 'List order',
});

const TIER_COLOR: Record<string, string> = {
  S: '#FF7B7B',
  A: '#FFB068',
  B: '#FFD86B',
  C: '#B6E07A',
  D: '#7ACBE0',
  F: '#B0A6E0',
};

export default function ListDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [sort, setSort] = useState<GameSort>('default');

  const { width } = useWindowDimensions();
  const gridWidth = gridItemWidth(width, GRID_COLUMNS, Spacing.four, GRID_GAP);

  const list = useQuery({
    queryKey: ['list', id],
    queryFn: () => getList(id!),
    enabled: !!id,
  });

  // The header credits the creator, which `getList` does not join.
  const owner = useQuery({
    queryKey: ['profile', list.data?.user_id],
    queryFn: () => getProfile(list.data!.user_id),
    enabled: !!list.data?.user_id,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['list', id] });
    queryClient.invalidateQueries({ queryKey: ['lists'] });
    queryClient.invalidateQueries({ queryKey: ['favorites'] });
  }

  const remove = useMutation({
    mutationFn: (gameId: string) => removeFromList(id!, gameId),
    onSuccess: invalidate,
  });

  /**
   * Move an item one slot up or down.
   *
   * Arrow buttons rather than drag-and-drop: a gesture-driven reorder inside a
   * FlatList needs a dedicated library, and this keeps the interaction reliable
   * and accessible. Only the two swapped rows are written back.
   */
  const move = useMutation({
    mutationFn: async ({ index, direction }: { index: number; direction: -1 | 1 }) => {
      const items = list.data?.items ?? [];
      const target = index + direction;
      if (target < 0 || target >= items.length) return;

      const a = items[index];
      const b = items[target];
      await reorderList(id!, [
        { gameId: a.game_id, position: target, tier: a.tier },
        { gameId: b.game_id, position: index, tier: b.tier },
      ]);
    },
    onSuccess: invalidate,
  });

  const setTier = useMutation({
    mutationFn: async ({ item, tier }: { item: ListItem; tier: string | null }) => {
      await reorderList(id!, [
        { gameId: item.game_id, position: item.position, tier: tier as ListItem['tier'] },
      ]);
    },
    onSuccess: invalidate,
  });

  const destroy = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteList(userId, id!);
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  /*
   * Display order only — nothing here is written back.
   *
   * `rankOf` is keyed off the *stored* sequence rather than the rendered index,
   * so a ranked collection sorted by release year still shows each game the
   * number its owner gave it. Renumbering on sort would turn a ranking into a
   * different ranking every time someone changed the view.
   *
   * Both memos run before the early returns below: they are hooks, and hooks
   * cannot sit behind a conditional.
   */
  const items = useMemo(() => list.data?.items ?? [], [list.data]);

  const rankOf = useMemo(
    () => new Map(items.map((item, index) => [item.game_id, index + 1])),
    [items]
  );

  /*
   * Both "Add games" and the header's edit action open the picker.
   *
   * They used to push `/search`, which is browsing, not picking: it lost track
   * of the collection entirely and a tap there opened the game page. There is
   * no other editing surface for a collection, so edit lands here too.
   */
  function openPicker() {
    router.push({ pathname: '/add-to-list/[id]', params: { id: id! } });
  }

  const ordered = useMemo(
    () =>
      sortGames(
        items.map((item) => ({
          item,
          title: item.game?.title ?? '',
          releaseYear: item.game?.release_year ?? null,
          score: item.game?.score ?? null,
        })),
        sort
      ).map((entry) => entry.item),
    [items, sort]
  );

  if (list.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  }

  if (list.isError) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState error={list.error} />
      </Screen>
    );
  }

  if (!list.data) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState title="List not found" />
      </Screen>
    );
  }

  const data = list.data;
  const isOwner = data.user_id === userId;
  const isTierList = data.kind === 'tier';

  const header = (
    /* Cancels the list's horizontal padding so the hero reaches both edges and
       runs under the floating header, the way a game page opens. The header's
       own body re-applies the inset to its text. */
    <View style={styles.headerBleed}>
      <CollectionHeader
        collection={data}
        owner={owner.data ?? null}
        isOwner={isOwner}
        onShare={() =>
          Share.share({
            message: `${data.title} — ${items.length} games on GameLog`,
          }).catch(() => undefined)
        }
        onEdit={isOwner ? openPicker : undefined}
        onDelete={isOwner ? () => destroy.mutate() : undefined}
      />

      {/* "Add games" is in the header's action row now, beside Share and
          Delete. A second full-width copy of it here was the same button
          twice, forty pixels apart.

          A tier list is grouped by tier, so reordering it by year would
          scramble the only structure it has — no sort row there. */}
      {!isTierList && items.length > 1 && (
        <View style={styles.controls}>
          <SortBar
            options={SORTS}
            value={sort}
            onChange={setSort}
            accessibilityLabel="Sort this collection"
          />
        </View>
      )}
    </View>
  );

  /*
   * Two layouts, one screen.
   *
   * A tier list is a ranking: each entry needs its tier badge, its position and
   * its remove control, so it stays a row. Everything else is a shelf, and a
   * four-across poster grid shows far more of it per screen — which is the whole
   * point of a collection.
   */
  if (!isTierList) {
    return (
      <Screen edges={['bottom']}>
        <Stack.Screen options={{ title: 'Collection' }} />

        <FlatList
          data={ordered}
          key="collection-grid"
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.game_id}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={item.game?.title ?? 'Game'}
                scaleTo={0.95}>
                <View style={{ width: gridWidth }}>
                  <Poster
                    coverUrl={item.game?.cover_url}
                    heroUrl={item.game?.hero_url}
                    title={item.game?.title}
                    width={gridWidth}
                    rounded="small"
                  />
                  {data.is_ranked && (
                    <View style={[styles.rankPill, { backgroundColor: theme.scrim }]}>
                      <Text variant="micro" style={styles.rankPillText}>
                        {rankOf.get(item.game_id)}
                      </Text>
                    </View>
                  )}
                </View>
              </PressableScale>
            </Link>
          )}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              message={
                isOwner
                  ? 'Tap “Add games”, then tap a search result to add it.'
                  : 'This collection is empty.'
              }
            />
          }
        />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']}>
      <Stack.Screen options={{ title: 'Collection' }} />

      <FlatList
        data={items}
        keyExtractor={(item) => item.game_id}
        contentContainerStyle={items.length === 0 ? styles.empty : styles.content}
        showsVerticalScrollIndicator={false}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.two }} />}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={[styles.row, { backgroundColor: theme.surface }]}>
            {data.is_ranked && !isTierList && (
              <Text variant="heading" color="textMuted" style={styles.rank}>
                {index + 1}
              </Text>
            )}

            {isTierList && item.tier && (
              <View style={[styles.tierBadge, { backgroundColor: TIER_COLOR[item.tier] }]}>
                <Text variant="bodyStrong" style={styles.tierText}>
                  {item.tier}
                </Text>
              </View>
            )}

            <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
              <PressableScale accessibilityRole="button" scaleTo={0.96}>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={POSTER}
                  rounded="small"
                />
              </PressableScale>
            </Link>

            <View style={styles.rowBody}>
              <Text variant="bodyStrong" numberOfLines={2}>
                {item.game?.title ?? 'Unknown game'}
              </Text>
              {item.game?.release_year && (
                <Text variant="micro" color="textMuted">
                  {item.game.release_year}
                </Text>
              )}

              {isOwner && isTierList && (
                <View style={styles.tierPicker}>
                  {TIERS.map((tier) => (
                    <PressableScale
                      key={tier}
                      accessibilityRole="button"
                      accessibilityLabel={`Set tier ${tier}`}
                      onPress={() =>
                        setTier.mutate({ item, tier: item.tier === tier ? null : tier })
                      }
                      scaleTo={0.88}
                      style={StyleSheet.flatten([
                        styles.tierChip,
                        {
                          backgroundColor:
                            item.tier === tier ? TIER_COLOR[tier] : theme.surfaceElevated,
                        },
                      ])}>
                      <Text
                        variant="micro"
                        style={{ color: item.tier === tier ? '#1A1A1A' : theme.textMuted }}>
                        {tier}
                      </Text>
                    </PressableScale>
                  ))}
                </View>
              )}
            </View>

            {isOwner && (
              <View style={styles.rowActions}>
                {!isTierList && (
                  <>
                    <IconButton
                      icon="chevron-up"
                      accessibilityLabel="Move up"
                      size="small"
                      tone="plain"
                      disabled={index === 0}
                      onPress={() => move.mutate({ index, direction: -1 })}
                    />
                    <IconButton
                      icon="chevron-down"
                      accessibilityLabel="Move down"
                      size="small"
                      tone="plain"
                      disabled={index === items.length - 1}
                      onPress={() => move.mutate({ index, direction: 1 })}
                    />
                  </>
                )}
                {/* `plain`: the row already has its own surface, and a boxed
                    outline around each glyph would make it a grid. */}
                <IconButton
                  icon="close"
                  accessibilityLabel="Remove from collection"
                  size="small"
                  tone="danger"
                  onPress={() => remove.mutate(item.game_id)}
                />
              </View>
            )}
          </View>
        )}
        ListEmptyComponent={
          <EmptyState
            title="Nothing in this list yet"
            message={isOwner ? 'Search for a game and tap it to add it here.' : undefined}
            action={
              isOwner ? (
                <Button title="Find games" variant="secondary" onPress={openPicker} />
              ) : undefined
            }
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.seven, gap: GRID_GAP },
  column: { gap: GRID_GAP },
  headerBleed: { marginHorizontal: -Spacing.four },
  controls: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  rankPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 18,
    alignItems: 'center',
    paddingHorizontal: 4,
    borderRadius: Radius.small,
  },
  rankPillText: { color: '#FFFFFF' },
  content: { padding: Spacing.four, paddingBottom: Spacing.seven },
  empty: { flexGrow: 1 },
  header: { gap: Spacing.two, marginBottom: Spacing.four },
  ownerActions: { flexDirection: 'row', gap: Spacing.two, marginTop: Spacing.two },
  ownerAction: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  rank: { minWidth: 26, textAlign: 'center' },
  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierText: { color: '#1A1A1A' },
  rowBody: { flex: 1, gap: Spacing.one },
  tierPicker: { flexDirection: 'row', gap: Spacing.one, marginTop: Spacing.one },
  tierChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActions: { gap: Spacing.one },
});
