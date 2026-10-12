import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { memo, useCallback, useMemo, useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { CriticReviews } from '@/components/critic-reviews';
import { MemberReviewCard } from '@/components/member-review-card';
import { ReviewBreakdown } from '@/components/review-breakdown';
import { ScoreSummary } from '@/components/score-summary';
import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { useSelectable } from '@/components/ui/selectable';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { PLATFORM_FAMILIES, familyForStored } from '@/constants/platform-family';
import { ArtRowWindow } from '@/constants/list-window';
import { ControlHeight, Radius, SmallControlSlop, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getGameReviewList,
  getRatingBreakdown,
  getReviewStats,
  type ReviewListItem,
  type ReviewSort,
} from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import {
  PLAY_FILTERS,
  PROGRESS_FILTERS,
  platformFacets,
  reviewBreakdown,
  type ReviewFilters,
  type ReviewPlayFilter,
  type ReviewProgressFilter,
} from '@/lib/review-facets';
import { useAuth } from '@/store/auth';

/**
 * How much of a review the list prints.
 *
 * Ten, against the five a card in the Overview's rail shows and the five in the
 * feed, and the difference is deliberate: those are samples offered to somebody
 * reading about a game or scrolling past one, and this is the screen they opened
 * *because* they want the reviews. Ten lines is most of a short review and enough
 * of a long one to tell whether the writer has a point — and it is a clamp rather
 * than a target, so the row stays a fixed, scannable height.
 *
 * None of the three expand in place. A clamp that can be opened makes a row in a
 * scrolling list change height under the thumb; the review's own page is the
 * screen with no clamp at all.
 */
const REVIEW_LINES = 10;

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

const ANY = { key: 'any', label: 'Any' } as const;

const PROGRESS_OPTIONS: readonly SortOption<ReviewProgressFilter | 'any'>[] = [
  ANY,
  ...PROGRESS_FILTERS,
];

const PLAY_OPTIONS: readonly SortOption<ReviewPlayFilter | 'any'>[] = [ANY, ...PLAY_FILTERS];

/** A stored platform → its family's key: the resolver `review-facets` folds by. */
const familyKeyOf = (stored: string) => familyForStored(stored)?.key ?? null;

export type GameReviewsSheetProps = {
  gameId: string;
  gameTitle: string;
  /** For matching the game on OpenCritic, which goes by title and year. */
  releaseYear: number | null;
  /** IGDB's aggregate of critics' scores: the critics' section, when OpenCritic has no quotes. */
  criticScore: number | null;
};

/**
 * Everything written about one game: what the critics made of it, then every
 * review the people here wrote, sorted and filtered.
 *
 * **Critics first, members under them** — the owner's direction (2026-10-09).
 * The critics' quotes were a rail on the game page's Overview; they are the
 * section at the head of this sheet now (`<CriticReviews>`), and under it,
 * headed as its own section, is the app's: GameLog's verdict, how it divides
 * by how people played, and the list.
 *
 * Lives inside `<SlideUpSheet>` rather than on a route, which is what lets the
 * game page stay mounted underneath and be revealed by a drag rather than by a
 * navigation. It replaced the game page's Reviews tab: a tab put the writing
 * behind a control that also switched between a synopsis and a similar-games
 * rail, and reviews are the one thing on that page somebody comes back for.
 */
export function GameReviewsSheet({
  gameId,
  gameTitle,
  releaseYear,
  criticScore,
}: GameReviewsSheetProps) {
  const theme = useTheme();
  const selectable = useSelectable();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const [sort, setSort] = useState<ReviewSort>('popular');
  const [score, setScore] = useState('any');
  /** A platform family's key — "playstation" — or "other". */
  const [family, setFamily] = useState<string | null>(null);
  const [progress, setProgress] = useState<ReviewProgressFilter | null>(null);
  const [play, setPlay] = useState<ReviewPlayFilter | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  /* Gamelog's own numbers for this game (0026), and the platforms the list can
     be narrowed to. Independent of the filters, like the histogram below: the
     breakdown is what the game scored, and re-drawing it for "Co-op" would
     print one row and call it the verdict. */
  const stats = useQuery({
    queryKey: ['review-stats', gameId],
    queryFn: () => getReviewStats(gameId),
    staleTime: 60_000,
  });

  const facets = useMemo(
    () => platformFacets(stats.data?.written_platforms ?? [], PLATFORM_FAMILIES, familyKeyOf),
    [stats.data]
  );
  const sections = useMemo(
    () => (stats.data ? reviewBreakdown(stats.data, PLATFORM_FAMILIES, familyKeyOf) : []),
    [stats.data]
  );

  const band = SCORES.find((entry) => entry.key === score) ?? SCORES[0];
  const filters: ReviewFilters = useMemo(
    () => ({
      /* Every spelling the family was recorded under. A family that has since
         lost its last review sends an empty list, which finds nothing — rather
         than quietly widening to every platform under a pill that says one. */
      platforms: family ? (facets.find((facet) => facet.key === family)?.values ?? []) : null,
      minScore: band.min,
      maxScore: band.max,
      progress,
      play,
    }),
    [family, facets, band.min, band.max, progress, play]
  );

  const activeFilters =
    (family ? 1 : 0) + (score !== 'any' ? 1 : 0) + (progress ? 1 : 0) + (play ? 1 : 0);
  const filterLook = selectable(activeFilters > 0);

  function clearFilters() {
    setFamily(null);
    setScore('any');
    setProgress(null);
    setPlay(null);
  }

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

  const header = (
    <View>
      <View style={styles.title}>
        <Text variant="h1" numberOfLines={2}>
          {gameTitle}
        </Text>
        <Text variant="label" color="textMuted">
          REVIEWS
        </Text>
      </View>

      {/* What the critics wrote, or — when OpenCritic has nothing to quote —
          IGDB's average of their scores. Nothing at all when there is neither.
          Outside the padded block below: its rail runs to the sheet's edges. */}
      <CriticReviews
        gameId={gameId}
        title={gameTitle}
        releaseYear={releaseYear}
        igdbScore={criticScore}
      />

      <View style={styles.header}>
        {/* The app's own, headed as a section so it reads as the second of
            two — and so a sheet with no critics still says whose these are. */}
        <Text variant="h4" accessibilityRole="header" style={styles.members}>
          GameLog reviews
        </Text>

        {/* The same summary the Ratings card on the Overview draws
            (`<ScoreSummary>`). No "GAMELOG" label over it: the heading says it. */}
        <ScoreSummary breakdown={breakdown.data ?? null} loading={breakdown.isPending} />

        <ReviewBreakdown
          sections={sections}
          failed={stats.isLoadingError}
          onRetry={() => void stats.refetch()}
        />

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
            hitSlop={SmallControlSlop}
            /* Lit while any filter is on, so a narrowed list says so even with
             the panel folded away. */
            pressedColor={filterLook.pressedColor}
            focusRing={filterLook.focusRing}
            style={StyleSheet.flatten([styles.filterButton, filterLook.style])}>
            <Ionicons
              name="options-outline"
              size={16}
              color={activeFilters > 0 ? theme.text : theme.textSecondary}
            />
            <Text variant="bodySmall" color={filterLook.label}>
              {activeFilters > 0 ? `Filters · ${activeFilters}` : 'Filters'}
            </Text>
            <Ionicons
              name={filtersOpen ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.textMuted}
            />
          </PressableScale>
        </View>

        {/* Four questions, each one choice, and they compose: PC + Finished +
          Co-op is three clauses on one request (`lib/review-facets.ts`). The
          platforms offered are only the families somebody has reviewed this
          game on; the other three are fixed vocabularies, and one that finds
          nothing says so in the list below. */}
        {filtersOpen && (
          <View style={styles.filters}>
            <FilterGroup label="SCORE">
              <SortBar
                options={SCORES.map(({ key, label }) => ({ key, label }))}
                value={score}
                onChange={setScore}
                accessibilityLabel="Filter by score"
              />
            </FilterGroup>

            {facets.length > 0 && (
              <FilterGroup label="PLATFORM">
                <SortBar
                  options={[ANY, ...facets.map(({ key, label }) => ({ key, label }))]}
                  value={family ?? 'any'}
                  onChange={(key) => setFamily(key === 'any' ? null : key)}
                  accessibilityLabel="Filter by platform"
                />
              </FilterGroup>
            )}

            <FilterGroup label="PROGRESS">
              <SortBar
                options={PROGRESS_OPTIONS}
                value={progress ?? 'any'}
                onChange={(key) => setProgress(key === 'any' ? null : key)}
                accessibilityLabel="Filter by how far the reviewer got"
              />
            </FilterGroup>

            <FilterGroup label="SOLO OR CO-OP">
              <SortBar
                options={PLAY_OPTIONS}
                value={play ?? 'any'}
                onChange={(key) => setPlay(key === 'any' ? null : key)}
                accessibilityLabel="Filter by solo or co-op"
              />
            </FilterGroup>

            {activeFilters > 0 && (
              <View style={styles.clear}>
                <Button title="Clear filters" variant="ghost" size="small" onPress={clearFilters} />
              </View>
            )}
          </View>
        )}
      </View>
    </View>
  );

  return (
    <FlatList
      data={reviews.data ?? []}
      keyExtractor={(item) => item.log.id}
      {...ArtRowWindow}
      ListHeaderComponent={header}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      renderItem={renderReviewRow}
      ListEmptyComponent={
        reviews.isPending ? (
          <LoadingState label="Loading reviews…" />
        ) : reviews.isLoadingError ? (
          <ErrorState error={reviews.error} onRetry={() => reviews.refetch()} />
        ) : (
          <EmptyState
            title={activeFilters > 0 ? 'Nothing matches those filters' : 'No reviews yet'}
            message={
              activeFilters > 0
                ? 'Loosen one of them, or clear them to see everything written about this game.'
                : 'Nobody here has written about this one.'
            }
            action={
              activeFilters > 0 ? (
                <Button title="Clear filters" variant="secondary" onPress={clearFilters} />
              ) : undefined
            }
          />
        )
      }
    />
  );
}

/** One labelled filter question. */
function FilterGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={styles.filterGroup}>
      <Text variant="label" color="textMuted" accessibilityRole="header">
        {label}
      </Text>
      {children}
    </View>
  );
}

/**
 * One review, as the reference draws one on a film's page: the writer's face,
 * their name with the score and the replies at the far end of its line, the
 * words, and how many people liked it.
 *
 *     ◍   username                    84  ◔ 3
 *         the first line of the review…
 *         the second line…
 *         ♥ 12 likes
 *
 * The card is `<MemberReviewCard>` — the one the game page's Overview shows
 * the most liked review in, so a row here and that card are the same object
 * (the owner's direction, 2026-10-09). It was `<ReviewQuote>`: words, a name
 * and a score. The likes and replies it prints are already in this list's
 * query; nothing more is asked for.
 *
 * **Neutral, not the game's colour.** On the game page the card takes the
 * game's dark tone; this sheet is raised over that page and keeps the app's
 * own surface, as its rows always have, so the list reads as the sheet's
 * rather than as more of the page under it.
 *
 * How much of the review it prints is `REVIEW_LINES`, which says why.
 */
/* Memoised, and it opens its own review: the row used to be handed a fresh
   `onPress` closure by an inline `renderItem`, so every one of up to a hundred
   rows re-rendered whenever the sheet did — a sort, a filter pill, a query
   landing — to draw exactly what it already showed. */
const ReviewRow = memo(function ReviewRow({ item }: { item: ReviewListItem }) {
  const router = useRouter();
  const theme = useTheme();
  const { log } = item;
  const onPress = useCallback(
    () => router.push({ pathname: '/review/[id]', params: { id: log.id } }),
    [router, log.id]
  );

  const name = displayNameFor(log.profile);
  const headline = log.review_title?.trim();

  return (
    <View style={styles.rowWrap}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          headline ? `${name}’s review, “${headline}”` : `${name}’s review`,
          log.rating !== null ? `scored ${Math.round(log.rating)}` : null,
          log.spoilers ? 'Contains spoilers' : null,
          item.likes > 0 ? `${item.likes} ${item.likes === 1 ? 'like' : 'likes'}` : null,
          item.comments > 0
            ? `${item.comments} ${item.comments === 1 ? 'reply' : 'replies'}`
            : null,
          'Read all of it.',
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={onPress}
        scaleTo={0.99}>
        <MemberReviewCard
          name={name}
          avatarUrl={log.profile?.avatar_url ?? null}
          text={log.review ?? ''}
          score={log.rating}
          likes={item.likes}
          comments={item.comments}
          likedByViewer={item.likedByViewer}
          lines={REVIEW_LINES}
          spoiler={!!log.spoilers}
          fill={theme.surface}
        />
      </PressableScale>
    </View>
  );
});

const renderReviewRow = ({ item }: { item: ReviewListItem }) => <ReviewRow item={item} />;

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  title: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12, gap: Spacing.x8 },
  /* `x24` over each section's heading — the critics' has its own row's height
     above it, this one a margin: the two sections start the same distance
     under whatever is over them. */
  header: { paddingHorizontal: Spacing.x16, gap: Spacing.x8 },
  members: { marginTop: Spacing.x24, marginBottom: Spacing.x4 },
  controls: { gap: Spacing.x8, marginTop: Spacing.x16 },
  /* A filter pill like the sort pills above it, drawn at 32 and touched at
     the floor. */
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x8,
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    minHeight: ControlHeight.small,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  filters: { gap: Spacing.x16, marginTop: Spacing.x8 },
  filterGroup: { gap: Spacing.x8 },
  clear: { alignItems: 'flex-start' },
  rowWrap: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x12 },
});
