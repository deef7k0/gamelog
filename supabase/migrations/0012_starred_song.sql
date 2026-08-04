-- GameLog — one starred song per profile
--
-- A single track someone pins to their profile, the way Instagram pins a song
-- to a bio. Not a playlist and not a favourites list: exactly one, chosen from
-- a game's soundtrack, shown on the profile with its 30-second preview.
--
-- Safe to run as a single script — no new enum values.

create table if not exists public.starred_songs (
  /**
   * The primary key *is* the user, which is what enforces "one song".
   *
   * Modelled this way rather than as a `starred boolean` on a songs table, or a
   * list capped in the client, because the cap is the feature: an upsert on this
   * table replaces the pick atomically, and there is no state in which a profile
   * has two starred songs even if two devices race.
   */
  user_id uuid primary key references public.profiles (id) on delete cascade,

  /**
   * iTunes track id, as text.
   *
   * Soundtracks come from the iTunes Search API (see src/lib/soundtracks.ts) and
   * are not part of the `games` catalogue, so this deliberately has no foreign
   * key. The track metadata below is copied in for the same reason `games`
   * copies IGDB metadata: a profile has to render without calling iTunes.
   */
  track_id text not null,
  title    text not null check (char_length(trim(title)) between 1 and 300),
  artist   text not null check (char_length(trim(artist)) between 1 and 300),

  /** Album artwork, already upscaled by the client. */
  artwork_url text,

  /**
   * The 30-second AAC clip. Nullable because iTunes omits it for some tracks —
   * and a starred song with no preview is still a valid statement about taste,
   * it just cannot be played.
   */
  preview_url text,

  /** Which game's soundtrack it came from, for the "from <game>" credit. */
  game_id    text references public.games (id) on delete set null,
  game_title text,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- World-readable, like `profiles` and `logs` — the whole point is that other
-- people see it. Writable only by its owner.
-- ---------------------------------------------------------------------------
alter table public.starred_songs enable row level security;

drop policy if exists "starred songs are viewable by everyone" on public.starred_songs;
create policy "starred songs are viewable by everyone"
  on public.starred_songs for select using (true);

drop policy if exists "users set their own starred song" on public.starred_songs;
create policy "users set their own starred song"
  on public.starred_songs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users change their own starred song" on public.starred_songs;
create policy "users change their own starred song"
  on public.starred_songs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users clear their own starred song" on public.starred_songs;
create policy "users clear their own starred song"
  on public.starred_songs for delete to authenticated
  using (auth.uid() = user_id);

-- Reuses the shared trigger function defined in 0011.
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists starred_songs_touch_updated_at on public.starred_songs;
create trigger starred_songs_touch_updated_at
  before update on public.starred_songs
  for each row execute function public.touch_updated_at();

comment on table public.starred_songs is
  'One pinned track per profile, chosen from a game soundtrack. The primary key '
  'on user_id is what enforces the limit of one.';
