-- GameLog — tags on collections (formerly "lists")
--
-- The Collection screen shows Letterboxd-style tag pills under the header. Tags
-- are free-form here, unlike `posts.tags`, because a collection's tags are the
-- author's own shelf labels ("comfort games", "1998", "played on a plane") and a
-- closed vocabulary would defeat the purpose. `posts.tags` is closed for the
-- opposite reason: those drive discovery filters, where fragmentation is fatal.
--
-- Safe to run as a single script — no new enum values.

alter table public.lists add column if not exists tags text[];

-- ---------------------------------------------------------------------------
-- Validation
--
-- Checking every element of an array needs `unnest`, and a CHECK constraint may
-- not contain a subquery — the same restriction that shaped
-- `is_valid_review_metrics` in 0008. A function body is opaque to that rule, and
-- since it touches no tables it is genuinely IMMUTABLE.
-- ---------------------------------------------------------------------------
create or replace function public.is_valid_collection_tags(tags text[])
returns boolean
language sql
immutable
parallel safe
as $$
  select
    tags is null
    or (
      -- Bounded: without a cap one collection could carry a thousand tags and
      -- the header would become the whole screen.
      coalesce(array_length(tags, 1), 0) between 1 and 12
      and coalesce(
        (
          select bool_and(char_length(trim(tag)) between 1 and 24)
          from unnest(tags) as tag
        ),
        true
      )
    );
$$;

alter table public.lists drop constraint if exists lists_tags_bounded;
alter table public.lists
  add constraint lists_tags_bounded
  check (public.is_valid_collection_tags(tags));

comment on column public.lists.tags is
  'Free-form author-supplied labels shown on the Collection header. Max 12, '
  'each 1-24 characters after trimming.';
