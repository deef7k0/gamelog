import { supabase } from '../supabase';
import type { CachedTrack, GameSoundtrackRow } from '../database.types';
import type { GameSoundtrack, SoundtrackPick } from '../soundtracks';

/**
 * The shared soundtrack cache (migration 0020).
 *
 * Finding a game's soundtrack costs two calls to the iTunes Search API, and the
 * answer is the same for every user forever — an album's track list does not
 * depend on who asked. So the first person to roll a game pays for the lookup
 * and everybody after reads one Postgres row.
 *
 * ## Why the return type has three values
 *
 * `undefined` (nobody has looked), `null` (looked, there is no soundtrack) and a
 * `GameSoundtrack` are three different states and collapsing the first two
 * breaks the feature: most games have no released OST, and without a stored
 * negative every one of them re-queries iTunes on every single roll. That is the
 * whole reason the table carries a `found` column rather than just absent rows.
 */

/**
 * How long a "no soundtrack" answer stands before it is worth asking again.
 *
 * A positive result never expires — an album that exists keeps existing, and its
 * track list is not going to change under us. A negative one does, because a
 * game can get a soundtrack release years after launch, and a permanent no would
 * mean the app never noticed.
 */
const NEGATIVE_TTL_MS = 30 * 24 * 60 * 60_000;

function toTrack(raw: CachedTrack): SoundtrackPick {
  return {
    id: raw.id,
    title: raw.title,
    artist: raw.artist,
    trackNumber: raw.trackNumber ?? null,
    durationMs: raw.durationMs ?? null,
    previewUrl: raw.previewUrl ?? null,
    trackUrl: raw.trackUrl ?? null,
    popularityRank: raw.popularityRank ?? null,
  };
}

/**
 * A stored row as the app's own type, or null if the row records "none found".
 *
 * This function is the single place the JSONB shape and `SoundtrackPick` meet,
 * which is why the mapping is written out rather than cast: a column added on
 * one side and not the other should fail here, not silently produce tracks with
 * undefined fields.
 */
function toSoundtrack(row: GameSoundtrackRow): GameSoundtrack | null {
  if (!row.found || !row.album_id) return null;

  return {
    albumId: row.album_id,
    albumTitle: row.album_title ?? 'Soundtrack',
    artist: row.artist ?? '',
    artworkUrl: row.artwork_url,
    externalUrl: row.external_url,
    tracks: (row.tracks ?? []).map(toTrack),
  };
}

/**
 * Read the cache.
 *
 * `undefined` means a miss — either no row, or a stale negative that has earned
 * another look. A read failure is also a miss: the cache is an optimisation, and
 * Supabase being unreachable should send the caller to iTunes rather than take
 * the whole roll down with it.
 */
export async function getCachedSoundtrack(
  gameId: string
): Promise<GameSoundtrack | null | undefined> {
  const { data, error } = await supabase
    .from('game_soundtracks')
    .select('*')
    .eq('game_id', gameId)
    .maybeSingle();

  if (error || !data) return undefined;

  if (!data.found) {
    const age = Date.now() - new Date(data.fetched_at).getTime();
    if (age > NEGATIVE_TTL_MS) return undefined;
  }

  return toSoundtrack(data);
}

/**
 * Write a lookup result, positive or negative.
 *
 * An upsert, because two people can roll the same game at the same moment and
 * neither should see an error for winning that race — they computed the same
 * answer. Failures are swallowed for the same reason reads are: a cache that
 * cannot be written is a slower feature, not a broken one.
 */
export async function cacheSoundtrack(
  gameId: string,
  gameTitle: string,
  soundtrack: GameSoundtrack | null
): Promise<void> {
  const tracks: CachedTrack[] =
    soundtrack?.tracks.map((track) => ({
      id: track.id,
      title: track.title,
      artist: track.artist,
      trackNumber: track.trackNumber,
      durationMs: track.durationMs,
      previewUrl: track.previewUrl,
      trackUrl: track.trackUrl,
      popularityRank: track.popularityRank,
    })) ?? [];

  await supabase.from('game_soundtracks').upsert(
    {
      game_id: gameId,
      game_title: gameTitle,
      found: soundtrack !== null,
      album_id: soundtrack?.albumId ?? null,
      album_title: soundtrack?.albumTitle ?? null,
      artist: soundtrack?.artist ?? null,
      artwork_url: soundtrack?.artworkUrl ?? null,
      external_url: soundtrack?.externalUrl ?? null,
      // The column is capped at 300 by a CHECK; trimming here means a freakishly
      // large compilation degrades to its first 300 tracks instead of failing
      // the insert and re-querying iTunes on every future roll.
      tracks: tracks.slice(0, 300),
      fetched_at: new Date().toISOString(),
    },
    { onConflict: 'game_id' }
  );
}
