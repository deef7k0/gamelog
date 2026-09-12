import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Text } from '@/components/ui/text';
import type { PlatformFamily } from '@/constants/platform-family';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * One platform family, as a mark and a word.
 *
 * ## Why the fill is grey and only the glyph carries the brand
 *
 * The obvious version of this fills each chip with the vendor's colour, and it
 * is wrong for the same reason CLAUDE.md gives for metadata chips generally: a
 * row of four saturated capsules under box art reads as confetti, and as a row
 * of buttons demanding to be pressed. These are not buttons. They answer "can I
 * play this", which is a fact about the game, not a control.
 *
 * So the container is the app's own `surfaceElevated` — the same step every
 * other passive surface uses — and the vendor's colour appears only on the
 * mark, at 13px, where it does the one job a brand colour is actually good at:
 * letting you find PlayStation in a row without reading. The word is there
 * because colour is never the only carrier, and because Nintendo has no glyph
 * in Ionicons and would otherwise be an anonymous controller.
 *
 * The price state beside these is the one thing on the row allowed a solid
 * fill — see `<PriceBadge>`. One coloured object per row, and it is the one
 * that changes.
 */
export function PlatformChip({ family }: { family: PlatformFamily }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.chip, { backgroundColor: theme.surfaceElevated }]}
      accessibilityLabel={family.label}>
      <Ionicons name={family.icon} size={13} color={family.accent} />
      <Text variant="label" color="textSecondary">
        {family.label}
      </Text>
    </View>
  );
}

/** Marks shown before a rail card starts counting instead. */
const MAX_MARKS = 3;

/**
 * The same fact as `<PlatformChip>`, at a width that fits under a cover.
 *
 * A rail card is 92–132dp wide. Three chips at their natural size are wider than
 * the artwork above them, so the rail either wraps to three lines of capsules —
 * taller than the cover it belongs to — or silently shows one platform and
 * implies the game is exclusive to it. Neither is acceptable, and "leave
 * platforms off rails" was the third option, which is what left Discover looking
 * like a different app from the search results.
 *
 * So the *word* is what gets dropped, not the platform: the marks stay, the
 * labels go, and the accessible name carries what the glyphs cannot say. Colour
 * still lives only on the mark, exactly as it does in the chip.
 *
 * Anything past `max` becomes a count rather than disappearing — a reader who
 * sees three marks under a cover should be able to tell "these three" from
 * "three of seven".
 */
export function PlatformMarks({
  families,
  max = MAX_MARKS,
}: {
  families: readonly PlatformFamily[];
  max?: number;
}) {
  if (families.length === 0) return null;

  const shown = families.slice(0, max);
  const hidden = families.length - shown.length;

  return (
    /* One label for the strip, and the glyphs opted out individually: without
       this a screen reader reads three unlabelled images and a stray number. */
    <View style={styles.marks} accessible accessibilityLabel={platformSummary(families, max)}>
      {shown.map((family) => (
        <Ionicons
          key={family.key}
          name={family.icon}
          size={13}
          color={family.accent}
          importantForAccessibility="no"
        />
      ))}

      {hidden > 0 && (
        <Text variant="label" color="textMuted" importantForAccessibility="no">
          +{hidden}
        </Text>
      )}
    </View>
  );
}

/**
 * "PlayStation, Xbox and 2 more" — what the marks would say out loud.
 *
 * Shared by the marks strip and by `<GameListItem>`'s chip row, so the spoken
 * sentence is identical whichever density the reader meets the game at.
 */
export function platformSummary(families: readonly PlatformFamily[], max: number): string {
  if (families.length === 0) return '';

  const shown = families.slice(0, max).map((family) => family.label);
  const hidden = families.length - shown.length;
  const listed = shown.join(', ');

  return hidden > 0 ? `${listed} and ${hidden} more` : listed;
}

const styles = StyleSheet.create({
  /* `Radius.control`, not `pill`. CLAUDE.md reserves the pill for things that
     are not controls, but it also reserves it for *metadata*, and these sit in
     a row beside a price badge that is genuinely a status. Matching the control
     radius keeps the two the same object family without making either a
     button — neither has an `onPress`. */
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x8,
    paddingVertical: 3,
    borderRadius: Radius.control,
  },
  /* No fill and no padding: on a rail these sit directly on the page under the
     artwork, where a capsule would be a container around two glyphs. */
  marks: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 + 1 },
});
