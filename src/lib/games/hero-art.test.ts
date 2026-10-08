import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { chooseHero, heroShape, type HeroCandidate } from './hero-art.ts';

/** An artwork: its id doubles as its name in the assertions. */
const art = (image_id: string, width: number, height: number, artwork_type: number) => ({
  image_id,
  width,
  height,
  artwork_type,
});
const shot = (image_id: string, width: number, height: number): HeroCandidate => ({
  image_id,
  width,
  height,
});

/* IGDB's artwork types, as the module's table has them. */
const ARTWORK = 1;
const KEY_ART = 2;
const KEY_ART_LOGO = 3;
const CONCEPT = 4;
const LOGO_BLACK = 6;
const LOGO_COLOR = 7;
const HISTORICAL_COVER = 10;
const ICON = 12;
const HISTORICAL_ARTWORK = 15;

const picked = (
  artworks: HeroCandidate[] | undefined,
  screenshots: HeroCandidate[] | undefined = []
) => chooseHero(artworks, screenshots)?.image.image_id ?? null;

describe('chooseHero, on what IGDB really holds', () => {
  /* Each of these is the live record, in IGDB's own order, read on 2026-10-08.
     The first artwork of each is what the page used to stretch across itself. */

  it('passes over The Witcher 3’s 128px icon for its key art', () => {
    const artworks = [
      art('ar6ijr', 128, 128, ICON),
      art('ar3lze', 7133, 4463, CONCEPT),
      art('ar3lzf', 1200, 780, CONCEPT),
      art('ar3lzk', 10681, 7874, KEY_ART),
      art('ar3lzb', 1200, 675, CONCEPT),
      art('ar3lzn', 4069, 2160, KEY_ART_LOGO),
      art('ar3m1h', 5736, 2849, LOGO_BLACK),
    ];
    /* Key art before concept art, though a concept piece is exactly 16:9 — and
       of the two key arts, the one that is a widescreen frame. */
    assert.equal(picked(artworks), 'ar3lzn');
  });

  it('passes over Grand Theft Auto V’s logo for its 4K key art', () => {
    const artworks = [
      art('ar3m56', 1106, 956, LOGO_COLOR),
      art('ar6p36', 3840, 1240, ARTWORK),
      art('ar6d99', 736, 494, HISTORICAL_ARTWORK),
      art('ar6d9j', 1260, 790, KEY_ART_LOGO),
      art('ar6d95', 1920, 1080, HISTORICAL_ARTWORK),
      art('ar6d9m', 3840, 2160, KEY_ART),
      art('ar6egj', 256, 256, ICON),
    ];
    assert.equal(picked(artworks), 'ar6d9m');
  });

  it('never shows one of Elden Ring’s three wordmarks', () => {
    const artworks = [
      art('ar3m1o', 5981, 920, LOGO_BLACK),
      art('ar3m1p', 5981, 920, 5),
      art('ar1481', 1920, 620, ARTWORK),
      art('ar3m1n', 5981, 920, LOGO_COLOR),
    ];
    /* Its one piece of art is a 3.1:1 banner, which the hero would cut to its
       middle third: a sharp widescreen screenshot fills the slot better. */
    assert.equal(picked(artworks, [shot('s1', 1920, 1080)]), 's1');

    /* With no such screenshot the banner is the hero — and it reports its shape. */
    const hero = chooseHero(artworks, [shot('small', 640, 360)]);
    assert.equal(hero?.image.image_id, 'ar1481');
    assert.ok(Math.abs((hero?.aspect ?? 0) - 1920 / 620) < 1e-9);
  });

  it('shows Hollow Knight’s key art, not the cover that was uploaded first', () => {
    const artworks = [
      art('ar584b', 600, 800, HISTORICAL_COVER),
      art('ar584c', 1200, 1599, HISTORICAL_COVER),
      art('ar3ptm', 800, 317, 5),
      art('ylrp', 1200, 712, ARTWORK),
      art('eygm', 2064, 1936, ARTWORK),
      art('ar6bjg', 256, 256, ICON),
      art('ar6bjh', 3840, 1884, KEY_ART),
      art('tvfb', 1775, 2696, ARTWORK),
    ];
    assert.equal(picked(artworks), 'ar6bjh');
  });
});

describe('chooseHero, by rule', () => {
  it('never picks a logo, a cover or an icon, whatever its shape', () => {
    const artworks = [
      /* A colour logo at exactly 16:9, 4K: the best-shaped file there is. */
      art('logo', 3840, 2160, LOGO_COLOR),
      art('cover', 1920, 1080, HISTORICAL_COVER),
      art('icon', 1920, 1080, ICON),
      art('info', 1920, 1080, 8),
    ];
    assert.equal(picked(artworks), null);
    assert.equal(picked(artworks, [shot('s', 1280, 720)]), 's');
  });

  it('prefers a frame to a banner, then key art to artwork to concept art', () => {
    assert.equal(
      picked([art('banner', 1920, 620, KEY_ART), art('frame', 1920, 1080, CONCEPT)]),
      'frame'
    );
    assert.equal(
      picked([art('concept', 1920, 1080, CONCEPT), art('artwork', 1920, 1080, ARTWORK)]),
      'artwork'
    );
    assert.equal(
      picked([art('artwork', 1920, 1080, ARTWORK), art('key', 1600, 1000, KEY_ART_LOGO)]),
      'key'
    );
    assert.equal(
      picked([art('old', 1920, 1080, HISTORICAL_ARTWORK), art('concept', 1920, 1200, CONCEPT)]),
      'concept'
    );
  });

  it('takes the larger of two equals', () => {
    assert.equal(picked([art('hd', 1920, 1080, KEY_ART), art('uhd', 3840, 2160, KEY_ART)]), 'uhd');
  });

  it('would rather a sharp screenshot than a banner, and a banner than soft art', () => {
    const banner = art('banner', 1920, 620, KEY_ART);
    const soft = art('small', 640, 360, KEY_ART);
    assert.equal(picked([banner, soft], [shot('s', 1920, 1080)]), 's');
    assert.equal(picked([banner, soft], [shot('s', 640, 360)]), 'banner');
    assert.equal(picked([soft, art('softbanner', 900, 290, KEY_ART)]), 'small');
  });

  it('would rather a sharp screenshot than soft art', () => {
    const artworks = [art('small', 640, 360, KEY_ART)];
    assert.equal(picked(artworks, [shot('s', 1920, 1080)]), 's');
    /* But soft art before a screenshot that is no sharper, or the wrong shape. */
    assert.equal(picked(artworks, [shot('s', 640, 360)]), 'small');
    assert.equal(picked(artworks, [shot('tall', 1080, 1920)]), 'small');
  });

  it('skips a screenshot that is not a widescreen frame when there is one that is', () => {
    const screenshots = [shot('fourthree', 1024, 768), shot('wide', 1920, 1080)];
    assert.equal(picked([art('icon', 256, 256, ICON)], screenshots), 'wide');
  });

  it('falls back to the first screenshot, then to any art at all', () => {
    assert.equal(picked([art('icon', 256, 256, ICON)], [shot('old', 320, 240)]), 'old');

    /* No landscape art and no screenshot: a portrait painting is still the
       game's art. The largest, and never the cover or the icon beside it. */
    const artworks = [
      art('cover', 2000, 3000, HISTORICAL_COVER),
      art('painting', 1100, 1400, ARTWORK),
      art('bigger', 1775, 2696, ARTWORK),
      art('icon', 256, 256, ICON),
    ];
    assert.equal(picked(artworks), 'bigger');
  });

  it('has nothing to offer a game with no images, or only logos', () => {
    assert.equal(chooseHero([], []), null);
    assert.equal(chooseHero(undefined, undefined), null);
    assert.equal(chooseHero(null, null), null);
    assert.equal(picked([art('logo', 5981, 920, LOGO_BLACK)]), null);
  });

  it('ranks a kind IGDB adds later as artwork, and still by its shape', () => {
    const NEW_KIND = 99;
    assert.equal(picked([art('new', 1920, 1080, NEW_KIND)]), 'new');
    assert.equal(
      picked([art('new', 1920, 1080, NEW_KIND), art('key', 1920, 1080, KEY_ART)]),
      'key'
    );
    /* A new kind that is a strip is still a strip. */
    assert.equal(picked([art('strip', 6000, 900, NEW_KIND)], [shot('s', 1920, 1080)]), 's');
  });

  it('gives a query that asked for neither sizes nor kinds what it always got', () => {
    /* `similar_games` expands image ids and nothing else. */
    const bare = [{ image_id: 'first' }, { image_id: 'second' }];
    const hero = chooseHero(bare, [{ image_id: 'shot' }]);
    assert.equal(hero?.image.image_id, 'first');
    assert.equal(hero?.aspect, null);
    assert.equal(chooseHero([], [{ image_id: 'shot' }])?.image.image_id, 'shot');
  });

  it('ranks sized artworks with no kind as artwork — the studio query asks for sizes alone', () => {
    const sized = [
      { image_id: 'strip', width: 1200, height: 130 },
      { image_id: 'frame', width: 1920, height: 1080 },
    ];
    assert.equal(chooseHero(sized, [])?.image.image_id, 'frame');
  });

  it('ignores an entry with no image id', () => {
    assert.equal(picked([{ width: 1920, height: 1080, artwork_type: KEY_ART }]), null);
  });
});

describe('heroShape', () => {
  it('calls 16:9 and its neighbours a frame', () => {
    assert.equal(heroShape(16 / 9), 0);
    assert.equal(heroShape(1.5), 0);
    assert.equal(heroShape(2.04), 0);
  });

  it('calls 4:3 and 21:9 near enough', () => {
    assert.equal(heroShape(4 / 3), 1);
    assert.equal(heroShape(21 / 9), 1);
  });

  it('calls Steam’s 1920×620 a banner', () => {
    assert.equal(heroShape(1920 / 620), 2);
  });

  it('calls a square, a portrait and a wordmark not a hero', () => {
    assert.equal(heroShape(1), null);
    assert.equal(heroShape(0.75), null);
    assert.equal(heroShape(6.5), null);
    assert.equal(heroShape(null), null);
  });
});
