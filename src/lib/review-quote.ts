/**
 * A review in one sentence — the owner's direction (2026-10-16): the review's
 * headline became "Describe the game in one word or sentence", drawn between
 * large quotation marks on the review's own page and, when its writer says so,
 * on every card the review appears on.
 *
 * It is `logs.review_title`, reused (0040 says why), and these are its rules.
 * Pure, so `npm test` holds them (`review-quote.test.ts`).
 */

/**
 * The longest a quote may be: three lines on the narrowest card it is drawn
 * on.
 *
 * The owner asked for "no more than 3 lines… for how it would look in the
 * surprise me screen" and did not know what that was in characters. It was
 * measured with Inter's own advance widths, then measured again against
 * Poppins' when Poppins replaced Inter app-wide (2026-10-17) — Poppins runs a
 * little wider on ordinary English, and the old 85 let a wide-letter-heavy
 * sentence spill to a fourth line on Surprise Me's card
 * (`review-quote.test.ts` reads the real font file and checks a set of
 * realistic reviews, not just the average case). 82 holds every sample this
 * tests, with margin: Surprise Me's card, the tighter of the two, still takes
 * about ninety characters of *ordinary* English on three lines, this cap is
 * just shy of that to cover unusually wide sentences too. The owner's own
 * example, "An open world masterpiece that everyone should play at least once
 * in their lives.", is eighty-one, and still fits whole.
 *
 * **Both cards grew wider on 2026-10-20**, when the owner's reference moved
 * the writing out from beside the art and the face onto the card's full
 * inside, so the cap now has more room than it was cut for. It did not move
 * with them: eighty-two characters is also about as much as anybody reads at a
 * glance, which is the other half of what the limit is for.
 *
 * 0004's CHECK still allows 140, so a headline written before this is kept
 * whole; only the form stops at this.
 */
export const QUOTE_MAX = 82;

/** What a card of a review shows (0040's `review_display`). */
export const REVIEW_DISPLAYS = ['text', 'quote'] as const;
export type ReviewDisplay = (typeof REVIEW_DISPLAYS)[number];

/**
 * The quote as it is kept and drawn: one line, no quotation marks of its own.
 *
 * The app draws the marks, so a writer who typed their own would get two
 * pairs. Only a pair that wraps the whole sentence is taken off — a quote
 * *inside* it ("the “open world” part") is the writer's and stays. Line breaks
 * and runs of spaces become one space: it is a sentence, set justified, and a
 * stray break would leave a hole in the block.
 */
export function normaliseQuote(raw: string | null | undefined): string {
  let quote = (raw ?? '').replace(/\s+/g, ' ').trim();
  for (const [open, close] of WRAPPING_PAIRS) {
    if (
      quote.length >= open.length + close.length &&
      quote.startsWith(open) &&
      quote.endsWith(close)
    ) {
      const inner = quote.slice(open.length, quote.length - close.length).trim();
      /* "“A” and “B”" is two quotes, not one wrapped sentence. */
      if (!inner.includes(open) && !inner.includes(close)) quote = inner;
      break;
    }
  }
  return quote;
}

/** Quotation marks a sentence might arrive wrapped in, typed or pasted. */
const WRAPPING_PAIRS: readonly (readonly [string, string])[] = [
  ['“', '”'],
  ['"', '"'],
  ['„', '“'],
  ['«', '»'],
  ['»', '«'],
  ['‘', '’'],
  ["'", "'"],
  ['「', '」'],
];

/** The writer's choice, read off a row that may predate 0040 (no such field). */
export function displayOf(log: { review_display?: string | null }): ReviewDisplay {
  return log.review_display === 'quote' ? 'quote' : 'text';
}

/**
 * Which half of a review a card shows: the quote, three lines of the review,
 * or neither.
 *
 * The writer's choice wins when it can be honoured. A review with only one of
 * the two shows that one whatever the choice says — a card does not go blank
 * because somebody chose "quote" and then wrote no quote.
 */
export function cardShows(log: {
  review: string | null;
  review_title: string | null;
  review_display?: string | null;
}): 'text' | 'quote' | null {
  const text = !!log.review?.trim();
  const quote = !!normaliseQuote(log.review_title);
  if (quote && displayOf(log) === 'quote') return 'quote';
  if (text) return 'text';
  if (quote) return 'quote';
  return null;
}

/** Whether a log has anything written — a review, a quote, or both. */
export function hasWriting(log: { review: string | null; review_title: string | null }): boolean {
  return cardShows(log) !== null;
}

/** What a card of a review says to a screen reader: its quote between marks, or its text. */
export function spokenWords(log: {
  review: string | null;
  review_title: string | null;
  review_display?: string | null;
}): string {
  const shows = cardShows(log);
  if (shows === 'quote') return `“${normaliseQuote(log.review_title)}”`;
  if (shows === 'text') return (log.review ?? '').trim();
  return '';
}
