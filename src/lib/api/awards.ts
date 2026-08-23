import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';
import type { AwardSlot, ListWithAwards } from './types';

/**
 * Award shows: a list of categories, each of which may name a winner.
 *
 * Kept apart from `lists.ts` because the two answer different questions. A
 * collection is a set of games and the order is a preference; an award show is a
 * set of *slots* and the games are the contents. The tables mirror that split —
 * `list_awards` holds the ballot, and migration 0016's trigger projects whatever
 * has won into `list_items` so the rest of the app (tile mosaics, item counts,
 * likes, "which lists is this game in") needs to know nothing about awards.
 *
 * **Nothing here writes `list_items`.** That is the trigger's job, and doing it
 * from the client as well would race with it — two categories naming the same
 * game, then one of them changing, is exactly the case a client-side "remove if
 * unused" check gets wrong.
 */

/**
 * The categories every new show starts with, for the client to render
 * optimistically and for tests to assert against.
 *
 * The real seeding happens in Postgres — `create_awards_list()` inserts these in
 * the same transaction as the list, because a list that exists with half a
 * ballot is worse than one that failed outright. This copy is documentation, and
 * the two are expected to be compared by eye; there is no drift to detect at
 * runtime because nothing reads this to build a list.
 */
export const DEFAULT_AWARD_CATEGORIES: readonly string[] = [
  'Game of the Year',
  'Indie of the Year',
  'Best Narrative',
  'Best Soundtrack',
  'Best Art Direction',
  'Best Game Direction',
  'Best Multiplayer',
  'Games for Impact',
];

/**
 * Create an awards list with its eight empty categories.
 *
 * One RPC rather than an insert plus eight, so the ballot arrives whole. The
 * function is SECURITY DEFINER and reads `auth.uid()` itself, which is why there
 * is no `userId` parameter here to pass wrong.
 */
export async function createAwardsList(input: {
  title: string;
  description?: string | null;
}): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the award show a title.');

  const { data, error } = await supabase.rpc('create_awards_list', {
    list_title: title,
    list_description: input.description?.trim() || null,
  });

  if (error) throw new Error(error.message);
  return data as string;
}

/**
 * A show and its ballot, in ballot order.
 *
 * Sorted client-side on `(position, created_at)` to match the index: `position`
 * alone is ambiguous for two categories added before any reorder, and a ballot
 * that reshuffles between visits looks like a bug.
 */
export async function getAwards(listId: string): Promise<ListWithAwards | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, awards:list_awards(*, game:games(*))')
    .eq('id', listId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const list = data as ListWithAwards;
  list.awards = (list.awards ?? []).sort(
    (a, b) => a.position - b.position || a.created_at.localeCompare(b.created_at)
  );
  return list;
}

/**
 * Add a category to the end of the ballot.
 *
 * `position` is read rather than assumed: the eight defaults land on 0–7, and a
 * ninth inserted at 0 would sort above Game of the Year.
 */
export async function addAwardCategory(
  listId: string,
  input: { label: string; game?: Game | null; note?: string | null }
): Promise<string> {
  const label = input.label.trim();
  if (!label) throw new Error('Give the award a name.');

  if (input.game) await cacheGame(input.game);

  const { data: last } = await supabase
    .from('list_awards')
    .select('position')
    .eq('list_id', listId)
    .order('position', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from('list_awards')
    .insert({
      list_id: listId,
      label,
      position: (last?.position ?? -1) + 1,
      game_id: input.game?.id ?? null,
      note: input.note?.trim() || null,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Name a winner, or clear the slot by passing null.
 *
 * The game is cached first for the same reason `addToList` does it: the FK on
 * `list_awards.game_id` points at `games`, and the trigger that mirrors the win
 * into `list_items` would fail on its own FK a moment later.
 */
export async function setAwardGame(awardId: string, game: Game | null): Promise<void> {
  if (game) await cacheGame(game);

  const { error } = await supabase
    .from('list_awards')
    .update({ game_id: game?.id ?? null })
    .eq('id', awardId);

  if (error) throw new Error(error.message);
}

/** Rewrite the category's name. */
export async function renameAward(awardId: string, label: string): Promise<void> {
  const trimmed = label.trim();
  if (!trimmed) throw new Error('Give the award a name.');

  const { error } = await supabase.from('list_awards').update({ label: trimmed }).eq('id', awardId);

  if (error) throw new Error(error.message);
}

/** The owner's case for why this game won. Empty string clears it. */
export async function setAwardNote(awardId: string, note: string): Promise<void> {
  const { error } = await supabase
    .from('list_awards')
    .update({ note: note.trim() || null })
    .eq('id', awardId);

  if (error) throw new Error(error.message);
}

/**
 * Delete a category outright.
 *
 * Every category is deletable, including the eight the app seeded — they are a
 * starting point, not a schema. The trigger takes the winner out of the
 * underlying collection unless another category still names it.
 */
export async function deleteAward(awardId: string): Promise<void> {
  const { error } = await supabase.from('list_awards').delete().eq('id', awardId);
  if (error) throw new Error(error.message);
}

/**
 * Persist a new ballot order.
 *
 * An upsert of the whole ballot rather than two updates for a swap: `position`
 * is unconstrained, so a partial write that collides is legal and leaves the
 * order to `created_at`. Rewriting every row keeps the sequence dense.
 *
 * `label` and `list_id` ride along because upsert needs the full row for any
 * column it might insert — these ids all exist, so nothing is inserted, but
 * omitting a NOT NULL column makes supabase-js reject the payload.
 */
export async function reorderAwards(
  listId: string,
  ordered: readonly { id: string; label: string }[]
): Promise<void> {
  if (ordered.length === 0) return;

  const { error } = await supabase.from('list_awards').upsert(
    ordered.map((award, index) => ({
      id: award.id,
      list_id: listId,
      label: award.label,
      position: index,
    })),
    { onConflict: 'id' }
  );

  if (error) throw new Error(error.message);
}

/**
 * Move one category up or down, returning the ballot in its new order.
 *
 * The screen calls this and hands the result to `reorderAwards`. Split out so
 * the swap is testable and so the arrow buttons and any future drag handle agree
 * on what "up" means.
 */
export function swapAwards(
  awards: readonly AwardSlot[],
  index: number,
  delta: -1 | 1
): AwardSlot[] {
  const target = index + delta;
  if (target < 0 || target >= awards.length) return awards.slice();

  const next = awards.slice();
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}
