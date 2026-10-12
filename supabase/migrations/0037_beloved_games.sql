-- ---------------------------------------------------------------------------
-- 0037 — "Beloved by the community": the games GameLog's own scores rank
--        highest, over a week, a month or a year
-- ---------------------------------------------------------------------------
--
-- Search's Discover has a row of the games the people here rated highest, with
-- a control beside its heading for the period. This is the ranking behind it.
-- It took the place of the "Reviews" band (the most-liked writing), which is
-- still what the Reviews tab shows before anything is typed.
--
-- Nothing is created but one function. No table, no policy, no data: it reads
-- `logs`, which everybody can already read (0001), so it runs as its caller.
--
-- WHY A FUNCTION AND NOT A SELECT
--   PostgREST cannot group or average. The alternative is every scored log of
--   the period sent to the phone and tallied there, which is a few rows today
--   and the whole table once the app has users.
--
-- WHAT "IN THE PERIOD" MEANS
--   `logs.updated_at`, not `created_at`. Somebody logs a game as Playing when
--   they start it and scores it when they finish, which is the same row,
--   weeks later; `created_at` would file that score under the week it was not
--   given in. `updated_at` also moves when a log is edited without touching
--   the score, so an old score can ride back into this week on a changed
--   status. That is the smaller error, and it is why this says "scored or
--   touched", not "scored".
--
-- WHY THE AVERAGE IS DAMPED
--   A plain average puts a game one person gave 100 above a game thirty people
--   gave 94. A minimum number of ratings would fix that and empty the row —
--   this app has few ratings and a week has fewer. So each game's average is
--   pulled toward the period's own mean by three imaginary ratings:
--
--       weight = (sum of its scores + 3 × the period's mean) / (its count + 3)
--
--   One 100 against a mean of 75 weighs 81; thirty 94s weigh 92. With plenty of
--   ratings the three stop mattering and the weight is the average. The row
--   prints the real average, never the weight: the weight orders, it is not a
--   score anybody gave.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

create or replace function public.beloved_games(
  p_since timestamptz,
  p_limit int default 20
)
returns table (game_id text, average numeric, ratings bigint)
language sql
stable
as $$
  with scored as (
    select l.game_id, l.rating
      from public.logs l
     where l.rating is not null
       and l.updated_at >= p_since
  ),
  period as (
    select avg(rating)::numeric as mean from scored
  ),
  per_game as (
    select s.game_id,
           avg(s.rating)::numeric as average,
           sum(s.rating)::numeric as total,
           count(*) as ratings
      from scored s
     group by s.game_id
  )
  select g.game_id,
         round(g.average) as average,
         g.ratings
    from per_game g
    cross join period p
   -- The damped mean. `p.mean` is never null here: a period with no scores
   -- has no rows in `per_game` to order.
   order by (g.total + p.mean * 3) / (g.ratings + 3) desc,
            g.ratings desc,
            g.game_id
   limit greatest(p_limit, 1);
$$;

comment on function public.beloved_games(timestamptz, int) is
  'The games rated highest on GameLog since p_since: a damped average of logs.rating. Search''s "Beloved by the community".';
