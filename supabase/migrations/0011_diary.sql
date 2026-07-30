-- GameLog — per-game diaries
--
-- A diary is a running log of short notes about one game: "finally beat the
-- Nameless King", "dropped it again", "started NG+". It is deliberately not the
-- same thing as `logs.review`, which is a single verdict on the whole game and
-- gets rewritten. A diary accumulates.
--
-- Safe to run as a single script — no new enum values.

create table if not exists public.diary_entries (
  id       uuid primary key default gen_random_uuid(),
  user_id  uuid not null references public.profiles (id) on delete cascade,
  game_id  text not null references public.games (id) on delete cascade,

  /**
   * The short note itself. Capped tight on purpose: a diary entry that runs to
   * a thousand words is a review, and this app already has somewhere better for
   * that (`logs.review`, which gets the long-form editor).
   */
  body text not null check (char_length(trim(body)) between 1 and 500),

  /**
   * The day the entry is *about*, which is not always the day it was written —
   * people write up a session the morning after. Defaults to today so the
   * composer needs no date picker, and is what the list sorts and groups on.
   */
  entry_date date not null default current_date,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The diary screen reads one user's entries for one game, newest first.
create index if not exists diary_entries_user_game_idx
  on public.diary_entries (user_id, game_id, entry_date desc, created_at desc);

-- The wall reads a user's most recent entries across every game.
create index if not exists diary_entries_recent_idx
  on public.diary_entries (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Readable by everyone: the requirement is explicitly that other users can
-- inspect a diary, and it matches how `logs` and `profiles` already behave in
-- this app. Writable only by its author.
-- ---------------------------------------------------------------------------
alter table public.diary_entries enable row level security;

drop policy if exists "diary entries are viewable by everyone" on public.diary_entries;
create policy "diary entries are viewable by everyone"
  on public.diary_entries for select using (true);

drop policy if exists "users write their own diary" on public.diary_entries;
create policy "users write their own diary"
  on public.diary_entries for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users edit their own diary" on public.diary_entries;
create policy "users edit their own diary"
  on public.diary_entries for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own diary" on public.diary_entries;
create policy "users delete their own diary"
  on public.diary_entries for delete to authenticated
  using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- updated_at
--
-- `logs` maintains this with a trigger already; reusing the same function keeps
-- one definition rather than two that can drift.
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists diary_entries_touch_updated_at on public.diary_entries;
create trigger diary_entries_touch_updated_at
  before update on public.diary_entries
  for each row execute function public.touch_updated_at();

comment on table public.diary_entries is
  'Short dated notes about one game. Distinct from logs.review, which is a '
  'single rewritten verdict; a diary accumulates.';
