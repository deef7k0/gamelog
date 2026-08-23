import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { AwardShow } from '@/components/award-show';
import { CollectionHeader } from '@/components/collection-header';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, type ThemePalette } from '@/constants/theme';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import {
  deleteList,
  getEngagement,
  getList,
  getProfile,
  removeFromList,
  reorderList,
  setListCover,
  TIERS,
  type ListItem,
} from '@/lib/api';
import { gameSortOptions, sortGames, type GameSort } from '@/lib/games';
import { useAuth } from '@/store/auth';

const POSTER = 58;

/**
 * Three across.
 *
 * Wider than the library and Top 10 grids' four, and the reason is that this
 * screen opens on a half-display of artwork: a four-across grid under that puts
 * 88dp covers below a 390dp block of the same covers, which reads as the page
 * losing interest in its own subject. Three keeps the box art large enough to
 * recognise without its title.
 */
const GRID_COLUMNS = 3;
const GRID_GAP = Spacing.x12;

/**
 * `default` is the collection's own order — the sequence the owner arranged, or
 * the ranking if it is a ranked list — so it leads and is what the screen opens
 * on. Everything else is a temporary way of reading the same shelf; none of it
 * is written back.
 */
const SORTS = gameSortOptions(['default', 'title', 'newest', 'oldest', 'rating'], {
  default: 'List order',
});

/**
 * The tier ramp, warm → cool so the ordering reads before the letters do.
 *
 * Data rather than chrome, which is what exempts it from the one-accent rule —
 * see DESIGN.md § 1.5. Row-header fills only; the type on top of them is
 * `background`, because these are tuned as backgrounds for near-black text.
 */
function tierColor(tier: string, theme: ThemePalette): string {
  const ramp: Record<string, string> = {
    S: theme.tierS,
    A: theme.tierA,
    B: theme.tierB,
    C: theme.tierC,
    D: theme.tierD,
    F: theme.tierF,
  };
  return ramp[tier] ?? theme.surfaceElevated;
}

export default function ListDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { scrollY, onScroll } = useTopBarScroll();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [sort, setSort] = useState<GameSort>('default');
  const [pickingCover, setPickingCover] = useState(false);

  const { width } = useWindowDimensions();
  const gridWidth = gridItemWidth(width, GRID_COLUMNS, Spacing.x16, GRID_GAP);

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

  // `getEngagement` is keyed by target, so one call covers this collection.
  const engagement = useQuery({
    queryKey: ['engagement', 'list', id, userId ?? null],
    queryFn: async () => (await getEngagement('list', [id!], userId ?? null))[id!],
    enabled: !!id,
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
   * Choosing the cover is a *mode* over the existing grid rather than a picker
   * screen. The collection is already a wall of its own games — putting a
   * second copy of that wall behind a modal would be the same list twice, and
   * the owner would be choosing from thumbnails without the context of the
   * collection they are choosing for.
   */
  const setCover = useMutation({
    mutationFn: (gameId: string) => setListCover(id!, gameId),
    onSuccess: () => {
      invalidate();
      setPickingCover(false);
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
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <LoadingState />
      </Screen>
    );
  }

  if (list.isError) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <ErrorState error={list.error} />
      </Screen>
    );
  }

  if (!list.data) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <EmptyState title="List not found" />
      </Screen>
    );
  }

  const data = list.data;
  const isOwner = data.user_id === userId;
  const isTierList = data.kind === 'tier';
  const isAwards = data.kind === 'awards';

  const header = (
    /* Cancels the list's horizontal padding so the hero reaches both edges and
       runs under the floating header, the way a game page opens. The header's
       own body re-applies the inset to its text. */
    <View style={styles.headerBleed}>
      {/* Every action lives in the masthead's circular row now — share, like,
          change preview, add games, delete. Liking used to be a separate
          `<EngagementBar>` below the header, which put the like count in one
          place and the like button in another. */}
      <CollectionHeader
        collection={data}
        owner={owner.data ?? null}
        isOwner={isOwner}
        engagement={engagement.data}
        onShare={() =>
          Share.share({
            message: `${data.title} — ${items.length} games on GameLog`,
          }).catch(() => undefined)
        }
        onEdit={isOwner ? openPicker : undefined}
        onDelete={isOwner ? () => destroy.mutate() : undefined}
        onPickCover={isOwner ? () => setPickingCover(true) : undefined}
      />

      {/* The picking mode's own bar. Only while the mode is on: the control
          that *enters* it is the masthead's image button. */}
      {pickingCover && (
        <View style={styles.controls}>
          <View style={[styles.coverHint, { backgroundColor: theme.surfaceElevated }]}>
            <Text variant="bodySmall" color="textSecondary" style={styles.coverHintText}>
              Tap a game to use its cover as this collection&rsquo;s preview.
            </Text>
            <Button
              title="Cancel"
              variant="ghost"
              size="small"
              onPress={() => setPickingCover(false)}
            />
          </View>
        </View>
      )}

      {/* A tier list is grouped by tier, so reordering it by year would
          scramble the only structure it has — no sort row there.

          Nor on an award show, where the row was rendering and doing nothing:
          the ballot comes from `list_awards` and `sort` only ever reorders
          `items`, so every option on it was a control that moved nothing. */}
      {!isTierList && !isAwards && items.length > 1 && (
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
   * Three layouts, one screen.
   *
   * An award show is a ballot of *categories* — rows that exist before there is
   * a game in them — so it reads `list_awards` rather than the items above and
   * lives in its own component. A tier list is a ranking: each entry needs its
   * tier badge, its position and its remove control, so it stays a row.
   * Everything else is a shelf, and a four-across poster grid shows far more of
   * it per screen — which is the whole point of a collection.
   *
   * The kind is not known until the list query resolves, which is why this
   * branches here rather than at the top of the file: every tile in the app
   * links to `/list/<id>` without knowing what shape is behind it.
   */
  if (isAwards) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back scrollY={scrollY} />}>
        <AwardShow listId={id!} isOwner={isOwner} header={header} onScroll={onScroll} />
      </Screen>
    );
  }

  if (!isTierList) {
    return (
      /* The mosaic runs full-bleed under the bar, so no `insetHeader` and no
         title: the collection's name is set over its own artwork right below. */
      <Screen edges={['bottom']} topBar={<FrostedTopBar back scrollY={scrollY} />}>
        <Animated.FlatList
          data={ordered}
          onScroll={onScroll}
          scrollEventThrottle={16}
          key="collection-grid"
          numColumns={GRID_COLUMNS}
          keyExtractor={(item) => item.game_id}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => {
            const tile = (
              <View style={{ width: gridWidth }}>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={gridWidth}
                  rounded="image"
                />
                {data.is_ranked && !pickingCover && (
                  <View style={[styles.rankPill, { backgroundColor: theme.scrim }]}>
                    <Text variant="caption" color="onPrimary">
                      {rankOf.get(item.game_id)}
                    </Text>
                  </View>
                )}
                {pickingCover && data.cover_game_id === item.game_id && (
                  <View style={[styles.coverMark, { backgroundColor: theme.primary }]}>
                    <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                  </View>
                )}
              </View>
            );

            /* In picking mode a tap chooses the cover instead of opening the
               game — same target, different verb, so the grid does not have to
               grow a second control on every tile. */
            if (pickingCover) {
              return (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={`Use ${item.game?.title ?? 'this game'} as the preview`}
                  scaleTo={0.95}
                  onPress={() => setCover.mutate(item.game_id)}>
                  {tile}
                </PressableScale>
              );
            }

            return (
              <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={item.game?.title ?? 'Game'}
                  scaleTo={0.95}>
                  {tile}
                </PressableScale>
              </Link>
            );
          }}
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
    <Screen edges={['bottom']} topBar={<FrostedTopBar back scrollY={scrollY} />}>
      <Animated.FlatList
        data={items}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.game_id}
        contentContainerStyle={items.length === 0 ? styles.empty : styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        renderItem={({ item, index }) => (
          <View style={[styles.row, { borderTopColor: theme.border }]}>
            {data.is_ranked && !isTierList && (
              <Text variant="h3" color="textMuted" style={styles.rank}>
                {index + 1}
              </Text>
            )}

            {isTierList && item.tier && (
              <View style={[styles.tierBadge, { backgroundColor: tierColor(item.tier, theme) }]}>
                <Text variant="h5" color="background">
                  {item.tier}
                </Text>
              </View>
            )}

            {pickingCover ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`Use ${item.game?.title ?? 'this game'} as the preview`}
                scaleTo={0.96}
                onPress={() => setCover.mutate(item.game_id)}>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={POSTER}
                  rounded="image"
                />
                {data.cover_game_id === item.game_id && (
                  <View style={[styles.coverMark, { backgroundColor: theme.primary }]}>
                    <Ionicons name="checkmark" size={14} color={theme.onPrimary} />
                  </View>
                )}
              </PressableScale>
            ) : (
              <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
                <PressableScale accessibilityRole="button" scaleTo={0.96}>
                  <Poster
                    coverUrl={item.game?.cover_url}
                    heroUrl={item.game?.hero_url}
                    title={item.game?.title}
                    width={POSTER}
                    rounded="image"
                  />
                </PressableScale>
              </Link>
            )}

            <View style={styles.rowBody}>
              <Text variant="h5" numberOfLines={2}>
                {item.game?.title ?? 'Unknown game'}
              </Text>
              {item.game?.release_year && (
                <Text variant="caption" color="textMuted">
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
                            item.tier === tier ? tierColor(tier, theme) : theme.surfaceElevated,
                        },
                      ])}>
                      <Text
                        variant="caption"
                        style={{ color: item.tier === tier ? theme.background : theme.textMuted }}>
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
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GRID_GAP },
  column: { gap: GRID_GAP },
  headerBleed: { marginHorizontal: -Spacing.x16 },
  controls: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16, gap: Spacing.x12 },
  rankPill: {
    position: 'absolute',
    top: 4,
    left: 4,
    minWidth: 18,
    alignItems: 'center',
    paddingHorizontal: Spacing.x4,
    borderRadius: Radius.image,
  },

  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  empty: { flexGrow: 1 },
  header: { gap: Spacing.x8, marginBottom: Spacing.x16 },
  ownerActions: { flexDirection: 'row', gap: Spacing.x8, marginTop: Spacing.x8 },
  ownerAction: { flex: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rank: { minWidth: 26, textAlign: 'center' },
  tierBadge: {
    width: 30,
    height: 30,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },

  rowBody: { flex: 1, gap: Spacing.x4 },
  coverHint: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingLeft: Spacing.x12,
    paddingRight: Spacing.x4,
    borderRadius: Radius.control,
  },
  coverHintText: { flex: 1 },
  /* Sits where the rank pill would, so the two never overlap — the rank is
     hidden while picking. */
  coverMark: {
    position: 'absolute',
    top: Spacing.x4,
    left: Spacing.x4,
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tierPicker: { flexDirection: 'row', gap: Spacing.x4, marginTop: Spacing.x4 },
  tierChip: {
    width: 24,
    height: 24,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowActions: { gap: Spacing.x4 },
});
