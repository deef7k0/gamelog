import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { useReducedMotion } from 'react-native-reanimated';

import { PaintFill, PaintGlyph, inkTransition } from '@/components/ui/paint-fill';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  COMPLETION_LABEL,
  PROGRESS_META,
  PROGRESS_POSTER,
  PROGRESS_ROWS,
  type ProgressChoice,
} from '@/constants/progress';
import {
  ControlHeight,
  Radius,
  Spacing,
  Type,
  ensureContrast,
  readableInk,
} from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** Past this font scale two labels no longer fit side by side. */
const ONE_COLUMN_FONT_SCALE = 1.3;

/** The outline: heavy enough to carry the colour on its own. */
const EDGE = 1.5;

/** The pill's height: a step under a button's 52. */
const PILL_HEIGHT = 40;

/* Up to Android's 48 to touch. The rows are 8 apart, so the slops above and
   below meet exactly and never overlap. */
const PILL_SLOP = { top: 4, bottom: 4 };

export type ProgressPillsProps = {
  value: ProgressChoice | null;
  onChange: (next: ProgressChoice | null) => void;
  /** For "Completed": how far past the credits. */
  level: 'story' | 'main';
  onLevelChange: (level: 'story' | 'main') => void;
};

/**
 * The log form's seven progress choices — the owner's reference (2026-10-15):
 * a pill with "the icon and the title… no description… alligned nicely".
 *
 * ## The grid
 *
 * One across, then three pairs (`PROGRESS_ROWS`): not started; in it;
 * finished; stopped. Every pair is two equal pills, so the columns line up
 * down the grid. Past a large text size it is one column instead, and a label
 * that would still not fit shrinks a little rather than wrapping.
 *
 * ## Choosing — the owner's rule, second version
 *
 * "The unselected pills should be outlined with the color they have assigned,
 * and whenever one is selected, it fills entirely" — with the paint poured
 * from its middle out to its ends (`<PaintFill>`). So every pill rests as an
 * outline in its own colour, its words in that colour too (lifted to AA on the
 * page), and the chosen one is solid with its words in whichever ink reads on
 * it. Tapping the chosen one again drains it, and the form will not save
 * without a choice.
 *
 * This replaced the first version, in which all seven were solid until one was
 * chosen, then the rest sank to a deep shade of their colour and the chosen one
 * grew by 6%. Nothing grows now; the fill is the signal.
 *
 * Colour is never the only signal: chosen is filled and unchosen is empty, every
 * pill carries its glyph and its word, and the state is spoken. The colours are
 * the poster palette (`PROGRESS_POSTER`); `poster.test.ts` holds both inks at AA.
 */
export function ProgressPills({ value, onChange, level, onLevelChange }: ProgressPillsProps) {
  const { fontScale } = useWindowDimensions();
  const oneColumn = fontScale >= ONE_COLUMN_FONT_SCALE;
  const rows = oneColumn ? PROGRESS_ROWS.flat().map((key) => [key]) : PROGRESS_ROWS;

  return (
    <View style={styles.grid} accessibilityRole="radiogroup">
      {rows.map((row) => (
        <View key={row.join('-')} style={styles.row}>
          {row.map((key) => (
            <Pill
              key={key}
              choice={key}
              chosen={value === key}
              onPress={() => onChange(value === key ? null : key)}
            />
          ))}
        </View>
      ))}

      {value === 'completed' ? <LevelChoice level={level} onChange={onLevelChange} /> : null}
    </View>
  );
}

function Pill({
  choice,
  chosen,
  onPress,
}: {
  choice: ProgressChoice;
  chosen: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const meta = PROGRESS_META[choice];
  const hue = theme[PROGRESS_POSTER[choice]];
  const ink = chosen ? readableInk(hue) : ensureContrast(hue, theme.background, 4.5);

  return (
    <PressableScale
      accessibilityRole="radio"
      accessibilityState={{ selected: chosen }}
      accessibilityLabel={meta.label}
      accessibilityHint={chosen ? 'Chosen. Tap again to clear' : meta.hint}
      onPress={onPress}
      hitSlop={PILL_SLOP}
      scaleTo={0.96}
      style={styles.slot}>
      <View style={[styles.pill, { borderColor: hue }]}>
        <PaintFill on={chosen} color={hue} />
        <PaintGlyph name={meta.icon} size={15} color={ink} />
        <Animated.Text
          style={[Type.itemTitle, styles.label, { color: ink }, inkTransition(reduceMotion)]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.85}>
          {meta.label}
        </Animated.Text>
      </View>
    </PressableScale>
  );
}

/**
 * "Completed"'s second question — the story, or the story and the rest — in
 * Completed's own blue, under the grid, and drawn the same way: an outline that
 * pours to solid when chosen. 100% is its own pill above.
 */
function LevelChoice({
  level,
  onChange,
}: {
  level: 'story' | 'main';
  onChange: (level: 'story' | 'main') => void;
}) {
  const theme = useTheme();
  const reduceMotion = useReducedMotion();
  const hue = theme[PROGRESS_POSTER.completed];
  const edge = ensureContrast(hue, theme.background, 3);

  return (
    <View style={styles.levels} accessibilityRole="radiogroup">
      {(['story', 'main'] as const).map((option) => {
        const selected = level === option;
        return (
          <PressableScale
            key={option}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            accessibilityLabel={COMPLETION_LABEL[option]}
            onPress={() => onChange(option)}
            scaleTo={0.97}
            style={styles.slot}>
            <View style={[styles.level, { borderColor: edge }]}>
              <PaintFill on={selected} color={hue} />
              <Animated.Text
                style={[
                  Type.itemTitle,
                  { color: selected ? readableInk(hue) : theme.text },
                  inkTransition(reduceMotion),
                ]}
                numberOfLines={1}>
                {COMPLETION_LABEL[option]}
              </Animated.Text>
            </View>
          </PressableScale>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { gap: Spacing.x8 },
  row: { flexDirection: 'row', gap: Spacing.x8 },
  slot: { flex: 1 },
  /* 40 high, 13 semibold — the owner asked for them smaller (2026-10-15); they
     were the 52 of a button. Touched at 48 through `PILL_SLOP`. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4 + 2,
    height: PILL_HEIGHT,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: EDGE,
    /* The paint is clipped to the pill. */
    overflow: 'hidden',
  },
  label: { flexShrink: 1 },
  levels: { flexDirection: 'row', gap: Spacing.x8, marginTop: Spacing.x4 },
  level: {
    height: ControlHeight.small + 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.x12,
    overflow: 'hidden',
  },
});
