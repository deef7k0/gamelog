/**
 * How a page that opens on artwork answers its own scroll — Apple Music's
 * artist page, in numbers: the game page, a studio and a collection.
 *
 * ## What happens, and when
 *
 * One distance runs all of it: from the top of the page to the moment the
 * hero's foot reaches the foot of the top bar, which is the moment the bar
 * comes in (`revealOffset` in `constants/top-bar`). Over that distance:
 *
 *  1. **The picture travels with the page, slower** (`parallaxShift`): it
 *     moves at 60% of the page's speed, so it falls behind and the page slides
 *     over it. Nothing is revealed at the top of the frame by this — what the
 *     lag uncovers is always above the display; `scroll-motion.test.ts` holds
 *     that for every offset.
 *  2. **The page darkens** (`darkenOpacity`), from the key colour to the same
 *     colour pulled toward black. It is the *page's* colour, everywhere at
 *     once — not a wash over the artwork — so there is no edge anywhere on
 *     the page and nothing to line up with the masthead's foot.
 *  3. **A little before the art has gone, it softens and zooms**
 *     (`blurAmount`, `zoomOf`, from `HERO_MOTION.blurFrom` to the end): a
 *     blurred copy fades in over it and the picture grows a little, so the
 *     last of the art reads as receding rather than as sliding away. A blur's
 *     radius cannot be animated cheaply — every radius is a new bitmap — so
 *     the radius is fixed and an opacity is what moves, which is the other
 *     way Apple's web player does it. Over a **trailer** — an animated
 *     banner — the same copy settles the moving picture into its own still.
 *  4. **The bar arrives over a page that is already its colour.** The
 *     darkening ends where the bar begins, so the glass comes in over the
 *     very colour it is tinted with and there is never a band where the two
 *     meet.
 *
 * Pulled past its top on iOS, the hero **stretches** (`stretchOf`): its top
 * stays at the top of the display and its foot goes down with the page.
 * Android does not report a negative offset — its own stretch does the same
 * job to the whole page — so this is iOS's alone, as it should be.
 *
 * ## Shelves
 *
 * Every shelf under the hero rises into place once it scrolls into view
 * (`SHELF_REVEAL`): a fade and a short rise, once, on an ease that lands
 * softly. A shelf already on screen when the page opens is simply there.
 *
 * Pure, with nothing imported, so `npm test` loads it. The functions run on
 * the UI thread inside worklets, and **a worklet's parameter default cannot
 * name a constant** (CLAUDE.md § Gotchas), so none of them has one.
 */

export const HERO_MOTION = {
  /**
   * How far behind the page the picture falls, as a share of the scroll: it
   * travels at 60% of the page's speed. Under 1, or the lag would uncover the
   * top of the frame on screen.
   */
  parallax: 0.4,
  /**
   * Where the softening begins, as a share of the way: moves without blur
   * for a tiny fraction (0.08) so the user sees the image clearly at start,
   * then progressively blurs in plain view.
   */
  blurFrom: 0.08,
  /**
   * Where 100% blur is reached: right before going out of bounds (0.85).
   */
  blurTo: 0.85,
  /** How much the picture grows as it softens. */
  zoom: 1.08,
  /**
   * The blurred copy is drawn this much larger than its frame, as the
   * reference's `scale(1.1)` is: a blur pulls in nothing from past an image's
   * edge, and the edge darkens; scaled past the frame, that edge is never seen.
   */
  blurScale: 1.1,
  /** How long the page takes to take its colour when the colour arrives: the reference's 0.6s. */
  groundMs: 600,
} as const;

export const SHELF_REVEAL = {
  /** How far a shelf rises as it arrives, in dp. Enough to read as arriving, not as moving. */
  rise: 16,
  /** How long it takes. */
  ms: 560,
  /**
   * The ease: fast away and a long, soft landing (`cubic-bezier(0.16, 1, 0.3,
   * 1)`), the curve the app's dropdown lands on. A shelf that decelerates
   * into place looks set down; one that eases in and out looks animated.
   */
  easing: [0.16, 1, 0.3, 1] as const,
  /** How far into the screen a shelf's top has to come before it arrives. */
  inset: 40,
  /**
   * How often a shelf still waiting checks where it is when the page has not
   * moved — content above it can grow or shrink without a scroll — in frames.
   */
  everyFrames: 12,
} as const;

/** `smoothstep`: 0 before `from`, 1 after `to`, and flat at both ends between. */
export function smoothstep(from: number, to: number, value: number): number {
  'worklet';
  if (to <= from) return value < from ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/**
 * How far through the hero's motion a page is, 0–1, at `offset` dp scrolled
 * of `distance` (the hero's foot reaching the bar's).
 */
export function heroProgress(offset: number, distance: number): number {
  'worklet';
  if (distance <= 0) return offset > 0 ? 1 : 0;
  return Math.min(1, Math.max(0, offset / distance));
}

/** How much of the blurred copy is showing over the picture. */
export function blurAmount(progress: number, from: number, to?: number): number {
  'worklet';
  const end = to === undefined ? 0.85 : to;
  return smoothstep(from, end, progress);
}

/** How much the picture has grown, 1 at rest. */
export function zoomOf(progress: number, from: number, to: number): number {
  'worklet';
  return 1 + (to - 1) * smoothstep(from, 0.85, progress);
}

/** How far the page has darkened: 0 the key colour, 1 the darker tone. */
export function darkenOpacity(progress: number): number {
  'worklet';
  return smoothstep(0, 1, progress);
}

/**
 * How far the picture lags the page, in dp — down, relative to the frame it is
 * drawn in, which is what makes it travel slower than the page.
 *
 * Nothing on an overscroll: the stretch answers that (`stretchOf`).
 */
export function parallaxShift(offset: number, factor: number, height: number): number {
  'worklet';
  if (offset <= 0) return 0;
  return Math.min(offset * factor, height);
}

/**
 * The hero pulled past the top of the page (`offset` < 0, iOS's bounce): how
 * much larger it is drawn and how far it moves, so that its top stays at the
 * top of the display and its foot goes with the page. Scaled about its
 * centre, as a transform is: `[{ translateY }, { scale }]`, in that order.
 */
export function stretchOf(offset: number, height: number): { scale: number; translateY: number } {
  'worklet';
  if (offset >= 0 || height <= 0) return { scale: 1, translateY: 0 };
  return { scale: (height - offset) / height, translateY: offset / 2 };
}

/**
 * Whether a shelf whose top is at `top` on the display (Reanimated's
 * `measure().pageY`) has come far enough into a viewport `viewport` high.
 */
export function shelfArrived(top: number, viewport: number, inset: number): boolean {
  'worklet';
  return top < viewport - inset;
}
