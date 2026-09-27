import type { ImageSourcePropType } from 'react-native';

/**
 * The CD that holds a physical copy — in the binder and sliding out from under
 * the case on the showcase.
 *
 * `assets/cases/game_cd.png` follows the same contract as the case templates:
 * opaque plastic (the rim, the clear hub) with the **printed label punched out
 * as transparent pixels**. The game's artwork is drawn beneath and shows through,
 * so the disc is "filled with the game's art" by layering, not by editing the
 * image. Every number below is in the PNG's own pixels, measured from the file at
 * eight angles; a component multiplies them by one scale factor and nothing about
 * the geometry lives in a call site.
 *
 * Deliberately not `DISC_TEMPLATE` in `platform-cases.ts`: that one belongs to the
 * protected case feature and its `<GameDisc>`, and this is a second, separate
 * object with its own asset.
 */
export const CD_TEMPLATE = {
  template: require('@/assets/cases/game_cd.png') as ImageSourcePropType,
  /** The PNG's real dimensions. Not square — the disc sits a little off centre. */
  width: 890,
  height: 897,
  /** The disc's centre in the PNG. */
  cx: 450.5,
  cy: 448,
  /** Outside edge of the rim — what the rendered diameter measures. */
  outerRadius: 427,
  /**
   * How far the artwork reaches. The label window ends at ~417 and the rim covers
   * 417–427, so art drawn to 421 meets the rim with no gap and never pokes past it.
   */
  artRadius: 421,
  /**
   * The clear hub and the hole inside it. The print stops at the hub on a real
   * disc and the clear plastic shows what the disc is lying on, so everything
   * inside this radius is filled with the colour behind rather than the art —
   * the PNG's translucent hub ring then reads as clear plastic, not as tinted art.
   */
  hubRadius: 156,
} as const;
