import { createSeen } from '../seen';
import type { CopyWithRelations } from './physical';

/**
 * Every copy recently loaded into a list, so opening one does not ask for it
 * again. The idea is `lib/seen.ts`'s; this is what it means for a copy.
 *
 * A copy's screen reads `getCopy`, which selects `COPY_SELECT` — the copy, its
 * game, its release with its barcodes, its pending claim. `getCopies` selects
 * exactly that for every copy in the binder, the copies list and a game's own
 * page. So the disc that was tapped already held the whole screen, and the
 * screen waited on a spinner for a second copy of it — on the one screen whose
 * first frame is meant to be the object.
 *
 * Both functions remember what they return, and nothing else may: a copy
 * selected with fewer columns must not come through here.
 */

/** A big collection's worth; a copy with its game and release is 2–3 KB. */
const SEEN_COPIES_LIMIT = 300;

const copies = createSeen<CopyWithRelations>(SEEN_COPIES_LIMIT);

/** Keep every copy of a list, and hand the list back unchanged. */
export function rememberCopies<T extends CopyWithRelations>(rows: T[]): T[] {
  for (const row of rows) copies.remember(row);
  return rows;
}

export const recallCopy = copies.recall;
