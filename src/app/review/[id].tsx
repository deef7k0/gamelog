import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, Share, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CommentSection } from '@/components/comment-section';
import { formatReleaseDate } from '@/components/game-actions';
import { ReportFlag, useCanReport } from '@/components/report-flag';
import { reviewCells } from '@/components/review-cells';
import { ReviewMetricsBreakdown } from '@/components/review-metrics';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { MarqueeText } from '@/components/ui/marquee-text';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RoundAction } from '@/components/ui/round-action';
import { ScoreMeter } from '@/components/ui/score-meter';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SQUARE_RADIUS, SQUARE_RATIO, SquareArt } from '@/components/ui/square-art';
import { StatsStrip } from '@/components/ui/stats-strip';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { EDITIONS, type EditionKind } from '@/constants/game-editions';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { PosterAspectRatio, Spacing } from '@/constants/theme';
import { AccentProvider, useAccent } from '@/hooks/use-accent';
import { useHeaderHeight, useTopBarInset } from '@/hooks/use-header-height';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { recallLog } from '@/lib/api/seen-logs';
import type { CachedGame, LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * One person's review of one game.
 *
 * ## It is built like Surprise Me, on purpose
 *
 * Top to bottom, the page is the dealt card's composition with a review under
 * it: who wrote it, centred in the band the back disc occupies; the game's
 * square art; the title and its credit line beside two round actions (like,
 * share); the score, centred on the art's axis over a bar; the playthrough as the
 * game page's stats strip; then the headline, the prose and the conversation.
 *
 * Every piece is the shared one rather than a copy — `<SquareArt>`,
 * `<RoundAction>` and `<MarqueeText>` are the objects Surprise Me draws, and
 * `<StatsStrip>` is the game page's — so the three screens cannot drift apart.
 * Everything is laid out in the artwork's column, exactly as the dealt card is:
 * the cover is the widest object here, so its edges are the page's margins.
 *
 * What it does **not** take from Surprise Me is the deck, the bloom and the
 * sheen. Those are the dealt card's own material (DESIGN.md § 4.2) and answer
 * a gesture this page does not have; a review is not dealt.
 *
 * ## It runs on the game's colour
 *
 * `<AccentProvider>`, and the page fills flat with `accent.page`, as the game
 * page and Surprise Me do. It used to be the one screen about a single game that
 * stayed a neutral dark room, on the argument that a reading surface should not
 * sit on a coloured field. The field is M3's `background` — the darkest tone of
 * the game's hue, not a lit gradient — so the prose keeps its contrast, and the
 * page now reads as part of the same object as the game it is about.
 *
 * ## What the reader can do, and where
 *
 * Like and share are the round actions beside the title, where Surprise Me
 * keeps its two. The like count and the date close the article, with the report
 * flag at the far end of that line — the one response that is not about whether
 * you enjoyed it, kept quiet and away from the other two.
 */
export default function ReviewScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const log = useQuery({
    queryKey: ['log', id],
    queryFn: () => getLogById(id!),
    enabled: !!id,
    /*
     * Start from the card that was tapped.
     *
     * Every list of reviews selects the same record this page asks for
     * (`api/seen-logs.ts`), so the page opens on it instead of on "Loading
     * review". The time it was loaded rides along, and past this query's
     * `staleTime` it is refreshed behind what is already on screen.
     */
    initialData: () => recallLog(id)?.value,
    initialDataUpdatedAt: () => recallLog(id)?.at,
  });

  /*
   * Every branch below carries a bar.
   *
   * `headerShown` is false app-wide, so a screen that renders no bar of its own
   * renders no way out of itself: the loading, error and not-found states were
   * each a centred block on an empty page whose only exit was the iOS edge
   * gesture. There is nothing to go back *to* on Android from there.
   */
  if (log.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <LoadingState label="Loading review" />
      </Screen>
    );
  }

  if (log.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <ErrorState error={log.error} onRetry={() => void log.refetch()} />
      </Screen>
    );
  }

  if (!log.data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState
          title="Review not found"
          message="It may have been deleted by the person who wrote it."
        />
      </Screen>
    );
  }

  const game = log.data.game;

  /* The provider is rendered here and read below: a component is not inside its
     own context, so the page itself is the child. */
  return (
    <AccentProvider artwork={game?.cover_url ?? game?.hero_url} genres={game?.genres}>
      <ReviewPage review={log.data} />
    </AccentProvider>
  );
}

/**
 * The widest the column gets. On a phone it is `SQUARE_RATIO` of the display, as
 * on Surprise Me; on a tablet or the web this is what stops the art from being
 * the whole screen and the prose from running to a 90-character measure.
 */
const MAX_COLUMN = 520;

/**
 * How far in from each edge the byline must stay: the back disc's inset, its
 * 44dp, and a gap. Both sides, so the name centres on the display rather than on
 * what is left of it.
 */
const DISC_CLEARANCE = Spacing.x16 + 44 + Spacing.x8;

/**
 * Lifts the byline to the platform floor **without reserving any height**. A
 * 24dp avatar beside one line of type is about 26dp; slop grows only the touch
 * area, so the band keeps the height the discs are centred in.
 */
const BYLINE_SLOP = { top: 11, bottom: 11, left: 8, right: 8 };

function ReviewPage({ review }: { review: LogWithRelations }) {
  const theme = useTheme();
  const accent = useAccent();
  const { width } = useWindowDimensions();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  /* The band the floating disc occupies, reserved in content — the same row
     Surprise Me states its own name in. */
  const headerHeight = useHeaderHeight();
  const barInset = useTopBarInset();

  const engagement = useQuery({
    queryKey: ['engagement', 'log', review.id, viewerId],
    queryFn: () => getEngagement('log', [review.id], viewerId),
  });

  /* The optimistic toggle lives in the hook, shared with the feed card and the
     collection masthead — this page must not grow its own copy of the like
     state. */
  const { liked, likeCount, toggle } = useLikeToggle(
    'log',
    review.id,
    engagement.data?.[review.id]
  );

  /* Whether the reader has uncovered a spoiler-flagged review. Per-visit rather
     than persisted: leaving and coming back re-covers it, which is the safer
     default for a screen somebody may hand to a friend. */
  const [revealed, setRevealed] = useState(false);

  const canReport = useCanReport(review.user_id);

  const game = review.game;
  const author = review.profile;
  const authorName = displayNameFor(author);
  const metrics = parseReviewMetrics(review.review_metrics);
  const hasProse = !!review.review?.trim();
  const cells = reviewCells(review, theme);

  const column = Math.round(Math.min(width * SQUARE_RATIO, MAX_COLUMN));
  const credit = [game?.release_year, game?.developer].filter(Boolean).join(' · ');

  async function handleShare() {
    try {
      const title = game?.title ?? 'a game';
      await Share.share({
        message: review.review_title
          ? `${review.review_title} — ${title} review by ${authorName} on GameLog`
          : `${title}: ${review.rating ?? ''}/100 review by ${authorName} on GameLog`,
      });
    } catch {
      // Dismissed
    }
  }

  return (
    <Screen edges={['bottom']} background={accent.page} topBar={<FrostedTopBar back />}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/*
          Who wrote it, centred in the disc's band — where Surprise Me says its
          own name.

          The byline is the page's first line because a review is somebody's
          opinion before it is anything else, and the band is where it fits
          without costing the art any height: the row is exactly as tall as the
          floating disc beside it, so the two read as one line of chrome.
        */}
        <View
          style={[
            styles.masthead,
            { height: headerHeight, paddingTop: barInset, paddingHorizontal: DISC_CLEARANCE },
          ]}>
          {author && (
            <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Review by ${authorName}. Opens their profile.`}
                hitSlop={BYLINE_SLOP}
                scaleTo={0.97}
                style={StyleSheet.flatten(styles.byline)}>
                <Avatar uri={author.avatar_url} name={authorName} size={24} />
                <Text variant="h4" numberOfLines={1} style={styles.bylineName}>
                  {authorName}
                </Text>
              </PressableScale>
            </Link>
          )}
        </View>

        <View style={[styles.column, { width: column }]}>
          {game && (
            <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Open ${game.title}`}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.art)}>
                <ReviewArt game={game} size={column} />
              </PressableScale>
            </Link>
          )}

          {/*
            The title and its credit line, ranged to the art's edges, with the
            two round actions at the right — Surprise Me's row, with a like and
            a share where that has a bookmark and a skip.
          */}
          <View style={styles.titleRow}>
            <View style={styles.titleText}>
              <MarqueeText
                text={game?.title ?? 'Unknown game'}
                variant="h3"
                accessibilityRole="header"
              />
              {!!credit && (
                <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
                  {credit}
                </Text>
              )}
            </View>

            <View style={styles.actions}>
              <RoundAction
                icon={liked ? 'heart' : 'heart-outline'}
                label={liked ? 'Unlike this review' : 'Like this review'}
                selected={liked}
                onPress={toggle}
              />
              <RoundAction icon="share-outline" label="Share this review" onPress={handleShare} />
            </View>
          </View>

          {/* The verdict, on the art's axis, over its length. */}
          {review.rating !== null && (
            <View style={styles.score}>
              <ScoreMeter score={review.rating} />
            </View>
          )}

          {/* The scorecard, when they scored by category: the bar above, broken
              down, so it sits directly under it. */}
          {metrics && (
            <View style={styles.metrics}>
              <ReviewMetricsBreakdown metrics={metrics} />
            </View>
          )}

          {/* How they played it, in the game page's strip — only what they
              recorded, so a quick review has a short strip or none. */}
          {cells.length > 0 && (
            <View style={styles.stats}>
              <StatsStrip cells={cells} />
            </View>
          )}

          {/*
            The article, in the review's own measure.

            `reviewProse` is Inter at 14/22 and `proseInk` a quieter ink than
            the interface's: a thousand words at interface brightness is a wall,
            and this is the one block in the app somebody actually reads.
          */}
          <View style={styles.article}>
            {!!review.review_title && (
              <Text variant="reviewTitle" accessibilityRole="header">
                {review.review_title}
              </Text>
            )}

            {/*
              The one screen where the notice uncovers rather than navigates.

              Everywhere else a flagged review is replaced by a box that sends
              the reader here — the decision to read a spoiler belongs on the
              screen that exists to be read. Here they have arrived on purpose,
              so one deliberate tap and the prose appears.
            */}
            {hasProse && review.spoilers && !revealed ? (
              <SpoilerNotice
                onPress={() => setRevealed(true)}
                minHeight={140}
                hint="Shows the review on this screen"
              />
            ) : hasProse ? (
              <Text variant="reviewProse" color="proseInk">
                {review.review}
              </Text>
            ) : (
              <Text variant="reviewProse" style={{ color: accent.quietInk }}>
                {authorName} scored this game without writing it up.
              </Text>
            )}
          </View>

          {/*
            The end of the piece: when it was written and how many liked it, and
            at the far end the flag, for anyone but its author.
          */}
          <View style={[styles.footer, { borderTopColor: accent.m3.outlineVariant }]}>
            <Text variant="bodySmall" style={[styles.footerText, { color: accent.quietInk }]}>
              {`Reviewed ${formatReleaseDate(review.created_at)}`}
              {likeCount > 0 ? ` · ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}` : ''}
            </Text>

            {canReport && (hasProse || !!review.review_title) && (
              <ReportFlag
                target={{ kind: 'review', logId: review.id }}
                authorId={review.user_id}
                label={`Report ${authorName}’s review`}
                withWord
              />
            )}
          </View>

          {/* The conversation, under the piece it is about. */}
          <View style={styles.comments}>
            <CommentSection targetType="log" targetId={review.id} />
          </View>
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * The game's art: the square when SteamGridDB has one, and the IGDB portrait at
 * the same height when it does not — Surprise Me's two shapes, for the same
 * reason. A 2:3 cover forced into a square loses a third of itself.
 *
 * **Nothing is drawn until the lookup has an answer**, only a skeleton in the
 * square's shape: painting the portrait and swapping it for the square a beat
 * later is exactly the flicker `useSquareCover`'s `resolved` exists to prevent.
 */
function ReviewArt({ game, size }: { game: CachedGame; size: number }) {
  const square = useSquareCover({ gameId: game.id, title: game.title });

  if (!square.resolved) return <Skeleton width={size} height={size} radius={SQUARE_RADIUS} />;

  if (square.uri) return <SquareArt uri={square.uri} size={size} title={game.title} />;

  /* `edition_kind` is a bare `string` on the cached row, and `editionLabel`
     indexes `EDITIONS` unguarded — narrow it rather than cast. The Steam capsule
     is preferred where the row has an appid; see CLAUDE.md's artwork ladder. */
  const edition =
    game.edition_kind && game.edition_kind in EDITIONS ? (game.edition_kind as EditionKind) : null;

  return (
    <Poster
      coverUrl={game.cover_url}
      heroUrl={game.hero_url}
      title={game.title}
      width={Math.round(size * PosterAspectRatio)}
      steamAppId={game.source === 'steam' ? game.source_id : null}
      edition={edition}
      elevated
    />
  );
}

const styles = StyleSheet.create({
  scroll: { alignItems: 'center', paddingBottom: Spacing.x48 },
  masthead: { alignSelf: 'stretch', alignItems: 'center', justifyContent: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, maxWidth: '100%' },
  bylineName: { flexShrink: 1 },
  /*
   * **Exactly as wide as the artwork**, set inline — the alignment rule for the
   * whole page, as it is on Surprise Me. The cover is the widest object here, so
   * its edges are the margins, and the title, the score, the strip and the prose
   * all share them.
   */
  column: { marginTop: Spacing.x8 },
  /* Centred in the column: the portrait fallback is narrower than the square
     and sits on the same axis. */
  art: { alignSelf: 'center' },
  /* The title and the two round actions on one line, the buttons against the
     middle of the two-line text column rather than against its first line. */
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    marginTop: Spacing.x20,
  },
  /* `minWidth: 0` is what lets the marquee's window clip: without it a long
     title measures its natural width and pushes the buttons off the row. */
  titleText: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  actions: { flexDirection: 'row', gap: Spacing.x8 },
  score: { marginTop: Spacing.x24 },
  metrics: { marginTop: Spacing.x16 },
  stats: { marginTop: Spacing.x12 },
  /*
   * The one interval deliberately larger than its neighbours: everything above
   * is a lockup you scan, the article is a thing you read, and the change of
   * task deserves the pause.
   */
  article: { marginTop: Spacing.x32, gap: Spacing.x12 },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    marginTop: Spacing.x32,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  footerText: { flex: 1 },
  comments: { marginTop: Spacing.x40 },
});
