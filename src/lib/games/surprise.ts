import { cacheSoundtrack, getCachedSoundtrack } from '@/lib/api/soundtracks';
import { getSurprisePool, type SurprisePoolFilters } from '@/lib/games/igdb';
import { recommendFromLogs } from '@/lib/games/recommend';
import type { GameSearchResult } from '@/lib/games/types';
import { readLocalSoundtrack, writeLocalSoundtrack } from '@/lib/soundtrack-cache';
import { findGameSoundtrack, type GameSoundtrack } from '@/lib/soundtracks';
import type { SurpriseGameMode } from '@/lib/surprise-prefs';

/**
 * Surprise Me — picking a game, and finding its music.
 *
 * This module is where the feature's cost is controlled. Everything expensive
 * happens once per *batch* or once per *game*, never once per press:
 *
 *   open the screen  → one IGDB request for up to fifty candidates
 *   deal a card      → walk the cursor; no request until the batch runs out
 *   soundtrack       → the shared cache first; iTunes only on a true miss
 *   "Another song"   → `pickTrack()`, pure, against the array already in memory
 *
 * The UI holds the cursor and the chosen track. Everything here is stateless.
 */

/** What one log needs to look like to be excluded. Deliberately structural. */
export type ExclusionLog = {
  game_id: string;
  status: string;
  rating: number | null;
  game?: { title?: string } | null;
};

/**
 * How many rated logs before "Based on my games" is worth offering.
 *
 * `recommendFromLogs` seeds from three games and needs a rating of 60 or better
 * to treat one as an endorsement. Below this the mode would quietly return
 * nothing and the roll would look broken, so the option is hidden instead —
 * the same rule the empty settings screen follows: never show a control for
 * something the system cannot currently do.
 */
export const FORYOU_MIN_LOGS = 3;

/**
 * Statuses that take a game out of the running.
 *
 * Played and dropped only. A `backlog` game is one you own and never started,
 * which is among the best things this feature can hand you, and `playing` is
 * a game you are in the middle of — neither is "already answered".
 */
const EXCLUDED_STATUSES = new Set(['played', 'dropped']);

export function canUseForYou(logs: readonly ExclusionLog[]): boolean {
  return logs.filter((log) => log.rating !== null && log.rating >= 60).length >= FORYOU_MIN_LOGS;
}

/**
 * The games this viewer is done with.
 *
 * Exported so the screen can mark a card the exclusion let through, rather than
 * keeping a second, drifting idea of what "played" means. `getUserLogs` caps at
 * 100 rows, so this is the hundred most recent — which is why a card can carry
 * the marker even with the exclusion on, and why the marker is worth having.
 */
export function playedGameIds(logs: readonly ExclusionLog[]): ReadonlySet<string> {
  return new Set(logs.filter((log) => EXCLUDED_STATUSES.has(log.status)).map((log) => log.game_id));
}

/**
 * Drop games the viewer has finished with.
 *
 * The `known` set is the pattern `recommendFromLogs` already uses for the same
 * reason: handing back a game somebody has played is the fastest way to make a
 * recommender look broken.
 */
export function excludeLogged(
  games: readonly GameSearchResult[],
  logs: readonly ExclusionLog[],
  enabled: boolean
): GameSearchResult[] {
  if (!enabled || logs.length === 0) return [...games];

  const known = playedGameIds(logs);
  if (known.size === 0) return [...games];

  const kept = games.filter((game) => !known.has(game.id));

  /*
   * If the filter emptied the batch, hand back the unfiltered one. A completed
   * library is a good problem, and a screen that says "no games" because you
   * have played fifty of the top two hundred is worse than a repeat.
   */
  return kept.length > 0 ? kept : [...games];
}

/**
 * Shuffle in place-ish, returning a new array.
 *
 * The IGDB batch arrives in the pool's sort order — most-rated first for
 * `popular` — so walking it straight would serve the same handful of famous
 * games at the top of every session that happened to draw the same offset.
 * A Fisher-Yates over fifty rows costs nothing and makes the cursor honest.
 */
function shuffle<T>(values: readonly T[]): T[] {
  const out = [...values];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Drop the games somebody has banished, and never relent.
 *
 * Deliberately unlike `excludeLogged` directly above it, which hands back the
 * unfiltered batch rather than an empty one. That is right for "exclude games
 * I've played" — a preference, whose failure mode is a repeat — and wrong here.
 * Hiding a game is a *specific instruction about that game*, given one cover at
 * a time, and a version of it that lapses the moment the pool runs thin is not
 * the promise the double-tap made. An empty batch is the honest outcome and the
 * screen already has a state for it.
 */
export function excludeHidden(
  games: readonly GameSearchResult[],
  hidden: ReadonlySet<string>
): GameSearchResult[] {
  if (hidden.size === 0) return [...games];
  return games.filter((game) => !hidden.has(game.id));
}

export type SurpriseBatchOptions = {
  mode: SurpriseGameMode;
  logs: readonly ExclusionLog[];
  excludePlayed: boolean;
  /** App-wide ids the viewer has hidden. Applied to every mode, unconditionally. */
  hidden: ReadonlySet<string>;
  /**
   * Genre, perspective and rating narrowing.
   *
   * **Ignored by `foryou`**, and that is not an oversight — see the note inside.
   */
  filters: SurprisePoolFilters;
  signal?: AbortSignal;
};

/**
 * One batch of candidates for the chosen mode, shuffled and filtered.
 *
 * An options object rather than six positional arguments: four of them are now
 * filters of one kind or another, three of those are optional-ish, and a call
 * site that has to get `(mode, logs, true, hidden, filters)` in the right order
 * is one transposition away from silently excluding the wrong thing.
 *
 * Nothing here is used to force a fresh batch — the screen does that by changing
 * its query key. The randomness is inside `getSurprisePool`, which picks its own
 * offset (and, for the random pool, its own ordering) on every call.
 */
export async function getSurpriseBatch({
  mode,
  logs,
  excludePlayed,
  hidden,
  filters,
  signal,
}: SurpriseBatchOptions): Promise<GameSearchResult[]> {
  if (mode === 'foryou') {
    /*
     * The existing recommender, unchanged. It already drops everything the
     * viewer has logged — all of it, not just played and dropped — so the
     * exclusion below is a no-op here rather than a second opinion.
     *
     * **This batch is smaller than the other three, and can be empty.** It is
     * built by asking IGDB what three of the viewer's best-rated games are like,
     * so its size is however much similarity data those three happen to have —
     * often well under the fifty a pool query returns, and nothing at all for a
     * library IGDB has no edges for. Asking for fifty takes whatever exists
     * rather than capping it lower for no reason; the caller must not assume it
     * got fifty, and the screen says so when it gets none.
     *
     * **`filters` is not applied here, and the settings screen says so rather
     * than pretending otherwise.** They are catalogue filters: `getSurprisePool`
     * turns them into a `where` clause on IGDB's whole games table, and this
     * mode never issues such a query — it asks IGDB what three of your own games
     * are *similar to* and takes whatever edges exist, which is often well under
     * fifty rows and sometimes none. Narrowing that afterwards would empty it
     * outright most of the time, and could only ever honour two of the three
     * filters anyway, since a recommendation carries genre names and a score but
     * no perspective. Half a filter applied silently is worse than a filter
     * openly not offered — see the note in `<SurpriseSettings>`.
     */
    const { games } = await recommendFromLogs(logs, 50, signal);
    return shuffle(excludeHidden(games, hidden));
  }

  const games = await getSurprisePool(mode, filters, signal);
  return shuffle(excludeHidden(excludeLogged(games, logs, excludePlayed), hidden));
}

/**
 * The soundtrack for one game, through the whole cache ladder.
 *
 * device mirror → shared table → iTunes. The first two are misses only when
 * nobody has ever rolled this game, which is the only path that spends an
 * external request.
 *
 * `force` skips both caches and overwrites what they held. It is what the
 * "Try soundtrack again" action runs, so a stored "no soundtrack" — the right
 * answer most of the time, and occasionally a bad lookup — is never permanent
 * from the user's side.
 */
export async function resolveSoundtrack(
  gameId: string,
  gameTitle: string,
  options: { force?: boolean; signal?: AbortSignal } = {}
): Promise<GameSoundtrack | null> {
  const { force = false, signal } = options;

  if (!force) {
    const local = await readLocalSoundtrack(gameId);
    if (local !== undefined) return local;

    const shared = await getCachedSoundtrack(gameId);
    if (shared !== undefined) {
      // Fill the near cache so the next cold start does not need the network.
      await writeLocalSoundtrack(gameId, shared);
      return shared;
    }
  }

  /*
   * A throw from here reaches the screen as a retryable error and nothing is
   * written — deliberately. Caching a *failure* as "no soundtrack" would make a
   * dropped connection permanent for every user of the app.
   */
  const found = await findGameSoundtrack(gameTitle, signal);

  await Promise.all([
    cacheSoundtrack(gameId, gameTitle, found),
    writeLocalSoundtrack(gameId, found),
  ]);

  return found;
}
