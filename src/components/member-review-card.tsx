import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useSectionMetrics } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Elevation, FontFamily, Palette, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

export type MemberReviewCardProps = {
  /** Who wrote it. */
  name: string;
  /** Their picture, or null for the initial `<Avatar>` draws. */
  avatarUrl: string | null;
  /** What they wrote. */
  text: string;
  /** 0-100, or null for a review that gave none. */
  score: number | null;
  likes: number;
  comments: number;
  /** The person looking has liked it: the heart is lit. */
  likedByViewer?: boolean;
  /** Lines of the text before the clamp. */
  lines: number;
  /**
   * The writer flagged the review as spoiling something. The words are
   * withheld and the card says so; the review's own page is where they are
   * uncovered, and the card is the way there.
   */
  spoiler?: boolean;
  /**
   * The card's fill. Defaults to the section card's tone — the game's own dark
   * colour at half brightness — which is right on a game's page. The reviews
   * sheet passes the app's neutral surface instead.
   */
  fill?: string;
  style?: StyleProp<ViewStyle>;
};

/**
 * A member's review of a game, on that game's own screens: the game page's
 * Overview and every row of the reviews sheet.
 *
 * ```text
 *   ◍   Ada                         84  ◔ 12
 *       Finally a sequel that knows what
 *       the first one was about…
 *       ♥ 87 likes
 * ```
 *
 * ## The card is the one it replaced; what is in it is the reference's
 *
 * The owner's direction (2026-10-09): "keep the current card style and
 * material color, but the content inside the card should replicate the one in
 * the attached image" — a review on a film's page in Letterboxd. So the fill,
 * the corner, the inset and the shadow are `<ReviewQuote>`'s, unchanged; inside,
 * the writer's face stands at the left, and beside it their name with the
 * score and the comment count at the far end of that line, then the words,
 * then how many people liked it.
 *
 * This reverses an earlier ruling on the same card — "text, a name and a
 * score, and nothing else" — for members' reviews. `<ReviewQuote>` is still
 * the critics' card and the copy screen's, which have no face, likes or
 * replies to show.
 *
 * ## What was not carried over
 *
 * - **Stars.** A score here is 0–100; it is the number, in the score ramp's
 *   colour.
 * - **The orange heart beside the rating.** In the reference it means the
 *   writer marked the film as liked. GameLog records no such thing about a
 *   game, and giving the mark a different meaning would be a quiet lie. The
 *   heart here is on the likes line, and lights when *you* have liked the
 *   review.
 *
 * A count of nothing is not drawn: a new review is a face, a name, a score and
 * its words, not "0 likes".
 *
 * Not pressable itself — the row around it is, so there is one target and one
 * spoken label.
 */
export const MemberReviewCard = memo(function MemberReviewCard({
  name,
  avatarUrl,
  text,
  score,
  likes,
  comments,
  likedByViewer = false,
  lines,
  spoiler = false,
  fill,
  style,
}: MemberReviewCardProps) {
  const theme = useTheme();
  const accent = useAccent();
  const metrics = useSectionMetrics();
  const tone = useMemo(() => mix(accent.m3.primaryContainer, Palette.shadowInk, 0.5), [accent]);

  const rounded = score === null ? null : Math.round(score);
  const words = text.trim();

  return (
    <View
      style={[
        styles.card,
        Elevation.card,
        {
          backgroundColor: fill ?? tone,
          borderRadius: metrics.cardRadius,
          padding: metrics.cardPadding,
        },
        style,
      ]}>
      <Avatar uri={avatarUrl} name={name} size={AVATAR} />

      <View style={styles.body}>
        <View style={styles.head}>
          <Text variant="reviewByline" color="textSecondary" numberOfLines={1} style={styles.name}>
            {name}
          </Text>

          {rounded !== null && (
            <Text
              variant="reviewMeta"
              style={[styles.score, { color: scoreColor(rounded, theme) }]}>
              {rounded}
            </Text>
          )}

          {comments > 0 && (
            <View style={styles.count}>
              <Ionicons name="chatbubble" size={12} color={theme.textSecondary} />
              <Text variant="bodySmall" color="textSecondary" style={styles.figure}>
                {comments}
              </Text>
            </View>
          )}
        </View>

        {spoiler ? (
          <View style={styles.covered}>
            {/* `danger`, as `<SpoilerNotice>` uses it: read this before you act.
                The glyph and the sentence say it too. */}
            <Ionicons name="eye-off-outline" size={16} color={theme.danger} />
            <Text variant="bodySmall" color="textSecondary" style={styles.coveredText}>
              This review contains spoilers
            </Text>
          </View>
        ) : (
          <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines}>
            {words}
          </Text>
        )}

        {likes > 0 && (
          <View style={styles.likes}>
            <Ionicons
              name="heart"
              size={12}
              color={likedByViewer ? theme.liked : theme.textSecondary}
            />
            <Text variant="bodySmall" color="textSecondary" style={styles.figure}>
              {`${likes.toLocaleString()} ${likes === 1 ? 'like' : 'likes'}`}
            </Text>
          </View>
        )}
      </View>
    </View>
  );
});

/** The writer's face: the reference's 40pt on a 393pt phone, to the app's scale. */
const AVATAR = 36;

const styles = StyleSheet.create({
  /* The face at the leading edge, at the top: it heads the review, it does not
     sit beside the middle of a long one. */
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  body: { flex: 1, minWidth: 0, gap: Spacing.x4 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* Elastic, so a long name truncates and the score keeps its place at the end. */
  name: { flex: 1, minWidth: 0 },
  /* The bold family — Android synthesises no weight for a custom font. */
  score: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
  count: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  figure: { fontVariant: ['tabular-nums'] },
  covered: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: Type.reviewExcerpt.lineHeight * 2,
  },
  coveredText: { flex: 1 },
  likes: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4, paddingTop: 2 },
});
