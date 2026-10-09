import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { HALO_STOPS, haloRadii } from '@/constants/game-masthead';
import { Palette, withAlpha } from '@/constants/theme';

/**
 * How far along a circle's default gradient its inscribed circle lies.
 *
 * `radial-gradient(circle at center, …)` runs to the box's *corner*, so on a
 * square the middle of each side is 1/√2 of the way along it. The halo has to
 * reach nothing there, not at the corner, or the box would cut a straight edge
 * through it — so every stop is drawn at this share of where the bell puts it.
 * It is the form of gradient the copy showcase's shadow already draws natively;
 * a size keyword would say the same thing and has never been run on a phone
 * here.
 */
const INSCRIBED = Math.SQRT1_2;

/**
 * Black, thinning to nothing at the halo's rim — the bell from
 * `constants/game-masthead`, which is where its strength and its reach are
 * stated and tested. Ends on the ink at zero alpha, as every gradient here does.
 */
const HALO = `radial-gradient(circle at center, ${HALO_STOPS.map(
  (stop) => `${withAlpha(Palette.shadowInk, stop.alpha)} ${(stop.at * INSCRIBED * 100).toFixed(2)}%`
).join(', ')})`;

export type CoverHaloProps = {
  /** The cover this sits behind. */
  width: number;
  height: number;
};

/**
 * The soft round shadow behind the game page's cover.
 *
 * The owner's reference has one — a darkening round its poster that is gone
 * forty dp out, with no direction to it — and asked for it here, larger than a
 * drop shadow: "a medium sized circular soft shadow around the art". It is the
 * page going dark round the box, not the box casting; the cover keeps its own
 * small cast on top of it.
 *
 * **Place it as the first child of the row the cover is in**, with the cover in
 * the row's top end corner. It is absolutely positioned against that corner and
 * drawn first, so it lies under the cover *and* under the billing beside it:
 * inside the cover's own view it would be painted over the ends of the lines it
 * reaches. It takes no touches and no room.
 *
 * One view and a native gradient — no Skia, no image (CLAUDE.md § Gotchas). A
 * circle on a square, squeezed sideways into the cover's own proportions.
 */
export const CoverHalo = memo(function CoverHalo({ width, height }: CoverHaloProps) {
  const { rx, ry } = haloRadii(width, height);
  const side = ry * 2;

  return (
    <View
      pointerEvents="none"
      style={[
        styles.halo,
        {
          width: side,
          height: side,
          /* Centred on the cover's centre: the cover's top end corner is the
             row's, so its centre is half a cover in from each. */
          top: height / 2 - ry,
          end: width / 2 - ry,
          transform: [{ scaleX: rx / ry }],
          experimental_backgroundImage: HALO,
        },
      ]}
    />
  );
});

const styles = StyleSheet.create({
  halo: { position: 'absolute' },
});
