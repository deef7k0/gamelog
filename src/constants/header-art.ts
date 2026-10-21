/**
 * How much of the display's height a page's header artwork takes: half —
 * SimpMusic's album and playlist header (`screenInfo.hDP / 2`), full width and
 * cropped to the box.
 *
 * A collection's own screen (`<CollectionHeader>`), and a review's since the
 * owner's direction of 2026-10-21: "Make the hero art in the review screen
 * like the collection's screen size-wise." One number, so the two stay one
 * size. Pure — `npm test` reads it.
 */
export const HEADER_ART_SHARE = 0.5;

/** The header artwork's height on a display this tall. */
export function headerArtHeight(displayHeight: number): number {
  return Math.round(displayHeight * HEADER_ART_SHARE);
}
