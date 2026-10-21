/**
 * Text that types itself out, a letter at a time: the clock behind it.
 *
 * Onboarding's lines were the first to type (2026-10-15); a review's one
 * sentence — the quote on its own page — is the second, at the owner's
 * direction: "make this text be typed out like in the onboarding screen, with
 * the same letter by letter animation". One clock, so the two cannot drift.
 *
 * Pure: `npm test` reads it through `lib/onboarding.test.ts`.
 */

/**
 * One letter every 20ms — fifty a second. The owner asked for it fast and
 * letter by letter (2026-10-15); the longest intro line is done in about a
 * second and a half. Constant, with no pauses at punctuation and no jitter:
 * those were what made the first build read as word by word.
 */
export const TYPE_MS = 20;

/**
 * How many letters are on screen `elapsedMs` after a line began. The first
 * one is there at once; the rest arrive one per `TYPE_MS`.
 */
export function lettersShown(text: string, elapsedMs: number): number {
  if (elapsedMs < 0) return 0;
  return Math.min(text.length, 1 + Math.floor(elapsedMs / TYPE_MS));
}

/** The whole line's typing time, for a caller that waits for it. */
export function typingDuration(text: string): number {
  return Math.max(0, text.length - 1) * TYPE_MS;
}
