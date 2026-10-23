-- ---------------------------------------------------------------------------
-- 0042 — a physical copy's back cover and disc label: the cache and the bucket
-- ---------------------------------------------------------------------------
--
-- When somebody adds a copy, the `copy-art` Edge Function looks its back cover
-- and its disc label up on GameTDB and ScreenScraper (the owner's request,
-- 2026-10-22). It keeps every picture it finds in this project's own storage
-- — GameTDB's so no phone hot-links its art, ScreenScraper's because the
-- address it answers with carries the project's developer password — and
-- remembers what it found for that game, platform and region.
--
-- 1. THE CACHE: NOBODY BUT THE FUNCTION TOUCHES IT.
--    The same rules as 0027's, 0035's and 0039's caches: RLS on, no policies,
--    no grants; the function uses the service role. "Nothing found" is kept
--    too — for a week, against three months for a find (the function's TTLs).
--    Keyed on `platform|region|name`, not on a copy: two people's PAL copies
--    of one game are one lookup.
--
-- 2. THE BUCKET: PUBLIC TO READ, WRITTEN BY THE FUNCTION ALONE.
--    The pictures are box art, shown to anyone who sees the copy. No insert,
--    update or delete policy is added for the client roles, so only the
--    service role writes here — unlike `media`, where people upload their own.
--
-- Optional: without it the copy screen draws its own back and the art disc,
-- as before. Safe to run more than once.

create table if not exists public.copy_art (
  key        text primary key check (char_length(key) between 3 and 300),
  -- `{ back, disc }` exactly as the function returns it to the app.
  answer     jsonb not null,
  fetched_at timestamptz not null default now()
);

alter table public.copy_art enable row level security;

-- No policies, on purpose: see (1). And no table privileges either.
revoke all on public.copy_art from anon, authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'copy-art',
  'copy-art',
  true,
  6 * 1024 * 1024,
  array['image/png', 'image/jpeg', 'image/webp']
)
on conflict (id) do nothing;
