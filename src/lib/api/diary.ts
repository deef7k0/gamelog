import type { CachedGame, DiaryEntryRow } from '../database.types';
import { supabase } from '../supabase';
import { cacheGame } from './core';
import type { Game } from '../games';

/**
 * Per-game diaries.
 *
 * A diary is a running log of short dated notes about one game — "beat the
 * Nameless King", "dropped it again", "started NG+". Distinct from
 * `logs.review`, which is one verdict that gets rewritten; a diary accumulates
 * and is read chronologically.
 */

export type DiaryEntry = DiaryEntryRow;

/** An entry with the game attached, for cross-game views like the wall. */
export type DiaryEntryWithGame = DiaryEntry & {
  game: Pick<CachedGame, 'id' | 'title' | 'cover_url' | 'hero_url'> | null;
};

export const MAX_DIARY_LENGTH = 500;

/**
 * One user's diary for one game, newest first.
 *
 * Ordered on `entry_date` rather than `created_at` so a back-dated entry files
 * itself under the day it describes; `created_at` only breaks ties within a day.
 */
export async function getDiary(userId: string, gameId: string): Promise<DiaryEntry[]> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .order('entry_date', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return data ?? [];
}

/** How many entries exist, for deciding whether to show the Diary tab at all. */
export async function getDiaryCount(userId: string, gameId: string): Promise<number> {
  const { count, error } = await supabase
    .from('diary_entries')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('game_id', gameId);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

/**
 * A user's most recent entries across every game.
 *
 * Feeds the derived wall activity, which is why it embeds the game — the wall
 * row needs the title and cover without a second round trip per entry.
 */
export async function getRecentDiaryEntries(
  userId: string,
  limit = 20
): Promise<DiaryEntryWithGame[]> {
  const { data, error } = await supabase
    .from('diary_entries')
    .select('*, game:games(id, title, cover_url, hero_url)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data ?? []) as unknown as DiaryEntryWithGame[];
}

export type AddDiaryEntryInput = {
  userId: string;
  /** Needed so the game can be cached before the row's FK is checked. */
  game: Game;
  body: string;
  /** ISO date (YYYY-MM-DD). Defaults to today, server-side. */
  entryDate?: string;
};

/**
 * Write a new entry.
 *
 * `cacheGame` runs first for the same reason `saveLog` does it: `diary_entries`
 * has a foreign key to `games`, so writing a diary entry for a game nobody has
 * logged yet would fail without the cache row existing.
 */
export async function addDiaryEntry(input: AddDiaryEntryInput): Promise<DiaryEntry> {
  const body = input.body.trim();
  if (!body) throw new Error('Write something first.');
  if (body.length > MAX_DIARY_LENGTH) {
    throw new Error(`Entries are limited to ${MAX_DIARY_LENGTH} characters.`);
  }

  await cacheGame(input.game);

  const { data, error } = await supabase
    .from('diary_entries')
    .insert({
      user_id: input.userId,
      game_id: input.game.id,
      body,
      ...(input.entryDate ? { entry_date: input.entryDate } : {}),
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateDiaryEntry(entryId: string, body: string): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Write something first.');

  const { error } = await supabase
    .from('diary_entries')
    .update({ body: trimmed })
    .eq('id', entryId);

  if (error) throw new Error(error.message);
}

export async function deleteDiaryEntry(entryId: string): Promise<void> {
  const { error } = await supabase.from('diary_entries').delete().eq('id', entryId);
  if (error) throw new Error(error.message);
}

/**
 * Short numeric date for the entry marker: "12/07".
 *
 * Day-first, matching how the rest of the app formats dates through the
 * device locale. Parsed as a plain calendar date, not a timestamp — `entry_date`
 * is a Postgres `date` with no timezone, and running it through `new Date()`
 * naively would shift it a day for anyone west of UTC.
 */
export function diaryDateParts(entryDate: string): { day: string; month: string; year: string } {
  const [year, month, day] = entryDate.split('-');
  return { day: day ?? '--', month: month ?? '--', year: year ?? '----' };
}
