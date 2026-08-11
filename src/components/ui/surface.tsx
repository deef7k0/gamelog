import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type CardProps = {
  children: ReactNode;
  /**
   * `elevated` puts the card on `surfaceElevated` instead of `surface` — for a
   * card that sits *on* another card, where the same fill would disappear.
   */
  elevated?: boolean;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

/**
 * A modular block of content: filled, rounded, no border.
 *
 * Lifted by a surface step *and* a shadow. The step does most of the work —
 * `surface` (#1C1C1C) against `background` (#121212) is one clear boundary — and
 * `Elevation.card` is what turns that from a painted rectangle into a block
 * resting above the page. A border on top of both would be a third signal for a
 * job already done twice.
 *
 * 6px corners and 16px of padding, both fixed. A card that needs different
 * numbers is a different component.
 */
export function Card({ children, elevated = false, padded = true, style }: CardProps) {
  const theme = useTheme();

  /*
   * Two views on purpose. Android's `elevation` is clipped by `overflow:
   * 'hidden'`, and the card needs that clip to round whatever it contains — so
   * the outer view owns the fill and the shadow, and the inner one does the
   * clipping. Collapsing these back into one view silently drops the shadow on
   * Android only. See DESIGN.md § 6.3.
   */
  return (
    <View
      style={[
        styles.card,
        Elevation.card,
        { backgroundColor: elevated ? theme.surfaceElevated : theme.surface },
        style,
      ]}>
      <View style={[styles.cardClip, padded && styles.cardPadded]}>{children}</View>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export type ChipProps = {
  label: string;
  /**
   * `active` fills with a wash of the accent and takes the accent's text — for
   * a chip that is *on*, not for one that merely matters.
   */
  tone?: 'neutral' | 'active';
  /** Leading glyph, usually an icon or an emoji. */
  icon?: ReactNode;
};

/**
 * The metadata capsule: `📅 Played`, `⏱ 45h`, `🏁 Completed`.
 *
 * Chips are how this app stays information-dense without shrinking anything —
 * six facts in two rows of capsules are scannable in a way that six lines of
 * small grey text are not. 34px tall with 14px of horizontal padding, fully
 * rounded, on `surfaceSelected`.
 *
 * They are not buttons. Nothing here has a press state unless a caller wraps it
 * in one, and the fully-round shape is what says so — every actual control in
 * the app is a 6px rounded rectangle.
 *
 * A chip carries `Elevation.control` even though it is not pressable: it is a
 * discrete object sitting on whatever is behind it, and a flat capsule on a
 * lifted card reads as a hole rather than a tag.
 */
export function Chip({ label, tone = 'neutral', icon }: ChipProps) {
  const theme = useTheme();
  const active = tone === 'active';

  return (
    <View
      style={[
        styles.chip,
        Elevation.control,
        { backgroundColor: active ? theme.primaryMuted : theme.surfaceSelected },
      ]}>
      {icon}
      <Text variant="bodySmall" color={active ? 'primary' : 'textSecondary'} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// SectionHeader
// ---------------------------------------------------------------------------

export type SectionHeaderProps = {
  title: string;
  /** Right-aligned affordance, typically a "See all" link. */
  action?: ReactNode;
};

export function SectionHeader({ title, action }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <Text variant="h4">{title}</Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScoreBadge
// ---------------------------------------------------------------------------

/**
 * Community score, 0-100, as a bare coloured numeral.
 *
 * No box. The verdict colour and the digits carry it, and wrapping two
 * characters in an outlined capsule made a number look like a control you could
 * press. See `ScoreNumber` in `ui/score` — this is the same idea sized for a
 * metadata row.
 */
export function ScoreBadge({
  score,
  size = 'medium',
}: {
  score: number;
  size?: 'small' | 'medium';
}) {
  const theme = useTheme();
  const tone = score >= 70 ? theme.scoreHigh : score >= 45 ? theme.scoreMid : theme.scoreLow;

  return (
    <Text variant={size === 'small' ? 'bodySmall' : 'h5'} style={{ color: tone }}>
      {Math.round(score)}
    </Text>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Static placeholder block for loading states.
 *
 * Deliberately not animated: a shimmer across a whole search list costs more in
 * dropped frames than it gains in perceived speed. Skeletons everywhere, though
 * — a spinner tells you to wait, a skeleton tells you what is coming.
 */
export function Skeleton({
  width,
  height,
  radius = Radius.image,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const theme = useTheme();
  return <View style={{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }} />;
}

const styles = StyleSheet.create({
  /* Fill + shadow only — the clip lives on `cardClip` so Android's elevation
     is not cut off. */
  card: { borderRadius: Radius.card },
  cardClip: { borderRadius: Radius.card, overflow: 'hidden' },
  cardPadded: { padding: Spacing.x16 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    height: 34,
    paddingHorizontal: Spacing.x12 + 2,
    borderRadius: Radius.pill,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
});

export type { ThemeColor };
