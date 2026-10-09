/**
 * The profile screen, in numbers.
 *
 * Read off the owner's reference for it — a Letterboxd-style profile mock, a
 * 375pt screen drawn 196 pixels wide. That is about 1.9pt to the pixel, so
 * every figure here is good to a couple of points and no better; they are
 * written down so the screen's pieces agree with each other, and
 * `profile-layout.test.ts` holds them to that.
 *
 * Pure, with no imports, so `npm test` loads it.
 */

/**
 * The profile's side margin: the mock's 20, at the owner's direction.
 *
 * **The one screen that is not on the app's 15.** The brief kept 15 and the
 * owner asked for the mock's instead — and then again, for "every tab in the
 * profile screen". It is this screen's alone: the top bar, the tab row, the
 * profile and every list under the other tabs share it, so the screen has one
 * left edge; nothing else in the app moved.
 */
export const PROFILE_MARGIN = 20;

/** How far apart the sections of the Profile tab stand: the mock's 38–42pt. */
export const SECTION_GAP = 40;

/**
 * A boxed section — the mock's "Favorite Films" card.
 *
 * Its title's capitals thirteen under its top edge, a hairline eleven under the
 * title's baseline, and what the box holds seventeen under that. `ruleTop` and
 * `ruleBottom` are those last two as the space either side of the rule, for a
 * 14/19 title.
 *
 * **Eight inside, where the mock's is ten.** The owner asked for the favourites
 * "a little bit bigger" with the margin held at twenty, and the box's own inset
 * is the only width left to take from: two off each side here and one off each
 * gap between the covers (`FAVOURITES`).
 */
export const BOX = { padding: 8, ruleTop: 8, ruleBottom: 15 } as const;

/** How wide the inside of a box is on this display: the row its contents stand in. */
export function boxInside(display: number): number {
  return Math.max(0, display - PROFILE_MARGIN * 2 - BOX.padding * 2);
}

/** The four favourites: across the box, four apart — the mock's five, less one. */
export const FAVOURITES = { columns: 4, gap: 4 } as const;

/** How wide one favourite's cover is on this display. */
export function favouriteCoverWidth(display: number): number {
  const inside = boxInside(display);
  return Math.floor((inside - FAVOURITES.gap * (FAVOURITES.columns - 1)) / FAVOURITES.columns);
}

/**
 * The face: a fifth of the display, held between 72 and 96.
 *
 * The mock's is 77pt of 375, 20.7% — the share the profile already used when it
 * was laid out after Instagram, so this did not move.
 */
export const AVATAR = { ratio: 0.21, min: 72, max: 96 } as const;

export function avatarSize(display: number): number {
  return Math.round(Math.max(AVATAR.min, Math.min(AVATAR.max, display * AVATAR.ratio)));
}

/** From the face to the name and the counts beside it: the mock's 25pt. */
export const IDENTITY_GAP = 24;
