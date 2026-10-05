import Ionicons from '@expo/vector-icons/Ionicons';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';

/** A glyph in the value row, drawn at the figure's height — per size. */
const ICON_SIZE = 20;
/** A drawn mark in the value row: the row's own height, so the labels stay level. */
export const MARK_SIZE = Type.h2.lineHeight;
const COMPACT_ICON_SIZE = 12;

/**
 * `regular` is the game page's and the review page's strip. `compact` is the
 * same strip on a review card, beside the score on one line: cells as wide as
 * their content (about 44dp) instead of sharing the row, and the figure and
 * label at the 10dp floor instead of 17 over 11.
 */
export type StatsStripSize = 'regular' | 'compact';

/**
 * One cell of a strip: a value over its label.
 *
 * `onPress` is what makes a cell a door, and the *label* is where that shows —
 * see the note on `styles.cell`.
 */
export type StatsCell = {
  key: string;
  /** The figure. Unused when the cell has an `icon`. */
  value: string;
  label: string;
  /** Overrides the value's ink. The game page's score cell uses it. */
  tint?: string;
  /**
   * A mark in place of the figure — the platform somebody played on, a trophy.
   * The label still says it in words; the glyph is never the only carrier.
   */
  icon?: { name: keyof typeof Ionicons.glyphMap; color: string };
  /**
   * A drawn mark in place of the figure, for one the icon set does not hold —
   * the Must Play badge. Sized by the caller to the value row (`MARK_SIZE`);
   * the label under it still says it in words.
   */
  mark?: ReactNode;
  /**
   * The answer is not known. Drawn a size down and in the quiet ink, with a
   * sentence under it instead of a unit — see `StatCell`.
   *
   * Not set on a real zero: that is a number, and it is drawn like any other.
   */
  empty?: true;
  onPress?: () => void;
  /** The whole cell as one sentence; the two lines say nothing apart. */
  a11y: string;
};

/**
 * A handful of facts as a row of numbers: the game page's masthead strip, and a
 * review's own figures under its score.
 *
 * Presentational only. What goes in the cells, and whether an unknown answer is
 * shown as "N/A" or left out, is the caller's decision — the game page keeps four
 * cells always so two games compare at a glance; a review shows only what its
 * writer recorded.
 *
 * Colours come from `useAccent()`: both screens run on a game's own colour, so
 * the rules are `outlineVariant` and the labels the tonal inks.
 */
export function StatsStrip({
  cells,
  size = 'regular',
}: {
  cells: readonly StatsCell[];
  size?: StatsStripSize;
}) {
  const accent = useAccent();
  const compact = size === 'compact';

  return (
    <View style={styles.strip}>
      {cells.map((cell, index) => (
        <View key={cell.key} style={compact ? styles.compactSlot : styles.slot}>
          {/* A rule *between* cells, not around the strip.

              The app reaches for a surface step before a border, and this is the
              one shape where that does not apply: four numbers in a row with no
              separator read as one sentence, and a filled panel behind them would
              make the masthead's quietest content its heaviest block. A divider
              between columns of a grid is the thing a rule is actually for — it
              has two edges to sit on rather than floating across artwork. */}
          {index > 0 && (
            <View
              style={[
                compact ? styles.compactDivider : styles.divider,
                { backgroundColor: accent.m3.outlineVariant },
              ]}
            />
          )}
          <StatCell cell={cell} compact={compact} />
        </View>
      ))}
    </View>
  );
}

/**
 * The strip's shape, held while its answers load.
 *
 * Not decoration — it is what stops whatever is under the strip moving. Bars in
 * the real cell's exact box model hold the space from first paint; the cells
 * fill in underneath without anything shifting.
 *
 * `accent.m3.surfaceContainerHigh` rather than `theme.skeleton`: the fixed grey
 * ladder is not used on a game's own screens, which derive their surfaces from
 * the artwork.
 */
export function StatsStripSkeleton({ count = 4 }: { count?: number }) {
  const accent = useAccent();

  return (
    <View
      style={styles.strip}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.cell}>
          <View style={[styles.ghostValue, { backgroundColor: accent.m3.surfaceContainerHigh }]} />
          <View style={[styles.ghostLabel, { backgroundColor: accent.m3.surfaceContainerHigh }]} />
        </View>
      ))}
    </View>
  );
}

/**
 * One cell, pressable or not.
 *
 * Two components rather than a conditional wrapper so the accessible role is
 * never computed: a cell either is a button or is a pair of static lines, and a
 * screen reader is told which without inspecting a prop.
 */
function StatCell({ cell, compact }: { cell: StatsCell; compact: boolean }) {
  const accent = useAccent();
  const labelColor = cell.onPress ? accent.onSurface : accent.quietInk;

  const body = (
    <>
      {/*
        The value sits in a row of fixed height, whatever size it is drawn at.

        That is what keeps every label in the strip on one line across all the
        cells: an "N/A" is drawn smaller than a number, and a mark is not text at
        all, and without the row either would be a shorter box whose label rode
        up above its neighbours'. `minHeight` rather than `height` so a number
        scaled up by the OS text setting grows the row instead of being clipped.
      */}
      <View style={compact ? styles.compactValue : styles.value}>
        {cell.mark ? (
          cell.mark
        ) : cell.icon ? (
          <Ionicons
            name={cell.icon.name}
            size={compact ? COMPACT_ICON_SIZE : ICON_SIZE}
            color={cell.icon.color}
            importantForAccessibility="no"
          />
        ) : compact ? (
          /* On a card the figure sits beside a 25dp score, so it is the strip
             at the type floor: `h6`, 10 bold, with an unknown answer in the
             quiet ink rather than a size down — there is no size down. */
          <Text
            variant="h6"
            numberOfLines={1}
            style={
              cell.empty ? { color: accent.quietInk } : cell.tint ? { color: cell.tint } : undefined
            }>
            {cell.value}
          </Text>
        ) : cell.empty ? (
          /*
           * A non-answer is quieter than an answer — `h4` in the quiet ink, where a
           * number is `h2` in full white. At the same size and weight, "N/A" was
           * the loudest thing in the strip on a game with no data, which is the
           * one game where the strip has the least to say.
           */
          <Text variant="h4" numberOfLines={1} style={{ color: accent.quietInk }}>
            {cell.value}
          </Text>
        ) : (
          /* `h2`, down from `h1`. Four 21px numbers under a 24px title made the
             strip compete with the game's own name; one step down keeps the
             numbers the loudest thing in their row and the title the loudest
             thing on the page. */
          <Text variant="h2" numberOfLines={1} style={cell.tint ? { color: cell.tint } : undefined}>
            {cell.value}
          </Text>
        )}
      </View>
      {/*
        The label is where tappability shows.

        Where some cells lead somewhere and some are facts, a row where some
        respond to a press and nothing says which is a guessing game.
        Accent-coloured type is already this app's link — "Read more", "See your
        full review", every footer on the Overview tab — so a coloured label is
        the carrier the reader has already learned, and it costs the strip no
        chevrons or chrome. `accent.onSurface` is the legible twin of the accent,
        not the fill: this is a *word*, and `accent.color` on a dark page is a
        button colour that fails AA as type.
      */}
      {compact ? (
        /* One line at the floor: a card has no room for a sentence under a
           figure, and the page the card opens has the full strip. */
        <Text variant="caption" numberOfLines={1} style={{ color: labelColor }}>
          {cell.label}
        </Text>
      ) : cell.empty ? (
        /*
         * A sentence, not a unit — so the caption step and two lines.
         *
         * These were uppercase `h6`, and at 10px bold with tracking "LENGTH
         * UNAVAILABLE" is about 117dp against the ~84dp a cell has on a 390dp
         * phone, so every one of them truncated. The type floor is 10px and this
         * stays on it, a step under the units' `bodySmall` — the right register
         * for an explanation sitting under an "N/A". Two lines because a
         * sentence wraps where a unit may not; the fixed value row above is what
         * stops the wrap from misaligning the strip.
         */
        <Text variant="caption" numberOfLines={2} style={[styles.sentence, { color: labelColor }]}>
          {cell.label}
        </Text>
      ) : (
        /* Sentence case, regular weight — the owner's reference sets a figure
           over a quiet line ("53" / "Songs played"), and bold is kept for the
           figure. These were uppercase `h6`, bold and tracked. */
        <Text variant="bodySmall" numberOfLines={1} style={{ color: labelColor }}>
          {cell.label}
        </Text>
      )}
    </>
  );

  const cellStyle = compact ? styles.compactCell : styles.cell;

  if (!cell.onPress) {
    return (
      <View style={cellStyle} accessible accessibilityLabel={cell.a11y}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={cell.a11y}
      onPress={cell.onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten(cellStyle)}>
      {body}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'stretch' },
  /* The slot holds the divider; the cell holds the content. Two views because
     the divider is positioned against the slot's full height and must not be
     scaled by the cell's press animation. */
  slot: { flex: 1, position: 'relative' },
  /* Centred across, **top-aligned** down. It was centred both ways, which held
     only while every cell was the same height — an empty cell's label may wrap
     to two lines, and centring would then lift its neighbours' values off the
     shared line. Top-aligned, the value rows line up and the labels start
     together; a two-line label simply runs further down. */
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.x4,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x4,
  },
  /* Inset top and bottom so the rule stops short of the cell's own text rather
     than running the full height — a divider that touches both edges reads as a
     table border, which would need a matching one around the strip. */
  divider: {
    position: 'absolute',
    left: 0,
    top: Spacing.x12,
    bottom: Spacing.x12,
    width: StyleSheet.hairlineWidth,
  },
  /* The value row. Its height is the number's line box, so an "N/A" drawn a
     size down, or a mark, is centred in the same space a number occupies. */
  value: { minHeight: Type.h2.lineHeight, justifyContent: 'center' },
  sentence: { textAlign: 'center' },

  /*
   * `compact`. The slot does not flex: on a card the strip shares its line with
   * the score and must be only as wide as its cells, not stretch to the edge.
   * Each cell is at least 44dp — the width the card's mock gives "PS4" and
   * "570 h" — so a short figure does not make a narrow column that sets its
   * rules unevenly. No vertical padding: the rule runs nearly the strip's full
   * height, because at this size an inset rule would be a dot.
   */
  compactSlot: { position: 'relative' },
  compactCell: {
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'flex-start',
    paddingHorizontal: Spacing.x8,
  },
  compactDivider: {
    position: 'absolute',
    left: 0,
    top: 2,
    bottom: 2,
    width: StyleSheet.hairlineWidth,
  },
  compactValue: { minHeight: Type.h6.lineHeight, justifyContent: 'center' },
  /* Exactly the two text boxes they stand in for, so nothing moves when the real
     values arrive. Read off `Type` rather than written as numbers: retuning the
     scale must move both together. */
  ghostValue: { width: 30, height: Type.h2.lineHeight, borderRadius: Radius.xs },
  ghostLabel: { width: 50, height: Type.bodySmall.lineHeight, borderRadius: Radius.xs },
});
