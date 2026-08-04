-- ---------------------------------------------------------------------------
-- 0013 — likes on collections, and the Discover/Reviews/Collections/People tabs
-- ---------------------------------------------------------------------------
--
-- Two things:
--
-- 1. `likes` gains a third target type, `list`, so a collection can be liked
--    exactly the way a post or a review already is. No new table: the whole
--    point of the polymorphic (target_type, target_id) shape from 0003 is that
--    a new likeable thing costs a CHECK constraint and a trigger branch.
--
-- 2. Five read-only functions behind the search tabs. They exist because
--    PostgREST cannot order a resource by an aggregate over an embedded one —
--    "collections, most-liked first" is not expressible as a REST query. Each
--    returns ids plus its ranking number and nothing else; the client re-selects
--    the full rows with its normal embeds and re-orders in memory. That keeps
--    one definition of what a review or a collection *is*, in TypeScript, rather
--    than a second one drifting inside a SQL function.
--
-- All five are SECURITY INVOKER (the default) on purpose: they read
-- world-readable tables, and running them as the caller means RLS still decides
-- what is visible. A SECURITY DEFINER function here would be a way to read
-- around the policies, for no benefit.

-- ---------------------------------------------------------------------------
-- likes on lists
-- ---------------------------------------------------------------------------

alter table public.likes drop constraint if exists likes_target_type_check;
alter table public.likes
  add constraint likes_target_type_check
  check (target_type in ('post', 'log', 'list'));

/*
 * The integrity trigger has to learn the new type too, or a like could point at
 * a list id that does not exist. Comments are deliberately *not* extended:
 * their own CHECK still allows only post and log, so this branch is unreachable
 * from the comments trigger until someone decides collections take comments.
 */
create or replace function public.assert_target_exists()
returns trigger
language plpgsql
as $$
begin
  if new.target_type = 'post' then
    if not exists (select 1 from public.posts where id = new.target_id) then
      raise exception 'post % does not exist', new.target_id;
    end if;
  elsif new.target_type = 'log' then
    if not exists (select 1 from public.logs where id = new.target_id) then
      raise exception 'log % does not exist', new.target_id;
    end if;
  elsif new.target_type = 'list' then
    if not exists (select 1 from public.lists where id = new.target_id) then
      raise exception 'list % does not exist', new.target_id;
    end if;
  end if;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Reviews tab — most-liked writing
-- ---------------------------------------------------------------------------

/*
 * Only logs that actually carry writing. A five-star rating with no words is a
 * log, not a review, and a "popular reviews" tab full of bare scores would be
 * a leaderboard of games wearing someone else's name.
 */
create or replace function public.popular_reviews(p_limit int default 20)
returns table (log_id uuid, like_count bigint)
language sql
stable
as $$
  select l.id,
         count(k.user_id) as like_count
    from public.logs l
    left join public.likes k
      on k.target_type = 'log'
     and k.target_id = l.id
   where l.review is not null
     and char_length(trim(l.review)) > 0
   group by l.id, l.created_at
   -- Recency breaks ties so a brand-new review is reachable before it has
   -- collected a single like; without it the tab would be frozen history.
   order by count(k.user_id) desc, l.created_at desc
   limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- Collections tab — most-liked collections
-- ---------------------------------------------------------------------------

/*
 * `list` and `tier` only. Favourites and wishlists are singletons the profile
 * renders itself — they are per-user state, not published collections, and
 * ranking them here would put everyone's private wishlist in a public chart.
 *
 * Empty collections are excluded: a collection is its games, and a title with
 * nothing behind it is a draft.
 */
create or replace function public.popular_collections(p_limit int default 20)
returns table (list_id uuid, like_count bigint, item_count bigint)
language sql
stable
as $$
  select l.id,
         (select count(*) from public.likes k
           where k.target_type = 'list' and k.target_id = l.id),
         (select count(*) from public.list_items i where i.list_id = l.id)
    from public.lists l
   where l.kind in ('list', 'tier')
     and exists (select 1 from public.list_items i where i.list_id = l.id)
   order by (select count(*) from public.likes k
              where k.target_type = 'list' and k.target_id = l.id) desc,
            l.updated_at desc
   limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- People tab — three different questions
-- ---------------------------------------------------------------------------

/** Most reviews written. Volume, not reception. */
create or replace function public.top_reviewers(p_limit int default 20)
returns table (user_id uuid, review_count bigint)
language sql
stable
as $$
  select l.user_id, count(*) as review_count
    from public.logs l
   where l.review is not null
     and char_length(trim(l.review)) > 0
   group by l.user_id
   order by count(*) desc
   limit greatest(p_limit, 1);
$$;

/*
 * Most liked, across everything they have posted — reviews and posts together.
 * Reception, not volume: this is the other half of the pair above, and the two
 * deliberately rank differently.
 */
create or replace function public.popular_users(p_limit int default 20)
returns table (user_id uuid, like_count bigint)
language sql
stable
as $$
  with authored as (
    select id, user_id, 'log'::text as kind from public.logs
    union all
    select id, user_id, 'post'::text from public.posts
  )
  select a.user_id, count(k.user_id) as like_count
    from authored a
    join public.likes k
      on k.target_type = a.kind
     and k.target_id = a.id
   group by a.user_id
  having count(k.user_id) > 0
   order by count(k.user_id) desc
   limit greatest(p_limit, 1);
$$;

/*
 * Recommended people: taste overlap, computed rather than declared.
 *
 * Two users overlap when they logged the same game. `affinity` grades that
 * overlap by how closely they scored it — 1.0 for an identical score, 0.0 for
 * 0-versus-100 — so somebody who loves everything the viewer loves outranks
 * somebody who merely played the same things. Unrated logs count as a neutral
 * 50 rather than being dropped, because "we both played it" is itself weak
 * evidence and throwing it away would leave new users with no recommendations
 * at all.
 *
 * The score multiplies overlap by affinity: agreeing about two games is worth
 * less than agreeing about twenty. Two shared games is the floor — one is
 * coincidence.
 *
 * People the viewer already follows are excluded. This tab is for finding
 * someone new; a recommendation you have already taken is not one.
 */
create or replace function public.recommended_users(p_viewer uuid, p_limit int default 20)
returns table (user_id uuid, shared_games bigint, affinity numeric)
language sql
stable
as $$
  select other.user_id,
         count(*) as shared_games,
         round(avg(
           1.0 - abs(coalesce(other.rating, 50) - coalesce(mine.rating, 50)) / 100.0
         ), 3) as affinity
    from public.logs mine
    join public.logs other
      on other.game_id = mine.game_id
     and other.user_id <> mine.user_id
   where mine.user_id = p_viewer
     and not exists (
       select 1 from public.follows f
        where f.follower_id = p_viewer
          and f.following_id = other.user_id
     )
   group by other.user_id
  having count(*) >= 2
   order by count(*) * avg(
     1.0 - abs(coalesce(other.rating, 50) - coalesce(mine.rating, 50)) / 100.0
   ) desc
   limit greatest(p_limit, 1);
$$;

-- ---------------------------------------------------------------------------
-- Indexes for the above
-- ---------------------------------------------------------------------------

/* `popular_reviews` and `top_reviewers` both scan for logs that carry writing. */
create index if not exists logs_written_reviews_idx
  on public.logs (created_at desc)
  where review is not null;

/* The overlap join in `recommended_users` reads logs by game. */
create index if not exists logs_game_user_idx on public.logs (game_id, user_id);
