import type { QueryClient } from '@tanstack/react-query';

import {
  COMMUNITY_RATING,
  scoreHistogram,
  type CommunityRatingConfig,
  type RatingInfluence,
} from '../community-rating';
import type { CommunityRatingReport, LogStatus, Profile, RaterStatsRow } from '../database.types';
import { distributionOf } from '../rating-distribution';
import { hasWriting } from '../review-quote';
import { supabase } from '../supabase';

/**
 * The GameLog score: what a game's page, its stats strip, its Ratings card and
 * its reviews sheet all print, from one row (migration 0041's `game_ratings`).
 *
 * The score is computed on the server, from the canonical ratings, by the
 * method in `lib/community-rating.ts`; nothing here works one out. The one
 * exception is a database that has not run 0041, where there is no score to
 * read: then this is what it always was — every rating of the game,
 * downloaded and averaged — and says so (`basis: 'unweighted'`).
 */

/**
 * A game's ratings as the summary draws them.
 *
 * `average` is the community score **unrounded**: round it where it is drawn
 * (`clampScore`), and read the verdict off the rounded number, so the word
 * and the figure beside it can never disagree.
 */
export type RatingBreakdown = {
  /** Ten counts, lowest band first: the graph's 1–10 … 91–100. */
  buckets: number[];
  /** Distinct people who rated it — one rating each. */
  total: number;
  /** The community score, 0–100, unrounded. */
  average: number;
  /** The plain mean of the same ratings, for comparison. */
  rawMean: number;
  /** `weighted` from 0041; `unweighted` on a database before it. */
  basis: 'weighted' | 'unweighted';
};

/**
 * Whether `game_ratings` exists here: unknown until asked, false from the
 * first PGRST205 — after which this session goes straight to the plain mean
 * rather than spending a refused request on every game.
 */
let scoreTable: boolean | null = null;

function isMissingTable(error: { code?: string }): boolean {
  return error.code === 'PGRST205' || error.code === '42P01';
}

function isMissingFunction(error: { code?: string; message: string }): boolean {
  return error.code === 'PGRST202' || /could not find the function/i.test(error.message);
}

/**
 * One game's score and how its ratings divide, or `null` when nobody here
 * has rated it — an empty state, never a zero.
 *
 * Selects named columns, never `*`: `weight_sum` and `effective_raters` are
 * not granted to clients (0041 says why), and asking for them is refused.
 */
export async function getRatingBreakdown(gameId: string): Promise<RatingBreakdown | null> {
  if (scoreTable !== false) {
    const { data, error } = await supabase
      .from('game_ratings')
      .select('weighted_rating, raw_mean, raters, histogram')
      .eq('game_id', gameId)
      .maybeSingle();

    if (!error) {
      scoreTable = true;
      if (!data) return null;
      return {
        buckets: data.histogram,
        total: data.raters,
        average: Number(data.weighted_rating),
        rawMean: Number(data.raw_mean),
        basis: 'weighted',
      };
    }
    if (!isMissingTable(error)) throw new Error(error.message);
    scoreTable = false;
  }

  return unweightedBreakdown(gameId);
}

/** Before 0041: every rating of the game, averaged here, as it always was. */
async function unweightedBreakdown(gameId: string): Promise<RatingBreakdown | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('rating')
    .eq('game_id', gameId)
    .not('rating', 'is', null);
  if (error) throw new Error(error.message);

  const ratings = (data ?? [])
    .map((row) => row.rating)
    .filter((rating): rating is number => rating !== null);
  if (ratings.length === 0) return null;

  const mean = ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length;
  return {
    buckets: scoreHistogram(ratings),
    total: ratings.length,
    average: mean,
    rawMean: mean,
    basis: 'unweighted',
  };
}

// ---------------------------------------------------------------------------
// One's own influence
// ---------------------------------------------------------------------------

/** When the weights were last worked out, and whether they lag the ratings. */
export type RatingRecalculation = {
  recalculatedAt: string | null;
  /** Set only on a large app between recalculations; see 0041. */
  staleSince: string | null;
  /** People with enough comparisons for the deviation signal. */
  comparableRaters: number | null;
  version: number;
};

export type MyRatingInfluence = {
  /** Games they have rated now. */
  rated: number;
  /** As last computed; null when nothing has been yet — a full weight. */
  stats: RatingInfluence | null;
  state: RatingRecalculation | null;
  /** The server's parameters, which are the ones in force. */
  params: CommunityRatingConfig;
};

/**
 * The signed-in person's own statistics, and nobody else's (0041's
 * `my_rating_influence()`, which runs under `rater_stats`' own-row policy).
 * `null` on a database that has not run 0041.
 */
export async function getMyRatingInfluence(): Promise<MyRatingInfluence | null> {
  const { data, error } = await supabase.rpc('my_rating_influence');
  if (error) {
    if (isMissingFunction(error)) return null;
    throw new Error(error.message);
  }
  return {
    rated: Number(data.rated ?? 0),
    stats: data.stats ? influenceOf(data.stats) : null,
    state: data.state
      ? {
          recalculatedAt: data.state.recalculated_at,
          staleSince: data.state.stale_since,
          comparableRaters: data.state.comparable_raters,
          version: data.state.algorithm_version,
        }
      : null,
    params: data.params ?? COMMUNITY_RATING,
  };
}

function influenceOf(row: Omit<RaterStatsRow, 'user_id'>): RatingInfluence {
  return {
    ratedCount: row.rated_count,
    distribution: row.distribution,
    comparisons: row.comparison_count,
    deviationPercentile:
      row.deviation_percentile === null ? null : Number(row.deviation_percentile),
    lowEntropy: row.low_entropy,
    highDeviation: row.high_deviation,
    patternConfidence: Number(row.pattern_confidence),
    weight: Number(row.weight),
  };
}

// ---------------------------------------------------------------------------
// Moderators
// ---------------------------------------------------------------------------

/**
 * How the weighting is behaving across the app, in aggregate — no person's
 * statistics. Moderators only: the function refuses anybody else (42501),
 * and so does this. `null` before 0041.
 */
export async function getCommunityRatingReport(limit = 10): Promise<CommunityRatingReport | null> {
  const { data, error } = await supabase.rpc('community_rating_report', { p_limit: limit });
  if (error) {
    if (isMissingFunction(error)) return null;
    throw new Error(error.message);
  }
  return data;
}

/** Rebuild every weight and score from the canonical ratings. Moderators only. */
export async function recalculateCommunityRatings(): Promise<void> {
  const { error } = await supabase.rpc('recalculate_community_ratings');
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// After a rating changes
// ---------------------------------------------------------------------------

/**
 * Every query that holds a community score, by the first part of its key.
 *
 * All of them, not the one game's: a rating changes its rater's statistics,
 * and so the weight their ratings of *every other game* carry. Invalidating a
 * prefix refetches what is on screen now and marks the rest stale for its
 * next mount, so no list or page can keep showing an average from before.
 *
 * `game-ratings` is a game's raters, page by page (`ratings/[id]`),
 * `top-chart` Search's Top 1000 — whose GameLog order is these averages — and
 * `rating-distribution` the graph of a game's or a person's scores.
 */
export const COMMUNITY_RATING_QUERY_ROOTS = [
  'rating-distribution',
  'rating-breakdown',
  'review-stats',
  'beloved-games',
  'rating-influence',
  'rating-report',
  'game-ratings',
  'top-chart',
] as const;

export function invalidateCommunityRatings(queryClient: QueryClient): void {
  for (const root of COMMUNITY_RATING_QUERY_ROOTS) {
    void queryClient.invalidateQueries({ queryKey: [root] });
  }
}

// ---------------------------------------------------------------------------
// The distribution graph
// ---------------------------------------------------------------------------

/** The most scores one graph is drawn from — far past anything here today. */
const DISTRIBUTION_LIMIT = 5000;

/**
 * Every score given to a game, or by a person — the graph's rows
 * (`lib/rating-distribution`). Counted from the ratings themselves rather
 * than from 0041's `histogram`: that one's top band is 91–100, and the graph
 * keeps 100 apart from the 90s, as the owner's reference does. One column a
 * row, so it stays cheap; `logs` is public, as every review is.
 */
export async function getRatingDistribution(
  scope: { gameId: string } | { userId: string }
): Promise<number[]> {
  let query = supabase.from('logs').select('rating').not('rating', 'is', null);
  query = 'gameId' in scope ? query.eq('game_id', scope.gameId) : query.eq('user_id', scope.userId);
  const { data, error } = await query.range(0, DISTRIBUTION_LIMIT - 1);
  if (error) throw new Error(error.message);
  return distributionOf(
    (data ?? []).map((row) => row.rating).filter((rating): rating is number => rating !== null)
  );
}

// ---------------------------------------------------------------------------
// Everyone who rated a game
// ---------------------------------------------------------------------------

/** How a game's raters are ordered (`ratings/[id]`). */
export type GameRaterSort = 'newest' | 'highest' | 'lowest';

/** Raters on one page of a game's ratings. */
export const RATERS_PAGE_SIZE = 20;

/** One person's score for the game, and whether words came with it. */
export type GameRater = {
  logId: string;
  rating: number;
  status: LogStatus;
  /** They wrote a review (or its one sentence) — the row opens it. */
  wrote: boolean;
  /** When the log last changed: the nearest thing to when it was scored. */
  ratedAt: string;
  profile: Pick<Profile, 'id' | 'username' | 'display_name' | 'avatar_url'> | null;
};

/**
 * One page of everybody who gave a game a score — with a review or with a
 * log alone — and how many there are in all.
 *
 * The owner's request (2026-10-20): "a screen to see everyone who rated the
 * game either by written review or logging, page system". A rating is
 * `logs.rating`, whichever way it was entered, so this is every log of the
 * game with one: one request, the page's rows and an exact count together
 * (`count: 'exact'` with `range`), so the pager knows its last page from the
 * first answer.
 *
 * Newest is by `updated_at`, as "Beloved" reads a score's date (0037): a log
 * made as Playing and scored on finishing is the same row, weeks later. The
 * scores are the ones people gave, unweighted — the GameLog score over them
 * is weighted (0041), and this page is the list of people, not the average.
 */
export async function getGameRatersPage(
  gameId: string,
  sort: GameRaterSort,
  page: number
): Promise<{ raters: GameRater[]; total: number }> {
  const from = Math.max(0, page - 1) * RATERS_PAGE_SIZE;

  let query = supabase
    .from('logs')
    .select(
      'id, rating, status, review, review_title, updated_at, profile:profiles(id, username, display_name, avatar_url)',
      { count: 'exact' }
    )
    .eq('game_id', gameId)
    .not('rating', 'is', null);

  query =
    sort === 'newest'
      ? query.order('updated_at', { ascending: false })
      : query
          .order('rating', { ascending: sort === 'lowest' })
          .order('updated_at', { ascending: false });

  const { data, error, count } = await query
    .order('id', { ascending: true })
    .range(from, from + RATERS_PAGE_SIZE - 1);

  if (error) {
    /* Past the last row PostgREST answers 416 with no rows; that is an empty
       page, which the screen says in words. */
    if (error.code === 'PGRST103') return { raters: [], total: count ?? 0 };
    throw new Error(error.message);
  }

  const raters = (data ?? []).flatMap((row) =>
    row.rating === null
      ? []
      : [
          {
            logId: row.id,
            rating: row.rating,
            status: row.status,
            wrote: hasWriting(row),
            ratedAt: row.updated_at,
            profile: row.profile ?? null,
          },
        ]
  );
  return { raters, total: count ?? raters.length };
}
