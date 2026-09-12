import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { AwardShow } from '@/components/award-show';
import { CollectionHeader } from '@/components/collection-header';
import { CaptionedGrid } from '@/components/captioned-grid';
import { CommentSection } from '@/components/comment-section';
import { CollectionRow } from '@/components/collection-row';
import { CollectionToolbar, type CollectionLayout } from '@/components/collection-toolbar';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
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
import { sortGames, type GameSort } from '@/lib/games';
import { useAuth } from '@/store/auth';

const POSTER = 58;

/**
 * Four across, matching the library and Top 10 grids.
 *
 * It was three, on the argument that this screen opens on a half-display of
 * artwork and a denser grid under that reads as the page losing interest in its
 * own subject. Four wins anyway, for a reason the argument missed: a collection
 * is a *shelf*, and the number of games you can see at once is most of what
 * makes it feel like one. Three across put nine games on the first screenful of
 * a fifty-game collection. `gridItemWidth` still subtracts the gutters, so the
 * covers stay as large as the width allows.
 */
const GRID_COLUMNS = 4;
const GRID_GAP = Spacing.x12;

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
  const { onScroll } = useTopBarScroll();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [sort, setSort] = useState<GameSort>('default');
  const [layout, setLayout] = useState<CollectionLayout>('grid');
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
  const isCaptioned = data.kind === 'captioned';

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
        onEditDetails={
          isOwner
            ? () => router.push({ pathname: '/edit-list/[id]', params: { id: data.id } })
            : undefined
        }
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

      {/*
        Sort and layout, on one row directly above the games.

        A tier list is grouped by tier and an award show's rows come from
        `list_awards`, so neither can be re-ordered by this control — but both
        can still be *drawn* two ways, which is why the toolbar renders for them
        with `showSort` off rather than being suppressed entirely. A captioned
        board is the one shape that gets neither: its arrangement is authored,
        nine tiles answering one question in the order their owner put them, and
        it has its own layout by definition.
      */}
      {!isCaptioned && items.length > 1 && (
        <View style={styles.controls}>
          <CollectionToolbar
            sort={sort}
            onSort={setSort}
            layout={layout}
            onLayout={setLayout}
            showSort={!isTierList && !isAwards}
          />
        </View>
      )}
    </View>
  );

  /*
   * The conversation about the collection, under it.
   *
   * Migration 0018 is what makes this possible — `comments` only accepted a post
   * or a log until then, which is why a collection could be liked but not
   * answered. Curation is an argument (the About says so in the owner's own
   * words) and an argument nobody can reply to is a broadcast.
   *
   * Not rendered while picking a cover: that mode turns every tile into a
   * different control, and a composer underneath it is an invitation to tap
   * something that does something else.
   */
  const footer = pickingCover ? null : (
    <View style={styles.comments}>
      <CommentSection targetType="list" targetId={data.id} />
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
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <AwardShow listId={id!} isOwner={isOwner} header={header} onScroll={onScroll} />
      </Screen>
    );
  }

  /*
   * A captioned board.
   *
   * Its own branch rather than a flag on the grid below, because the two are
   * different objects: that one is a wall of artwork where the cover *is* the
   * row, and this one is a set of statements where the cover illustrates a line
   * of the owner's text. They share a data shape and nothing else — different
   * columns, different tile, different tap target on the caption.
   *
   * Rendered inside a single-item list rather than as its own `numColumns` grid
   * so the masthead, the comments and the board scroll as one column; the grid
   * lays itself out with `flexWrap`, which a `numColumns` FlatList cannot be
   * given without also handing it the tile height in advance.
   */
  if (isCaptioned) {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <Animated.FlatList
          data={[null]}
          keyExtractor={() => 'board'}
          onScroll={onScroll}
          scrollEventThrottle={16}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          /* No wrapper and no second padding. `styles.content` already insets
             this list by `Spacing.x16` on both sides; a `board` View adding its
             own put 48dp of padding between the screen edges and the grid while
             the grid was told it had only 24dp taken — so on a 360dp phone it
             sized three 108dp tiles into 312dp of space and the third wrapped.
             The width handed down has to be the width that actually exists. */
          renderItem={() => (
            <CaptionedGrid
              listId={data.id}
              items={ordered}
              isOwner={isOwner}
              width={width - Spacing.x16 * 2}
            />
          )}
        />
      </Screen>
    );
  }

  /*
   * The list layout: one game per row, cover beside title.
   *
   * Its own return rather than a branch inside the grid's `renderItem`, because
   * `numColumns` is not a runtime-switchable prop — React Native warns and
   * refuses to re-lay-out a `FlatList` whose column count changed. The `key` on
   * each list is what forces a clean remount when the toggle flips, which is the
   * documented way to change it at all.
   */
  if (!isTierList && layout === 'rows') {
    return (
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
        <Animated.FlatList
          data={ordered}
          onScroll={onScroll}
          scrollEventThrottle={16}
          key="collection-rows"
          keyExtractor={(item) => item.game_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          ListFooterComponent={footer}
          ItemSeparatorComponent={() => (
            <View style={[styles.rowRule, { backgroundColor: theme.border }]} />
          )}
          renderItem={({ item }) => (
            <CollectionRow
              item={item}
              /* The stored rank, not the rendered index — a ranked collection
                 sorted by year still shows each game the number its owner gave
                 it. Unranked collections show none at all rather than numbering
                 a set, which would claim an order that is not there. */
              rank={data.is_ranked ? (rankOf.get(item.game_id) ?? null) : null}
              trailing={
                isOwner && !pickingCover ? (
                  <IconButton
                    icon="close"
                    accessibilityLabel={`Remove ${item.game?.title ?? 'this game'}`}
                    size="small"
                    tone="plain"
                    onPress={() => remove.mutate(item.game_id)}
                  />
                ) : null
              }
            />
          )}
          ListEmptyComponent={
            <EmptyState
              title="Nothing here yet"
              message={
                isOwner
                  ? 'Tap "Add games", then tap a search result to add it.'
                  : 'This collection is empty.'
              }
            />
          }
        />
      </Screen>
    );
  }

  if (!isTierList) {
    return (
      /* The mosaic runs full-bleed under the bar, so no `insetHeader` and no
         title: the collection's name is set over its own artwork right below. */
      <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
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
          ListFooterComponent={footer}
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
    <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
      <Animated.FlatList
        data={items}
        onScroll={onScroll}
        scrollEventThrottle={16}
        keyExtractor={(item) => item.game_id}
        contentContainerStyle={items.length === 0 ? styles.empty : styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListFooterComponent={footer}
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
  comments: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x32 },
  rowRule: { height: StyleSheet.hairlineWidth, marginLeft: Spacing.x16 },
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
