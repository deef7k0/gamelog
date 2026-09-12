import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';
import type { GameList, ListCover, ListKind, ListSummary, ListWithItems, Tier } from './types';

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

/**
 * Row shape shared by every query that builds a `ListSummary`.
 *
 * Exported with `SUMMARY_ITEMS` and `resolvePreview` because `discover.ts`
 * builds the same summaries; this was restated in four places and the copies
 * drifted the moment a column was added.
 */
export type SummaryRow = GameList & {
  items: { position: number; game_id: string; game: ListCover | null }[];
  owner: { username: string | null; display_name: string | null; avatar_url: string | null } | null;
};

/**
 * The embedded select every summary query needs. Compose it into a `select()`.
 *
 * The owner is embedded rather than fetched per tile: a wall of collections
 * would otherwise be one profile request each. `lists_user_id_fkey` is declared
 * in `database.types.ts`, which is what lets supabase-js type this as the joined
 * row instead of `SelectQueryError` — see the note in CLAUDE.md.
 */
export const SUMMARY_ITEMS =
  'items:list_items(position, game_id, game:games(id, title, cover_url, hero_url)), ' +
  'owner:profiles!lists_user_id_fkey(username, display_name, avatar_url)';

/**
 * Pick the one cover a collection tile shows.
 *
 * The owner's choice wins. Falling back to the first item rather than to
 * nothing matters: every collection that existed before `cover_game_id` has a
 * null there, and a wall of empty tiles would look broken rather than
 * unconfigured. The `cover_game_id` lookup is defensive — a trigger already
 * clears it when the game leaves the list, but the tile should not depend on
 * that having run.
 */
export function resolvePreview(row: SummaryRow): ListCover | null {
  const items = (row.items ?? []).slice().sort((a, b) => a.position - b.position);
  if (items.length === 0) return null;

  const chosen = row.cover_game_id
    ? items.find((item) => item.game_id === row.cover_game_id)
    : undefined;

  return (chosen ?? items[0]).game ?? null;
}

/**
 * The first four covers, for the tile's 2x2 mosaic.
 *
 * Free: `SUMMARY_ITEMS` already embeds every item's cover so `resolvePreview`
 * can pick one, so this reads from data the query was fetching anyway. Returns
 * however many exist — one, two or three games give a shorter mosaic, and the
 * tile lays out whatever it is handed rather than padding with placeholders.
 *
 * Ordered by `position`, not by the owner's chosen cover: the mosaic is "what is
 * in here", where `preview` is "what represents it". A collection's first four
 * games in order is a more honest summary than four arbitrary ones.
 */
export function resolveMosaic(row: SummaryRow): ListCover[] {
  return (row.items ?? [])
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is ListCover => game !== null)
    .slice(0, 4);
}

const SUMMARY_SELECT = `*, ${SUMMARY_ITEMS}`;

export async function getLists(userId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as SummaryRow[]).map((row) => ({
    ...row,
    itemCount: row.items?.length ?? 0,
    preview: resolvePreview(row),
    mosaic: resolveMosaic(row),
  }));
}

/**
 * Choose which game's cover represents a collection.
 *
 * `gameId` must already be in the list — migration 0014 enforces that with a
 * trigger rather than trusting the client, so passing a game that is not in it
 * raises instead of silently storing a dangling reference. Pass null to go back
 * to the default (the first item).
 */
export async function setListCover(listId: string, gameId: string | null): Promise<void> {
  const { error } = await supabase.from('lists').update({ cover_game_id: gameId }).eq('id', listId);

  if (error) throw new Error(error.message);
}

export async function getList(listId: string): Promise<ListWithItems | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, items:list_items(*, game:games(*))')
    .eq('id', listId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const list = data as ListWithItems;
  list.items?.sort((a, b) => a.position - b.position);
  return list;
}

export async function createList(
  userId: string,
  input: { title: string; description?: string | null; kind?: ListKind; isRanked?: boolean }
): Promise<string> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the list a title.');

  const { data, error } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      title,
      description: input.description?.trim() || null,
      kind: input.kind ?? 'list',
      is_ranked: input.isRanked ?? false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  return data.id;
}

/**
 * Rename a collection, or rewrite what it says about itself.
 *
 * Title and description only. `kind` and `is_ranked` are deliberately not here:
 * a tier list whose items carry tiers cannot become a plain collection without
 * deciding what happens to those tiers, and an award show's rows exist in
 * `list_awards` before they exist in `list_items` — flipping either one is a
 * migration of the collection's contents, not an edit to its details, and a
 * settings field that silently discarded data would be the worst way to offer
 * it.
 *
 * `.eq('user_id', userId)` belts the RLS policy's braces. The policy is what
 * actually enforces this; the filter is what makes a non-owner's attempt come
 * back as "nothing matched" instead of a permission error.
 */
export async function updateListDetails(
  userId: string,
  listId: string,
  input: { title: string; description?: string | null }
): Promise<void> {
  const title = input.title.trim();
  if (!title) throw new Error('Give the collection a title.');

  const { error } = await supabase
    .from('lists')
    .update({
      title,
      description: input.description?.trim() || null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', listId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Write the caption under a game in a captioned collection.
 *
 * Stored in `list_items.note`, which has held a 300-character text field since
 * 0003 and never had a consumer — see migration 0019 for why the caption reuses
 * it rather than adding a column.
 *
 * An empty string clears it rather than storing `''`. A caption is the whole
 * point of the row in this kind of list, so "no caption" has to be a state the
 * grid can detect and prompt for, and `null` is that state.
 */
export async function setItemCaption(
  listId: string,
  gameId: string,
  caption: string | null
): Promise<void> {
  const trimmed = caption?.trim();

  const { error } = await supabase
    .from('list_items')
    .update({ note: trimmed || null })
    .eq('list_id', listId)
    .eq('game_id', gameId);

  if (error) throw new Error(error.message);
}

export async function deleteList(userId: string, listId: string): Promise<void> {
  const { error } = await supabase.from('lists').delete().eq('id', listId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/**
 * Fetch the user's singleton list of a given kind, creating it on first use.
 *
 * Favourites and wishlist are one-per-user (enforced by a partial unique index)
 * and should always exist from the UI's point of view, so this hides the
 * "does it exist yet" question from callers.
 */
export async function getOrCreateSingletonList(
  userId: string,
  kind: 'favorites' | 'wishlist'
): Promise<GameList> {
  const { data, error } = await supabase
    .from('lists')
    .select('*')
    .eq('user_id', userId)
    .eq('kind', kind)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (data) return data;

  const { data: created, error: createError } = await supabase
    .from('lists')
    .insert({
      user_id: userId,
      title: kind === 'favorites' ? 'Favourites' : 'Wishlist',
      kind,
      is_ranked: kind === 'favorites',
    })
    .select('*')
    .single();

  if (createError) throw new Error(createError.message);
  return created;
}

/** Favourites, ready for the four-poster identity row. */
export async function getFavorites(userId: string): Promise<ListWithItems | null> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, items:list_items(*, game:games(*))')
    .eq('user_id', userId)
    .eq('kind', 'favorites')
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const list = data as ListWithItems;
  list.items?.sort((a, b) => a.position - b.position);
  return list;
}

export async function addToList(
  listId: string,
  game: Game,
  options?: { position?: number; tier?: Tier | null; note?: string | null }
): Promise<void> {
  // list_items has an FK to games, so the cache row must exist first.
  await cacheGame(game);

  const { error } = await supabase.from('list_items').upsert(
    {
      list_id: listId,
      game_id: game.id,
      position: options?.position ?? 0,
      tier: options?.tier ?? null,
      note: options?.note ?? null,
    },
    { onConflict: 'list_id,game_id' }
  );
  if (error) throw new Error(error.message);
}

/**
 * Add a game to the end of a list.
 *
 * `addToList` defaults `position` to 0, which is right for a wishlist toggle and
 * wrong for a curated collection: every game added that way lands in the same
 * slot and the stored order becomes whatever Postgres felt like. Counting first
 * costs one HEAD request and keeps a ranked list's numbering meaningful.
 *
 * Re-adding an existing game is a no-op rather than an error — `addToList`
 * upserts on `(list_id, game_id)` — so a caller does not have to check
 * membership first to stay safe.
 */
export async function appendToList(listId: string, game: Game): Promise<void> {
  const { count } = await supabase
    .from('list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', listId);

  await addToList(listId, game, { position: count ?? 0 });
}

export async function removeFromList(listId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from('list_items')
    .delete()
    .eq('list_id', listId)
    .eq('game_id', gameId);
  if (error) throw new Error(error.message);
}

/**
 * Persist a new ordering (and tier assignment) after a drag.
 *
 * Sent as one upsert rather than N updates so a reorder is a single round trip.
 */
export async function reorderList(
  listId: string,
  items: { gameId: string; position: number; tier?: Tier | null }[]
): Promise<void> {
  if (items.length === 0) return;

  const { error } = await supabase.from('list_items').upsert(
    items.map((item) => ({
      list_id: listId,
      game_id: item.gameId,
      position: item.position,
      tier: item.tier ?? null,
    })),
    { onConflict: 'list_id,game_id' }
  );
  if (error) throw new Error(error.message);
}

/** Whether a game sits in the user's favourites / wishlist — for toggle buttons. */
export async function getListMembership(
  userId: string,
  gameId: string
): Promise<{ favorited: boolean; wishlisted: boolean }> {
  const { data, error } = await supabase
    .from('list_items')
    .select('list_id, lists!inner(user_id, kind)')
    .eq('game_id', gameId)
    .eq('lists.user_id', userId);

  if (error) throw new Error(error.message);

  type Row = { lists: { kind: string } | { kind: string }[] };
  const kinds = new Set<string>();
  for (const row of (data ?? []) as Row[]) {
    const list = Array.isArray(row.lists) ? row.lists[0] : row.lists;
    if (list?.kind) kinds.add(list.kind);
  }

  return { favorited: kinds.has('favorites'), wishlisted: kinds.has('wishlist') };
}

/** Add/remove a game from a singleton list, creating the list if needed. */
export async function toggleSingletonMembership(
  userId: string,
  kind: 'favorites' | 'wishlist',
  game: Game,
  member: boolean
): Promise<void> {
  const list = await getOrCreateSingletonList(userId, kind);

  if (!member) {
    await removeFromList(list.id, game.id);
    return;
  }

  // Append to the end rather than colliding at position 0.
  const { count } = await supabase
    .from('list_items')
    .select('*', { count: 'exact', head: true })
    .eq('list_id', list.id);

  await addToList(list.id, game, { position: count ?? 0 });
}

export async function getPublicLists(limit = 30): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select(SUMMARY_SELECT)
    .eq('kind', 'list')
    .order('updated_at', { ascending: false })
    .limit(limit);

  return unwrap(data as SummaryRow[] | null, error).map((row) => ({
    ...row,
    itemCount: row.items?.length ?? 0,
    preview: resolvePreview(row),
    mosaic: resolveMosaic(row),
  }));
}
