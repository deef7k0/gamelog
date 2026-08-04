import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { FontFamily, Radius, Spacing, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

// ---------------------------------------------------------------------------
// Card
// ---------------------------------------------------------------------------

export type CardProps = {
  children: ReactNode;
  padded?: boolean;
  style?: ViewStyle | ViewStyle[];
};

/**
 * A block of content, separated by a rule rather than by a container.
 *
 * This used to be a filled, rounded, shadowed surface. It is now a hairline and
 * some space, and that is the point: a feed of rounded cards turns every post,
 * collection and widget into a floating object with its own edge, and twenty
 * objects stacked on a near-black page read as twenty containers rather than as
 * a list of things to read. The rule does the same job — "this ends, that
 * begins" — using one pixel instead of a shape.
 *
 * There is no `selected` tone any more. It existed to mark a block as *yours* —
 * your log on a game page — with a fill, and the fill was the problem: on a page
 * of near-black the one filled rectangle read as a notice the app was showing
 * you rather than as your own writing. What is yours is said in words and in the
 * score's colour, which is enough.
 */
export function Card({ children, padded = true, style }: CardProps) {
  const theme = useTheme();

  return (
    <View
      style={[styles.card, { borderTopColor: theme.border }, padded && styles.cardPadded, style]}>
      {children}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Chip
// ---------------------------------------------------------------------------

export type ChipProps = {
  label: string;
  /** Filled chips read as active/selected; the default is quiet metadata. */
  tone?: 'neutral' | 'primary' | 'accent';
  icon?: ReactNode;
};

/**
 * Small pill for genres, platforms and tags.
 *
 * Stays a pill while every *control* moved to `Radius.control`, and that is the
 * point: a chip is metadata, not a button, and nothing about it should invite a
 * tap. The shape is now the only thing telling them apart, so it has to keep
 * doing that job — do not round a chip like a button.
 */
export function Chip({ label, tone = 'neutral', icon }: ChipProps) {
  const theme = useTheme();

  const background = {
    neutral: theme.surfaceElevated,
    primary: theme.surfaceSelected,
    accent: theme.surfaceElevated,
  }[tone];

  const color: ThemeColor = {
    neutral: 'textSecondary' as const,
    primary: 'text' as const,
    accent: 'accent' as const,
  }[tone];

  return (
    <View style={[styles.chip, { backgroundColor: background, borderColor: theme.border }]}>
      {icon}
      <Text variant="micro" color={color} numberOfLines={1}>
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
      <Text variant="section">{title}</Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// ScoreBadge
// ---------------------------------------------------------------------------

/**
 * Community score, 0-100. Colour-coded the way review aggregators do it, so the
 * number is readable at a glance without reading the digits.
 */
export function ScoreBadge({
  score,
  size = 'medium',
}: {
  score: number;
  size?: 'small' | 'medium';
}) {
  const theme = useTheme();

  const tone = score >= 75 ? theme.success : score >= 50 ? theme.accent : theme.danger;
  const small = size === 'small';

  return (
    <View
      style={[
        styles.score,
        small && styles.scoreSmall,
        { backgroundColor: `${tone}22`, borderColor: tone },
      ]}>
      <Text
        variant={small ? 'micro' : 'caption'}
        style={{ color: tone, fontFamily: FontFamily.semibold }}>
        {Math.round(score)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

/**
 * Static placeholder block for loading states.
 *
 * Deliberately not animated: a shimmer across a whole search list costs more in
 * dropped frames than it gains in perceived speed.
 */
export function Skeleton({
  width,
  height,
  radius = Radius.small,
}: {
  width: number | `${number}%`;
  height: number;
  radius?: number;
}) {
  const theme = useTheme();
  return <View style={{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }} />;
}

const styles = StyleSheet.create({
  card: { borderTopWidth: StyleSheet.hairlineWidth },
  cardPadded: { paddingVertical: Spacing.four },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.three,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.three,
  },
  score: {
    minWidth: 34,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.small,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreSmall: { minWidth: 28, paddingVertical: 1 },
});
