-- GameLog — pinned games at the head of a library
--
-- Safe to run on its own and more than once; no enum value is added, nothing
-- is dropped.
--
-- ## What a pin is
--
-- Up to six games a person chooses by hand to stand at the top of their
-- library — Apple Music's pinned albums, the owner's reference (2026-10-22).
-- A choice, not a statistic: nothing computes it.
--
-- ## Decisions worth stating
--
-- 1. SIX AT MOST, AND THE TABLE SAYS SO.
--    `position` is 0–5 and unique per person, so a seventh row has nowhere to
--    go. The app writes the first free position.
--
-- 2. ITS OWN `id` PRIMARY KEY.
--    `(user_id, game_id)` holds two foreign keys, and PostgREST reads a table
--    keyed on two foreign keys as a join table — the trap 0031 fell into and
--    0032 repaired. The pair is a UNIQUE constraint instead.
--
-- 3. THE GAME MUST BE IN `games`.
--    A pin is drawn with its game's title and cover, which come from the shared
--    cache, so the app caches the game before it writes the pin.

create table if not exists public.library_pins (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  position   smallint not null check (position between 0 and 5),
  created_at timestamptz not null default now(),
  unique (user_id, game_id),
  unique (user_id, position)
);

alter table public.library_pins enable row level security;

-- Libraries are public, as profiles are.
drop policy if exists "library pins are viewable by everyone" on public.library_pins;
create policy "library pins are viewable by everyone"
  on public.library_pins for select using (true);

drop policy if exists "people pin to their own library" on public.library_pins;
create policy "people pin to their own library"
  on public.library_pins for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "people unpin from their own library" on public.library_pins;
create policy "people unpin from their own library"
  on public.library_pins for delete to authenticated
  using (user_id = auth.uid());

grant select on public.library_pins to anon, authenticated;
grant insert, delete on public.library_pins to authenticated;

comment on table public.library_pins is
  'Up to six games a person pins to the head of their library. Readable by everyone; written by its owner.';
