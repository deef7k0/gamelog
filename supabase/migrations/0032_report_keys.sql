-- GameLog — report tables must not look like join tables
--
-- Run right after 0031. On a database where 0031 has run and this has not,
-- every query that embeds a log's author fails — the feed, profiles, the review
-- page, every list of reviews.
--
-- ## What broke
--
-- PostgREST infers a many-to-many relationship through any table whose primary
-- key contains both of its foreign keys. 0031 keyed `review_reports` on
-- (log_id, user_id) — a log and a profile — so PostgREST read it as a junction
-- between `logs` and `profiles`. `logs` then had two ways to reach `profiles`:
-- its own `user_id`, and "the profiles who reported this log". Every embed
-- written as `profile:profiles(*)` on a log became ambiguous and was refused:
--
--   PGRST201  Could not embed because more than one relationship was found for
--             'logs' and 'profiles'
--
-- ## The fix
--
-- A surrogate `id` primary key, with the old key kept as a UNIQUE constraint.
-- PostgREST only treats a table as a junction when both foreign keys sit inside
-- its *primary* key, so an `id` key ends the inference; the unique constraint
-- still allows one report per person per review, and it is what the client's
-- upsert (`onConflict: 'log_id,user_id'`) resolves against.
--
-- `similarity_suggestion_reports` had the same shape — a vote and a profile in
-- its key, a junction between `game_similarity_votes` and `profiles` — and gets
-- the same treatment, so the next embed across those two has nothing to trip on.
--
-- Safe to run more than once.

-- ---------------------------------------------------------------------------
-- review_reports
-- ---------------------------------------------------------------------------

alter table public.review_reports
  add column if not exists id uuid not null default gen_random_uuid();

-- `add primary key` names the new constraint `review_reports_pkey` too, so a
-- second run drops the `id` key and puts it straight back.
alter table public.review_reports drop constraint if exists review_reports_pkey;
alter table public.review_reports add primary key (id);

alter table public.review_reports drop constraint if exists review_reports_one_per_person;
alter table public.review_reports
  add constraint review_reports_one_per_person unique (log_id, user_id);

-- ---------------------------------------------------------------------------
-- similarity_suggestion_reports
-- ---------------------------------------------------------------------------

alter table public.similarity_suggestion_reports
  add column if not exists id uuid not null default gen_random_uuid();

alter table public.similarity_suggestion_reports
  drop constraint if exists similarity_suggestion_reports_pkey;
alter table public.similarity_suggestion_reports add primary key (id);

alter table public.similarity_suggestion_reports
  drop constraint if exists similarity_suggestion_reports_one_per_person;
alter table public.similarity_suggestion_reports
  add constraint similarity_suggestion_reports_one_per_person
  unique (similarity_id, author_id, user_id);

-- PostgREST normally notices DDL on its own; this makes sure the relationship
-- it inferred from 0031 is forgotten now rather than on its next reload.
notify pgrst, 'reload schema';
