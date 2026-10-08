/**
 * Choosing one track out of a soundtrack, for Surprise Me.
 *
 * Pure — no network, no storage, no clock — and that is what makes "Another
 * song" free: the soundtrack is fetched once per game and every pick after it
 * happens here against the list already in memory. Under `npm test`.
 *
 * Written against the two fields it reads, not against SoundCloud's track, so
 * it can be tested without importing anything.
 */

/** How a track is chosen once the soundtrack is in hand. */
export type TrackPickMode = 'popular' | 'random' | 'surprise';

/** What a pick needs to know about a track. */
export type Pickable = {
  /** Its id. */
  urn: string;
  /** How often it has been played, or null when nobody says. */
  plays: number | null;
  /** `blocked` tracks cannot be heard, so they are never picked. */
  access?: 'playable' | 'preview' | 'blocked';
};

/** How far down the most-played order "Popular" is willing to reach. */
const POPULAR_WINDOW = 12;

/**
 * Weighted pick from `tracks`, highest weight first.
 *
 * `1 / (index + 2)` rather than `1 / (index + 1)`: the first form gives the top
 * track exactly half the total weight of a long list, which is too dominant for
 * a button labelled "Another song". The second flattens the head enough that
 * rerolling actually moves while still favouring the opening tracks heavily.
 */
function weightedPick<T>(tracks: T[], random: () => number): T {
  const weights = tracks.map((_, index) => 1 / (index + 2));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = random() * total;
  for (let index = 0; index < tracks.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return tracks[index];
  }
  return tracks[tracks.length - 1];
}

/**
 * Choose one track.
 *
 * `exclude` holds the tracks already shown for this game, so rerolling walks
 * the soundtrack rather than landing on the same song twice. When it has
 * consumed everything the exclusion is dropped rather than returning null —
 * running out of unheard tracks should start again, not disable the button.
 *
 * **Popular reads SoundCloud's play counts.** It was the position in an iTunes
 * search, which was a guess at popularity; a play count is the thing itself.
 * Tracks whose uploader hides the count have no evidence either way and are
 * not candidates — and if none has one, the mode degrades to random rather
 * than to "always the first track", which would make the button look broken.
 *
 * `random` is injectable so the tests can say what the dice read.
 */
export function pickTrack<T extends Pickable>(
  tracks: readonly T[],
  mode: TrackPickMode,
  exclude?: ReadonlySet<string>,
  random: () => number = Math.random
): T | null {
  const hearable = tracks.filter((track) => track.access !== 'blocked');
  if (hearable.length === 0) return null;

  const unheard = exclude ? hearable.filter((track) => !exclude.has(track.urn)) : hearable;
  const eligible = unheard.length > 0 ? unheard : hearable;

  const effective = mode === 'surprise' ? (random() < 0.5 ? 'popular' : 'random') : mode;

  if (effective === 'random') {
    return eligible[Math.floor(random() * eligible.length)] ?? eligible[0];
  }

  const ranked = eligible
    .filter((track) => track.plays !== null)
    .sort((a, b) => (b.plays ?? 0) - (a.plays ?? 0))
    .slice(0, POPULAR_WINDOW);

  if (ranked.length === 0) {
    return eligible[Math.floor(random() * eligible.length)] ?? eligible[0];
  }

  return weightedPick(ranked, random);
}

/** "3:42" from a duration in ms. */
export function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

/**
 * How long a whole soundtrack runs, to the minute — "48 min", "1 h 12 min".
 * Null when no track says how long it is: a length of zero would be a lie.
 */
export function formatRunningTime(durationsMs: readonly (number | null)[]): string | null {
  let total = 0;
  for (const ms of durationsMs) if (typeof ms === 'number' && ms > 0) total += ms;
  if (total <= 0) return null;

  const minutes = Math.max(1, Math.round(total / 60_000));
  if (minutes < 60) return `${minutes} min`;
  const rest = minutes % 60;
  return rest === 0 ? `${Math.floor(minutes / 60)} h` : `${Math.floor(minutes / 60)} h ${rest} min`;
}
