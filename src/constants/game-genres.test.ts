import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { GENRE_REACH_ORDER, sortGenresByReach } from './game-genres.ts';

/**
 * Run with `npm test`.
 *
 * ## Why this table is worth a test when the other constants are not
 *
 * `GENRE_REACH_ORDER` is a list of substrings matched against names IGDB owns,
 * and CLAUDE.md names this exact shape as a trap: *"Order in `PATTERNS` is
 * load-bearing and a mistake there is silent — every entry is a valid key, so
 * nothing type-errors."* `'strategy'` is a substring of three IGDB genres, and a
 * first-match implementation would file "Real Time Strategy (RTS)" under the
 * generic entry, leave the specific entry dead, and produce a picker that is
 * merely *differently* wrong — with a green typecheck and a clean lint.
 *
 * So the rule CLAUDE.md sets for `platformKeyFor` applies here too: verify by
 * sweeping real IGDB names through the function, not by reading the table.
 */

/**
 * IGDB v4's published genre vocabulary, in the `sort name asc` order
 * `getGenres()` receives it. Twenty-three entries, including the three that
 * collide on `'strategy'` and the two with punctuation a naive matcher drops.
 */
const IGDB_GENRES = [
  'Adventure',
  'Arcade',
  'Card & Board Game',
  'Fighting',
  "Hack and slash/Beat 'em up",
  'Indie',
  'MOBA',
  'Music',
  'Pinball',
  'Platform',
  'Point-and-click',
  'Puzzle',
  'Quiz/Trivia',
  'Racing',
  'Real Time Strategy (RTS)',
  'Role-playing (RPG)',
  'Shooter',
  'Simulator',
  'Sport',
  'Strategy',
  'Tactical',
  'Turn-based strategy (TBS)',
  'Visual Novel',
].map((name, id) => ({ id, name }));

const sorted = sortGenresByReach(IGDB_GENRES);
const positionOf = (name: string) => sorted.findIndex((genre) => genre.name === name);

describe('sortGenresByReach', () => {
  it('keeps every genre — this orders the vocabulary, it never curates it', () => {
    assert.equal(sorted.length, IGDB_GENRES.length);
    assert.equal(new Set(sorted.map((genre) => genre.name)).size, IGDB_GENRES.length);
  });

  it('does not let the generic "strategy" entry swallow the specific ones', () => {
    /* The whole reason the matcher takes the longest substring rather than the
       first. If this fails, RTS and TBS have been filed under plain Strategy and
       their own entries in the table are dead code. */
    assert.ok(positionOf('Strategy') < positionOf('Real Time Strategy (RTS)'));
    assert.ok(positionOf('Strategy') < positionOf('Turn-based strategy (TBS)'));
    assert.ok(positionOf('Real Time Strategy (RTS)') < positionOf('Point-and-click'));
  });

  it('puts what a player reaches for first, and the long tail last', () => {
    assert.equal(sorted[0].name, 'Shooter');
    assert.equal(sorted[1].name, 'Role-playing (RPG)');
    assert.equal(sorted.at(-1)?.name, 'Pinball');

    /* Demoted deliberately: it sits on roughly half the catalogue, so as a
     *filter* it barely narrows anything. See the docblock on the constant. */
    assert.ok(positionOf('Indie') > positionOf('Puzzle'));
  });

  it('matches through the punctuation IGDB actually writes', () => {
    /* A matcher comparing whole names rather than substrings would miss all
       three of these and drop them to the unmatched tail. */
    assert.ok(positionOf('Role-playing (RPG)') < GENRE_REACH_ORDER.length);
    assert.ok(positionOf("Hack and slash/Beat 'em up") < positionOf('Point-and-click'));
    assert.ok(positionOf('Card & Board Game') < positionOf('Pinball'));
  });

  it('keeps a genre IGDB adds later instead of dropping it', () => {
    /* The failure this guards against is a stale constant silently removing a
       filter option. An unknown name sinks to the end; it never disappears. */
    const withNew = sortGenresByReach([...IGDB_GENRES, { id: 99, name: 'Roguelike' }]);
    assert.equal(withNew.length, IGDB_GENRES.length + 1);
    assert.equal(withNew.at(-1)?.name, 'Roguelike');
  });

  it('does not mutate its input', () => {
    const input = [
      { id: 1, name: 'Pinball' },
      { id: 2, name: 'Shooter' },
    ];
    sortGenresByReach(input);
    assert.equal(input[0].name, 'Pinball');
  });
});
