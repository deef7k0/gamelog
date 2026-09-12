import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { ScrollView, Share, StyleSheet, View } from 'react-native';

import { CommentSection } from '@/components/comment-section';
import { formatReleaseDate } from '@/components/game-actions';
import { ReviewMetricsBreakdown } from '@/components/review-metrics';
import { Avatar } from '@/components/ui/avatar';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreLine } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { EDITIONS, type EditionKind } from '@/constants/game-editions';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Spacing, TapTarget } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * One person's review of one game, presented as a document.
 *
 * ## Why this is not a "Now Playing" screen
 *
 * It was one. The masthead was a centred 320dp cover with the game's name under
 * it in `h1`, the reviewer's name at 12px in a bar reading "NOW VIEWING REVIEW",
 * and the article's own headline one step *below* the game's — on the one screen
 * in the app whose entire subject is a person's argument. A music player is a
 * terminal view: the artwork is the content and nothing lives under it. A review
 * is a document: the masthead is the doorway and the prose is the content. With
 * the player's shape borrowed, the body copy began 782dp down a 844dp phone.
 *
 * So the order is inverted to match what the page is actually for:
 *
 * 1. **The lockup** — the cover, and beside it every fact about the review in
 *    one column: who wrote it, what it is about, what they gave it, and how they
 *    played it.
 * 2. **The headline**, at `display` and full measure, immediately above
 * 3. **the prose**, which is the point.
 *
 * DESIGN.md § 2.1 assigns `display` to "a review's own title" and § 16 states
 * the rule directly: the top line is the review's headline, never the game's
 * name. Both are now true here.
 *
 * ## The page is a dark room, and stays one
 *
 * **No `<ScrollAmbience>` and no `<AccentProvider>`.** This is the one screen
 * about a single game that does not take that game's colour, and it is a
 * deliberate exception to the rule in CLAUDE.md rather than an oversight. A
 * review is a reading surface: the thing that should be loud on it is the
 * writing, and a lit backdrop puts a coloured field behind two thousand words of
 * body copy for no gain to the reader.
 *
 * Dropping it also gives every token back the page it was measured against.
 * `textSecondary`, `textMuted`, the score ramp and `platinum` are all tuned to
 * the near-black page; on a lit gradient the greys have no headroom (2.75:1) and the data
 * colours cannot be lifted without leaving the ramp they belong to, which is why
 * the previous version had to put them on a tinted surface to stay legible.
 * There is nothing to work around here — the background is `theme.background`,
 * which `<Screen>` already paints, so this screen passes no `backdrop` at all.
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const log = useQuery({
    queryKey: ['log', id],
    queryFn: () => getLogById(id!),
    enabled: !!id,
  });

  const engagement = useQuery({
    queryKey: ['engagement', 'log', id, viewerId],
    queryFn: () => getEngagement('log', [id!], viewerId),
    enabled: !!id,
  });

  /* The optimistic toggle lives in the hook, shared with `<EngagementBar>` and
     the collection masthead — this screen draws its own footer row but must not
     grow its own copy of the like state. `id` is a route param and defined by
     the time anything reads this; the hook is a no-op until the query lands. */
  const { liked, likeCount, commentCount, toggle } = useLikeToggle(
    'log',
    id!,
    engagement.data?.[id!]
  );

  /*
   * Every branch below carries a bar, which the previous version did not.
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

  if (log.isError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <ErrorState
          error={log.error}
          action={
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Try loading this review again"
              onPress={() => log.refetch()}
              hitSlop={Spacing.x8}>
              <Text variant="h5" color="primaryText">
                Try again
              </Text>
            </PressableScale>
          }
        />
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

  const review = log.data;
  const game = review.game;
  const author = review.profile;
  const authorName = displayNameFor(author);
  const metrics = parseReviewMetrics(review.review_metrics);
  const hasProse = !!review.review?.trim();

  /* `edition_kind` is a bare `string` on the cached row, and `editionLabel`
     indexes `EDITIONS` unguarded — an unrecognised value would throw rather
     than degrade. Narrow it here instead of casting. */
  const edition =
    game?.edition_kind && game.edition_kind in EDITIONS ? (game.edition_kind as EditionKind) : null;

  /* Steam's own capsule where the game has a listing, IGDB otherwise. The row
     stores `source` / `source_id` rather than an appid; see CLAUDE.md's ladder,
     Steam → IGDB → lettered placeholder. */
  const steamAppId = game?.source === 'steam' ? game.source_id : null;

  async function handleShare() {
    try {
      const shareText = review.review_title
        ? `${review.review_title} — ${game?.title ?? ''} review by ${authorName} on GameLog`
        : `${game?.title ?? 'Game'}: ${review.rating ?? ''}/100 review by ${authorName} on GameLog`;
      await Share.share({ message: shareText });
    } catch {
      // Dismissed
    }
  }

  return (
    <Screen
      edges={['bottom']}
      insetHeader
      /*
       * Two discs of glass over the page, and nothing else. The bar that used to
       * name the writer is gone app-wide; the byline in the lockup below is
       * where that fact lives now, and it is 26dp of avatar rather than 12px of
       * type in a strip.
       */
      topBar={
        <FrostedTopBar
          back
          right={<TopBarDisc icon="share-outline" label="Share review" onPress={handleShare} />}
        />
      }>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator>
        {/*
          The lockup: the cover, and beside it everything there is to say about
          the review before you start reading it.

          A two-column header, not a stack — the poster is a *plate* beside the
          standfirst, which is how a magazine sets an opening. Everything in the
          right column is ranged left off one edge: byline, then the title with
          its year, then the score, then the playthrough as a tight block of
          lines. The prose starts below both columns at the page's full measure.
        */}
        <View style={styles.lockup}>
          <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`Open ${game?.title ?? 'this game'}`}
              scaleTo={0.97}>
              <Poster
                coverUrl={game?.cover_url}
                heroUrl={game?.hero_url}
                title={game?.title}
                width={MASTHEAD_POSTER}
                steamAppId={steamAppId}
                edition={edition}
                elevated
              />
            </PressableScale>
          </Link>

          <View style={styles.lockupColumn}>
            {/* "Review by <name>" — the words are the label, the name is the
                emphasis. Sans, because it is a fact *about* the piece rather
                than part of it. */}
            {author && (
              <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel={`${authorName}'s profile`}
                  scaleTo={0.97}
                  style={StyleSheet.flatten(styles.byline)}>
                  <Avatar uri={author.avatar_url} name={authorName} size={18} />
                  <Text
                    variant="bodySmall"
                    color="textMuted"
                    numberOfLines={1}
                    style={styles.bylineName}>
                    {'Review by '}
                    <Text variant="reviewByline">{authorName}</Text>
                  </Text>
                </PressableScale>
              </Link>
            )}

            {/*
              The title and the year as **one text**, not two views.

              The year has to sit on the title's last line rather than under it —
              it is a qualifier on the name, the way a magazine sets a film's
              year, and a separate block would put it on a line of its own and
              make it a second fact. One `<Text>` with a nested span is the only
              construction that gets a sans-serif year to flow after a serif
              title whose wrap point is not knowable in advance.
            */}
            <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Open ${game?.title ?? 'this game'}`}
                scaleTo={0.98}>
                <Text variant="reviewTitle" numberOfLines={3}>
                  {game?.title ?? 'Unknown game'}
                  {!!game?.release_year && (
                    <Text variant="reviewYear" color="textMuted">{`  ${game.release_year}`}</Text>
                  )}
                </Text>
              </PressableScale>
            </Link>

            {/* A bare coloured numeral and its verdict word — "78 GOOD". Never a
                capsule here: DESIGN.md § 15, and `<ScoreLine>` is where that
                lives. It also carries the composed label a screen reader needs,
                which three sibling `<Text>` nodes did not. */}
            {review.rating !== null && <ScoreLine score={review.rating} />}

            {/*
              The playthrough, as a compact block of lines.

              Four facts, no icons, no gaps between them beyond the leading —
              this reads as a standfirst rather than as four metadata rows, which
              is the difference between a magazine and a settings screen. They
              are `reviewMeta`: semibold sans at 12, near-white, tight.

              Every one of these was already on the log and the date is the one
              that used to vanish entirely — it was nested inside
              `rating !== null`, so a review written without a score, which the
              API explicitly supports, rendered undated.

              Platinum keeps its word. It was an unlabelled trophy glyph with no
              role and no label, silent to a screen reader and carried by hue
              alone against the house rule that colour is never the only carrier.
            */}
            <View style={styles.meta}>
              {!!review.played_on && <Text variant="reviewMeta">Played on {review.played_on}</Text>}

              {review.hours_played != null && (
                <Text variant="reviewMeta">{review.hours_played} hours logged</Text>
              )}

              {review.completion_percent != null && (
                <Text variant="reviewMeta">{review.completion_percent}% complete</Text>
              )}

              {review.platinum && (
                <Text variant="reviewMeta" style={{ color: theme.platinum }}>
                  Platinum
                </Text>
              )}

              <Text variant="reviewMeta" color="textMuted">
                Reviewed {formatReleaseDate(review.created_at)}
              </Text>
            </View>
          </View>
        </View>

        {/* The scorecard, when the reviewer scored by category. Full width
            rather than in the column: fourteen labelled bars cannot live in
            200dp beside a poster. */}
        {metrics && (
          <View style={styles.metrics}>
            <ReviewMetricsBreakdown metrics={metrics} />
          </View>
        )}

        {/*
          The article — full measure, under both columns, and nothing else in it.
          No pull quote, no related rail, no sidebar.

          `reviewProse` is the serif at 16/26 and `proseInk` is a cool muted grey
          rather than a bright white. Both are the same decision: a thousand words
          set at interface brightness in an interface typeface is a wall, and this
          is the one block in the app somebody actually reads.
        */}
        <View style={styles.article}>
          {!!review.review_title && (
            <Text variant="reviewTitle" accessibilityRole="header">
              {review.review_title}
            </Text>
          )}

          {hasProse ? (
            <Text variant="reviewProse" color="proseInk">
              {review.review}
            </Text>
          ) : (
            <Text variant="reviewProse" color="textMuted">
              {authorName} scored this game without writing it up.
            </Text>
          )}
        </View>

        {/*
          The interaction row, at the end of the piece.

          Not `<EngagementBar>`, and this is the one screen that does not use it.
          That component is a row of three equal glyphs — like, comment, share —
          which is right on a card in a feed, where the card is one item among
          many and every action is the same weight. At the foot of an article the
          weights are not equal: the like is a response to what you have just
          read, and it gets the words ("Liked", then the count). The conversation
          is a *place*, so it sits at the far end as a mark. Share is already a
          disc in the top bar, where it is on every other screen.
        */}
        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ selected: liked }}
            accessibilityLabel={liked ? 'Unlike this review' : 'Like this review'}
            onPress={toggle}
            hitSlop={FOOTER_SLOP}
            style={StyleSheet.flatten(styles.likeRow)}
            scaleTo={0.96}>
            <Ionicons
              name={liked ? 'heart' : 'heart-outline'}
              size={17}
              /* `liked`, not `danger`. A like is an endorsement; `danger` means
                 something is about to be destroyed. See the token. */
              color={liked ? theme.liked : theme.textMuted}
            />
            <Text variant="reviewByline">{liked ? 'Liked' : 'Like'}</Text>
            {likeCount > 0 && (
              <Text variant="bodySmall" color="textMuted">
                {likeCount} {likeCount === 1 ? 'like' : 'likes'}
              </Text>
            )}
          </PressableScale>

          <Link
            href={{ pathname: '/comments/[type]/[id]', params: { type: 'log', id: review.id } }}
            asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={
                commentCount > 0
                  ? `${commentCount} comments. Open the conversation.`
                  : 'Open the conversation'
              }
              hitSlop={FOOTER_SLOP}
              style={StyleSheet.flatten(styles.commentMark)}
              scaleTo={0.96}>
              {commentCount > 0 && (
                <Text variant="bodySmall" color="textMuted">
                  {commentCount}
                </Text>
              )}
              <Ionicons name="chatbubble-outline" size={15} color={theme.textMuted} />
            </PressableScale>
          </Link>
        </View>

        {/* The conversation, under the piece it is about. Below the interaction
            row rather than above it: the row is the end of the article, and the
            comments are a second document that starts after it. */}
        <View style={styles.comments}>
          <CommentSection targetType="log" targetId={review.id} />
        </View>
      </ScrollView>
    </Screen>
  );
}

/**
 * The masthead poster, in fixed dp.
 *
 * Artwork does not ride the `Spacing` ladder — retuning the chrome must move the
 * interface and leave the art where it is. The number is chosen against the
 * reading measure rather than against the artwork: at true 2:3 a 100dp cover
 * stands 150dp, and the ~236dp of column left beside it on a 390dp phone takes
 * the byline, a three-line title and the meta lines under the score without any
 * of them wrapping awkwardly.
 *
 * Down from 132, then from 116. At 132 the cover was the tallest thing in the
 * lockup by a clear margin and the text column ended well above it, so the
 * masthead read as a piece of box art with some text next to it rather than as a
 * review of something. 100 is the width at which the two columns finish within
 * about a line of each other and read as one block — which is the whole job of a
 * masthead lockup.
 *
 * It is deliberately the *shorter* of the two now: the column wins, the poster
 * ends partway down it, and both are top-aligned so the byline and the cover's
 * top edge share a line.
 */
const MASTHEAD_POSTER = 108;

/**
 * Lifts the two footer marks to the platform floor.
 *
 * The like row is a 17px glyph beside a 18dp line — about 20dp against 44 (iOS)
 * and 48 (Android), and the comment mark is smaller still. Slop rather than
 * padding: padding would put a band of dead space between the last line of the
 * article and its rule, which is the one interval on this page that is doing
 * editorial work.
 */
const FOOTER_SLOP = { top: 14, bottom: 14, left: 10, right: 10 };

const styles = StyleSheet.create({
  /* Small margins. The brief asks for a dense editorial page rather than a
     mobile-app one, and the difference is mostly here: `x20` (16) against the
     `x24` (18) this had, so the prose runs closer to the display's edges and
     reads as a column of type rather than as a card with text in it. */
  scrollContent: {
    paddingHorizontal: Spacing.x20,
    paddingTop: Spacing.x12,
    paddingBottom: Spacing.x48,
  },

  /* ~10dp between the plate and the standfirst, per the reference. Tighter than
     the app's usual `x20`, because these two are one object. */
  lockup: { flexDirection: 'row', gap: Spacing.x12 },
  /* `flex-start`, not centred: this column runs past the bottom of the poster on
     most reviews, and centring a taller child against a shorter sibling pushes
     the byline above the top of the artwork. */
  lockupColumn: { flex: 1, gap: Spacing.x8 },
  /* `TapTarget` tall, so the row clears the platform floor without the 18dp
     avatar having to grow to meet it. */
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: TapTarget },
  bylineName: { flexShrink: 1 },
  /*
   * **No gap.** The four playthrough lines are a block, not a list — the leading
   * inside `reviewMeta` (17 on 12) is the only interval between them, which is
   * what makes them read as a standfirst rather than as four metadata rows with
   * air between each.
   */
  meta: {},

  metrics: { marginTop: Spacing.x20 },
  /* ~12dp from the bottom of the header to the first line of prose, per the
     reference. The article is the point of the page; it should not be announced
     by a hand's width of empty space. */
  article: { marginTop: Spacing.x16, gap: Spacing.x12 },

  /* The like on the left, the conversation at the far end. `space-between` is
     the composition: the row has two ends and nothing in the middle. */
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: Spacing.x32,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  likeRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  commentMark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  comments: { marginTop: Spacing.x40 },
});
