import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ADULT_KEYWORDS,
  MOODS,
  MOOD_FLOOR,
  MOOD_KEYS,
  QUICK_PICKS_FLOOR,
  distinctShelves,
  isMoodKey,
  moodFor,
  moodStudio,
  moodWhere,
  quickPicksFor,
  quickPicksWhere,
  shelfWhere,
} from './moods.ts';

/** Brackets balance and never close before they open — a clause IGDB can parse. */
function balanced(clause: string): boolean {
  let depth = 0;
  for (const char of clause) {
    if (char === '(' || char === '[') depth += 1;
    if (char === ')' || char === ']') depth -= 1;
    if (depth < 0) return false;
  }
  return depth === 0;
}

describe('the vocabulary', () => {
  it('is SimpMusic’s ten, in its order', () => {
    assert.deepEqual(
      MOODS.map((mood) => mood.key),
      [
        'relax',
        'sleep',
        'energize',
        'sad',
        'romance',
        'feelgood',
        'workout',
        'party',
        'commute',
        'focus',
      ]
    );
    assert.deepEqual(
      [...MOOD_KEYS],
      MOODS.map((mood) => mood.key)
    );
  });

  it('names Sleep "Wind down" — a game is not something to fall asleep to', () => {
    assert.equal(moodFor('sleep').label, 'Wind down');
  });

  it('gives every mood a strapline in capitals and at least four shelves', () => {
    for (const mood of MOODS) {
      assert.equal(mood.strapline, mood.strapline.toUpperCase(), mood.key);
      assert.ok(mood.shelves.length >= 4, `${mood.key} has ${mood.shelves.length}`);
    }
  });

  it('keeps YouTube’s own straplines and lead shelves where it has them', () => {
    assert.equal(moodFor('relax').strapline, 'FOR RELAXING');
    assert.equal(moodFor('relax').shelves[0].title, 'Unwind + explore');
    assert.equal(moodFor('energize').strapline, 'BOOSTING YOUR ENERGY');
    assert.equal(moodFor('energize').shelves[0].title, 'Power boost');
    assert.equal(moodFor('feelgood').strapline, 'FOR FEELING GOOD');
    assert.equal(moodFor('workout').strapline, 'FOR YOUR WORKOUT');
    assert.equal(moodFor('focus').strapline, 'STAYING FOCUSED');
    assert.equal(moodFor('romance').shelves[0].title, 'Sweethearts & romance');
  });

  it('has unique shelf keys within a mood — they are query keys', () => {
    for (const mood of MOODS) {
      const keys = mood.shelves.map((shelf) => shelf.key);
      assert.equal(new Set(keys).size, keys.length, mood.key);
    }
  });

  it('writes every clause so IGDB can parse it', () => {
    for (const mood of MOODS) {
      for (const shelf of mood.shelves) {
        const where = shelfWhere(shelf);
        assert.ok(balanced(where), `${mood.key}/${shelf.key}`);
        assert.ok(!where.includes(';'), `${mood.key}/${shelf.key} ends the clause early`);
      }
      assert.ok(balanced(moodWhere(mood)), mood.key);
      assert.ok(balanced(quickPicksWhere(mood)), mood.key);
    }
  });

  it('never negates a keyword by name — a dotted field’s != is "has some other one"', () => {
    for (const mood of MOODS) {
      for (const shelf of mood.shelves) {
        assert.ok(!/keywords\.name\s*!=/.test(shelf.where), `${mood.key}/${shelf.key}`);
      }
    }
    assert.ok(!/keywords\.name\s*!=/.test(MOOD_FLOOR));
  });

  it('stands every shelf on the floor: games, with covers, rated, never erotic', () => {
    assert.match(MOOD_FLOOR, /themes != \(42\)/);
    assert.match(MOOD_FLOOR, new RegExp(`keywords != \\(${ADULT_KEYWORDS.join(',')}\\)`));
    assert.match(MOOD_FLOOR, /cover != null/);
    assert.match(MOOD_FLOOR, /version_parent = null/);
    for (const mood of MOODS) {
      for (const shelf of mood.shelves) assert.ok(shelfWhere(shelf).endsWith(MOOD_FLOOR));
    }
  });

  it('asks Quick picks for games more people rated, from any shelf of the mood', () => {
    const mood = moodFor('party');
    const where = quickPicksWhere(mood);
    assert.ok(where.endsWith(QUICK_PICKS_FLOOR));
    for (const shelf of mood.shelves) assert.ok(where.includes(`(${shelf.where})`));
    assert.equal((where.match(/ \| /g) ?? []).length, mood.shelves.length - 1);
  });

  it('shuts horror out of every calm mood', () => {
    for (const key of ['relax', 'sleep', 'feelgood'] as const) {
      for (const shelf of moodFor(key).shelves) {
        if (shelf.key === 'everyone' || shelf.key === 'joy') continue;
        assert.match(shelf.where, /themes != \([^)]*\b19\b/, `${key}/${shelf.key}`);
      }
    }
  });

  it('tells a mood key from anything else', () => {
    assert.ok(isMoodKey('relax'));
    assert.ok(!isMoodKey('all'));
    assert.ok(!isMoodKey(undefined));
  });
});

const game = (id: number, title = `Game ${id}`) => ({ id: `igdb:${id}`, title });

describe('distinctShelves', () => {
  it('drops from each shelf what a shelf above it already shows', () => {
    const shown = distinctShelves(
      [
        [game(1), game(2), game(3), game(4)],
        [game(2), game(5), game(6), game(7), game(8)],
      ],
      10,
      4
    );
    assert.deepEqual(
      shown.map((shelf) => shelf.map((entry) => entry.id)),
      [
        ['igdb:1', 'igdb:2', 'igdb:3', 'igdb:4'],
        ['igdb:5', 'igdb:6', 'igdb:7', 'igdb:8'],
      ]
    );
  });

  it('treats a remake that kept its name as the same game', () => {
    const [shelf] = distinctShelves(
      [
        [
          game(1, 'Shadow of the Colossus'),
          game(2, 'shadow of the colossus '),
          game(3),
          game(4),
          game(5),
        ],
      ],
      10,
      0
    );
    assert.deepEqual(
      shelf.map((entry) => entry.id),
      ['igdb:1', 'igdb:3', 'igdb:4', 'igdb:5']
    );
  });

  it('empties a shelf left too short, and lets the next keep what it would have taken', () => {
    const shown = distinctShelves(
      [
        [game(1), game(2), game(3), game(4)],
        [game(1), game(2), game(9)],
        [game(9), game(10), game(11), game(12)],
      ],
      10,
      4
    );
    assert.deepEqual(shown[1], []);
    assert.deepEqual(
      shown[2].map((entry) => entry.id),
      ['igdb:9', 'igdb:10', 'igdb:11', 'igdb:12']
    );
  });

  it('cuts a shelf to its size', () => {
    const many = Array.from({ length: 18 }, (_, index) => game(index));
    assert.equal(distinctShelves([many], 10, 4)[0].length, 10);
  });
});

describe('quickPicksFor', () => {
  it('leaves out what this person already logged, and the same game twice', () => {
    const picks = quickPicksFor(
      [game(1), game(2), game(3, 'Game 1'), game(4)],
      new Set(['igdb:2']),
      20
    );
    assert.deepEqual(
      picks.map((entry) => entry.id),
      ['igdb:1', 'igdb:4']
    );
  });

  it('stops at its size', () => {
    const many = Array.from({ length: 40 }, (_, index) => game(index));
    assert.equal(quickPicksFor(many, new Set(), 20).length, 20);
  });
});

describe('moodStudio', () => {
  const credit = (company: number, developer = true) => ({ company, developer });

  it('is the developer that made the most of the mood’s games', () => {
    const studio = moodStudio([
      { id: 1, involved_companies: [credit(7), credit(99, false)] },
      { id: 2, involved_companies: [credit(8)] },
      { id: 3, involved_companies: [credit(7)] },
      { id: 4, involved_companies: [credit(7), credit(8)] },
      { id: 5, involved_companies: [credit(8)] },
      { id: 6, involved_companies: [credit(8)] },
    ]);
    assert.deepEqual(studio, { companyId: 8, gameIds: [2, 4, 5, 6] });
  });

  it('never crowns a publisher — "Nintendo" would win every mood', () => {
    const studio = moodStudio(
      [1, 2, 3, 4].map((id) => ({ id, involved_companies: [credit(70, false), credit(id)] }))
    );
    assert.equal(studio, null);
  });

  it('counts a game once however many rows credit the studio', () => {
    const studio = moodStudio(
      [
        { id: 1, involved_companies: [credit(7), credit(7)] },
        { id: 2, involved_companies: [credit(7)] },
      ],
      3
    );
    assert.equal(studio, null);
  });

  it('breaks a tie toward the studio whose games came first — the better known', () => {
    const studio = moodStudio(
      [
        { id: 1, involved_companies: [credit(5)] },
        { id: 2, involved_companies: [credit(6)] },
        { id: 3, involved_companies: [credit(5)] },
        { id: 4, involved_companies: [credit(6)] },
        { id: 5, involved_companies: [credit(5)] },
        { id: 6, involved_companies: [credit(6)] },
      ],
      3
    );
    assert.equal(studio?.companyId, 5);
  });
});
