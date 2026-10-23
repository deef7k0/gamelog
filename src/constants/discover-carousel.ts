/**
 * SimpMusic's "Your daily discover" carousel, as numbers — read from its source
 * (`HomeSectionStyles.kt`, `HomeDiscoverSection`): Material 3's
 * `HorizontalCenteredHeroCarousel`, one large card in the middle and a narrow
 * neighbour either side, the cards morphing between the two as the row moves.
 * Home's "Games for you" (the owner's, 2026-10-22).
 *
 * The motion is Material's keylines: every card is at a place and a width
 * that depend only on how far it is from the middle (`p`, in cards), and
 * between two whole places both are interpolated. That keeps every gap
 * exactly `GAP` at every point of a swipe.
 *
 * No imports: `npm test` loads it, and its functions run as worklets.
 */

export const DISCOVER = {
  /** `heroWidth = (maxWidth * 0.74f).coerceAtMost(HERO_TARGET_WIDTH)`. */
  heroRatio: 0.74,
  heroMax: 360,
  /** `itemSpacing = 8.dp`. */
  gap: 8,
  /** `contentPadding = PaddingValues(horizontal = 10.dp)`. */
  padding: 10,
  /** `.height(320.dp)`. */
  height: 320,
  /** `.maskClip(RoundedCornerShape(28.dp))`. */
  radius: 28,
  /** The words' box: `padding(start = 20.dp, end = 64.dp, bottom = 20.dp)`. */
  textStart: 20,
  textEnd: 64,
  textBottom: 20,
  /** The scrim: `scrim` 0 → 0.78, smoothstepped, from 45% of the card down. */
  scrimFrom: 0.45,
  scrimAlpha: 0.78,
  /** `.padding(top = 10.dp)` above the row. */
  top: 10,
} as const;

export type DiscoverGeometry = {
  /** The row's width. */
  width: number;
  /** The middle card. */
  hero: number;
  /** A neighbour. */
  small: number;
  /** How far the row scrolls to move one card to the middle. */
  step: number;
};

export function discoverGeometry(width: number): DiscoverGeometry {
  const hero = Math.min(width * DISCOVER.heroRatio, DISCOVER.heroMax);
  const small = Math.max(0, (width - 2 * DISCOVER.padding - hero - 2 * DISCOVER.gap) / 2);
  return { width, hero, small, step: hero + DISCOVER.gap };
}

/** Where a card stands, `n` whole places from the middle: its left edge and width. */
function keylineAt(n: number, g: DiscoverGeometry): { left: number; width: number } {
  'worklet';
  const centreLeft = g.width / 2 - g.hero / 2;
  if (n === 0) return { left: centreLeft, width: g.hero };
  if (n > 0) {
    const first = centreLeft + g.hero + DISCOVER.gap;
    return { left: first + (n - 1) * (g.small + DISCOVER.gap), width: g.small };
  }
  const first = centreLeft - DISCOVER.gap - g.small;
  return { left: first + (n + 1) * (g.small + DISCOVER.gap), width: g.small };
}

/**
 * A card `p` places from the middle (fractional while the row moves): its
 * left edge in the row and its visible width — interpolated between the two
 * whole places either side, as Material's keylines are.
 */
export function discoverKeyline(p: number, g: DiscoverGeometry): { left: number; width: number } {
  'worklet';
  const below = Math.floor(p);
  const t = p - below;
  const a = keylineAt(below, g);
  if (t === 0) return a;
  const b = keylineAt(below + 1, g);
  return { left: a.left + (b.left - a.left) * t, width: a.width + (b.width - a.width) * t };
}

/** The scrim's stops: smoothstep from clear to `scrimAlpha`, from `scrimFrom` down. */
export function discoverScrim(steps = 24): { locations: number[]; alphas: number[] } {
  const locations: number[] = [];
  const alphas: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    locations.push(DISCOVER.scrimFrom + (1 - DISCOVER.scrimFrom) * t);
    alphas.push(DISCOVER.scrimAlpha * t * t * (3 - 2 * t));
  }
  return { locations, alphas };
}
