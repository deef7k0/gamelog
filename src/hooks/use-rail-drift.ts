import { useWindowDimensions } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

/**
 * Where one card sits in a horizontal rail, as a pure function of scroll offset.
 *
 * Every rail in this app is a run of fixed-width items separated by a fixed gap,
 * which means a card's position is arithmetic — `leading + index * pitch` — and
 * needs no measurement at all. That matters more than it sounds: the obvious
 * implementation measures each item with `onLayout` and stores the result, which
 * puts a `setState` per card on the JS thread during the exact interaction that
 * has to stay smooth. Nothing here measures anything.
 */
export type RailGeometry = {
  /** Left edge to left edge — the item's width plus the rail's gap. */
  pitch: number;
  /** Inset before the first item. `contentContainerStyle`'s leading padding. */
  leading: number;
  /** The item's own width; its centre is half of this past its left edge. */
  itemWidth: number;
};

/**
 * How far a card sits from the middle of the display, as -1 … 1.
 *
 * -1 is the left edge, 0 is dead centre, 1 is the right edge; anything further
 * out is clamped, because a card off-screen has nowhere further to go and an
 * unclamped value would keep driving the artwork past its own overscan and
 * expose the frame's fill.
 *
 * ## Why a pure function of offset, and not a spring
 *
 * The tempting version adds lag — the art trails the frame on a fling and
 * settles afterwards — and it is worse. A spring re-targeted every frame is a
 * smoothing filter with extra steps, it does not reverse exactly when you drag
 * back, and it drifts a pixel or two off its rest position at the end of a
 * gesture. `<ScrollAmbience>` already settled this argument for the game page's
 * backdrop and the reasoning is the same here: a value derived from scroll
 * offset and nothing else is frame-perfect, reverses exactly, and costs nothing
 * when the finger is still.
 *
 * ## Threading
 *
 * `scrollX` arrives as a `SharedValue` from the rail's
 * `useAnimatedScrollHandler`, and this reads it inside a worklet, so a drag
 * never crosses into JS and never re-renders a card. React sees one render per
 * card, when it mounts.
 *
 * Returns `null` when `scrollX` is null, which is how a caller switches the
 * effect off — see `<Poster parallax>`, which then renders the plain image with
 * no animated wrapper at all rather than an animated one holding still.
 */
export function useRailDrift(
  scrollX: SharedValue<number> | null,
  index: number,
  { pitch, leading, itemWidth }: RailGeometry
): SharedValue<number> | null {
  const { width: viewport } = useWindowDimensions();

  const drift = useDerivedValue(() => {
    if (!scrollX) return 0;

    const centre = leading + index * pitch + itemWidth / 2 - scrollX.get();
    const half = viewport / 2;
    return Math.max(-1, Math.min(1, (centre - half) / half));
  });

  return scrollX ? drift : null;
}
