/**
 * A review's one sentence, in quotation marks, as the owner set it
 * (2026-10-17): ordinary centred text, the marks right beside the first and
 * last words — "exactly like a normal text message".
 *
 * ```text
 *    “The most unique and entertaining
 *      skateboarding video game ever
 *                created.”
 * ```
 *
 * The marks are Poppins' own “ and ”, a little larger than the words. The
 * app's blocky drawn marks were tried inline and small, and the owner went back
 * to the font's. Before that the marks were pinned to the box's corners, and
 * before that flush-left lines under a large raised mark; both needed the app
 * to place every line by hand. Now it is one text the platform breaks.
 *
 * Pure: no React Native here, so `npm test` can load it.
 */

export type PullQuoteSize = 'card' | 'page' | 'share' | 'podium';

export type PullQuoteSpec = {
  /** The words' size and line. */
  fontSize: number;
  lineHeight: number;
};

/**
 * The places a quote is drawn, each at a fixed size.
 *
 * - `card` — every card in a list, on a game's screens and on Surprise Me: the
 *   owner's 12.
 * - `page` — a review's own page, under the title: 15, a step over the card's.
 * - `share` — the classic shared image.
 * - `podium` — the second shared image, under the game and the score.
 */
export const PULL_QUOTE: Record<PullQuoteSize, PullQuoteSpec> = {
  card: { fontSize: 12, lineHeight: 18 },
  page: { fontSize: 15, lineHeight: 22 },
  share: { fontSize: 16, lineHeight: 23 },
  podium: { fontSize: 14, lineHeight: 20 },
};

/**
 * How much larger the marks are than the words: "slightly larger than the
 * text size, but not as big as they are" (2026-10-17).
 */
export const MARK_SCALE = 1.25;

/** The marks' type size at a place. */
export function quoteMarkSize(size: PullQuoteSize): number {
  return Math.round(PULL_QUOTE[size].fontSize * MARK_SCALE);
}
