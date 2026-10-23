import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { FACET_INFO, LOOKUP_KINDS, facetsClause, facetSubject, isTagFacet } from './facets.ts';
import {
  englishTags,
  exactNamesClause,
  hasEveryTag,
  inRawgOrder,
  pickRawgGame,
  rawgDates,
  rawgOrdering,
  rawgYear,
  titleKey,
} from './rawg-match.ts';

describe('englishTags', () => {
  it('keeps the English ones, the most used first', () => {
    const tags = englishTags([
      { id: 1, name: 'Singleplayer', slug: 'singleplayer', language: 'eng', games_count: 200 },
      {
        id: 2,
        name: 'Для одного игрока',
        slug: 'dlia-odnogo-igroka',
        language: 'rus',
        games_count: 900,
      },
      { id: 3, name: 'Atmospheric', slug: 'atmospheric', language: 'eng', games_count: 400 },
      { id: 4, name: '  ', language: 'eng' },
    ]);
    assert.deepEqual(
      tags.map((tag) => tag.name),
      ['Atmospheric', 'Singleplayer']
    );
  });

  it('is empty for nothing', () => {
    assert.deepEqual(englishTags(undefined), []);
  });
});

describe('titleKey', () => {
  it('reads two spellings of one name as one', () => {
    assert.equal(titleKey("Marvel's Spider-Man™"), titleKey('Marvels Spider Man'));
    assert.equal(titleKey('Ratchet & Clank'), titleKey('Ratchet and Clank'));
    assert.equal(titleKey('Pokémon Red'), titleKey('Pokemon Red'));
  });

  it('keeps a sequel’s number', () => {
    assert.notEqual(titleKey('Hades II'), titleKey('Hades'));
  });
});

describe('pickRawgGame', () => {
  const results = [
    { name: 'Prey', released: '2006-07-11' },
    { name: 'Prey', released: '2017-05-05' },
    { name: 'Prey 2', released: null },
  ];

  it('takes the one of the same name and year', () => {
    assert.equal(pickRawgGame(results, 'Prey', 2017)?.released, '2017-05-05');
    assert.equal(pickRawgGame(results, 'Prey', 2006)?.released, '2006-07-11');
  });

  it('takes none when the year is another game’s', () => {
    assert.equal(pickRawgGame(results, 'Prey', 2012), null);
  });

  it('takes the first of the name when the year is unknown', () => {
    assert.equal(pickRawgGame(results, 'Prey', null)?.released, '2006-07-11');
  });
});

describe('inRawgOrder', () => {
  const games = [
    { title: 'Celeste', releaseYear: 2018 },
    { title: 'Hades', releaseYear: 1995 },
    { title: 'Hades', releaseYear: 2020 },
    { title: 'Portal 2', releaseYear: 2011 },
  ];

  it('is RAWG’s order, each the IGDB game of its name and year', () => {
    const ordered = inRawgOrder(
      [
        { name: 'Portal 2', released: '2011-04-18' },
        { name: 'Hades', released: '2020-09-17' },
        { name: 'Celeste', released: '2018-01-25' },
      ],
      games
    );
    assert.deepEqual(
      ordered.map((game) => `${game.title} ${game.releaseYear}`),
      ['Portal 2 2011', 'Hades 2020', 'Celeste 2018']
    );
  });

  it('leaves out a name IGDB does not have, or has only from another time', () => {
    const ordered = inRawgOrder(
      [
        { name: 'Not On IGDB', released: '2020-01-01' },
        { name: 'Celeste', released: '2030-01-01' },
      ],
      games
    );
    assert.deepEqual(ordered, []);
  });
});

describe('exactNamesClause', () => {
  it('asks IGDB for these names exactly, quotes escaped, each once', () => {
    assert.equal(
      exactNamesClause(['Hades', 'Marathon "Durandal"', 'Hades']),
      'name = ("Hades","Marathon \\"Durandal\\"")'
    );
  });

  it('matches nothing for no names', () => {
    assert.equal(exactNamesClause([]), 'id = 0');
  });
});

describe('the rest', () => {
  it('reads a RAWG year', () => {
    assert.equal(rawgYear('2018-04-20'), 2018);
    assert.equal(rawgYear(null), null);
  });

  it('knows a row with every tag', () => {
    const row = { tags: [{ id: 1 }, { id: 31 }] };
    assert.ok(hasEveryTag(row, [1, 31]));
    assert.ok(!hasEveryTag(row, [1, 7]));
  });

  it('reads the catalogue’s orders in RAWG’s words', () => {
    assert.deepEqual(rawgOrdering('popular'), { ordering: '-added' });
    assert.deepEqual(rawgOrdering('upcoming'), { ordering: 'released', dates: 'future' });
    assert.equal(rawgDates('future', new Date('2026-10-22T12:00:00Z')), '2026-10-22,2100-12-31');
    assert.equal(rawgDates(undefined, new Date()), null);
  });
});

describe('a tag as a facet', () => {
  it('is RAWG’s, searchable, and never part of IGDB’s clause', () => {
    assert.ok(LOOKUP_KINDS.includes('tag'));
    assert.equal(FACET_INFO.tag.lookup, 'tags');
    assert.ok(isTagFacet({ kind: 'tag' }));
    assert.equal(
      facetsClause(
        [
          { kind: 'tag', id: 31 },
          { kind: 'theme', id: 20 },
        ],
        'all'
      ),
      'themes = (20)'
    );
    assert.equal(facetSubject([{ kind: 'tag', id: 31 }], 'all'), '');
  });
});
