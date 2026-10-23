import type { CachedGame } from '../database.types';
import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';

/**
 * Pinned games (0043): up to six a person chooses for the head of their
 * library — Apple Music's pinned albums.
 *
 * Reads are open to everyone; writes are refused by the table's policies for
 * anybody but the library's owner.
 */

/** How many games a library pins at most. The table's CHECK holds the same. */
export const MAX_PINS = 6;

function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

const MISSING_TABLE = 'Pinning needs migration 0043, which has not been run on this database yet.';

export type PinnedGame = { game: CachedGame; position: number };

/** A person's pins, in their order. Empty on a database before 0043. */
export async function getLibraryPins(userId: string): Promise<PinnedGame[]> {
  const { data, error } = await supabase
    .from('library_pins')
    .select('position, game:games(*)')
    .eq('user_id', userId)
    .order('position', { ascending: true });

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }

  const rows = (data ?? []) as unknown as { position: number; game: CachedGame | null }[];
  return rows
    .filter((row): row is PinnedGame => row.game !== null)
    .map((row) => ({ game: row.game, position: row.position }));
}

/**
 * Pin a game in the first free place. Throws when all six are taken; pinning
 * a game already pinned is a no-op.
 */
export async function pinGame(userId: string, game: Game, taken: readonly number[]): Promise<void> {
  const position = Array.from({ length: MAX_PINS }, (_, index) => index).find(
    (index) => !taken.includes(index)
  );
  if (position === undefined) throw new Error(`You can pin ${MAX_PINS} games at most.`);

  await cacheGame(game);

  const { error } = await supabase
    .from('library_pins')
    .upsert(
      { user_id: userId, game_id: game.id, position },
      { onConflict: 'user_id,game_id', ignoreDuplicates: true }
    );
  if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE : error.message);
}

export async function unpinGame(userId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from('library_pins')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId);
  if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE : error.message);
}
