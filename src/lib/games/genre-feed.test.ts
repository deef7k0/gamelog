import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { feedFor, sameView } from '../home-view.ts';
import { genreFeed } from './genre-feed.ts';
import {
  BASIC_FLOOR,
  MOOD_FLOOR,
  atClock,
  moodWhere,
  quickPicksWhere,
  shelfSort,
  shelfWhere,
} from './moods.ts';

const shooter = genreFeed({ id: 5, label: 'Shooter' });

describe('genreFeed', () => {
  it('leads with the best rated, then what is new, as the owner asked', () => {
    assert.deepEqual(
      shooter.shelves.map((shelf) => shelf.title),
      [
        'Best rated',
        'New releases',
        'Most played',
        'Coming soon',
        'Better with friends',
        'Hidden gems',
        'Classics',
        'Indie picks',
      ]
    );
    assert.equal(shooter.strapline, 'SHOOTER');
    assert.equal(shooter.id, 'genre:5');
  });

  it('asks every shelf about the genre', () => {
    for (const shelf of shooter.shelves) assert.match(shelf.where, /genres = [([]5\b/);
  });

  it('orders the shelves that are not about reach', () => {
    const sort = Object.fromEntries(shooter.shelves.map((shelf) => [shelf.key, shelfSort(shelf)]));
    assert.equal(sort.best, 'total_rating desc');
    assert.equal(sort.new, 'first_release_date desc');
    assert.equal(sort.soon, 'hypes desc');
    assert.equal(sort.popular, 'total_rating_count desc');
  });

  it('asks no ratings of a game that is new or not out yet', () => {
    const floor = Object.fromEntries(
      shooter.shelves.map((shelf) => [shelf.key, shelfWhere(shelf)])
    );
    assert.ok(floor.new.endsWith(BASIC_FLOOR) && !floor.new.includes('total_rating >= 70'));
    assert.ok(floor.soon.endsWith(BASIC_FLOOR));
    assert.ok(floor.best.endsWith(MOOD_FLOOR));
  });

  it('draws Quick picks and the studio from the whole genre', () => {
    assert.ok(moodWhere(shooter).startsWith('(genres = (5)) & '));
    assert.ok(quickPicksWhere(shooter).includes('total_rating_count >= 100'));
  });

  it('has no "Indie picks" for Indie itself', () => {
    const indie = genreFeed({ id: 32, label: 'Indie' });
    assert.ok(!indie.shelves.some((shelf) => shelf.key === 'indie'));
  });
});

describe('atClock', () => {
  it('puts the time in when the request is made, and days before it', () => {
    const now = 1_800_000_000;
    assert.equal(
      atClock('a <= @now & b >= @now-120d', now),
      `a <= ${now} & b >= ${now - 120 * 86_400}`
    );
  });

  it('leaves a clause with no clock alone', () => {
    assert.equal(atClock('genres = (5)', 1), 'genres = (5)');
  });

  it('leaves no token behind in any genre shelf', () => {
    for (const shelf of shooter.shelves)
      assert.ok(!atClock(shelf.where, 1_800_000_000).includes('@'));
  });
});

describe('the Home view', () => {
  it('is no feed on All, a mood’s or a genre’s otherwise', () => {
    assert.equal(feedFor({ kind: 'all' }), null);
    assert.equal(feedFor({ kind: 'mood', mood: 'relax' })?.id, 'mood:relax');
    assert.equal(feedFor({ kind: 'genre', genre: { id: 5, label: 'Shooter' } })?.id, 'genre:5');
  });

  it('knows a genre by its id, not its label', () => {
    assert.ok(
      sameView(
        { kind: 'genre', genre: { id: 5, label: 'Shooter' } },
        { kind: 'genre', genre: { id: 5, label: 'Shooters' } }
      )
    );
    assert.ok(!sameView({ kind: 'mood', mood: 'relax' }, { kind: 'mood', mood: 'sad' }));
    assert.ok(!sameView({ kind: 'all' }, { kind: 'mood', mood: 'relax' }));
  });
});
