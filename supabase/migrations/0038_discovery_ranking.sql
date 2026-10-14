-- ---------------------------------------------------------------------------
-- 0038 — Discovery, counted the way Letterboxd counts it: popularity inside a
--        period, popularity among the people you follow, and the language a
--        review is written in
-- ---------------------------------------------------------------------------
--
-- The owner asked how Letterboxd decides what to show somebody, and for the
-- same here. What its API documents is not a recommender. It is three small
-- ideas, and this file is those three:
--
--   1. POPULARITY IS ACTIVITY, AND IT HAS A PERIOD. Its sort orders are
--      `ReviewPopularity`, `ReviewPopularityThisWeek`, `…ThisMonth`,
--      `…ThisYear` ("reviews with more activity (likes/comments) first"), and
--      the same four for members. 0013's `popular_reviews` and `popular_users`
--      are the first of each only: every like since the beginning, so the
--      chart stops moving once somebody is ahead.
--
--   2. THE SAME COUNT, AMONG YOUR FRIENDS. Every one of those has a
--      `…WithFriends` twin that "consider[s] popularity amongst the signed-in
--      member's friends". It is the same arithmetic over fewer people.
--
--   3. ONE ENTRY A MEMBER. `filter=NoDuplicateMembers` — "only the first log
--      entry for each member" — is what stops one prolific person from being
--      the whole chart.
--
-- And one thing Letterboxd does not do at all, which the owner asked about by
-- name: LANGUAGE. Its reviews are every language mixed; people install browser
-- extensions to hide the ones they cannot read. So a review here carries the
-- language it was written in (`logs.review_lang`), and a chart can be asked
-- for the languages its reader reads.
--
-- WHAT IS CREATED
--   logs.review_lang     a column, and its CHECK
--   circle_of()          who somebody counts as theirs
--   review_popularity()  the reviews with the most activity in a period
--   member_popularity()  the people with the most activity in a period — or,
--                        asked for the reader's circle, the people their
--                        friends follow and like whom they do not follow yet
--   three indexes        so "since last Monday" is not a scan
--
-- Nothing is dropped, and 0013's functions stay: the app calls them on a
-- database that has not run this file.
--
-- WHO MAY CALL THEM
--   Everybody, as their caller. They read `logs`, `likes`, `comments`,
--   `follows`, `friendships` and `lists`, each already readable by everyone
--   (0001, 0003, 0005), so there is nothing here a SELECT could not also find.
--   `p_viewer` is an argument and not `auth.uid()` for the reason
--   `recommended_users` (0013) takes one: who follows whom is public, so
--   "popular among X's friends" is not a secret about X.
--
-- Safe to re-run.
-- ---------------------------------------------------------------------------

-- ---------------------------------------------------------------------------
-- The language a review is written in
-- ---------------------------------------------------------------------------

/*
 * An ISO 639-1 code — 'en', 'es', 'ja' — or null for "nobody could tell".
 *
 * Written by the app when the review is saved (`lib/language.ts` reads the
 * words; there is no detector in Postgres and this is not the place for one).
 * NULL IS NOT "NO LANGUAGE", IT IS "UNKNOWN", and every reader of this column
 * shows an unknown review to everybody: "10/10" has no language, and every
 * review written before this file is unlabelled until it is next saved.
 *
 * Not an enum and not a foreign key to a table of languages: the detector's
 * list grows, and a CHECK on the *shape* is what stops a typo without making
 * a new language a migration.
 */
alter table public.logs add column if not exists review_lang text;

alter table public.logs drop constraint if exists logs_review_lang_check;
alter table public.logs
  add constraint logs_review_lang_check
  check (review_lang is null or review_lang ~ '^[a-z]{2,3}$');

comment on column public.logs.review_lang is
  'ISO 639-1 code of the language the review is written in, set by the app on save. Null is unknown, and unknown is shown to everybody.';

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------

/* The three things that are counted "since": a like, a comment, a follow. */
create index if not exists likes_created_idx on public.likes (created_at);
create index if not exists comments_created_idx on public.comments (created_at);
create index if not exists follows_created_idx on public.follows (created_at);

-- ---------------------------------------------------------------------------
-- Whose activity is "your friends'"
-- ---------------------------------------------------------------------------

/*
 * Everybody a person counts as theirs: the people they follow, and their
 * accepted friends. Never the person themselves.
 *
 * The same set `getCircleIds` builds on the phone from two requests — a follow
 * is one-way (0001), a friendship is a request somebody accepted (0005), and
 * "your friends" here has always meant either. It is a function so the two
 * below cannot each have their own idea of it.
 */
create or replace function public.circle_of(p_viewer uuid)
returns table (user_id uuid)
language sql
stable
as $$
  select f.following_id
    from public.follows f
   where f.follower_id = p_viewer
     and f.following_id <> p_viewer
  union
  select case when fr.user_a = p_viewer then fr.user_b else fr.user_a end
    from public.friendships fr
   where fr.status = 'accepted'
     and p_viewer in (fr.user_a, fr.user_b);
$$;

comment on function public.circle_of(uuid) is
  'The people p_viewer follows, and their accepted friends. What "your friends" means to the discovery functions.';

-- ---------------------------------------------------------------------------
-- Reviews, by the activity they drew in a period
-- ---------------------------------------------------------------------------

/*
 * The reviews people responded to most since `p_since` — or ever, when it is
 * null.
 *
 * ACTIVITY is likes, plus the number of people who commented. Both from
 * somebody other than the author: liking your own review is allowed and is not
 * a reason to rank it. People who commented, not comments, so two people
 * arguing under a review for thirty replies weigh what two people weigh.
 * Letterboxd's own weighting of likes against comments is not published; this
 * is the plainest reading of "activity (likes/comments)".
 *
 * WHICH REVIEWS ARE IN IT. Inside a period: the ones written in it, and any
 * older one somebody liked or commented on in it. A review nobody has touched
 * yet is in — last, newest first — because a chart only the already-liked can
 * enter never changes hands. With no period, every review.
 *
 * ONE A MEMBER, FIRST. `turn` is each author's own ranking of their reviews:
 * every author's best comes before anybody's second best. Among enough
 * authors the first screen is one review each, which is Letterboxd's
 * `NoDuplicateMembers`; among two authors it is still a full list, where a
 * hard one-a-member rule would be a chart of two rows.
 *
 * LANGUAGE. With `p_langs`, a review labelled with another language is left
 * out. An unlabelled one never is.
 */
create or replace function public.review_popularity(
  p_since timestamptz default null,
  p_langs text[]      default null,
  p_limit int         default 20
)
returns table (log_id uuid, activity bigint, likes bigint, comments bigint)
language sql
stable
as $$
  with reviews as (
    select l.id, l.user_id, l.created_at
      from public.logs l
     where l.review is not null
       and char_length(btrim(l.review)) > 0
       and (p_langs is null
            or l.review_lang is null
            or l.review_lang = any (p_langs))
  ),
  liked as (
    select k.target_id as log_id, count(*) as n
      from public.likes k
      join reviews r on r.id = k.target_id
     where k.target_type = 'log'
       and k.user_id <> r.user_id
       and (p_since is null or k.created_at >= p_since)
     group by k.target_id
  ),
  discussed as (
    select c.target_id as log_id, count(distinct c.user_id) as n
      from public.comments c
      join reviews r on r.id = c.target_id
     where c.target_type = 'log'
       and c.user_id <> r.user_id
       and (p_since is null or c.created_at >= p_since)
     group by c.target_id
  ),
  scored as (
    select r.id,
           r.user_id,
           r.created_at,
           coalesce(k.n, 0) as likes,
           coalesce(d.n, 0) as comments
      from reviews r
      left join liked k on k.log_id = r.id
      left join discussed d on d.log_id = r.id
     where p_since is null
        or r.created_at >= p_since
        or coalesce(k.n, 0) + coalesce(d.n, 0) > 0
  ),
  ranked as (
    select s.*,
           row_number() over (
             partition by s.user_id
             order by s.likes + s.comments desc, s.created_at desc
           ) as turn
      from scored s
  )
  select r.id,
         r.likes + r.comments,
         r.likes,
         r.comments
    from ranked r
   order by r.turn,
            r.likes + r.comments desc,
            r.created_at desc
   limit greatest(p_limit, 1);
$$;

comment on function public.review_popularity(timestamptz, text[], int) is
  'Reviews by the likes and commenters they drew since p_since (null: ever), each author''s best first, optionally in p_langs. Search''s Reviews chart.';

-- ---------------------------------------------------------------------------
-- People, by the activity they drew in a period — from everybody, or from the
-- reader's circle
-- ---------------------------------------------------------------------------

/*
 * The people whose writing and collections were responded to most since
 * `p_since` — or ever, when it is null.
 *
 * ACTIVITY is likes on their reviews and collections, the people who commented
 * on each, and new followers. All from somebody else. Somebody nobody has
 * responded to in the period is not in it: this is a chart, and a chart of
 * people with nothing next to their names is the member list.
 *
 * `p_viewer` is never in their own results.
 *
 * WITH `p_circle`, the activity counted is the reader's circle's and nobody
 * else's, and the circle itself is left out — which makes it a different
 * question with the same arithmetic: not "who is popular" but "who do the
 * people I follow follow, like and talk to, that I do not follow yet". It is
 * Letterboxd's `MemberPopularityWithFriends`. It needs `p_viewer`; without one
 * there is no circle and it answers nothing.
 *
 * LANGUAGE. With `p_langs`, somebody is left out only when every review of
 * theirs that has a label is in another language. Somebody with no labelled
 * review is never left out.
 */
create or replace function public.member_popularity(
  p_since  timestamptz default null,
  p_viewer uuid        default null,
  p_circle boolean     default false,
  p_langs  text[]      default null,
  p_limit  int         default 20
)
returns table (user_id uuid, activity bigint, likes bigint, comments bigint, followers bigint)
language sql
stable
as $$
  with circle as (
    select c.user_id
      from public.circle_of(p_viewer) c
     where p_viewer is not null
  ),
  authored as (
    select l.id, l.user_id, 'log'::text as kind from public.logs l
    union all
    select s.id, s.user_id, 'list'::text from public.lists s
  ),
  acts as (
    select a.user_id as member, k.user_id as actor, 'like'::text as kind, a.id as thing
      from public.likes k
      join authored a on a.kind = k.target_type and a.id = k.target_id
     where p_since is null or k.created_at >= p_since
    union all
    -- `distinct`: one row for each person on each thing, however much they said.
    select distinct a.user_id, c.user_id, 'comment'::text, a.id
      from public.comments c
      join authored a on a.kind = c.target_type and a.id = c.target_id
     where p_since is null or c.created_at >= p_since
    union all
    select f.following_id, f.follower_id, 'follow'::text, null::uuid
      from public.follows f
     where p_since is null or f.created_at >= p_since
  ),
  counted as (
    select a.member,
           count(*) filter (where a.kind = 'like') as likes,
           count(*) filter (where a.kind = 'comment') as comments,
           count(*) filter (where a.kind = 'follow') as followers
      from acts a
     where a.actor <> a.member
       and (not coalesce(p_circle, false) or a.actor in (select c.user_id from circle c))
     group by a.member
  )
  select c.member,
         c.likes + c.comments + c.followers,
         c.likes,
         c.comments,
         c.followers
    from counted c
   where (p_viewer is null or c.member <> p_viewer)
     and (not coalesce(p_circle, false)
          or c.member not in (select k.user_id from circle k))
     -- A label counts only while the review it labels is there: a moderator
     -- removes a review's words (0031) and leaves its log.
     and (p_langs is null
          or not exists (
            select 1 from public.logs l
             where l.user_id = c.member
               and l.review is not null
               and l.review_lang is not null)
          or exists (
            select 1 from public.logs l
             where l.user_id = c.member
               and l.review is not null
               and l.review_lang = any (p_langs)))
   order by c.likes + c.comments + c.followers desc,
            c.followers desc,
            c.member
   limit greatest(p_limit, 1);
$$;

comment on function public.member_popularity(timestamptz, uuid, boolean, text[], int) is
  'People by the likes, commenters and followers they drew since p_since (null: ever). With p_circle, counted among p_viewer''s circle only and excluding it. Search''s People charts.';
