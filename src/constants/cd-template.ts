import type { ImageSourcePropType } from 'react-native';

import type { PlatformKey } from './platform-cases';

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
export type DiscTemplate = {
  template: ImageSourcePropType;
  /** The PNG's real dimensions. */
  width: number;
  height: number;
  /** The disc's centre in the PNG. */
  cx: number;
  cy: number;
  /** Outside edge of the rim — what the rendered diameter measures. */
  outerRadius: number;
  /** How far the artwork reaches: just under the rim, never past it. */
  artRadius: number;
  /** Inside this the colour behind the disc shows, not the art: the hub and its hole. */
  hubRadius: number;
};

/** The plain disc: every platform without one of its own below. */
export const CD_TEMPLATE: DiscTemplate = {
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
};

/**
 * The consoles whose discs are their own: the owner's templates, 600×600 each,
 * with the console's printing on them — PlayStation's black hub and rim, the
 * PlayStation 2 band, the Wii's white ring, the Wii U's blue one. Same contract
 * as the plain disc: the label is see-through and the game's art shows through.
 *
 * Every figure is measured from the file — the centre from the bounding box of
 * what is drawn, the radii from where the mean opacity round the disc changes:
 *
 *  - `artRadius` stops two or three pixels inside the rim's opaque edge, so the
 *    art meets the rim and never shows past it. The Wii's rim is translucent
 *    white — clear plastic — so its art stops where that rim begins.
 *  - `hubRadius` is the outside of the clear hub ring, so the ring shows what
 *    the disc lies on. PlayStation's hub is solid black with a hole in it; its
 *    radius is the hole's, tucked under the black.
 *
 * Everything else — PS3 to PS5, Xbox, GameCube, Dreamcast — is the plain disc
 * until it has a file of its own here.
 */
const PLATFORM_DISCS: Partial<Record<PlatformKey, DiscTemplate>> = {
  ps1: {
    template: require('@/assets/cases/ps1_disc.png') as ImageSourcePropType,
    width: 600,
    height: 600,
    cx: 298.5,
    cy: 300.5,
    outerRadius: 298.5,
    artRadius: 293,
    hubRadius: 40,
  },
  ps2: {
    template: require('@/assets/cases/ps2_disc.png') as ImageSourcePropType,
    width: 600,
    height: 600,
    cx: 300,
    cy: 300,
    outerRadius: 294,
    artRadius: 291,
    hubRadius: 62,
  },
  wii: {
    template: require('@/assets/cases/wii_disc.png') as ImageSourcePropType,
    width: 600,
    height: 600,
    cx: 300,
    cy: 300,
    outerRadius: 298,
    artRadius: 291,
    hubRadius: 98,
  },
  wiiu: {
    template: require('@/assets/cases/wiiu_disc.png') as ImageSourcePropType,
    width: 600,
    height: 600,
    cx: 300,
    cy: 300.5,
    outerRadius: 294.5,
    artRadius: 281,
    hubRadius: 63,
  },
};

/** The disc a platform's copy is drawn as: its own, or the plain one. */
export function discTemplateFor(platform: PlatformKey | null | undefined): DiscTemplate {
  return (platform && PLATFORM_DISCS[platform]) || CD_TEMPLATE;
}
