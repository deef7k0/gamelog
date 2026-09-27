-- GameLog — community similar games: sorting, and upvotes on each suggestion
--
-- Run after 0025.
--
-- ## What changes
--
-- The game page's Similar tab now opens the community's picks in a sheet, the
-- way reviews open, and a pick opens a screen of every suggestion behind it —
-- each person's reasons and line of text — which others can upvote.
--
-- 1. `community_similar_games` is recreated with a sort (`top`, `low`, `votes`,
--    `new`, `unrated`), a larger ceiling, one pair on its own (`p_pair`) and two
--    more columns (`votes`, `created_at`). Recreated here rather than edited in
--    0025, which may already be applied; the old two-argument calls keep
--    working, because every new argument has a default.
-- 2. `game_similarity_upvotes` — one person upvoting one *suggestion*. A
--    suggestion is a positive vote on a pair (0025 stores reasons and comment on
--    the vote), so an upvote points at that vote, and goes with it when the
--    author withdraws.
-- 3. `similarity_suggestions(p_similarity)` — every suggestion on a pair, with
--    its author, its upvotes and whether you have upvoted it.
--
-- ## "Not rated yet"
--
-- A pair nobody has weighed in on beyond the person who suggested it: one
-- counted vote. It is the list that most needs eyes, and the one a "top rated"
-- sort buries by construction.

-- ---------------------------------------------------------------------------
-- Upvotes on a suggestion
-- ---------------------------------------------------------------------------

create table if not exists public.game_similarity_upvotes (
  similarity_id uuid not null,
  -- The suggestion's author: with `similarity_id`, the vote being upvoted.
  author_id     uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  created_at    timestamptz not null default now(),
  primary key (similarity_id, author_id, user_id),
  foreign key (similarity_id, author_id)
    references public.game_similarity_votes (similarity_id, user_id) on delete cascade,
  -- Upvoting your own suggestion would be a vote for yourself.
  constraint game_similarity_upvotes_not_own check (author_id <> user_id)
);

create index if not exists game_similarity_upvotes_user_idx
  on public.game_similarity_upvotes (user_id);

alter table public.game_similarity_upvotes enable row level security;

drop policy if exists "suggestion upvotes are viewable by everyone" on public.game_similarity_upvotes;
create policy "suggestion upvotes are viewable by everyone"
  on public.game_similarity_upvotes for select using (true);

drop policy if exists "users upvote suggestions as themselves" on public.game_similarity_upvotes;
create policy "users upvote suggestions as themselves"
  on public.game_similarity_upvotes for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "users take back their own upvotes" on public.game_similarity_upvotes;
create policy "users take back their own upvotes"
  on public.game_similarity_upvotes for delete to authenticated
  using (user_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Every suggestion on one pair
-- ---------------------------------------------------------------------------

/*
 * The positive votes on a pair, as suggestions: who, why, what they said, and
 * how many people found it useful. Every one is listed — including votes from
 * accounts that have logged nothing, which the ranking does not count; a list of
 * what people said should not quietly leave some of them out. Sorting happens
 * on the phone: one pair's suggestions are one per person who made one.
 */
create or replace function public.similarity_suggestions(p_similarity uuid)
returns table (
  author_id      uuid,
  username       text,
  display_name   text,
  avatar_url     text,
  reasons        text[],
  comment        text,
  created_at     timestamptz,
  updated_at     timestamptz,
  upvotes        int,
  viewer_upvoted boolean
)
language sql
stable
set search_path = public
as $$
  select v.user_id,
         p.username,
         p.display_name,
         p.avatar_url,
         v.reasons,
         v.comment,
         v.created_at,
         v.updated_at,
         (select count(*)::int from public.game_similarity_upvotes u
           where u.similarity_id = v.similarity_id and u.author_id = v.user_id),
         exists (select 1 from public.game_similarity_upvotes u
                  where u.similarity_id = v.similarity_id
                    and u.author_id = v.user_id
                    and u.user_id = auth.uid())
    from public.game_similarity_votes v
    join public.profiles p on p.id = v.user_id
    join public.game_similarities s on s.id = v.similarity_id
   where v.similarity_id = p_similarity
     and v.value = 1
     and s.status = 'active'
   order by v.created_at
   limit 500
$$;

grant execute on function public.similarity_suggestions(uuid) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- The ranked list, sortable
-- ---------------------------------------------------------------------------

drop function if exists public.community_similar_games(text, int);

create or replace function public.community_similar_games(
  p_game  text,
  p_limit int default 12,
  p_sort  text default 'top',
  p_pair  uuid default null
)
returns table (
  similarity_id  uuid,
  game_id        text,
  title          text,
  cover_url      text,
  hero_url       text,
  release_year   int,
  edition_kind   text,
  up             int,
  down           int,
  score          numeric,
  reasons        jsonb,
  comment        text,
  comment_author text,
  viewer_vote    smallint,
  -- Counted votes either way — how much agreement or disagreement there is.
  votes          int,
  created_at     timestamptz
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
  latest_comment as (
    select distinct on (c.similarity_id)
           c.similarity_id,
           c.comment,
           coalesce(nullif(btrim(pr.display_name), ''), pr.username) as author
      from counted c
      join public.profiles pr on pr.id = c.user_id
     where c.value = 1
       and c.comment is not null
     order by c.similarity_id, c.updated_at desc
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
         lc.comment,
         lc.author,
         (select v.value from public.game_similarity_votes v
           where v.similarity_id = r.id and v.user_id = auth.uid()),
         r.n::int,
         r.created_at
    from ranked r
    join public.games g on g.id = r.other
    left join reason_json rj on rj.similarity_id = r.id
    left join latest_comment lc on lc.similarity_id = r.id
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
