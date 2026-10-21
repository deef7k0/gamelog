/**
 * A game's trailer from its Steam store listing, as a stream the app's own
 * player can loop silently behind the studio page's banner — SimpMusic's
 * animated artist artwork (`ArtistScreen.kt`'s `artistMotion`), with a
 * game's official trailer where an artist's motion artwork is.
 *
 * ## Why Steam, not IGDB
 *
 * IGDB lists trailers too (`videos.video_id`), and every one is a YouTube id:
 * playable only inside YouTube's own player, with its controls and its
 * branding, never as a muted loop behind a picture. Steam publishes its
 * trailers as plain HLS on its CDN — no key, no DRM, CORS open — exactly the
 * kind of stream SimpMusic plays for an artist (Apple Music's).
 *
 * ## The app picks the rendition, not the player
 *
 * SimpMusic's rule, measured there on a master playlist whose top rendition
 * was a 52 MB loop: resolve the master down to one media playlist before
 * anything plays — H.264 first, then the smallest rendition at or above
 * 720px. Here the frame is square and a trailer is wide, so the side that
 * matters is the one the frame shows edge to edge: the video's height. A
 * Steam master is 1080p / 720p / 480p / 360p, all H.264; 720p it is, at
 * about 2.6 Mbps.
 *
 * **The media playlist, never the master**: Steam carries the sound as a
 * separate rendition the master names, so playing the video's own playlist
 * downloads no audio at all. The loop is silent by construction.
 *
 * Pure, bar `getSteamTrailer`, and imports nothing: `steam-trailer.test.ts`
 * runs the choices against Steam's real answers.
 */

/** One entry of `appdetails`' `movies`, as Steam sends it (verified live). */
export type SteamMovie = {
  id: number;
  name?: string;
  thumbnail?: string;
  hls_h264?: string;
  dash_h264?: string;
  dash_av1?: string;
  /** Older listings: plain MP4 files. */
  mp4?: { '480'?: string; max?: string };
  highlight?: boolean;
};

export type SteamTrailer = {
  /** The chosen video-only media playlist — or, on an old listing, an MP4. */
  url: string;
  /** Steam's own name for it: "Official Launch Trailer". */
  name: string;
};

/** The height a rendition must reach to fill the square banner (SimpMusic's 720). */
export const TRAILER_MIN_HEIGHT = 720;

/**
 * Which of a listing's movies is the trailer, in Steam's own order within each
 * step: an "official" trailer; a launch or release trailer; any trailer; one
 * Steam marks as a highlight; the first. Gameplay showcases and content packs
 * are movies too, and "trailer" in the name is what tells them apart — and a
 * launch trailer is the official one where nothing says so: Baldur's Gate 3
 * lists an "Accolades Trailer" before its "Launch Trailer".
 */
export function chooseTrailer(movies: readonly SteamMovie[]): SteamMovie | null {
  const playable = movies.filter((movie) => !!movie.hls_h264 || !!movie.mp4?.max);
  const named = (movie: SteamMovie, pattern: RegExp) => pattern.test(movie.name ?? '');
  return (
    playable.find((movie) => named(movie, /official/i) && named(movie, /trailer/i)) ??
    playable.find((movie) => named(movie, /\b(launch|release)\b.*trailer/i)) ??
    playable.find((movie) => named(movie, /trailer/i)) ??
    playable.find((movie) => movie.highlight) ??
    playable[0] ??
    null
  );
}

type Rendition = { uri: string; width: number; height: number; bandwidth: number; codecs: string };

/**
 * The video-only media playlist to play, from an HLS master playlist: H.264,
 * at least `TRAILER_MIN_HEIGHT` tall, the cheapest of those — else the
 * tallest there is. Resolved against the master's own address. Null when the
 * master names no H.264 video.
 */
export function chooseRendition(master: string, masterUrl: string): string | null {
  const lines = master.split(/\r?\n/);
  const renditions: Rendition[] = [];
  lines.forEach((line, index) => {
    if (!line.startsWith('#EXT-X-STREAM-INF:')) return;
    const uri = lines.slice(index + 1).find((next) => next.trim() && !next.startsWith('#'));
    if (!uri) return;
    const attribute = (name: string) =>
      new RegExp(`(?:^|[:,])${name}=("[^"]*"|[^,]*)`).exec(line)?.[1]?.replace(/"/g, '') ?? '';
    const [width, height] = attribute('RESOLUTION').split('x').map(Number);
    renditions.push({
      uri: uri.trim(),
      width: width || 0,
      height: height || 0,
      bandwidth: Number(attribute('BANDWIDTH')) || 0,
      codecs: attribute('CODECS'),
    });
  });

  const h264 = renditions.filter((rendition) => rendition.codecs.includes('avc1'));
  if (h264.length === 0) return null;
  const tall = h264.filter((rendition) => rendition.height >= TRAILER_MIN_HEIGHT);
  const chosen =
    tall.length > 0
      ? tall.reduce((best, next) => (next.bandwidth < best.bandwidth ? next : best))
      : h264.reduce((best, next) => (next.height > best.height ? next : best));
  return resolveUrl(chosen.uri, masterUrl);
}

/** A playlist's relative address, against the master's — its path, not its query. */
export function resolveUrl(uri: string, base: string): string {
  if (/^https?:\/\//.test(uri)) return uri;
  const path = base.split('?')[0];
  return path.slice(0, path.lastIndexOf('/') + 1) + uri;
}

/**
 * The trailer for a Steam appid, or null when the listing has none Steam can
 * stream. Two small requests: the listing's movies, then the chosen one's
 * master playlist. Throws on a network failure, so a dropped connection is
 * not cached as "no trailer".
 */
export async function getSteamTrailer(
  appId: string,
  signal?: AbortSignal
): Promise<SteamTrailer | null> {
  const response = await fetch(
    `https://store.steampowered.com/api/appdetails?appids=${encodeURIComponent(appId)}&filters=movies`,
    { signal }
  );
  if (!response.ok) throw new Error(`Steam answered ${response.status}`);
  const body = (await response.json()) as Record<
    string,
    { success?: boolean; data?: { movies?: SteamMovie[] } } | undefined
  >;
  const movie = chooseTrailer(body[appId]?.data?.movies ?? []);
  if (!movie) return null;
  const name = movie.name?.trim() || 'Trailer';

  if (!movie.hls_h264) return movie.mp4?.max ? { url: movie.mp4.max, name } : null;

  const master = await fetch(movie.hls_h264, { signal });
  if (!master.ok) throw new Error(`Steam answered ${master.status}`);
  const url = chooseRendition(await master.text(), movie.hls_h264);
  return url ? { url, name } : null;
}
