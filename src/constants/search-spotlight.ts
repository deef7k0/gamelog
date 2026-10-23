/**
 * The head of Search's Discover: the slider of landscape art.
 *
 * Pure — no React Native — so `npm test` covers it.
 *
 * ## The slider, measured
 *
 * The owner's reference (2026-10-09) is the hero at the top of Letterboxd's
 * home on a 393pt phone: art edge to edge at 1.48:1, a name in two bold lines
 * at its lower left with one small name under it, a badge in its upper right,
 * and along its foot four equal segments, the current one lit. Read off the
 * screenshot: the name 24pt in from the side, the badge 23 in and 17 down, the
 * segments 2pt tall and 12 apart, 9 up from the foot. The sides here are the
 * app's own margin, so the name starts where the search field does.
 *
 * ## There is no light under it
 *
 * There was, for three builds in one day: the owner asked for "a glow like the
 * one in the home page… like a neon light above a door" under the slider, saw
 * it on a phone twice — hung from the slider's top, then lying along its foot
 * — and then had it taken off: "Remove the glow from the search screen." Home
 * keeps its own (`home/home-glow`, SimpMusic's). Do not add one here.
 */

/** Past this the composition stops growing — `MaxContentWidth`, restated. */
const MAX_DISPLAY = 800;

export const SLIDE = {
  /** Width over height. The reference's 1.48, as the plain ratio it is. */
  aspect: 3 / 2,
  /** The side margin of everything set on the art: `Spacing.x16`. */
  inset: 15,
  /** The badge, from the art's top edge. */
  badgeTop: 15,
  /** The segments: their height, the space between two, and how far up from the foot. */
  segment: { height: 3, gap: 8, bottom: 12 },
  /** From the segments up to the last line of text. */
  textBottom: 14,
  /**
   * The darkening behind the text: how much of the art's height it covers from
   * the foot, how dark it gets, and how far down itself it reaches that.
   *
   * 88% black, reached seven tenths of the way down and held to the foot. Not
   * the scrim a collection's header uses, which ends on the page's own colour
   * at full strength: this art does not melt into anything, it stops at an
   * edge, and a slide whose lower third was solid black would be two thirds of
   * a picture. See `slideScrimAt` for what it has to guarantee.
   */
  scrim: 0.72,
  scrimPeak: 0.88,
  scrimFull: 0.7,
  /** Stops in the ramp: each band narrow enough not to show on dark art. */
  scrimStops: 9,
  /** How long a slide stands before the next, when the slider is moving by itself. */
  interval: 6000,
} as const;

/** The slider's height on a display this wide. */
export function slideHeight(displayWidth: number): number {
  return Math.round(Math.min(displayWidth, MAX_DISPLAY) / SLIDE.aspect);
}

/**
 * The scrim's alpha at `t` of the way down it, 0 at its top and 1 at the foot.
 *
 * A smoothstep up to `scrimFull`, then flat: no slope where it starts — a
 * darkening that began on a ramp would draw a line across the art — and full
 * strength under every line of text.
 *
 * What it guarantees, on white art — the worst there is — and on the
 * narrowest phone: 3:1 at the top of a two-line name, which is 20px bold and
 * so large text, and 4.5:1 under the small line below it. `npm test` holds
 * both. The name carries a soft shadow as well, for art that is brighter in
 * one place than this assumes.
 */
export function slideScrimAt(t: number): number {
  const u = Math.max(0, Math.min(1, t / SLIDE.scrimFull));
  return SLIDE.scrimPeak * u * u * (3 - 2 * u);
}

/** The scrim as stops: where each is, 0–1 down it, and the alpha there. */
export function slideScrimStops(): { at: number; alpha: number }[] {
  return Array.from({ length: SLIDE.scrimStops }, (_, index) => {
    const at = index / (SLIDE.scrimStops - 1);
    return { at, alpha: slideScrimAt(at) };
  });
}
