import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import { familyForStored } from '@/constants/platform-family';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';

/**
 * How this game was played, as **marks** — a platform and a playtime. Two.
 *
 * Icons without words, which is the one place in the app that does it, and it
 * needs the argument. The house rule is that colour is never the only carrier
 * and that every status ships its word beside its hue. That rule is about
 * *state* — a thing whose meaning a reader has to be told. These two are not: a
 * platform's own brand mark is the mark that platform puts on its own boxes, and
 * a clock is a clock.
 *
 * The playtime keeps its number, because the number *is* the fact; the icon is
 * only saying which number it is. Every mark carries an `accessibilityLabel`, so
 * a screen reader hears the words a sighted reader is being spared.
 *
 * ## The platinum trophy used to be here and is not any more
 *
 * Both cards that use this row now put it in the **top bar**, beside the
 * username, where the space is a fixed remainder rather than a full-width line —
 * so the row has to earn every glyph in it, and three did not fit the brief.
 * Nothing is lost: `logs.platinum` still prints on the review's own page
 * (`app/review/[id].tsx`), which is where a trophy is a claim somebody made
 * rather than a third symbol in a corner.
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
  const family = familyForStored(log.played_on);

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
          /* Bounded, because this branch prints a string the *user* typed and
             the row it sits in no longer has a full line to spread across — it
             is a fixed remainder in a top bar. Without the cap, "Nintendo
             Entertainment System" pushes the playtime out of the card. */
          <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.written}>
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
    </>
  );
}

/**
 * The row the marks sit in, at the right-hand end of a card's top bar.
 *
 * Exported because both cards build the same line and a copy of these properties
 * in each of them is how they drift.
 *
 * **`flexShrink: 0` and no wrap**, and both changed when this row moved into the
 * top bar. It used to be a full-width line under the title, where wrapping was
 * the right answer for a long written platform name. It is now the fixed end of a
 * row it shares with a username, so it has to be the thing that *keeps* its
 * width — the name shrinks and truncates instead, which is what
 * `minWidth: 0` on the name's own column buys. Let this shrink and a long display
 * name squeezes the playtime to an ellipsis, which is the one thing in here that
 * is a number.
 */
export const reviewMarkRow = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 0,
    gap: Spacing.x8,
  },
}).row;

const styles = StyleSheet.create({
  mark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* Roughly six characters of `caption`. Enough for "PS5" or "Switch" written
     out, short enough that it cannot evict the playtime beside it. */
  written: { maxWidth: 64 },
});
