-- ---------------------------------------------------------------------------
-- 0035 — the shared OpenCritic answer cache, for critic review snippets
-- ---------------------------------------------------------------------------
--
-- The game page's "Critic reviews" rail quotes what outlets wrote, from
-- OpenCritic, through the `opencritic` Edge Function. One game costs that
-- function three upstream requests (find the game, its summary, its reviews),
-- and OpenCritic's RapidAPI plans are metered per day — the free one is a few
-- dozen requests. Without a cache a handful of game pages spends the day's
-- quota; with one, the first person to open a game pays and everyone after
-- them reads a row.
--
-- The same shape and the same rules as 0027's ScanDex cache:
--
-- 1. NOBODY BUT THE EDGE FUNCTION TOUCHES IT.
--    RLS is on and there are no policies and no grants, so `anon` and
--    `authenticated` can neither read nor write it; the function uses the
--    service role. A client-writable cache would let anyone plant reviews
--    under any game's name.
--
-- 2. "OPENCRITIC HAS NOTHING" IS STORED TOO.
--    Most of the catalogue predates OpenCritic or was never reviewed, and
--    re-asking for every one of those on every visit is where a quota goes.
--    The function decides how long each kind of answer is kept.
--
-- 3. NO FOREIGN KEYS.
--    `cache_key` is the app's game id (`igdb:1234`) for a game that may never
--    have been logged here — the same reason 0020's soundtrack cache and 0027
--    have none.
--
-- Optional: without this table the function still answers, it just asks
-- OpenCritic every time. Safe to run on its own and more than once.

create table if not exists public.critic_review_cache (
  -- The app's game id, or `title:<lower-cased title>` when none was sent.
  cache_key     text primary key check (char_length(cache_key) <= 200),
  status        text not null check (status in ('matched', 'missing')),
  opencritic_id integer,
  -- The summary exactly as the function returns it to the app.
  payload       jsonb,
  fetched_at    timestamptz not null default now(),
  constraint critic_review_cache_shape check (
    (status = 'matched' and payload is not null)
    or (status = 'missing' and payload is null)
  )
);

alter table public.critic_review_cache enable row level security;

-- No policies, on purpose: see (1). And no table privileges either, so a policy
-- added by mistake later still would not open it to the client roles.
revoke all on public.critic_review_cache from anon, authenticated;
