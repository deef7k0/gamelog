-- ---------------------------------------------------------------------------
-- 0039 — the shared Steam store page cache: awards, and events & announcements
-- ---------------------------------------------------------------------------
--
-- The game page's Awards card and its "Events & announcements" rail come from
-- the game's Steam store page, through the `steam-store` Edge Function: the
-- awards out of the page's HTML (~250 KB to read one block), the events from
-- the endpoint the page fills its own list from. Without a cache every person
-- who opens a game asks Steam again; with one, the first pays and everybody
-- after reads a row.
--
-- The same shape and the same rules as 0027's ScanDex cache and 0035's
-- OpenCritic cache:
--
-- 1. NOBODY BUT THE EDGE FUNCTION TOUCHES IT.
--    RLS is on and there are no policies and no grants, so `anon` and
--    `authenticated` can neither read nor write it; the function uses the
--    service role. A client-writable cache would let anyone plant an image URL
--    under any game.
--
-- 2. "STEAM HAS NOTHING" IS STORED TOO.
--    Most games have no Awards section, and asking again for every one of
--    them on every visit is the cost this exists to avoid. The function
--    decides how long each kind of answer is kept: a week for awards, an hour
--    for events, less for a failure.
--
-- 3. KEYED ON THE STEAM APPID, WITH NO FOREIGN KEY.
--    A Steam appid is not a row of anything here: the game behind it may never
--    have been logged, and IGDB is where the app finds the appid.
--
-- Optional: without this table the function still answers, it just asks Steam
-- every time. Safe to run on its own and more than once.

create table if not exists public.steam_store_cache (
  appid      integer not null check (appid > 0),
  kind       text not null check (kind in ('awards', 'events')),
  status     text not null check (status in ('found', 'none', 'unavailable')),
  -- The answer exactly as the function returns it to the app.
  payload    jsonb,
  fetched_at timestamptz not null default now(),
  primary key (appid, kind)
);

alter table public.steam_store_cache enable row level security;

-- No policies, on purpose: see (1). And no table privileges either, so a policy
-- added by mistake later still would not open it to the client roles.
revoke all on public.steam_store_cache from anon, authenticated;
