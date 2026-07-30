import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';
import type { GameList, ListKind, ListSummary, ListWithItems, Tier } from './types';

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

export async function getLists(userId: string): Promise<ListSummary[]> {
  const { data, error } = await supabase
    .from('lists')
    .select('*, items:list_items(position, game:games(cover_url, hero_url))')
    .eq('user_id', userId)
    .order('updated_at', { ascending: false });

  if (error) throw new Error(error.message);

  type Row = GameList & {
    items: {
      position: number;
      game: { cover_url: string | null; hero_url: string | null } | null;
    }[];
  };

  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    itemCount: row.items?.length ?? 0,
    // Only the first four covers are needed for the collage tile.
    covers: (row.items ?? [])
      .sort((a, b) => a.position - b.position)
      .slice(0, 4)
      .map((item) => item.game)
      .filter((game): game is { cover_url: string | null; hero_url: string | null } => !!game),
  }));
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
    .select('*, items:list_items(position, game:games(cover_url, hero_url))')
    .eq('kind', 'list')
    .order('updated_at', { ascending: false })
    .limit(limit);

  type Row = GameList & {
    items: {
      position: number;
      game: { cover_url: string | null; hero_url: string | null } | null;
    }[];
  };

  return unwrap(data as Row[] | null, error).map((row) => ({
    ...row,
    itemCount: row.items?.length ?? 0,
    covers: (row.items ?? [])
      .sort((a, b) => a.position - b.position)
      .slice(0, 4)
      .map((item) => item.game)
      .filter((game): game is { cover_url: string | null; hero_url: string | null } => !!game),
  }));
}
