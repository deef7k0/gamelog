-- GameLog — how far you got, how many times, and how you played
--
-- Run after 0022 (which must run on its own).
--
-- ## What this does not do: add a `user_games` table
--
-- `logs` already is that table. Since 0001 it has been one row per user per game
-- — `unique (user_id, game_id)` — holding the relationship (status), the verdict
-- (rating, review) and, since 0002, the progress (completion_percent, platinum,
-- hours, platform). A second table meaning "this user's relationship with this
-- game" would be a competing copy of the row every feed, profile and review
-- already reads. So this migration extends `logs` and hangs the new, genuinely
-- one-to-many thing — playthroughs — underneath it.
--
-- ## 1. Completion, as a level rather than a percentage
--
-- `completion_percent` stays: "73%" is a real thing people track. But a
-- percentage pretends to an objectivity most games do not offer — 100% of what?
-- — and it cannot say the two things players actually say: "I finished the
-- story" and "I did everything". So `completion` is categorical:
--
--   story  the credits rolled
--   main   the story plus the main side content
--   full   everything the game has to do — the 100%
--
-- Null means "not recorded", which is every row before this migration except
-- the ones backfilled below. It is independent of `status` on purpose: a game can
-- be `paused` after the story, while you work through the post-game.
--
-- DLC is not a level here. An expansion is its own `games` row (IGDB models it
-- as one, and 0017 carries `edition_kind = 'dlc'`), so "I finished the DLC" is a
-- log with a completion on that row — nothing about this column prevents it.
--
-- ## 2. Review context: co-op and player count
--
-- Only what the reviewer tells us. Null is "not said", not "solo": a review that
-- never mentioned how it was played must not be counted in a solo-only filter.
--
-- ## 3. Playthroughs
--
-- One row per run of a game — the platform, when, how far — so replaying Red
-- Dead Redemption 2 on PC in 2026 does not overwrite the PS4 run from 2021. A
-- playthrough belongs to a log through a composite foreign key on
-- `(user_id, game_id)`, which is what makes the hierarchy real rather than
-- conventional: a playthrough cannot exist without its log, and removing the log
-- removes its runs.
--
-- Dates are partial ISO strings — '2021', '2021-05' or '2021-05-14' — because
-- nobody remembers the day they started a game they played five years ago, and
-- storing '2021-01-01' for "sometime in 2021" would print a date that was never
-- said. They sort correctly as text.

-- ---------------------------------------------------------------------------
-- 1–2. Columns on logs
-- ---------------------------------------------------------------------------

alter table public.logs
  add column if not exists completion text;

alter table public.logs drop constraint if exists logs_completion_check;
alter table public.logs
  add constraint logs_completion_check
  check (completion is null or completion in ('story', 'main', 'full'));

alter table public.logs
  add column if not exists coop boolean;

alter table public.logs
  add column if not exists player_count smallint;

-- A player count is a co-op fact. "Solo, with four players" is not a thing.
alter table public.logs drop constraint if exists logs_player_count_check;
alter table public.logs
  add constraint logs_player_count_check
  check (player_count is null or (coop is true and player_count between 2 and 16));

-- The existing way to say "100%" was a percentage of exactly 100 or the platinum
-- flag. Carry both into the level, so the new filters and the old data agree on
-- day one instead of every pre-existing 100% run reading as "not recorded".
update public.logs
   set completion = 'full'
 where completion is null
   and (completion_percent = 100 or platinum);

-- The review sheet filters within one game by these.
create index if not exists logs_game_completion_idx
  on public.logs (game_id, completion)
  where review is not null;

/*
 * The order of the levels, for "is this further than that".
 *
 * Immutable and tiny, so it can sit in a trigger and an index expression. Null
 * and anything unknown rank 0 — below `story` — which is what lets the trigger
 * below treat "no level yet" as the bottom of the scale.
 */
create or replace function public.completion_rank(level text)
returns int
language sql
immutable
as $$
  select case level
    when 'story' then 1
    when 'main'  then 2
    when 'full'  then 3
    else 0
  end
$$;

-- ---------------------------------------------------------------------------
-- 3. Playthroughs
-- ---------------------------------------------------------------------------

create table if not exists public.playthroughs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null,
  game_id            text not null,
  -- Same vocabulary as `logs.played_on`: the platform's short form ("PS4").
  platform           text check (char_length(platform) between 1 and 40),
  started_on         text check (started_on ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  finished_on        text check (finished_on ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  completion         text check (completion is null or completion in ('story', 'main', 'full')),
  completion_percent numeric(5, 2) check (completion_percent between 0 and 100),
  hours              numeric(7, 1) check (hours >= 0),
  notes              text check (char_length(notes) <= 500),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  foreign key (user_id, game_id)
    references public.logs (user_id, game_id)
    on delete cascade
);

create index if not exists playthroughs_log_idx
  on public.playthroughs (user_id, game_id, created_at);

drop trigger if exists playthroughs_touch_updated_at on public.playthroughs;
create trigger playthroughs_touch_updated_at
  before update on public.playthroughs
  for each row execute function public.touch_updated_at();

/*
 * A playthrough that got further than the log says raises the log. Never lowers.
 *
 * The log's `completion` is the headline — "how far has this person got with
 * this game, ever" — and the best run is the honest answer to that. Raising only
 * is the whole design: a second run that is still in progress must not knock a
 * finished game back to "not recorded", and deleting a run is not a statement
 * that you did not finish the game. Lowering the headline stays a deliberate act,
 * done on the log itself.
 *
 * Invoker rights, not SECURITY DEFINER: a playthrough can only be written by its
 * owner (RLS below), so the log being raised is always the caller's own, and the
 * logs update policy already permits it.
 */
create or replace function public.raise_log_completion()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.completion is null then
    return new;
  end if;

  update public.logs
     set completion = new.completion
   where user_id = new.user_id
     and game_id = new.game_id
     and public.completion_rank(completion) < public.completion_rank(new.completion);

  return new;
end;
$$;

drop trigger if exists playthroughs_raise_log_completion on public.playthroughs;
create trigger playthroughs_raise_log_completion
  after insert or update of completion on public.playthroughs
  for each row execute function public.raise_log_completion();

-- ---------------------------------------------------------------------------
-- RLS — the same shape as `logs`: public to read, owner to write
-- ---------------------------------------------------------------------------

alter table public.playthroughs enable row level security;

drop policy if exists "playthroughs are viewable by everyone" on public.playthroughs;
create policy "playthroughs are viewable by everyone"
  on public.playthroughs for select using (true);

-- `auth.uid() = user_id` plus the composite foreign key is the whole check: the
-- key requires a log at (user_id, game_id), and user_id must be the caller, so
-- the only log a playthrough can attach to is the caller's own.
drop policy if exists "users add their own playthroughs" on public.playthroughs;
create policy "users add their own playthroughs"
  on public.playthroughs for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update their own playthroughs" on public.playthroughs;
create policy "users update their own playthroughs"
  on public.playthroughs for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own playthroughs" on public.playthroughs;
create policy "users delete their own playthroughs"
  on public.playthroughs for delete to authenticated
  using (auth.uid() = user_id);
