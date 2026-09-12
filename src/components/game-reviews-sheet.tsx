import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { ReviewCard } from '@/components/review-card';
import { ScoreTile } from '@/components/ui/score-tile';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Card, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { ratingVerdict } from '@/constants/score';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import {
  getGameReviewList,
  getRatingBreakdown,
  getReviewPlatforms,
  type ReviewFilters,
  type ReviewListItem,
  type ReviewSort,
} from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * How much of a review the list prints.
 *
 * Eight, against the three `<TopReviewCard>` shows on Overview, and the
 * difference is deliberate: that card is a sample offered to somebody reading
 * about a game, this is the screen they opened *because* they want the reviews.
 * Eight lines is most of a short review and enough of a long one to tell whether
 * the writer has a point — and it is a clamp rather than a target, so the row
 * stays a fixed, scannable height.
 */
const REVIEW_LINES = 8;

const SORTS: readonly SortOption<ReviewSort>[] = [
  { key: 'popular', label: 'Most liked' },
  { key: 'newest', label: 'Newest' },
  { key: 'week', label: 'This week' },
  { key: 'month', label: 'This month' },
];

/**
 * Score filters, as decades.
 *
 * Bounds rather than bands: "80+" is what somebody scanning for a good game
 * actually asks, and it composes — 70+ includes the 90s. The one exception is
 * the last entry, which is the only *upper* bound and the only way to find the
 * reviews that disliked it.
 */
const SCORES: readonly { key: string; label: string; min: number | null; max: number | null }[] = [
  { key: 'any', label: 'Any score', min: null, max: null },
  { key: '90', label: '90+', min: 90, max: null },
  { key: '80', label: '80+', min: 80, max: null },
  { key: '70', label: '70+', min: 70, max: null },
  { key: '60', label: '60+', min: 60, max: null },
  { key: 'low', label: 'Below 60', min: null, max: 59 },
];

/** The bar's three segments, in the order they are drawn. */
const SEGMENTS = [
  { key: 'low', tone: 'scoreLow' as const, from: 0, to: 4 },
  { key: 'mid', tone: 'scoreMid' as const, from: 5, to: 6 },
  { key: 'high', tone: 'scoreHigh' as const, from: 7, to: 9 },
];

export type GameReviewsSheetProps = {
  gameId: string;
  gameTitle: string;
  /** IGDB's aggregate, which the masthead already shows as COMMUNITY. */
  criticScore: number | null;
};

/**
 * Every review of one game, sorted and filtered.
 *
 * Lives inside `<SlideUpSheet>` rather than on a route, which is what lets the
 * game page stay mounted underneath and be revealed by a drag rather than by a
 * navigation. It replaced the game page's Reviews tab: a tab put the writing
 * behind a control that also switched between a synopsis and a similar-games
 * rail, and reviews are the one thing on that page somebody comes back for.
 */
export function GameReviewsSheet({ gameId, gameTitle, criticScore }: GameReviewsSheetProps) {
  const theme = useTheme();
  const router = useRouter();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const [sort, setSort] = useState<ReviewSort>('popular');
  const [score, setScore] = useState('any');
  const [platform, setPlatform] = useState<string | null>(null);
  const [platinumOnly, setPlatinumOnly] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const band = SCORES.find((entry) => entry.key === score) ?? SCORES[0];
  const filters: ReviewFilters = useMemo(
    () => ({ platform, minScore: band.min, maxScore: band.max, platinumOnly }),
    [platform, band.min, band.max, platinumOnly]
  );

  const activeFilters = (platform ? 1 : 0) + (score !== 'any' ? 1 : 0) + (platinumOnly ? 1 : 0);

  const reviews = useQuery({
    queryKey: ['game-review-list', gameId, sort, filters, viewerId],
    queryFn: () => getGameReviewList(gameId, sort, filters, viewerId),
    staleTime: 60_000,
  });

  /* The distribution is every rated log, not just the written ones, and it is
     deliberately independent of the filters above — the graph is what the game
     scored, and re-drawing it for "90+" would show one green bar and claim it
     was the verdict. */
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    staleTime: 60_000,
  });

  const platforms = useQuery({
    queryKey: ['review-platforms', gameId],
    queryFn: () => getReviewPlatforms(gameId),
    staleTime: 5 * 60_000,
  });

  const header = (
    <View style={styles.header}>
      <Text variant="h1" numberOfLines={2}>
        {gameTitle}
      </Text>
      <Text variant="label" color="textMuted">
        REVIEWS
      </Text>

      <ScoreSummary breakdown={breakdown.data ?? null} loading={breakdown.isPending} />

      {criticScore !== null && (
        <View style={[styles.critics, { borderTopColor: theme.border }]}>
          <View style={styles.criticText}>
            <Text variant="label" color="textMuted">
              CRITICS
            </Text>
            <Text variant="bodySmall" color="textSecondary">
              {ratingVerdict(criticScore, 999).label}
            </Text>
            {/* No distribution to draw: IGDB publishes one averaged number and a
                count, never the spread. A bar here would be invented. */}
            <Text variant="caption" color="textMuted">
              Aggregated by IGDB
            </Text>
          </View>
          <ScoreTile score={criticScore} size="medium" />
        </View>
      )}

      <View style={styles.controls}>
        <SortBar
          options={SORTS}
          value={sort}
          onChange={setSort}
          accessibilityLabel="Sort reviews"
        />

        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ expanded: filtersOpen }}
          accessibilityLabel={activeFilters > 0 ? `Filters, ${activeFilters} active` : 'Filters'}
          onPress={() => setFiltersOpen((open) => !open)}
          scaleTo={0.96}
          style={StyleSheet.flatten([
            styles.filterButton,
            {
              backgroundColor: activeFilters > 0 ? theme.surfaceSelected : theme.surfaceElevated,
              borderColor: activeFilters > 0 ? theme.borderStrong : theme.border,
            },
          ])}>
          <Ionicons
            name="options-outline"
            size={17}
            color={activeFilters > 0 ? theme.text : theme.textSecondary}
          />
          <Text variant="caption" color={activeFilters > 0 ? 'text' : 'textSecondary'}>
            {activeFilters > 0 ? `Filters · ${activeFilters}` : 'Filters'}
          </Text>
          <Ionicons
            name={filtersOpen ? 'chevron-up' : 'chevron-down'}
            size={14}
            color={theme.textMuted}
          />
        </PressableScale>
      </View>

      {filtersOpen && (
        <View style={styles.filters}>
          <View style={styles.filterGroup}>
            <Text variant="label" color="textMuted">
              SCORE
            </Text>
            <SortBar
              options={SCORES.map(({ key, label }) => ({ key, label }))}
              value={score}
              onChange={setScore}
              accessibilityLabel="Filter by score"
            />
          </View>

          {(platforms.data ?? []).length > 0 && (
            <View style={styles.filterGroup}>
              <Text variant="label" color="textMuted">
                PLATFORM
              </Text>
              <SortBar
                options={[
                  { key: 'any', label: 'Any' },
                  ...(platforms.data ?? []).map((name) => ({ key: name, label: name })),
                ]}
                value={platform ?? 'any'}
                onChange={(key) => setPlatform(key === 'any' ? null : key)}
                accessibilityLabel="Filter by platform"
              />
            </View>
          )}

          <PressableScale
            accessibilityRole="checkbox"
            accessibilityState={{ checked: platinumOnly }}
            accessibilityLabel="Platinum runs only"
            onPress={() => setPlatinumOnly((value) => !value)}
            scaleTo={0.98}
            style={StyleSheet.flatten([
              styles.toggle,
              {
                backgroundColor: platinumOnly ? theme.surfaceSelected : theme.surfaceElevated,
                borderColor: platinumOnly ? theme.borderStrong : theme.border,
              },
            ])}>
            <Ionicons
              name={platinumOnly ? 'checkbox' : 'square-outline'}
              size={19}
              color={platinumOnly ? theme.platinum : theme.textMuted}
            />
            <Text variant="body" color={platinumOnly ? 'text' : 'textSecondary'}>
              Platinum runs only
            </Text>
          </PressableScale>
        </View>
      )}
    </View>
  );

  return (
    <FlatList
      data={reviews.data ?? []}
      keyExtractor={(item) => item.log.id}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={({ item }) => (
        <ReviewRow
          item={item}
          onPress={() => router.push({ pathname: '/review/[id]', params: { id: item.log.id } })}
        />
      )}
      ListEmptyComponent={
        reviews.isPending ? (
          <LoadingState label="Loading reviews…" />
        ) : reviews.isError ? (
          <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
        ) : (
          <EmptyState
            title={activeFilters > 0 ? 'Nothing matches those filters' : 'No reviews yet'}
            message={
              activeFilters > 0
                ? 'Loosen one of them, or clear them to see everything written about this game.'
                : 'Nobody here has written about this one.'
            }
          />
        )
      }
    />
  );
}

/**
 * The distribution bar and the app's own average.
 *
 * Three segments, sized by how many reviews fall in each band — so a game with
 * eighty positives and two negatives shows a sliver of red, which is the honest
 * picture and the thing an average alone cannot say.
 */
function ScoreSummary({
  breakdown,
  loading,
}: {
  breakdown: { buckets: number[]; total: number; average: number } | null;
  loading: boolean;
}) {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Skeleton width="55%" height={13} radius={Radius.sm} />
          <Skeleton width="40%" height={11} radius={Radius.sm} />
        </View>
        <Skeleton width={62} height={62} radius={Radius.image} />
      </View>
    );
  }

  if (!breakdown) return null;

  const verdict = ratingVerdict(breakdown.average, breakdown.total);
  const counts = SEGMENTS.map((segment) =>
    breakdown.buckets.slice(segment.from, segment.to + 1).reduce((sum, n) => sum + n, 0)
  );
  const total = counts.reduce((sum, n) => sum + n, 0) || 1;

  return (
    <View style={styles.summaryBlock}>
      <View style={styles.summary}>
        <View style={styles.summaryText}>
          <Text variant="label" color="textMuted">
            GAMELOG
          </Text>
          <Text variant="h4">{verdict.label}</Text>
          <Text variant="caption" color="textMuted">
            Based on {breakdown.total} {breakdown.total === 1 ? 'review' : 'reviews'}
          </Text>
        </View>
        <ScoreTile score={breakdown.average} size="medium" />
      </View>

      {/* Each segment is a flex weight, so the three always fill the bar exactly
          and no rounding gap opens between them. A band with no reviews renders
          nothing at all rather than a 1px sliver claiming one. */}
      <View
        style={styles.bar}
        accessible
        accessibilityLabel={`${counts[2]} positive, ${counts[1]} mixed, ${counts[0]} negative`}>
        {SEGMENTS.map((segment, index) =>
          counts[index] > 0 ? (
            <View
              key={segment.key}
              style={{
                flex: counts[index] / total,
                backgroundColor: theme[segment.tone],
                borderRadius: Radius.pill,
              }}
            />
          ) : null
        )}
      </View>
    </View>
  );
}

/**
 * One review, at the size a review deserves.
 *
 * ## The layout, and the one thing it does not do
 *
 * Three bands: who wrote it and when, then the score beside the prose, then the
 * two ways to answer it.
 *
 *     (pfp) username                     12 hours ago
 *     ┌────┐  the first line of the review…
 *     │ 84 │  the second line…
 *     └────┘  the third line…
 *     ♡ 12   💬 3
 *
 * The sketch this was built from had the text *wrapping back under* the score
 * tile at line four — a magazine drop-cap float. **React Native cannot do
 * that**, and it is worth writing down so nobody tries again: there is no
 * `float`, and an inline `<View>` inside a `<Text>` occupies one line box rather
 * than reflowing the lines beneath it. The only way to get it is to measure with
 * `onTextLayout`, split the string at the returned line boundary and render two
 * `<Text>`s — a setState and a second layout pass per row, inside a `FlatList`,
 * on the screen whose whole job is scrolling smoothly through a hundred of
 * these. The column is the honest trade: the tile and the prose still share a
 * top edge and still sit under the name, which is what the sketch was after.
 *
 * ## Why the body is six lines
 *
 * Because this is the list you open *to read reviews*, as opposed to the single
 * card on Overview where two lines are a taste. Six is roughly a paragraph —
 * enough to tell whether the writer has a point — and the row stays a fixed,
 * scannable height because it is a clamp rather than a target.
 */
function ReviewRow({ item, onPress }: { item: ReviewListItem; onPress: () => void }) {
  const { log } = item;

  /* The optimistic heart, from the shared hook rather than a second copy of the
     same override rule. The row is fed a plain count and flag, which is exactly
     the `Engagement` shape it wants. */
  const { liked, likeCount, toggle } = useLikeToggle('log', log.id, {
    likes: item.likes,
    comments: item.comments,
    likedByViewer: item.likedByViewer,
  });

  return (
    <View style={styles.rowWrap}>
      <Card padded={false} style={styles.rowCard}>
        {/*
          The row's interior is `<ReviewCard>`, shared with the game page's
          Overview card and with Surprise Me.

          All three show one person's review of a game you are already looking
          at, and all three used to draw it differently: this one led with an
          avatar row and a timestamp beside a 62dp score tile, the Overview card
          led with the tile alone. One shape, one file — and the game's title
          appears on none of them, because it is the name of the screen.

          The timestamp went with the redraw. It was the only thing on the row
          that the review itself did not say, and it was competing for the top
          line with the writer's name; the full review page prints the date.
        */}
        <ReviewCard
          log={log}
          lines={REVIEW_LINES}
          liked={liked}
          likeCount={likeCount}
          onToggleLike={toggle}
          onOpen={onPress}
        />
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  header: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12, gap: Spacing.x8 },
  summaryBlock: { gap: Spacing.x8, marginTop: Spacing.x12 },
  summary: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  summaryText: { flex: 1, gap: 2 },
  /*
   * `gap`, and it is not decoration.
   *
   * Adjacent segments measure 1.17:1 against each other (amber against green) —
   * a boundary a protanopic reader cannot see at all, so the bar would read as
   * one undivided block and say nothing. Two points of page colour between them
   * is the second carrier, and the only one available to somebody looking rather
   * than listening; the accessible label carries the three counts for everyone
   * else.
   */
  bar: {
    flexDirection: 'row',
    gap: 2,
    height: 8,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  critics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingTop: Spacing.x12,
    marginTop: Spacing.x4,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  criticText: { flex: 1, gap: 2 },
  controls: { gap: Spacing.x8, marginTop: Spacing.x16 },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    minHeight: TapTarget - Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  filters: { gap: Spacing.x16, marginTop: Spacing.x8 },
  filterGroup: { gap: Spacing.x8 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  rowWrap: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
  rowCard: { padding: Spacing.x12, gap: Spacing.x8 },
  whoRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* `flex: 1`, not `flexShrink` — it has to *take* the free space so the
     timestamp is pushed to the right edge rather than sitting next to the name
     on a short one. Truncation on a long name still works, because a flex child
     may shrink below its content width. */
  name: { flex: 1 },
  /* `alignItems: 'flex-start'`, so a short review leaves the tile at the top
     rather than floating it in the middle of the row. */
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  prose: { flex: 1 },
  engagement: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  /* Slop, not padding: an 18dp glyph would be a 22dp target, and the row's
     height is set by the card. `TapTarget - Spacing.x16` is the same figure
     `<TopReviewCard>` uses for the identical pair of controls. */
  engageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    minHeight: TapTarget - Spacing.x16,
    paddingRight: Spacing.x8,
  },
});
