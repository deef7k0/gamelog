-- GameLog — one person's collection, summarised
--
-- Run after 0024 (it reads `owned_copies`) and 0023 (`logs.completion`).
--
-- ## What this answers
--
-- The top of a library: how many games someone has logged and reviewed, what
-- they score on average, the best and worst thing they have played, and how
-- the collection splits between boxes on a shelf and everything else. One
-- aggregate on the server, so the numbers are exact however large the library
-- is — the client's own log list stops at a hundred rows.
--
-- ## Physical and digital never overlap
--
-- A game is counted **once**, under one of the two:
--
--   physical  a game with at least one physical copy in `owned_copies`
--   digital   every other game in the linked Steam library or logged by hand,
--             except games only on the backlog — "want to play" is a wish,
--             not something owned
--
-- So "128 digital · 14 physical" adds up to the collection rather than
-- double-counting the box someone also logged. Steam titles that never matched
-- a catalogue game are still games the person owns, and count by their Steam
-- id; one that did match is the same game as its log and counts once.
--
-- ## Highest and lowest
--
-- Among rated logs; a tie goes to the most recently logged, which is the one
-- somebody is likelier to remember writing.
--
-- Security invoker: every table read here is publicly readable already, so this
-- sees exactly what a visitor to the profile could add up by hand.

create or replace function public.user_game_stats(p_user uuid)
returns jsonb
language sql
stable
set search_path = public
as $$
  with mine as (
    select l.game_id, l.status, l.rating, l.review, l.completion, l.platinum,
           l.hours_played, l.created_at
      from public.logs l
     where l.user_id = p_user
  ),
  physical as (
    select distinct c.game_id
      from public.owned_copies c
     where c.user_id = p_user and c.ownership = 'physical'
  ),
  owned as (
    select coalesce(o.game_id, o.provider || ':' || o.app_id) as game_key
      from public.gaming_owned_games o
     where o.user_id = p_user
    union
    select m.game_id from mine m where m.status <> 'backlog'
  ),
  ranked as (
    select m.game_id, m.rating, g.title, g.cover_url, g.hero_url,
           row_number() over (order by m.rating desc, m.created_at desc) as best,
           row_number() over (order by m.rating asc, m.created_at desc) as worst
      from mine m
      join public.games g on g.id = m.game_id
     where m.rating is not null
  )
  select jsonb_build_object(
    'logged',   (select count(*) from mine),
    'reviews',  (select count(*) from mine where review is not null and btrim(review) <> ''),
    'rated',    (select count(*) from mine where rating is not null),
    'average',  (select round(avg(rating)) from mine where rating is not null),
    'finished', (select count(*) from mine where completion in ('story', 'main', 'full') or platinum),
    'full',     (select count(*) from mine where completion = 'full' or platinum),
    'platinum', (select count(*) from mine where platinum),
    'hours',    (select coalesce(round(sum(hours_played)), 0) from mine),
    'physical', (select count(*) from physical),
    'copies',   (select count(*) from public.owned_copies
                  where user_id = p_user and ownership = 'physical'),
    'digital',  (select count(*) from owned
                  where game_key not in (select game_id from physical)),
    'highest',  (select jsonb_build_object('game_id', game_id, 'title', title, 'rating', rating,
                                           'cover_url', cover_url, 'hero_url', hero_url)
                   from ranked where best = 1),
    'lowest',   (select jsonb_build_object('game_id', game_id, 'title', title, 'rating', rating,
                                           'cover_url', cover_url, 'hero_url', hero_url)
                   from ranked where worst = 1)
  )
$$;

grant execute on function public.user_game_stats(uuid) to anon, authenticated;
