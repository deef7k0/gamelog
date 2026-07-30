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

/** "3:42" from a duration in ms. */
export function formatDuration(ms: number | null): string {
  if (!ms || ms <= 0) return '--:--';
  const total = Math.round(ms / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
