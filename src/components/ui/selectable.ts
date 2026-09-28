import type { ThemeColor } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';

/** Everything a pressable, selectable control needs for one of its two states. */
export type SelectableLook = {
  /** Fill and 1px edge. Spread into the control's style. */
  style: { backgroundColor: string; borderColor: string };
  /** The fill while held — for `PressableScale`'s `pressedColor`. */
  pressedColor: string;
  /** The keyboard focus ring — for `PressableScale`'s `focusRing`. */
  focusRing: string;
  /** The label's token: full strength when selected, a step down when not. */
  label: ThemeColor;
};

/**
 * The app's one selected state, for controls that draw their own shape.
 *
 * `<SortBar>`, `<ChoiceChips>` and `<SelectField>`'s rows use it, and so does
 * every screen-local toggle, segment and choice row — which is the point: a
 * selected control looks the same wherever it is, and changing what "selected"
 * means is an edit here rather than in thirty files.
 *
 * **Selected** is an accent wash inside, the accent's edge around, and the
 * label at full strength. **Resting** is the control surface with the subtle
 * edge and the label a step down. Three carriers, only one of them a hue — the
 * wash is lighter than the resting fill and the edge is brighter than the
 * resting edge, so the difference survives colour blindness and greyscale.
 *
 * The accent is whichever is in force (`useAccent()`): the house blue on the
 * house screens, the game's own colour on its screens.
 */
export function useSelectable(): (selected: boolean) => SelectableLook {
  const theme = useTheme();
  const accent = useAccent();

  return (selected) =>
    selected
      ? {
          style: { backgroundColor: accent.wash, borderColor: accent.edge },
          pressedColor: accent.ring,
          focusRing: accent.ring,
          label: 'text',
        }
      : {
          style: { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          pressedColor: theme.surfaceSelected,
          focusRing: accent.ring,
          label: 'textSecondary',
        };
}
