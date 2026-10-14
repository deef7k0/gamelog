import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { languageList, languageSummary } from '@/lib/language';

export type ReadingNoteProps = {
  /** The languages the list above was asked for. Never empty. */
  reading: readonly string[];
  /** What the list holds, in the plural: "reviews", "people". */
  of: string;
};

/**
 * One quiet line under a chart's heading saying which languages it is in, and
 * the way to change them.
 *
 * A list that leaves things out has to say so where it does it. Without this
 * line a chart in English and Spanish is indistinguishable from a chart of
 * everything, and somebody who also reads French has no way to find out that
 * the French reviews exist. So the line is the statement, and pressing it is
 * the control: it opens Settings, where the languages are.
 *
 * Drawn only when a filter is in force. A reader who chose every language has
 * nothing to be told, and a database that cannot filter (before 0038) is not
 * filtering.
 */
export function ReadingNote({ reading, of }: ReadingNoteProps) {
  const theme = useTheme();

  return (
    <Link href="/settings" asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`Showing ${of} in ${languageList(reading)}`}
        accessibilityHint="Opens Settings, where you choose the languages"
        hitSlop={SLOP}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.note)}>
        <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.words}>
          {`In ${languageSummary(reading)}`}
        </Text>
        <Ionicons name="chevron-forward" size={12} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

/** One line of `bodySmall`, reached at the tap floor through slop. */
const SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.bodySmall.lineHeight) / 2),
  left: Spacing.x8,
  right: Spacing.x8,
};

const styles = StyleSheet.create({
  /* As wide as its words, so the page beside it is not a target. */
  note: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: Spacing.x4 },
  /* `flexShrink` so a long list of languages gives way to the chevron. */
  words: { flexShrink: 1 },
});
