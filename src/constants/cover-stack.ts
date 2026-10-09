/**
 * The cover stack: five box arts overlapping, the middle one in front.
 *
 * The owner's reference for it is old Letterboxd's "New from friends" tile — a
 * list shown as five posters fanned level, the centre whole and the two either
 * side tucked behind it, then the outermost behind those. It is how a profile
 * shows its library and how a collection is shown wherever collections are
 * listed (`<CoverStack>`, `<ListTile>`, `<GamesWidget>`).
 *
 * Every number is read off that image, where a poster is 72px wide: each steps
 * 40px from the one in front of it, so 32 of its 72 are covered and the five
 * span 232; the cover above casts about six pixels of shadow on the one below.
 *
 * Pure, with no imports, so `npm test` loads it.
 */

/** Covers in a full stack. */
export const STACK_SIZE = 5;

/** How far each cover steps from the one in front of it, in cover widths. */
export const STACK_STEP = 40 / 72;

/** How wide a full stack is, in cover widths: one cover and four steps. */
export const STACK_SPAN = 1 + (STACK_SIZE - 1) * STACK_STEP;

/**
 * Where the covers go, in the order they are given: the first in the middle,
 * then alternately left and right of it, one place further out each time.
 *
 * The first is whatever represents the thing — a collection's chosen cover, a
 * library's newest game — so it is the one in front and the one that is whole.
 * A number is the place, in steps from the middle; negative is left.
 */
export const STACK_ORDER: readonly number[] = [0, -1, 1, -2, 2];

/** The shadow a cover casts on the one behind it: its width in cover widths, and how dark. */
export const STACK_SHADE = { width: 6 / 72, depth: 0.42 } as const;

export type StackPlace = {
  /** Which of the covers handed in this is: 0 is the one in front. */
  index: number;
  /** Its left edge, in dp **from the left edge of the row** — the centring is in it. */
  left: number;
  /** How many covers are in front of it: 0, 1 or 2. Draw the deepest first. */
  depth: number;
  /** Whether a cover behind it shows at its left, and at its right — where it casts. */
  shadesLeft: boolean;
  shadesRight: boolean;
};

export type StackLayout = {
  cover: { width: number; height: number };
  /** How wide the covers are together: the row exactly with five, narrower with fewer. */
  width: number;
  /** How far in from the row's left edge the covers begin: nothing with five, half the slack with fewer. */
  inset: number;
  height: number;
  /** One per cover, **in drawing order**: the deepest first, the front one last. */
  places: StackPlace[];
};

/**
 * Where `count` covers go in a row `available` dp wide.
 *
 * **A cover is the size it would be in a full stack, however many there are.**
 * A collection of two games is two covers at the size the five beside it are
 * drawn, not two larger ones spread to fill the row — the cards under one
 * another read as the same object each time, with less in it.
 *
 * **Five covers span the row exactly**: the first one's left edge is the row's
 * and the last one's right edge is the row's, so in a card the stack lines up
 * with the text above and below it. For one pass a full stack took
 * seven-eighths of its row and stood in the middle, to be "a little bit
 * smaller"; the owner saw it and had it brought back to the margins — the card's
 * own inset is all the smaller it gets.
 *
 * **Fewer than five stand in the middle of the row.** They are still built from
 * the first cover outward — the second behind it to the left, the third behind
 * it to the right — and the group as a whole is centred, so the air either side
 * of it is the same. They stood at the left edge once, and a collection of three
 * left a third of the row empty at the right. No empty places are drawn: a grey
 * slot where art should be reads as a picture that failed to load.
 */
export function stackLayout(count: number, available: number): StackLayout {
  const shown = Math.max(0, Math.min(STACK_SIZE, Math.floor(count)));
  const width = Math.max(1, Math.floor(available / STACK_SPAN));
  const height = Math.round(width * 1.5);
  /* What is left after one cover, shared between the four steps, so a full
     stack ends exactly on the edge it was given rather than a few dp short. */
  const step = Math.max(0, available - width) / (STACK_SIZE - 1);

  const offsets = STACK_ORDER.slice(0, shown);
  const leftmost = Math.min(0, ...offsets);
  const rightmost = Math.max(0, ...offsets);

  const group = Math.round((rightmost - leftmost) * step) + width;
  const inset = Math.max(0, Math.round((available - group) / 2));

  const places = offsets
    .map((offset, index) => ({
      index,
      left: inset + Math.round((offset - leftmost) * step),
      depth: Math.abs(offset),
      shadesLeft: offsets.includes(offset - 1) && offset <= 0,
      shadesRight: offsets.includes(offset + 1) && offset >= 0,
    }))
    .sort((a, b) => b.depth - a.depth);

  return { cover: { width, height }, width: group, inset, height, places };
}
