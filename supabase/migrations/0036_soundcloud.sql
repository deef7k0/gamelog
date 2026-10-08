-- ---------------------------------------------------------------------------
-- 0036 — soundtracks move from Apple Music to SoundCloud
-- ---------------------------------------------------------------------------
--
-- A game's soundtrack used to come from the iTunes Search API, which needs no
-- key and gives 30-second previews. It comes from SoundCloud now, through the
-- `soundcloud` Edge Function, which holds a client id and secret and plays
-- whole tracks in the app's own player.
--
-- Four things here, and TWO OF THEM DELETE DATA. Read 3 and 4 before running.
--
-- 1. `soundcloud_tokens` — the app's API token, shared by every instance of the
--    function. New tokens are rationed (50 per 12 hours), so one is kept and
--    renewed rather than asked for on every cold start.
--
-- 2. `soundcloud_matches` — which SoundCloud upload is a game's soundtrack.
--    IDENTIFIERS ONLY, and that is the rule of this table, not an economy:
--    SoundCloud's API terms forbid an app to "cache, download or persistently
--    store any User Content" — titles, names, artwork, audio. So this stores a
--    playlist's URN or a list of track URNs and never a word about them.
--    Everything shown is fetched from SoundCloud when it is asked for. Do not
--    add a title, an uploader or an artwork column here.
--
--    Neither table has a policy or a grant: only the function's service role
--    reads or writes them, the same model as `scandex_lookups` (0027).
--
-- 3. `starred_songs` IS EMPTIED, at the owner's decision ("remove them"): every
--    profile's pinned Apple Music song is deleted, and the columns that held
--    its title, artist, artwork and preview address are dropped. A starred song
--    is a SoundCloud track's URN from here on, and its title is fetched live,
--    for the reason in 2.
--
-- 4. `game_soundtracks` (0020) IS DROPPED. It was the shared cache of iTunes
--    lookups — a cache, nothing anybody wrote — and it held exactly the kind of
--    stored track list rule 2 forbids for SoundCloud.
--
-- Safe to run as a single script: no new enum values. The app must be on the
-- SoundCloud build first — the old one reads the columns 3 drops.
-- ---------------------------------------------------------------------------

-- 1 -------------------------------------------------------------------------

create table if not exists public.soundcloud_tokens (
  /** One row, ever: the primary key can only be `true`. */
  id            boolean primary key default true check (id),
  access_token  text not null,
  /** Single-use. The function swaps the row on it, so two instances cannot both spend one. */
  refresh_token text,
  expires_at    timestamptz not null,
  updated_at    timestamptz not null default now()
);

alter table public.soundcloud_tokens enable row level security;
revoke all on public.soundcloud_tokens from anon, authenticated;

comment on table public.soundcloud_tokens is
  'The app''s SoundCloud API token, kept so it can be renewed instead of '
  're-issued. Service role only: no policies, no grants.';

-- 2 -------------------------------------------------------------------------

create table if not exists public.soundcloud_matches (
  /**
   * The app-wide game id, `'${source}:${sourceId}'`. Not a foreign key, for
   * 0020's reason: a game whose soundtrack was looked at has not been logged.
   */
  game_id         text primary key check (char_length(game_id) between 3 and 200),

  /**
   * Did the search find a soundtrack? `false` is a completed search that came
   * back with nothing convincing, and is what stops an obscure game asking
   * SoundCloud six questions on every visit. A failed search writes no row.
   */
  found           boolean not null,

  /** One uploader's playlist, or a list of tracks assembled from search. */
  source          text check (source in ('playlist', 'tracks')),
  playlist_urn    text check (playlist_urn like 'soundcloud:playlists:%'),
  track_urns      text[] check (track_urns is null or cardinality(track_urns) <= 300),

  /** The matcher that chose it. A newer matcher re-runs the search. */
  matcher_version integer not null default 1,
  fetched_at      timestamptz not null default now(),

  constraint soundcloud_matches_shape check (
    (not found and source is null and playlist_urn is null and track_urns is null)
    or (found and source = 'playlist' and playlist_urn is not null and track_urns is null)
    or (found and source = 'tracks' and playlist_urn is null and track_urns is not null)
  )
);

alter table public.soundcloud_matches enable row level security;
revoke all on public.soundcloud_matches from anon, authenticated;

comment on table public.soundcloud_matches is
  'Which SoundCloud playlist or tracks are a game''s soundtrack, as URNs only: '
  'SoundCloud''s terms forbid storing titles, names or artwork. Service role '
  'only: no policies, no grants.';

-- 3 -------------------------------------------------------------------------
-- DELETES EVERY STARRED SONG.

delete from public.starred_songs;

alter table public.starred_songs
  drop column if exists title,
  drop column if exists artist,
  drop column if exists artwork_url,
  drop column if exists preview_url;

alter table public.starred_songs
  drop constraint if exists starred_songs_track_is_soundcloud;
alter table public.starred_songs
  add constraint starred_songs_track_is_soundcloud
  check (track_id like 'soundcloud:tracks:%' and char_length(track_id) <= 80);

comment on column public.starred_songs.track_id is
  'A SoundCloud track URN. Its title and uploader are fetched from SoundCloud '
  'when a profile is shown, never stored.';

-- 4 -------------------------------------------------------------------------
-- DROPS THE iTUNES CACHE.

drop table if exists public.game_soundtracks;
