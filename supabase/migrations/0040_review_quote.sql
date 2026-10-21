-- ---------------------------------------------------------------------------
-- 0040 — A review in one sentence, and which half of a review a card shows
-- ---------------------------------------------------------------------------
--
-- The owner's direction (2026-10-16): the review's headline is replaced by
-- "Describe the game in one word or sentence" — a quote, drawn between large
-- quotation marks on the review's own page and, if its writer says so, on
-- every card the review appears on.
--
-- WHAT IS REUSED
--   logs.review_title    is the quote. It already holds one line of the
--                        writer's own words, 1–140 characters (0004's CHECK),
--                        and every reader, search and report already reads it.
--                        The app now caps a new one at 85 — three lines on the
--                        narrowest card (`lib/review-quote.ts`, QUOTE_MAX). An
--                        old headline longer than that is kept as it is: it is
--                        the writer's, and 0004 still allows it.
--
-- WHAT IS CREATED
--   logs.review_display  'text' or 'quote': what a card of this review shows —
--                        three lines of the review, or the quote. 'text' for
--                        every review that exists, which is what they showed.
--
-- WITHOUT IT
--   Nothing breaks. `saveLog` sends the column, reads PostgREST's PGRST204 as
--   "not migrated", and saves the row without it for the rest of the session
--   (the same treatment 0038's review_lang gets); a row from a database without
--   the column has no such field, and every card reads that as 'text'. The
--   choice in the log form is kept in the draft until the column exists.
--
-- Adding a column with a default writes no row, so 0001's updated_at trigger
-- does not run and no score is refiled under this week (see 0038's note on why
-- that matters to beloved_games). Safe to run twice.
-- ---------------------------------------------------------------------------

alter table public.logs
  add column if not exists review_display text not null default 'text';

alter table public.logs drop constraint if exists logs_review_display_check;
alter table public.logs
  add constraint logs_review_display_check
  check (review_display in ('text', 'quote'));

comment on column public.logs.review_title is
  'The review in one word or sentence — the quote. Drawn between quotation marks on the review page and, when review_display is ''quote'', on its cards. Null when the writer gave none.';

comment on column public.logs.review_display is
  'What a card of this review shows: ''text'' (three lines of the review) or ''quote'' (review_title). A card with only one of the two shows that one whatever this says.';
