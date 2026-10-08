import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

/*
 * The matcher lives with the Edge Function that runs it, which is deployed on
 * its own and cannot import from `src/`. It imports nothing itself, so it loads
 * here by relative path. Every fixture is shaped like SoundCloud's OpenAPI
 * `Track` and `Playlist`; none is a real response, because the project had no
 * API credentials when these were written.
 */
import {
  GAME_TAGS,
  choosePlaylist,
  dedupe,
  isSoundtrackTrack,
  matchTracks,
  namesGame,
  parseTags,
  playlistTracks,
  scorePlaylist,
  searchQueries,
  titleForms,
  toTrack,
  trackKey,
  type ScPlaylist,
  type ScTrack,
} from '../../../supabase/functions/_shared/soundcloud-match.ts';

const HADES = { title: 'Hades', developer: 'Supergiant Games' };

let serial = 0;
function track(title: string, extra: Partial<ScTrack> = {}): ScTrack {
  serial += 1;
  return {
    urn: `soundcloud:tracks:${serial}`,
    title,
    duration: 180_000,
    tag_list: 'soundtrack videogame',
    access: 'playable',
    playback_count: 1000,
    permalink_url: `https://soundcloud.com/someone/${serial}`,
    user: { username: 'someone', permalink_url: 'https://soundcloud.com/someone' },
    ...extra,
  };
}

function playlist(title: string, extra: Partial<ScPlaylist> = {}): ScPlaylist {
  serial += 1;
  return {
    urn: `soundcloud:playlists:${serial}`,
    title,
    track_count: 30,
    likes_count: 100,
    user: { username: 'someone' },
    ...extra,
  };
}

describe('namesGame', () => {
  it('finds a game named the way soundtracks are named', () => {
    for (const title of [
      'Hades: Original Soundtrack',
      'Hades OST',
      'HADES (Original Game Soundtrack)',
      'Music from Hades',
      'Hades Soundtrack Vol. 2',
      'Darren Korb - Hades - Out of Tartarus',
      'Out of Tartarus | Hades OST',
      'Out of Tartarus (Hades Original Soundtrack)',
      'Hades (2020) Full OST',
    ]) {
      assert.ok(namesGame(title, 'Hades'), title);
    }
  });

  it('refuses a sequel, in digits or in numerals', () => {
    assert.ok(!namesGame('Hades II - Original Soundtrack', 'Hades'));
    assert.ok(!namesGame('Hades 2 OST', 'Hades'));
    assert.ok(!namesGame('Portal 2: Songs to Test By', 'Portal'));
    /* And finds the sequel when the sequel is what was asked for. */
    assert.ok(namesGame('Hades II - Original Soundtrack', 'Hades II'));
    assert.ok(namesGame('Hades 2 OST', 'Hades II'));
    assert.ok(namesGame('Portal 2: Songs to Test By', 'Portal 2'));
  });

  it('refuses a longer title that only begins with the game', () => {
    assert.ok(!namesGame('Doom Eternal OST', 'Doom'));
    assert.ok(!namesGame('Journey to the West Soundtrack', 'Journey'));
    assert.ok(!namesGame('Portal Knights OST', 'Portal'));
    assert.ok(namesGame('DOOM (2016) OST', 'Doom'));
  });

  it('refuses a title the game is buried in', () => {
    assert.ok(!namesGame("A Dog's Journey (Original Motion Picture Soundtrack)", 'Journey'));
    assert.ok(!namesGame('Super Mario Odyssey OST', 'Odyssey'));
    assert.ok(!namesGame('The Hobbit: An Unexpected Journey', 'Journey'));
  });

  it('reads a title with its own punctuation', () => {
    assert.ok(
      namesGame('The Witcher 3: Wild Hunt - Official Soundtrack', 'The Witcher 3: Wild Hunt')
    );
    /* Without its article, and without its colon. */
    assert.ok(namesGame('Witcher 3 Wild Hunt OST', 'The Witcher 3: Wild Hunt'));
    assert.ok(namesGame('Half-Life 2 OST', 'Half-Life 2'));
    assert.ok(namesGame('NieR:Automata Original Soundtrack', 'NieR: Automata'));
    assert.ok(namesGame("Assassin's Creed II (Original Game Soundtrack)", "Assassin's Creed II"));
    assert.ok(!namesGame("Assassin's Creed II OST", "Assassin's Creed"));
  });

  it('finds a re-release under the name of the game it re-releases', () => {
    assert.ok(namesGame('The Last of Us (Original Score)', 'The Last of Us Remastered'));
    assert.ok(namesGame('Last of Us OST', 'The Last of Us'));
    assert.deepEqual(
      titleForms('The Last of Us Remastered').map((form) => form.join(' ')),
      ['the last of us remastered', 'the last of us', 'last of us remastered', 'last of us']
    );
  });

  it('answers no for nothing', () => {
    assert.ok(!namesGame('', 'Hades'));
    assert.ok(!namesGame('Hades OST', ''));
  });
});

describe('parseTags', () => {
  it('reads quoted tags as one tag', () => {
    assert.deepEqual(parseTags('"video game" soundtrack OST "Hollow Knight"'), [
      'video game',
      'soundtrack',
      'ost',
      'hollow knight',
    ]);
    assert.deepEqual(parseTags(null), []);
    assert.deepEqual(parseTags(''), []);
  });
});

describe('searchQueries', () => {
  it('asks for playlists by name, and for tracks once per tag', () => {
    const queries = searchQueries('  Hollow   Knight ');
    assert.deepEqual(queries.playlists, ['Hollow Knight soundtrack', 'Hollow Knight OST']);
    assert.deepEqual(
      queries.taggedTracks.map((entry) => entry.tag),
      ['videogame', 'videogames', 'games']
    );
    assert.ok(queries.taggedTracks.every((entry) => entry.q === 'Hollow Knight'));
    assert.deepEqual([...GAME_TAGS], ['videogame', 'videogames', 'games']);
  });

  it('asks nothing for no title', () => {
    const queries = searchQueries('   ');
    assert.equal(queries.playlists.length + queries.taggedTracks.length + queries.tracks.length, 0);
  });
});

describe('choosePlaylist', () => {
  it('takes the playlist that says it is the soundtrack', () => {
    const real = playlist('Hades: Original Soundtrack', { user: { username: 'Supergiant Games' } });
    const chosen = choosePlaylist(
      [playlist('Hades'), real, playlist('Hades OST', { likes_count: 3 })],
      HADES
    );
    assert.equal(chosen?.urn, real.urn);
  });

  it('refuses a playlist that is only named after the game', () => {
    assert.equal(scorePlaylist(playlist('Hades'), HADES), null);
    assert.equal(choosePlaylist([playlist('Hades'), playlist('hades <3')], HADES), null);
  });

  it('believes the developer and the tags without the word "soundtrack"', () => {
    const official = playlist('Hades', {
      user: { username: 'SupergiantGames' },
      tag_list: 'videogame soundtrack',
    });
    assert.ok((scorePlaylist(official, HADES) ?? 0) >= 4);
  });

  it('refuses covers, remixes, mixes, films and other games', () => {
    for (const title of [
      'Hades OST Piano Covers',
      'Hades Soundtrack (Lofi Remix)',
      'Hades OST 8-bit',
      'Best of Hades OST',
      'Hades OST chill mix',
      'Hades (Original Motion Picture Soundtrack)',
      'Hades II Original Soundtrack',
      'Hades Podcast',
    ]) {
      assert.equal(scorePlaylist(playlist(title), HADES), null, title);
    }
  });

  it('refuses a cover album by its tags, and keeps one tagged with its instruments', () => {
    assert.equal(scorePlaylist(playlist('Hades OST', { tag_list: 'cover fanmade' }), HADES), null);
    assert.ok(scorePlaylist(playlist('Hades OST', { tag_list: 'rock metal piano' }), HADES));
  });

  it('refuses a playlist of one or two tracks, and never the same one twice', () => {
    assert.equal(scorePlaylist(playlist('Hades OST', { track_count: 2 }), HADES), null);
    const one = playlist('Hades OST');
    assert.equal(choosePlaylist([one, one], HADES)?.urn, one.urn);
  });

  it('keeps a game whose own name holds a refused word', () => {
    const metalGear = { title: 'Metal Gear Solid' };
    assert.ok(scorePlaylist(playlist('Metal Gear Solid Original Soundtrack'), metalGear));
    assert.ok(scorePlaylist(playlist('Guitar Hero OST'), { title: 'Guitar Hero' }));
  });
});

describe('isSoundtrackTrack', () => {
  it('wants the game named and a sign that it is game music', () => {
    assert.ok(isSoundtrackTrack(track('Hades - Out of Tartarus'), HADES));
    /* Named, with none of the tags and no soundtrack word: could be anything. */
    assert.ok(!isSoundtrackTrack(track('Hades - Out of Tartarus', { tag_list: 'rock' }), HADES));
    /* Game music by its tags, about some other game. */
    assert.ok(!isSoundtrackTrack(track('Out of Tartarus'), HADES));
  });

  it('accepts each of the three tags, and the game as a tag', () => {
    for (const tag of GAME_TAGS) {
      assert.ok(isSoundtrackTrack(track('Hades - No Escape', { tag_list: tag }), HADES), tag);
    }
    assert.ok(isSoundtrackTrack(track('No Escape', { tag_list: 'Hades "video game"' }), HADES));
    assert.ok(
      isSoundtrackTrack(track('No Escape', { tag_list: 'hades', genre: 'Soundtrack' }), HADES)
    );
  });

  it('refuses versions, films, the unplayable and the wrong length', () => {
    assert.ok(!isSoundtrackTrack(track('Hades OST - Out of Tartarus (Piano Cover)'), HADES));
    assert.ok(
      !isSoundtrackTrack(track('Hades - Out of Tartarus', { tag_list: 'ost remix' }), HADES)
    );
    assert.ok(!isSoundtrackTrack(track('Hades OST', { access: 'blocked' }), HADES));
    assert.ok(!isSoundtrackTrack(track('Hades Full OST', { duration: 2 * 60 * 60_000 }), HADES));
    assert.ok(!isSoundtrackTrack(track('Hades OST sting', { duration: 9_000 }), HADES));
    assert.ok(!isSoundtrackTrack(track('Hades II OST - Death to Chronos'), HADES));
  });

  it('keeps a real track tagged with the instrument it is played on', () => {
    const celeste = { title: 'Celeste' };
    assert.ok(
      isSoundtrackTrack(track('Celeste - Resurrections', { tag_list: 'piano soundtrack' }), celeste)
    );
  });
});

describe('dedupe', () => {
  it('reads past the game, the word OST, the number and the notes', () => {
    assert.equal(trackKey('Hades OST - 03 Out of Tartarus (Official)', 'Hades'), 'out of tartarus');
    assert.equal(
      trackKey('Out of Tartarus | Hades Original Soundtrack', 'Hades'),
      'out of tartarus'
    );
    assert.equal(trackKey('Hades OST', 'Hades'), 'hades ost');
  });

  it('keeps one of several uploads of the same piece', () => {
    const fan = track('Hades OST - Out of Tartarus', { playback_count: 50_000 });
    const official = track('Out of Tartarus | Hades Original Soundtrack', {
      playback_count: 900,
      duration: 181_500,
      user: { username: 'Supergiant Games' },
    });
    const kept = dedupe([fan, official, track('Hades - No Escape')], HADES);
    assert.equal(kept.length, 2);
    /* The developer's, though the fan's has fifty times the plays — and in the
       place the first of them stood. */
    assert.equal(kept[0].urn, official.urn);
  });

  it('prefers the full track to a preview, then the more played', () => {
    const preview = track('Hades - Good Times', { access: 'preview', playback_count: 9_000 });
    const full = track('Hades OST: Good Times', { playback_count: 10 });
    assert.equal(dedupe([preview, full], HADES)[0].urn, full.urn);

    const quiet = track('Hades - In the Blood', { playback_count: 10 });
    const loud = track('Hades OST - In the Blood', { playback_count: 5_000 });
    assert.equal(dedupe([quiet, loud], HADES)[0].urn, loud.urn);
  });

  it('keeps two tracks that share a name and not a length', () => {
    const intro = track('Hades - Theme', { duration: 45_000 });
    const whole = track('Hades - Theme', { duration: 240_000 });
    assert.equal(dedupe([intro, whole], HADES).length, 2);
  });

  it('drops the same upload met twice', () => {
    const once = track('Hades - No Escape');
    assert.equal(dedupe([once, { ...once }], HADES).length, 1);
  });
});

describe('the two ways to a soundtrack', () => {
  it('keeps a playlist in its own order, whatever its tracks are called', () => {
    const tracks = [
      track('No Escape', { tag_list: '' }),
      track('Out of Tartarus', { tag_list: '' }),
      track('The Painful Way', { tag_list: '' }),
    ];
    assert.deepEqual(
      playlistTracks(tracks, HADES).map((entry) => entry.title),
      ['No Escape', 'Out of Tartarus', 'The Painful Way']
    );
  });

  it('assembles one from search, the developer first and then the most played', () => {
    const tracks = [
      track('Hades - Out of Tartarus', { playback_count: 10 }),
      track('Hades OST - No Escape', { playback_count: 500 }),
      track('Hades - God of the Dead', {
        playback_count: 1,
        user: { username: 'Supergiant Games' },
      }),
      track('Hades Piano Cover'),
      track('Something else entirely'),
    ];
    assert.deepEqual(
      matchTracks(tracks, HADES).map((entry) => entry.title),
      ['Hades - God of the Dead', 'Hades OST - No Escape', 'Hades - Out of Tartarus']
    );
  });

  it('calls two matching uploads no soundtrack at all', () => {
    assert.deepEqual(matchTracks([track('Hades - A'), track('Hades - B')], HADES), []);
  });
});

describe('toTrack', () => {
  it('carries what a row needs to credit and link the upload', () => {
    const made = toTrack(
      track('Hades - No Escape', {
        user: { username: 'Darren Korb', permalink_url: 'https://soundcloud.com/darrenkorb' },
        access: 'preview',
        playback_count: null,
      })
    );
    assert.equal(made?.uploader.name, 'Darren Korb');
    assert.equal(made?.uploader.permalinkUrl, 'https://soundcloud.com/darrenkorb');
    assert.equal(made?.access, 'preview');
    assert.equal(made?.plays, null);
    assert.ok(made?.permalinkUrl?.startsWith('https://soundcloud.com/'));
  });

  it('refuses an entry with no id or no name', () => {
    assert.equal(toTrack({ title: 'x' }), null);
    assert.equal(toTrack({ urn: 'soundcloud:tracks:1', title: '  ' }), null);
  });
});
