import type { LogWithRelations } from '../database.types';
import { createSeen } from '../seen';

/**
 * Every review recently loaded into a list, so opening one does not ask for it
 * again. The idea is `lib/seen.ts`'s; this is what it means for a review.
 *
 * A review's page reads `getLogById`, which selects `LOG_WITH_RELATIONS` — the
 * log, its game, its writer. Every list of reviews in the app selects exactly
 * that too: the feed, a profile's reviews, a game's, the most liked, Search.
 * So the card that was tapped already held the page, and the page waited on
 * "Loading review" for a second copy of it.
 *
 * `rememberLogs` is called on those lists and nothing else. A row selected with
 * fewer columns must not come through here.
 */

/** A few screens of feeds; a log with its game and writer is 2–4 KB. */
const SEEN_LOGS_LIMIT = 200;

const logs = createSeen<LogWithRelations>(SEEN_LOGS_LIMIT);

/** Keep every review of a list, and hand the list back unchanged. */
export function rememberLogs<T extends LogWithRelations>(rows: T[]): T[] {
  for (const row of rows) logs.remember(row);
  return rows;
}

export const recallLog = logs.recall;
