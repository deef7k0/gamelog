-- ---------------------------------------------------------------------------
-- 0020 — the shared soundtrack cache, for Surprise Me
-- ---------------------------------------------------------------------------
--
-- Surprise Me hands you a game and one track from its soundtrack. Finding that
-- soundtrack costs two calls to the iTunes Search API — one to work out which
-- album really is this game's OST, one to rank its tracks by popularity — and
-- the answer is the same for everybody. Caching it here means the first person
-- to roll a game pays for the lookup and everyone after pays a single select.
--
-- Three decisions worth stating, because each one is easy to get wrong later:
--
-- 1. `found` IS THE POINT OF THE TABLE.
--
--    Most games have no released soundtrack. Without a row recording that we
--    looked and there was nothing, every obscure game re-asks iTunes on every
--    roll and gets nothing back — which is the single most expensive thing this
--    feature could do. A negative result is a result, so it is stored. That is
--    why the metadata columns are nullable and `found` is not: a row with
--    `found = false` is complete, not half-written.
--
-- 2. NO FOREIGN KEY TO `games`.
--
--    `games` is the catalogue of things somebody actually logged or listed, and
--    `logs.game_id` / `list_items.game_id` reference it. A rolled game has been
--    *looked at*, not logged. FK-ing this table to `games` would force a
--    `cacheGame()` write for every game anyone idly rolled past, filling the
--    catalogue with rows no user ever touched. So `game_id` is just the
--    app-wide `'${source}:${sourceId}'` string, unconstrained — the same
--    reasoning `starred_songs` (0012) uses for not referencing a track table.
--
-- 3. THE TRACKS ARE JSONB, NOT A CHILD TABLE.
--
--    Nothing queries across tracks. They are read as a block, picked from in
--    memory by `pickTrack()`, and rewritten as a block when the album changes.
--    A `soundtrack_tracks` table would buy a join and cost a second round trip
--    on the one read path that matters.
--
-- Safe to run as a single script — no new enum values, no changes to any
-- existing table. Run 0012–0019 first if they are not applied yet.
-- ---------------------------------------------------------------------------

create table if not exists public.game_soundtracks (
  /**
   * The app-wide game id, `'${source}:${sourceId}'` — e.g. `igdb:1020`.
   * Deliberately not a foreign key; see note 2 above.
   */
  game_id text primary key check (char_length(game_id) between 3 and 200),

  /** Carried for debugging and for the "from <game>" credit on a starred song. */
  game_title text not null check (char_length(trim(game_title)) between 1 and 300),

  /**
   * Did the lookup find a soundtrack?
   *
   * `false` means iTunes was asked and returned nothing convincing — not that
   * the lookup failed. A failed lookup writes no row at all, so it is retried.
   */
  found boolean not null,

  -- The identified album. All null when `found` is false.
  album_id     text check (char_length(album_id) <= 64),
  album_title  text check (char_length(album_title) <= 300),
  artist       text check (char_length(artist) <= 300),
  artwork_url  text check (char_length(artwork_url) <= 500),
  /** The album's Apple Music page, for "listen in full". */
  external_url text check (char_length(external_url) <= 500),

  /**
   * The track list, as
   * `[{ id, title, artist, trackNumber, durationMs, previewUrl, trackUrl,
   *     popularityRank }]`.
   *
   * `popularityRank` is the track's position in a popularity-ordered iTunes
   * song search, or null for tracks that search did not surface. The cap is a
   * sanity bound on a world-writable column, not a product limit — the largest
   * real game OST in the test set was 56 tracks.
   */
  tracks jsonb not null default '[]'::jsonb
    check (jsonb_typeof(tracks) = 'array' and jsonb_array_length(tracks) <= 300),

  fetched_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
--
-- Same trust model as the `games` cache in 0014, and for the same reason: this
-- holds no per-user rows. Anyone may read it (sharing the lookup is the whole
-- feature), any signed-in user may add or refresh an entry, nobody may delete
-- one. The CHECK constraints above are what keep a world-writable table from
-- becoming free storage.
-- ---------------------------------------------------------------------------
alter table public.game_soundtracks enable row level security;

drop policy if exists "soundtracks are viewable by everyone" on public.game_soundtracks;
create policy "soundtracks are viewable by everyone"
  on public.game_soundtracks for select
  using (true);

drop policy if exists "authenticated users cache soundtracks" on public.game_soundtracks;
create policy "authenticated users cache soundtracks"
  on public.game_soundtracks for insert to authenticated
  with check (auth.uid() is not null);

/*
 * The UPDATE policy is required by the INSERT, not only by an edit: supabase-js
 * `.upsert()` issues `INSERT ... ON CONFLICT DO UPDATE`, and Postgres checks
 * the UPDATE policy on the conflicting row before it will take that branch. A
 * project with the insert policy but not this one fails on the *second* person
 * to roll a given game, which makes it look intermittent. 0014 has the long
 * version of this note.
 *
 * It is also what lets a stale `found = false` row be refreshed once a game
 * finally gets a soundtrack release.
 */
drop policy if exists "authenticated users refresh soundtracks" on public.game_soundtracks;
create policy "authenticated users refresh soundtracks"
  on public.game_soundtracks for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

comment on table public.game_soundtracks is
  'Shared cache of game soundtrack lookups against the iTunes Search API. '
  'Keyed by the app-wide game id, with no FK to public.games: a rolled game has '
  'been looked at, not logged. `found = false` records a completed lookup that '
  'came back empty, which is what stops obscure games re-querying iTunes '
  'forever.';
