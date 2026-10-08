import { supabase } from '../supabase';
import type { StarredSongRow } from '../database.types';

/**
 * The one song a profile pins.
 *
 * **Only the track's id is stored**, with the game it was starred from. It
 * used to copy the title, the artist, the artwork and a preview address into
 * Postgres, on the argument that a profile must render without the music
 * provider. The provider is SoundCloud now, and its API terms forbid an app to
 * persistently store any of that. So a profile asks SoundCloud for the track
 * when it is shown (`getSoundCloudTrack`), and a track its uploader removes
 * disappears from the profile, which is what the terms ask for.
 *
 * `game_id` and `game_title` are this app's own facts and stay.
 */
export type StarredSong = StarredSongRow;

export async function getStarredSong(userId: string): Promise<StarredSong | null> {
  const { data, error } = await supabase
    .from('starred_songs')
    /* The columns by name: a database that has not run 0036 still has the old
       ones, and nothing here should read them. */
    .select('user_id, track_id, game_id, game_title, created_at, updated_at')
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
 *
 * On a database before 0036 this fails: the old table requires a title and an
 * artist, which are no longer sent. The error says so in Postgres's words.
 */
export async function starSong(
  userId: string,
  trackUrn: string,
  context: { gameId?: string | null; gameTitle?: string | null } = {}
): Promise<void> {
  const write = (gameId: string | null) =>
    supabase.from('starred_songs').upsert(
      {
        user_id: userId,
        track_id: trackUrn,
        game_id: gameId,
        game_title: context.gameTitle ?? null,
      },
      { onConflict: 'user_id' }
    );

  let { error } = await write(context.gameId ?? null);

  /* `game_id` references `games`, which holds only games somebody has logged
     or listed. A soundtrack can be opened for a game nobody has, and a star
     must not fail for that: it keeps the game's name and drops the link. */
  if (error?.code === '23503' && context.gameId) ({ error } = await write(null));

  if (error) throw new Error(error.message);
}

export async function unstarSong(userId: string): Promise<void> {
  const { error } = await supabase.from('starred_songs').delete().eq('user_id', userId);
  if (error) throw new Error(error.message);
}
