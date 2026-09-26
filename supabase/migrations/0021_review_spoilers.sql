-- 0021 — mark a review as containing spoilers.
--
-- One boolean on `logs`. Not a separate table and not an enum: a review either
-- gives something away or it does not, and there is no third state anybody has
-- asked for. `false` is the honest default — an unflagged review is not "unknown
-- spoiler status", it is a review whose author did not flag it, which is exactly
-- what every row written before this migration is.
--
-- NOT NULL with a default, so no client ever has to handle `null` and the
-- backfill is implicit. Safe to run on a live table: Postgres 11+ does not
-- rewrite the heap for a NOT NULL column with a constant default.
--
-- ## Why there is no RLS change
--
-- `logs` already has its policies from 0001 and they are row-level: you may read
-- any log and write only your own. A column added to a table inherits them, so
-- the flag is writable by exactly the person who wrote the review and readable
-- by everybody who can already read the review. Hiding the *body* from a reader
-- is a client concern — the text is public either way, and a spoiler flag is a
-- courtesy rather than an access control. Anyone determined enough to read it
-- can, and pretending otherwise by filtering server-side would make the feature
-- look like a security boundary it is not.

alter table public.logs
  add column if not exists spoilers boolean not null default false;

comment on column public.logs.spoilers is
  'Author flagged this review as containing spoilers. The client replaces the '
  'body with a notice until the reader opens the full review. Not an access '
  'control — the text is readable by anyone who can read the row.';
