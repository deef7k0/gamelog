import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';

/**
 * How this game was played, as **marks** — a platform, a playtime, a trophy.
 *
 * Icons without words, which is the one place in the app that does it, and it
 * needs the argument. The house rule is that colour is never the only carrier
 * and that every status ships its word beside its hue. That rule is about
 * *state* — a thing whose meaning a reader has to be told. These three are not:
 * a platform's own brand mark is the mark that platform puts on its own boxes, a
 * clock is a clock, and a trophy beside a score is the most conventional glyph
 * in this medium.
 *
 * What buys it is the row they sit in. `<ScoreChip>` leads that row and spells
 * its verdict out in full, so the line is never a run of unglossed symbols.
 *
 * The playtime keeps its number, because the number *is* the fact; the icon is
 * only saying which number it is. Every mark carries an `accessibilityLabel`, so
 * a screen reader hears the words a sighted reader is being spared.
 *
 * Shared by the feed card and by `<ReviewCard>` — the same row on every surface
 * that shows a review, which is the point of it living here rather than inside
 * whichever one grew it first.
 */
export function ReviewMarks({ log }: { log: LogWithRelations }) {
  const theme = useTheme();

  /* `played_on` is free text seeded from the game's own platform list, so it
     may be "PlayStation 5", "PS5" or something a user typed. Matching it to a
     family gives it a mark when it is recognisable; when it is not, the written
     value is kept as a word rather than dropped — the user chose to record it. */
  const family = log.played_on ? platformFamilies([log.played_on])[0] : undefined;

  return (
    <>
      {log.played_on &&
        (family ? (
          <Ionicons
            name={family.icon}
            size={14}
            color={family.accent}
            accessibilityLabel={`Played on ${family.label}`}
          />
        ) : (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {log.played_on}
          </Text>
        ))}

      {!!log.hours_played && (
        <View style={styles.mark} accessibilityLabel={`${log.hours_played} hours played`}>
          <Ionicons name="time-outline" size={13} color={theme.textMuted} />
          <Text variant="caption" color="textMuted">
            {log.hours_played}h
          </Text>
        </View>
      )}

      {log.platinum && (
        <Ionicons name="trophy" size={13} color={theme.platinum} accessibilityLabel="Platinum" />
      )}
    </>
  );
}

/**
 * The row the marks and the score chip share.
 *
 * Exported because three surfaces build the same line and a copy of these five
 * properties in each of them is how they drift. `wrap` because a game on an
 * unrecognised platform falls back to its written name, which is a word rather
 * than a glyph and can need the second row.
 */
export const reviewMarkRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.x8,
    rowGap: Spacing.x4,
  },
}).row;

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
