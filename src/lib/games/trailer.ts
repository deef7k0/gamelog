/**
 * Which of a game's IGDB videos is its trailer — pure, so `npm test` holds it.
 *
 * IGDB's `videos` are YouTube ids with whatever name an uploader typed: "Launch
 * Trailer", "TV Spot", "Developer Diary: Creating the Sound", "Recap". The game
 * page links one, so it prefers a video that calls itself a trailer — a launch,
 * official, announcement or reveal one first — and falls back to the first
 * video only when none does. (Verified live on The Witcher 3: its first video
 * is a developer diary; its trailers come further down.)
 */

export type GameTrailer = { videoId: string; name: string };

const TRAILER = /\btrailer\b/i;
const HEADLINE = /\b(launch|official|announce(ment)?|reveal|release|gameplay)\b/i;
const NOT_A_TRAILER = /\b(diary|interview|review|recap|behind the scenes|making of)\b/i;
const YOUTUBE_ID = /^[\w-]{11}$/;

export function pickTrailer(
  videos: readonly { video_id?: string; name?: string }[] | undefined
): GameTrailer | null {
  const usable = (videos ?? [])
    .filter((video): video is { video_id: string; name?: string } =>
      YOUTUBE_ID.test(video.video_id ?? '')
    )
    .map((video) => ({ videoId: video.video_id, name: video.name?.trim() || 'Trailer' }));
  if (usable.length === 0) return null;

  const trailers = usable.filter(
    (video) => TRAILER.test(video.name) && !NOT_A_TRAILER.test(video.name)
  );
  return (
    trailers.find((video) => HEADLINE.test(video.name)) ??
    trailers[0] ??
    usable.find((video) => !NOT_A_TRAILER.test(video.name)) ??
    usable[0]
  );
}

/** The video on YouTube. */
export function trailerUrl(trailer: GameTrailer): string {
  return `https://www.youtube.com/watch?v=${trailer.videoId}`;
}

/** YouTube's 16:9 still for it (`mqdefault`, 320×180 — no letterbox bars). */
export function trailerThumbnail(trailer: GameTrailer): string {
  return `https://i.ytimg.com/vi/${trailer.videoId}/mqdefault.jpg`;
}
