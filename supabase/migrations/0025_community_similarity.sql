-- GameLog — community-curated similar games
--
-- Run after 0024 (it uses `is_moderator()` from there).
--
-- ## Not IGDB's list
--
-- The Similar tab has always shown IGDB's `similar_games`: an algorithm's
-- opinion, with no reasons and no way to disagree. This is the other half — what
-- the people here say is like this game, *and why*: "92 players recommend Cult of
-- the Lamb because of its combat and its progression". The two are shown apart
-- and labelled apart, because they are different claims.
--
-- ## The model
--
--   game_similarities       one row per pair of games, whoever suggested it
--   game_similarity_votes   one row per person per pair: up or down, why, and a
--                           line of their own
--   game_similarity_reports one row per person per pair: "this should not be here"
--
-- **A pair is undirected.** "Hades is like Cult of the Lamb" and "Cult of the Lamb
-- is like Hades" are one claim, so the pair is stored in canonical order
-- (`game_a < game_b`) with a unique constraint — which is also what makes a
-- duplicate suggestion impossible in either direction, and a game recommending
-- itself impossible at all. Both games' pages read the same row.
--
-- **Suggesting is voting.** The first person to suggest a pair is its first
-- upvote. Everyone after them votes on the same row; a second suggestion of an
-- existing pair is just that person's vote.
--
-- ## Ranking, not counting
--
-- Raw upvotes would rank a pair with 3 up and 40 down above one with 2 up and
-- none down. The order is the **lower bound of the Wilson score interval** on the
-- up/down ratio (z = 1.96) — "how good is this, at worst, given how few votes we
-- have" — which is the standard answer to exactly this problem, and rewards
-- agreement over volume without letting two votes outrank two hundred.
--
-- Votes from accounts that have never logged a game are **not counted** in the
-- ranking (they are still stored). That is the whole reputation system for now,
-- and it is deliberately a cheap one: a throwaway account made to push a pair
-- has, by definition, done nothing else here. Recency is not applied — whether
-- two games are alike does not decay.
--
-- ## Integrity
--
-- One vote per person per pair (primary key). New pairs are rate limited to 20
-- a day per person, inside the SECURITY DEFINER suggest function, which is the
-- only way a pair is created — there is no client insert policy on pairs.
-- Reports are private to their author, and three different people reporting a
-- pair hides it until a moderator looks. Moderation data lives in its own table
-- and never touches `games`.

-- ---------------------------------------------------------------------------
-- Pairs
-- ---------------------------------------------------------------------------

create table if not exists public.game_similarities (
  id         uuid primary key default gen_random_uuid(),
  game_a     text not null references public.games (id) on delete cascade,
  game_b     text not null references public.games (id) on delete cascade,
  created_by uuid references public.profiles (id) on delete set null,
  -- `hidden` by reports or a moderator. A hidden pair keeps its votes, so
  -- restoring it restores its ranking.
  status     text not null default 'active' check (status in ('active', 'hidden')),
  created_at timestamptz not null default now(),
  -- Canonical order: one row per pair, in either direction, and never a game
  -- paired with itself.
  constraint game_similarities_ordered check (game_a < game_b),
  constraint game_similarities_pair unique (game_a, game_b)
);

create index if not exists game_similarities_b_idx on public.game_similarities (game_b);

-- ---------------------------------------------------------------------------
-- Votes
-- ---------------------------------------------------------------------------

create table if not exists public.game_similarity_votes (
  similarity_id uuid not null references public.game_similarities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  value         smallint not null check (value in (-1, 1)),
  -- Why they are alike, from a fixed vocabulary (the client's words are in
  -- `constants/similarity.ts`; the two lists must match). Up to four, because a
  -- vote that ticks every box says nothing about which one mattered.
  reasons       text[] not null default '{}'
                  check (
                    cardinality(reasons) <= 4
                    and reasons <@ array[
                      'combat', 'progression', 'atmosphere', 'story', 'characters',
                      'exploration', 'mechanics', 'multiplayer', 'difficulty', 'genre',
                      'structure', 'tone'
                    ]::text[]
                  ),
  comment       text check (char_length(comment) <= 280),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  primary key (similarity_id, user_id)
);

create index if not exists game_similarity_votes_user_idx
  on public.game_similarity_votes (user_id);

drop trigger if exists game_similarity_votes_touch_updated_at on public.game_similarity_votes;
create trigger game_similarity_votes_touch_updated_at
  before update on public.game_similarity_votes
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------

create table if not exists public.game_similarity_reports (
  similarity_id uuid not null references public.game_similarities (id) on delete cascade,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  reason        text not null check (reason in ('spam', 'inappropriate', 'incorrect')),
  note          text check (char_length(note) <= 300),
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now(),
  primary key (similarity_id, user_id)
);

create index if not exists game_similarity_reports_open_idx
  on public.game_similarity_reports (similarity_id)
  where status = 'open';

/*
 * Three different people saying a pair should not be here takes it down until a
 * moderator looks. SECURITY DEFINER because reporters cannot write pairs.
 */
create or replace function public.hide_reported_similarity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (select count(*)
        from public.game_similarity_reports
       where similarity_id = new.similarity_id
         and status = 'open') >= 3 then
    update public.game_similarities
       set status = 'hidden'
     where id = new.similarity_id
       and status = 'active';
  end if;
  return new;
end;
$$;

revoke all on function public.hide_reported_similarity() from public, anon, authenticated;

drop trigger if exists game_similarity_reports_hide on public.game_similarity_reports;
create trigger game_similarity_reports_hide
  after insert on public.game_similarity_reports
  for each row execute function public.hide_reported_similarity();

-- ---------------------------------------------------------------------------
-- RPCs
-- ---------------------------------------------------------------------------

/*
 * Suggest that two games are alike — or, if someone already has, add your vote
 * with your reasons. Returns the pair's id.
 *
 * Both games must be cached in `games` first (the client calls `cacheGame`), for
 * the same reason a log needs it: the foreign keys.
 */
create or replace function public.suggest_similar_game(
  p_game    text,
  p_other   text,
  p_reasons text[] default '{}',
  p_comment text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid     uuid := auth.uid();
  a       text := least(p_game, p_other);
  b       text := greatest(p_game, p_other);
  pair_id uuid;
  pair_status text;
  today   int;
begin
  if uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;
  if p_game is null or p_other is null or p_game = p_other then
    raise exception 'A game cannot be similar to itself.' using errcode = '22023';
  end if;

  select id, status into pair_id, pair_status
    from public.game_similarities
   where game_a = a and game_b = b;

  if pair_status = 'hidden' then
    raise exception 'That suggestion was removed after reports.' using errcode = '22023';
  end if;

  if pair_id is null then
    select count(*) into today
      from public.game_similarities
     where created_by = uid and created_at > now() - interval '1 day';
    if today >= 20 then
      raise exception 'You have suggested a lot of games today. Try again tomorrow.'
        using errcode = '54000';
    end if;

    insert into public.game_similarities (game_a, game_b, created_by)
    values (a, b, uid)
    on conflict (game_a, game_b) do nothing
    returning id into pair_id;

    -- Someone else created it between the select and the insert.
    if pair_id is null then
      select id into pair_id from public.game_similarities where game_a = a and game_b = b;
    end if;
  end if;

  insert into public.game_similarity_votes (similarity_id, user_id, value, reasons, comment)
  values (pair_id, uid, 1, coalesce(p_reasons, '{}'), nullif(btrim(p_comment), ''))
  on conflict (similarity_id, user_id) do update
     set value   = 1,
         reasons = excluded.reasons,
         comment = excluded.comment;

  return pair_id;
end;
$$;

revoke all on function public.suggest_similar_game(text, text, text[], text) from public, anon;
grant execute on function public.suggest_similar_game(text, text, text[], text) to authenticated;

/*
 * The community's picks for one game, ranked.
 *
 * Invoker rights: every table it reads is public, and `auth.uid()` is only used
 * to report the caller's own vote back. Only votes from accounts with at least
 * one log are counted (see the header). A pair needs at least one counted
 * upvote to be listed at all.
 */
create or replace function public.community_similar_games(p_game text, p_limit int default 12)
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
  viewer_vote    smallint
)
language sql
stable
set search_path = public
as $$
  with pairs as (
    select s.id,
           case when s.game_a = p_game then s.game_b else s.game_a end as other
      from public.game_similarities s
     where s.status = 'active'
       and (s.game_a = p_game or s.game_b = p_game)
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
           count(*) filter (where c.value = 1)::int  as up,
           count(*) filter (where c.value = -1)::int as down,
           -- `numeric`, so the interval below stays exact: `power()` on an
           -- integer returns double precision, and `round(double, int)` does
           -- not exist in Postgres.
           count(c.value)::numeric                   as n
      from pairs p
      left join counted c on c.similarity_id = p.id
     group by p.id, p.other
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
  )
  select t.id,
         g.id,
         g.title,
         g.cover_url,
         g.hero_url,
         g.release_year,
         g.edition_kind,
         t.up,
         t.down,
         -- Wilson lower bound, z = 1.96: (p + z²/2n − z·√(p(1−p)/n + z²/4n²)) / (1 + z²/n).
         case when t.n = 0 then 0::numeric
         else round((
           t.up / t.n + 1.9208 / t.n
           - 1.96 * sqrt((t.up / t.n) * (1 - t.up / t.n) / t.n + 0.9604 / (t.n * t.n))
         ) / (1 + 3.8416 / t.n), 4)
         end as score,
         coalesce(rj.reasons, '{}'::jsonb),
         lc.comment,
         lc.author,
         (select v.value from public.game_similarity_votes v
           where v.similarity_id = t.id and v.user_id = auth.uid())
    from tallies t
    join public.games g on g.id = t.other
    left join reason_json rj on rj.similarity_id = t.id
    left join latest_comment lc on lc.similarity_id = t.id
   where t.up >= 1
   order by score desc, t.up desc, g.title
   limit greatest(1, least(coalesce(p_limit, 12), 50))
$$;

grant execute on function public.community_similar_games(text, int) to anon, authenticated;

/*
 * The reports queue, for moderators: every pair with an open report, hidden
 * ones first. SECURITY DEFINER because reports are private to their authors.
 */
create or replace function public.similarity_reports_queue()
returns table (
  similarity_id uuid,
  status        text,
  game_a        text,
  game_a_title  text,
  game_b        text,
  game_b_title  text,
  report_count  int,
  reasons       text[],
  latest_note   text,
  first_reported timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can see reports.' using errcode = '42501';
  end if;

  return query
    select s.id,
           s.status,
           s.game_a,
           ga.title,
           s.game_b,
           gb.title,
           count(r.*)::int,
           array_agg(distinct r.reason),
           (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
           min(r.created_at)
      from public.game_similarities s
      join public.game_similarity_reports r on r.similarity_id = s.id and r.status = 'open'
      join public.games ga on ga.id = s.game_a
      join public.games gb on gb.id = s.game_b
     group by s.id, s.status, s.game_a, ga.title, s.game_b, gb.title
     order by (s.status = 'hidden') desc, min(r.created_at);
end;
$$;

revoke all on function public.similarity_reports_queue() from public, anon;
grant execute on function public.similarity_reports_queue() to authenticated;

/*
 * Settle a reported pair. `hide` takes it down for good; `restore` puts it back.
 * Either way the open reports are closed, so the pair leaves the queue and
 * three new reports are needed to hide it again.
 */
create or replace function public.moderate_similarity(p_id uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  if p_action not in ('hide', 'restore') then
    raise exception 'Action must be hide or restore.' using errcode = '22023';
  end if;

  update public.game_similarities
     set status = case when p_action = 'hide' then 'hidden' else 'active' end
   where id = p_id;

  if not found then
    raise exception 'Suggestion not found.' using errcode = 'P0002';
  end if;

  update public.game_similarity_reports
     set status = 'resolved'
   where similarity_id = p_id
     and status = 'open';
end;
$$;

revoke all on function public.moderate_similarity(uuid, text) from public, anon;
grant execute on function public.moderate_similarity(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.game_similarities       enable row level security;
alter table public.game_similarity_votes   enable row level security;
alter table public.game_similarity_reports enable row level security;

-- Pairs: public to read, created only through `suggest_similar_game`.
drop policy if exists "similarities are viewable by everyone" on public.game_similarities;
create policy "similarities are viewable by everyone"
  on public.game_similarities for select using (true);

-- Votes: public to read (the reasons and comments are the point), owner to write.
drop policy if exists "similarity votes are viewable by everyone" on public.game_similarity_votes;
create policy "similarity votes are viewable by everyone"
  on public.game_similarity_votes for select using (true);

drop policy if exists "users cast their own similarity votes" on public.game_similarity_votes;
create policy "users cast their own similarity votes"
  on public.game_similarity_votes for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users change their own similarity votes" on public.game_similarity_votes;
create policy "users change their own similarity votes"
  on public.game_similarity_votes for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users withdraw their own similarity votes" on public.game_similarity_votes;
create policy "users withdraw their own similarity votes"
  on public.game_similarity_votes for delete to authenticated
  using (auth.uid() = user_id);

-- Reports: private. You can file one and see your own; moderators read them
-- through `similarity_reports_queue`.
drop policy if exists "users see their own similarity reports" on public.game_similarity_reports;
create policy "users see their own similarity reports"
  on public.game_similarity_reports for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users file similarity reports" on public.game_similarity_reports;
create policy "users file similarity reports"
  on public.game_similarity_reports for insert to authenticated
  with check (auth.uid() = user_id and status = 'open');
