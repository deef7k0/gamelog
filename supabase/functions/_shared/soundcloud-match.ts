/**
 * Which SoundCloud uploads are *this game's soundtrack*.
 *
 * SoundCloud has no "video game soundtrack" category and no catalogue of
 * albums: a search for a game's name returns its soundtrack beside lofi
 * remixes, piano covers, podcasts about it, a film that shares its name and
 * the soundtrack of its sequel. Everything here is the judgement that tells
 * those apart, and it is pure — text in, a verdict out — so it can be tested
 * without credentials, which the project did not have when it was written.
 *
 * ## Where it runs, and why it lives here
 *
 * In the `soundcloud` Edge Function, which holds the API secret and the shared
 * match cache. An Edge Function is deployed on its own and cannot import from
 * `src/`, so the module sits in `_shared/`. It imports nothing — no Deno
 * global, no URL import — which is what lets `npm test` load the same file by
 * relative path (`src/lib/soundcloud/match.test.ts`). Keep it that way.
 *
 * ## The three rules, in the owner's words
 *
 * "Matching titles with the videogame name, no duplicates, no unrelated
 * playlists", and SoundCloud's tags where they help:
 *
 *  1. **It must name the game** (`namesGame`). Not "contains the word":
 *     *Hades II*, *Doom Eternal* and *Journey to the West* all contain a
 *     shorter game's whole title. The title has to stand as its own phrase,
 *     with only soundtrack words around it.
 *  2. **A playlist is preferred, and has to earn it** (`choosePlaylist`). One
 *     uploader's soundtrack, in order, beats a list assembled from a dozen
 *     accounts. A playlist that is a cover album, a "best of" mix or a film's
 *     score is refused however well it is named.
 *  3. **No two entries for one piece of music** (`dedupe`). The same track is
 *     uploaded by the composer, the publisher and three fans.
 *
 * The tags — `videogame`, `videogames`, `games` — are searched one request
 * each, because the API does not say whether several tags mean all of them or
 * any of them, and every result's own `tag_list` is then read again here.
 */

/** Bump when a change here would choose differently: stored matches of another version are re-run. */
export const MATCHER_VERSION = 1;

/** The tags the track search is run with, one request per tag. */
export const GAME_TAGS = ['videogame', 'videogames', 'games'] as const;

// ---------------------------------------------------------------------------
// SoundCloud's shapes — the fields of its OpenAPI `Track`, `Playlist` and
// `User` that are read here. Everything is optional: this is somebody else's
// JSON.
// ---------------------------------------------------------------------------

export type ScUser = {
  urn?: string | null;
  username?: string | null;
  permalink_url?: string | null;
};

export type ScTrack = {
  urn?: string | null;
  title?: string | null;
  /** Milliseconds. */
  duration?: number | null;
  genre?: string | null;
  /** Space separated; a tag of several words is in double quotes. */
  tag_list?: string | null;
  permalink_url?: string | null;
  artwork_url?: string | null;
  playback_count?: number | null;
  access?: 'playable' | 'preview' | 'blocked' | null;
  user?: ScUser | null;
};

export type ScPlaylist = {
  urn?: string | null;
  title?: string | null;
  track_count?: number | null;
  genre?: string | null;
  tag_list?: string | null;
  tags?: string | null;
  permalink_url?: string | null;
  likes_count?: number | null;
  user?: ScUser | null;
  tracks?: ScTrack[] | null;
};

/** The game being matched. The developer is what makes an upload "theirs". */
export type MatchGame = {
  title: string;
  developer?: string | null;
};

/** A track as the app is handed it: enough to list, credit, link and play. */
export type MatchedTrack = {
  urn: string;
  title: string;
  /** Whoever uploaded it — the creator SoundCloud's terms require crediting. */
  uploader: { name: string; permalinkUrl: string | null };
  durationMs: number | null;
  artworkUrl: string | null;
  /** The track's page on soundcloud.com, which every row links back to. */
  permalinkUrl: string | null;
  access: 'playable' | 'preview' | 'blocked';
  /** Play count, or null when the uploader hides it. Ranks "popular" picks. */
  plays: number | null;
};

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/**
 * Words that may stand beside a game's title without making it another title:
 * what a soundtrack is called, and the small words that join it on.
 * "Hades: Original Soundtrack", "Music from Celeste", "DOOM (Original Game
 * Soundtrack)".
 */
const EDGE_WORDS = new Set([
  'soundtrack', 'soundtracks', 'ost', 'osts', 'original', 'official', 'score', 'scores',
  'music', 'bgm', 'vgm', 'game', 'games', 'video', 'videogame', 'theme', 'themes', 'songs',
  'complete', 'full', 'album', 'deluxe', 'extended', 'digital', 'collection', 'selection',
  'selections', 'edition', 'sound', 'sounds', 'track', 'tracks', 'audio', 'ep', 'lp',
  'the', 'a', 'an', 'of', 'from', 'for', 'to', 'and', 'in', 'on',
]);

/** After one of these a bare number is a volume, not a sequel: "Vol. 2", "Disc 1". */
const COUNTERS = new Set(['vol', 'volume', 'disc', 'disk', 'cd', 'part', 'pt', 'no', 'side']);

/** What says "this is a soundtrack" in a title. */
const SOUNDTRACK_WORDS = ['soundtrack', 'soundtracks', 'ost', 'score', 'bgm', 'vgm'];

/** What says "this is game music" in a tag or a genre. The first three are the owner's. */
const GAME_SIGNALS = new Set([
  'videogame', 'videogames', 'games', 'game', 'video game', 'video games', 'gaming', 'vgm',
  'soundtrack', 'ost', 'game music', 'video game music', 'videogame music',
  'game soundtrack', 'video game soundtrack', 'videogame soundtrack', 'game ost', 'bgm',
]);

/**
 * What makes an upload somebody's *version* of the music, or not music at all.
 * Any one of these refuses the upload — unless the game's own name contains
 * it, which is why this is checked against the title's words first.
 */
const NOT_THE_SOUNDTRACK = [
  'cover', 'covers', 'covered', 'remix', 'remixes', 'remixed', 'rmx', 'bootleg', 'mashup',
  'lofi', 'lo fi', 'piano', 'acoustic', 'guitar', 'metal', 'orchestrated', 'arrangement',
  'arranged', 'rearranged', 'reimagined', '8 bit', '8bit', '16 bit', 'chiptune',
  'nightcore', 'slowed', 'reverb', 'sped up', 'bass boosted', 'music box', 'lullaby',
  'inspired by', 'fan made', 'fanmade', 'tribute', 'parody', 'type beat', 'freestyle',
  'podcast', 'review', 'gameplay', 'let s play', 'lets play', 'walkthrough', 'trailer',
  'reaction', 'asmr', 'karaoke', 'tutorial', 'interview', 'commentary', 'episode',
];

/**
 * The same refusal, read from tags — but only the words that name a *version*.
 *
 * A soundtrack's own tracks are tagged with their instruments: Celeste's are
 * tagged "piano" and half of DOOM's "metal". In a title those words mean a
 * cover album; in a tag they describe the music.
 */
const VERSION_TAGS = [
  'cover', 'covers', 'remix', 'remixes', 'rmx', 'bootleg', 'mashup', 'lofi', 'lo fi',
  'nightcore', 'slowed', 'sped up', 'bass boosted', 'fan made', 'fanmade', 'tribute',
  'parody', 'type beat', 'podcast', 'karaoke',
];

/** A film, a series or an anime that shares the game's name. */
const NOT_A_GAME = [
  'motion picture', 'film', 'movie', 'tv series', 'television', 'netflix', 'anime',
  'broadway', 'musical', 'season',
];

/** A playlist of many games' music, which is nobody's soundtrack. */
const A_MIX = [
  'best', 'top', 'mix', 'mixtape', 'compilation', 'various', 'favorites', 'favourites',
  'greatest', 'radio', 'study', 'relax', 'relaxing', 'chill', 'sleep', 'my',
];

/** What a re-release adds to a name without making it a different soundtrack. */
const EDITION_TAILS = [
  ['game', 'of', 'the', 'year', 'edition'],
  ['definitive', 'edition'], ['complete', 'edition'], ['special', 'edition'],
  ['enhanced', 'edition'], ['anniversary', 'edition'], ['ultimate', 'edition'],
  ['deluxe', 'edition'], ['gold', 'edition'], ['directors', 'cut'], ['director', 's', 'cut'],
  ['remastered'], ['remaster'], ['goty'], ['hd'],
];

/** Roman numerals a title ends its name with. Not `i`, `v` or `x`: those are words and letters too. */
const NUMERALS: Record<string, string> = {
  ii: '2', iii: '3', iv: '4', vi: '6', vii: '7', viii: '8', ix: '9',
  xi: '11', xii: '12', xiii: '13', xiv: '14', xv: '15', xvi: '16',
};

// ---------------------------------------------------------------------------
// Reading a title
// ---------------------------------------------------------------------------

/** A word of a title, and which stretch between punctuation it stood in. */
type Word = { text: string; segment: number };

/** What separates the parts of a title: "Hades - Out of Tartarus", "Celeste (Original Soundtrack)". */
const SEPARATORS = /[-–—|:()[\]{}/\\~•·"“”«»,;!?]+/;

function plain(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`´]/g, '');
}

/** A title as words, each knowing which side of the punctuation it was on. */
function words(text: string): Word[] {
  const result: Word[] = [];
  plain(text)
    .split(SEPARATORS)
    .forEach((part, segment) => {
      for (const raw of part.split(/[^a-z0-9]+/)) {
        if (!raw) continue;
        /* Never the first word of the whole title: "V Rising" and "X-COM"
           begin with a letter, not a number. */
        const numeral = result.length > 0 ? NUMERALS[raw] : undefined;
        result.push({ text: numeral ?? raw, segment });
      }
    });
  return result;
}

/** A title flattened to one string, for phrase checks. */
export function normalise(text: string): string {
  return words(text)
    .map((word) => word.text)
    .join(' ');
}

function isNumber(text: string): boolean {
  return /^\d+$/.test(text);
}

function isYear(text: string): boolean {
  return /^(19|20)\d\d$/.test(text);
}

function endsWith(list: string[], tail: string[]): boolean {
  if (tail.length >= list.length) return false;
  return tail.every((word, index) => list[list.length - tail.length + index] === word);
}

/**
 * The names a game may be found under: as given, without a leading "the", and
 * without what a re-release tacked on. "The Last of Us Remastered" is looked
 * for as that, as "last of us remastered", and as "the last of us".
 */
export function titleForms(title: string): string[][] {
  const full = words(title).map((word) => word.text);
  if (full.length === 0) return [];

  const forms: string[][] = [full];
  let base = full;
  for (const tail of EDITION_TAILS) {
    if (endsWith(base, tail)) {
      base = base.slice(0, base.length - tail.length);
      forms.push(base);
      break;
    }
  }
  for (const form of [...forms]) {
    if (form[0] === 'the' && form.length > 1) forms.push(form.slice(1));
  }

  const seen = new Set<string>();
  return forms.filter((form) => {
    const key = form.join(' ');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Whether the words beside a title are only the kind a soundtrack is named
 * with. `run` is everything between the title and the nearest punctuation, in
 * reading order.
 *
 * A bare number is the heart of it. "Hades 2" is another game; "Hades OST
 * Vol. 2" and "DOOM (2016)" are not. So a number passes only as a year or
 * straight after a counter word.
 */
function onlyEdgeWords(run: string[]): boolean {
  return run.every((word, index) => {
    if (COUNTERS.has(word)) return true;
    if (isNumber(word)) return isYear(word) || (index > 0 && COUNTERS.has(run[index - 1]));
    return EDGE_WORDS.has(word);
  });
}

/**
 * Whether a title names this game, as its own phrase.
 *
 * The game's words must appear together, and what stands beside them — out to
 * the nearest punctuation on each side — may only be soundtrack words. That
 * one rule is the sequel guard ("Hades II"), the longer-title guard ("Doom
 * Eternal" for *Doom*, "Journey to the West" for *Journey*) and the
 * buried-title guard ("Super Mario Odyssey" for a game called *Odyssey*).
 */
export function namesGame(candidate: string, gameTitle: string): boolean {
  const text = words(candidate);
  if (text.length === 0) return false;

  for (const form of titleForms(gameTitle)) {
    for (let start = 0; start + form.length <= text.length; start += 1) {
      if (!form.every((word, index) => text[start + index].text === word)) continue;

      const end = start + form.length;
      const before: string[] = [];
      for (let i = start - 1; i >= 0 && text[i].segment === text[start].segment; i -= 1) {
        before.unshift(text[i].text);
      }
      const after: string[] = [];
      for (let i = end; i < text.length && text[i].segment === text[end - 1].segment; i += 1) {
        after.push(text[i].text);
      }
      /* Before a title a counter means nothing, so a number there is only
         ever a year: "2016 DOOM OST". */
      const beforeOk = before.every((word) => EDGE_WORDS.has(word) || isYear(word));
      if (beforeOk && onlyEdgeWords(after)) return true;
    }
  }
  return false;
}

// ---------------------------------------------------------------------------
// Tags and signals
// ---------------------------------------------------------------------------

/** `tag_list` as its tags: `"video game" soundtrack ost` → three, the first of two words. */
export function parseTags(tagList: string | null | undefined): string[] {
  if (!tagList) return [];
  const tags: string[] = [];
  const pattern = /"([^"]+)"|(\S+)/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tagList)) !== null) {
    const tag = normalise(match[1] ?? match[2] ?? '');
    if (tag) tags.push(tag);
  }
  return tags;
}

function tagsOf(item: { tag_list?: string | null; tags?: string | null; genre?: string | null }) {
  const tags = [...parseTags(item.tag_list), ...parseTags(item.tags)];
  const genre = normalise(item.genre ?? '');
  if (genre) tags.push(genre);
  return tags;
}

/** Whether its tags or genre say it is game music. */
function hasGameSignal(tags: string[]): boolean {
  return tags.some((tag) => GAME_SIGNALS.has(tag) || GAME_SIGNALS.has(tag.replace(/ /g, '')));
}

function hasPhrase(haystack: string, phrase: string): boolean {
  return ` ${haystack} `.includes(` ${phrase} `);
}

/** The phrases of `list` found in `text` that the game's own name does not contain. */
function found(list: string[], text: string, gameTitle: string): string[] {
  const own = normalise(gameTitle);
  return list.filter((phrase) => hasPhrase(text, phrase) && !hasPhrase(own, phrase));
}

function saysSoundtrack(text: string): boolean {
  return SOUNDTRACK_WORDS.some((word) => hasPhrase(text, word));
}

/** Whether the account that uploaded it is the game's developer. */
function isDevelopers(user: ScUser | null | undefined, game: MatchGame): boolean {
  const developer = normalise(game.developer ?? '').replace(/ /g, '');
  const uploader = normalise(user?.username ?? '').replace(/ /g, '');
  /* Short names match too much: "id" is in half the usernames there are. */
  if (developer.length < 4 || uploader.length < 4) return false;
  return uploader.includes(developer) || developer.includes(uploader);
}

// ---------------------------------------------------------------------------
// What to ask SoundCloud
// ---------------------------------------------------------------------------

export type SearchQueries = {
  /** `GET /playlists?q=…` */
  playlists: string[];
  /** `GET /tracks?q=…&tags=…`, one request per tag. */
  taggedTracks: { q: string; tag: string }[];
  /** `GET /tracks?q=…`, with no tag, for the soundtracks nobody tagged. */
  tracks: string[];
};

/** The searches for one game. Six requests, none of which counts as a play. */
export function searchQueries(gameTitle: string): SearchQueries {
  const title = gameTitle.trim().replace(/\s+/g, ' ');
  if (!title) return { playlists: [], taggedTracks: [], tracks: [] };
  return {
    playlists: [`${title} soundtrack`, `${title} OST`],
    taggedTracks: GAME_TAGS.map((tag) => ({ q: title, tag })),
    tracks: [`${title} soundtrack`],
  };
}

// ---------------------------------------------------------------------------
// Playlists
// ---------------------------------------------------------------------------

/** A playlist has to reach this to be believed. A name and a soundtrack word get there. */
const PLAYLIST_THRESHOLD = 4;

/**
 * How convincingly a playlist is this game's soundtrack, or null if it is not.
 *
 * Refused outright: one that does not name the game; a cover album, a remix
 * set, a podcast; a film's score; a "best of" mix; one known to hold fewer
 * than three tracks. Everything else is scored, and the soundtrack word is
 * worth the most — "Hades" alone, from a stranger, is a playlist somebody
 * named after a game.
 */
export function scorePlaylist(playlist: ScPlaylist, game: MatchGame): number | null {
  const title = playlist.title ?? '';
  if (!playlist.urn || !namesGame(title, game.title)) return null;

  const text = normalise(title);
  if (found(NOT_THE_SOUNDTRACK, text, game.title).length > 0) return null;
  if (found(NOT_A_GAME, text, game.title).length > 0) return null;
  if (found(A_MIX, text, game.title).length > 0) return null;

  const count = playlist.track_count;
  if (typeof count === 'number' && count < 3) return null;

  const tags = tagsOf(playlist);
  if (found(VERSION_TAGS, tags.join(' | '), game.title).length > 0) return null;

  let score = 0;
  if (saysSoundtrack(text)) score += 4;
  if (hasGameSignal(tags)) score += 2;
  if (isDevelopers(playlist.user, game)) score += 3;
  if (typeof count === 'number' && count >= 5 && count <= 300) score += 1;
  /* A tie-break and no more: ten thousand likes are worth two points. */
  score += Math.min(2, Math.log10((playlist.likes_count ?? 0) + 1) * 0.5);

  return score >= PLAYLIST_THRESHOLD ? score : null;
}

/** The one playlist to show as this game's soundtrack, or null. */
export function choosePlaylist(playlists: ScPlaylist[], game: MatchGame): ScPlaylist | null {
  let best: ScPlaylist | null = null;
  let bestScore = -Infinity;
  const seen = new Set<string>();

  for (const playlist of playlists) {
    if (!playlist.urn || seen.has(playlist.urn)) continue;
    seen.add(playlist.urn);
    const score = scorePlaylist(playlist, game);
    if (score !== null && score > bestScore) {
      best = playlist;
      bestScore = score;
    }
  }
  return best;
}

// ---------------------------------------------------------------------------
// Tracks
// ---------------------------------------------------------------------------

const MIN_TRACK_MS = 30_000;
/** Over this it is a whole soundtrack ripped into one file, or an hour-long loop. */
const MAX_TRACK_MS = 15 * 60_000;
/** Fewer tracks than this is a couple of uploads, not a soundtrack. */
export const MIN_TRACKS = 3;
/** The most a soundtrack is ever shown as. */
export const MAX_TRACKS = 300;

export function toTrack(raw: ScTrack): MatchedTrack | null {
  if (!raw.urn || !raw.title?.trim()) return null;
  return {
    urn: raw.urn,
    title: raw.title.trim(),
    uploader: {
      name: raw.user?.username?.trim() || 'Unknown uploader',
      permalinkUrl: raw.user?.permalink_url ?? null,
    },
    durationMs: typeof raw.duration === 'number' && raw.duration > 0 ? raw.duration : null,
    artworkUrl: raw.artwork_url ?? null,
    permalinkUrl: raw.permalink_url ?? null,
    access: raw.access === 'preview' || raw.access === 'blocked' ? raw.access : 'playable',
    plays: typeof raw.playback_count === 'number' ? raw.playback_count : null,
  };
}

/**
 * Whether a track found by search — not inside a chosen playlist — belongs to
 * this game's soundtrack.
 *
 * It has to name the game, in its title or as one of its tags, **and** say it
 * is game music: one of the owner's tags (`videogame`, `videogames`, `games`),
 * a soundtrack tag or genre, or a soundtrack word in the title. Then the same
 * refusals as a playlist, a sane length, and something that can be heard.
 */
export function isSoundtrackTrack(track: ScTrack, game: MatchGame): boolean {
  const title = track.title ?? '';
  if (!track.urn || !title.trim()) return false;
  if (track.access === 'blocked') return false;

  const tags = tagsOf(track);
  const text = normalise(title);
  const forms = titleForms(game.title).map((form) => form.join(' '));
  const taggedAsGame = tags.some((tag) => forms.includes(tag));
  if (!namesGame(title, game.title) && !taggedAsGame) return false;

  if (!hasGameSignal(tags) && !saysSoundtrack(text)) return false;

  if (found(NOT_THE_SOUNDTRACK, text, game.title).length > 0) return false;
  if (found(VERSION_TAGS, tags.join(' | '), game.title).length > 0) return false;
  if (found(NOT_A_GAME, `${text} | ${tags.join(' | ')}`, game.title).length > 0) return false;

  const duration = track.duration;
  if (typeof duration === 'number' && (duration < MIN_TRACK_MS || duration > MAX_TRACK_MS)) {
    return false;
  }
  return true;
}

/**
 * What a track is called once the game's name, "OST", its number and its
 * bracketed notes are taken off: "Hades OST - 03 Out of Tartarus (Official)"
 * and "Out of Tartarus | Hades Original Soundtrack" are both "out of tartarus".
 */
export function trackKey(title: string, gameTitle: string): string {
  const withoutNotes = title.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ');
  let text = ` ${normalise(withoutNotes)} `;
  for (const form of titleForms(gameTitle)) text = text.replace(` ${form.join(' ')} `, ' ');

  const kept = text
    .trim()
    .split(' ')
    .filter((word) => word && !SOUNDTRACK_WORDS.includes(word) && word !== 'original')
    /* A leading track number: "03 Out of Tartarus". */
    .filter((word, index) => !(index === 0 && /^\d{1,3}$/.test(word)));

  /* A title that was nothing but the game's name keeps its own name as its
     key, so two such uploads still collapse and it never matches "". */
  return kept.join(' ') || normalise(title);
}

const DUPLICATE_WINDOW_MS = 3_000;

/** Which of two uploads of one piece to keep: the developer's, then playable, then the more played. */
function better(a: ScTrack, b: ScTrack, game: MatchGame): ScTrack {
  const aDev = isDevelopers(a.user, game);
  const bDev = isDevelopers(b.user, game);
  if (aDev !== bDev) return aDev ? a : b;

  const aFull = a.access !== 'preview' && a.access !== 'blocked';
  const bFull = b.access !== 'preview' && b.access !== 'blocked';
  if (aFull !== bFull) return aFull ? a : b;

  return (b.playback_count ?? 0) > (a.playback_count ?? 0) ? b : a;
}

/**
 * One entry per piece of music, in the order they arrived.
 *
 * The same upload twice (by URN) is the easy case. The real one is the same
 * track uploaded by several accounts: same name once the game's is taken off,
 * and the same length to within three seconds. Two tracks that share a name
 * and differ in length — an intro and its full version — are both kept.
 */
export function dedupe(tracks: ScTrack[], game: MatchGame): ScTrack[] {
  const kept: { key: string; track: ScTrack }[] = [];
  const urns = new Set<string>();

  for (const track of tracks) {
    if (!track.urn || urns.has(track.urn)) continue;
    urns.add(track.urn);

    const key = trackKey(track.title ?? '', game.title);
    const twin = kept.find((entry) => {
      if (entry.key !== key) return false;
      const a = entry.track.duration;
      const b = track.duration;
      if (typeof a !== 'number' || typeof b !== 'number') return true;
      return Math.abs(a - b) <= DUPLICATE_WINDOW_MS;
    });

    if (twin) twin.track = better(twin.track, track, game);
    else kept.push({ key, track });
  }
  return kept.map((entry) => entry.track);
}

/**
 * A chosen playlist's tracks, as the app shows them.
 *
 * Not filtered by name: a soundtrack's tracks are called "Out of Tartarus" and
 * "No Escape", and it was the playlist that had to name the game. Only
 * duplicates and unusable entries go, and the uploader's order is kept.
 */
export function playlistTracks(tracks: ScTrack[], game: MatchGame): MatchedTrack[] {
  return dedupe(tracks, game)
    .map(toTrack)
    .filter((track): track is MatchedTrack => track !== null)
    .slice(0, MAX_TRACKS);
}

/**
 * A soundtrack assembled from search results, for a game with no playlist
 * worth choosing: every track that passes `isSoundtrackTrack`, once each, the
 * developer's uploads first and then the most played. Empty when fewer than
 * `MIN_TRACKS` survive — two matching uploads are not a soundtrack.
 */
export function matchTracks(tracks: ScTrack[], game: MatchGame): MatchedTrack[] {
  const passing = tracks.filter((track) => isSoundtrackTrack(track, game));
  const unique = dedupe(passing, game);
  if (unique.length < MIN_TRACKS) return [];

  return unique
    .sort((a, b) => {
      const dev = Number(isDevelopers(b.user, game)) - Number(isDevelopers(a.user, game));
      return dev || (b.playback_count ?? 0) - (a.playback_count ?? 0);
    })
    .map(toTrack)
    .filter((track): track is MatchedTrack => track !== null)
    .slice(0, MAX_TRACKS);
}
