/**
 * The profile screen, in numbers.
 *
 * Pure, with no imports, so `npm test` loads it.
 *
 * ## It is the old layout, at a margin of ten
 *
 * For about a week this file held a Letterboxd-style profile, measured off a
 * mock: a 20pt margin, boxes with their titles inside, sections forty apart.
 * The owner used it and went back (2026-10-12): "go back to the old profile
 * page layout, remove the widgets being inside cards… make the margins 10."
 * So these are the numbers of the profile the app had before — a face beside
 * a name over counts, a bio, the actions, the widgets under hairlines twelve
 * apart, then the tabs — with the one figure the owner changed.
 */

/**
 * The profile's side margin: ten, at the owner's direction.
 *
 * **The one screen that is not on the app's 15.** It was 15 in the old layout
 * this went back to and 20 in the Letterboxd-style one between; the owner
 * asked for ten with the return. It is this screen's alone: the top bar, the
 * profile, the tab row and every list under it share it, so the screen has one
 * left edge; nothing else in the app moved.
 */
export const PROFILE_MARGIN = 10;

/**
 * Between the parts of the profile's head: the face's row, the bio, the
 * actions and each widget. Twelve — compact, so the head reads as one thing
 * about one person rather than as a column of separate sections.
 */
export const HEADER_GAP = 12;

/** Four covers across the page, eight apart: the favourites, and the games under them. */
export const FAVOURITES = { columns: 4, gap: 8 } as const;

/**
 * How wide one of those covers is on this display: the four of them and their
 * gaps span the page from margin to margin.
 */
export function favouriteCoverWidth(display: number): number {
  const row = Math.max(0, display - PROFILE_MARGIN * 2);
  return Math.floor((row - FAVOURITES.gap * (FAVOURITES.columns - 1)) / FAVOURITES.columns);
}

// ---------------------------------------------------------------------------
// The head, centred (2026-10-17)
// ---------------------------------------------------------------------------

/*
 * The owner's reference for the top of the profile — a music app's: the face,
 * the name, the bio, three counts with rules between them, then one big
 * filled button with two glyph keys beside it, all centred on the screen. Its
 * screenshot is 242px across a phone; these are its pixels at 360/242 dp each.
 * The owner: "Pfp, username, follow count bio, etc, centered in the screen. Add
 * a big white filled rounded button for follow".
 */

/** The face: 54px of 242, held between 72 and 96. */
export const AVATAR = { ratio: 0.223, min: 72, max: 96 } as const;

export function avatarSize(display: number): number {
  return Math.round(Math.max(AVATAR.min, Math.min(AVATAR.max, display * AVATAR.ratio)));
}

/** From the face to the name: the name's capitals 16dp under it. */
export const NAME_TOP = 12;

/** From the name to the bio. */
export const BIO_TOP = 4;

/**
 * The three counts: each a column 59px wide, centred on its figure and word,
 * with a faint rule 16px tall between two.
 */
export const COUNTS = { column: 88, rule: 24 } as const;

/** From the counts to the actions. */
export const ACTIONS_TOP = 16;

/**
 * The actions: the big button, then two glyph keys.
 *
 * The button is the reference's 120px — 178dp — and taller than its 25px,
 * at the owner's "big": the tap floor, a full pill. The keys are the tap
 * floor too, their glyphs the reference's 14px.
 */
export const ACTIONS = { button: 178, height: 44, gap: 8, key: 44, glyph: 21 } as const;

/** The whole row, centred: the button, then the keys, the first `gap` after it. */
export function actionRowWidth(keys: number): number {
  return ACTIONS.button + (keys > 0 ? ACTIONS.gap + keys * ACTIONS.key : 0);
}
