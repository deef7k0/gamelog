import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { chooseRendition, chooseTrailer, resolveUrl, type SteamMovie } from './steam-trailer.ts';

/** Steam's real `appdetails?filters=movies` answers, saved 2026-10-17. */
function moviesOf(appId: string): SteamMovie[] {
  const file = new URL(`./fixtures/steam/trailers/movies-${appId}.json`, import.meta.url);
  const body = JSON.parse(readFileSync(file, 'utf8'));
  return body[appId].data.movies;
}

const master = readFileSync(
  new URL('./fixtures/steam/trailers/master-1145360.m3u8', import.meta.url),
  'utf8'
);
const MASTER_URL =
  'https://video.akamai.steamstatic.com/store_trailers/1145360/1/abc/123/hls_264_master.m3u8?t=99';

describe('which movie is the trailer', () => {
  const cases: [string, string, string][] = [
    ['292030', 'The Witcher 3', 'Official Launch Trailer'],
    ['1086940', "Baldur's Gate 3", 'Launch Trailer'],
    ['1145360', 'Hades', 'v1.0 Launch Trailer'],
    ['367520', 'Hollow Knight', 'Release Trailer'],
    ['730', 'Counter-Strike 2', 'Launch Trailer'],
    ['413150', 'Stardew Valley', 'Stardew Valley Trailer'],
    ['220', 'Half-Life 2', 'Half-Life 2 Trailer'],
  ];

  for (const [appId, game, expected] of cases) {
    it(`${game}: "${expected}"`, () => {
      const chosen = chooseTrailer(moviesOf(appId));
      assert.ok(chosen, 'no trailer chosen');
      assert.ok(chosen.name?.includes(expected), `chose "${chosen.name}"`);
    });
  }

  it('passes over a gameplay showcase or a content pack for a trailer', () => {
    const hades = chooseTrailer(moviesOf('1145360'));
    assert.doesNotMatch(hades?.name ?? '', /showcase/i);
    const hollow = chooseTrailer(moviesOf('367520'));
    assert.doesNotMatch(hollow?.name ?? '', /content pack/i);
  });

  it('has nothing to offer for a listing with nothing streamable', () => {
    assert.equal(chooseTrailer([]), null);
    assert.equal(chooseTrailer([{ id: 1, name: 'Trailer' }]), null);
  });
});

describe('which rendition plays', () => {
  it('takes the cheapest H.264 rendition at least 720 tall — the video-only playlist', () => {
    assert.equal(
      chooseRendition(master, MASTER_URL),
      'https://video.akamai.steamstatic.com/store_trailers/1145360/1/abc/123/hls_264_1_video.m3u8'
    );
  });

  it('never the master, which would fetch the sound as well', () => {
    assert.doesNotMatch(chooseRendition(master, MASTER_URL) ?? '', /master|audio/);
  });

  it('takes the tallest there is when none reaches 720', () => {
    const small = master
      .split('\n')
      .filter((line, index, all) => {
        const inf = line.startsWith('#EXT-X-STREAM-INF') ? line : (all[index - 1] ?? '');
        return !/RESOLUTION=1(920|280)/.test(inf);
      })
      .join('\n');
    assert.match(chooseRendition(small, MASTER_URL) ?? '', /hls_264_2_video/);
  });

  it('refuses a master with no H.264 in it', () => {
    const av1 =
      '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1,CODECS="av01.0.08M.08",RESOLUTION=1280x720\nv.m3u8';
    assert.equal(chooseRendition(av1, MASTER_URL), null);
  });

  it('resolves against the master’s path, not its query', () => {
    assert.equal(
      resolveUrl('a/b.m3u8', 'https://x.test/p/q/m.m3u8?t=1'),
      'https://x.test/p/q/a/b.m3u8'
    );
    assert.equal(
      resolveUrl('https://y.test/z.m3u8', 'https://x.test/m.m3u8'),
      'https://y.test/z.m3u8'
    );
  });
});
