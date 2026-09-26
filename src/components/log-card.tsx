import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ReviewMarks, reviewMarkRow } from '@/components/review-marks';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { ScoreChip } from '@/components/ui/score-tile';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { labelFor } from '@/constants/score';
/* `STATUS_ICON` left with the status line it belonged to: the top bar's tinted
   verb is the card's only statement of state now, and it is a word. */
import { STATUS_LABEL, STATUS_VERB, statusColor } from '@/constants/status';
import { Spacing } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';

/**
 * Box art width. Its height is the 2:3 derivation, and nothing overrides it.
 *
 * 72, down from 84. The cover used to carry the score chip beneath it and had to
 * be wide enough to hold "91 EXCELLENT"; with the chip up in the masthead the
 * only thing setting this number is how much of the row the excerpt wants, and
 * the excerpt wants more. Still fixed dp — artwork does not ride the spacing
 * ladder (CLAUDE.md), so retuning `Spacing` never moves it.
 */
const BOX_ART_WIDTH = 72;

/**
 * Lifts the heart under the cover to the platform floor.
 *
 * A 15px glyph beside a 13dp count is about 17dp, against 44 (iOS) and 48
 * (Android). Slop rather than padding: padding would push the cover's column
 * taller than the artwork and put a band of dead space at the foot of the card.
 * Weighted right, where there is nothing but the card's own margin.
 */
const HEART_SLOP = { top: 12, bottom: 12, left: 8, right: 20 };

/**
 * Lines of review printed on the card. There is no more.
 *
 * **Five, and it is a wall rather than a fold.** The card used to clamp at three
 * and offer "Read more", which expanded it in place — so a feed row could double
 * its height under the thumb, and the list you were scrolling reflowed beneath
 * you. Five lines with no expander is the trade: more of the writing up front,
 * and a row whose height is the same before and after you have read it.
 *
 * A reader who wants the rest taps through to the review, which is the screen
 * that exists to be read and where the measure and the room actually are. The
 * "see all reviews" sheet sits between the two at ten.
 */
const REVIEW_LINES = 5;

/**
 * The author line is a 20dp avatar beside two lines of small type — about 32dp,
 * against a 44 (iOS) / 48 (Android) floor.
 *
 * Slop rather than padding, and weighted upward: padding would push the whole
 * text column down beside artwork that is not moving, and the space above the
 * line is the card's own padding, where nothing else is competing for a tap.
 */
const AUTHOR_SLOP = { top: 12, bottom: 4, left: 0, right: 0 };

export type LogCardProps = {
  log: LogWithRelations;
  /** Hide the author row on a profile, where every card has the same author. */
  showAuthor?: boolean;
  /** Omit to hide the like/comment row entirely (e.g. in a compact list). */
  engagement?: Engagement;
};

/**
 * A review, everywhere it appears: the feed, a profile, a game's review list,
 * the popular-reviews tab.
 *
 * ## The shape
 *
 * ```text
 *   (avatar) name reviewed          [91 EXCELL] (ps) (71h)
 *   ───────────────────────────────────────────────────────
 *   ┌──────┐  Game Title
 *   │ art  │  … five lines of the review …
 *   └──────┘
 *   ♥ 12
 * ```
 *
 * **The masthead runs the full width of the card**, and everything on it is
 * *about* the review: who wrote it, what they scored it, how they played it.
 * Under the rule is what the review *is* — the box art and the writing, side by
 * side. `<ReviewCard>` divides itself the same way on the surfaces where the
 * game is already known.
 *
 * That masthead spent a revision indented to the text column, sharing its ~200dp
 * with the byline, and the score had to be exiled to a chip under the cover to
 * fit. Full-bleed it holds all four without argument, and the rule reads as the
 * card's own division rather than one column's.
 *
 * ## The artwork never gives way
 *
 * A fixed 2:3 block, `BOX_ART_WIDTH` wide, with no `fillHeight`. An earlier card
 * stretched the poster so the two columns ended level, which was elegant and
 * capped the excerpt at about four lines — past that the cover cropped, and at
 * 200% system text it showed roughly a third of itself. The art is the primary
 * content on this screen, so it cannot be the thing that compresses; the excerpt
 * clamps instead, at `REVIEW_LINES`.
 *
 * ## Three targets, and each goes where it looks like it goes
 *
 * The card used to be one link. Tapping box art — in an app whose whole premise
 * is box art — opened an essay, and the game title, rendered in the brightest
 * ink on the row, opened the *author's profile*. Now: the artwork opens the
 * game, the headline and prose open the review, and the author line opens the
 * person, which is what its words are about.
 */
/**
 * Memoised: it is the tallest row in the app and it is always in a list.
 *
 * `log` and `engagement` come straight out of query data, so their references
 * are stable between renders until the query itself changes — which is exactly
 * the condition memo needs to be worth having.
 */
export const LogCard = memo(function LogCard({ log, showAuthor = true, engagement }: LogCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { game, profile } = log;

  /* The optimistic heart, from the shared hook rather than a second copy of the
     override rule. Only drawn when the caller supplied an `engagement`, which is
     how a compact list opts out of the control entirely. */
  const { liked, likeCount, toggle: toggleLike } = useLikeToggle('log', log.id, engagement);

  const headline = log.review_title?.trim() || null;
  const review = log.review?.trim() || null;
  const title = game?.title ?? 'Unknown game';

  /*
   * A review page is worth opening only when there is prose on it.
   *
   * A headline with no body used to route to `/review/[id]` anyway, so the card
   * showed a review headline and opened a game page — content and destination
   * contradicting each other. A titled log with no writing is still just a log:
   * it keeps its headline as a one-line verdict and points at the game.
   */
  const hasArticle = review !== null;

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };

  /*
   * "reviewed" only when there is something to read.
   *
   * `STATUS_VERB` is already the app's vocabulary for the other cases and is
   * written as sentence fragments — "is playing", "wants to play" — precisely
   * so it can be dropped into a line like this one.
   */
  const verb = hasArticle ? 'reviewed' : STATUS_VERB[log.status];

  /*
   * The verb carries the colour, not a dot or a pill.
   *
   * A feed is read as sentences — "Ada is playing Hollow Knight" — and the two
   * words that say what happened are already the ones the eye lands on. Tinting
   * them makes the column scannable by state at a glance without adding a
   * single pixel of chrome to a row. "reviewed" is not a status, so it takes
   * the house colour: it is the app's own event rather than one of the four.
   */
  const statusTint = statusColor(log.status, theme);
  const verbTint = hasArticle ? theme.primaryText : statusTint;

  /*
   * Composed, not blanket.
   *
   * A single `accessibilityLabel` on the outer pressable used to override every
   * descendant — `Pressable` defaults to `accessible`, which collapses the
   * subtree — so the score and the entire review were silent, and
   * `ScoreNumber`'s own carefully-worded label was built and then discarded.
   * This says all of it, in reading order.
   */
  const verdictLabel =
    log.rating !== null
      ? `Rated ${Math.round(log.rating)} out of 100 — ${labelFor(log.rating)}`
      : STATUS_LABEL[log.status];
  const headerLabel = [headline, verdictLabel].filter(Boolean).join('. ');

  return (
    <Card>
      {/* Three bands now — masthead, rule, content — so the card needs an
          interval between them. `<Card>` has no gap of its own; it owns the
          surface and the padding and leaves the rhythm to whatever it holds. */}
      <View style={styles.root}>
        {/*
        The masthead: everything *about* the review, on one line across the whole
        card.

        Who wrote it, what they scored it, and how they played it — avatar, name,
        chip, platform, playtime — then a rule, and under the rule the two things
        that *are* the review: the box art and the writing.

        It spent one revision as a column beside the artwork, with this row
        indented to the text column's left edge. That kept the card to a single
        left margin, which was the argument for it, and it cost the masthead a
        third of the card's width — a display name, a score chip and two marks
        competing for ~200dp, with the score eventually pushed out under the
        cover to make room. Running the row full-bleed gives all four their space
        back and puts the rule where it belongs: across the whole card, dividing
        the metadata from the content rather than dividing one column of it.

        The artwork is smaller for the same reason. It no longer has to be tall
        enough to carry a score chip beneath it, so it can be the size the
        excerpt wants it to be.
      */}
        <View style={styles.topBar}>
          {showAuthor && profile ? (
            <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${displayNameFor(profile)} ${verb} ${title}`}
                hitSlop={AUTHOR_SLOP}
                style={styles.authorRow}
                scaleTo={0.99}>
                <Avatar uri={profile.avatar_url} name={displayNameFor(profile)} size={20} />
                <Text
                  variant="bodySmall"
                  color="textMuted"
                  numberOfLines={1}
                  style={styles.sentence}>
                  <Text variant="reviewByline">{displayNameFor(profile)}</Text>
                  <Text variant="bodySmall" style={{ color: verbTint }}>{` ${verb}`}</Text>
                </Text>
              </PressableScale>
            </Link>
          ) : (
            <Text
              variant="bodySmall"
              numberOfLines={1}
              style={StyleSheet.flatten([styles.sentence, { color: verbTint }])}>
              {verb.charAt(0).toUpperCase() + verb.slice(1)}
            </Text>
          )}

          {/*
          The verdict and the marks, fixed at the right-hand end.

          `authorRow` is `flex: 1, minWidth: 0` and this block is `flexShrink: 0`,
          so a long display name truncates and the score and the two marks keep
          their width. The reverse would compress a number, which is the one
          thing on this row that cannot be read at a glance from a fragment.
        */}
          <View style={reviewMarkRow}>
            {log.rating !== null && <ScoreChip score={log.rating} narrow />}
            <ReviewMarks log={log} />
          </View>
        </View>

        {/* The rule, now across the whole card rather than across one column of
          it. A hairline, not a gap: it is what separates *who is talking* from
          *what they are talking about*. */}
        <View style={[styles.rule, { backgroundColor: theme.border }]} />

        <View style={styles.card}>
          {/*
          The left column: the artwork, and the heart directly under it.

          The heart used to be one of three glyphs in an `<EngagementBar>` across
          the foot of the card — like, comment, share, all the same weight. That
          row is right on a screen where the card is a *post*; in a feed of
          reviews it was a strip of chrome closing every row, and two of its
          three actions have better homes (the conversation is its own screen off
          the review, and sharing is a disc in the top bar there).

          Under the cover it costs no row at all: the artwork is the tallest
          thing in the card and the space beneath it was already dead. Left edge
          shared with the poster, so the column still has one margin.
        */}
          <View style={styles.artColumn}>
            {/* The artwork opens the game. In an app built on box art this is the
              one link that should never have needed arguing for. */}
            <Link href={gameHref} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`Open ${title}`}
                style={styles.art}
                scaleTo={0.97}>
                <Poster
                  coverUrl={game?.cover_url}
                  heroUrl={game?.hero_url}
                  title={game?.title}
                  width={BOX_ART_WIDTH}
                  rounded="image"
                />
              </PressableScale>
            </Link>

            {engagement && (
              <PressableScale
                accessibilityRole="button"
                accessibilityState={{ selected: liked }}
                accessibilityLabel={liked ? 'Unlike this review' : 'Like this review'}
                onPress={toggleLike}
                hitSlop={HEART_SLOP}
                scaleTo={0.92}
                style={StyleSheet.flatten(styles.heart)}>
                <Ionicons
                  name={liked ? 'heart' : 'heart-outline'}
                  size={15}
                  /* `liked`, not `danger`: a like is an endorsement, and `danger`
                   means something is about to be destroyed. See the token. */
                  color={liked ? theme.liked : theme.textMuted}
                />
                {likeCount > 0 && (
                  <Text variant="caption" color={liked ? 'text' : 'textMuted'}>
                    {likeCount}
                  </Text>
                )}
              </PressableScale>
            )}
          </View>

          <View style={styles.column}>
            <Link href={hasArticle ? reviewHref : gameHref} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={headerLabel || title}
                style={styles.verdict}
                scaleTo={0.99}>
                {/*
                The game's name, in the serif, and now the only thing above the
                writing. The split between the sans line above the rule and this
                one is what makes the card read as a review rather than a row.

                The verdict line that used to follow it — score, platform,
                playtime, trophy — is gone from here: the score is under the
                artwork and the two marks are in the top bar. What is left below
                the rule is the title and the review, which is the whole content
                of the card and the reason somebody stopped scrolling.

                The status line went with it. It existed so a log with no rating
                and no writing still had something under the title, and the top
                bar already answers that — "Deef is playing" is the status, in
                the tinted verb, in words.
              */}
                <Text variant="reviewTitleSmall" numberOfLines={2}>
                  {title}
                </Text>
              </PressableScale>
            </Link>

            {/* The excerpt, in the same column and in the review's own typeface.
              `proseInk` rather than `textSecondary`: a serif set at reading
              length wants to be quieter than the interface around it. */}
            {/*
            Five lines, and the card does not grow.

            "Read more" used to sit under this and expand the excerpt in place,
            which meant a row in a scrolling list could double its own height
            under the thumb and reflow everything below it. The card is an index
            entry; the review's own page is the thing that opens. So the clamp is
            a wall rather than a fold, and the tap that used to expand now goes
            where it always should have — through to the review.
          */}
            {review &&
              (log.spoilers ? (
                /* The notice takes the excerpt's slot rather than sitting above
                   it, so a flagged card is the same object with its content
                   covered — not a warning stacked on the thing it warns about.
                   `router.push` rather than a `<Link>`: the notice owns its own
                   button role and nesting it in a link would announce twice. */
                <SpoilerNotice onPress={() => router.push(reviewHref)} />
              ) : (
                <Link href={reviewHref} asChild>
                  <PressableScale accessibilityRole="link" style={styles.proseTap} scaleTo={0.995}>
                    <Text variant="reviewExcerpt" color="proseInk" numberOfLines={REVIEW_LINES}>
                      {review}
                    </Text>
                  </PressableScale>
                </Link>
              ))}
          </View>
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  /* Masthead, rule, content — the card's three bands and the interval between
     them. The rule is a hairline, so this gap is what actually separates the
     metadata from the review. */
  root: { gap: Spacing.x8 },
  /* The two columns under the rule. `flex-start` so the text column sizes to its
     content and the artwork's link keeps its own edges — left on the default
     `stretch`, whichever column is shorter grows an invisible tail of touch
     area. */
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  /* The cover and the heart share a left edge. `align-items: flex-start` keeps
     the heart's target the width of its own content rather than of the column.

     No `fillHeight` on the poster: the artwork's height is its own 2:3
     derivation and nothing in this row may change it. That is what makes the
     card safe at 200% system text. */
  artColumn: { width: BOX_ART_WIDTH, alignItems: 'flex-start', gap: Spacing.x8 },
  art: { width: BOX_ART_WIDTH },
  heart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /*
   * Everything that is not the cover, in one column with one left edge.
   *
   * `minWidth: 0` alongside `flex: 1`, and it is load-bearing: without it a long
   * unbroken game title measures at its natural width and pushes the column past
   * the card instead of wrapping inside it.
   */
  column: { flex: 1, minWidth: 0, gap: Spacing.x8 },

  /* The masthead, across the whole card. `minWidth: 0` on the author side is
     what lets a long name truncate instead of pushing the verdict off the card —
     without it the row measures at the name's natural width. */
  topBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  authorRow: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Takes the slack so the sentence truncates rather than pushing the avatar. */
  sentence: { flex: 1, minWidth: 0 },
  /* A hairline, drawn as a filled view rather than a border: a 1dp `borderWidth`
     rounds up to a full pixel on some densities and reads as a rule rather than
     as a seam. */
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },

  verdict: { gap: Spacing.x8 },
  proseTap: { width: '100%' },
});
