/**
 * GameLog's community score: a weighted average of every rating here, and the
 * statistics that set each rater's weight.
 *
 * ## Where the authority is
 *
 * The numbers the app shows are computed in Postgres, by migration 0041
 * (`_recalculate_community_ratings`, `_refresh_game_ratings`), from the
 * canonical ratings in `logs` — never on the phone, and never from anything the
 * phone sends except the rating itself. **This module is the same algorithm in
 * TypeScript**: the specification `community-rating.test.ts` holds, the
 * reference `scripts/community-rating-sql.mjs` checks the SQL against, and what
 * `scripts/community-rating-report.mjs` runs over a copy of the live ratings
 * for a dry run. Nothing in the app computes a community score with it; the
 * screens use it only to put a stored weight into words.
 *
 * ## The algorithm, in the order it runs
 *
 * 1. **Every rating counts.** One current rating per person per game
 *    (`logs`' unique key), 0–100, whole numbers. A rating is never dropped and
 *    no weight is ever zero.
 * 2. **How spread out a person's ratings are** — Shannon entropy over five
 *    fixed 20-point bands (0–19, 20–39, 40–59, 60–79, 80–100), divided by
 *    log₂ 5 so it reads 0 (every rating in one band) to 1 (evenly spread).
 *    Five bands because the brief's 0.15 threshold comes from a five-point
 *    scale, and 20 points is one star of one.
 * 3. **How far a person's ratings sit from everybody else's** — for each
 *    rating, its distance from the mean of the *other* people's ratings of
 *    that game (the person's own is left out), over the range of the scale.
 *    Only games with at least three other raters are compared, and only
 *    people with ten such comparisons have an average. The comparison means
 *    are plain means, so no weight ever feeds back into a weight: one pass,
 *    no iteration.
 * 4. **Where that distance ranks** — a percentile among the people who have
 *    an average, ties at the lower place, and only once there are forty of
 *    them: with fewer, "the top 2.5%" is less than one person, and any rule
 *    would flag whoever happened to be most different.
 * 5. **Two signals.** Low entropy: more than ten ratings, normalised entropy
 *    under 0.15. High deviation: a percentile of 97.5 or more.
 * 6. **A target penalty**: 0.15 for low entropy alone, 0.30 for both, nothing
 *    otherwise — so disagreeing with everybody, on its own, costs nothing.
 * 7. **Confidence**, which grows from nothing at ten ratings to all of it at
 *    thirty, and **the weight**: `max(0.70, 1 − confidence × penalty)`, never
 *    above 1.00. Ten ratings or fewer is always 1.00.
 * 8. **The game's score**: `Σ rating × weight / Σ weight` over its raters,
 *    with the plain mean beside it for comparison. A person with no stats yet
 *    counts at 1.00.
 *
 * Nothing reads a date, a login, a review, a follower count or an account's
 * age: the inputs are `(person, game, rating)` and nothing else, which
 * `RatingRecord` makes a matter of types rather than of discipline.
 *
 * Statistics are rounded to six decimals before any threshold or ranking reads
 * them (`roundTo`), in both implementations, so a threshold decision does not
 * depend on the order a database happened to add numbers in. The score itself
 * is never rounded here: rounding is for the screen (`clampScore`).
 */

/** Every tunable number, in one place. Migration 0041 holds the same object. */
export type CommunityRatingConfig = {
  /** Bumped whenever any number here, or the method, changes. */
  readonly version: number;
  /** The rating scale, `logs.rating`'s CHECK. */
  readonly scale: { readonly min: number; readonly max: number };
  readonly entropy: {
    /** Width of one band, in points. */
    readonly bucketWidth: number;
    readonly buckets: number;
    /** Normalised entropy under this is a low-entropy profile. */
    readonly lowThreshold: number;
  };
  readonly confidence: {
    /** At or below this many ratings, no adjustment of any kind. */
    readonly from: number;
    /** At this many, the adjustment is all there. */
    readonly full: number;
  };
  readonly deviation: {
    /** Other people who must have rated a game before it is a comparison. */
    readonly minOtherRaters: number;
    /** Comparisons a person needs before their average is used. */
    readonly minComparisons: number;
    /** People with an average needed before anybody is ranked. */
    readonly minPopulation: number;
    /** A percentile at or above this is high deviation. */
    readonly highPercentile: number;
  };
  readonly penalty: { readonly lowEntropy: number; readonly combined: number };
  readonly weight: { readonly min: number; readonly max: number };
  /** Decimals every statistic is rounded to before it is compared. */
  readonly precision: number;
  /**
   * Up to this many ratings, a change recalculates everything in the same
   * transaction; above it, the changed games only, and the weights catch up
   * later (see 0041). When the work happens, never what it computes: neither
   * of these two is part of the algorithm.
   */
  readonly syncFullRecalculationMaxRatings: number;
  /** Above the limit, how long weights may lag before a save recalculates them. */
  readonly staleRecalculationMinutes: number;
};

/**
 * The parameters in force. Every one is a starting hypothesis, not a measured
 * optimum: the five the brief named (10, 30, 0.15, 97.5, the penalties and the
 * floor) are carried over from analyses of a music site's ratings and have not
 * been validated on a game community; the rest are this implementation's.
 */
export const COMMUNITY_RATING: CommunityRatingConfig = {
  version: 1,
  scale: { min: 0, max: 100 },
  entropy: { bucketWidth: 20, buckets: 5, lowThreshold: 0.15 },
  confidence: { from: 10, full: 30 },
  deviation: { minOtherRaters: 3, minComparisons: 10, minPopulation: 40, highPercentile: 97.5 },
  penalty: { lowEntropy: 0.15, combined: 0.3 },
  weight: { min: 0.7, max: 1 },
  precision: 6,
  syncFullRecalculationMaxRatings: 5000,
  staleRecalculationMinutes: 15,
};

/** One canonical rating: who, of what, and the score. Deliberately nothing else. */
export type RatingRecord = {
  readonly userId: string;
  readonly gameId: string;
  /** 0–100, a whole number. */
  readonly rating: number;
};

export type RaterSignals = { lowEntropy: boolean; highDeviation: boolean };

/** What 0041 stores in `rater_stats` for one person, camel-cased. */
export type RaterStats = RaterSignals & {
  userId: string;
  /** Distinct games rated: every one of their ratings. */
  ratedCount: number;
  /** Ratings per band, lowest band first. */
  distribution: number[];
  /** Shannon entropy of `distribution`, in bits. */
  entropy: number;
  /** `entropy` over log₂ of the number of bands: 0 to 1. */
  normalizedEntropy: number;
  /** Ratings of games with enough other raters to compare against. */
  comparisons: number;
  /** Mean distance from the others, over the scale's range — null below `minComparisons`. */
  averageDeviation: number | null;
  /** 0–100 among the people with an average — null when they are too few, or this one has none. */
  deviationPercentile: number | null;
  patternConfidence: number;
  targetPenalty: number;
  weight: number;
  version: number;
};

/** What 0041 stores in `game_ratings` for one game, camel-cased. */
export type GameAggregate = {
  gameId: string;
  /** The community score: `Σ rating × weight / Σ weight`. Unrounded. */
  weightedRating: number;
  /** The plain mean, for comparison. Unrounded. */
  rawMean: number;
  /** Distinct people who rated it. */
  raters: number;
  weightSum: number;
  /** `(Σ w)² / Σ w²` — a diagnostic, not a head count. */
  effectiveRaters: number;
  minRating: number;
  maxRating: number;
  /** The ten bands the ratings graph draws (1–10 … 91–100, 0 in the first). */
  histogram: number[];
};

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

/** A whole number on the scale — what `logs_rating_check` admits. */
export function isValidRating(
  value: unknown,
  config: CommunityRatingConfig = COMMUNITY_RATING
): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= config.scale.min &&
    value <= config.scale.max
  );
}

export function assertValidRating(
  value: unknown,
  config: CommunityRatingConfig = COMMUNITY_RATING
): asserts value is number {
  if (!isValidRating(value, config)) {
    throw new RangeError(
      `A rating is a whole number from ${config.scale.min} to ${config.scale.max}, not ${String(value)}.`
    );
  }
}

/** Valid ratings, and one per person per game — the shape `logs` guarantees. */
export function assertCanonical(
  records: readonly RatingRecord[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): void {
  const seen = new Set<string>();
  for (const record of records) {
    assertValidRating(record.rating, config);
    const key = `${record.userId}\u0000${record.gameId}`;
    if (seen.has(key)) {
      throw new RangeError(
        `${record.userId} rated ${record.gameId} twice: a person has one current rating of a game.`
      );
    }
    seen.add(key);
  }
}

/**
 * The ratings in one fixed order — by person, then game, compared as code
 * points rather than by locale — so every sum below adds the same numbers in
 * the same order whatever order they arrived in. Floating-point addition is
 * not associative; 0041 sums in `numeric`, which is exact, and needs no such
 * care.
 */
export function canonicalOrder(records: readonly RatingRecord[]): RatingRecord[] {
  const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
  return [...records].sort((a, b) => compare(a.userId, b.userId) || compare(a.gameId, b.gameId));
}

/**
 * Half up at `digits` decimals — what Postgres's `round(numeric, int)` does to
 * a positive number. Applied to statistics, never to a score on its way to
 * the screen.
 */
export function roundTo(value: number, digits = COMMUNITY_RATING.precision): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

// ---------------------------------------------------------------------------
// Entropy
// ---------------------------------------------------------------------------

/** Which band a rating falls in: 0–19 is 0, …, 80–100 is 4. */
export function entropyBucket(rating: number, config: CommunityRatingConfig = COMMUNITY_RATING) {
  assertValidRating(rating, config);
  return Math.min(
    Math.floor((rating - config.scale.min) / config.entropy.bucketWidth),
    config.entropy.buckets - 1
  );
}

/** The bands as ranges of scores, for saying them: `{ from: 80, to: 100 }`. */
export function entropyBands(config: CommunityRatingConfig = COMMUNITY_RATING) {
  const { bucketWidth, buckets } = config.entropy;
  return Array.from({ length: buckets }, (_, band) => ({
    from: config.scale.min + band * bucketWidth,
    to: band === buckets - 1 ? config.scale.max : config.scale.min + (band + 1) * bucketWidth - 1,
  }));
}

/** How many of these ratings fall in each band, lowest first. */
export function ratingDistribution(
  ratings: readonly number[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): number[] {
  const counts = new Array<number>(config.entropy.buckets).fill(0);
  for (const rating of ratings) counts[entropyBucket(rating, config)] += 1;
  return counts;
}

/**
 * `H = −Σ pₖ log₂ pₖ` over the bands anybody is in, in bits.
 *
 * Zero for no ratings at all and for every rating in one band; a band with
 * nobody in it adds nothing. A count that is negative or not a number is a
 * caller's mistake and throws, rather than turning into a NaN that a threshold
 * would read as "not low".
 */
export function shannonEntropy(counts: readonly number[]): number {
  let total = 0;
  for (const count of counts) {
    if (!Number.isFinite(count) || count < 0) {
      throw new RangeError(`A count is zero or more, not ${String(count)}.`);
    }
    total += count;
  }
  if (total === 0) return 0;

  let bits = 0;
  for (const count of counts) {
    if (count === 0) continue;
    const share = count / total;
    bits -= share * Math.log2(share);
  }
  return Math.max(0, bits);
}

/** `H / log₂ K`: 0 when every rating is in one band, 1 when they are spread evenly. */
export function normalizedEntropy(counts: readonly number[]): number {
  if (counts.length < 2) return 0;
  return Math.min(1, shannonEntropy(counts) / Math.log2(counts.length));
}

// ---------------------------------------------------------------------------
// Deviation
// ---------------------------------------------------------------------------

export type DeviationSummary = {
  comparisons: number;
  /** Null below `minComparisons`: unavailable, which is never read as high. */
  averageDeviation: number | null;
};

/**
 * Each person's mean distance from everybody else, game by game.
 *
 * For a rating `r` of a game with `n` ratings summing to `S`, the others' mean
 * is `(S − r) / (n − 1)` — the person is never compared with themselves — and
 * the distance is `|r − that| / range`. A game counts only when `n − 1` is at
 * least `minOtherRaters`, so a niche game with two players is not evidence of
 * anything, and somebody who mostly plays those simply has fewer comparisons.
 */
export function raterDeviations(
  records: readonly RatingRecord[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): Map<string, DeviationSummary> {
  const range = config.scale.max - config.scale.min;

  const games = new Map<string, { count: number; sum: number }>();
  for (const { gameId, rating } of records) {
    const game = games.get(gameId) ?? { count: 0, sum: 0 };
    game.count += 1;
    game.sum += rating;
    games.set(gameId, game);
  }

  const totals = new Map<string, { comparisons: number; sum: number }>();
  for (const { userId, gameId, rating } of records) {
    const total = totals.get(userId) ?? { comparisons: 0, sum: 0 };
    const game = games.get(gameId)!;
    const others = game.count - 1;
    if (others >= config.deviation.minOtherRaters) {
      const othersMean = (game.sum - rating) / others;
      total.comparisons += 1;
      total.sum += Math.abs(rating - othersMean) / range;
    }
    totals.set(userId, total);
  }

  const summaries = new Map<string, DeviationSummary>();
  for (const [userId, { comparisons, sum }] of totals) {
    summaries.set(userId, {
      comparisons,
      averageDeviation:
        comparisons >= config.deviation.minComparisons
          ? roundTo(sum / comparisons, config.precision)
          : null,
    });
  }
  return summaries;
}

/**
 * Where each average sits among the others, 0–100 — Postgres's
 * `percent_rank() × 100`: the share of the *other* people strictly below.
 * Tied averages share the lower place. Empty below `minPopulation`.
 */
export function deviationPercentiles(
  averages: ReadonlyMap<string, number>,
  config: CommunityRatingConfig = COMMUNITY_RATING
): Map<string, number> {
  const population = averages.size;
  const percentiles = new Map<string, number>();
  if (population < config.deviation.minPopulation || population === 0) return percentiles;

  const sorted = [...averages.values()].sort((a, b) => a - b);
  for (const [userId, average] of averages) {
    const below = lowerBound(sorted, average);
    const rank = population === 1 ? 0 : below / (population - 1);
    percentiles.set(userId, roundTo(rank * 100, config.precision));
  }
  return percentiles;
}

/** How many values in an ascending array are strictly less than `value`. */
function lowerBound(sorted: readonly number[], value: number): number {
  let low = 0;
  let high = sorted.length;
  while (low < high) {
    const middle = (low + high) >> 1;
    if (sorted[middle] < value) low = middle + 1;
    else high = middle;
  }
  return low;
}

// ---------------------------------------------------------------------------
// Weight
// ---------------------------------------------------------------------------

/**
 * How much of an adjustment the evidence supports: nothing at `from` ratings
 * or fewer, all of it at `full`, a straight line between. Never a penalty in
 * itself — it only scales one — and more ratings never push a weight past 1.
 */
export function patternConfidence(
  ratedCount: number,
  config: CommunityRatingConfig = COMMUNITY_RATING
): number {
  const { from, full } = config.confidence;
  return Math.min(1, Math.max(0, (ratedCount - from) / (full - from)));
}

/** The brief's table: deviation alone is free; entropy alone 0.15; both 0.30. */
export function targetPenalty(
  { lowEntropy, highDeviation }: RaterSignals,
  config: CommunityRatingConfig = COMMUNITY_RATING
): number {
  if (lowEntropy && highDeviation) return config.penalty.combined;
  if (lowEntropy) return config.penalty.lowEntropy;
  return 0;
}

/** `max(min, 1 − confidence × penalty)`, held to [min, max] and six decimals. */
export function raterWeight(
  ratedCount: number,
  signals: RaterSignals,
  config: CommunityRatingConfig = COMMUNITY_RATING
): number {
  const weight = 1 - patternConfidence(ratedCount, config) * targetPenalty(signals, config);
  return roundTo(
    Math.min(config.weight.max, Math.max(config.weight.min, weight)),
    config.precision
  );
}

/**
 * Every person's statistics and weight, from the canonical ratings alone.
 *
 * Deterministic: the same ratings give the same answer in any order, at any
 * time. A person appears once they have rated one game; somebody who has
 * rated nothing has no statistics and would count at the maximum weight.
 */
export function computeRaterStats(
  input: readonly RatingRecord[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): Map<string, RaterStats> {
  assertCanonical(input, config);
  const records = canonicalOrder(input);

  const ratingsBy = new Map<string, number[]>();
  for (const { userId, rating } of records) {
    const ratings = ratingsBy.get(userId) ?? [];
    ratings.push(rating);
    ratingsBy.set(userId, ratings);
  }

  const deviations = raterDeviations(records, config);
  const averages = new Map<string, number>();
  for (const [userId, { averageDeviation }] of deviations) {
    if (averageDeviation !== null) averages.set(userId, averageDeviation);
  }
  const percentiles = deviationPercentiles(averages, config);

  const stats = new Map<string, RaterStats>();
  for (const userId of [...ratingsBy.keys()].sort()) {
    const ratings = ratingsBy.get(userId)!;
    const distribution = ratingDistribution(ratings, config);
    const bits = shannonEntropy(distribution);
    const normalized = roundTo(bits / Math.log2(config.entropy.buckets), config.precision);
    const deviation = deviations.get(userId)!;
    const percentile = percentiles.get(userId) ?? null;

    const signals: RaterSignals = {
      lowEntropy:
        ratings.length > config.confidence.from && normalized < config.entropy.lowThreshold,
      highDeviation: percentile !== null && percentile >= config.deviation.highPercentile,
    };

    stats.set(userId, {
      userId,
      ratedCount: ratings.length,
      distribution,
      entropy: roundTo(bits, config.precision),
      normalizedEntropy: normalized,
      comparisons: deviation.comparisons,
      averageDeviation: deviation.averageDeviation,
      deviationPercentile: percentile,
      ...signals,
      patternConfidence: roundTo(patternConfidence(ratings.length, config), config.precision),
      targetPenalty: targetPenalty(signals, config),
      weight: raterWeight(ratings.length, signals, config),
      version: config.version,
    });
  }
  return stats;
}

// ---------------------------------------------------------------------------
// The game's score
// ---------------------------------------------------------------------------

/** The ten bands the ratings graph draws: 1–10 is 0 (and 0 with it), 91–100 is 9. */
export function scoreBand(rating: number): number {
  assertValidRating(rating);
  return Math.max(0, Math.ceil(rating / 10) - 1);
}

/** Ratings per graph band, lowest first. */
export function scoreHistogram(ratings: readonly number[]): number[] {
  const bands = new Array<number>(10).fill(0);
  for (const rating of ratings) bands[scoreBand(rating)] += 1;
  return bands;
}

export type Contribution = { readonly rating: number; readonly weight: number };

/**
 * One game's score from its raters' ratings and weights, or null when nobody
 * has rated it — an empty state, never a zero.
 *
 * Every weight must be one this method can produce: a weight from anywhere
 * else is refused, which is the TypeScript half of "a client cannot supply a
 * weight". The score is a convex combination of the ratings, so it lies
 * between the lowest and the highest of them; it is held there against the
 * last bit of floating-point drift.
 */
export function aggregateRatings(
  contributions: readonly Contribution[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): Omit<GameAggregate, 'gameId'> | null {
  if (contributions.length === 0) return null;

  let weighted = 0;
  let weightSum = 0;
  let squares = 0;
  let sum = 0;
  let minRating = Infinity;
  let maxRating = -Infinity;
  const ratings: number[] = [];

  for (const { rating, weight } of contributions) {
    assertValidRating(rating, config);
    if (!(weight >= config.weight.min && weight <= config.weight.max)) {
      throw new RangeError(
        `A weight is from ${config.weight.min} to ${config.weight.max}, not ${String(weight)}.`
      );
    }
    weighted += rating * weight;
    weightSum += weight;
    squares += weight * weight;
    sum += rating;
    minRating = Math.min(minRating, rating);
    maxRating = Math.max(maxRating, rating);
    ratings.push(rating);
  }

  return {
    weightedRating: Math.min(maxRating, Math.max(minRating, weighted / weightSum)),
    rawMean: sum / contributions.length,
    raters: contributions.length,
    weightSum,
    effectiveRaters: (weightSum * weightSum) / squares,
    minRating,
    maxRating,
    histogram: scoreHistogram(ratings),
  };
}

/**
 * The whole recalculation: every person's weight, then every game's score —
 * what 0041's `_recalculate_community_ratings()` writes, from the same input.
 */
export function computeCommunityRatings(
  input: readonly RatingRecord[],
  config: CommunityRatingConfig = COMMUNITY_RATING
): { raters: Map<string, RaterStats>; games: Map<string, GameAggregate> } {
  const raters = computeRaterStats(input, config);

  const byGame = new Map<string, Contribution[]>();
  for (const { userId, gameId, rating } of canonicalOrder(input)) {
    const contributions = byGame.get(gameId) ?? [];
    contributions.push({ rating, weight: raters.get(userId)?.weight ?? config.weight.max });
    byGame.set(gameId, contributions);
  }

  const games = new Map<string, GameAggregate>();
  for (const gameId of [...byGame.keys()].sort()) {
    const aggregate = aggregateRatings(byGame.get(gameId)!, config);
    if (aggregate) games.set(gameId, { gameId, ...aggregate });
  }
  return { raters, games };
}

// ---------------------------------------------------------------------------
// Saying it
// ---------------------------------------------------------------------------

/** What a person's own page is told about their ratings: 0041's `my_rating_influence()`. */
export type RatingInfluence = Pick<
  RaterStats,
  | 'ratedCount'
  | 'distribution'
  | 'comparisons'
  | 'deviationPercentile'
  | 'lowEntropy'
  | 'highDeviation'
  | 'patternConfidence'
  | 'weight'
>;

/** A weight as the share of a full rating it is: 0.9025 → 90. */
export function weightPercent(weight: number): number {
  return Math.round(weight * 100);
}

/**
 * A person's weight, explained to that person — in words that describe a
 * pattern in numbers and never the person: nothing here says "unreliable",
 * "suspicious" or anything like it, because a pattern is not an intention.
 *
 * `rated` is their live count of ratings; `stats` is what was last computed,
 * or null when nothing has been yet (which means a full weight).
 */
export function explainInfluence(
  rated: number,
  stats: RatingInfluence | null,
  config: CommunityRatingConfig = COMMUNITY_RATING
): { headline: string; details: string[] } {
  const { from, full } = config.confidence;
  const games = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'game' : 'games'}`;

  if (rated === 0) {
    return {
      headline: 'You haven’t rated a game yet.',
      details: ['Your first rating will count in full, like everybody’s.'],
    };
  }

  const weight = stats?.weight ?? config.weight.max;
  if (weight >= config.weight.max) {
    const detail =
      rated <= from
        ? `Patterns are only looked at once somebody has rated more than ${from} games. You’ve rated ${games(rated)}.`
        : !stats
          ? 'Nothing has been worked out from your ratings yet, and until it is they count in full.'
          : stats.highDeviation
            ? 'You often score games differently from the people here. Disagreeing never changes a weight on its own.'
            : 'They’re spread across the scale, so nothing is adjusted.';
    return { headline: 'Your ratings count in full.', details: [detail] };
  }

  const details: string[] = [];
  const distribution = stats?.distribution ?? [];
  const busiest = distribution.reduce(
    (best, count, band) => (count > distribution[best] ? band : best),
    0
  );
  const band = entropyBands(config)[busiest];
  const inBand = distribution[busiest] ?? 0;
  const counted = distribution.reduce((sum, n) => sum + n, 0);

  if (stats?.lowEntropy && band) {
    details.push(
      `${inBand.toLocaleString()} of your ${counted.toLocaleString()} ratings are between ${band.from} and ${band.to}. When scores rarely vary, each one says a little less about how one game compares with another, so they count slightly less.`
    );
  }
  if (stats?.highDeviation) {
    details.push(
      'They’re also further from other players’ scores of the same games than almost anyone’s here. That alone would change nothing; together with the first, it lowers the weight a little more.'
    );
  }
  if ((stats?.patternConfidence ?? 0) < 1) {
    details.push(
      `The adjustment builds up gradually from your ${ordinal(from + 1)} rating to your ${ordinal(full)} — you’ve rated ${games(rated)}.`
    );
  }
  details.push(
    `However your ratings are spread, they never count for less than ${weightPercent(config.weight.min)}%. This isn’t a judgement of your taste — rate games the way you always do.`
  );

  return {
    headline: `Your ratings count at ${weightPercent(weight)}% of the usual weight.`,
    details,
  };
}

/** 11 → "11th", 22 → "22nd", 30 → "30th". */
function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}
