/**
 * The game page's actions, docked at the foot of the screen as SimpMusic's
 * folding navigation bar — its sizes, its two layouts and the morph between
 * them.
 *
 * ```text
 *   expanded                               contracted
 *   ( ✎  Write a review               )
 *   ( (★)(🔖)(＋)(▤)                   )    ( (★)(🔖)(＋)(▤)       ) (✎)
 *
 *   expanded, music playing                contracted, music playing
 *   ( ▣ Track · uploader       ▶  ✕ )
 *   ( (★)(🔖)(＋)(▤)       ) (✎)            (…) ( ▣ Track · upl… ▶ ✕ ) (✎)
 * ```
 *
 * The owner's direction (2026-10-14): "look at how simpmusic does their
 * animation and contraction + expansion for the navigation bar in the home
 * page… mimic that same style, layout and animations". Read from its source,
 * the flat (liquid glass off) build of `LiquidGlassAppBottomNavigationBar.android.kt`
 * and `AppBottomNavigationBar.kt` (`FlatTabBar`, `FlatSearchButton`,
 * `unfoldingTabs`, `foldedCircle`), on the `dev` branch:
 *
 * - **Separate floating bars, never a panel.** A capsule of keys at the foot
 *   and a bar over it, each its own object on the page.
 * - **Two layouts and a 300ms morph between them.** The reference hands two
 *   `ConstraintSet`s to a `ConstraintLayout` with `animateChangesSpec =
 *   tween(300)`: every child's frame is interpolated from one to the other.
 *   `dockFrames` is those two sets and `lerpFrame` the interpolation.
 * - **Expanded, the review button is the bar on its own** in the slot the
 *   reference's mini player has over its capsule, and the capsule of keys runs
 *   the full width under it. **Contracted, the capsule makes room and the
 *   review button is a circle at its end** — the reference's 56dp search
 *   button, 12 from the capsule.
 * - **With music playing it is the reference exactly.** The mini player takes
 *   the slot over the capsule and the review button stays a circle in the row;
 *   contracted, the capsule folds into its 48dp circle at the start and the
 *   mini player sits inline after it, as the reference's does.
 * - **An unreleased game has no review button.** Expanded it is the capsule
 *   alone; contracted, the capsule folds into its circle — the reference's bar
 *   with nothing beside it.
 *
 * Whether it is expanded is Home's rule, which is the reference's
 * (`isScrollingUp`, `HomeScreen.kt`): open near the top, then folded by real
 * travel downward and opened again by real travel upward.
 *
 * Pure: no React, no React Native. The functions marked as worklets run on the
 * UI thread, and **none has a parameter default** (CLAUDE.md § Gotchas).
 */

import { HOME_BAR } from './top-bar';

export const DOCK = {
  /** The row's edge padding: `BarEdgePadding`, and the tab bar's 16. */
  side: 16,
  /** Over the system's navigation inset: the reference's `padding(bottom = 8.dp)`. */
  bottom: 8,
  /** A wide display never stretches the bars past this: the mini player's limit. */
  maxWidth: 520,
  /*
   * The sizes are the reference's, each taken down a step at the owner's
   * direction (2026-10-14: "make the bars smaller") — its proportions kept: the
   * round button and the bar over the capsule a step under it, the folded
   * circle a step under those.
   */
  /** The capsule of keys: the reference's 64 (`FlatBarHeight`), smaller. */
  bar: 56,
  /** Between the capsule's edge and its keys: the reference's 6 (`CapsuleInset`), smaller. */
  inset: 4,
  /** A key inside it: 48, the tap floor, 4 in from a 56 capsule. */
  key: 48,
  /** The round button at the row's end: the reference's 56 (`SearchSize`), smaller. */
  fab: 48,
  /** Between the capsule and that button: `SearchGap`. */
  fabGap: 12,
  /** The bar over the capsule — the review button, or the mini player: as tall as the round button. */
  top: 48,
  /** Between that bar and the capsule, and between bars in a row: the flat bar's `miniPlayerGap`. */
  gap: 8,
  /** The capsule folded: the reference's 48 (`CollapsedBarSize`), smaller. */
  folded: 40,
  /** `BAR_MORPH_MS`: how long one layout takes to become the other. */
  morphMs: 300,
  /** `tween`'s default easing, `FastOutSlowInEasing`. */
  easing: [0.4, 0, 0.2, 1] as const,
  /**
   * How far the page scrolls before the bars may contract: none. The
   * reference holds its bar open for its first two shelves; here the
   * expanded bars stand over the foot of the masthead — the strip, the
   * ratings — so they make room as soon as the page is read downward, and
   * expand again at the very top or on any move back up.
   */
  hold: 0,
  /** Home's: the travel one way before the bars answer. */
  slop: HOME_BAR.slop,
} as const;

/** Where one bar is, inside the dock's row: from its left edge and its foot. */
export type DockFrame = { left: number; bottom: number; width: number; height: number };

/** The frames of one layout. A bar that is not in it is `null`. */
export type DockFrames = {
  /** The capsule of keys — or, folded, its circle. */
  actions: DockFrame;
  /** The review button: the bar on its own, or the circle at the row's end. */
  review: DockFrame | null;
  /** The mini player, while music is playing. */
  player: DockFrame | null;
};

/** What decides a layout. */
export type DockState = {
  /** The dock's row: the display less its edges, at most `DOCK.maxWidth`. */
  width: number;
  expanded: boolean;
  /** A game that is out has a review button; one that is not has none. */
  review: boolean;
  /** Music is playing, so the mini player is one of the bars. */
  player: boolean;
};

/** The row's width on a display this wide. */
export function dockWidth(display: number): number {
  return Math.min(display - DOCK.side * 2, DOCK.maxWidth);
}

/**
 * The capsule's width when it shares the row with the round button: what is
 * left of the row past the button and the gap before it.
 */
export function capsuleBeside(width: number): number {
  return width - DOCK.fabGap - DOCK.fab;
}

/** How tall the dock is: the row, and the bar over it when one is there. */
export function dockHeight(state: Omit<DockState, 'expanded'>): number {
  const hasTop = state.player || state.review;
  return hasTop ? DOCK.bar + DOCK.gap + DOCK.top : DOCK.bar;
}

/** Centred on the row's height, from its foot. */
function centred(height: number): number {
  return (DOCK.bar - height) / 2;
}

/**
 * One layout: where every bar is, expanded or contracted.
 *
 * The reference's two `ConstraintSet`s, in this dock's terms. Every bar is
 * centred on the row, so the round button and the folded circle sit on the
 * capsule's centre line; the bar over the row stands `DOCK.gap` above it.
 */
export function dockFrames({ width, expanded, review, player }: DockState): DockFrames {
  const topBottom = DOCK.bar + DOCK.gap;
  const fabLeft = width - DOCK.fab;
  const circle = { left: fabLeft, bottom: centred(DOCK.fab), width: DOCK.fab, height: DOCK.fab };
  const capsule = (capsuleWidth: number): DockFrame => ({
    left: 0,
    bottom: 0,
    width: capsuleWidth,
    height: DOCK.bar,
  });
  const foldedCapsule: DockFrame = {
    left: 0,
    bottom: centred(DOCK.folded),
    width: DOCK.folded,
    height: DOCK.folded,
  };
  const overRow = (): DockFrame => ({ left: 0, bottom: topBottom, width, height: DOCK.top });

  if (expanded) {
    return {
      /* With the review button over it, the capsule has the row to itself;
         with music in that slot the button is the circle at its end. */
      actions: capsule(review && player ? capsuleBeside(width) : width),
      review: review ? (player ? circle : overRow()) : null,
      player: player ? overRow() : null,
    };
  }

  if (player) {
    /* The reference's folded row: the capsule a circle at the start, the mini
       player after it to the row's end — or to the review button's gap. */
    const playerLeft = DOCK.folded + DOCK.gap;
    const playerRight = review ? fabLeft - DOCK.gap : width;
    return {
      actions: foldedCapsule,
      review: review ? circle : null,
      player: {
        left: playerLeft,
        bottom: centred(DOCK.top),
        width: playerRight - playerLeft,
        height: DOCK.top,
      },
    };
  }

  return {
    actions: review ? capsule(capsuleBeside(width)) : foldedCapsule,
    review: review ? circle : null,
    player: null,
  };
}

/** A frame between two others: `t` 0 is `from`, 1 is `to`. */
export function lerpFrame(from: DockFrame, to: DockFrame, t: number): DockFrame {
  'worklet';
  return {
    left: from.left + (to.left - from.left) * t,
    bottom: from.bottom + (to.bottom - from.bottom) * t,
    width: from.width + (to.width - from.width) * t,
    height: from.height + (to.height - from.height) * t,
  };
}

function clamp01(value: number): number {
  'worklet';
  return Math.min(1, Math.max(0, value));
}

/**
 * How far the capsule is from its folded circle: 0 folded, 1 at `keysWidth`
 * or wider — `foldProgress`, read off the width the capsule actually has.
 *
 * @param keysWidth the narrowest the capsule is ever drawn unfolded, which is
 *   the width its keys are laid out at while it folds
 */
export function foldProgress(width: number, keysWidth: number): number {
  'worklet';
  return clamp01((width - DOCK.folded) / Math.max(1, keysWidth - DOCK.folded));
}

/** The keys, by fold: in once the circle's glyph has gone — `unfoldingTabs`. */
export function keysAlpha(fold: number): number {
  'worklet';
  return clamp01((fold - 0.3) / 0.7);
}

/** The folded circle's glyph, by fold: gone before the keys come — `foldedCircle`. */
export function circleAlpha(fold: number): number {
  'worklet';
  return clamp01(1 - fold / 0.4);
}

/**
 * How far the review button is from its circle, read off its width: 0 a
 * circle, 1 the bar.
 */
export function barProgress(width: number, barWidth: number): number {
  'worklet';
  return clamp01((width - DOCK.fab) / Math.max(1, barWidth - DOCK.fab));
}

/**
 * The review button's words, by how far it is a bar: the reference's
 * `fabAlpha` — nothing for the first half of the way, all by the end — so the
 * words are gone before the button is too narrow to hold them.
 */
export function labelAlpha(bar: number): number {
  'worklet';
  return clamp01((bar - 0.5) / 0.5);
}

/**
 * Where the dock's foot is, above the display's: the system's navigation
 * inset and the reference's 8 over it.
 */
export function dockBottom(insetBottom: number): number {
  return insetBottom + DOCK.bottom;
}

/** Between the page's last line and the contracted row: a section's distance. */
export const DOCK_FOOT_SPACE = 32;

/**
 * The room the page leaves at its foot, so its last line is never under the
 * contracted row. Expanded, the bar over the row is taller than this, and at
 * the very end of the page a move back up lets it cover the last of it for as
 * long as it is open — the owner's choice, over a foot of empty page the
 * height of both bars.
 */
export function dockFootRoom(bottom: number): number {
  return bottom + DOCK.bar + DOCK_FOOT_SPACE;
}
