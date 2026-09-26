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

  it('rounds to a whole score', () => {
    const [progress] = reviewBreakdown(
      stats({ groups: { ...stats({}).groups, finished: { count: 3, sum: 274 } } }),
      FAMILIES,
      familyOf
    );
    assert.equal(progress.rows[0].average, 91);
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
