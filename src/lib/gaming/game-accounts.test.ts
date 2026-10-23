import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  cleanHandle,
  gogImageUrl,
  gogRows,
  gogUserIdFromPage,
  psnErrorCode,
  psnRows,
  statusMessage,
  xboxPersonFor,
  xboxRows,
} from '../../../supabase/functions/_shared/game-accounts';

/*
 * The shapes are the services' as their own clients read them — GOG's from
 * Playnite's `LibraryGameResponse`, PSN's from psn-api's `TrophyTitle`, Xbox's
 * from an OpenXBL client's `GameTitle` — not captured answers: no public GOG
 * profile was found, and PSN and Xbox need keys this project does not have yet.
 */

describe('usernames', () => {
  it('takes a PSN Online ID and refuses what cannot be one', () => {
    assert.equal(cleanHandle('playstation', '  Ada_Lovelace '), 'Ada_Lovelace');
    assert.equal(cleanHandle('playstation', 'ab'), null);
    assert.equal(cleanHandle('playstation', 'has space'), null);
    assert.equal(cleanHandle('playstation', 'a'.repeat(17)), null);
  });

  it('takes a classic gamertag with spaces and a modern one with its suffix', () => {
    assert.equal(cleanHandle('xbox', 'Major  Nelson'), 'Major Nelson');
    assert.equal(cleanHandle('xbox', 'Ada#1234'), 'Ada#1234');
    assert.equal(cleanHandle('xbox', 'way-too-long-gamertag'), null);
  });

  it('reads a GOG username out of a pasted profile address, as RAWG tells people to', () => {
    assert.equal(cleanHandle('gog', 'https://www.gog.com/u/L0stman/games'), 'L0stman');
    assert.equal(cleanHandle('gog', 'gog.com/en/u/john'), 'john');
    assert.equal(cleanHandle('gog', 'john'), 'john');
    assert.equal(cleanHandle('gog', 'bad name'), null);
  });

  it('says what each status means, and nothing for success', () => {
    assert.equal(statusMessage('gog', 'ready'), null);
    assert.match(statusMessage('playstation', 'private-games')!, /private/);
    assert.match(statusMessage('xbox', 'not-found')!, /gamertag/);
  });
});

describe('GOG', () => {
  it("reads the user's id off the profile page", () => {
    assert.equal(
      gogUserIdFromPage('… "username":"john","userId":"46987787926178880" …'),
      '46987787926178880'
    );
    assert.equal(gogUserIdFromPage('<html></html>'), null);
  });

  it("makes GOG's sizeless image addresses a square tile, and only GOG's", () => {
    assert.equal(
      gogImageUrl('//images-4.gog-statics.com/abc123'),
      'https://images-4.gog-statics.com/abc123_196.jpg'
    );
    assert.equal(gogImageUrl('https://evil.example/x'), null);
  });

  it('turns stats items into owned games, playtime from the one user in `stats`', () => {
    const rows = gogRows([
      {
        game: { id: '1207658930', title: 'The Witcher 3', image: '//images.gog-statics.com/w3' },
        stats: { '4698': { playtime: 125.4, lastSession: '2026-10-01T10:00:00+00:00' } },
      },
      { game: { id: '1207658930', title: 'Duplicate' }, stats: null },
      { game: { title: 'No id' } },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].app_id, '1207658930');
    assert.equal(rows[0].playtime_minutes, 125);
    assert.equal(rows[0].last_played_at, '2026-10-01T10:00:00.000Z');
  });
});

describe('PlayStation', () => {
  it('counts trophies across grades and leaves hidden titles out', () => {
    const rows = psnRows([
      {
        npCommunicationId: 'NPWR12345_00',
        trophyTitleName: 'Astro Bot',
        trophyTitleIconUrl: 'https://image.api.playstation.com/x.png',
        definedTrophies: { bronze: 30, silver: 10, gold: 4, platinum: 1 },
        earnedTrophies: { bronze: 12, silver: 3, gold: 1, platinum: 0 },
        lastUpdatedDateTime: '2026-09-30T20:00:00Z',
      },
      { npCommunicationId: 'NPWR99999_00', trophyTitleName: 'Hidden', hiddenFlag: true },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].achievements_total, 45);
    assert.equal(rows[0].achievements_unlocked, 16);
  });

  it("finds Sony's error code in an answer", () => {
    assert.equal(psnErrorCode({ error: { code: 2240526, message: 'Not permitted' } }), 2240526);
    assert.equal(psnErrorCode({ trophyTitles: [] }), null);
  });
});

describe('Xbox', () => {
  it('picks the person whose gamertag is exactly the one typed, never the first result', () => {
    const people = [
      { xuid: '1', gamertag: 'Ada Lovelacey' },
      { xuid: '2', gamertag: 'ada lovelace' },
    ];
    assert.equal(xboxPersonFor(people, 'Ada Lovelace')?.xuid, '2');
    assert.equal(xboxPersonFor(people, 'Nobody'), null);
  });

  it('keeps games and drops apps from the title history', () => {
    const rows = xboxRows([
      {
        titleId: '1144039928',
        name: 'Halo: MCC',
        type: 'Game',
        displayImage: 'http://store-images.s-microsoft.com/h.png',
        achievement: { currentAchievements: 50, totalAchievements: 700 },
        titleHistory: { lastTimePlayed: '2026-10-20T08:00:00.000Z' },
      },
      { titleId: '327370029', name: 'Netflix', type: 'App' },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].icon_url, 'https://store-images.s-microsoft.com/h.png');
    assert.equal(rows[0].achievements_unlocked, 50);
  });
});
