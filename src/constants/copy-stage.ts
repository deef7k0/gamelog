import type { PlatformKey } from './platform-cases';
import { PLATFORM_MEDIUM } from './platform-media';

/**
 * The copy showcase's measurements: how large the case stands, how thick it
 * is, how big its disc is beside it, and which cases open.
 *
 * `copy/[id]` is the one screen where a case is an object with a depth and an
 * inside, turned by hand on its own stage (`<CopyShowcase>`). The protected
 * `<GameCase>` is a face and needs none of this; nothing here changes it, and
 * nothing here is read anywhere else.
 *
 * **Every proportion is a real object's.** The owner's complaint was that the
 * disc was the wrong size next to its case — it was sized from the case's
 * height and came out 0.98 of its width — so the numbers below are millimetres
 * divided by millimetres, not what looked right. Where a figure is a family's
 * rather than one console's, the table says so.
 *
 * Pure, and under `npm test`: it may not import `platform-cases.ts` for
 * anything but a type, because that file `require()`s the case artwork.
 */

// ---------------------------------------------------------------------------
// What kind of box it is
// ---------------------------------------------------------------------------

/**
 * How a case is built, which decides how thick it is and whether it opens.
 *
 *  - `keep` — the hinged plastic keep case: DVD-sized, Blu-ray-sized, and the
 *    small ones handhelds use. Opens like a book.
 *  - `jewel` — a CD jewel case. Thinner, and opens the same way.
 *  - `box` — a printed cardboard box with a cartridge in it. Twice as deep, and
 *    it does not hinge: its flap is on an end.
 *  - `clamshell` — Sega's moulded plastic cartridge case.
 */
export type CaseBuild = 'keep' | 'jewel' | 'box' | 'clamshell';

/** The consoles that are not what their medium implies. */
const BUILD: Partial<Record<PlatformKey, CaseBuild>> = {
  ps1: 'jewel',
  dreamcast: 'jewel',
  pcfx: 'jewel',
  /* A HuCard is a card, and it shipped in a jewel case. */
  pcengine: 'jewel',
  genesis: 'clamshell',
  mastersystem: 'clamshell',
  /* A Lynx card came in a cardboard box, not a keep case. */
  lynx: 'box',
};

export function caseBuildFor(platform: PlatformKey): CaseBuild {
  return BUILD[platform] ?? (PLATFORM_MEDIUM[platform] === 'cartridge' ? 'box' : 'keep');
}

/**
 * A case's depth, as a share of its face's **shorter** side.
 *
 * The shorter side, because the boxes are not one way up: a SNES box lies on
 * its side and a NES box stands, and both are an inch deep against a five-inch
 * short edge. Measured: a DVD keep case is 14mm deep and 135 wide; a jewel case
 * 10 and 125; a NES box 25 and 127; a Genesis clamshell 27 and 130.
 */
const DEPTH_SHARE: Record<CaseBuild, number> = {
  keep: 0.104,
  jewel: 0.08,
  box: 0.2,
  clamshell: 0.21,
};

/** Bare box art, for a platform with no case: a printed card, a few dp thick. */
const CARD_DEPTH = 3;

export function caseDepth(
  platform: PlatformKey,
  cased: boolean,
  width: number,
  height: number
): number {
  if (!cased) return CARD_DEPTH;
  return Math.round(DEPTH_SHARE[caseBuildFor(platform)] * Math.min(width, height));
}

/**
 * Whether this copy's case opens to a disc in a tray.
 *
 * A hinged case holding a disc, and only that. A cartridge or a game card has
 * no artwork to take out yet, so those copies turn and catch the light and
 * nothing more — the owner's decision, until each console has a cartridge of
 * its own drawn; and a cardboard box does not open like a book in any case. A
 * platform with no case has nothing to open.
 */
export function opensToDisc(platform: PlatformKey, cased: boolean): boolean {
  if (!cased || PLATFORM_MEDIUM[platform] !== 'disc') return false;
  const build = caseBuildFor(platform);
  return build === 'keep' || build === 'jewel';
}

// ---------------------------------------------------------------------------
// The disc beside its case
// ---------------------------------------------------------------------------

/**
 * A disc's diameter as a share of its case's width.
 *
 * A 12cm disc in a 135mm keep case, which is nearly every console since 2000.
 * The exceptions are the ones a collector would notice at once.
 */
const DISC_SHARE = 120 / 135;

const DISC_SHARES: Partial<Record<PlatformKey, number>> = {
  /* An 8cm disc in a full-size keep case. */
  gamecube: 80 / 135,
  /* A UMD in its shell, 64mm, in a case 104mm wide. */
  psp: 64 / 104,
  /* 12cm in a jewel case 142mm across. */
  ps1: 120 / 142,
  dreamcast: 120 / 142,
  pcfx: 120 / 142,
};

/** Never so large that it would not go back in the box. */
const DISC_FIT = 0.94;

export function discDiameter(platform: PlatformKey, width: number, height: number): number {
  const share = DISC_SHARES[platform] ?? DISC_SHARE;
  return Math.round(Math.min(share * width, DISC_FIT * Math.min(width, height)));
}

// ---------------------------------------------------------------------------
// How large it stands
// ---------------------------------------------------------------------------

/**
 * The case takes the smaller of this much of the display's width and this much
 * of its height, with no fixed ceiling.
 *
 * It was 0.72 of the width inside the page's margins, half the height, and
 * never more than 280dp: 238dp on a 360dp phone. The owner's word for that was
 * "too small"; this is 295dp on the same phone.
 */
export const CASE_WIDTH_SHARE = 0.82;
export const CASE_HEIGHT_SHARE = 0.58;

/** Under this the back of the case cannot be read, whatever the display. */
const CASE_MIN_WIDTH = 132;

/**
 * Room kept over the case, and again under it, as a share of its height.
 *
 * A turning box comes toward the camera, and its near edge is drawn taller
 * than the case stands — by a tenth, edge-on, half of it above and half below.
 * Without the room above, the corner would pass under the back key; the room
 * below is where that corner dips, and where the shadow lies.
 *
 * (The room below used to be half a ring: the copy stood on a ring of light,
 * which the owner had removed. See `<CopyStageFloor>`.)
 */
export const STAGE_HEADROOM = 0.09;

/** Under the case's shadow, before whatever comes next. */
const FLOOR_MARGIN = 14;

/**
 * How much taller than it needs to be the stage may stand, as a share of that
 * need, when the display has the height to spare.
 *
 * A keep case on a tall phone is bound by the display's width, and the stage it
 * needs is shorter than the first screen has room for. Left at that, the notes
 * field rises into the first screen and the object is no longer alone on it.
 * So the stage takes the spare height as air, half above and half below — up to
 * this much, because a low, wide box (a SNES box is half a keep case's height)
 * given all of a tall display would stand in the middle of an empty room with
 * its own name a hand's width under it.
 */
const STAGE_AIR = 0.2;

export type StageMetrics = {
  /** The case's face. */
  caseWidth: number;
  caseHeight: number;
  /** The whole stage, which every pose is drawn inside, so nothing under it moves. */
  stageHeight: number;
  /** From the top of the stage to the middle of the case — the camera's height. */
  centreY: number;
  /** From the top of the stage to the floor the case stands on. */
  floorY: number;
};

/**
 * The stage for one case shape, in the room one display has for it.
 *
 * `room` is the height the stage may take — what is left of the first screen
 * once the caption and the keys have theirs — and `heightPerWidth` is the
 * case's own shape, from its template.
 */
export function stageMetrics(
  windowWidth: number,
  windowHeight: number,
  room: number,
  heightPerWidth: number
): StageMetrics {
  /* The stage is the case with headroom over it and the same again under it:
     all of it scales with the case's width, so the room it has bounds that
     width directly. */
  const perWidth = (1 + 2 * STAGE_HEADROOM) * heightPerWidth;
  const caseWidth = Math.max(
    CASE_MIN_WIDTH,
    Math.floor(
      Math.min(
        windowWidth * CASE_WIDTH_SHARE,
        (windowHeight * CASE_HEIGHT_SHARE) / heightPerWidth,
        (room - FLOOR_MARGIN) / perWidth
      )
    )
  );
  const caseHeight = Math.round(caseWidth * heightPerWidth);
  const headroom = Math.round(caseHeight * STAGE_HEADROOM);
  const needed = headroom + caseHeight + headroom + FLOOR_MARGIN;
  const air = Math.round(Math.max(0, Math.min(room - needed, needed * STAGE_AIR)));
  const top = headroom + Math.round(air / 2);

  return {
    caseWidth,
    caseHeight,
    stageHeight: needed + air,
    centreY: top + caseHeight / 2,
    floorY: top + caseHeight,
  };
}

// ---------------------------------------------------------------------------
// The open case
// ---------------------------------------------------------------------------

/**
 * An open case is twice as wide as a shut one, and a phone is not.
 *
 * So the cover does not lie flat. It stands a little past square to the tray —
 * `OPEN_ANGLE` — coming toward the reader off the left of the display, as it
 * does in the hand of somebody looking at the disc; the whole case turns
 * `OPEN_TURN` to show the inside of that cover, steps back to `OPEN_SCALE`, and
 * moves `OPEN_SHIFT` of its width to the right to give the cover room.
 */
export const OPEN_ANGLE = 100;
export const OPEN_TURN = -12;
export const OPEN_SCALE = 0.9;
export const OPEN_SHIFT = 0.1;

/** How far in from the rim the tray sits, as a share of the case's depth. */
export const TRAY_RECESS = 0.2;

// ---------------------------------------------------------------------------
// The turn
// ---------------------------------------------------------------------------

/** A drag across the case's own width turns it this far. */
export const TURN_PER_WIDTH = 150;

/**
 * The idle drift: `DRIFT_HALF_MS` from one face to the other — a lap in about
 * twenty-four seconds — with `DRIFT_LINGER` of the pace never easing, so it
 * slows on the cover and the back and does not stop on either.
 */
export const DRIFT_HALF_MS = 12_200;
export const DRIFT_LINGER = 0.22;
/** One animation's worth: forty minutes of turning, after which it rests. */
export const DRIFT_HALVES = 200;

/** How long the copy is left alone after a touch before it drifts again. */
export const DRIFT_RESUME_MS = 6_000;
/** And after it lands, or changes what is on the stage. */
export const DRIFT_START_MS = 1_600;

/** How far the object leans with the phone, either way, in degrees. */
export const TILT_LEAN = 5;

/** How far an open case can be turned to look round its cover. */
export const PEEK_LIMIT = 22;
