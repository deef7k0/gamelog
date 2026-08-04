import { supabase } from '../supabase';
import type { StarredSongRow } from '../database.types';
import type { SoundtrackTrack } from '../soundtracks';

/**
 * The one song a profile pins.
 *
 * Track metadata is copied into Postgres rather than referenced, for the same
 * reason `games` copies IGDB metadata: rendering a profile must not depend on
 * the iTunes Search API being reachable, and a starred song has to survive
 * Apple reshuffling its catalogue.
 */
export type StarredSong = StarredSongRow;

export async function getStarredSong(userId: string): Promise<StarredSong | null> {
  const { data, error } = await supabase
    .from('starred_songs')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Pin a track, replacing whatever was pinned before.
 *
 * An upsert on the user's primary key, so swapping songs is one atomic write
 * rather than a delete and an insert that can half-fail. There is no "add"
 * variant because there is no list to add to — that limit is the feature.
 */
export async function starSong(
  userId: string,
  track: SoundtrackTrack,
  context: { artworkUrl?: string | null; gameId?: string | null; gameTitle?: string | null } = {}
): Promise<void> {
  const { error } = await supabase.from('starred_songs').upsert(
    {
      user_id: userId,
      track_id: track.id,
      title: track.title,
      artist: track.artist,
      artwork_url: context.artworkUrl ?? null,
      preview_url: track.previewUrl,
      game_id: context.gameId ?? null,
      game_title: context.gameTitle ?? null,
    },
    { onConflict: 'user_id' }
  );

  if (error) throw new Error(error.message);
}

export async function unstarSong(userId: string): Promise<void> {
  const { error } = await supabase.from('starred_songs').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
