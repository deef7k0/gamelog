import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sortGames } from './sort.ts';

const games = [
  { title: 'Bravo', releaseYear: 2020, releaseDate: '2020-11-10', score: 70 },
  { title: 'Alpha', releaseYear: 2020, releaseDate: '2020-03-01', score: 90 },
  { title: 'Delta', releaseYear: null, score: null },
  { title: 'Charlie', releaseYear: 2015, score: 90 },
];

const titles = (list: { title: string }[]) => list.map((game) => game.title);

describe('sortGames', () => {
  it('leaves the default order alone, and never sorts in place', () => {
    const sorted = sortGames(games, 'default');
    assert.deepEqual(titles(sorted), ['Bravo', 'Alpha', 'Delta', 'Charlie']);
    assert.notEqual(sorted, games);
  });

  it('orders by the day within a year, not by the title', () => {
    assert.deepEqual(titles(sortGames(games, 'newest')), ['Bravo', 'Alpha', 'Charlie', 'Delta']);
    assert.deepEqual(titles(sortGames(games, 'oldest')), ['Charlie', 'Alpha', 'Bravo', 'Delta']);
  });

  it('falls back to the year for a game with no date', () => {
    const mixed = [
      { title: 'Dated', releaseYear: 2020, releaseDate: '2020-06-01', score: null },
      { title: 'Year only', releaseYear: 2021, score: null },
    ];
    assert.deepEqual(titles(sortGames(mixed, 'newest')), ['Year only', 'Dated']);
  });

  it('puts a missing value last in either direction', () => {
    assert.equal(titles(sortGames(games, 'newest')).at(-1), 'Delta');
    assert.equal(titles(sortGames(games, 'oldest')).at(-1), 'Delta');
    assert.equal(titles(sortGames(games, 'rating')).at(-1), 'Delta');
  });

  it('breaks a tie on the title', () => {
    assert.deepEqual(titles(sortGames(games, 'rating')), ['Alpha', 'Charlie', 'Bravo', 'Delta']);
    assert.deepEqual(titles(sortGames(games, 'title')), ['Alpha', 'Bravo', 'Charlie', 'Delta']);
  });
});
