import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  SCREENSCRAPER_SYSTEMS,
  artCacheKey,
  imageSize,
  parseTdbTitles,
  pickScreenscraperGame,
  pickScreenscraperMedia,
  screenscraperGames,
  sleeveBackCrop,
  tdbArtUrl,
  tdbCandidates,
  tdbPlanFor,
  tdbRegionOf,
} from '../../supabase/functions/_shared/copy-art.ts';

/* An excerpt of GameTDB's Wii list as it is served (`wiitdb.txt?LANG=EN`). */
const WII_TITLES = `TITLES = https://www.gametdb.com (type: Wii language: EN version: 20261022)
RMCE01 = Mario Kart Wii
RMCJ01 = Mario Kart Wii
RMCP01 = Mario Kart Wii
GALE01 = Super Smash Bros. Melee
GALP01 = Super Smash Bros. Melee
RSBE01 = Super Smash Bros. Brawl
`;

describe('GameTDB', () => {
  const titles = parseTdbTitles(WII_TITLES);

  it('reads its title list, without the header', () => {
    assert.equal(titles.length, 6);
    assert.deepEqual(titles[0], { id: 'RMCE01', title: 'Mario Kart Wii' });
  });

  it('reads the region off an ID', () => {
    assert.equal(tdbRegionOf('wii', 'RMCE01'), 'ntsc_u');
    assert.equal(tdbRegionOf('wii', 'RMCP01'), 'pal');
    assert.equal(tdbRegionOf('wii', 'RMCJ01'), 'ntsc_j');
    assert.equal(tdbRegionOf('3ds', 'AREP'), 'pal');
    assert.equal(tdbRegionOf('switch', 'AABPA'), 'region_free');
  });

  it('finds the game by its name, the copy’s region first', () => {
    assert.deepEqual(tdbCandidates(titles, 'wii', 'Mario Kart Wii', 'pal'), [
      'RMCP01',
      'RMCE01',
      'RMCJ01',
    ]);
    assert.deepEqual(tdbCandidates(titles, 'wii', 'Super Smash Bros. Melee', null), [
      'GALE01',
      'GALP01',
    ]);
  });

  it('does not take another game of a similar name', () => {
    assert.deepEqual(tdbCandidates(titles, 'wii', 'Super Smash Bros.', 'ntsc_u'), []);
  });

  it('knows what each console has: a sleeve and a disc, a back alone, no disc for a cartridge', () => {
    assert.equal(tdbPlanFor('wii')?.back.spread, true);
    assert.equal(tdbPlanFor('gamecube')?.console, 'wii');
    assert.equal(tdbPlanFor('wiiu')?.back.type, 'backHQ');
    assert.equal(tdbPlanFor('switch')?.disc, null);
    assert.equal(tdbPlanFor('ps2'), null);
  });

  it('builds an art address', () => {
    assert.equal(
      tdbArtUrl('wii', 'disc', 'US', 'RMCE01', 'png'),
      'https://art.gametdb.com/wii/disc/US/RMCE01.png'
    );
  });

  it('crops a sleeve to its back — Mario Kart Wii’s spine starts at 486 of 1024', () => {
    const crop = sleeveBackCrop(1024, 680);
    assert.equal(crop.left, 0);
    assert.ok(Math.abs(crop.right * 1024 - 486) < 2, `${crop.right * 1024}`);
  });
});

describe('ScreenScraper', () => {
  const answer = {
    response: {
      jeux: [
        {
          id: '1',
          noms: [{ region: 'ss', text: 'Sonic 3D Blast' }],
          medias: [{ type: 'box-2D-back', region: 'us', url: 'https://ss/1-back' }],
        },
        {
          id: '2',
          noms: [
            { region: 'us', text: 'Sonic the Hedgehog 2' },
            { region: 'jp', text: 'ソニック・ザ・ヘッジホッグ2' },
          ],
          medias: [
            { type: 'box-2D', region: 'us', url: 'https://ss/2-front' },
            { type: 'box-2D-back', region: 'jp', url: 'https://ss/2-back-jp' },
            { type: 'box-2D-back', region: 'eu', url: 'https://ss/2-back-eu' },
            { type: 'box-2D-back', region: 'us', url: 'https://ss/2-back-us' },
            { type: 'support-texture', region: 'wor', url: 'https://ss/2-label' },
          ],
        },
      ],
    },
  };

  it('reads the games of an answer, and none from the empty one', () => {
    assert.equal(screenscraperGames(answer).length, 2);
    assert.deepEqual(screenscraperGames({ response: { jeux: [{}] } }), []);
    assert.deepEqual(screenscraperGames(null), []);
  });

  it('takes the game of the same name, never its first guess', () => {
    const games = screenscraperGames(answer);
    assert.equal(pickScreenscraperGame(games, 'Sonic the Hedgehog 2')?.id, '2');
    assert.equal(pickScreenscraperGame(games, 'Sonic Mania'), null);
  });

  it('takes the copy’s region’s back, and a label of either kind', () => {
    const game = pickScreenscraperGame(screenscraperGames(answer), 'Sonic the Hedgehog 2')!;
    assert.equal(pickScreenscraperMedia(game, ['box-2D-back'], 'pal')?.url, 'https://ss/2-back-eu');
    assert.equal(
      pickScreenscraperMedia(game, ['box-2D-back'], 'ntsc_u')?.url,
      'https://ss/2-back-us'
    );
    assert.equal(
      pickScreenscraperMedia(game, ['box-2D-back'], 'ntsc_j')?.url,
      'https://ss/2-back-jp'
    );
    assert.equal(
      pickScreenscraperMedia(game, ['support-2D', 'support-texture'], 'pal')?.url,
      'https://ss/2-label'
    );
  });

  it('has a system for the consoles a copy is usually on', () => {
    for (const key of ['ps1', 'ps2', 'ps3', 'gamecube', 'wii', 'switch', 'xbox360', 'dreamcast']) {
      assert.ok(SCREENSCRAPER_SYSTEMS[key] > 0, key);
    }
  });
});

describe('the rest', () => {
  it('keeps one answer for one game, platform and region', () => {
    assert.equal(
      artCacheKey('wii', 'pal', 'Mario Kart Wii™'),
      artCacheKey('wii', 'pal', 'mario kart wii')
    );
    assert.notEqual(
      artCacheKey('wii', 'pal', 'Mario Kart Wii'),
      artCacheKey('wii', null, 'Mario Kart Wii')
    );
  });

  it('reads a PNG’s and a JPEG’s size from their first bytes', () => {
    const png = new Uint8Array(24);
    png.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    new DataView(png.buffer).setUint32(16, 1024);
    new DataView(png.buffer).setUint32(20, 680);
    assert.deepEqual(imageSize(png), { width: 1024, height: 680 });

    /* SOI, an APP0 of 16 bytes, then SOF0 with a height of 1888 and a width of 1166. */
    const jpeg = new Uint8Array([
      0xff,
      0xd8,
      0xff,
      0xe0,
      0x00,
      0x10,
      ...new Array(14).fill(0),
      0xff,
      0xc0,
      0x00,
      0x11,
      0x08,
      0x07,
      0x60,
      0x04,
      0x8e,
      0x03,
    ]);
    assert.deepEqual(imageSize(jpeg), { width: 1166, height: 1888 });

    assert.equal(imageSize(new Uint8Array([1, 2, 3])), null);
  });
});
