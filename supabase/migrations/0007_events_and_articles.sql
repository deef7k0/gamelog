-- GameLog — event attendance and long-form articles
--
-- Run AFTER 0006_add_article_kind.sql, which must be executed and committed
-- separately. The CHECK constraints at the bottom of this file compare `kind`
-- against 'article', and Postgres rejects that if the enum value was added in
-- the same transaction.

-- ---------------------------------------------------------------------------
-- 1. events: local cache of IGDB events
--
-- Events arrive from IGDB, which we cannot foreign-key against, so they are
-- mirrored here on demand the first time someone RSVPs — exactly the pattern
-- `games` uses. Only events people actually care about are ever stored.
-- ---------------------------------------------------------------------------
create table if not exists public.events (
  id              text primary key,          -- '${source}:${source_id}', e.g. 'igdb:42'
  source          text not null default 'igdb' check (source in ('igdb')),
  source_id       text not null,
  name            text not null,
  description     text,
  starts_at       timestamptz,
  live_stream_url text,
  /* Whether this event has a physical venue. IGDB does not reliably say, so
     this defaults true and simply allows the in-person option. */
  has_venue       bool not null default true,
  cached_at       timestamptz not null default now(),
  unique (source, source_id)
);

create index if not exists events_starts_at_idx on public.events (starts_at);

-- ---------------------------------------------------------------------------
-- 2. event_attendance
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.attendance_mode as enum ('livestream', 'in_person');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.event_attendance (
  event_id    text not null references public.events (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  mode        public.attendance_mode not null default 'livestream',
  /*
   * Set when the user has a local reminder scheduled on their device. The
   * notification itself lives on the device — this column only records that one
   * exists, so the UI can show the toggle state across launches.
   */
  reminder_at timestamptz,
  created_at  timestamptz not null default now(),
  primary key (event_id, user_id)
);

create index if not exists event_attendance_user_idx
  on public.event_attendance (user_id, created_at desc);
create index if not exists event_attendance_event_idx
  on public.event_attendance (event_id);

-- ---------------------------------------------------------------------------
-- 3. Article columns on posts
--
-- An article is a `post` with a headline, tags and room to breathe, rather than
-- a separate table — the home feed, likes, comments and the profile Posts tab
-- all work on `posts` already, and splitting would mean duplicating every one
-- of those paths.
-- ---------------------------------------------------------------------------
alter table public.posts add column if not exists title text
  check (title is null or char_length(trim(title)) between 1 and 140);

alter table public.posts add column if not exists tags text[];

/* Blurs the body in previews until the reader opts in. */
alter table public.posts add column if not exists has_spoilers bool not null default false;

/*
 * Short posts stay short; articles get review-sized room. Enforcing the
 * distinction here rather than only in the client is what keeps "post" and
 * "article" meaningfully different.
 *
 * These three constraints are the reason 0006 has to be a separate script.
 */
alter table public.posts drop constraint if exists post_has_content;
alter table public.posts drop constraint if exists posts_body_check;
alter table public.posts
  add constraint posts_body_check
  check (
    body is not null
    and char_length(trim(body)) > 0
    and char_length(body) <= (case when kind = 'article' then 40000 else 5000 end)
  );

/* An article without a headline would render as an untitled magazine page. */
alter table public.posts drop constraint if exists posts_article_has_title;
alter table public.posts
  add constraint posts_article_has_title
  check (kind <> 'article' or (title is not null and char_length(trim(title)) > 0));

/*
 * Tags are a closed vocabulary — free-form tags fragment instantly ("guide",
 * "Guide", "guides") and make filtering useless.
 */
alter table public.posts drop constraint if exists posts_tags_known;
alter table public.posts
  add constraint posts_tags_known
  check (
    tags is null
    or tags <@ array[
      'guide', 'discussion', 'game-theory', 'retrospective',
      'why-you-should-play', 'review', 'news', 'opinion', 'tier-list'
    ]::text[]
  );

create index if not exists posts_articles_idx
  on public.posts (created_at desc) where kind = 'article';

-- ---------------------------------------------------------------------------
-- 4. RLS
-- ---------------------------------------------------------------------------
alter table public.events           enable row level security;
alter table public.event_attendance enable row level security;

-- events: a shared cache, like `games`.
drop policy if exists "events are viewable by everyone" on public.events;
create policy "events are viewable by everyone"
  on public.events for select using (true);

drop policy if exists "authenticated users cache events" on public.events;
create policy "authenticated users cache events"
  on public.events for insert to authenticated with check (true);

drop policy if exists "authenticated users refresh events" on public.events;
create policy "authenticated users refresh events"
  on public.events for update to authenticated using (true) with check (true);

-- attendance: public to read (the "N people watching" count depends on it),
-- writable only by the attendee.
drop policy if exists "attendance is viewable by everyone" on public.event_attendance;
create policy "attendance is viewable by everyone"
  on public.event_attendance for select using (true);

drop policy if exists "users record their own attendance" on public.event_attendance;
create policy "users record their own attendance"
  on public.event_attendance for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own attendance" on public.event_attendance;
create policy "users update their own attendance"
  on public.event_attendance for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users cancel their own attendance" on public.event_attendance;
create policy "users cancel their own attendance"
  on public.event_attendance for delete to authenticated using (auth.uid() = user_id);
