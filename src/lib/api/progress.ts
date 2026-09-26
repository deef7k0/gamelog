import type { CompletionLevel, GameLog, LogStatus, PlaythroughRow } from '../database.types';
import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';

/**
 * Progress: where someone is with a game, and each time they played it.
 *
 * `saveLog` in `core.ts` is the review form's writer and restates every column
 * on purpose — the form owns them all. Progress is written from much smaller
 * places (one tap on the progress sheet, one stepper) that own two or three
 * columns each, so these write **only the columns they are given**. An upsert
 * with a partial payload leaves every other column exactly as it was: PostgREST
 * builds `ON CONFLICT DO UPDATE SET` from the payload's keys, never from the
 * table's.
 */

/** The columns the progress sheet may change. */
export type ProgressPatch = {
  status: LogStatus;
  completion?: CompletionLevel | null;
  completion_percent?: number | null;
  played_on?: string | null;
};

/**
 * Set where you are with a game, creating the log if there is none.
 *
 * `status` is required because this is the call that can *create* a log, and a
 * log row without one would take the column's default — `played` — which is a
 * claim the person never made.
 */
export async function setProgress(userId: string, game: Game, patch: ProgressPatch): Promise<void> {
  // The log has a FK to games, so the cache row must exist first.
  await cacheGame(game);

  const { error } = await supabase
    .from('logs')
    .upsert({ user_id: userId, game_id: game.id, ...patch }, { onConflict: 'user_id,game_id' });

  if (error) throw new Error(error.message);
}

/** Details on a log that already exists. Never creates one. */
export type LogDetailPatch = Partial<
  Pick<GameLog, 'completion' | 'completion_percent' | 'played_on' | 'coop' | 'player_count'>
>;

export async function updateLogDetails(
  userId: string,
  gameId: string,
  patch: LogDetailPatch
): Promise<void> {
  const { error } = await supabase
    .from('logs')
    .update(patch)
    .eq('user_id', userId)
    .eq('game_id', gameId);

  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Playthroughs
// ---------------------------------------------------------------------------

/**
 * Every run of one game by one person, oldest first — which is also how they
 * are numbered: "#1" is the first time, whatever came after.
 *
 * Numbered on the client from this order rather than stored, so deleting the
 * second of three does not leave a hole a stored number would have to be
 * rewritten to close.
 */
export async function getPlaythroughs(userId: string, gameId: string): Promise<PlaythroughRow[]> {
  const { data, error } = await supabase
    .from('playthroughs')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('created_at', { ascending: true });

  if (error) throw new Error(error.message);
  return data ?? [];
}

export type PlaythroughInput = {
  platform: string | null;
  startedOn: string | null;
  finishedOn: string | null;
  completion: CompletionLevel | null;
  completionPercent: number | null;
  hours: number | null;
  notes: string | null;
};

function playthroughColumns(input: PlaythroughInput) {
  return {
    platform: input.platform?.trim() || null,
    started_on: input.startedOn || null,
    finished_on: input.finishedOn || null,
    completion: input.completion,
    completion_percent: input.completionPercent,
    hours: input.hours,
    notes: input.notes?.trim() || null,
  };
}

/**
 * Add a run. The log must exist — the database refuses a playthrough without one
 * (composite foreign key, 0023) — so this is only offered from screens that are
 * reached through a log.
 *
 * A run that got further than the log's headline raises it, in the database,
 * never lowers it. Callers should refetch the log after this.
 */
export async function addPlaythrough(
  userId: string,
  gameId: string,
  input: PlaythroughInput
): Promise<PlaythroughRow> {
  const { data, error } = await supabase
    .from('playthroughs')
    .insert({ user_id: userId, game_id: gameId, ...playthroughColumns(input) })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updatePlaythrough(id: string, input: PlaythroughInput): Promise<void> {
  const { error } = await supabase
    .from('playthroughs')
    .update(playthroughColumns(input))
    .eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deletePlaythrough(id: string): Promise<void> {
  const { error } = await supabase.from('playthroughs').delete().eq('id', id);
  if (error) throw new Error(error.message);
}
