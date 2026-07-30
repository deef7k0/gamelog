-- GameLog — advanced review metrics
--
-- A reviewer can opt out of picking one number and instead score individual
-- categories; `logs.rating` then holds their mean. Storing the breakdown does
-- not change how anything reads a score: `rating` stays the only column the
-- feed, game averages, profile stats and sharing look at.
--
-- Safe to run as a single script — no new enum values, so nothing here hits the
-- "unsafe use of new value" restriction that split 0006 and 0007.

-- ---------------------------------------------------------------------------
-- 1. Vocabulary
--
-- A closed set, for the same reason posts.tags is closed: "Art Direction" and
-- "art direction" as separate metrics would make averages incomparable between
-- reviews, which is the only thing the number is for.
--
-- Keep in step with ReviewMetricKey in src/lib/database.types.ts.
-- ---------------------------------------------------------------------------
create or replace function public.review_metric_keys()
returns text[]
language sql
immutable
parallel safe
as $$
  select array[
    'personal-enjoyment', 'genre-execution', 'innovation', 'gameplay',
    'content', 'replayability', 'narrative', 'difficulty',
    'art-direction', 'cinematography', 'soundtrack', 'level-design',
    'audio-design', 'voice-acting'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- 2. Validation
--
-- This has to be a function rather than an inline CHECK: validating every entry
-- of a jsonb object needs jsonb_each, and a CHECK constraint may not contain a
-- subquery. A function body is opaque to that restriction, and since it touches
-- no tables it is genuinely IMMUTABLE.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_review_metrics(metrics jsonb)
returns boolean
language sql
immutable
parallel safe
as $$
  select
    metrics is null
    or (
      jsonb_typeof(metrics) = 'object'
      and coalesce(
        (
          select bool_and(
            entry.key = any (public.review_metric_keys())
            and case
                  -- CASE guarantees ordered evaluation; a bare AND does not, so
                  -- the cast below could otherwise run on a non-numeric value.
                  when jsonb_typeof(entry.value) <> 'number' then false
                  else (entry.value #>> '{}')::numeric between 0 and 100
                   and (entry.value #>> '{}')::numeric
                       = trunc((entry.value #>> '{}')::numeric)
                end
          )
          from jsonb_each(metrics) as entry
        ),
        -- bool_and over no rows is null: an empty object is vacuously valid.
        -- The client writes null instead, but a `{}` should not error.
        true
      )
    );
$$;

-- ---------------------------------------------------------------------------
-- 3. Column
-- ---------------------------------------------------------------------------
alter table public.logs add column if not exists review_metrics jsonb;

comment on column public.logs.review_metrics is
  'Per-category scores 0-100 when the reviewer used advanced metrics; null when '
  'they used the score bar. When set, logs.rating is the mean of these values — '
  'the client writes both together.';

alter table public.logs drop constraint if exists logs_review_metrics_valid;
alter table public.logs
  add constraint logs_review_metrics_valid
  check (public.is_valid_review_metrics(review_metrics));

-- Partial index: advanced reviews are the minority, and the only queries that
-- care are "show me reviews with a breakdown".
create index if not exists logs_review_metrics_idx
  on public.logs (game_id, created_at desc)
  where review_metrics is not null;
