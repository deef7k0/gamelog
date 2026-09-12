/**
 * Game soundtracks, via the iTunes Search API.
 *
 * Why iTunes:
 *  - keyless and unauthenticated, so nothing to configure
 *  - **still returns 30-second `previewUrl` clips**. Spotify removed preview
 *    URLs from its API, which rules it out for this feature entirely.
 *  - exposes `primaryGenreName`, so non-soundtrack results (pop covers, remix
 *    albums, unrelated artists) can be filtered out — the API has no
 *    "video game music" category of its own.
 *
 * Deezer is an equivalent keyless fallback if this ever stops working.
 */

const SEARCH = 'https://itunes.apple.com/search';
const LOOKUP = 'https://itunes.apple.com/lookup';

export type SoundtrackAlbum = {
  id: string;
  title: string;
  artist: string;
  artworkUrl: string | null;
  trackCount: number;
  releaseYear: number | null;
  genre: string | null;
  /** Apple Music page, for a "listen in full" link. */
  externalUrl: string | null;
};

export type SoundtrackTrack = {
  id: string;
  title: string;
  artist: string;
  trackNumber: number | null;
  /** Milliseconds. */
  durationMs: number | null;
  /** 30-second AAC clip. Null tracks cannot be previewed. */
  previewUrl: string | null;
};

type ItunesAlbum = {
  collectionId: number;
  collectionName?: string;
  artistName?: string;
  artworkUrl100?: string;
  trackCount?: number;
  releaseDate?: string;
  primaryGenreName?: string;
  collectionViewUrl?: string;
};

type ItunesTrack = {
  wrapperType?: string;
  trackId?: number;
  trackName?: string;
  artistName?: string;
  trackNumber?: number;
  trackTimeMillis?: number;
  previewUrl?: string;
  /** Which album the track belongs to — how a song search is tied to an album. */
  collectionId?: number;
  /** Apple Music page for the single track. */
  trackViewUrl?: string;
};

async function fetchJson<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } });
  if (!response.ok) throw new Error(`iTunes returned ${response.status}`);
  return (await response.json()) as T;
}

/**
 * iTunes only serves 100px artwork in search results, but the URL pattern is
 * predictable, so a larger size can be requested directly.
 */
function upscaleArtwork(url: string | undefined, size = 600): string | null {
  if (!url) return null;
  return url.replace(/\/\d+x\d+bb\.(jpg|png)$/, `/${size}x${size}bb.$1`);
}

const MIN_CONFIDENCE = 3;

/**
 * How likely an album is to be *this game's* soundtrack.
 *
 * A simple genre + title-contains filter is not enough. iTunes has no video
 * game category, so a search for a short title returns film scores that match
 * just as well: "Journey" pulls in *The Hobbit: An Unexpected Journey* and *A
 * Dog's Journey*, both genuinely genre "Soundtrack" and both containing the
 * word. Scoring lets the real game OST outrank them instead of being filtered
 * alongside them.
 *
 * Returns a negative score for anything that does not mention the game at all.
 */
function confidence(album: ItunesAlbum, normalisedTitle: string): number {
  const name = (album.collectionName ?? '').toLowerCase();
  const normalisedName = name.replace(/[^a-z0-9 ]/g, '');
  if (!normalisedTitle || !normalisedName.includes(normalisedTitle)) return -1;

  const genre = (album.primaryGenreName ?? '').toLowerCase();
  let score = 0;

  // The game's own OST is named after it; "A Dog's Journey" buries it mid-title.
  if (normalisedName.startsWith(normalisedTitle)) score += 3;
  // The strongest possible signal.
  if (name.includes('video game')) score += 3;
  if (genre.includes('soundtrack') || genre.includes('score')) score += 1;
  if (name.includes('soundtrack') || name.includes('ost') || name.includes('original score')) {
    score += 1;
  }
  // Films are the main source of false positives.
  if (name.includes('motion picture') || name.includes('film')) score -= 6;
  // Singles and fan remixes are not the album someone wants.
  if (name.includes('single') || name.includes('remix') || name.includes('cover')) score -= 2;

  return score;
}

function toAlbum(raw: ItunesAlbum): SoundtrackAlbum {
  return {
    id: String(raw.collectionId),
    title: raw.collectionName ?? 'Untitled',
    artist: raw.artistName ?? 'Unknown artist',
    artworkUrl: upscaleArtwork(raw.artworkUrl100),
    trackCount: raw.trackCount ?? 0,
    releaseYear: raw.releaseDate ? new Date(raw.releaseDate).getUTCFullYear() : null,
    genre: raw.primaryGenreName ?? null,
    externalUrl: raw.collectionViewUrl ?? null,
  };
}

/**
 * Soundtrack albums for a game, best match first.
 *
 * Searches for "<title> original soundtrack" — the phrasing publishers actually
 * use — then filters the results, since the API cannot be asked for game music
 * specifically.
 */
export async function findSoundtracks(
  gameTitle: string,
  signal?: AbortSignal
): Promise<SoundtrackAlbum[]> {
  const trimmed = gameTitle.trim();
  if (!trimmed) return [];

  const term = encodeURIComponent(`${trimmed} original soundtrack`);
  const json = await fetchJson<{ results?: ItunesAlbum[] }>(
    `${SEARCH}?term=${term}&media=music&entity=album&limit=25`,
    signal
  );

  const normalisedTitle = trimmed
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
  const seen = new Set<string>();

  return (json.results ?? [])
    .map((album) => ({ album, score: confidence(album, normalisedTitle) }))
    .filter((entry) => entry.score >= MIN_CONFIDENCE)
    .sort((a, b) => b.score - a.score)
    .map((entry) => toAlbum(entry.album))
    .filter((album) => {
      if (seen.has(album.id)) return false;
      seen.add(album.id);
      return true;
    })
    .slice(0, 6);
}

/**
 * An album's track list.
 *
 * `lookup` with `entity=song` returns the album itself as the first element
 * followed by its tracks, so non-track wrappers are dropped.
 */
export async function getAlbumTracks(
  albumId: string,
  signal?: AbortSignal
): Promise<SoundtrackTrack[]> {
  const json = await fetchJson<{ results?: ItunesTrack[] }>(
    `${LOOKUP}?id=${encodeURIComponent(albumId)}&entity=song&limit=200`,
    signal
  );

  return (json.results ?? [])
    .filter((entry) => entry.wrapperType === 'track' && entry.trackId)
    .map((entry) => ({
      id: String(entry.trackId),
      title: entry.trackName ?? 'Untitled',
      artist: entry.artistName ?? '',
      trackNumber: entry.trackNumber ?? null,
      durationMs: entry.trackTimeMillis ?? null,
      previewUrl: entry.previewUrl ?? null,
    }))
    .sort((a, b) => (a.trackNumber ?? 0) - (b.trackNumber ?? 0));
}

/* -------------------------------------------------------------------------
 * Surprise Me — one game's soundtrack, ranked
 * ---------------------------------------------------------------------- */

/** A track that knows how recognisable it is. */
export type SoundtrackPick = SoundtrackTrack & {
  /**
   * Position in a popularity-ordered iTunes song search, 0 = most popular.
   *
   * Null means that search did not surface this track. Those are real tracks
   * from the same album — usually deep cuts and short stingers — they just have
   * no popularity evidence either way, so `pickTrack` treats them as the tail.
   */
  popularityRank: number | null;
  /** Apple Music page for the single track. */
  trackUrl: string | null;
};

/** An album plus its ranked tracks — everything one roll needs about the music. */
export type GameSoundtrack = {
  albumId: string;
  albumTitle: string;
  artist: string;
  artworkUrl: string | null;
  /** The album's Apple Music page, for "listen in full". */
  externalUrl: string | null;
  tracks: SoundtrackPick[];
};

/**
 * Below this many ranked tracks, the song search did not cover the album well
 * enough to pick from on its own, and the full track list is fetched to fill in.
 */
const MIN_RANKED_TRACKS = 5;

/** How far down the popularity order "Popular" is willing to reach. */
const POPULAR_WINDOW = 12;

/**
 * Tracks from a game's soundtrack, in popularity order.
 *
 * ## Why this is a search and not a lookup
 *
 * iTunes publishes no popularity field on a track — `lookup?entity=song`
 * returns an album in track-number order and nothing else. What it does have is
 * a *search* whose results come back in relevance order, and relevance for a
 * bare "<game> soundtrack" query tracks popularity closely enough to use:
 * Celeste surfaces Resurrections and First Steps, NieR:Automata surfaces City
 * Ruins and Weight of the World, Minecraft surfaces C418's own Minecraft from
 * Volume Alpha. Those are the tracks a player would recognise, derived from
 * metadata, with no maintained list of famous game songs anywhere in the app.
 *
 * The array index *is* the ranking, which is why this returns the raw results
 * in order rather than a mapped type.
 */
async function searchSoundtrackSongs(
  gameTitle: string,
  signal?: AbortSignal
): Promise<ItunesTrack[]> {
  const term = encodeURIComponent(`${gameTitle} soundtrack`);
  const json = await fetchJson<{ results?: ItunesTrack[] }>(
    `${SEARCH}?term=${term}&media=music&entity=song&limit=200`,
    signal
  );
  return (json.results ?? []).filter((entry) => entry.trackId);
}

function toPick(raw: ItunesTrack, popularityRank: number | null): SoundtrackPick {
  return {
    id: String(raw.trackId),
    title: raw.trackName ?? 'Untitled',
    artist: raw.artistName ?? '',
    trackNumber: raw.trackNumber ?? null,
    durationMs: raw.trackTimeMillis ?? null,
    previewUrl: raw.previewUrl ?? null,
    trackUrl: raw.trackViewUrl ?? null,
    popularityRank,
  };
}

/**
 * The soundtrack for one game, with its tracks ranked by popularity.
 *
 * ## Two searches, run together
 *
 * The album search decides *which album is the OST*; the song search decides
 * *which of its tracks are recognisable*. Neither can do the other's job. Run
 * the song search alone and the results are piano collections, lofi remixes and
 * music-box covers intermixed with the real thing — for Sonic the top hits are
 * the live-action film's pop singles. Run the album search alone and every
 * track is equally likely, which is how "popular" would end up serving a
 * fourteen-second menu stinger.
 *
 * So the album search stays the authority, `confidence()` picks the winner, and
 * the song search is used only to order the tracks that album already contains.
 * They are independent reads, so they go out together and cost one round trip.
 *
 * ## The third call
 *
 * A song search returns 200 results across every album that matched, so a game
 * whose OST is buried under covers can end up with only a handful of its own
 * tracks ranked. Below `MIN_RANKED_TRACKS` that is not enough to pick from, and
 * the album's real track list is fetched and merged — ranked tracks keep their
 * rank, the rest join the tail. For most games this call never happens.
 *
 * Returns `null` for "there is no soundtrack", which callers cache. Throwing is
 * reserved for the lookup genuinely failing, which must stay retryable.
 */
export async function findGameSoundtrack(
  gameTitle: string,
  signal?: AbortSignal
): Promise<GameSoundtrack | null> {
  const trimmed = gameTitle.trim();
  if (!trimmed) return null;

  /*
   * `allSettled`, not `all`: the ranking is an enhancement and the album is the
   * feature. If the song search fails on its own, the album's tracks in album
   * order are still a soundtrack worth showing.
   */
  const [albumResult, songResult] = await Promise.allSettled([
    findSoundtracks(trimmed, signal),
    searchSoundtrackSongs(trimmed, signal),
  ]);

  if (albumResult.status === 'rejected') throw albumResult.reason;

  const album = albumResult.value[0];
  if (!album) return null;

  const songs = songResult.status === 'fulfilled' ? songResult.value : [];

  const ranked: SoundtrackPick[] = [];
  const seen = new Set<string>();
  for (const song of songs) {
    if (String(song.collectionId) !== album.id) continue;
    const id = String(song.trackId);
    if (seen.has(id)) continue;
    seen.add(id);
    // The rank is the position among *this album's* hits, not among all 200
    // results — otherwise a game whose OST starts at result 26 would look
    // uniformly unpopular and `POPULAR_WINDOW` would exclude all of it.
    ranked.push(toPick(song, ranked.length));
  }

  if (ranked.length >= MIN_RANKED_TRACKS) {
    return { ...albumFields(album), tracks: ranked };
  }

  let full: SoundtrackTrack[] = [];
  try {
    full = await getAlbumTracks(album.id, signal);
  } catch {
    /* The ranked tracks, however few, are still a usable soundtrack. */
  }

  const tail = full
    .filter((track) => !seen.has(track.id))
    .map((track) => ({ ...track, trackUrl: null, popularityRank: null }));

  const tracks = [...ranked, ...tail];
  if (tracks.length === 0) return null;

  return { ...albumFields(album), tracks };
}

function albumFields(album: SoundtrackAlbum): Omit<GameSoundtrack, 'tracks'> {
  return {
    albumId: album.id,
    albumTitle: album.title,
    artist: album.artist,
    artworkUrl: album.artworkUrl,
    externalUrl: album.externalUrl,
  };
}

/** How a track is chosen once the soundtrack is in hand. */
export type TrackPickMode = 'popular' | 'random' | 'surprise';

/**
 * Weighted pick from `tracks`, highest weight first.
 *
 * `1 / (index + 2)` rather than `1 / (index + 1)`: the first form gives the top
 * track exactly half the total weight of a long list, which is too dominant for
 * a button labelled "Another song". The second flattens the head enough that
 * rerolling actually moves while still favouring the opening tracks heavily.
 */
function weightedPick(tracks: SoundtrackPick[]): SoundtrackPick {
  const weights = tracks.map((_, index) => 1 / (index + 2));
  const total = weights.reduce((sum, weight) => sum + weight, 0);

  let threshold = Math.random() * total;
  for (let index = 0; index < tracks.length; index += 1) {
    threshold -= weights[index];
    if (threshold <= 0) return tracks[index];
  }
  return tracks[tracks.length - 1];
}

/**
 * Choose one track. Pure — no network, no storage, no clock.
 *
 * This is what makes "Another song" free. The soundtrack is fetched once per
 * game and every subsequent pick, in either mode, happens here against the array
 * already in memory.
 *
 * `exclude` holds the tracks already shown for this game, so rerolling walks the
 * album rather than landing on the same song twice. When it has consumed
 * everything the exclusion is dropped rather than returning null — running out
 * of unheard tracks should restart the album, not disable the button.
 */
export function pickTrack(
  tracks: readonly SoundtrackPick[],
  mode: TrackPickMode,
  exclude?: ReadonlySet<string>
): SoundtrackPick | null {
  if (tracks.length === 0) return null;

  const unheard = exclude ? tracks.filter((track) => !exclude.has(track.id)) : [...tracks];
  const eligible = unheard.length > 0 ? unheard : [...tracks];

  const effective = mode === 'surprise' ? (Math.random() < 0.5 ? 'popular' : 'random') : mode;

  if (effective === 'random') {
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  /*
   * Popular mode reads the ranking, so unranked tracks are not candidates —
   * they are precisely the ones the popularity search did not surface. If the
   * album has no ranking at all (the song search failed, or covered none of it)
   * the mode degrades to random rather than to "always track 1", which would
   * make the button appear broken.
   */
  const ranked = eligible
    .filter((track) => track.popularityRank !== null)
    .sort((a, b) => (a.popularityRank ?? 0) - (b.popularityRank ?? 0))
    .slice(0, POPULAR_WINDOW);

  if (ranked.length === 0) {
    return eligible[Math.floor(Math.random() * eligible.length)];
  }

  return weightedPick(ranked);
}

/** "3:42" from a duration in ms. */
export function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
