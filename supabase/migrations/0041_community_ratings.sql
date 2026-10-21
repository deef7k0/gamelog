-- ---------------------------------------------------------------------------
-- 0041 — The community score: a weighted average of every rating here
-- ---------------------------------------------------------------------------
--
-- Run after 0040. Safe to re-run. Changes no canonical data: `logs` is read,
-- never written, and every rating keeps its value.
--
-- WHAT IT REPLACES
--   A game's GameLog score was the plain mean of its ratings, and the phone
--   worked it out: `getRatingBreakdown` downloaded every rating of the game
--   and averaged them. This makes the score a weighted mean, computed here,
--   from the canonical ratings alone, and stored where every screen reads the
--   same row (`game_ratings`).
--
-- THE ALGORITHM
--   `src/lib/community-rating.ts` states it in full, as a TypeScript reference
--   implementation the tests and `scripts/community-rating-sql.mjs` check
--   this file against. In one breath:
--
--     every rating counts; a person's weight is 1.00 unless their ratings
--     both rarely vary (normalised entropy over five 20-point bands under
--     0.15) — 0.85 at most — or rarely vary *and* sit further from everybody
--     else's than 97.5% of comparable people's — 0.70 at most; the
--     adjustment grows from nothing at 10 ratings to all of it at 30; and a
--     game's score is Σ rating × weight / Σ weight.
--
--   Disagreeing with everybody, on its own, costs nothing. Nothing reads a
--   date, a login, a review or an account's age: the inputs are
--   (user_id, game_id, rating) and the parameters in
--   `community_rating_params()`, so time passing changes no weight, and
--   writing a review adds none.
--
-- WHO SEES WHAT
--   `game_ratings` is public, like the ratings it averages — except
--   `weight_sum` and `effective_raters`, which are not granted to clients: on
--   a game one person rated, the weight sum *is* that person's weight.
--   `rater_stats` is readable by its owner alone (`my_rating_influence()`),
--   and by moderators only in aggregate (`community_rating_report()`). One
--   thing cannot be hidden and is said instead: on a game with two or three
--   raters, the weighted and plain means beside its public ratings say
--   something about those raters' weights relative to one another. That is
--   inherent to publishing a weighted average of public ratings.
--
--   Clients write none of it. The three tables have no write policies and no
--   write grants; the recalculation runs as the owner, from triggers.
--
-- CONSISTENCY
--   Statement-level triggers on `logs` fire on any change to a rating
--   (insert, edit, delete — a moderator's removal, an account's deletion by
--   cascade), and only then: a status-only edit changes no rating and does
--   nothing. While the app holds up to `syncFullRecalculationMaxRatings`
--   ratings (5,000), a change recalculates *everything* — every person's
--   weight and every game's score — inside the same transaction, so after
--   the save commits no screen can read a stale number. A transaction-level
--   advisory lock serialises recalculations, so two people saving at once
--   cannot overwrite each other's update with an older snapshot (this
--   assumes READ COMMITTED, which is what PostgREST runs).
--
--   The limit is measured, not guessed: in PGlite (WebAssembly, slower than
--   the real thing) one save cost 0.3 s at 10,000 ratings and 0.9 s at
--   25,000 when it recalculated everything, and 23 ms at 50,000 when it
--   refreshed only its game (scripts/community-rating-sql.mjs builds the
--   schema it was timed on).
--
--   Above the limit, a change refreshes the changed games at once, with the
--   weights as last computed (a new rater's is 1.00), and marks the weights
--   stale (`community_rating_state.stale_since`). The first save after they
--   have been stale for `staleRecalculationMinutes` (15) recalculates them,
--   so they never lag further than that behind anybody's activity. To take
--   that cost off people's saves, schedule it instead — with pg_cron, from
--   the SQL editor:
--
--     select cron.schedule('community-ratings', '*/15 * * * *',
--                          'select public._recalculate_community_ratings()');
--
--   That job is a pure function of the ratings: run twice with nothing
--   changed in between, it writes nothing. No job is created here.
--
-- REBUILDING, AND ROLLING BACK
--   Everything here is derived. `select public._recalculate_community_ratings();`
--   rebuilds all of it from `logs` (moderators: `recalculate_community_ratings()`).
--   To roll back: re-run 0026_review_stats.sql and 0037_beloved_games.sql
--   (their functions are redefined below and read `rater_stats`), then
--
--     drop trigger logs_community_ratings_insert on public.logs;
--     drop trigger logs_community_ratings_update on public.logs;
--     drop trigger logs_community_ratings_delete on public.logs;
--     drop table public.game_ratings, public.rater_stats, public.community_rating_state;
--
--   The app reads a missing `game_ratings` (PGRST205) as "not migrated" and
--   shows the plain mean, worked out as it was before.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The parameters — the same object as `COMMUNITY_RATING` in
-- `src/lib/community-rating.ts`; `npm test` fails if the two differ. A change
-- to any number is a new migration that bumps "version".
-- ---------------------------------------------------------------------------

create or replace function public.community_rating_params()
returns jsonb
language sql
immutable
parallel safe
as $$
  select '{
    "version": 1,
    "scale": { "min": 0, "max": 100 },
    "entropy": { "bucketWidth": 20, "buckets": 5, "lowThreshold": 0.15 },
    "confidence": { "from": 10, "full": 30 },
    "deviation": { "minOtherRaters": 3, "minComparisons": 10, "minPopulation": 40, "highPercentile": 97.5 },
    "penalty": { "lowEntropy": 0.15, "combined": 0.3 },
    "weight": { "min": 0.7, "max": 1 },
    "precision": 6,
    "syncFullRecalculationMaxRatings": 5000,
    "staleRecalculationMinutes": 15
  }'::jsonb
$$;

grant execute on function public.community_rating_params() to anon, authenticated;

comment on function public.community_rating_params() is
  'The community score''s parameters (0041). Mirrors COMMUNITY_RATING in src/lib/community-rating.ts.';

-- ---------------------------------------------------------------------------
-- Tables — all derived, all rebuildable from `logs`
-- ---------------------------------------------------------------------------

create table if not exists public.rater_stats (
  user_id              uuid primary key references public.profiles (id) on delete cascade,
  -- Distinct games rated: one current rating per game is `logs`' own key.
  rated_count          int not null check (rated_count > 0),
  -- Ratings per 20-point band, lowest band first.
  distribution         int[] not null,
  entropy              numeric not null check (entropy >= 0),
  normalized_entropy   numeric not null check (normalized_entropy between 0 and 1),
  -- Ratings of games with at least `minOtherRaters` other raters.
  comparison_count     int not null check (comparison_count >= 0),
  -- Null below `minComparisons`: unavailable, never read as high.
  average_deviation    numeric check (average_deviation between 0 and 1),
  -- Null while fewer than `minPopulation` people have an average.
  deviation_percentile numeric check (deviation_percentile between 0 and 100),
  low_entropy          boolean not null,
  high_deviation       boolean not null,
  pattern_confidence   numeric not null check (pattern_confidence between 0 and 1),
  target_penalty       numeric not null check (target_penalty >= 0),
  -- The floor and ceiling are the parameters'. A change to them is a change
  -- to this constraint too; `npm test` reads both.
  weight               numeric not null check (weight between 0.70 and 1.00),
  algorithm_version    int not null,
  -- When these values last changed. A recalculation that changes nothing
  -- leaves it alone.
  computed_at          timestamptz not null default now()
);

comment on table public.rater_stats is
  'Each rater''s rating statistics and weight (0041). Derived from logs; readable by its owner only.';

create table if not exists public.game_ratings (
  game_id           text primary key references public.games (id) on delete cascade,
  -- The community score: Σ rating × weight / Σ weight. Never rounded here.
  weighted_rating   numeric not null,
  -- The plain mean, beside it for comparison.
  raw_mean          numeric not null,
  -- Distinct people who rated the game.
  raters            int not null check (raters > 0),
  weight_sum        numeric not null check (weight_sum > 0),
  -- (Σ w)² / Σ w²: a diagnostic, not a head count.
  effective_raters  numeric not null check (effective_raters > 0),
  min_rating        int not null,
  max_rating        int not null,
  -- The ten bands the ratings graph draws: 1–10 (with 0) … 91–100.
  histogram         int[] not null,
  algorithm_version int not null,
  computed_at       timestamptz not null default now(),
  -- A weighted mean of positive weights lies between the lowest and highest
  -- rating it averages; so does the plain one.
  constraint game_ratings_within_range check (
    weighted_rating between min_rating and max_rating
    and raw_mean between min_rating and max_rating
  )
);

comment on table public.game_ratings is
  'Each game''s community score (0041): the weighted mean of its ratings, the plain mean, how many raters. Derived from logs.';

create table if not exists public.community_rating_state (
  id                boolean primary key default true check (id),
  algorithm_version int not null,
  -- The last full recalculation, and what it found.
  recalculated_at   timestamptz,
  duration_ms       numeric,
  rated_logs        int,
  raters            int,
  -- People with enough comparisons for a deviation average.
  comparable_raters int,
  games             int,
  -- Weights may lag the ratings since this moment; null when they do not.
  stale_since       timestamptz
);

insert into public.community_rating_state (id, algorithm_version)
values (true, 1)
on conflict (id) do nothing;

-- Every aggregate reads a game's ratings, or all of them, and nothing else.
create index if not exists logs_rated_idx
  on public.logs (game_id) include (user_id, rating)
  where rating is not null;

-- ---------------------------------------------------------------------------
-- Who may read what. No client writes any of it.
-- ---------------------------------------------------------------------------

alter table public.rater_stats enable row level security;
alter table public.game_ratings enable row level security;
alter table public.community_rating_state enable row level security;

drop policy if exists "people read their own rating statistics" on public.rater_stats;
create policy "people read their own rating statistics"
  on public.rater_stats for select to authenticated using (auth.uid() = user_id);

drop policy if exists "community scores are public" on public.game_ratings;
create policy "community scores are public"
  on public.game_ratings for select using (true);

drop policy if exists "the recalculation's state is public" on public.community_rating_state;
create policy "the recalculation's state is public"
  on public.community_rating_state for select using (true);

revoke all on public.rater_stats from anon, authenticated;
revoke all on public.game_ratings from anon, authenticated;
revoke all on public.community_rating_state from anon, authenticated;

grant select on public.rater_stats to authenticated;
grant select (game_id, weighted_rating, raw_mean, raters, min_rating, max_rating, histogram,
              algorithm_version, computed_at)
  on public.game_ratings to anon, authenticated;
grant select on public.community_rating_state to anon, authenticated;

-- ---------------------------------------------------------------------------
-- One game's score, or every game's, from the weights as they stand
-- ---------------------------------------------------------------------------

create or replace function public._refresh_game_ratings(p_games text[] default null)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  params constant jsonb := public.community_rating_params();
  v_version constant int := (params ->> 'version')::int;
  -- Somebody whose statistics have not been worked out yet counts in full.
  v_unrated_weight constant numeric := (params #>> '{weight,max}')::numeric;
  v_written int;
begin
  with contributions as (
    select l.game_id,
           l.rating,
           coalesce(rs.weight, v_unrated_weight) as weight
      from public.logs l
      left join public.rater_stats rs on rs.user_id = l.user_id
     where l.rating is not null
       and (p_games is null or l.game_id = any (p_games))
  ),
  bands as (
    select c.game_id,
           greatest(ceil(c.rating / 10.0)::int - 1, 0) as band,
           count(*)::int as n
      from contributions c
     group by c.game_id, greatest(ceil(c.rating / 10.0)::int - 1, 0)
  ),
  histograms as (
    select g.game_id,
           array_agg(coalesce(b.n, 0) order by k.band) as histogram
      from (select distinct game_id from contributions) g
      cross join generate_series(0, 9) as k (band)
      left join bands b on b.game_id = g.game_id and b.band = k.band
     group by g.game_id
  ),
  aggregated as (
    select c.game_id,
           sum(c.rating * c.weight) / sum(c.weight) as weighted_rating,
           avg(c.rating::numeric) as raw_mean,
           count(*)::int as raters,
           sum(c.weight) as weight_sum,
           sum(c.weight) * sum(c.weight) / sum(c.weight * c.weight) as effective_raters,
           min(c.rating) as min_rating,
           max(c.rating) as max_rating
      from contributions c
     group by c.game_id
  )
  insert into public.game_ratings as gr (
    game_id, weighted_rating, raw_mean, raters, weight_sum, effective_raters,
    min_rating, max_rating, histogram, algorithm_version, computed_at
  )
  select a.game_id, a.weighted_rating, a.raw_mean, a.raters, a.weight_sum, a.effective_raters,
         a.min_rating, a.max_rating, h.histogram, v_version, now()
    from aggregated a
    join histograms h on h.game_id = a.game_id
  on conflict (game_id) do update
     set weighted_rating   = excluded.weighted_rating,
         raw_mean          = excluded.raw_mean,
         raters            = excluded.raters,
         weight_sum        = excluded.weight_sum,
         effective_raters  = excluded.effective_raters,
         min_rating        = excluded.min_rating,
         max_rating        = excluded.max_rating,
         histogram         = excluded.histogram,
         algorithm_version = excluded.algorithm_version,
         computed_at       = excluded.computed_at
   -- Only what changed is written, so a recalculation that changes nothing
   -- writes nothing.
   where (gr.weighted_rating, gr.raw_mean, gr.raters, gr.weight_sum, gr.effective_raters,
          gr.min_rating, gr.max_rating, gr.histogram, gr.algorithm_version)
         is distinct from
         (excluded.weighted_rating, excluded.raw_mean, excluded.raters, excluded.weight_sum,
          excluded.effective_raters, excluded.min_rating, excluded.max_rating, excluded.histogram,
          excluded.algorithm_version);

  get diagnostics v_written = row_count;

  -- A game nobody rates any more has no score: an empty state, not a zero.
  delete from public.game_ratings gr
   where (p_games is null or gr.game_id = any (p_games))
     and not exists (
       select 1 from public.logs l where l.game_id = gr.game_id and l.rating is not null
     );

  return v_written;
end;
$$;

-- ---------------------------------------------------------------------------
-- The full recalculation: every person's statistics and weight, then every
-- game's score. Deterministic: numeric arithmetic (order-independent sums)
-- and every statistic rounded to `precision` decimals before a threshold or a
-- ranking reads it.
-- ---------------------------------------------------------------------------

create or replace function public._recalculate_community_ratings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  params constant jsonb := public.community_rating_params();
  v_version          constant int     := (params ->> 'version')::int;
  v_digits           constant int     := (params ->> 'precision')::int;
  v_scale_min        constant int     := (params #>> '{scale,min}')::int;
  v_range            constant numeric := (params #>> '{scale,max}')::numeric
                                         - (params #>> '{scale,min}')::numeric;
  v_width            constant int     := (params #>> '{entropy,bucketWidth}')::int;
  v_buckets          constant int     := (params #>> '{entropy,buckets}')::int;
  v_low_entropy      constant numeric := (params #>> '{entropy,lowThreshold}')::numeric;
  v_from             constant int     := (params #>> '{confidence,from}')::int;
  v_full             constant int     := (params #>> '{confidence,full}')::int;
  v_min_others       constant int     := (params #>> '{deviation,minOtherRaters}')::int;
  v_min_comparisons  constant int     := (params #>> '{deviation,minComparisons}')::int;
  v_min_population   constant int     := (params #>> '{deviation,minPopulation}')::int;
  v_high_percentile  constant numeric := (params #>> '{deviation,highPercentile}')::numeric;
  v_low_penalty      constant numeric := (params #>> '{penalty,lowEntropy}')::numeric;
  v_combined_penalty constant numeric := (params #>> '{penalty,combined}')::numeric;
  v_min_weight       constant numeric := (params #>> '{weight,min}')::numeric;
  v_max_weight       constant numeric := (params #>> '{weight,max}')::numeric;
  -- log₂ of the number of bands: the most entropy a distribution can have.
  v_max_bits         constant numeric := ln(v_buckets::numeric) / ln(2::numeric);
  v_started          constant timestamptz := clock_timestamp();
  v_raters_written   int;
  v_games_written    int;
begin
  perform pg_advisory_xact_lock(hashtext('gamelog.community_ratings'));

  with rated as (
    select l.user_id, l.game_id, l.rating
      from public.logs l
     where l.rating is not null
  ),
  per_game as (
    select r.game_id, count(*) as raters, sum(r.rating) as total
      from rated r
     group by r.game_id
  ),
  -- Each rating against the mean of the *other* ratings of its game, over the
  -- scale's range. Games with too few other raters are not compared at all.
  compared as (
    select r.user_id,
           abs(r.rating - (g.total - r.rating)::numeric / (g.raters - 1)) / v_range as deviation
      from rated r
      join per_game g on g.game_id = r.game_id
     where g.raters - 1 >= v_min_others
  ),
  deviation as (
    select c.user_id,
           count(*)::int as comparisons,
           round(avg(c.deviation), v_digits) as average
      from compared c
     group by c.user_id
  ),
  -- Ranked among the people with enough comparisons, and nobody else. Tied
  -- averages share the lower place.
  ranked as (
    select d.user_id,
           round((percent_rank() over (order by d.average) * 100)::numeric, v_digits) as percentile,
           count(*) over () as population
      from deviation d
     where d.comparisons >= v_min_comparisons
  ),
  bucketed as (
    select r.user_id,
           least((r.rating - v_scale_min) / v_width, v_buckets - 1) as bucket,
           count(*) as n
      from rated r
     group by r.user_id, least((r.rating - v_scale_min) / v_width, v_buckets - 1)
  ),
  totals as (
    select b.user_id, sum(b.n) as total
      from bucketed b
     group by b.user_id
  ),
  -- H = −Σ p·log₂p over the bands somebody is in. One band: ln 1 = 0, so 0.
  entropy as (
    select b.user_id,
           t.total::int as rated_count,
           -sum((b.n::numeric / t.total) * ln(b.n::numeric / t.total)) / ln(2::numeric) as bits
      from bucketed b
      join totals t on t.user_id = b.user_id
     group by b.user_id, t.total
  ),
  distribution as (
    select e.user_id,
           array_agg(coalesce(b.n, 0)::int order by k.bucket) as counts
      from entropy e
      cross join generate_series(0, v_buckets - 1) as k (bucket)
      left join bucketed b on b.user_id = e.user_id and b.bucket = k.bucket
     group by e.user_id
  ),
  signals as (
    select e.user_id,
           e.rated_count,
           d.counts,
           round(e.bits, v_digits) as entropy,
           round(e.bits / v_max_bits, v_digits) as normalized_entropy,
           coalesce(dv.comparisons, 0) as comparisons,
           case when dv.comparisons >= v_min_comparisons then dv.average end as average_deviation,
           case when rk.population >= v_min_population then rk.percentile end as deviation_percentile,
           least(greatest((e.rated_count - v_from)::numeric / (v_full - v_from), 0), 1) as confidence
      from entropy e
      join distribution d on d.user_id = e.user_id
      left join deviation dv on dv.user_id = e.user_id
      left join ranked rk on rk.user_id = e.user_id
  ),
  judged as (
    select s.*,
           (s.rated_count > v_from and s.normalized_entropy < v_low_entropy) as low_entropy,
           (s.deviation_percentile is not null
            and s.deviation_percentile >= v_high_percentile) as high_deviation
      from signals s
  ),
  -- High deviation alone is free; low entropy alone is the small penalty.
  weighed as (
    select j.*,
           case when j.low_entropy and j.high_deviation then v_combined_penalty
                when j.low_entropy then v_low_penalty
                else 0::numeric
           end as target_penalty
      from judged j
  )
  insert into public.rater_stats as rs (
    user_id, rated_count, distribution, entropy, normalized_entropy, comparison_count,
    average_deviation, deviation_percentile, low_entropy, high_deviation,
    pattern_confidence, target_penalty, weight, algorithm_version, computed_at
  )
  select w.user_id, w.rated_count, w.counts, w.entropy, w.normalized_entropy, w.comparisons,
         w.average_deviation, w.deviation_percentile, w.low_entropy, w.high_deviation,
         round(w.confidence, v_digits),
         w.target_penalty,
         round(least(v_max_weight, greatest(v_min_weight, 1 - w.confidence * w.target_penalty)),
               v_digits),
         v_version,
         now()
    from weighed w
  on conflict (user_id) do update
     set rated_count          = excluded.rated_count,
         distribution         = excluded.distribution,
         entropy              = excluded.entropy,
         normalized_entropy   = excluded.normalized_entropy,
         comparison_count     = excluded.comparison_count,
         average_deviation    = excluded.average_deviation,
         deviation_percentile = excluded.deviation_percentile,
         low_entropy          = excluded.low_entropy,
         high_deviation       = excluded.high_deviation,
         pattern_confidence   = excluded.pattern_confidence,
         target_penalty       = excluded.target_penalty,
         weight               = excluded.weight,
         algorithm_version    = excluded.algorithm_version,
         computed_at          = excluded.computed_at
   where (rs.rated_count, rs.distribution, rs.entropy, rs.normalized_entropy,
          rs.comparison_count, rs.average_deviation, rs.deviation_percentile, rs.low_entropy,
          rs.high_deviation, rs.pattern_confidence, rs.target_penalty, rs.weight,
          rs.algorithm_version)
         is distinct from
         (excluded.rated_count, excluded.distribution, excluded.entropy,
          excluded.normalized_entropy, excluded.comparison_count, excluded.average_deviation,
          excluded.deviation_percentile, excluded.low_entropy, excluded.high_deviation,
          excluded.pattern_confidence, excluded.target_penalty, excluded.weight,
          excluded.algorithm_version);

  get diagnostics v_raters_written = row_count;

  -- Somebody with no ratings left has no statistics: back to the default.
  delete from public.rater_stats rs
   where not exists (
     select 1 from public.logs l where l.user_id = rs.user_id and l.rating is not null
   );

  v_games_written := public._refresh_game_ratings(null);

  update public.community_rating_state
     set algorithm_version = v_version,
         recalculated_at   = now(),
         duration_ms       = round((extract(epoch from clock_timestamp() - v_started) * 1000)::numeric, 1),
         rated_logs        = (select count(*) from public.logs where rating is not null),
         raters            = (select count(*) from public.rater_stats),
         comparable_raters = (select count(*) from public.rater_stats
                               where comparison_count >= v_min_comparisons),
         games             = (select count(*) from public.game_ratings),
         stale_since       = null
   where id;

  return (
    select jsonb_build_object(
             'version', v_version,
             'rated_logs', s.rated_logs,
             'raters', s.raters,
             'comparable_raters', s.comparable_raters,
             'games', s.games,
             'raters_changed', v_raters_written,
             'games_changed', v_games_written,
             'duration_ms', s.duration_ms)
      from public.community_rating_state s
     where s.id
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- After a rating changes
-- ---------------------------------------------------------------------------

create or replace function public._community_ratings_changed(p_games text[])
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  params constant jsonb := public.community_rating_params();
  v_limit constant int := (params ->> 'syncFullRecalculationMaxRatings')::int;
  v_patience constant interval :=
    make_interval(mins => (params ->> 'staleRecalculationMinutes')::int);
  v_stale_since timestamptz;
begin
  -- Taken before anything is read: a second writer waits here until the first
  -- commits, and then reads what it committed.
  perform pg_advisory_xact_lock(hashtext('gamelog.community_ratings'));

  if not exists (select 1 from public.logs where rating is not null offset v_limit) then
    perform public._recalculate_community_ratings();
    return;
  end if;

  perform public._refresh_game_ratings(p_games);
  update public.community_rating_state
     set stale_since = coalesce(stale_since, now())
   where id
  returning stale_since into v_stale_since;

  -- When to recalculate, never what: the weights are the same whenever it runs.
  if v_stale_since <= now() - v_patience then
    perform public._recalculate_community_ratings();
  end if;
end;
$$;

create or replace function public.community_ratings_logs_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_games text[];
begin
  select array_agg(distinct n.game_id) into v_games
    from new_rows n
   where n.rating is not null;
  if v_games is not null then
    perform public._community_ratings_changed(v_games);
  end if;
  return null;
end;
$$;

-- Only a change to who rated what, or how much, is a change: a status, a
-- review or a platform edited on a scored log moves nothing.
create or replace function public.community_ratings_logs_updated()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_games text[];
begin
  select array_agg(distinct changed.game_id) into v_games
    from (
      (select o.user_id, o.game_id, o.rating from old_rows o where o.rating is not null
       except all
       select n.user_id, n.game_id, n.rating from new_rows n where n.rating is not null)
      union all
      (select n.user_id, n.game_id, n.rating from new_rows n where n.rating is not null
       except all
       select o.user_id, o.game_id, o.rating from old_rows o where o.rating is not null)
    ) changed;
  if v_games is not null then
    perform public._community_ratings_changed(v_games);
  end if;
  return null;
end;
$$;

create or replace function public.community_ratings_logs_deleted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_games text[];
begin
  select array_agg(distinct o.game_id) into v_games
    from old_rows o
   where o.rating is not null;
  if v_games is not null then
    perform public._community_ratings_changed(v_games);
  end if;
  return null;
end;
$$;

drop trigger if exists logs_community_ratings_insert on public.logs;
create trigger logs_community_ratings_insert
  after insert on public.logs
  referencing new table as new_rows
  for each statement execute function public.community_ratings_logs_inserted();

drop trigger if exists logs_community_ratings_update on public.logs;
create trigger logs_community_ratings_update
  after update on public.logs
  referencing old table as old_rows new table as new_rows
  for each statement execute function public.community_ratings_logs_updated();

drop trigger if exists logs_community_ratings_delete on public.logs;
create trigger logs_community_ratings_delete
  after delete on public.logs
  referencing old table as old_rows
  for each statement execute function public.community_ratings_logs_deleted();

-- ---------------------------------------------------------------------------
-- What clients may call
-- ---------------------------------------------------------------------------

-- The signed-in person's own statistics, with the parameters and the state,
-- for the screen that explains them. Runs as the caller: `rater_stats`' policy
-- is what keeps it to their own row.
create or replace function public.my_rating_influence()
returns jsonb
language sql
stable
set search_path = public
as $$
  select jsonb_build_object(
    'rated', (select count(*) from public.logs l
               where l.user_id = auth.uid() and l.rating is not null),
    'stats', (select to_jsonb(rs) - 'user_id' from public.rater_stats rs
               where rs.user_id = auth.uid()),
    'state', (select to_jsonb(s) - 'id' from public.community_rating_state s where s.id),
    'params', public.community_rating_params()
  )
$$;

create or replace function public.recalculate_community_ratings()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can recalculate community ratings.' using errcode = '42501';
  end if;
  return public._recalculate_community_ratings();
end;
$$;

-- How the weighting is behaving, in aggregate — no person's statistics, no
-- user id. Moderators only.
create or replace function public.community_rating_report(p_limit int default 10)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  params constant jsonb := public.community_rating_params();
  v_min_weight constant numeric := (params #>> '{weight,min}')::numeric;
  v_max_weight constant numeric := (params #>> '{weight,max}')::numeric;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can read the community rating report.' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'params', params,
    'state', (select to_jsonb(s) - 'id' from public.community_rating_state s where s.id),
    'raters', (
      select jsonb_build_object(
               'total', count(*),
               'adjusted', count(*) filter (where weight < v_max_weight),
               'at_minimum', count(*) filter (where weight <= v_min_weight),
               'low_entropy', count(*) filter (where low_entropy),
               'high_deviation', count(*) filter (where high_deviation),
               'both', count(*) filter (where low_entropy and high_deviation),
               'mean_weight', coalesce(round(avg(weight), 4), v_max_weight))
        from public.rater_stats
    ),
    'weights', coalesce((
      select jsonb_agg(jsonb_build_object('weight', w.weight, 'raters', w.raters)
                       order by w.weight desc)
        from (select weight, count(*) as raters from public.rater_stats group by weight) w
    ), '[]'::jsonb),
    'games', (
      select jsonb_build_object(
               'total', count(*),
               'moved', count(*) filter (where round(weighted_rating) <> round(raw_mean)),
               'mean_difference', coalesce(round(avg(abs(weighted_rating - raw_mean)), 4), 0),
               'max_difference', coalesce(round(max(abs(weighted_rating - raw_mean)), 4), 0))
        from public.game_ratings
    ),
    'largest', coalesce((
      select jsonb_agg(jsonb_build_object(
                         'game_id', x.game_id,
                         'title', x.title,
                         'raters', x.raters,
                         'raw_mean', round(x.raw_mean, 2),
                         'weighted_rating', round(x.weighted_rating, 2),
                         'effective_raters', round(x.effective_raters, 2))
                       order by x.difference desc, x.raters desc, x.game_id)
        from (
          select gr.game_id, gr.raters, gr.raw_mean, gr.weighted_rating, gr.effective_raters,
                 g.title, abs(gr.weighted_rating - gr.raw_mean) as difference
            from public.game_ratings gr
            join public.games g on g.id = gr.game_id
           where gr.weighted_rating <> gr.raw_mean
           order by abs(gr.weighted_rating - gr.raw_mean) desc, gr.raters desc, gr.game_id
           limit greatest(p_limit, 1)
        ) x
    ), '[]'::jsonb)
  );
end;
$$;

-- ---------------------------------------------------------------------------
-- 0026 and 0037, weighted
-- ---------------------------------------------------------------------------

-- The reviews sheet's breakdown, with each group's weighted mean beside its
-- plain count and sum. Platforms carry their share of the game's total weight
-- too, so the phone can fold PS4 and PS5 into PlayStation exactly — never a
-- weight sum, which on a group of one would be that person's weight. Runs as
-- the owner to read every weight; it answers in aggregates only.
create or replace function public.game_review_stats(p_game text)
returns jsonb
language sql
stable
security definer
set search_path = public
as $$
  with rated as (
    select l.rating,
           l.status,
           l.completion,
           l.platinum,
           l.coop,
           nullif(btrim(l.played_on), '') as platform,
           coalesce(rs.weight, (public.community_rating_params() #>> '{weight,max}')::numeric)
             as weight
      from public.logs l
      left join public.rater_stats rs on rs.user_id = l.user_id
     where l.game_id = p_game
       and l.rating is not null
  ),
  everyone as (
    select sum(weight) as weight from rated
  ),
  groups as (
    select 'finished' as key, count(*) as n, coalesce(sum(rating), 0) as total,
           sum(rating * weight) / nullif(sum(weight), 0) as weighted
      from rated where completion in ('story', 'main', 'full') or platinum
    union all
    select 'full', count(*), coalesce(sum(rating), 0),
           sum(rating * weight) / nullif(sum(weight), 0)
      from rated where completion = 'full' or platinum
    union all
    select 'playing', count(*), coalesce(sum(rating), 0),
           sum(rating * weight) / nullif(sum(weight), 0)
      from rated where status in ('playing', 'paused')
    union all
    select 'dropped', count(*), coalesce(sum(rating), 0),
           sum(rating * weight) / nullif(sum(weight), 0)
      from rated where status = 'dropped'
    union all
    select 'solo', count(*), coalesce(sum(rating), 0),
           sum(rating * weight) / nullif(sum(weight), 0)
      from rated where coop is false
    union all
    select 'coop', count(*), coalesce(sum(rating), 0),
           sum(rating * weight) / nullif(sum(weight), 0)
      from rated where coop is true
  )
  select jsonb_build_object(
    'count', (select count(*) from rated),
    'sum', (select coalesce(sum(rating), 0) from rated),
    'weighted_mean', (select sum(rating * weight) / nullif(sum(weight), 0) from rated),
    'groups', (
      select jsonb_object_agg(key, jsonb_build_object(
               'count', n, 'sum', total, 'weighted_mean', weighted))
        from groups
    ),
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object(
               'platform', p.platform,
               'count', p.n,
               'sum', p.total,
               'weighted_mean', p.weighted,
               'weight_share', p.weight / e.weight)
             order by p.n desc, p.platform)
        from (
          select platform,
                 count(*) as n,
                 sum(rating) as total,
                 sum(rating * weight) / sum(weight) as weighted,
                 sum(weight) as weight
            from rated
           where platform is not null
           group by platform
        ) p
        cross join everyone e
    ), '[]'::jsonb),
    'written_platforms', coalesce((
      select jsonb_agg(platform order by platform)
        from (
          select distinct nullif(btrim(played_on), '') as platform
            from public.logs
           where game_id = p_game
             and review is not null
             and btrim(review) <> ''
        ) written
       where platform is not null
    ), '[]'::jsonb)
  )
$$;

grant execute on function public.game_review_stats(text) to anon, authenticated;

-- "Beloved by the community": the period's ratings, weighted as the score is,
-- and still damped by three imaginary ratings at the period's own (weighted)
-- mean — 0037's documented rule, kept, so one 100 does not top thirty 94s.
-- The row prints the weighted average; the damped figure only orders it.
create or replace function public.beloved_games(
  p_since timestamptz,
  p_limit int default 20
)
returns table (game_id text, average numeric, ratings bigint)
language sql
stable
security definer
set search_path = public
as $$
  with scored as (
    select l.game_id,
           l.rating,
           coalesce(rs.weight, (public.community_rating_params() #>> '{weight,max}')::numeric)
             as weight
      from public.logs l
      left join public.rater_stats rs on rs.user_id = l.user_id
     where l.rating is not null
       and l.updated_at >= p_since
  ),
  period as (
    select sum(rating * weight) / sum(weight) as mean from scored
  ),
  per_game as (
    select s.game_id,
           sum(s.rating * s.weight) / sum(s.weight) as average,
           sum(s.rating * s.weight) as total,
           sum(s.weight) as weight,
           count(*) as ratings
      from scored s
     group by s.game_id
  )
  select g.game_id,
         g.average,
         g.ratings
    from per_game g
    cross join period p
   order by (g.total + p.mean * 3) / (g.weight + 3) desc,
            g.ratings desc,
            g.game_id
   limit greatest(p_limit, 1);
$$;

grant execute on function public.beloved_games(timestamptz, int) to anon, authenticated;

comment on function public.beloved_games(timestamptz, int) is
  'The games rated highest on GameLog since p_since: the weighted average of the period''s ratings (0041), ordered by a damped figure (0037). Search''s "Beloved by the community".';

-- ---------------------------------------------------------------------------
-- Internal functions stay internal
-- ---------------------------------------------------------------------------

revoke all on function public._refresh_game_ratings(text[]) from public, anon, authenticated;
revoke all on function public._recalculate_community_ratings() from public, anon, authenticated;
revoke all on function public._community_ratings_changed(text[]) from public, anon, authenticated;
revoke all on function public.community_ratings_logs_inserted() from public, anon, authenticated;
revoke all on function public.community_ratings_logs_updated() from public, anon, authenticated;
revoke all on function public.community_ratings_logs_deleted() from public, anon, authenticated;
grant execute on function public._recalculate_community_ratings() to service_role;

revoke all on function public.my_rating_influence() from public, anon;
grant execute on function public.my_rating_influence() to authenticated;
revoke all on function public.recalculate_community_ratings() from public, anon;
grant execute on function public.recalculate_community_ratings() to authenticated;
revoke all on function public.community_rating_report(int) from public, anon;
grant execute on function public.community_rating_report(int) to authenticated;

-- ---------------------------------------------------------------------------
-- Every rating there already is, weighted once
-- ---------------------------------------------------------------------------

do $$
begin
  perform public._recalculate_community_ratings();
end;
$$;
