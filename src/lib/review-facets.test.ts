import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { GameLog, GameReviewStats } from './database.types.ts';
import {
  platformFacets,
  reviewBreakdown,
  reviewContext,
  reviewFilterClauses,
} from './review-facets.ts';

const FAMILIES = [
  { key: 'pc', name: 'PC' },
  { key: 'playstation', name: 'PlayStation' },
  { key: 'xbox', name: 'Xbox' },
];
const KEYS: Record<string, string> = {
  PC: 'pc',
  PS4: 'playstation',
  PS5: 'playstation',
  XBOX: 'xbox',
};
const familyOf = (value: string) => KEYS[value] ?? null;

const EMPTY = { count: 0, sum: 0 };

function stats(overrides: Partial<GameReviewStats>): GameReviewStats {
  return {
    count: 0,
    sum: 0,
    groups: {
      finished: EMPTY,
      full: EMPTY,
      playing: EMPTY,
      dropped: EMPTY,
      solo: EMPTY,
      coop: EMPTY,
    },
    platforms: [],
    written_platforms: [],
    ...overrides,
  };
}

describe('reviewFilterClauses', () => {
  it('sends nothing when nothing is chosen', () => {
    assert.deepEqual(reviewFilterClauses({}), []);
    assert.deepEqual(reviewFilterClauses({ platforms: null, progress: null, play: null }), []);
  });

  it('keeps an empty platform list, which matches nothing', () => {
    assert.deepEqual(reviewFilterClauses({ platforms: [] }), [{ kind: 'platform', values: [] }]);
  });

  it('counts a platinum as finished and as 100%', () => {
    assert.deepEqual(reviewFilterClauses({ progress: 'finished' }), [
      { kind: 'completion', levels: ['story', 'main', 'full'] },
    ]);
    assert.deepEqual(reviewFilterClauses({ progress: 'full' }), [
      { kind: 'completion', levels: ['full'] },
    ]);
  });

  it('reads playing as playing or paused', () => {
    assert.deepEqual(reviewFilterClauses({ progress: 'playing' }), [
      { kind: 'status', values: ['playing', 'paused'] },
    ]);
  });

  it('narrows to a language only when one is chosen', () => {
    /* No language is every language, unlabelled reviews included: a game's
       own reviews are never narrowed unless the reader asks (0038). */
    assert.deepEqual(reviewFilterClauses({ language: null }), []);
    assert.deepEqual(reviewFilterClauses({ language: 'es' }), [{ kind: 'language', value: 'es' }]);
    assert.deepEqual(reviewFilterClauses({ minScore: 80, language: 'ja' }), [
      { kind: 'score', bound: 'min', value: 80 },
      { kind: 'language', value: 'ja' },
    ]);
  });

  it('composes every filter into one list', () => {
    assert.deepEqual(
      reviewFilterClauses({
        platforms: ['PS4', 'PS5'],
        minScore: 80,
        progress: 'dropped',
        play: 'solo',
      }),
      [
        { kind: 'platform', values: ['PS4', 'PS5'] },
        { kind: 'score', bound: 'min', value: 80 },
        { kind: 'status', values: ['dropped'] },
        { kind: 'flag', column: 'coop', value: false },
      ]
    );
  });
});

describe('platformFacets', () => {
  it('groups stored spellings into families, in family order, Other last', () => {
    assert.deepEqual(platformFacets(['XBOX', 'PS5', 'Amiga', 'PS4'], FAMILIES, familyOf), [
      { key: 'playstation', label: 'PlayStation', values: ['PS5', 'PS4'] },
      { key: 'xbox', label: 'Xbox', values: ['XBOX'] },
      { key: 'other', label: 'Other', values: ['Amiga'] },
    ]);
  });

  it('puts a family this list does not know under Other', () => {
    assert.deepEqual(
      platformFacets(['iPhone'], FAMILIES, () => 'ios'),
      [{ key: 'other', label: 'Other', values: ['iPhone'] }]
    );
  });

  it('offers nothing for a game nobody named a platform on', () => {
    assert.deepEqual(platformFacets([], FAMILIES, familyOf), []);
  });
});

describe('reviewBreakdown', () => {
  it('merges sums across a family before averaging', () => {
    const [platform] = reviewBreakdown(
      stats({
        platforms: [
          { platform: 'PS5', count: 3, sum: 270 },
          { platform: 'PS4', count: 1, sum: 50 },
        ],
      }),
      FAMILIES,
      familyOf
    );
    // (270 + 50) / 4 = 80. Averaging the averages (90, 50) would say 70.
    assert.deepEqual(platform.rows, [
      { key: 'playstation', label: 'PlayStation', count: 4, average: 80 },
    ]);
  });

  it('keeps the decimals: the badge rounds where it is drawn', () => {
    const [progress] = reviewBreakdown(
      stats({ groups: { ...stats({}).groups, finished: { count: 3, sum: 274 } } }),
      FAMILIES,
      familyOf
    );
    assert.ok(Math.abs(progress.rows[0].average - 274 / 3) < 1e-12);
  });

  it('uses a group’s weighted mean when the database sends one (0041)', () => {
    const [progress] = reviewBreakdown(
      stats({
        groups: { ...stats({}).groups, finished: { count: 2, sum: 140, weighted_mean: 73.5 } },
      }),
      FAMILIES,
      familyOf
    );
    assert.equal(progress.rows[0].average, 73.5);
  });

  it('folds weighted platforms into a family by their shares of the weight, exactly', () => {
    // PS5: 90 at weight 1 and 50 at 0.7; PS4: 80 at weight 1. Total weight 2.7.
    // The family's weighted mean is (90 + 35 + 80) / 2.7.
    const [platform] = reviewBreakdown(
      stats({
        platforms: [
          {
            platform: 'PS5',
            count: 2,
            sum: 140,
            weighted_mean: 125 / 1.7,
            weight_share: 1.7 / 2.7,
          },
          { platform: 'PS4', count: 1, sum: 80, weighted_mean: 80, weight_share: 1 / 2.7 },
        ],
      }),
      FAMILIES,
      familyOf
    );
    assert.equal(platform.rows[0].count, 3);
    assert.ok(Math.abs(platform.rows[0].average - 205 / 2.7) < 1e-9);
  });

  it('falls back to the plain mean when any platform has no share', () => {
    const [platform] = reviewBreakdown(
      stats({
        platforms: [
          { platform: 'PS5', count: 2, sum: 140, weighted_mean: 70, weight_share: 0.5 },
          { platform: 'PS4', count: 2, sum: 100 },
        ],
      }),
      FAMILIES,
      familyOf
    );
    assert.equal(platform.rows[0].average, 60);
  });

  it('leaves out rows and sections with nobody in them', () => {
    const sections = reviewBreakdown(
      stats({ groups: { ...stats({}).groups, coop: { count: 2, sum: 170 } } }),
      FAMILIES,
      familyOf
    );
    assert.deepEqual(
      sections.map((section) => [section.key, section.rows.map((r) => r.label)]),
      [['play', ['Co-op']]]
    );
  });

  it('is empty for a game with no ratings', () => {
    assert.deepEqual(reviewBreakdown(stats({}), FAMILIES, familyOf), []);
  });
});

describe('reviewContext', () => {
  type Context = Pick<GameLog, 'status' | 'completion' | 'platinum' | 'coop' | 'player_count'>;
  const log = (overrides: Partial<Context>): Context => ({
    status: 'played',
    completion: null,
    platinum: false,
    coop: null,
    player_count: null,
    ...overrides,
  });

  it('says how far and how, when both were given', () => {
    assert.equal(
      reviewContext(log({ completion: 'story', coop: true, player_count: 4 })),
      'Completed · 4-player co-op'
    );
    assert.equal(
      reviewContext(log({ completion: 'main', coop: false })),
      'Completed + extras · Solo'
    );
    assert.equal(reviewContext(log({ status: 'dropped', coop: true })), 'Dropped · Co-op');
  });

  it('reads a platinum as 100%', () => {
    assert.equal(reviewContext(log({ platinum: true })), '100%');
  });

  it('says nothing that was not said', () => {
    assert.equal(reviewContext(log({})), null, 'played, and no play type');
    assert.equal(reviewContext(log({ coop: false })), 'Solo');
  });
});
