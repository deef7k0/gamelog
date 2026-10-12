import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSectionInset, useSectionMetrics } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Elevation, Palette, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { mix } from '@/lib/color';

export type PanelProps = {
  title: string;
  /** At the far end of the title's line: a count. */
  trailing?: ReactNode;
  /** Makes the whole card one button — a card that opens what it summarises. */
  onPress?: () => void;
  /** What the button is called. The title, when absent. */
  accessibilityLabel?: string;
  /**
   * The space outside the card, left and right. The section inset in force by
   * default; 0 where the parent already keeps one (two cards side by side).
   */
  margin?: number;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
};

/**
 * A small card that titles itself: the title inside it, a hairline, then what
 * it holds.
 *
 * ```text
 *   ╭ Ratings ──────── 128 ratings ╮
 *   │ ──────────────────────────── │
 *   │ …                            │
 *   ╰──────────────────────────────╯
 * ```
 *
 * A game's Overview has three of these — Ratings, and the two "Played by"
 * squares — from the owner's reference for it, a film's page in Letterboxd
 * (2026-10-09). The same shape as a box on the Profile tab (`<ProfileBox>`),
 * in a game page's own material: the description card's tone (the game's dark
 * colour at half brightness), its 8dp corner, its inset and the card shadow.
 *
 * ## It is not for rows of games
 *
 * For one build it was: every row of covers in the app sat in one of these,
 * heading and all, as the sections on Letterboxd's home do. The owner saw that
 * on a phone and had it undone — "remove the cards and leave the game's rails
 * on their own. They should not be inside a card." A row of games is a heading
 * on the page and its covers under it (`<HomeSection>` or `<Section>` over a
 * `<GameCoverRail>`). Do not give this a rail to hold.
 */
export function Panel({
  title,
  trailing,
  onPress,
  accessibilityLabel,
  margin,
  style,
  children,
}: PanelProps) {
  const accent = useAccent();
  const metrics = useSectionMetrics();
  const sectionInset = useSectionInset();

  const tone = useMemo(() => mix(accent.m3.primaryContainer, Palette.shadowInk, 0.5), [accent]);

  const shell = StyleSheet.flatten([
    Elevation.card,
    {
      marginHorizontal: margin ?? sectionInset,
      borderRadius: metrics.cardRadius,
      backgroundColor: tone,
      paddingHorizontal: metrics.cardPadding,
    },
    styles.shell,
    style,
  ]);

  const body = (
    <>
      <View style={styles.head}>
        <Text
          variant="h5"
          numberOfLines={1}
          accessibilityRole="header"
          /* A long title in a half-width card gives up a little size before it
             gives up its last word. */
          adjustsFontSizeToFit
          minimumFontScale={0.8}
          style={styles.title}>
          {title}
        </Text>
        {trailing}
      </View>
      <View style={[styles.rule, { backgroundColor: accent.m3.outlineVariant }]} />
      {children}
    </>
  );

  if (!onPress) return <View style={shell}>{body}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      onPress={onPress}
      scaleTo={0.98}
      style={shell}>
      {body}
    </PressableScale>
  );
}

/** Between two of these side by side, or one under another: as cards stack everywhere. */
export const PANEL_GAP = Spacing.x12;

const styles = StyleSheet.create({
  shell: { paddingTop: Spacing.x12, paddingBottom: Spacing.x16 },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, minHeight: 24 },
  /* Takes the line, so whatever follows it sits at the far end. */
  title: { flex: 1 },
  rule: { height: StyleSheet.hairlineWidth, marginTop: Spacing.x8, marginBottom: Spacing.x12 },
});
