import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CommunitySimilarGame } from '../lib/database.types.ts';
import { agreementLine, supportLine, topReasons } from './similarity.ts';

type Counts = Pick<CommunitySimilarGame, 'suggesters' | 'agreers'>;

describe('supportLine', () => {
  it('says who suggested and who agreed', () => {
    assert.equal(
      supportLine({ suggesters: 3, agreers: 12 }),
      '3 users suggested this game, with 12 users agreeing.'
    );
    assert.equal(
      supportLine({ suggesters: 1, agreers: 1 }),
      '1 user suggested this game, with 1 user agreeing.'
    );
  });

  it('does not claim agreement nobody gave', () => {
    assert.equal(
      supportLine({ suggesters: 1, agreers: 0 }),
      '1 user suggested this game, with no one else agreeing yet.'
    );
  });

  it('says nothing when the database predates 0030', () => {
    // The shape that crashed the sheet: the columns simply absent from the row.
    assert.equal(supportLine({} as Counts), null);
    assert.equal(supportLine({ suggesters: null, agreers: null }), null);
    assert.equal(supportLine({ suggesters: 2, agreers: null }), null);
  });
});

describe('agreementLine', () => {
  it('is the share of people who weighed in', () => {
    assert.equal(agreementLine({ up: 12, votes: 15 }), '12 of 15 agree');
  });

  it('says so when only the suggester has voted', () => {
    assert.equal(agreementLine({ up: 1, votes: 1 }), 'Only its suggester so far');
  });
});

describe('topReasons', () => {
  it('orders by how many gave each, then by name, three at most', () => {
    assert.deepEqual(topReasons({ tone: 2, combat: 5, story: 2, genre: 1 }), [
      'combat',
      'story',
      'tone',
    ]);
  });
});
