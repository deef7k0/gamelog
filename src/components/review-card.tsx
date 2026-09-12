import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { ReviewMarks, reviewMarkRow } from '@/components/review-marks';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreChip } from '@/components/ui/score-tile';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';

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
 * Used on the three surfaces where **you already know what game this is**: the
 * Overview tab of that game's page, the "see all reviews" sheet opened from it,
 * and Surprise Me, where the game is the 328dp cover directly above. Printing
 * the game's title there is printing the name of the screen you are on.
 *
 * So the headline slot carries the **review's own title** instead — the thing
 * the writer actually named their piece — and a review with no headline simply
 * leads with its prose. That is the one structural difference from `<LogCard>`
 * in the feed, where the game's name is load-bearing because the feed is a
 * mixture of games.
 *
 * ## The shape
 *
 * ```text
 *   (avatar) username
 *   ─────────────────────────────
 *   Review title, bold
 *   [91 EXCELLENT]  (ps)  (23h)
 *   … the review, clamped to `lines` …
 *   ♥ 12
 * ```
 *
 * Four bands, one left edge, a hairline between who is talking and what they
 * said. Identical to the feed card's column with the artwork and the game title
 * removed, which is deliberate: a review should look like a review wherever it
 * appears, and the two used to be visibly different objects.
 *
 * ## Why the score is a chip and not a tile
 *
 * It was an 62dp `<ScoreTile>` floated to the left of the prose, which made the
 * card a two-column layout for one piece of writing and set the row's height
 * from a number. `<ScoreChip>` puts the same verdict on the metadata line where
 * the platform and the playtime already are, and gives the prose the full
 * measure — which on a card whose entire content is prose is the whole game.
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

  return (
    <View style={styles.card}>
      <View style={styles.who}>
        <Avatar uri={log.profile?.avatar_url} name={name} size={22} />
        <Text variant="reviewByline" numberOfLines={1} style={styles.name}>
          {name}
        </Text>
      </View>

      {/* The rule under the byline. A hairline, not a gap: it separates *who is
          talking* from *what they said*, and a card this tight has no room to
          say that with space alone. Same device as the feed card. */}
      <View style={[styles.rule, { backgroundColor: theme.border }]} />

      <Body wholeCardLink={wholeCardLink} onOpen={onOpen} name={name}>
        {/* The review's own headline, in the review typeface. Absent on most
            logs, and the card is fine without it — the prose starts instead. */}
        {headline && (
          <Text variant="reviewTitleSmall" numberOfLines={2}>
            {headline}
          </Text>
        )}

        {(log.rating !== null || log.played_on || log.hours_played || log.platinum) && (
          <View style={reviewMarkRow}>
            {log.rating !== null && <ScoreChip score={log.rating} />}
            <ReviewMarks log={log} />
          </View>
        )}

        {!!prose && (
          <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines}>
            {prose}
          </Text>
        )}
      </Body>

      {/* The heart, alone on the last line. Liking is not reading, so it stays
          its own control even when the card around it is a link — and it is the
          only one, because sharing lives in the top bar and the conversation has
          its own screen. */}
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
  children,
}: {
  wholeCardLink: boolean;
  onOpen: () => void;
  name: string;
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
      accessibilityLabel={`${name}’s review. Read all of it.`}
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
  /* `flex-start`, so the target is the width of the heart and its count rather
     than of the card — a full-width row here would read as a button. */
  heart: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.x4 },
});
