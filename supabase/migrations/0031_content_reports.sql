-- GameLog — reporting a suggestion or a review
--
-- Run after 0030 (it uses `is_moderator()` from 0024 and the suggestions of 0029).
--
-- ## What can be reported now
--
-- 0025 let people report a *pick* — "these two games are not alike". This adds
-- the two things people write:
--
--   similarity_suggestion_reports  one row per person per suggestion (0029's
--                                  reasons and line of text on a pair)
--   review_reports                 one row per person per review (a log's
--                                  headline and prose)
--
-- ## Why these do not hide themselves
--
-- Three reports take a pick down on their own (0025). Reports here never do, and
-- the line between the two is deliberate: a pick belongs to nobody — it is the
-- community's claim, so the community can withdraw it. A suggestion or a review
-- is one person's writing, and three accounts agreeing to silence someone is
-- exactly the thing a report must not be able to do. These wait for a moderator.
--
-- ## What a moderator can do
--
-- `remove` takes the *words* down and nothing else. A suggestion keeps its vote
-- (the author still agrees the games are alike) and loses its reasons, its line
-- and the upvotes given to them. A review keeps its log — status, score, hours —
-- and loses its headline and prose. `dismiss` leaves it as it is. Either closes
-- the open reports, so it leaves the queue. Removal is not reversible: the
-- queue shows the moderator the full text before they decide, and the screen
-- asks before it sends.
--
-- ## Integrity
--
-- One report per person per thing (primary keys), and never your own (a CHECK
-- for suggestions, the insert policy for reviews). Reports are private to their
-- author; moderators read them through the two queue functions. No client can
-- update or delete one.

-- ---------------------------------------------------------------------------
-- Suggestion reports
-- ---------------------------------------------------------------------------

create table if not exists public.similarity_suggestion_reports (
  similarity_id uuid not null,
  -- The suggestion's author: with `similarity_id`, the vote being reported —
  -- the same pointer 0029's upvotes use.
  author_id     uuid not null,
  user_id       uuid not null references public.profiles (id) on delete cascade,
  -- The words for these are in `constants/reports.ts`; the lists must match.
  reason        text not null
                  check (reason in ('spoilers', 'spam', 'inappropriate', 'harassment', 'off_topic')),
  note          text check (char_length(note) <= 300),
  status        text not null default 'open' check (status in ('open', 'resolved')),
  created_at    timestamptz not null default now(),
  primary key (similarity_id, author_id, user_id),
  -- Withdrawing a suggestion takes its reports with it, as it takes its upvotes.
  foreign key (similarity_id, author_id)
    references public.game_similarity_votes (similarity_id, user_id) on delete cascade,
  constraint similarity_suggestion_reports_not_own check (author_id <> user_id)
);

create index if not exists similarity_suggestion_reports_open_idx
  on public.similarity_suggestion_reports (similarity_id, author_id)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- Review reports
-- ---------------------------------------------------------------------------

create table if not exists public.review_reports (
  log_id     uuid not null references public.logs (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  reason     text not null
               check (reason in ('spoilers', 'spam', 'inappropriate', 'harassment', 'off_topic')),
  note       text check (char_length(note) <= 300),
  status     text not null default 'open' check (status in ('open', 'resolved')),
  created_at timestamptz not null default now(),
  primary key (log_id, user_id)
);

create index if not exists review_reports_open_idx
  on public.review_reports (log_id)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- The queues, for moderators
-- ---------------------------------------------------------------------------

/*
 * Every suggestion with an open report, oldest report first, with the words
 * being judged. SECURITY DEFINER because reports are private to their authors.
 */
create or replace function public.suggestion_reports_queue()
returns table (
  similarity_id  uuid,
  author_id      uuid,
  author_name    text,
  game_a_title   text,
  game_b_title   text,
  reasons        text[],
  comment        text,
  report_count   int,
  report_reasons text[],
  latest_note    text,
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
    select v.similarity_id,
           v.user_id,
           coalesce(nullif(btrim(p.display_name), ''), p.username),
           ga.title,
           gb.title,
           v.reasons,
           v.comment,
           count(r.*)::int,
           array_agg(distinct r.reason),
           (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
           min(r.created_at)
      from public.similarity_suggestion_reports r
      join public.game_similarity_votes v
        on v.similarity_id = r.similarity_id and v.user_id = r.author_id
      join public.profiles p on p.id = v.user_id
      join public.game_similarities s on s.id = v.similarity_id
      join public.games ga on ga.id = s.game_a
      join public.games gb on gb.id = s.game_b
     where r.status = 'open'
     group by v.similarity_id, v.user_id, p.display_name, p.username,
              ga.title, gb.title, v.reasons, v.comment
     order by min(r.created_at);
end;
$$;

revoke all on function public.suggestion_reports_queue() from public, anon;
grant execute on function public.suggestion_reports_queue() to authenticated;

/*
 * Every review with an open report, oldest report first, with its full text.
 */
create or replace function public.review_reports_queue()
returns table (
  log_id         uuid,
  author_id      uuid,
  author_name    text,
  game_id        text,
  game_title     text,
  review_title   text,
  review         text,
  spoilers       boolean,
  report_count   int,
  report_reasons text[],
  latest_note    text,
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
    select l.id,
           l.user_id,
           coalesce(nullif(btrim(p.display_name), ''), p.username),
           g.id,
           g.title,
           l.review_title,
           l.review,
           l.spoilers,
           count(r.*)::int,
           array_agg(distinct r.reason),
           (array_agg(r.note order by r.created_at desc) filter (where r.note is not null))[1],
           min(r.created_at)
      from public.review_reports r
      join public.logs l on l.id = r.log_id
      join public.profiles p on p.id = l.user_id
      join public.games g on g.id = l.game_id
     where r.status = 'open'
     group by l.id, l.user_id, p.display_name, p.username, g.id, g.title,
              l.review_title, l.review, l.spoilers
     order by min(r.created_at);
end;
$$;

revoke all on function public.review_reports_queue() from public, anon;
grant execute on function public.review_reports_queue() to authenticated;

-- ---------------------------------------------------------------------------
-- Settling a report
-- ---------------------------------------------------------------------------

/*
 * `remove` clears a suggestion's reasons and line and drops the upvotes they
 * earned; the vote itself stays, so its author still counts as agreeing.
 * `dismiss` leaves it alone. Either closes the open reports.
 */
create or replace function public.moderate_suggestion(
  p_similarity uuid,
  p_author     uuid,
  p_action     text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  if p_action not in ('remove', 'dismiss') then
    raise exception 'Action must be remove or dismiss.' using errcode = '22023';
  end if;

  if p_action = 'remove' then
    update public.game_similarity_votes
       set reasons = '{}',
           comment = null
     where similarity_id = p_similarity
       and user_id = p_author;

    if not found then
      raise exception 'Suggestion not found.' using errcode = 'P0002';
    end if;

    -- They were upvotes for the words that are gone.
    delete from public.game_similarity_upvotes
     where similarity_id = p_similarity
       and author_id = p_author;
  end if;

  update public.similarity_suggestion_reports
     set status = 'resolved'
   where similarity_id = p_similarity
     and author_id = p_author
     and status = 'open';
end;
$$;

revoke all on function public.moderate_suggestion(uuid, uuid, text) from public, anon;
grant execute on function public.moderate_suggestion(uuid, uuid, text) to authenticated;

/*
 * `remove` clears a review's headline and prose (and its spoiler flag, which
 * described them); the log — status, score, hours — stays. `dismiss` leaves it
 * alone. Either closes the open reports.
 */
create or replace function public.moderate_review(p_log uuid, p_action text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can do that.' using errcode = '42501';
  end if;
  if p_action not in ('remove', 'dismiss') then
    raise exception 'Action must be remove or dismiss.' using errcode = '22023';
  end if;

  if p_action = 'remove' then
    update public.logs
       set review       = null,
           review_title = null,
           spoilers     = false
     where id = p_log;

    if not found then
      raise exception 'Review not found.' using errcode = 'P0002';
    end if;
  end if;

  update public.review_reports
     set status = 'resolved'
   where log_id = p_log
     and status = 'open';
end;
$$;

revoke all on function public.moderate_review(uuid, text) from public, anon;
grant execute on function public.moderate_review(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.similarity_suggestion_reports enable row level security;
alter table public.review_reports                enable row level security;

-- Private. You can file one and see your own — which is how the report screen
-- knows you already have. No update or delete policy: a report, once filed, is
-- the moderators' to close.
drop policy if exists "users see their own suggestion reports" on public.similarity_suggestion_reports;
create policy "users see their own suggestion reports"
  on public.similarity_suggestion_reports for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "users file suggestion reports" on public.similarity_suggestion_reports;
create policy "users file suggestion reports"
  on public.similarity_suggestion_reports for insert to authenticated
  with check (auth.uid() = user_id and status = 'open');

drop policy if exists "users see their own review reports" on public.review_reports;
create policy "users see their own review reports"
  on public.review_reports for select to authenticated
  using (auth.uid() = user_id);

-- Not your own review: a CHECK cannot see the log's author, so the policy does.
drop policy if exists "users file review reports" on public.review_reports;
create policy "users file review reports"
  on public.review_reports for insert to authenticated
  with check (
    auth.uid() = user_id
    and status = 'open'
    and exists (
      select 1 from public.logs l
       where l.id = log_id
         and l.user_id <> auth.uid()
    )
  );
