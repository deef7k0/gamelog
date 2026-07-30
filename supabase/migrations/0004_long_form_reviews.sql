-- GameLog — long-form reviews and a 0-100 score
--
-- Run AFTER 0003.
--
-- Two changes:
--   1. Ratings move from 1-10 half-stars to a 0-100 numeric score. Existing
--      rows are converted, not discarded.
--   2. Reviews gain a title and room to be actual articles rather than a
--      paragraph.

-- ---------------------------------------------------------------------------
-- 1. rating: 1-10 half-stars  ->  0-100 score
--
-- Order matters. The old CHECK (1..10) must be dropped BEFORE the data is
-- scaled up, or every update to a value above 10 fails the still-active
-- constraint. The new CHECK is added only once the data already fits it.
-- ---------------------------------------------------------------------------
alter table public.logs drop constraint if exists logs_rating_check;

/*
 * Convert in place: old 10 (five stars) -> 100, old 7 (3.5 stars) -> 70.
 * Guarded by `<= 10` so re-running this migration cannot scale already
 * converted rows a second time.
 */
update public.logs
   set rating = rating * 10
 where rating is not null
   and rating <= 10;

alter table public.logs
  add constraint logs_rating_check
  check (rating is null or rating between 0 and 100);

comment on column public.logs.rating is
  '0-100 score. See src/constants/score.ts for the label bands.';

-- ---------------------------------------------------------------------------
-- 2. Long-form review body + headline
-- ---------------------------------------------------------------------------
alter table public.logs add column if not exists review_title text
  check (review_title is null or char_length(trim(review_title)) between 1 and 140);

-- 5 000 chars was fine for a paragraph; an article needs considerably more.
alter table public.logs drop constraint if exists logs_review_check;
alter table public.logs
  add constraint logs_review_check
  check (review is null or char_length(review) <= 40000);

comment on column public.logs.review_title is
  'Headline for a long-form review. Null for a quick rating with no article.';

-- Reviews are browsed newest-first on the game page and the profile's Reviews
-- tab; both filter to rows that actually carry a review.
create index if not exists logs_reviews_idx
  on public.logs (game_id, created_at desc)
  where review is not null;
