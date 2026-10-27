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

/**
 * The game page's hero, pinned behind the page — the owner's brief of
 * 2026-10-27, with frames of Apple Music's artist page scrolling: "The hero
 * stays pinned behind the game page… it's the game page that moves up making
 * the hero be swallowed… It's not completely still." And: "When the game
 * title reaches the top of the screen, the blur should already be at the
 * strongest and transition into solid background color."
 *
 * So, in screen space: the art drifts up at a fifth of the page's speed
 * (`drift`; in the owner's frames a point on the art moved at about a third,
 * and their words were "mostly still"); the masthead slides over it; a
 * blurred copy fades in after a little scroll and is whole quickly
 * (`pinnedBlur`); and the art drains into the page's colour (`pinnedDrain`),
 * solid once the page is past the title and onto the developer lines, which
 * is where the top bar comes in — the owner's (2026-10-27): "it goes blurrier
 * quicker, by the time it gets past the title and onto the developer section
 * of the masthead it should already be solid", and "at the same level where
 * the top bar comes into screen". One offset runs the bar, the blur and the
 * drain: `solidAt`.
 * No zoom: "the hero never moves".
 */
export const PINNED_HERO = {
  /** How fast the art moves up the display, as a share of the page's speed. */
  drift: 0.2,
  /**
   * Where the blur begins and where it is whole, as shares of the way to
   * solid. It begins after a little scroll, where it always did — "I don't
   * want it to start sooner" — and is whole a third of a page later: "just
   * that it goes blurrier quicker" (2026-10-27).
   */
  blurFrom: 0.15,
  blurUntil: 0.45,
  /** Where the drain into the page's colour begins, as a share of the way to solid. */
  drainFrom: 0.5,
  /** The blurred copy, drawn this much past its frame so its darkened edge is never seen. */
  blurScale: 1.1,
  /** How long the art, and the page's colour, take to come in when first known. */
  arriveMs: 400,
} as const;

/*
 * `smoothstep` is first, and that is load-bearing.
 *
 * The worklets plugin rewrites each of these declarations into a **`const`**,
 * which is not hoisted, and builds every worklet's closure eagerly where the
 * worklet itself is written. So a worklet that calls another one defined
 * *later* in the file captures `undefined` and dies on the UI thread with
 * "undefined is not a function" — while Node, where a function declaration is
 * hoisted like any other, runs the same code and every test passes. That is
 * exactly what `pinnedBlur` did on the owner's phone (2026-10-27).
 *
 * So: **a worklet that calls another must come after it.** Everything here
 * calls `smoothstep` and nothing else, so `smoothstep` goes at the top and the
 * rule is kept by `scroll-motion.test.ts`, which reads this file and checks it.
 */
/** `smoothstep`: 0 before `from`, 1 after `to`, and flat at both ends between. */
export function smoothstep(from: number, to: number, value: number): number {
  'worklet';
  if (to <= from) return value < from ? 0 : 1;
  const t = Math.min(1, Math.max(0, (value - from) / (to - from)));
  return t * t * (3 - 2 * t);
}

/** How far up the display the pinned art has drifted, in dp (never past its own height). */
export function pinnedDrift(offset: number, factor: number, height: number): number {
  'worklet';
  if (offset <= 0) return 0;
  return -Math.min(offset * factor, height);
}

/**
 * The pinned art pulled past the top of the page (iOS's bounce): drawn larger
 * about its centre and moved down by half the pull, so its top stays at the
 * top of the display and its foot follows the page. Nothing at rest or
 * scrolled.
 */
export function pinnedStretch(
  offset: number,
  height: number
): { scale: number; translateY: number } {
  'worklet';
  if (offset >= 0 || height <= 0) return { scale: 1, translateY: 0 };
  return { scale: (height - offset) / height, translateY: -offset / 2 };
}

/** How much of the blurred copy shows: from `from` of the way to `solidAt`, whole at `until`. */
export function pinnedBlur(offset: number, solidAt: number, from: number, until: number): number {
  'worklet';
  return smoothstep(solidAt * from, solidAt * until, offset);
}

/** How far the art has drained into the page's colour: from `from` of the way, solid at `solidAt`. */
export function pinnedDrain(offset: number, solidAt: number, from: number): number {
  'worklet';
  return smoothstep(solidAt * from, solidAt, offset);
}

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
