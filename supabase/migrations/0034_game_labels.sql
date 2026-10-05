-- GameLog — labels on games: "Must Play"
--
-- Run after 0024 (it uses `is_moderator()`). Safe to run on its own and more
-- than once; no enum value is added.
--
-- ## What a label is
--
-- A mark a moderator puts on a game by hand — the first one is `must_play`.
-- It is curation, not a statistic: nothing computes it, no number of ratings
-- earns it, and a game either carries it or does not. The app draws it as a
-- badge on the game's cover and as a cell in the game page's stats strip, and
-- lists every game that carries it on one screen.
--
-- ## Decisions worth stating
--
-- 1. TEXT + CHECK, NOT AN ENUM.
--    The same reasoning as `gaming_accounts.provider` (0009) and
--    `lists.cover_style` (0033): a second label later is an edit to this CHECK,
--    not an `alter type … add value` that has to run alone. The words for each
--    label live in `src/constants/game-labels.ts`; the two lists must match,
--    and `npm test` holds them together.
--
-- 2. ONLY MODERATORS WRITE, AND THE POLICY SAYS SO.
--    Everyone can read which games carry a label — that is the feature. Insert
--    and delete are open to `public.moderators` alone, checked by the policies
--    below through `is_moderator()`, so the anon key in the bundle and an
--    ordinary signed-in account are both refused by the database rather than
--    by a button being hidden. Make someone a moderator in the SQL editor:
--
--      insert into public.moderators (user_id)
--      select id from public.profiles where username = '…';
--
-- 3. THE GAME MUST BE IN `games`.
--    A label is listed with its game's title and cover, which come from the
--    shared cache, so `game_id` is a real foreign key. The app caches the game
--    before it writes the label, exactly as it does before adding one to a
--    collection.
--
-- 4. THE PRIMARY KEY HOLDS ONE FOREIGN KEY, NOT TWO.
--    `(game_id, label)` — `label` is a word, not a reference — so PostgREST does
--    not read this as a join table between `games` and `profiles` and no
--    existing embed becomes ambiguous (the trap 0032 had to repair).
--    `added_by` is a record of who, outside the key.

create table if not exists public.game_labels (
  game_id    text not null references public.games (id) on delete cascade,
  -- The vocabulary is `GAME_LABELS` in `src/constants/game-labels.ts`.
  label      text not null check (label in ('must_play')),
  -- Kept when the moderator's account goes: the label was the team's call.
  added_by   uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (game_id, label)
);

-- "Every game with this label, newest first" — the list screen's one query.
create index if not exists game_labels_label_idx
  on public.game_labels (label, created_at desc);

alter table public.game_labels enable row level security;

drop policy if exists "game labels are viewable by everyone" on public.game_labels;
create policy "game labels are viewable by everyone"
  on public.game_labels for select using (true);

drop policy if exists "moderators add game labels" on public.game_labels;
create policy "moderators add game labels"
  on public.game_labels for insert to authenticated
  with check (public.is_moderator() and added_by = auth.uid());

drop policy if exists "moderators remove game labels" on public.game_labels;
create policy "moderators remove game labels"
  on public.game_labels for delete to authenticated
  using (public.is_moderator());

-- Stated rather than inherited: a project created after Supabase stopped
-- exposing new tables to the Data API roles by default would otherwise answer
-- every read with "permission denied", policies or not.
grant select on public.game_labels to anon, authenticated;
grant insert, delete on public.game_labels to authenticated;

comment on table public.game_labels is
  'Labels moderators put on games by hand (must_play). Readable by everyone; written only by public.moderators.';
