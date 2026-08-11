-- GameLog — a chosen cover for a collection
--
-- The collection tile used to render a 2x2 collage of the first four covers.
-- It now shows a single piece of box art, so the owner needs a way to say
-- *which* one. Null means "no choice made" and the tile falls back to the first
-- item's cover, which is what every existing collection will do.
--
-- Safe to run on its own. No enum values are added, so this does not hit the
-- 55P04 trap that split 0006/0007.

alter table public.lists
  add column if not exists cover_game_id text
    references public.games (id) on delete set null;

comment on column public.lists.cover_game_id is
  'Game whose cover represents this collection. Null = fall back to the first item.';

-- ---------------------------------------------------------------------------
-- Keep the cover honest
--
-- `on delete set null` above only fires if the *game* is deleted from the
-- catalogue, which effectively never happens. The case that actually happens is
-- the game being removed from this list — the row leaves `list_items` and the
-- games table is untouched — which would leave a collection displaying art for
-- a game it no longer contains.
--
-- A CHECK cannot express "must exist in list_items" (it cannot see other rows),
-- and Postgres has no FK to a pair you do not own, so this is a trigger. Same
-- reasoning as `assert_target_exists` in 0003.
-- ---------------------------------------------------------------------------

create or replace function public.clear_list_cover_on_remove()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.lists
     set cover_game_id = null
   where id = old.list_id
     and cover_game_id = old.game_id;
  return old;
end;
$$;

drop trigger if exists list_items_clear_cover on public.list_items;
create trigger list_items_clear_cover
  after delete on public.list_items
  for each row execute function public.clear_list_cover_on_remove();

-- ---------------------------------------------------------------------------
-- And that it points at something the list actually holds
--
-- Guards the write path the same way, so a client cannot set the cover to a
-- game that is not in the collection. Raises rather than silently nulling: this
-- one is a caller bug, not ordinary churn.
-- ---------------------------------------------------------------------------

create or replace function public.assert_list_cover_present()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.cover_game_id is null then
    return new;
  end if;

  if not exists (
    select 1 from public.list_items
     where list_id = new.id
       and game_id = new.cover_game_id
  ) then
    raise exception 'cover_game_id % is not in list %', new.cover_game_id, new.id
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

drop trigger if exists lists_assert_cover on public.lists;
create trigger lists_assert_cover
  before insert or update of cover_game_id on public.lists
  for each row execute function public.assert_list_cover_present();
