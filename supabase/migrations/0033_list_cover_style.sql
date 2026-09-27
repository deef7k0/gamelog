-- GameLog — a collection shows four covers or one
--
-- Run after 0014 (the chosen cover). Safe to run on its own and more than once;
-- no enum value is added.
--
-- A collection's artwork is either the mosaic — its first four covers, 2×2 —
-- or a single cover the owner picks. The single cover is `cover_game_id`, which
-- 0014 added and which nothing had displayed since the tiles became mosaics;
-- this column is only the owner's choice between the two.
--
-- Text + CHECK rather than an enum, for the reason CLAUDE.md gives for
-- `gaming_accounts.provider`: a third style later is an edit to a CHECK, not an
-- `alter type … add value` that has to run alone.
--
-- Owners already update their own `lists` rows (0003), so no policy changes.

alter table public.lists
  add column if not exists cover_style text not null default 'mosaic'
    check (cover_style in ('mosaic', 'single'));

comment on column public.lists.cover_style is
  'How the collection''s artwork is drawn: mosaic (first four covers) or single (cover_game_id, else the first item).';
