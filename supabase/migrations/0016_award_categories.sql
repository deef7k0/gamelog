-- GameLog — award categories
--
-- Run 0015 first: it commits the 'awards' value of `list_kind`, which the
-- functions below insert.
--
-- ---------------------------------------------------------------------------
-- Why this is not `list_items`
-- ---------------------------------------------------------------------------
--
-- An award show is a list of *slots*, and a slot exists before it has a game in
-- it — a fresh awards list is eight empty categories waiting to be filled.
-- `list_items` cannot express that: its primary key is `(list_id, game_id)`, so
-- there is no such thing as a row without a game. Widening it would make every
-- other collection's key nullable to serve one kind of list.
--
-- So slots live here, and the *game* still lands in `list_items` as well — see
-- the sync trigger below. That is not duplication for its own sake: a game
-- given an award genuinely is in the collection, and `list_items` is what the
-- rest of the app reads for the tile mosaic, the item count, likes, discover,
-- and "which of my lists is this game in". Keeping awards out of it would have
-- meant teaching six unrelated queries about a seventh table.

create table if not exists public.list_awards (
  id       uuid primary key default gen_random_uuid(),
  list_id  uuid not null references public.lists (id) on delete cascade,

  /* The category. "Game of the Year", or whatever the owner typed. */
  label    text not null check (char_length(trim(label)) between 1 and 60),

  /* Order within the show. Ties broken by `created_at` so a list whose
     positions were never written still renders in a stable order. */
  position int not null default 0,

  /*
   * The winner, or null for a category nobody has filled in yet.
   *
   * `on delete cascade` would take the whole category with the game, which is
   * wrong — losing a game from the catalogue should empty the slot, not delete
   * "Best Soundtrack".
   */
  game_id  text references public.games (id) on delete set null,

  /* Why it won, in the owner's words. Longer than `list_items.note`'s 300: this
     is the point of the feature rather than an aside on a shelf. */
  note     text check (char_length(note) <= 1000),

  created_at timestamptz not null default now()
);

create index if not exists list_awards_order_idx
  on public.list_awards (list_id, position, created_at);

/* One award per game per show. Two categories won by the same game is a real
   thing (Game of the Year and Best Gameplay), so this is deliberately *not* a
   unique constraint on (list_id, game_id) — only the id is unique. */

-- ---------------------------------------------------------------------------
-- Keep `list_items` in step
--
-- The award slot is the source of truth; `list_items` is the projection every
-- other screen reads. Doing it here rather than in the client means a slot and
-- the collection can never disagree, including when a game is deleted from the
-- catalogue and the FK above nulls the slot out.
--
-- Removing is conditional: two categories can name the same game, so the game
-- only leaves the collection when the last slot holding it lets go.
-- ---------------------------------------------------------------------------

create or replace function public.sync_award_list_items()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_list uuid := new.list_id;
  /* Null on INSERT. Read into a local rather than touching `old` in the
     comparisons below: PL/pgSQL leaves `old` unassigned for an INSERT, and how
     forgiving it is about field access on an unassigned record has changed
     between server versions. */
  previous text := case when tg_op = 'UPDATE' then old.game_id else null end;
  next_pos    int;
begin
  -- Gone from this slot: drop it from the collection unless another slot in the
  -- same show still names it.
  if previous is not null and (new.game_id is null or new.game_id <> previous) then
    if not exists (
      select 1 from public.list_awards
       where list_id = target_list
         and game_id = previous
         and id <> new.id
    ) then
      delete from public.list_items
       where list_id = target_list and game_id = previous;
    end if;
  end if;

  -- Newly named: add it at the end of the collection. `on conflict do nothing`
  -- rather than an upsert, so re-winning does not shuffle an existing row's
  -- position out from under the collection view.
  if new.game_id is not null and (previous is null or new.game_id <> previous) then
    select coalesce(max(position) + 1, 0) into next_pos
      from public.list_items where list_id = target_list;

    insert into public.list_items (list_id, game_id, position)
    values (target_list, new.game_id, next_pos)
    on conflict (list_id, game_id) do nothing;
  end if;

  return new;
end;
$$;

/*
 * Insert and update share the function; delete needs its own path because
 * `new` is null there and the logic above would dereference it.
 */
create or replace function public.sync_award_list_items_on_delete()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.game_id is not null and not exists (
    select 1 from public.list_awards
     where list_id = old.list_id
       and game_id = old.game_id
       and id <> old.id
  ) then
    delete from public.list_items
     where list_id = old.list_id and game_id = old.game_id;
  end if;

  return old;
end;
$$;

drop trigger if exists list_awards_sync_items on public.list_awards;
create trigger list_awards_sync_items
  after insert or update of game_id on public.list_awards
  for each row execute function public.sync_award_list_items();

drop trigger if exists list_awards_sync_items_delete on public.list_awards;
create trigger list_awards_sync_items_delete
  after delete on public.list_awards
  for each row execute function public.sync_award_list_items_on_delete();

-- ---------------------------------------------------------------------------
-- The default ballot
--
-- Every awards list opens with these eight, in this order, empty. They are the
-- categories a game-of-the-year post actually has, and starting from a blank
-- page is the difference between filling something in and designing something.
--
-- Not enforced anywhere: the owner can rename, reorder and delete every one of
-- them, including Game of the Year. This is a starting point, not a schema.
-- ---------------------------------------------------------------------------

create or replace function public.seed_award_categories(target_list uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  defaults text[] := array[
    'Game of the Year',
    'Indie of the Year',
    'Best Narrative',
    'Best Soundtrack',
    'Best Art Direction',
    'Best Game Direction',
    'Best Multiplayer',
    'Games for Impact'
  ];
begin
  insert into public.list_awards (list_id, label, position)
  select target_list, label, ordinality - 1
    from unnest(defaults) with ordinality as t(label, ordinality);
end;
$$;

/*
 * Create an awards list and its ballot in one round trip.
 *
 * SECURITY DEFINER, so it must check the caller itself — it is callable by any
 * authenticated user and would otherwise create lists owned by anyone.
 */
create or replace function public.create_awards_list(
  list_title text,
  list_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
begin
  if auth.uid() is null then
    raise exception 'must be signed in' using errcode = '42501';
  end if;

  insert into public.lists (user_id, title, description, kind, is_ranked)
  values (auth.uid(), list_title, list_description, 'awards', false)
  returning id into new_id;

  perform public.seed_award_categories(new_id);

  return new_id;
end;
$$;

grant execute on function public.create_awards_list(text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS — same shape as `list_items`: public to read, owner to write
-- ---------------------------------------------------------------------------

alter table public.list_awards enable row level security;

drop policy if exists "award slots are viewable by everyone" on public.list_awards;
create policy "award slots are viewable by everyone"
  on public.list_awards for select using (true);

drop policy if exists "owners add award slots" on public.list_awards;
create policy "owners add award slots"
  on public.list_awards for insert to authenticated
  with check (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

drop policy if exists "owners update award slots" on public.list_awards;
create policy "owners update award slots"
  on public.list_awards for update to authenticated
  using (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ))
  with check (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

drop policy if exists "owners delete award slots" on public.list_awards;
create policy "owners delete award slots"
  on public.list_awards for delete to authenticated
  using (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));
