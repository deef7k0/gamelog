import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  igdbSlugFromUrl,
  itemMatchesGame,
  itemSearchesFor,
  wikidataLookupFor,
  type WikidataLookup,
} from './lookup.ts';

const text = (value: string) => ({ snaktype: 'value', datavalue: { type: 'string', value } });

/** A P5794 statement: the IGDB slug, optionally qualified with IGDB's numeric id (P9043). */
const igdbRecord = (slug: string, numericId?: string, rank = 'normal') => ({
  mainsnak: text(slug),
  qualifiers: numericId ? { P9043: [text(numericId)] } : {},
  rank,
});

const WITCHER: WikidataLookup = {
  igdbId: '1942',
  igdbSlug: 'the-witcher-3-wild-hunt',
  steamAppId: '292030',
};

describe('igdbSlugFromUrl', () => {
  it('takes the slug from IGDB’s own game URL', () => {
    assert.equal(
      igdbSlugFromUrl('https://www.igdb.com/games/the-witcher-3-wild-hunt'),
      'the-witcher-3-wild-hunt'
    );
    assert.equal(igdbSlugFromUrl('https://igdb.com/games/doom--2/'), 'doom--2');
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/games/celeste?ref=x'), 'celeste');
  });

  it('refuses anything that is not an IGDB game page', () => {
    assert.equal(igdbSlugFromUrl('https://store.steampowered.com/app/292030'), null);
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/companies/cd-projekt-red'), null);
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/games/'), null);
    assert.equal(igdbSlugFromUrl(null), null);
    assert.equal(igdbSlugFromUrl(undefined), null);
  });

  it('refuses a slug that would change the meaning of a search expression', () => {
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/games/a%20b'), null);
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/games/a%7CP31=Q5'), null);
    assert.equal(igdbSlugFromUrl('https://www.igdb.com/games/%E0%A4%A'), null);
  });
});

describe('wikidataLookupFor', () => {
  it('builds a lookup from an IGDB game’s URL and appid', () => {
    assert.deepEqual(
      wikidataLookupFor({
        source: 'igdb',
        sourceId: '1942',
        storeUrl: 'https://www.igdb.com/games/the-witcher-3-wild-hunt',
        steamAppId: '292030',
      }),
      WITCHER
    );
  });

  it('works for an IGDB game with no Steam appid, which is every one today', () => {
    assert.deepEqual(
      wikidataLookupFor({
        source: 'igdb',
        sourceId: '1942',
        storeUrl: 'https://www.igdb.com/games/the-witcher-3-wild-hunt',
        steamAppId: null,
      }),
      { ...WITCHER, steamAppId: null }
    );
  });

  it('uses a legacy Steam row’s own id as its appid', () => {
    assert.deepEqual(
      wikidataLookupFor({
        source: 'steam',
        sourceId: '292030',
        storeUrl: 'https://store.steampowered.com/app/292030',
        steamAppId: null,
      }),
      { igdbId: null, igdbSlug: null, steamAppId: '292030' }
    );
  });

  it('returns null when there is nothing exact to search by', () => {
    assert.equal(
      wikidataLookupFor({ source: 'rawg', sourceId: 'celeste', storeUrl: 'https://rawg.io/games/celeste', steamAppId: null }),
      null
    );
    assert.equal(
      wikidataLookupFor({ source: 'igdb', sourceId: '1', storeUrl: null, steamAppId: 'not-an-appid' }),
      null
    );
  });
});

describe('itemSearchesFor', () => {
  it('searches by slug first, narrowed by the numeric id, then by appid', () => {
    assert.deepEqual(itemSearchesFor(WITCHER), [
      {
        statement: 'P5794=the-witcher-3-wild-hunt',
        narrowed: 'P5794=the-witcher-3-wild-hunt[P9043=1942]',
      },
      { statement: 'P1733=292030', narrowed: null },
    ]);
  });

  it('searches by appid alone when that is all there is', () => {
    assert.deepEqual(itemSearchesFor({ igdbId: null, igdbSlug: null, steamAppId: '10' }), [
      { statement: 'P1733=10', narrowed: null },
    ]);
  });
});

describe('itemMatchesGame', () => {
  it('accepts an item whose IGDB record names this game by numeric id', () => {
    assert.equal(itemMatchesGame({ P5794: [igdbRecord('the-witcher-3-wild-hunt', '1942')] }, WITCHER), true);
  });

  it('accepts a matching slug when the record has no numeric id', () => {
    assert.equal(itemMatchesGame({ P5794: [igdbRecord('the-witcher-3-wild-hunt')] }, WITCHER), true);
  });

  it('rejects an item whose record names another IGDB game, however it was found', () => {
    /* The slug matched, but IGDB's numeric id says it is somebody else's now. */
    assert.equal(itemMatchesGame({ P5794: [igdbRecord('the-witcher-3-wild-hunt', '9999')] }, WITCHER), false);
    /* Found by Steam appid, but the item is the Complete Edition's. */
    assert.equal(
      itemMatchesGame({ P5794: [igdbRecord('the-witcher-3-wild-hunt-complete-edition')] }, WITCHER),
      false
    );
  });

  it('accepts an item that records several IGDB games when one is this one', () => {
    const claims = {
      P5794: [igdbRecord('the-witcher-3-goty', '11111'), igdbRecord('the-witcher-3-wild-hunt', '1942')],
    };
    assert.equal(itemMatchesGame(claims, WITCHER), true);
  });

  it('ignores a deprecated record, and accepts an item with no IGDB record at all', () => {
    assert.equal(
      itemMatchesGame({ P5794: [igdbRecord('something-else', '5', 'deprecated')] }, WITCHER),
      true
    );
    assert.equal(itemMatchesGame({}, WITCHER), true);
  });

  it('has nothing to contradict for a legacy Steam row', () => {
    const steamOnly = { igdbId: null, igdbSlug: null, steamAppId: '292030' };
    assert.equal(itemMatchesGame({ P5794: [igdbRecord('anything', '1')] }, steamOnly), true);
  });
});
