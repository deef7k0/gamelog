import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ScoreSize = 'small' | 'medium' | 'large' | 'hero';

const SIZES: Record<ScoreSize, { box: number; number: number; label: number; radius: number }> = {
  small: { box: 32, number: 15, label: 0, radius: Radius.small },
  medium: { box: 44, number: 20, label: 0, radius: Radius.medium },
  large: { box: 62, number: 28, label: 11, radius: Radius.medium },
  hero: { box: 84, number: 40, label: 12, radius: Radius.large },
};

export type ScorePillProps = {
  score: number;
  size?: ScoreSize;
  /** Show the verdict word beside the number ("Excellent"). */
  showLabel?: boolean;
};

/**
 * The 0-100 score, colour-coded by verdict.
 *
 * A filled tinted block rather than an outline — at `hero` size this is meant to
 * be the loudest element on a review, per the design brief.
 */
export function ScorePill({ score, size = 'medium', showLabel = false }: ScorePillProps) {
  const theme = useTheme();
  const tint = scoreColor(score, theme);
  const dimensions = SIZES[size];
  const label = labelFor(score);

  const box = (
    <View
      style={[
        styles.box,
        {
          minWidth: dimensions.box,
          height: dimensions.box,
          borderRadius: dimensions.radius,
          backgroundColor: `${tint}22`,
          borderColor: tint,
        },
      ]}>
      <Text style={{ fontSize: dimensions.number, fontWeight: '800', color: tint }}>
        {Math.round(score)}
      </Text>
    </View>
  );

  if (!showLabel) return box;

  return (
    <View style={styles.withLabel}>
      {box}
      <View style={styles.labelBlock}>
        <Text variant="bodyStrong" style={{ color: tint }}>
          {label}
        </Text>
        <Text variant="micro" color="textMuted">
          out of 100
        </Text>
      </View>
    </View>
  );
}

/** Just the verdict word — for tight rows where the number is already shown. */
export function ScoreLabel({ score }: { score: number }) {
  const theme = useTheme();
  return (
    <Text variant="micro" style={{ color: scoreColor(score, theme), fontWeight: '700' }}>
      {labelFor(score).toUpperCase()}
    </Text>
  );
}

const styles = StyleSheet.create({
  box: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    paddingHorizontal: Spacing.two,
  },
  withLabel: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  labelBlock: { gap: 1 },
});
