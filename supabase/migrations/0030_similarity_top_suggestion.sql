-- GameLog — each community pick carries its best suggestion
--
-- Run after 0029.
--
-- The sheet of community picks now shows, beside each game, the suggestion
-- people found most useful — its author and what they said — and one sentence:
-- "3 users suggested this game, with 12 users agreeing." That needs three things
-- the ranking did not return, so `community_similar_games` is recreated once more
-- (a new file rather than an edit to 0029, which may already be applied).
--
-- ## Suggesting and agreeing, told apart
--
-- Both are a positive vote (0025). A **suggestion** is one that says why — at
-- least one reason, or a line of text — which is what the suggest form writes.
-- An **agreement** is one that does not: the Agree button, which sets the vote
-- and nothing else. Every positive vote is exactly one of the two, so the two
-- counts never double-count a person.
--
-- Both counts are over everyone who voted, the same population the pick's own
-- screen lists. The ranking itself is unchanged and still counts only accounts
-- that have logged something.
--
-- ## The top suggestion
--
-- The one with the most upvotes (0029); a tie goes to the earliest, which is
-- usually the person who put the pair forward in the first place. It replaces the
-- "latest comment" the list used to show, which rewarded whoever wrote last
-- rather than whoever wrote best.

drop function if exists public.community_similar_games(text, int, text, uuid);

create or replace function public.community_similar_games(
  p_game  text,
  p_limit int default 12,
  p_sort  text default 'top',
  p_pair  uuid default null
)
returns table (
  similarity_id     uuid,
  game_id           text,
  title             text,
  cover_url         text,
  hero_url          text,
  release_year      int,
  edition_kind      text,
  up                int,
  down              int,
  score             numeric,
  reasons           jsonb,
  viewer_vote       smallint,
  votes             int,
  created_at        timestamptz,
  suggesters        int,
  agreers           int,
  top_author_id     uuid,
  top_author        text,
  top_author_avatar text,
  top_comment       text,
  top_reasons       text[]
)
language sql
stable
set search_path = public
as $$
  with pairs as (
    select s.id,
           s.created_at,
           case when s.game_a = p_game then s.game_b else s.game_a end as other
      from public.game_similarities s
     where s.status = 'active'
       and (s.game_a = p_game or s.game_b = p_game)
       and (p_pair is null or s.id = p_pair)
  ),
  counted as (
    select v.*
      from public.game_similarity_votes v
      join pairs p on p.id = v.similarity_id
     where exists (select 1 from public.logs l where l.user_id = v.user_id)
  ),
  tallies as (
    select p.id,
           p.other,
           p.created_at,
           count(*) filter (where c.value = 1)::int  as up,
           count(*) filter (where c.value = -1)::int as down,
           count(c.value)::numeric                   as n
      from pairs p
      left join counted c on c.similarity_id = p.id
     group by p.id, p.other, p.created_at
  ),
  positive as (
    select v.*,
           (cardinality(v.reasons) > 0 or nullif(btrim(v.comment), '') is not null) as says_why
      from public.game_similarity_votes v
      join pairs p on p.id = v.similarity_id
     where v.value = 1
  ),
  people as (
    select similarity_id,
           count(*) filter (where says_why)::int     as suggesters,
           count(*) filter (where not says_why)::int as agreers
      from positive
     group by similarity_id
  ),
  top_suggestion as (
    select distinct on (s.similarity_id)
           s.similarity_id,
           s.user_id,
           coalesce(nullif(btrim(pr.display_name), ''), pr.username) as author,
           pr.avatar_url,
           nullif(btrim(s.comment), '') as comment,
           s.reasons
      from positive s
      join public.profiles pr on pr.id = s.user_id
     where s.says_why
     order by s.similarity_id,
              (select count(*) from public.game_similarity_upvotes u
                where u.similarity_id = s.similarity_id and u.author_id = s.user_id) desc,
              s.created_at
  ),
  reason_counts as (
    select c.similarity_id, r.reason, count(*)::int as n
      from counted c
      cross join lateral unnest(c.reasons) as r(reason)
     where c.value = 1
     group by c.similarity_id, r.reason
  ),
  reason_json as (
    select similarity_id,
           jsonb_object_agg(reason, n order by n desc, reason) as reasons
      from reason_counts
     group by similarity_id
  ),
  ranked as (
    select t.*,
           -- Wilson lower bound, z = 1.96, exactly as 0025.
           case when t.n = 0 then 0::numeric
           else round((
             t.up / t.n + 1.9208 / t.n
             - 1.96 * sqrt((t.up / t.n) * (1 - t.up / t.n) / t.n + 0.9604 / (t.n * t.n))
           ) / (1 + 3.8416 / t.n), 4)
           end as score
      from tallies t
  )
  select r.id,
         g.id,
         g.title,
         g.cover_url,
         g.hero_url,
         g.release_year,
         g.edition_kind,
         r.up,
         r.down,
         r.score,
         coalesce(rj.reasons, '{}'::jsonb),
         (select v.value from public.game_similarity_votes v
           where v.similarity_id = r.id and v.user_id = auth.uid()),
         r.n::int,
         r.created_at,
         coalesce(pe.suggesters, 0),
         coalesce(pe.agreers, 0),
         ts.user_id,
         ts.author,
         ts.avatar_url,
         ts.comment,
         ts.reasons
    from ranked r
    join public.games g on g.id = r.other
    left join reason_json rj on rj.similarity_id = r.id
    left join people pe on pe.similarity_id = r.id
    left join top_suggestion ts on ts.similarity_id = r.id
   where r.up >= 1
     and (p_sort <> 'unrated' or r.n <= 1)
   order by
     case when p_sort = 'low'   then r.score end asc,
     case when p_sort = 'votes' then r.n end desc,
     case when p_sort in ('new', 'unrated') then r.created_at end desc,
     r.score desc,
     r.up desc,
     g.title
   limit greatest(1, least(coalesce(p_limit, 12), 100))
$$;

grant execute on function public.community_similar_games(text, int, text, uuid) to anon, authenticated;
