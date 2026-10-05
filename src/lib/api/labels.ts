import type { GameLabel } from '../../constants/game-labels';
import type { CachedGame } from '../database.types';
import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';

/**
 * Labels on games (0034): which games carry one, and — for a moderator —
 * putting one on and taking it off.
 *
 * Reads are open to everyone. Writes are refused by the table's policies for
 * anybody who is not in `public.moderators`, so nothing here checks the caller:
 * a button shown to the wrong person fails at the database, with its message.
 */

/**
 * PostgREST's two ways of saying a table is not there: its own schema cache
 * (`PGRST205`) and Postgres underneath it (`42P01`).
 *
 * The app can be a migration ahead of its database — migrations are run by hand
 * — so "no such table" is a state to expect, not a bug to surface on every
 * screen that draws a cover.
 */
function isMissingTable(error: { code?: string } | null): boolean {
  return error?.code === 'PGRST205' || error?.code === '42P01';
}

const MISSING_TABLE = 'Labels need migration 0034, which has not been run on this database yet.';

/**
 * The id of every game carrying a label.
 *
 * Ids only: this is what the badge on a cover asks, for every cover on screen,
 * and it wants one small list rather than a row per game. An empty list on a
 * database before 0034 — a missing table means no game has the label.
 */
export async function getLabelledGameIds(label: GameLabel): Promise<string[]> {
  const { data, error } = await supabase.from('game_labels').select('game_id').eq('label', label);

  if (error) {
    if (isMissingTable(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).map((row) => row.game_id);
}

export type LabelledGame = {
  game: CachedGame;
  /** When the label was set. */
  labelledAt: string;
};

/** Every game carrying a label, most recently labelled first, with its artwork. */
export async function getLabelledGames(label: GameLabel): Promise<LabelledGame[]> {
  const { data, error } = await supabase
    .from('game_labels')
    .select('created_at, game:games(*)')
    .eq('label', label)
    .order('created_at', { ascending: false });

  if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE : error.message);

  const rows = (data ?? []) as unknown as { created_at: string; game: CachedGame | null }[];
  return rows
    .filter((row): row is { created_at: string; game: CachedGame } => row.game !== null)
    .map((row) => ({ game: row.game, labelledAt: row.created_at }));
}

/**
 * Put a label on a game, or take it off. Moderators only.
 *
 * Adding caches the game first: `game_labels.game_id` is a foreign key to the
 * shared `games` cache — the list of labelled games is drawn from it — and a
 * game nobody has logged yet is not in there. Re-adding is a no-op rather than
 * an error, so two moderators labelling the same game do not collide.
 */
export async function setGameLabel(
  userId: string,
  game: Game,
  label: GameLabel,
  on: boolean
): Promise<void> {
  if (!on) return removeGameLabel(game.id, label);

  await cacheGame(game);

  const { error } = await supabase
    .from('game_labels')
    .upsert(
      { game_id: game.id, label, added_by: userId },
      { onConflict: 'game_id,label', ignoreDuplicates: true }
    );
  if (error) {
    if (isMissingTable(error)) throw new Error(MISSING_TABLE);
    /* 42501 is the row-level-security refusal: the caller is not a moderator. */
    throw new Error(error.code === '42501' ? 'Only moderators can label games.' : error.message);
  }
}

/** Take a label off a game by id — the list screen's remove, which has no `Game`. */
export async function removeGameLabel(gameId: string, label: GameLabel): Promise<void> {
  const { error } = await supabase
    .from('game_labels')
    .delete()
    .eq('game_id', gameId)
    .eq('label', label);
  if (error) throw new Error(isMissingTable(error) ? MISSING_TABLE : error.message);
}
