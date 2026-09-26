import { progressChoiceFor, type ProgressChoice } from '../constants/progress';
import type {
  CompletionLevel,
  GameLog,
  GameReviewStats,
  LogStatus,
  ScoreTally,
} from './database.types';

/**
 * What a game's reviews are filtered and tallied by: the platform, how far the
 * reviewer got, and whether they played alone.
 *
 * ## Filters are predicates, sent with the query
 *
 * Each filter becomes a clause on `logs` in the request itself — see
 * `getGameReviewList` — so a game with thousands of reviews returns only the
 * ones that match, and nothing is downloaded to be sifted on the phone. They
 * compose by AND: PC + Finished + Co-op is three clauses on one request.
 *
 * ## Tallies are sums, folded here
 *
 * `game_review_stats` (0026) answers with a count and a sum per *stored*
 * platform string, and this folds them into families — "PS4" and "PS5" are both
 * PlayStation. Sums merge where averages cannot, and the family table stays in
 * one place (`constants/platform-family.ts`). It is passed in rather than
 * imported because that module reaches the game case's artwork, which a node
 * test cannot load — and a test running these same clauses against a real
 * Postgres is the point of keeping them here.
 *
 * Every number is Gamelog's own: the scores people gave on this app.
 */

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/** How far the reviewer got. Read from `status`, `completion` and `platinum`. */
export type ReviewProgressFilter = 'finished' | 'full' | 'platinum' | 'playing' | 'dropped';

/** How they played it. Only reviewers who said so match either one. */
export type ReviewPlayFilter = 'solo' | 'coop';

export type ReviewFilters = {
  /**
   * The stored `played_on` values to match — every spelling one family has been
   * recorded under ("PS5", "PS4", "PlayStation 4"). Null is every platform,
   * including reviews that name none; an empty list matches nothing.
   */
  platforms?: readonly string[] | null;
  /** Lowest score to include, inclusive. 60 shows 60-100. */
  minScore?: number | null;
  /** Highest score to include, inclusive. Only used by the "below 60" band. */
  maxScore?: number | null;
  progress?: ReviewProgressFilter | null;
  play?: ReviewPlayFilter | null;
};

/**
 * The completion filter's choices, in the order a reader thinks about them.
 *
 * "Dropped" rather than the brief's "Abandoned": the progress vocabulary already
 * calls that state Dropped (`constants/progress.ts`), and one state wearing two
 * words on two screens is exactly the drift that file exists to prevent.
 *
 * `platinum` is the old "Platinum runs only" tick box, moved in here. It is an
 * answer to the same question — how far did they get — and a separate control
 * beside a "100%" choice asked the reader to work out how the two differ.
 */
export const PROGRESS_FILTERS: readonly { key: ReviewProgressFilter; label: string }[] = [
  { key: 'finished', label: 'Finished' },
  { key: 'full', label: '100%' },
  { key: 'platinum', label: 'Platinum' },
  { key: 'playing', label: 'Playing' },
  { key: 'dropped', label: 'Dropped' },
];

export const PLAY_FILTERS: readonly { key: ReviewPlayFilter; label: string }[] = [
  { key: 'solo', label: 'Solo' },
  { key: 'coop', label: 'Co-op' },
];

/** One predicate on `logs`. Every clause in a list must hold. */
export type ReviewClause =
  | { kind: 'platform'; values: readonly string[] }
  | { kind: 'status'; values: readonly LogStatus[] }
  /** `completion` is one of `levels` — **or** the reviewer claimed a platinum. */
  | { kind: 'completion'; levels: readonly CompletionLevel[] }
  | { kind: 'flag'; column: 'coop' | 'platinum'; value: boolean }
  | { kind: 'score'; bound: 'min' | 'max'; value: number };

/**
 * The clauses a set of filters sends.
 *
 * **A platinum counts as finished and as 100%**, whatever `completion` says.
 * The log form writes `full` for a platinum and 0023 backfilled the same, but the
 * progress sheet's "Played" clears `completion` without touching the trophy — so
 * a platinum with no level is a state that exists, and it is not somebody who
 * failed to finish.
 *
 * "Playing" includes paused: both are people partway through, and a paused run
 * is not an opinion formed at the end.
 */
export function reviewFilterClauses(filters: ReviewFilters): ReviewClause[] {
  const clauses: ReviewClause[] = [];

  if (filters.platforms) clauses.push({ kind: 'platform', values: [...filters.platforms] });
  if (filters.minScore != null)
    clauses.push({ kind: 'score', bound: 'min', value: filters.minScore });
  if (filters.maxScore != null)
    clauses.push({ kind: 'score', bound: 'max', value: filters.maxScore });

  switch (filters.progress) {
    case 'finished':
      clauses.push({ kind: 'completion', levels: ['story', 'main', 'full'] });
      break;
    case 'full':
      clauses.push({ kind: 'completion', levels: ['full'] });
      break;
    case 'platinum':
      clauses.push({ kind: 'flag', column: 'platinum', value: true });
      break;
    case 'playing':
      clauses.push({ kind: 'status', values: ['playing', 'paused'] });
      break;
    case 'dropped':
      clauses.push({ kind: 'status', values: ['dropped'] });
      break;
  }

  if (filters.play) clauses.push({ kind: 'flag', column: 'coop', value: filters.play === 'coop' });

  return clauses;
}

// ---------------------------------------------------------------------------
// Platforms, folded into families
// ---------------------------------------------------------------------------

/** A platform family as this file needs it — `PLATFORM_FAMILIES` fits. */
export type FacetFamily = { key: string; name: string };

/** Which family a stored platform string belongs to, by key, or null for none. */
export type FamilyOf = (stored: string) => string | null;

const OTHER: FacetFamily = { key: 'other', name: 'Other' };

/** One platform filter choice, and every stored spelling it stands for. */
export type PlatformFacet = { key: string; label: string; values: string[] };

/**
 * Stored platform strings grouped by family, in the families' own order, with
 * everything unrecognised gathered under "Other" at the end. Families with
 * nothing in them are left out.
 */
function byFamily<T>(
  items: readonly T[],
  storedOf: (item: T) => string,
  families: readonly FacetFamily[],
  familyOf: FamilyOf
): { family: FacetFamily; items: T[] }[] {
  const known = new Set(families.map((family) => family.key));
  const buckets = new Map<string, T[]>();
  for (const item of items) {
    const found = familyOf(storedOf(item));
    const key = found && known.has(found) ? found : OTHER.key;
    buckets.set(key, [...(buckets.get(key) ?? []), item]);
  }
  return [...families, OTHER]
    .filter((family) => buckets.has(family.key))
    .map((family) => ({ family, items: buckets.get(family.key)! }));
}

/**
 * The platform filter's choices: only the families somebody has actually
 * reviewed this game on. Offering "Xbox" on a game nobody reviewed there is a
 * control that can only disappoint.
 */
export function platformFacets(
  stored: readonly string[],
  families: readonly FacetFamily[],
  familyOf: FamilyOf
): PlatformFacet[] {
  return byFamily(stored, (value) => value, families, familyOf).map(({ family, items }) => ({
    key: family.key,
    label: family.name,
    values: items,
  }));
}

// ---------------------------------------------------------------------------
// The breakdown
// ---------------------------------------------------------------------------

export type BreakdownRow = { key: string; label: string; count: number; average: number };

export type BreakdownSection = {
  key: 'progress' | 'platform' | 'play';
  title: string;
  rows: BreakdownRow[];
};

function row(key: string, label: string, tally: ScoreTally | undefined): BreakdownRow | null {
  if (!tally || tally.count <= 0) return null;
  return { key, label, count: tally.count, average: Math.round(tally.sum / tally.count) };
}

/**
 * "Players who finished it gave it 87; players who dropped it, 64."
 *
 * Three sections — how far, on what, alone or not — each holding only the rows
 * that have somebody in them, and each section left out entirely when it has
 * none. A game whose reviewers never said how they played gets no "how they
 * played" heading over an empty space.
 */
export function reviewBreakdown(
  stats: GameReviewStats,
  families: readonly FacetFamily[],
  familyOf: FamilyOf
): BreakdownSection[] {
  const progress = (['finished', 'full', 'playing', 'dropped'] as const).map((key) =>
    row(key, PROGRESS_FILTERS.find((entry) => entry.key === key)!.label, stats.groups[key])
  );

  const platforms = byFamily(stats.platforms, (entry) => entry.platform, families, familyOf).map(
    ({ family, items }) =>
      row(family.key, family.name, {
        count: items.reduce((total, item) => total + item.count, 0),
        sum: items.reduce((total, item) => total + item.sum, 0),
      })
  );

  const play = PLAY_FILTERS.map(({ key, label }) => row(key, label, stats.groups[key]));

  const present = (entry: BreakdownRow | null): entry is BreakdownRow => entry !== null;
  const sections: BreakdownSection[] = [
    { key: 'progress', title: 'Progress', rows: progress.filter(present) },
    { key: 'platform', title: 'Platform', rows: platforms.filter(present) },
    { key: 'play', title: 'Solo or co-op', rows: play.filter(present) },
  ];
  return sections.filter((section) => section.rows.length > 0);
}

// ---------------------------------------------------------------------------
// One review's context
// ---------------------------------------------------------------------------

/** The word for each progress that says something about a review. */
const PROGRESS_WORD: Partial<Record<ProgressChoice, string>> = {
  playing: 'Playing',
  paused: 'Paused',
  completed: 'Completed',
  full: '100%',
  dropped: 'Dropped',
};

/**
 * How the reviewer played, in a few words: "Completed · 4-player co-op".
 *
 * **Only what they said.** "Played" is left unsaid, because every review is by
 * somebody who played the game and printing it on all of them is noise; no play
 * type is printed when they did not give one. Null when there is nothing to say.
 *
 * A platinum reads as 100%, the same rule the filters count by.
 */
export function reviewContext(
  log: Pick<GameLog, 'status' | 'completion' | 'platinum' | 'coop' | 'player_count'>
): string | null {
  const progress = progressChoiceFor({
    status: log.status,
    completion: log.platinum ? 'full' : log.completion,
  });
  const how =
    progress === 'completed' && log.completion === 'main'
      ? 'Completed + extras'
      : progress
        ? PROGRESS_WORD[progress]
        : undefined;

  const play =
    log.coop === true
      ? log.player_count
        ? `${log.player_count}-player co-op`
        : 'Co-op'
      : log.coop === false
        ? 'Solo'
        : undefined;

  const parts = [how, play].filter((part): part is string => !!part);
  return parts.length > 0 ? parts.join(' · ') : null;
}
