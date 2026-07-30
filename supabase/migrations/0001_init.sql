-- GameLog — initial schema
--
-- Run this in the Supabase dashboard SQL editor (or `supabase db push`) before
-- starting the app. Everything is behind Row Level Security, which is what makes
-- it safe to ship the anon key inside the app bundle.
--
-- Model in one line: a `log` is one user's relationship to one game (status +
-- optional rating + optional review). Feeds, profiles and reviews are all just
-- different queries over `logs`.

-- ---------------------------------------------------------------------------
-- profiles: public identity, 1:1 with auth.users
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  username     text not null unique
                 check (username ~ '^[a-zA-Z0-9_]{3,24}$'),
  display_name text check (char_length(display_name) <= 50),
  avatar_url   text,
  bio          text check (char_length(bio) <= 300),
  created_at   timestamptz not null default now()
);

-- Case-insensitive uniqueness: "Nomico" and "nomico" must not both exist.
create unique index if not exists profiles_username_lower_idx
  on public.profiles (lower(username));

-- ---------------------------------------------------------------------------
-- games: local cache of metadata fetched from Steam / itch.io
--
-- The external APIs are rate limited and slow, and a feed showing 50 logs would
-- otherwise need 50 Steam calls. Rows are written on demand the first time a
-- game is logged, so this table only ever holds games someone actually cares
-- about.
-- ---------------------------------------------------------------------------
create table if not exists public.games (
  id           text primary key,            -- '${source}:${source_id}', e.g. 'steam:367520'
  source       text not null check (source in ('steam', 'itch')),
  source_id    text not null,
  title        text not null,
  cover_url    text,
  description  text,
  release_date text,                        -- free-form; providers are wildly inconsistent
  developer    text,
  genres       text[],
  score        int check (score between 0 and 100),
  store_url    text,
  cached_at    timestamptz not null default now(),
  unique (source, source_id)
);

-- ---------------------------------------------------------------------------
-- logs: the core object
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.log_status as enum ('playing', 'played', 'backlog', 'dropped');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  game_id    text not null references public.games (id) on delete cascade,
  status     public.log_status not null default 'played',
  -- Half-star ratings, stored as 1..10 so the column stays an integer.
  rating     int check (rating between 1 and 10),
  review     text check (char_length(review) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- One log per user per game. Re-logging edits the existing row.
  unique (user_id, game_id)
);

-- Feed and profile both read logs newest-first.
create index if not exists logs_created_at_idx on public.logs (created_at desc);
create index if not exists logs_user_created_idx on public.logs (user_id, created_at desc);
create index if not exists logs_game_idx on public.logs (game_id);

-- ---------------------------------------------------------------------------
-- follows: directed edges driving the feed
-- ---------------------------------------------------------------------------
create table if not exists public.follows (
  follower_id  uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create index if not exists follows_following_idx on public.follows (following_id);

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

-- Keep logs.updated_at honest so "edited" ordering is possible later.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists logs_touch_updated_at on public.logs;
create trigger logs_touch_updated_at
  before update on public.logs
  for each row execute function public.touch_updated_at();

-- Create a profile automatically when someone signs up. Without this, a user
-- exists in auth.users but has no profile, and every join returns null.
-- The username comes from sign-up metadata; fall back to a derived one so this
-- can never block account creation.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  desired  text := nullif(trim(new.raw_user_meta_data ->> 'username'), '');
  fallback text := 'user_' || substr(replace(new.id::text, '-', ''), 1, 12);
begin
  insert into public.profiles (id, username, display_name)
  values (
    new.id,
    coalesce(desired, fallback),
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), '')
  )
  on conflict (id) do nothing;
  return new;
exception
  -- Username collided with an existing one; fall back rather than fail signup.
  when unique_violation then
    insert into public.profiles (id, username)
    values (new.id, fallback)
    on conflict (id) do nothing;
    return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Row Level Security
--
-- This app is public-by-design (like Letterboxd): profiles, logs and follows are
-- readable by anyone, but only ever writable by the row's owner.
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.games    enable row level security;
alter table public.logs     enable row level security;
alter table public.follows  enable row level security;

-- profiles
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert with check (auth.uid() = id);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- games: a shared cache. Any signed-in user may add or refresh an entry;
-- nobody may delete, so one user cannot break another's feed.
drop policy if exists "games are viewable by everyone" on public.games;
create policy "games are viewable by everyone"
  on public.games for select using (true);

drop policy if exists "authenticated users cache games" on public.games;
create policy "authenticated users cache games"
  on public.games for insert to authenticated with check (true);

drop policy if exists "authenticated users refresh games" on public.games;
create policy "authenticated users refresh games"
  on public.games for update to authenticated using (true) with check (true);

-- logs
drop policy if exists "logs are viewable by everyone" on public.logs;
create policy "logs are viewable by everyone"
  on public.logs for select using (true);

drop policy if exists "users write their own logs" on public.logs;
create policy "users write their own logs"
  on public.logs for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own logs" on public.logs;
create policy "users update their own logs"
  on public.logs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own logs" on public.logs;
create policy "users delete their own logs"
  on public.logs for delete to authenticated using (auth.uid() = user_id);

-- follows
drop policy if exists "follows are viewable by everyone" on public.follows;
create policy "follows are viewable by everyone"
  on public.follows for select using (true);

drop policy if exists "users manage their own follows" on public.follows;
create policy "users manage their own follows"
  on public.follows for insert to authenticated with check (auth.uid() = follower_id);

drop policy if exists "users unfollow" on public.follows;
create policy "users unfollow"
  on public.follows for delete to authenticated using (auth.uid() = follower_id);
