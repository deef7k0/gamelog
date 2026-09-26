-- GameLog — completion-aware review statistics
--
-- Run after 0023 (it reads `logs.completion` and `logs.coop`).
--
-- ## What this answers
--
-- "Players who finished it scored it 87; players who dropped it, 64." The single
-- average on a game's reviews hides the most useful thing a ratings database can
-- say: whether the people who stuck with a game liked it more than the people
-- who did not, and whether it plays better on one platform than another. Every
-- number here is Gamelog's own — the scores people gave on this app — never a
-- third party's.
--
-- ## One call, sums rather than averages
--
-- The whole breakdown is one aggregate over one game's rated logs, so a game with
-- five thousand ratings costs the phone a few hundred bytes rather than five
-- thousand rows. Each group comes back as a count and a **sum**, not an average:
-- the client folds platforms into families ("PS4" and "PS5" are both
-- PlayStation), and averages cannot be merged — sums can. The family table lives
-- once, in `constants/platform-family.ts`; repeating it in SQL would be a second
-- copy to drift.
--
-- ## Who is counted
--
-- Every log with a score, exactly the population `getRatingBreakdown` already
-- counts — so the headline average here and the histogram above it can never
-- disagree. Logs are public by design (0001) and there is no private-review
-- setting to honour; if one is ever added, this function is the one place the
-- filter has to go.
--
-- A platinum counts as finished and as 100% whatever `completion` says: the
-- progress sheet's "Played" clears the level without touching the trophy, and a
-- platinum is not somebody who failed to finish. `lib/review-facets.ts` filters
-- the review list by the same rule, so a group's count here is the number of
-- rated reviews the matching filter can find.
--
-- ## The platform filter's choices
--
-- `written_platforms` is every platform somebody has written a review on — the
-- review list's population, not the ratings'. It used to be built on the phone
-- from every review's `played_on`, one row per review; this is the distinct
-- handful, however many reviews there are.

create or replace function public.game_review_stats(p_game text)
returns jsonb
language sql
stable
set search_path = public
as $$
  with rated as (
    select rating,
           status,
           completion,
           platinum,
           coop,
           nullif(btrim(played_on), '') as platform
      from public.logs
     where game_id = p_game
       and rating is not null
  ),
  groups as (
    select 'finished' as key, count(*) as n, coalesce(sum(rating), 0) as total
      from rated where completion in ('story', 'main', 'full') or platinum
    union all
    select 'full', count(*), coalesce(sum(rating), 0)
      from rated where completion = 'full' or platinum
    union all
    select 'playing', count(*), coalesce(sum(rating), 0)
      from rated where status in ('playing', 'paused')
    union all
    select 'dropped', count(*), coalesce(sum(rating), 0)
      from rated where status = 'dropped'
    union all
    select 'solo', count(*), coalesce(sum(rating), 0)
      from rated where coop is false
    union all
    select 'coop', count(*), coalesce(sum(rating), 0)
      from rated where coop is true
  )
  select jsonb_build_object(
    'count', (select count(*) from rated),
    'sum', (select coalesce(sum(rating), 0) from rated),
    'groups', (
      select jsonb_object_agg(key, jsonb_build_object('count', n, 'sum', total))
        from groups
    ),
    'platforms', coalesce((
      select jsonb_agg(jsonb_build_object('platform', platform, 'count', n, 'sum', total)
                       order by n desc, platform)
        from (
          select platform, count(*) as n, sum(rating) as total
            from rated
           where platform is not null
           group by platform
        ) by_platform
    ), '[]'::jsonb),
    'written_platforms', coalesce((
      select jsonb_agg(platform order by platform)
        from (
          select distinct nullif(btrim(played_on), '') as platform
            from public.logs
           where game_id = p_game
             and review is not null
             and btrim(review) <> ''
        ) written
       where platform is not null
    ), '[]'::jsonb)
  )
$$;

grant execute on function public.game_review_stats(text) to anon, authenticated;
