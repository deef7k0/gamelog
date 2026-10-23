import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Lifts a one-line inline link to the platform floor without moving the text. */
export const INLINE_LINK_SLOP = { top: 14, bottom: 14, left: 8, right: 8 };

/**
 * One band failed, said where it failed, and offered the way back.
 *
 * The page used to carry a single `<ErrorState>` gated on news **and** releases
 * **and** upcoming all failing at once — so one dead band rendered a heading, a
 * "See all" chevron and nothing underneath, indistinguishable from "nothing
 * today", while a Supabase outage that killed only the reviews showed no error
 * anywhere. And when the all-three gate did fire, `ErrorState`'s `flex: 1`
 * inside a content-driven `contentContainerStyle` had no free space to resolve
 * against, so it collapsed to its own padding.
 *
 * No inset of its own: a band's stack already has the page's margin, and a
 * band of games wraps it in one.
 */
export function BandError({ label, onRetry }: { label: string; onRetry: () => void }) {
  const theme = useTheme();

  return (
    <View style={styles.bandError}>
      <Text variant="bodySmall" color="textMuted">
        {label}
      </Text>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`Retry: ${label}`}
        hitSlop={INLINE_LINK_SLOP}
        onPress={onRetry}
        scaleTo={0.96}>
        <Text variant="bodySmall" style={{ color: theme.primaryText }}>
          Try again
        </Text>
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bandError: { gap: Spacing.x4, alignItems: 'flex-start' },
});
