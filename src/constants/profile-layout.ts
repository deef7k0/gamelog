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

/** The face: a fifth of the display, held between 72 and 96. */
export const AVATAR = { ratio: 0.21, min: 72, max: 96 } as const;

export function avatarSize(display: number): number {
  return Math.round(Math.max(AVATAR.min, Math.min(AVATAR.max, display * AVATAR.ratio)));
}

/** From the face to the name and the counts beside it. */
export const IDENTITY_GAP = 20;
