import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { clampScore } from '../constants/score.ts';
import {
  COMMUNITY_RATING,
  aggregateRatings,
  assertValidRating,
  computeCommunityRatings,
  computeRaterStats,
  deviationPercentiles,
  entropyBands,
  entropyBucket,
  explainInfluence,
  isValidRating,
  normalizedEntropy,
  patternConfidence,
  raterDeviations,
  raterWeight,
  ratingDistribution,
  scoreHistogram,
  shannonEntropy,
  targetPenalty,
  type CommunityRatingConfig,
  type RatingRecord,
} from './community-rating.ts';

const C = COMMUNITY_RATING;
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');
const MIGRATION = read('../../supabase/migrations/0041_community_ratings.sql');

/** A small seeded generator, so a "random" fixture is the same on every run. */
function generator(seed: number) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** One person's ratings of games `g0`, `g1`… (or the games given). */
function person(userId: string, scores: readonly number[], games?: readonly string[]) {
  return scores.map((rating, index) => ({
    userId,
    gameId: games ? games[index] : `g${index}`,
    rating,
  }));
}

/** Records as a comparable value: sorted, plain. */
const plain = (result: ReturnType<typeof computeCommunityRatings>) => ({
  raters: [...result.raters.values()].sort((a, b) => a.userId.localeCompare(b.userId)),
  games: [...result.games.values()].sort((a, b) => a.gameId.localeCompare(b.gameId)),
});

/** A config with the deviation gates lowered, for looking at one mechanism at a time. */
const LOOSE: CommunityRatingConfig = {
  ...C,
  deviation: { ...C.deviation, minComparisons: 1, minPopulation: 1 },
};

/**
 * Forty-one people and thirty games everybody has rated: forty whose scores
 * are spread over 40–89 as tastes differ, and one more, `who`, rating each
 * game `score(game)`. Enough people with enough comparisons that the
 * deviation signal is available (population ≥ 40, comparisons ≥ 10).
 */
function crowd(who: string, score: (game: number) => number): RatingRecord[] {
  const records: RatingRecord[] = [];
  for (let user = 0; user < 40; user++) {
    for (let game = 0; game < 30; game++) {
      records.push({
        userId: `u${user}`,
        gameId: `g${game}`,
        rating: 40 + ((7 * user + 13 * game) % 50),
      });
    }
  }
  for (let game = 0; game < 30; game++)
    records.push({ userId: who, gameId: `g${game}`, rating: score(game) });
  return records;
}

// ---------------------------------------------------------------------------
// A. The calculation
// ---------------------------------------------------------------------------

describe('the community score', () => {
  it('is an empty state for a game nobody rated — never a zero', () => {
    assert.equal(aggregateRatings([]), null);
    assert.equal(computeCommunityRatings([]).games.size, 0);
  });

  it('is the rating itself when there is one', () => {
    const game = computeCommunityRatings([{ userId: 'a', gameId: 'g', rating: 73 }]).games.get(
      'g'
    )!;
    assert.equal(game.weightedRating, 73);
    assert.equal(game.rawMean, 73);
    assert.equal(game.raters, 1);
  });

  it('is that rating when everybody gives the same one', () => {
    const result = aggregateRatings([
      { rating: 64, weight: 1 },
      { rating: 64, weight: 0.85 },
      { rating: 64, weight: 0.7 },
    ])!;
    assert.equal(result.weightedRating, 64);
    assert.equal(result.raters, 3);
  });

  it('is the plain mean when the weights are equal', () => {
    const ratings = [90, 70, 40, 100, 15];
    for (const weight of [1, 0.85, 0.7]) {
      const result = aggregateRatings(ratings.map((rating) => ({ rating, weight })))!;
      assert.ok(Math.abs(result.weightedRating - result.rawMean) < 1e-12, `at ${weight}`);
      assert.equal(result.rawMean, 63);
    }
  });

  it('weights the mean when the weights differ', () => {
    // (90 × 1 + 50 × 0.7) / 1.7 = 125 / 1.7
    const result = aggregateRatings([
      { rating: 90, weight: 1 },
      { rating: 50, weight: 0.7 },
    ])!;
    assert.ok(Math.abs(result.weightedRating - 125 / 1.7) < 1e-12);
    assert.equal(result.rawMean, 70);
    assert.ok(Math.abs(result.weightSum - 1.7) < 1e-12);
    // (Σw)² / Σw² = 2.89 / 1.49
    assert.ok(Math.abs(result.effectiveRaters - 2.89 / 1.49) < 1e-12);
  });

  it('keeps every weight between 0.70 and 1.00, whatever the history', () => {
    for (let count = 0; count <= 200; count++) {
      for (const lowEntropy of [false, true]) {
        for (const highDeviation of [false, true]) {
          const weight = raterWeight(count, { lowEntropy, highDeviation });
          assert.ok(
            weight >= 0.7 && weight <= 1,
            `${count} ${lowEntropy} ${highDeviation}: ${weight}`
          );
        }
      }
    }
    const random = generator(7);
    const records: RatingRecord[] = [];
    for (let user = 0; user < 60; user++) {
      const count = 1 + Math.floor(random() * 50);
      const style = random();
      for (let game = 0; game < count; game++) {
        const rating = style < 0.3 ? 90 + Math.floor(random() * 11) : Math.floor(random() * 101);
        records.push({ userId: `u${user}`, gameId: `g${game}`, rating });
      }
    }
    for (const stats of computeRaterStats(records).values()) {
      assert.ok(stats.weight >= 0.7 && stats.weight <= 1, `${stats.userId}: ${stats.weight}`);
    }
  });

  it('never leaves the range of the ratings it averages', () => {
    const random = generator(42);
    for (let trial = 0; trial < 2000; trial++) {
      const contributions = Array.from({ length: 1 + Math.floor(random() * 12) }, () => ({
        rating: Math.floor(random() * 101),
        weight: 0.7 + Math.round(random() * 300) / 1000,
      }));
      const result = aggregateRatings(contributions)!;
      const exact =
        contributions.reduce((sum, c) => sum + c.rating * c.weight, 0) /
        contributions.reduce((sum, c) => sum + c.weight, 0);
      assert.ok(
        result.weightedRating >= result.minRating && result.weightedRating <= result.maxRating
      );
      // The clamp only ever absorbs floating-point drift, never a wrong formula.
      assert.ok(Math.abs(result.weightedRating - exact) < 1e-9);
    }
  });

  it('is not rounded: rounding belongs to the screen', () => {
    const result = aggregateRatings([
      { rating: 90, weight: 1 },
      { rating: 50, weight: 0.7 },
    ])!;
    assert.ok(!Number.isInteger(result.weightedRating), 'the stored score keeps its decimals');
    assert.equal(clampScore(result.weightedRating), 74, 'and the screen rounds it, once');
    const game = computeCommunityRatings([
      ...person('a', [91]),
      ...person('b', [80]),
      ...person('c', [80]),
    ]).games.get('g0')!;
    assert.ok(Math.abs(game.weightedRating - 251 / 3) < 1e-12);
  });

  it('refuses a rating that is not a whole number on the scale', () => {
    for (const bad of [101, -1, 50.5, Number.NaN, Infinity, '50', null, undefined]) {
      assert.equal(isValidRating(bad), false, String(bad));
      assert.throws(() => assertValidRating(bad), RangeError);
    }
    for (const good of [0, 1, 50, 99, 100]) assert.equal(isValidRating(good), true);
    assert.throws(() => aggregateRatings([{ rating: 101, weight: 1 }]), RangeError);
    assert.throws(() => computeRaterStats([{ userId: 'a', gameId: 'g', rating: 7.5 }]), RangeError);
  });

  it('refuses two current ratings of one game by one person', () => {
    assert.throws(
      () =>
        computeCommunityRatings([
          { userId: 'a', gameId: 'g', rating: 80 },
          { userId: 'a', gameId: 'g', rating: 20 },
        ]),
      /one current rating/
    );
  });

  it('refuses a weight this method could not have produced', () => {
    assert.throws(() => aggregateRatings([{ rating: 80, weight: 0 }]), RangeError);
    assert.throws(() => aggregateRatings([{ rating: 80, weight: 0.69 }]), RangeError);
    assert.throws(() => aggregateRatings([{ rating: 80, weight: 1.25 }]), RangeError);
    assert.throws(() => aggregateRatings([{ rating: 80, weight: Number.NaN }]), RangeError);
  });

  it('answers the same for the same ratings, in any order, every time', () => {
    const records = crowd('z', (game) => 5 + (game % 10));
    const once = plain(computeCommunityRatings(records));
    const random = generator(3);
    const shuffled = [...records].sort(() => random() - 0.5);
    assert.deepEqual(plain(computeCommunityRatings(shuffled)), once);
    assert.deepEqual(plain(computeCommunityRatings(records)), once);
  });
});

// ---------------------------------------------------------------------------
// B. New members
// ---------------------------------------------------------------------------

describe('a new member', () => {
  it('counts in full from their first rating', () => {
    const result = computeCommunityRatings([
      ...person('veteran', [60]),
      ...person('newcomer', [100]),
    ]);
    assert.equal(result.raters.get('newcomer')!.weight, 1);
    assert.equal(result.games.get('g0')!.weightedRating, 80);
  });

  it('is never adjusted at ten ratings or fewer, however alike they are', () => {
    for (let count = 1; count <= 10; count++) {
      const stats = computeRaterStats(person('n', new Array(count).fill(100))).get('n')!;
      assert.equal(stats.weight, 1, `${count} ratings`);
      assert.equal(stats.lowEntropy, false, `${count} identical ratings are not yet a pattern`);
      assert.equal(stats.patternConfidence, 0);
      assert.equal(stats.normalizedEntropy, 0);
    }
    assert.equal(raterWeight(10, { lowEntropy: true, highDeviation: true }), 1);
  });

  it('is adjusted gradually after that — a little per rating, never a step', () => {
    let previous = 1;
    for (let count = 10; count <= 40; count++) {
      const weight = computeRaterStats(person('n', new Array(count).fill(95))).get('n')!.weight;
      const step = previous - weight;
      assert.ok(step >= 0 && step <= 0.0075 + 1e-12, `${count}: ${previous} → ${weight}`);
      previous = weight;
    }
    assert.equal(computeRaterStats(person('n', new Array(11).fill(95))).get('n')!.weight, 0.9925);
    assert.equal(computeRaterStats(person('n', new Array(20).fill(95))).get('n')!.weight, 0.925);
    assert.equal(previous, 0.85, 'low entropy alone ends at 0.85');
    for (let count = 10; count < 30; count++) {
      const before = raterWeight(count, { lowEntropy: true, highDeviation: true });
      const after = raterWeight(count + 1, { lowEntropy: true, highDeviation: true });
      assert.ok(before - after <= 0.015 + 1e-12, 'the combined penalty grows as smoothly');
    }
  });

  it('needs no account age, no reviews and no minimum number of ratings', () => {
    const bare = person('n', [70]);
    const decorated = bare.map((record) => ({
      ...record,
      createdAt: '2026-10-20T00:00:00Z',
      accountCreatedAt: '2026-10-20T00:00:00Z',
      review: null,
      followers: 0,
    }));
    assert.deepEqual(
      plain(computeCommunityRatings(decorated)),
      plain(computeCommunityRatings(bare))
    );
    assert.equal(computeRaterStats(bare).get('n')!.weight, 1);
  });

  it('gains nothing from volume, and loses nothing for it', () => {
    for (const count of [11, 30, 300]) {
      const scores = Array.from({ length: count }, (_, index) => (index * 37) % 101);
      const stats = computeRaterStats(person('n', scores)).get('n')!;
      assert.equal(stats.weight, 1, `${count} spread-out ratings`);
    }
    assert.equal(raterWeight(100000, { lowEntropy: false, highDeviation: false }), 1);
  });
});

// ---------------------------------------------------------------------------
// C. Inactivity
// ---------------------------------------------------------------------------

describe('inactivity', () => {
  const ratings = person('away', [95, 96, 97, 98, 99, 100, 95, 96, 97, 98, 99, 100, 95, 96]);

  it('changes no weight: logins, activity and dates are not inputs', () => {
    const now = plain(computeCommunityRatings(ratings));
    for (const extra of [
      { lastLogin: '2019-01-01T00:00:00Z' },
      { lastActivityAt: '2010-06-01T00:00:00Z', updatedAt: '2010-06-01T00:00:00Z' },
      { lastLogin: new Date().toISOString(), daysSinceActive: 4000 },
    ]) {
      const later = ratings.map((record) => ({ ...record, ...extra }));
      assert.deepEqual(plain(computeCommunityRatings(later)), now);
    }
  });

  it('keeps an inactive member’s ratings in every score they were part of', () => {
    const result = computeCommunityRatings([
      ...person('away', [90], ['shared']),
      ...person('here', [60], ['shared']),
      ...person('here', [61, 62, 63], ['b', 'c', 'd']),
    ]);
    assert.equal(result.raters.get('away')!.weight, 1);
    assert.equal(result.games.get('shared')!.weightedRating, 75);
  });

  it('is not something this module could read: it has no clock', () => {
    const source = read('./community-rating.ts');
    assert.ok(!/Date\.now|new Date|performance\.now/.test(source));
  });

  it('is not something 0041 reads either: no dates in the weighting, no scheduled job', () => {
    const recalculation = between(
      MIGRATION,
      'create or replace function public._recalculate_community_ratings()',
      'get diagnostics v_raters_written'
    );
    const refresh = between(
      MIGRATION,
      'create or replace function public._refresh_game_ratings',
      'get diagnostics v_written'
    );
    for (const [name, body] of [
      ['the recalculation', recalculation],
      ['the refresh', refresh],
    ] as const) {
      const sql = withoutComments(body);
      assert.ok(
        !/created_at|updated_at|last_sign_in|last_login|interval|age\(|clock_timestamp|review/.test(
          sql.replace(/computed_at|v_started\s+constant timestamptz := clock_timestamp\(\)/g, '')
        ),
        `${name} reads nothing but the ratings`
      );
    }
    assert.ok(!/cron\.schedule/.test(withoutComments(MIGRATION)), 'no job is scheduled');
  });

  it('lets a changed rating change the statistics — the one thing that may', () => {
    const before = computeRaterStats(person('n', new Array(30).fill(90))).get('n')!;
    const spread = new Array(30).fill(90).map((score, index) => (index % 5) * 20 + 5);
    const after = computeRaterStats(person('n', spread)).get('n')!;
    assert.equal(before.weight, 0.85);
    assert.equal(after.weight, 1);
  });
});

// ---------------------------------------------------------------------------
// D. Entropy and deviation
// ---------------------------------------------------------------------------

describe('entropy', () => {
  it('is zero when every rating is in one band', () => {
    assert.equal(shannonEntropy(ratingDistribution([80, 85, 90, 100])), 0);
    assert.equal(normalizedEntropy([0, 0, 0, 0, 12]), 0);
  });

  it('is positive when more than one band is used, and grows with the spread', () => {
    const two = shannonEntropy(ratingDistribution([10, 90]));
    const five = shannonEntropy(ratingDistribution([10, 30, 50, 70, 90]));
    assert.equal(two, 1);
    assert.ok(Math.abs(five - Math.log2(5)) < 1e-12);
    assert.ok(five > two && two > 0);
    assert.ok(Math.abs(normalizedEntropy(ratingDistribution([10, 30, 50, 70, 90])) - 1) < 1e-12);
  });

  it('stays between 0 and 1 once normalised', () => {
    const random = generator(11);
    for (let trial = 0; trial < 500; trial++) {
      const counts = Array.from({ length: 5 }, () => Math.floor(random() * 20));
      const value = normalizedEntropy(counts);
      assert.ok(value >= 0 && value <= 1, String(counts));
    }
  });

  it('handles empty bands, no ratings, and refuses nonsense rather than answering NaN', () => {
    assert.equal(shannonEntropy([]), 0);
    assert.equal(shannonEntropy([0, 0, 0, 0, 0]), 0);
    assert.equal(normalizedEntropy([]), 0);
    assert.equal(normalizedEntropy([3]), 0);
    assert.throws(() => shannonEntropy([1, -1]), RangeError);
    assert.throws(() => shannonEntropy([Number.NaN]), RangeError);
  });

  it('reads the 0–100 scale as five fixed bands of 20', () => {
    assert.deepEqual(
      [0, 19, 20, 39, 40, 59, 60, 79, 80, 99, 100].map((rating) => entropyBucket(rating)),
      [0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 4]
    );
    assert.deepEqual(entropyBands(), [
      { from: 0, to: 19 },
      { from: 20, to: 39 },
      { from: 40, to: 59 },
      { from: 60, to: 79 },
      { from: 80, to: 100 },
    ]);
  });
});

describe('deviation', () => {
  it('compares a rating with the others’ mean, leaving the rater out', () => {
    // Others gave 50, 50 and 50; with the rater's own 100 the mean would be 62.5.
    const records = [
      ...person('me', [100], ['g']),
      ...person('a', [50], ['g']),
      ...person('b', [50], ['g']),
      ...person('c', [50], ['g']),
    ];
    const mine = raterDeviations(records, LOOSE).get('me')!;
    assert.equal(mine.comparisons, 1);
    assert.equal(mine.averageDeviation, 0.5);
    // a's others are 100, 50, 50: a mean of 66.67, a distance of 16.67 points.
    assert.equal(raterDeviations(records, LOOSE).get('a')!.averageDeviation, 0.166667);
  });

  it('does not compare a game too few other people rated', () => {
    const records = [
      ...person('me', [100], ['g']),
      ...person('a', [10], ['g']),
      ...person('b', [10], ['g']),
    ];
    const mine = raterDeviations(records, LOOSE).get('me')!;
    assert.equal(mine.comparisons, 0, 'two others is not enough to disagree with');
    assert.equal(mine.averageDeviation, null);
  });

  it('is unavailable below ten comparisons, and unavailable is never high', () => {
    // z rates nine of the crowd's games, every one far from everybody else.
    const others = crowd('nobody', () => 50).filter((record) => record.userId !== 'nobody');
    const stats = computeRaterStats([...others, ...person('z', new Array(9).fill(5))]).get('z')!;
    assert.equal(stats.comparisons, 9);
    assert.equal(stats.averageDeviation, null);
    assert.equal(stats.deviationPercentile, null);
    assert.equal(stats.highDeviation, false);
  });

  it('ranks nobody until forty people can be compared', () => {
    const averages = new Map(Array.from({ length: 39 }, (_, index) => [`u${index}`, index / 100]));
    assert.equal(deviationPercentiles(averages).size, 0, 'with 39, nobody is ranked');
    averages.set('u39', 0.99);
    const percentiles = deviationPercentiles(averages);
    assert.equal(percentiles.get('u39'), 100);
    assert.equal(percentiles.get('u38'), 97.435897, 'the second-highest of forty is below 97.5');
    assert.equal(percentiles.get('u0'), 0);
  });

  it('puts tied averages at the lower place', () => {
    const averages = new Map(
      Array.from({ length: 40 }, (_, index) => [`u${index}`, index < 38 ? index / 100 : 0.9])
    );
    const percentiles = deviationPercentiles(averages);
    assert.equal(percentiles.get('u38'), percentiles.get('u39'));
    assert.ok(percentiles.get('u39')! < 97.5, 'two people tied at the top are not "the top 2.5%"');
  });
});

describe('the weight', () => {
  it('is untouched by high deviation alone', () => {
    const contrarian = crowd('z', (game) => [0, 25, 50, 75, 100][game % 5]);
    const stats = computeRaterStats(contrarian).get('z')!;
    assert.equal(stats.highDeviation, true, 'z is the most different person here');
    assert.equal(stats.lowEntropy, false);
    assert.equal(stats.targetPenalty, 0);
    assert.equal(stats.weight, 1);
  });

  it('is lowered a little by low entropy alone', () => {
    const fan = computeRaterStats(person('fan', new Array(30).fill(100))).get('fan')!;
    assert.equal(fan.lowEntropy, true);
    assert.equal(fan.highDeviation, false, 'no comparisons: the signal is unavailable');
    assert.equal(fan.targetPenalty, 0.15);
    assert.equal(fan.weight, 0.85);
  });

  it('is lowered more by both together', () => {
    const stats = computeRaterStats(crowd('z', () => 5)).get('z')!;
    assert.equal(stats.lowEntropy, true);
    assert.equal(stats.highDeviation, true);
    assert.equal(stats.targetPenalty, 0.3);
    assert.equal(stats.weight, 0.7);
  });

  it('is never zero, even under a config that asks for more than everything', () => {
    const harsh: CommunityRatingConfig = { ...C, penalty: { lowEntropy: 5, combined: 9 } };
    assert.equal(raterWeight(30, { lowEntropy: true, highDeviation: true }, harsh), 0.7);
    assert.equal(targetPenalty({ lowEntropy: false, highDeviation: true }), 0);
    assert.equal(patternConfidence(-5), 0);
    assert.equal(patternConfidence(1000), 1);
  });

  it('treats someone who loves almost everything with the same modest restraint as someone who loves nothing', () => {
    const lover = computeRaterStats(
      person(
        'lover',
        new Array(40).fill(0).map((_, i) => 90 + (i % 11))
      )
    ).get('lover')!;
    const critic = computeRaterStats(
      person(
        'critic',
        new Array(40).fill(0).map((_, i) => i % 20)
      )
    ).get('critic')!;
    for (const stats of [lover, critic]) {
      assert.equal(stats.weight, 0.85, `${stats.userId}: the low-entropy adjustment, and no more`);
      assert.equal(stats.highDeviation, false);
    }
    // Ten ratings in, either of them still counts in full.
    for (const scores of [new Array(10).fill(100), new Array(10).fill(0)]) {
      assert.equal(computeRaterStats(person('early', scores)).get('early')!.weight, 1);
    }
  });

  it('does not take disagreement on niche games as evidence of anything', () => {
    // Every game `indie` rates has one other player: nothing to compare against.
    const records: RatingRecord[] = [];
    for (let game = 0; game < 40; game++) {
      records.push({
        userId: 'indie',
        gameId: `niche${game}`,
        rating: [3, 97, 50, 12, 88][game % 5],
      });
      records.push({ userId: `other${game}`, gameId: `niche${game}`, rating: 50 });
    }
    const stats = computeRaterStats(records).get('indie')!;
    assert.equal(stats.comparisons, 0);
    assert.equal(stats.highDeviation, false);
    assert.equal(stats.weight, 1);
  });
});

// ---------------------------------------------------------------------------
// The graph's bands, and saying a weight
// ---------------------------------------------------------------------------

describe('the ratings graph', () => {
  it('keeps the bands the graph has always drawn — 0 with 1–10', () => {
    assert.deepEqual(scoreHistogram([0, 10, 11, 20, 55, 91, 100]), [2, 2, 0, 0, 0, 1, 0, 0, 0, 2]);
  });
});

describe('explaining a weight to its owner', () => {
  const words = (explanation: { headline: string; details: string[] }) =>
    [explanation.headline, ...explanation.details].join(' ');

  it('says a first rating counts in full', () => {
    assert.match(explainInfluence(0, null).details[0], /first rating will count in full/);
    assert.equal(explainInfluence(4, null).headline, 'Your ratings count in full.');
    assert.match(words(explainInfluence(4, null)), /more than 10 games/);
  });

  it('says what the pattern is, in numbers, and how far the adjustment goes', () => {
    const stats = computeRaterStats(person('fan', new Array(20).fill(95))).get('fan')!;
    const explanation = explainInfluence(20, stats);
    assert.equal(explanation.headline, 'Your ratings count at 93% of the usual weight.');
    assert.match(words(explanation), /20 of your 20 ratings are between 80 and 100/);
    assert.match(words(explanation), /from your 11th rating to your 30th/);
    assert.match(words(explanation), /never count for less than 70%/);
  });

  it('never calls anybody anything', () => {
    const cases = [
      explainInfluence(0, null),
      explainInfluence(30, computeRaterStats(person('fan', new Array(30).fill(100))).get('fan')!),
      explainInfluence(30, computeRaterStats(crowd('z', () => 5)).get('z')!),
      explainInfluence(
        30,
        computeRaterStats(crowd('z', (g) => [0, 25, 50, 75, 100][g % 5])).get('z')!
      ),
    ];
    for (const explanation of cases) {
      assert.ok(
        !/abus|suspicious|untrust|bad user|fraud|cheat|manipulat|spam|fake/i.test(
          words(explanation)
        ),
        words(explanation)
      );
    }
  });
});

// ---------------------------------------------------------------------------
// The migration says what this module says
// ---------------------------------------------------------------------------

describe('migration 0041', () => {
  it('holds the same parameters', () => {
    const literal = /community_rating_params\(\)[\s\S]*?select '(\{[\s\S]*?\})'::jsonb/.exec(
      MIGRATION
    );
    assert.ok(literal, 'the parameters are one JSON literal');
    assert.deepEqual(JSON.parse(literal[1]), COMMUNITY_RATING);
  });

  it('holds the weight to the same floor and ceiling in the table itself', () => {
    const check = /weight\s+numeric not null check \(weight between ([\d.]+) and ([\d.]+)\)/.exec(
      MIGRATION
    );
    assert.ok(check);
    assert.equal(Number(check[1]), C.weight.min);
    assert.equal(Number(check[2]), C.weight.max);
  });

  it('agrees with the rating scale logs.rating has had since 0004', () => {
    const scale = /check \(rating is null or rating between (\d+) and (\d+)\)/.exec(
      read('../../supabase/migrations/0004_long_form_reviews.sql')
    );
    assert.ok(scale);
    assert.deepEqual([Number(scale[1]), Number(scale[2])], [C.scale.min, C.scale.max]);
  });

  it('grants no client a weight sum, and no client any write', () => {
    const grant = /grant select \(([^)]*)\)\s+on public\.game_ratings/.exec(MIGRATION);
    assert.ok(grant);
    assert.ok(!/weight_sum|effective_raters/.test(grant[1]));
    assert.ok(
      !/grant (insert|update|delete|all)[^;]*(rater_stats|game_ratings|community_rating_state)/i.test(
        MIGRATION
      )
    );
    assert.ok(
      !/create policy[^;]*for (insert|update|delete|all)/i.test(withoutComments(MIGRATION))
    );
  });
});

describe('the screens', () => {
  /** Every source file under `src/`, tests and the test kit aside. */
  function sources(directory: URL): { path: string; text: string }[] {
    const files: { path: string; text: string }[] = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const url = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, directory);
      if (entry.isDirectory()) {
        if (entry.name !== 'testkit') files.push(...sources(url));
      } else if (/\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name)) {
        files.push({ path: url.pathname.split('/src/')[1], text: readFileSync(url, 'utf8') });
      }
    }
    return files;
  }
  const SRC = sources(new URL('../', import.meta.url));

  it('read one aggregate: nobody but the ratings API averages raw ratings', () => {
    const averaging = SRC.filter(({ text }) => /\.select\(\s*'rating'\s*\)/.test(text)).map(
      ({ path }) => path
    );
    assert.deepEqual(
      averaging,
      ['lib/api/ratings.ts'],
      'only the pre-0041 fallback reads bare ratings'
    );
  });

  it('read it under one key, so every screen shares one answer', () => {
    for (const { path, text } of SRC) {
      if (path === 'lib/api/ratings.ts' || !text.includes('getRatingBreakdown(')) continue;
      assert.match(
        text,
        /queryKey: \['rating-breakdown', \w+!?\]/,
        `${path} asks for the score under its key`
      );
    }
  });
});

/** The text of `source` from `start` up to `end`. */
function between(source: string, start: string, end: string): string {
  const from = source.indexOf(start);
  const to = source.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `${start} … ${end}`);
  return source.slice(from, to);
}

/** SQL without its `--` comments. */
function withoutComments(sql: string): string {
  return sql.replace(/--.*$/gm, '');
}
