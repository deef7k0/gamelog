import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  ITAD_SHOP_OF_STORE,
  arrangeOffers,
  pickStorefronts,
  steamAppIdFromUrl,
  type IgdbStoreFields,
} from './storefronts';

/* IGDB's real answers for five games, fetched 2026-10-16 — see the file's note. */
const fixture = JSON.parse(
  readFileSync(new URL('./fixtures/igdb-stores.json', import.meta.url), 'utf8')
) as { games: (IgdbStoreFields & { name: string })[] };

function game(name: string): IgdbStoreFields {
  const found = fixture.games.find((entry) => entry.name === name);
  assert.ok(found, `fixture has ${name}`);
  return found;
}

const keys = (raw: IgdbStoreFields) => pickStorefronts(raw).stores.map((store) => store.key);

describe('pickStorefronts', () => {
  it('lists every official store IGDB has for The Witcher 3, in order', () => {
    assert.deepEqual(keys(game('The Witcher 3: Wild Hunt')), [
      'steam',
      'gog',
      'epic',
      'microsoft',
      'playstation',
      'nintendo',
    ]);
  });

  it('prefers the website to the matched listing: Disco Elysium’s GOG link is the game, not a bundle', () => {
    const gog = pickStorefronts(game('Disco Elysium')).stores.find((store) => store.key === 'gog');
    assert.equal(gog?.url, 'https://www.gog.com/game/disco_elysium');
  });

  it('names one App Store for the iPhone and iPad links, and keeps Hades’ consoles', () => {
    assert.deepEqual(keys(game('Hades')), [
      'steam',
      'epic',
      'microsoft',
      'playstation',
      'nintendo',
      'apple',
    ]);
  });

  it('never offers Amazon, Twitch, YouTube or Giant Bomb as a store', () => {
    for (const entry of fixture.games) {
      for (const store of pickStorefronts(entry).stores) {
        assert.doesNotMatch(store.url, /amazon\.|twitch\.tv|youtube\.com|giantbomb\.com/);
      }
    }
  });

  it('gives a Switch exclusive its eShop and nothing else', () => {
    assert.deepEqual(keys(game('The Legend of Zelda: Breath of the Wild')), ['nintendo']);
  });

  it('reads the Steam appid from the listing, else from the website', () => {
    assert.equal(pickStorefronts(game('Disco Elysium')).steamAppId, '632470');
    assert.equal(pickStorefronts(game('Elden Ring')).steamAppId, '1245620');
    assert.equal(pickStorefronts(game('The Legend of Zelda: Breath of the Wild')).steamAppId, null);
    assert.equal(
      pickStorefronts({
        websites: [{ type: 13, url: 'https://store.steampowered.com/app/292030' }],
      }).steamAppId,
      '292030'
    );
    assert.equal(steamAppIdFromUrl('https://store.steampowered.com/app/70/HalfLife/'), '70');
  });

  it('moves http to https and drops what is not a web address', () => {
    const { stores } = pickStorefronts({
      websites: [
        { type: 26, url: 'http://gamejolt.com/games/emily-is-away/124136' },
        { type: 13, url: 'javascript:alert(1)' },
        { type: 17 },
      ],
    });
    assert.deepEqual(stores, [
      { key: 'gamejolt', url: 'https://gamejolt.com/games/emily-is-away/124136' },
    ]);
  });

  it('is empty, not an error, for a record with nothing', () => {
    assert.deepEqual(pickStorefronts(null), { stores: [], steamAppId: null });
    assert.deepEqual(pickStorefronts({}), { stores: [], steamAppId: null });
  });
});

describe('arrangeOffers', () => {
  /* Shop ids and names as ITAD answered for The Witcher 3 on 2026-10-16. */
  const humble = {
    shopId: 37,
    shopName: 'Humble Store',
    amount: 39.99,
    url: 'https://itad.link/h',
  };
  const blizzard = { shopId: 4, shopName: 'Blizzard', amount: 49.99, url: 'https://itad.link/b' };
  const steam = { shopId: 61, shopName: 'Steam', amount: 49.99, url: 'https://itad.link/s' };

  it('prices an official store IGDB lists, and keeps IGDB’s link', () => {
    const { stores } = pickStorefronts(game('The Witcher 3: Wild Hunt'));
    const { official, others } = arrangeOffers(stores, [humble, blizzard, steam]);

    const steamRow = official.find((row) => row.key === 'steam');
    assert.equal(steamRow?.url, 'https://store.steampowered.com/app/292030');
    assert.equal(steamRow?.source, 'igdb');
    assert.equal(steamRow?.price, steam);

    /* Shown without a price: ITAD tracks no console shop. */
    const playstation = official.find((row) => row.key === 'playstation');
    assert.equal(playstation?.price, null);
    assert.match(playstation?.url ?? '', /^https:\/\/store\.playstation\.com\//);

    /* The shops only ITAD knows, with ITAD's links, cheapest first. */
    assert.deepEqual(others, [humble, blizzard]);
  });

  it('keeps an official store IGDB missed, on ITAD’s link', () => {
    const { official } = arrangeOffers([], [steam]);
    assert.deepEqual(official, [{ key: 'steam', url: steam.url, source: 'itad', price: steam }]);
  });

  it('takes the first price ITAD gives a shop, which is its cheapest', () => {
    const dearer = { ...steam, amount: 59.99, url: 'https://itad.link/s2' };
    const { official } = arrangeOffers([], [steam, dearer]);
    assert.equal(official[0].price, steam);
  });

  it('maps the four shops ITAD prices to their ITAD ids', () => {
    assert.deepEqual(ITAD_SHOP_OF_STORE, { steam: 61, gog: 35, epic: 16, microsoft: 48 });
  });
});
