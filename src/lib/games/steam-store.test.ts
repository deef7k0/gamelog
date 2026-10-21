import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/*
 * The parser lives with the Edge Function that runs it, which is deployed on
 * its own and cannot import from `src/`. It imports nothing itself, so it loads
 * here by relative path, as the SoundCloud matcher does.
 *
 * The fixtures in `fixtures/steam/` are excerpts of real store pages and real
 * event responses, fetched on 2026-10-16; each file says what was kept.
 */
import {
  bbcodeToText,
  decodeEntities,
  elementById,
  eventKindOf,
  excerpt,
  isStorePage,
  parseAttributes,
  parseAwards,
  parseEvents,
  storePageUrl,
} from '../../../supabase/functions/_shared/steam-store.ts';

const page = (name: string) =>
  readFileSync(new URL(`./fixtures/steam/${name}.html`, import.meta.url), 'utf8');
const events = (name: string): unknown =>
  JSON.parse(
    readFileSync(new URL(`./fixtures/steam/${name}-events.json`, import.meta.url), 'utf8')
  );

const awardsOf = (name: string, appId: number) =>
  parseAwards(page(name), storePageUrl(appId), appId);

const EXTRAS = 'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps';

describe('parseAwards, on real pages', () => {
  it('finds Disco Elysium’s one tall strip, as the page names it', () => {
    const awards = awardsOf('disco-elysium', 632470);
    assert.equal(awards.section, true);
    assert.deepEqual(awards.awardsImages, [
      {
        url: `${EXTRAS}/632470/extras/a44c198706985bb9baec7de9572a57d4.avif?t=1780913406`,
        largeUrl: null,
        alt: null,
        width: 349,
        height: 1792,
      },
    ]);
    assert.deepEqual(awards.steamAwards, []);
  });

  it('keeps every image, in order, when there are several (Hollow Knight)', () => {
    const awards = awardsOf('hollow-knight', 367520);
    assert.deepEqual(
      awards.awardsImages.map((image) => [image.width, image.height]),
      [
        [317, 203],
        [337, 106],
        [298, 191],
      ]
    );
  });

  it('reads Steam’s own banners as text and leaves their trophies out (Elden Ring)', () => {
    const awards = awardsOf('elden-ring', 1245620);
    assert.equal(awards.awardsImages.length, 5);
    for (const image of awards.awardsImages) {
      assert.ok(image.url.startsWith(`${EXTRAS}/1245620/extras/`), image.url);
    }
    assert.deepEqual(
      awards.steamAwards.map(({ year, result, awards: names }) => ({ year, result, names })),
      [
        { year: 2024, result: 'Winner', names: ['Labor of Love Award'] },
        {
          year: 2022,
          result: 'Winner',
          names: ['Game of the Year Award', 'Best Game You Suck At Award'],
        },
      ]
    );
  });

  it('reads the larger copy from an unquoted data-big-src', () => {
    const awards = awardsOf('elden-ring', 1245620);
    const big = awards.awardsImages.find((image) => image.largeUrl);
    assert.equal(
      big?.largeUrl,
      `${EXTRAS}/1245620/extras_big/b0bab1477ccc7248605e0233c7668ea6.avif?t=1790290043`
    );
    assert.equal(big?.width, 800);
  });

  it('gives Counter-Strike 2 its Steam Award and no images: the trophy is Steam’s, not an award graphic', () => {
    const awards = awardsOf('counter-strike-2', 730);
    assert.equal(awards.section, true);
    assert.deepEqual(awards.awardsImages, []);
    assert.equal(awards.steamAwards.length, 1);
    assert.equal(awards.steamAwards[0].year, 2020);
    assert.equal(awards.steamAwards[0].url, 'https://store.steampowered.com/steamawards/2020');
  });

  it('reads the 2018 banner, whose class names do not carry the year (The Witcher 3)', () => {
    const awards = awardsOf('the-witcher-3', 292030);
    assert.deepEqual(awards.steamAwards[0].awards, ['Best Environment Award']);
    assert.equal(awards.steamAwards[0].year, 2018);
    assert.equal(awards.awardsImages[0].width, 1200);
  });

  it('keeps Baldur’s Gate 3’s 6008px strip whole; drawing it is the card’s problem', () => {
    const awards = awardsOf('baldurs-gate-3', 1086940);
    assert.deepEqual(
      awards.awardsImages.map((image) => image.height),
      [6008]
    );
    assert.equal(awards.steamAwards.length, 2);
  });

  it('says there is no section on a page without one (Half-Life)', () => {
    const html = page('half-life');
    assert.equal(isStorePage(html), true);
    assert.deepEqual(parseAwards(html, storePageUrl(70), 70), {
      appId: 70,
      pageUrl: storePageUrl(70),
      section: false,
      awardsImages: [],
      steamAwards: [],
    });
  });
});

describe('parseAwards, on what the pages checked did not do', () => {
  const wrap = (inner: string) =>
    `<div class="apphub_AppName">X</div>
     <script>var t = '<div id="awardsTable"><img src="https://shared.fastly.steamstatic.com/decoy.png"></div>';</script>
     <!-- <div id="awardsTable"><img src="https://shared.fastly.steamstatic.com/commented.png"></div> -->
     <div id='awardsTable' class="block"><div class="block_content"><div>${inner}</div></div></div>
     <div id="after"><img src="https://shared.fastly.steamstatic.com/after.png"></div>`;

  it('reads lazy-loaded images, srcset, relative URLs and single quotes', () => {
    const awards = parseAwards(
      wrap(`
        <img src="data:image/gif;base64,R0lGOD" data-src="/store_item_assets/steam/apps/1/extras/a.png" width='300' height="200" alt="Best Indie">
        <img src="https://store.fastly.steamstatic.com/public/images/trans.gif" srcset="https://shared.fastly.steamstatic.com/b_1x.png 1x, https://shared.fastly.steamstatic.com/b_2x.png 2x">
      `),
      'https://store.steampowered.com/app/1/',
      1
    );
    assert.deepEqual(
      awards.awardsImages.map(({ url, alt, width }) => ({ url, alt, width })),
      [
        {
          url: 'https://store.steampowered.com/store_item_assets/steam/apps/1/extras/a.png',
          alt: 'Best Indie',
          width: 300,
        },
        { url: 'https://shared.fastly.steamstatic.com/b_2x.png', alt: null, width: null },
      ]
    );
  });

  it('ignores markup in scripts and comments, and stops at the section’s end', () => {
    const urls = parseAwards(wrap(''), 'https://store.steampowered.com/app/1/', 1).awardsImages;
    assert.deepEqual(urls, []);
  });

  it('takes only Steam’s hosts, moves http to https, and drops screenshots, headers and spacers', () => {
    const awards = parseAwards(
      wrap(`
        <img src="https://evil.example.com/award.png">
        <img src="http://cdn.akamai.steamstatic.com/steam/apps/1/extras/old.gif">
        <img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/ss_0123abcd.1920x1080.jpg">
        <img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/header.jpg">
        <img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/extras/dot.png" width="1" height="1">
        <img src="https://evilakamaihd.net/x.png">
        <img src="https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/extras/old.gif">
      `),
      'https://store.steampowered.com/app/1/',
      1
    );
    assert.deepEqual(
      awards.awardsImages.map((image) => image.url),
      [
        'https://cdn.akamai.steamstatic.com/steam/apps/1/extras/old.gif',
        'https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/1/extras/old.gif',
      ]
    );
  });

  it('is not a store page when Steam answered with its age check or front page', () => {
    assert.equal(isStorePage('<div class="agegate_birthday_selector"></div>'), false);
    assert.equal(isStorePage('<html><title>Welcome to Steam</title></html>'), false);
  });
});

describe('the HTML helpers', () => {
  it('parses the three ways Steam writes an attribute', () => {
    assert.deepEqual(
      parseAttributes(
        ` class="bb_img" src="https://x/a.avif?t=1" data-big-src=https://x/b.avif?t=2 width=800 alt='Award &amp; more' /`
      ),
      {
        class: 'bb_img',
        src: 'https://x/a.avif?t=1',
        'data-big-src': 'https://x/b.avif?t=2',
        width: '800',
        alt: 'Award & more',
      }
    );
  });

  it('finds an element by id across nested tags of its own name', () => {
    assert.equal(
      elementById('<p><div id="a"><div><div></div></div>x</div><div>no</div></p>', 'a'),
      '<div id="a"><div><div></div></div>x</div>'
    );
    assert.equal(elementById('<div id="ab"></div>', 'a'), null);
  });

  it('decodes named and numeric entities', () => {
    assert.equal(
      decodeEntities('Director&rsquo;s Cut &#8212; &#x2605; &amp;'),
      'Director’s Cut — ★ &'
    );
  });
});

describe('parseEvents, on real responses', () => {
  it('reads Elden Ring’s posts, newest first, with kinds and images', () => {
    const result = parseEvents(events('elden-ring'), 1245620);
    assert.equal(result.newsUrl, 'https://store.steampowered.com/news/app/1245620');
    assert.deepEqual(
      result.events.map((event) => [event.type, event.kind]),
      [
        [28, 'news'],
        [28, 'news'],
        [25, 'event'],
        [15, 'release'],
        [13, 'update'],
        [28, 'news'],
      ]
    );
    for (let index = 1; index < result.events.length; index += 1) {
      assert.ok(result.events[index - 1].startsAt >= result.events[index].startsAt);
    }

    const first = result.events[0];
    assert.equal(first.title, 'STARSCOURGE RADAHN JOINS THE ELDEN RING FIGUARTS MINI SERIES');
    assert.equal(
      first.imageUrl,
      'https://clan.fastly.steamstatic.com/images/41005067/e4eb4adc4aa0664bc67bb0da995c6cfd734844ec_400x225.jpg'
    );
    assert.equal(
      first.imageLargeUrl,
      'https://clan.fastly.steamstatic.com/images/41005067/e4eb4adc4aa0664bc67bb0da995c6cfd734844ec.jpg'
    );
    assert.equal(first.url, `https://store.steampowered.com/news/app/1245620/view/${first.id}`);
  });

  it('keeps an in-game event’s window: Community Quests runs for months', () => {
    const quests = parseEvents(events('elden-ring'), 1245620).events.find(
      (event) => event.type === 25
    );
    assert.ok(quests?.endsAt && quests.endsAt - quests.startsAt > 60 * 86_400);
    assert.equal(quests?.summary?.startsWith('A journey of many paths awaits, Tarnished.'), true);
  });

  it('falls back to the body as text when there is no summary (Counter-Strike 2)', () => {
    const [update] = parseEvents(events('counter-strike-2'), 730).events;
    assert.equal(update.kind, 'update');
    assert.equal(update.imageUrl, null);
    assert.ok(
      update.summary?.startsWith('[ UI ] Demo/Replay viewer improvements:'),
      update.summary ?? ''
    );
    assert.doesNotMatch(update.summary ?? '', /\[\/?(p|list|\*)\]/);
  });

  it('files a post cross-posted from another game as news (Disco Elysium)', () => {
    const result = parseEvents(events('disco-elysium'), 632470);
    assert.equal(result.events[0].type, 34);
    assert.equal(result.events[0].kind, 'news');
    assert.match(
      result.events[0].imageUrl ?? '',
      /^https:\/\/clan\.fastly\.steamstatic\.com\/images\/28912883\//
    );
  });

  it('is an empty list for an answer of the wrong shape', () => {
    assert.deepEqual(parseEvents(null, 1).events, []);
    assert.deepEqual(parseEvents({ events: 'no' }, 1).events, []);
    assert.deepEqual(parseEvents({ events: [{ gid: '1' }] }, 1).events, []);
  });

  it('honours the limit', () => {
    assert.equal(parseEvents(events('disco-elysium'), 632470, 3).events.length, 3);
  });
});

describe('the text helpers', () => {
  it('turns BBCode into a line of text', () => {
    assert.equal(
      bbcodeToText(
        '[h2]New [b]patch[/b][/h2][img]{STEAM_CLAN_IMAGE}/1/a.png[/img][list][*]Fixed \\[ UI \\][*][url="https://x"]More[/url][/list]'
      ),
      'New patch • Fixed [ UI ] • More'
    );
  });

  it('cuts at a word and says so', () => {
    assert.equal(excerpt('one two three four', 11), 'one two…');
    assert.equal(excerpt('short', 20), 'short');
    assert.equal(excerpt('   ', 20), null);
  });

  it('groups Steam’s event types', () => {
    assert.equal(eventKindOf(12), 'update');
    assert.equal(eventKindOf(20), 'sale');
    assert.equal(eventKindOf(18), 'stream');
    assert.equal(eventKindOf(25), 'event');
    assert.equal(eventKindOf(999), 'event');
  });
});
