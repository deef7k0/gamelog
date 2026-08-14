-- ---------------------------------------------------------------------------
-- 0014 — repair the shared games cache policies
--
-- WHY THIS EXISTS
--
-- Logging a game fails with:
--
--   new row violates row-level security policy for table "games"
--
-- `cacheGame()` in src/lib/api/core.ts upserts the game's metadata into
-- `public.games` before writing the log, so *every* write path — the quick
-- Playing/Played buttons, the log form, wishlist, favourites, achievements —
-- goes through that insert first. With no usable INSERT policy, all of them
-- fail at the same place.
--
-- 0001 already declares the right policies. This migration re-asserts them
-- because the deployed database evidently does not have them: either 0001 was
-- applied before those statements were added to it, or the policies were
-- edited in the dashboard afterwards. It is written to be safe to run whatever
-- the current state is — every statement drops first and nothing here depends
-- on the previous contents.
--
-- WHAT CHANGED FROM 0001
--
-- The role grant is kept AND an explicit `auth.uid() is not null` check is
-- added. `to authenticated` alone is a grant on the Postgres *role*, which is a
-- different question from "is there a signed-in user", and the two can come
-- apart — an expired JWT that PostgREST still routes as `authenticated`, or a
-- project configured with newer signing keys. Saying it both ways costs nothing
-- and removes the ambiguity.
--
-- This does not widen access. `games` is a shared metadata cache with no
-- per-user rows in it: any signed-in user may add or refresh an entry, nobody
-- may delete one, and everyone may read. That was the intent in 0001 and it is
-- unchanged here.
--
-- Safe to run more than once.
-- ---------------------------------------------------------------------------

alter table public.games enable row level security;

-- Read: public, like the rest of the catalogue.
drop policy if exists "games are viewable by everyone" on public.games;
create policy "games are viewable by everyone"
  on public.games for select
  using (true);

-- Insert: any signed-in user may add a game to the cache.
drop policy if exists "authenticated users cache games" on public.games;
create policy "authenticated users cache games"
  on public.games for insert to authenticated
  with check (auth.uid() is not null);

-- Update: any signed-in user may refresh one.
--
-- Required by the INSERT itself, not only by an edit: supabase-js `.upsert()`
-- issues `INSERT ... ON CONFLICT DO UPDATE`, and Postgres checks the UPDATE
-- policy on the conflicting row before it will take that branch. A project with
-- the insert policy but not this one fails on the *second* person to log a
-- given game, which makes it look intermittent.
drop policy if exists "authenticated users refresh games" on public.games;
create policy "authenticated users refresh games"
  on public.games for update to authenticated
  using (auth.uid() is not null)
  with check (auth.uid() is not null);

-- Deliberately no DELETE policy: one user must not be able to remove a game out
-- from under everybody else's logs.

-- ---------------------------------------------------------------------------
-- Verifying
--
-- After running this, confirm three policies come back — select / insert /
-- update — and no delete:
--
--   select policyname, cmd, roles, qual, with_check
--     from pg_policies
--    where schemaname = 'public' and tablename = 'games'
--    order by cmd;
--
-- If the error persists with all three present, the request is not arriving as
-- an authenticated user at all. Check that from the client:
--
--   const { data } = await supabase.auth.getSession();
--   console.log(data.session?.user.id, data.session?.expires_at);
--
-- A null session there with the app still showing you as signed in means the
-- stored session failed to refresh, and the fix is signing out and back in
-- rather than anything in this file.
-- ---------------------------------------------------------------------------
