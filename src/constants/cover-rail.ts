/**
 * A row of games: how large a cover is, how far apart two sit, and how many
 * are in view.
 *
 * Pure — no React Native — so `npm test` covers it.
 *
 * ## The size is the old one
 *
 * A cover is 120×180 on a 360dp phone, twenty from the next, two and a half
 * in view: the height of the album art on SimpMusic's artist page, which is
 * what every rail in the app was before 2026-10-09. For one build that day the
 * covers were Letterboxd's instead — 82×123, 22.8% of the display, nearly four
 * in view, from the owner's reference for Search. The owner saw them on a
 * phone: "Go back to the old sizes of game's portraits across the app on the
 * rails. They are too tiny." **Do not shrink them again.**
 *
 * What stayed from that reference is everything but the size: a row has a
 * one-line heading, and **nothing printed under a cover** unless it is
 * something the box cannot say (see `<GameCoverRail>`). The old rail carried a
 * two-line title and a year under every cover; this one does not.
 *
 * ## The rows stand on the page, not in cards
 *
 * The reference draws each section inside a rounded panel, and the first build
 * of this did too. The owner had the panels removed: "remove the cards and
 * leave the game's rails on their own. They should not be inside a card." So a
 * row is its heading on the page and its covers under it, starting at the
 * page's margin and running off the far edge. **Do not put a row of games back
 * in a card** — on the app's own pages or a game's.
 */

/** Past this the composition stops growing — `MaxContentWidth`, restated: this file imports nothing. */
const MAX_DISPLAY = 800;

export const RAIL = {
  /** A cover's width over the display's: a third — 120 of 360. */
  coverRatio: 120 / 360,
  /** The space between two covers over the display's width: 20 of 360. */
  gapRatio: 20 / 360,
  /** Box art: two across to three up. */
  aspect: 2 / 3,
} as const;

/**
 * A section on the page: where its heading and its first cover start, how far
 * the heading stands from the covers, and how far one section is from the
 * next. `Spacing.x16`, `x12` and `x32`, as literals — this file imports
 * nothing.
 */
export const SECTION = {
  margin: 15,
  /** From the heading's line down to the covers (`<HomeSection>`'s gap). */
  headingGap: 12,
  /** One line of `h4`. */
  heading: 21,
  /** Between one section and the next, and from Search's slider to its first. */
  gap: 32,
} as const;

/**
 * What stands under a cover when the row is people's activity: a face, and
 * beside it a name over a score.
 */
export const RAIL_FOOT = {
  /** From the cover down to whatever is under it. */
  top: 8,
  /** One quiet line: a rank, a date, a score. `bodySmall`'s line. */
  line: 15,
  /** A face beside two lines. */
  avatar: 22,
  avatarGap: 6,
} as const;

export type RailLayout = {
  cover: { width: number; height: number };
  gap: number;
};

/** A row's covers and the space between them, for a display this wide. */
export function railLayout(displayWidth: number): RailLayout {
  const display = Math.max(0, Math.min(displayWidth, MAX_DISPLAY));
  const width = Math.round(display * RAIL.coverRatio);

  return {
    cover: { width, height: Math.round(width / RAIL.aspect) },
    gap: Math.round(display * RAIL.gapRatio),
  };
}

/**
 * How many covers are in view across `viewport` — the distance from the first
 * cover's leading edge to where the row is cut — counting the last as the
 * fraction of it that shows.
 */
export function coversInView(layout: RailLayout, viewport: number): number {
  const pitch = layout.cover.width + layout.gap;
  if (pitch <= 0 || viewport <= 0) return 0;

  const whole = Math.floor(viewport / pitch);
  const rest = viewport - whole * pitch;
  return whole + Math.min(1, rest / layout.cover.width);
}

/** What a row adds under its covers: nothing, one line, or a face and two lines. */
export function footHeight(kind: 'none' | 'line' | 'person'): number {
  if (kind === 'none') return 0;
  if (kind === 'line') return RAIL_FOOT.top + RAIL_FOOT.line;
  return RAIL_FOOT.top + Math.max(RAIL_FOOT.avatar, RAIL_FOOT.line * 2);
}
