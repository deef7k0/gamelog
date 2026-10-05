import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ReportFlag, useCanReport } from '@/components/report-flag';
import { ReviewMarks, reviewMarkRow } from '@/components/review-marks';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreChip } from '@/components/ui/score-tile';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';
import { reviewContext } from '@/lib/review-facets';

export type ReviewCardProps = {
  log: LogWithRelations;
  /** How much of the review to print before clamping. */
  lines: number;
  liked: boolean;
  likeCount: number;
  onToggleLike: () => void;
  /** Open the full review. The title and the prose are both this link. */
  onOpen: () => void;
  /**
   * The whole card is the link and the heart is the only control inside it.
   *
   * For Surprise Me, where the card sits on a screen that must not scroll and
   * every row it spends is a row the artwork does not get.
   */
  wholeCardLink?: boolean;
};

/**
 * One person's review, without the game.
 *
 * Used where **you already know what game this is**: Surprise Me, where the
 * game is the 328dp cover directly above. Printing the game's title there is
 * printing the name of the screen you are on. It was the game page's card and
 * the reviews sheet's row as well; at the owner's direction those two are
 * `<ReviewQuote>` now — the critics' card, with the words, a name and a score.
 *
 * ## The shape
 *
 * ```text
 *   (avatar) username        [91 EXCELLENT] (ps) (23h)
 *   ──────────────────────────────────────────────────
 *   … the review, clamped to `lines` …
 *   ♥ 12                          Completed · co-op  ⚑
 * ```
 *
 * Three bands, one left edge, a hairline between who is talking and what they
 * said. Everything *about* the review is on the top bar and everything *of* it is
 * under the rule, which on a card whose only content is prose leaves the prose
 * the whole of the space below.
 *
 * The same division governs the feed's `<LogCard>`, so a review looks like a
 * review wherever it appears — that card keeps the game's title under its rule,
 * because a feed is a mixture of games and here you are already on one.
 *
 * ## Why the score is a chip and not a tile
 *
 * It was a 62dp `<ScoreTile>` floated to the left of the prose, which made the
 * card a two-column layout for one piece of writing and set the row's height
 * from a number. `<ScoreChip>` is a rectangle that sits *in* a line, which is
 * what let it move up beside the username.
 */
export function ReviewCard({
  log,
  lines,
  liked,
  likeCount,
  onToggleLike,
  onOpen,
  wholeCardLink = false,
}: ReviewCardProps) {
  const theme = useTheme();

  const name = log.profile?.display_name || log.profile?.username || 'Someone';
  const headline = log.review_title?.trim() || null;
  const prose = (log.review ?? '').trim();
  const context = reviewContext(log);
  /* Words are what a report is about, and the prose is the only writing this
     card prints — a bare score has nothing in it to report. The headline is on
     the review's own page, which carries its own flag. */
  const canReport = useCanReport(log.user_id) && !!prose;

  return (
    <View style={styles.card}>
      {/*
        The whole verdict, on the top bar, with the name.

        Everything that is *about* the review rather than *of* it now lives above
        the rule: who wrote it, what they scored it, and how they played it. What
        that leaves below is one thing — the writing — which is the only reason
        this card exists on a screen where the game is already the subject.

        The name is the elastic member (`flex: 1, minWidth: 0`) and the verdict
        block is fixed (`reviewMarkRow` carries `flexShrink: 0`), so a long
        display name truncates and the score and the marks keep their width. A
        score squeezed by a username would be the one failure worth avoiding
        here, since it is the only number on the card.
      */}
      <View style={styles.who}>
        <Avatar uri={log.profile?.avatar_url} name={name} size={22} />
        <Text variant="reviewByline" numberOfLines={1} style={styles.name}>
          {name}
        </Text>

        <View style={reviewMarkRow}>
          {log.rating !== null && <ScoreChip score={log.rating} />}
          <ReviewMarks log={log} />
        </View>
      </View>

      {/* The rule under the byline. A hairline, not a gap: it separates *who is
          talking* from *what they said*, and a card this tight has no room to
          say that with space alone. Same device as the feed card. */}
      <View style={[styles.rule, { backgroundColor: theme.border }]} />

      {/*
        A flagged review replaces the body outright — it does not sit inside it.

        `<Body>` is itself a pressable when the card is not a whole-card link,
        and `<SpoilerNotice>` is one too, so nesting them would make the card two
        overlapping targets for one destination and announce it twice — the exact
        thing `<Body>`'s own docblock argues against. The notice already carries
        the button role, the label and the hint, so it stands in for the wrapper
        as well as for the prose.
      */}
      {!!prose && log.spoilers ? (
        <SpoilerNotice onPress={onOpen} minHeight={SPOILER_HEIGHT} />
      ) : (
        <Body wholeCardLink={wholeCardLink} onOpen={onOpen} name={name} headline={headline}>
          {/*
            The prose, and nothing else.

            The review's own headline used to lead this block. It has gone to the
            review's own page with the platinum trophy: on a card clamped to a
            few lines, a headline spends one of them saying what the next four
            are about, and the writing says that better. `headline` is still read
            below for the accessible label, so a screen reader is told the piece
            has a name even though the card no longer prints it.
          */}
          {!!prose && (
            <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines}>
              {prose}
            </Text>
          )}
        </Body>
      )}

      {/* The heart, on the last line. Liking is not reading, so it stays its own
          control even when the card around it is a link. Sharing lives in the
          top bar and the conversation has its own screen; the only other
          control down here is the report flag at the far end. */}
      <View style={styles.foot}>
        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ selected: liked }}
          accessibilityLabel={liked ? `Unlike ${name}’s review` : `Like ${name}’s review`}
          onPress={onToggleLike}
          hitSlop={HEART_SLOP}
          scaleTo={0.92}
          style={StyleSheet.flatten(styles.heart)}>
          <Ionicons
            name={liked ? 'heart' : 'heart-outline'}
            size={15}
            /* `liked`, not `danger`: a like is an endorsement, and `danger` means
               something is about to be destroyed. See the token. */
            color={liked ? theme.liked : theme.textMuted}
          />
          {likeCount > 0 && (
            <Text variant="caption" color={liked ? 'text' : 'textMuted'}>
              {likeCount}
            </Text>
          )}
        </PressableScale>

        {/*
          How they played it — "Completed · 4-player co-op" — in the space the
          heart leaves at the right of its own line, so the card gains the fact
          and no height. Down here rather than with the platform mark in the top
          bar, which has no room left: that bar is a fixed remainder beside a
          name, and a phrase there would truncate the name to buy it. Only what
          the reviewer said; see `reviewContext`.
        */}
        {context && (
          <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.context}>
            {context}
          </Text>
        )}

        {/* The flag ends the heart's line, as it ends the upvote's on a
            suggestion: the two things you can do *to* a review share one row,
            at opposite ends of it. Nobody's own review carries one. */}
        {canReport && (
          <View style={styles.report}>
            <ReportFlag
              target={{ kind: 'review', logId: log.id }}
              authorId={log.user_id}
              label={`Report ${name}’s review`}
            />
          </View>
        )}
      </View>
    </View>
  );
}

/**
 * Lifts the heart to the platform floor without moving the prose.
 *
 * A 15px glyph beside a 13dp line is about 17dp, against 44 (iOS) and 48
 * (Android). Slop rather than padding: padding would put a band of dead space
 * between the last line of the review and the bottom of the card.
 */
const HEART_SLOP = { top: 14, bottom: 14, left: 10, right: 14 };

/**
 * The notice's height on this card.
 *
 * Shorter than the feed's default, because this card carries no artwork setting
 * a floor beside it — the box would be the tallest thing on the row rather than
 * matching it. Roughly three lines of `reviewExcerpt`, which is the clamp the
 * game page uses.
 */
const SPOILER_HEIGHT = 76;

/**
 * The headline, the marks and the prose — a link, unless the card already is.
 *
 * Nesting a pressable inside a pressable works and makes the card two
 * overlapping targets for one destination, which a screen reader announces
 * twice. When `wholeCardLink` is set the caller owns the role and this is inert.
 */
function Body({
  wholeCardLink,
  onOpen,
  name,
  headline,
  children,
}: {
  wholeCardLink: boolean;
  onOpen: () => void;
  name: string;
  /** Spoken, not printed — the card dropped the headline; see the body block. */
  headline: string | null;
  children: React.ReactNode;
}) {
  if (wholeCardLink) {
    return (
      <View style={styles.body} importantForAccessibility="no">
        {children}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={
        headline
          ? `${name}’s review, “${headline}”. Read all of it.`
          : `${name}’s review. Read all of it.`
      }
      onPress={onOpen}
      scaleTo={0.99}
      style={StyleSheet.flatten(styles.body)}>
      {children}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.x8 },
  who: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: TapTarget / 2 },
  /* `flex: 1`, so a long name truncates rather than pushing anything. */
  name: { flex: 1 },
  /* A hairline drawn as a filled view rather than a border: a 1dp `borderWidth`
     rounds up to a full pixel on some densities and reads as a rule rather than
     as a seam. */
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  body: { gap: Spacing.x8 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* Sized to the heart and its count rather than to the line — a full-width
     target here would read as a button. */
  heart: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* Takes the rest of the line and ends on the card's edge; a long phrase
     truncates before it can push the heart. */
  context: { flex: 1, textAlign: 'right' },
  /* `auto`, so with no context line the flag still ends the row rather than
     sitting against the heart. Beside a context line it is a no-op: `flex: 1`
     has already taken the slack. */
  report: { marginLeft: 'auto' },
});
