import Ionicons from '@expo/vector-icons/Ionicons';
import { memo, useMemo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { useSectionMetrics } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Elevation, Palette, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { mix } from '@/lib/color';

export type ReviewQuoteProps = {
  /** The words: a critic's snippet, or what a member wrote. */
  text: string;
  /**
   * Who wrote it, at the foot of the card opposite the score. Omitted where
   * the card is captioned from outside — the critics' rail names the outlet
   * under each card.
   */
  byline?: string | null;
  /**
   * Draw the writer's picture before their name: its address, or null for a
   * writer without one, who gets the initial `<Avatar>` draws. Omitted — the
   * critics' cards, the game page's rail — there is no picture at all.
   */
  avatarUrl?: string | null;
  /** 0-100, or null for a review that gave none. */
  score: number | null;
  /** Lines of the text before the clamp. */
  lines: number;
  /** Set the text in quotation marks: it is an excerpt of something published elsewhere. */
  quoted?: boolean;
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
  /** A fixed frame, for a rail. Without one the card is as tall as its text. */
  size?: { width: number; height: number };
  style?: StyleProp<ViewStyle>;
};

/**
 * One review as a card of its words: the text, and under it who wrote it and
 * what they scored it.
 *
 * ```text
 *   The morality of the show wasn't
 *   questioned until he caught someone
 *   who was rich and powerful. You see…
 *
 *   username                          84
 * ```
 *
 * This began as the critics' card on the game page — a quote and a score in
 * the corner — and at the owner's direction it is the member's review card
 * too, on that page and in the reviews sheet: the same object, with the
 * writer's name at the bottom left. A critic's card has no name inside it
 * because its rail prints the outlet underneath.
 *
 * **Text, a name and a score, and nothing else.** No platform mark, no hours,
 * no heart and no flag: those are on the review's own page, which a tap on the
 * card opens. The card is not pressable itself — the rail or the row around it
 * is, so there is one target and one spoken label. In the reviews sheet the
 * name is led by the writer's picture (`avatarUrl`), at the owner's request:
 * a list of everything written about one game is a list of people.
 *
 * The serif is here on purpose: this is review prose, the one thing Source
 * Serif 4 is for in this app, in `proseInk`. The score is in the score ramp's
 * colour, because good, mixed and bad are read before the digits are.
 */
export const ReviewQuote = memo(function ReviewQuote({
  text,
  byline = null,
  avatarUrl,
  score,
  lines,
  quoted = false,
  spoiler = false,
  fill,
  size,
  style,
}: ReviewQuoteProps) {
  const theme = useTheme();
  const accent = useAccent();
  const metrics = useSectionMetrics();
  const tone = useMemo(() => mix(accent.m3.primaryContainer, Palette.shadowInk, 0.5), [accent]);

  const rounded = score === null ? null : Math.round(score);
  const words = text.trim();

  return (
    <View
      style={[
        size,
        styles.card,
        Elevation.card,
        {
          backgroundColor: fill ?? tone,
          borderRadius: metrics.cardRadius,
          padding: metrics.cardPadding,
        },
        style,
      ]}>
      {spoiler ? (
        <View style={styles.covered}>
          {/* `danger`, as `<SpoilerNotice>` uses it: read this before you act.
              The glyph and the sentence say it too. */}
          <Ionicons name="eye-off-outline" size={18} color={theme.danger} />
          <Text variant="bodySmall" color="textSecondary" style={styles.coveredText}>
            This review contains spoilers
          </Text>
        </View>
      ) : (
        <Text variant="reviewExcerpt" color="proseInk" numberOfLines={lines} style={styles.text}>
          {quoted ? `“${words}”` : words}
        </Text>
      )}

      {(!!byline || rounded !== null) && (
        <View style={styles.foot}>
          {avatarUrl !== undefined && !!byline && (
            <Avatar uri={avatarUrl} name={byline} size={AVATAR} />
          )}
          <Text
            variant="reviewByline"
            color="textSecondary"
            numberOfLines={1}
            style={styles.byline}>
            {byline ?? ''}
          </Text>
          {rounded !== null && (
            <Text variant="h4" style={[styles.score, { color: scoreColor(rounded, theme) }]}>
              {rounded}
            </Text>
          )}
        </View>
      )}
    </View>
  );
});

/** The writer's picture beside their name: the size of the name's own line. */
const AVATAR = 20;

const styles = StyleSheet.create({
  /* The words take the room there is and the foot sits under them: the name at
     the leading edge, the score at the trailing one — the corner a price tag
     is in. */
  card: { justifyContent: 'space-between', gap: Spacing.x8 },
  text: { flexShrink: 1 },
  covered: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: Type.reviewExcerpt.lineHeight * 2,
  },
  coveredText: { flex: 1 },
  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Elastic, so a long name truncates and the score keeps its width. Present
     even when empty: it is what holds a nameless card's score at the trailing
     edge. */
  byline: { flex: 1, minWidth: 0 },
  score: { lineHeight: Type.h4.lineHeight },
});
