-- GameLog — richer game metadata, achievements, and profile identity
--
-- Run this AFTER 0001_init.sql, in the Supabase SQL editor.
--
-- Three things happen here:
--   1. `games` gains the fields IGDB/RAWG return (vertical cover art, platforms,
--      publisher, hero image) that Steam alone could not provide.
--   2. Achievements get a two-table model: a shared per-game catalogue, plus
--      per-user unlock rows.
--   3. `logs` gains completion tracking — the "platinum" and 100% concepts.

-- ---------------------------------------------------------------------------
-- 1. games: metadata the new providers return
-- ---------------------------------------------------------------------------

-- Vertical box art (2:3). `cover_url` was a landscape Steam header before; the
-- poster-led UI needs true portrait art, so hero art moves to its own column.
alter table public.games add column if not exists hero_url     text;
alter table public.games add column if not exists publisher    text;
alter table public.games add column if not exists platforms    text[];
alter table public.games add column if not exists release_year int;
alter table public.games add column if not exists screenshots  text[];

-- IGDB and RAWG are now valid sources alongside Steam and itch.io.
alter table public.games drop constraint if exists games_source_check;
alter table public.games
  add constraint games_source_check
  check (source in ('steam', 'itch', 'igdb', 'rawg'));

-- ---------------------------------------------------------------------------
-- 2. profiles: identity fields the redesigned profile header shows
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists banner_url        text;
alter table public.profiles add column if not exists favorite_platform text;
alter table public.profiles add column if not exists location          text;

-- SteamID64 (17 digits). Set by the user to enable achievement sync; their
-- Steam profile must be public for the Steam API to return anything.
alter table public.profiles add column if not exists steam_id text
  check (steam_id is null or steam_id ~ '^[0-9]{17}$');

-- ---------------------------------------------------------------------------
-- 3. logs: completion tracking
--
-- `platinum` is deliberately a plain boolean rather than something synced.
-- PlayStation has no public trophy API, so for PS titles this is always
-- self-reported; for Steam it can be derived from a 100% achievement sync.
-- ---------------------------------------------------------------------------
alter table public.logs add column if not exists completion_percent numeric(5, 2)
  check (completion_percent between 0 and 100);
alter table public.logs add column if not exists platinum bool not null default false;
alter table public.logs add column if not exists hours_played numeric(7, 1)
  check (hours_played >= 0);
-- Which platform the user actually played on. Free text because it covers
-- consoles we have no API for (PS5, Switch, Xbox) as well as Steam.
alter table public.logs add column if not exists played_on text;

create index if not exists logs_platinum_idx
  on public.logs (user_id) where platinum;

-- ---------------------------------------------------------------------------
-- 4. game_achievements: shared catalogue, one row per achievement per game
--
-- Cached from Steam's schema API / RAWG on demand, exactly like `games`.
-- Shared across all users, so a popular game is only fetched once.
-- ---------------------------------------------------------------------------
create table if not exists public.game_achievements (
  -- '${game_id}:${external_id}', e.g. 'steam:367520:ACH_BEAT_GAME'
  id             text primary key,
  game_id        text not null references public.games (id) on delete cascade,
  -- The provider's own key. Steam calls this `apiname`.
  external_id    text not null,
  name           text not null,
  description    text,
  icon_url       text,
  -- Percent of all players who have unlocked it, when the provider reports it.
  global_percent numeric(5, 2) check (global_percent between 0 and 100),
  -- Steam flags some achievements as hidden until unlocked.
  hidden         bool not null default false,
  cached_at      timestamptz not null default now(),
  unique (game_id, external_id)
);

create index if not exists game_achievements_game_idx
  on public.game_achievements (game_id);

-- ---------------------------------------------------------------------------
-- 5. user_achievements: who unlocked what
-- ---------------------------------------------------------------------------
create table if not exists public.user_achievements (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  achievement_id text not null references public.game_achievements (id) on delete cascade,
  unlocked_at    timestamptz not null default now(),
  -- True when it came from a Steam sync rather than being ticked by hand.
  synced         bool not null default false,
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_idx
  on public.user_achievements (user_id, unlocked_at desc);

-- ---------------------------------------------------------------------------
-- 6. RLS for the new tables
--
-- Same shape as everything else: world-readable, owner-writable. The
-- achievement catalogue is a shared cache like `games` — any signed-in user may
-- populate it, nobody may delete from it.
-- ---------------------------------------------------------------------------
alter table public.game_achievements enable row level security;
alter table public.user_achievements enable row level security;

drop policy if exists "achievements are viewable by everyone" on public.game_achievements;
create policy "achievements are viewable by everyone"
  on public.game_achievements for select using (true);

drop policy if exists "authenticated users cache achievements" on public.game_achievements;
create policy "authenticated users cache achievements"
  on public.game_achievements for insert to authenticated with check (true);

drop policy if exists "authenticated users refresh achievements" on public.game_achievements;
create policy "authenticated users refresh achievements"
  on public.game_achievements for update to authenticated using (true) with check (true);

drop policy if exists "unlocks are viewable by everyone" on public.user_achievements;
create policy "unlocks are viewable by everyone"
  on public.user_achievements for select using (true);

drop policy if exists "users record their own unlocks" on public.user_achievements;
create policy "users record their own unlocks"
  on public.user_achievements for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own unlocks" on public.user_achievements;
create policy "users update their own unlocks"
  on public.user_achievements for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users remove their own unlocks" on public.user_achievements;
create policy "users remove their own unlocks"
  on public.user_achievements for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- 7. Achievement summary
--
-- The profile header needs per-user totals. Doing this as a view keeps the
-- three counts in one round trip instead of three.
-- ---------------------------------------------------------------------------
create or replace view public.profile_achievement_stats
with (security_invoker = true) as
select
  p.id as user_id,
  (select count(*) from public.user_achievements ua where ua.user_id = p.id)
    as achievements_unlocked,
  (select count(*) from public.logs l where l.user_id = p.id and l.platinum)
    as platinums,
  (select count(*) from public.logs l
     where l.user_id = p.id and l.completion_percent = 100)
    as completions,
  (select coalesce(sum(l.hours_played), 0) from public.logs l where l.user_id = p.id)
    as hours_played
from public.profiles p;
