import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  FACET_INFO,
  FIXED_VALUES,
  LOOKUP_KINDS,
  PLATFORM_GROUPS,
  THEMES,
  facetClause,
  facetFromParams,
  facetParams,
  facetsClause,
  facetsFromParams,
  facetsParams,
  facetsSentence,
  facetSubject,
  facetTitle,
  matchValues,
  platformGroupsClause,
  tallyValues,
} from './facets';

describe('facetClause', () => {
  /* Each checked against the live catalogue on 2026-10-16. */
  it('asks IGDB for a facet’s games the way it answers', () => {
    assert.equal(facetClause({ kind: 'theme', id: 20 }), 'themes = (20)');
    assert.equal(facetClause({ kind: 'engine', id: 439 }), 'game_engines = (439)');
    assert.equal(facetClause({ kind: 'language', id: 16 }), 'language_supports.language = (16)');
    assert.equal(facetClause({ kind: 'rating', id: 12 }), 'age_ratings.rating_category = (12)');
  });

  it('asks for a series by `collections`, plural — the singular answers nothing now', () => {
    assert.equal(facetClause({ kind: 'series', id: 106 }), 'collections = (106)');
  });

  it('never puts anything but a whole number in the clause', () => {
    assert.equal(facetClause({ kind: 'genre', id: 12.9 }), 'genres = (12)');
  });
});

describe('the route params', () => {
  it('go there and back', () => {
    const facet = { kind: 'theme' as const, id: 20, name: 'Thriller' };
    assert.deepEqual(facetsFromParams(facetParams(facet)), { facets: [facet], match: 'all' });
    const four = [
      { kind: 'genre' as const, id: 12, name: 'Role-playing (RPG)' },
      { kind: 'theme' as const, id: 41, name: '4X (explore, expand, exploit, and exterminate)' },
    ];
    assert.deepEqual(facetsFromParams(facetsParams(four, 'any')), { facets: four, match: 'any' });
  });

  it('drop what is not a facet, and a facet twice', () => {
    assert.deepEqual(facetsFromParams({ facets: 'not json' }).facets, []);
    assert.deepEqual(
      facetsFromParams({
        facets: JSON.stringify([
          ['theme', 20, 'Thriller'],
          ['theme', 20, 'Thriller'],
          ['colour', 1, 'Red'],
          'x',
        ]),
      }).facets,
      [{ kind: 'theme', id: 20, name: 'Thriller' }]
    );
  });

  it('refuse a kind, an id or a name that is not one', () => {
    assert.equal(facetFromParams({ facet: 'colour', facetId: '1', facetName: 'Red' }), null);
    assert.equal(facetFromParams({ facet: 'theme', facetId: 'abc', facetName: 'Thriller' }), null);
    assert.equal(facetFromParams({ facet: 'theme', facetId: '-3', facetName: 'Thriller' }), null);
    assert.equal(facetFromParams({ facet: 'theme', facetId: '20', facetName: '  ' }), null);
    assert.equal(facetFromParams({}), null);
    assert.equal(facetFromParams({ facet: 'toString', facetId: '1', facetName: 'x' }), null);
  });

  it('take the first of a repeated param', () => {
    assert.deepEqual(
      facetFromParams({ facet: ['mode', 'theme'], facetId: ['3'], facetName: 'Co-op' }),
      {
        kind: 'mode',
        id: 3,
        name: 'Co-op',
      }
    );
  });

  it('title a facet as the Search tab shows it', () => {
    assert.equal(
      facetTitle({ kind: 'engine', id: 439, name: 'Unreal Engine 4' }),
      'Engine · Unreal Engine 4'
    );
  });
});

describe('combining facets', () => {
  const rpg = { kind: 'genre' as const, id: 12, name: 'RPG' };
  const isometric = { kind: 'perspective' as const, id: 3, name: 'Isometric' };
  const comedy = { kind: 'theme' as const, id: 27, name: 'Comedy' };
  const unity = { kind: 'engine' as const, id: 13, name: 'Unity' };

  /* The owner's example: combined, only a game that is all four. */
  it('needs every one when combined', () => {
    assert.equal(
      facetsClause([rpg, isometric, comedy, unity], 'all'),
      'genres = (12) & player_perspectives = (3) & themes = (27) & game_engines = (13)'
    );
    assert.equal(
      facetsSentence([rpg, isometric, comedy, unity], 'all'),
      'RPG, Isometric, Comedy and Unity'
    );
  });

  it('takes any one when any will do', () => {
    assert.equal(facetsClause([rpg, unity], 'any'), '(genres = (12) | game_engines = (13))');
    assert.equal(facetsSentence([rpg, unity], 'any'), 'RPG or Unity');
  });

  it('is the one clause for one facet, and nothing for none', () => {
    assert.equal(facetsClause([comedy], 'any'), 'themes = (27)');
    assert.equal(facetsClause([], 'all'), '');
  });
});

describe('matchValues', () => {
  it('puts the whole name, then a prefix, then a word, then anywhere', () => {
    const values = [
      { id: 1, name: 'Unreal Engine 4' },
      { id: 2, name: 'Source' },
      { id: 3, name: 'Unity' },
      { id: 4, name: 'Mono Unity Fork' },
      { id: 5, name: 'Community' },
    ];
    assert.deepEqual(
      matchValues(values, 'unity').map((value) => value.id),
      [3, 4, 5]
    );
    assert.deepEqual(
      matchValues(values, 'Unity').map((value) => value.id),
      [3, 4, 5]
    );
  });

  it('finds Thriller from its first letters, and every theme from nothing', () => {
    assert.equal(matchValues(THEMES, 'thri')[0]?.name, 'Thriller');
    assert.equal(matchValues(THEMES, '').length, THEMES.length);
    assert.deepEqual(matchValues(THEMES, 'zzz'), []);
  });

  it('ignores case, accents and punctuation', () => {
    assert.equal(matchValues([{ id: 1, name: 'Pokémon' }], 'POKEMON').length, 1);
    assert.equal(matchValues([{ id: 1, name: 'Co-operative' }], 'co op').length, 1);
  });
});

describe('tallyValues', () => {
  it('counts engines across games, most used first', () => {
    const ue4 = { id: 439, name: 'Unreal Engine 4' };
    const ue5 = { id: 982, name: 'Unreal Engine 5' };
    const unity = { id: 13, name: 'Unity' };
    assert.deepEqual(tallyValues([[ue5], [ue4, unity], [ue4], undefined, []]), [ue4, ue5, unity]);
  });
});

describe('the vocabularies', () => {
  it('has no id twice in any fixed list', () => {
    for (const [kind, values] of Object.entries(FIXED_VALUES)) {
      const ids = values!.map((value) => value.id);
      assert.equal(new Set(ids).size, ids.length, kind);
    }
  });

  it('offers only kinds that can be looked up', () => {
    for (const kind of LOOKUP_KINDS) assert.notEqual(FACET_INFO[kind].lookup, null, kind);
    assert.equal(LOOKUP_KINDS.includes('rating'), false);
  });

  it('has a list for every fixed kind', () => {
    for (const [kind, info] of Object.entries(FACET_INFO)) {
      if (info.lookup === 'fixed') assert.ok(FIXED_VALUES[kind as keyof typeof FIXED_VALUES], kind);
    }
  });
});

describe('platform groups and a facet’s slice', () => {
  it('asks for any of a group’s machines', () => {
    assert.equal(platformGroupsClause(['switch']), 'platforms = (508,130)');
    assert.equal(platformGroupsClause(['pc', 'mobile']), 'platforms = (6,39,34)');
    assert.equal(platformGroupsClause([]), null);
    assert.equal(platformGroupsClause(['nonsense']), null);
  });

  it('has no machine in two groups', () => {
    const ids = PLATFORM_GROUPS.flatMap((group) => group.ids);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('builds the facet, the platforms and the word into one clause', () => {
    assert.equal(facetSubject([{ kind: 'theme', id: 20 }], 'all'), 'themes = (20)');
    assert.equal(
      facetSubject([{ kind: 'theme', id: 20 }], 'all', { platforms: ['pc'], term: ' dead ' }),
      'themes = (20) & platforms = (6) & name ~ *"dead"*'
    );
  });

  it('cannot be broken out of with a quote', () => {
    assert.equal(
      facetSubject([{ kind: 'genre', id: 5 }], 'all', { term: 'a"; fields *; where id = 1; "' }),
      'genres = (5) & name ~ *"a\\"; fields *; where id = 1; \\""*'
    );
  });
});
