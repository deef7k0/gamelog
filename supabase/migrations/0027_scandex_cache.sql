-- ---------------------------------------------------------------------------
-- 0027 — the shared ScanDex answer cache, for barcode scanning
-- ---------------------------------------------------------------------------
--
-- ScanDex (https://scandex.gamery.app) maps a game box's barcode to an IGDB game
-- and platform. It is asked only when Gamelog's own release database has nothing
-- for a barcode, by the `scandex` Edge Function, which holds the access token.
-- This table remembers what it said, so the first person to scan a box pays for
-- the lookup and everyone after pays a single select — and the token's quota is
-- spent once per barcode, not once per scan.
--
-- Decisions worth stating:
--
-- 1. NOBODY BUT THE EDGE FUNCTION TOUCHES IT.
--    RLS is on and there are no policies at all, so `anon` and `authenticated`
--    can neither read nor write it; the function uses the service role, which
--    bypasses RLS. A client-writable cache would let anyone plant "this barcode
--    is Elden Ring" for everybody. The app never needs to read it directly —
--    the function answers with what it found.
--
-- 2. NEGATIVE ANSWERS ARE STORED.
--    `missing` (ScanDex has never seen the barcode) and `unmatched` (it has, with
--    no game attached) are answers, and not storing them would re-ask ScanDex on
--    every scan of every cereal box. They expire sooner than matches do — the
--    function decides how soon — because ScanDex's catalogue grows.
--
-- 3. A SCANDEX MATCH IS NOT A GAMELOG RELEASE.
--    ScanDex says which game and platform; it says nothing about region or
--    edition, which is what a `game_releases` row is. So nothing here is copied
--    into the canonical tables: a match identifies the game on the scan screen,
--    and the release itself still comes from people, through the 0024 claims.
--
-- 4. NO FOREIGN KEYS.
--    `igdb_game_id` names a game that may never have been logged here, exactly
--    like 0020's soundtrack cache; FK-ing it to `games` would force a catalogue
--    write for every box anyone scanned.
--
-- Safe to run as a single script. Run 0024 first — `gtin_is_valid` lives there.

create table if not exists public.scandex_lookups (
  -- GTIN-14, the same key `release_barcodes` uses.
  barcode           text primary key check (public.gtin_is_valid(barcode)),
  status            text not null check (status in ('matched', 'unmatched', 'missing')),
  igdb_game_id      integer,
  game_name         text check (char_length(game_name) <= 300),
  igdb_platform_id  integer,
  platform_name     text check (char_length(platform_name) <= 120),
  fetched_at        timestamptz not null default now(),
  -- A match names a game; the other two name nothing.
  constraint scandex_lookups_match_shape check (
    (status = 'matched' and igdb_game_id is not null)
    or (status <> 'matched' and igdb_game_id is null)
  )
);

alter table public.scandex_lookups enable row level security;

-- No policies, on purpose: see (1). And no table privileges either, so a policy
-- added by mistake later still would not open it to the client roles.
revoke all on public.scandex_lookups from anon, authenticated;
