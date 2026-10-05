import { createSeen } from '../seen';
import type { Game } from './types';

/**
 * The full record of every game the app has recently downloaded, so opening
 * one does not download it again. The idea is `lib/seen.ts`'s; this is what it
 * means for a game.
 *
 * ## What this stops
 *
 * Every list of IGDB games — search, a franchise, a platform's page, Surprise
 * Me — is fetched with the whole of `GAME_FIELDS`, turned into a complete
 * `Game`, and then cut down to a `GameSearchResult` to draw a cover and a
 * title. The complete record was thrown away. Tapping the cover then asked
 * IGDB for exactly that record, and the game page sat on a spinner for the one
 * to two seconds the request takes.
 *
 * So the complete record is kept as it goes past, and the game page starts
 * from it (`initialData` on `['game', id]`): a game opened from a list is on
 * screen in the frame it is opened, with no request at all.
 *
 * ## Only complete records
 *
 * `rememberGame` is called where a row was fetched with `GAME_FIELDS` and
 * nowhere else (`toFullGame` in `igdb.ts`). A studio's catalogue
 * (`STUDIO_FIELDS`) and the "similar games" rail ask for a third of the
 * fields; remembering those would hand the game page a record with no
 * description and no screenshots and tell it that was the game.
 */

/** Roughly a long session's worth of rails and searches, at 1–3 KB a record. */
export const SEEN_GAMES_LIMIT = 240;

const games = createSeen<Game>(SEEN_GAMES_LIMIT);

export const rememberGame = games.remember;
export const recallGame = games.recall;

/** For tests. */
export const forgetSeenGames = games.clear;
