-- GameLog — what kind of release a cached game is
--
-- Safe to run on its own. No enum values are added, so this does not hit the
-- 55P04 trap that split 0006/0007 and 0015/0016.
--
-- ---------------------------------------------------------------------------
-- Why the cache has to know
-- ---------------------------------------------------------------------------
--
-- `edition` is read from IGDB, and everywhere the app talks to IGDB it already
-- has it. The problem is everywhere it does not: a collection tile, a feed row,
-- a profile's favourites and an award slot all render from `public.games`,
-- which is a copy of the metadata taken at log time. Without these columns a
-- remake is badged in search and un-badged the moment somebody adds it to a
-- list — the same game, labelled inconsistently, depending on which screen
-- found it.
--
-- Text, not an enum. The vocabulary lives in `constants/game-editions.ts` and
-- is a *collapse* of IGDB's fifteen categories into six labels; that mapping is
-- a product decision and will move. An enum would make every adjustment a
-- migration that cannot run in the same transaction as its own use — see 0015
-- for how much ceremony that costs — to buy a constraint on a column no query
-- filters on.
-- ---------------------------------------------------------------------------

alter table public.games
  add column if not exists edition_kind text
    check (edition_kind is null or edition_kind in
      ('remake', 'remaster', 'dlc', 'expansion', 'port', 'edition', 'bundle'));

comment on column public.games.edition_kind is
  'Release type: remake, remaster, dlc, expansion, port, edition, bundle. Null = this is the game.';

/*
 * The game this descends from, as an app-wide id (`igdb:1234`).
 *
 * Deliberately **not** a foreign key to `games`. The parent is very often not
 * in the cache: somebody logs "Mafia: Definitive Edition" without ever having
 * touched the 2002 original, and an FK would force the app to fetch and cache a
 * game nobody asked for on every write — or fail. The column is a pointer the
 * game page resolves through IGDB when it needs it, and a dangling value costs
 * one empty section rather than a broken insert.
 */
alter table public.games
  add column if not exists parent_game_id text;

comment on column public.games.parent_game_id is
  'App-wide id of the game this is a version of. Not an FK: the parent is often not cached.';

/*
 * Read by the parent game's "Editions & extras" section.
 *
 * Partial, because the overwhelming majority of rows are plain games with a
 * null here and there is no reason to index them.
 */
create index if not exists games_parent_idx
  on public.games (parent_game_id)
  where parent_game_id is not null;
