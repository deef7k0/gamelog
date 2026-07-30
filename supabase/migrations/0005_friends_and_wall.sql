-- GameLog — friends and profile walls
--
-- Run AFTER 0004.
--
-- Introduces a *second* social graph. Follows stay as they are — one-way,
-- feed-shaping, no consent needed. Friendship is mutual and requires accepting,
-- and it is what gates posting on someone's wall.

-- ---------------------------------------------------------------------------
-- 1. friendships
--
-- One row per pair, never two. The pair is stored ordered (user_a < user_b) and
-- enforced by a CHECK, which makes a duplicate reciprocal row structurally
-- impossible — without it, A→B and B→A could both sit pending and the UI would
-- have to reconcile them. `requested_by` records who actually asked.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.friendship_status as enum ('pending', 'accepted');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.friendships (
  user_a       uuid not null references public.profiles (id) on delete cascade,
  user_b       uuid not null references public.profiles (id) on delete cascade,
  /* Which of the two sent the request. Must be one of them. */
  requested_by uuid not null references public.profiles (id) on delete cascade,
  status       public.friendship_status not null default 'pending',
  created_at   timestamptz not null default now(),
  responded_at timestamptz,
  primary key (user_a, user_b),
  constraint friendship_ordered check (user_a < user_b),
  constraint friendship_requester_is_party check (requested_by in (user_a, user_b))
);

create index if not exists friendships_user_b_idx on public.friendships (user_b);
create index if not exists friendships_pending_idx
  on public.friendships (status) where status = 'pending';

/**
 * Are these two users friends?
 *
 * Callers should not have to know about the ordering convention, so this
 * normalises the pair itself. STABLE + SECURITY DEFINER so RLS policies can use
 * it without recursing into friendships' own policies.
 */
create or replace function public.are_friends(p_one uuid, p_two uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.friendships
     where user_a = least(p_one, p_two)
       and user_b = greatest(p_one, p_two)
       and status = 'accepted'
  );
$$;

-- ---------------------------------------------------------------------------
-- 2. wall_posts
--
-- Short text only. Deliberately no media column: the wall is for quick notes,
-- and `posts` already covers media-rich content.
-- ---------------------------------------------------------------------------
create table if not exists public.wall_posts (
  id            uuid primary key default gen_random_uuid(),
  /* Whose wall this appears on. */
  wall_owner_id uuid not null references public.profiles (id) on delete cascade,
  /* Who wrote it. Equal to wall_owner_id when posting on your own wall. */
  author_id     uuid not null references public.profiles (id) on delete cascade,
  body          text not null check (char_length(trim(body)) between 1 and 500),
  created_at    timestamptz not null default now()
);

create index if not exists wall_posts_owner_idx
  on public.wall_posts (wall_owner_id, created_at desc);

-- ---------------------------------------------------------------------------
-- 3. Notifications for the new events
--
-- ALTER TYPE ... ADD VALUE cannot be used in the same transaction that uses the
-- new value. Nothing here writes one at migration time — only the trigger
-- bodies below reference them, and those run later — so this is safe.
-- ---------------------------------------------------------------------------
alter type public.notification_kind add value if not exists 'friend_request';
alter type public.notification_kind add value if not exists 'friend_accepted';
alter type public.notification_kind add value if not exists 'wall_post';

-- ---------------------------------------------------------------------------
-- 4. Triggers
-- ---------------------------------------------------------------------------

/** Notify the addressee when a friend request arrives. */
create or replace function public.notify_on_friend_request()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  addressee uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if new.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind)
    values (addressee, new.requested_by, 'friend_request');
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_notify_request on public.friendships;
create trigger friendships_notify_request
  after insert on public.friendships
  for each row execute function public.notify_on_friend_request();

/** Notify the original requester when their request is accepted. */
create or replace function public.notify_on_friend_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  accepter uuid := case when new.requested_by = new.user_a then new.user_b else new.user_a end;
begin
  if new.status = 'accepted' and old.status = 'pending' then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.requested_by, accepter, 'friend_accepted');
  end if;
  return new;
end;
$$;

drop trigger if exists friendships_notify_accepted on public.friendships;
create trigger friendships_notify_accepted
  after update on public.friendships
  for each row execute function public.notify_on_friend_accepted();

/** Notify a wall owner when someone else posts on their wall. */
create or replace function public.notify_on_wall_post()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.author_id <> new.wall_owner_id then
    insert into public.notifications (user_id, actor_id, kind)
    values (new.wall_owner_id, new.author_id, 'wall_post');
  end if;
  return new;
end;
$$;

drop trigger if exists wall_posts_notify on public.wall_posts;
create trigger wall_posts_notify
  after insert on public.wall_posts
  for each row execute function public.notify_on_wall_post();

-- ---------------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------------
alter table public.friendships enable row level security;
alter table public.wall_posts  enable row level security;

-- friendships: public to read (so "X and Y are friends" can render), but only
-- the two parties may change anything.
drop policy if exists "friendships are viewable by everyone" on public.friendships;
create policy "friendships are viewable by everyone"
  on public.friendships for select using (true);

drop policy if exists "users send their own requests" on public.friendships;
create policy "users send their own requests"
  on public.friendships for insert to authenticated
  with check (
    auth.uid() = requested_by
    and auth.uid() in (user_a, user_b)
    and status = 'pending'
  );

/*
 * Only the *other* party may accept — without the `requested_by <> auth.uid()`
 * clause a user could accept their own request and friend anyone unilaterally.
 */
drop policy if exists "addressee responds to requests" on public.friendships;
create policy "addressee responds to requests"
  on public.friendships for update to authenticated
  using (auth.uid() in (user_a, user_b) and auth.uid() <> requested_by)
  with check (auth.uid() in (user_a, user_b) and auth.uid() <> requested_by);

-- Either party can decline a pending request or remove an existing friendship.
drop policy if exists "either party removes the friendship" on public.friendships;
create policy "either party removes the friendship"
  on public.friendships for delete to authenticated
  using (auth.uid() in (user_a, user_b));

-- wall_posts: world-readable; writable by the owner, or by an accepted friend.
drop policy if exists "wall posts are viewable by everyone" on public.wall_posts;
create policy "wall posts are viewable by everyone"
  on public.wall_posts for select using (true);

drop policy if exists "owner or friends post on a wall" on public.wall_posts;
create policy "owner or friends post on a wall"
  on public.wall_posts for insert to authenticated
  with check (
    auth.uid() = author_id
    and (author_id = wall_owner_id or public.are_friends(author_id, wall_owner_id))
  );

-- The author can delete their own note; the wall owner can remove anything from
-- their wall, which is the only moderation tool they have.
drop policy if exists "author or wall owner deletes" on public.wall_posts;
create policy "author or wall owner deletes"
  on public.wall_posts for delete to authenticated
  using (auth.uid() = author_id or auth.uid() = wall_owner_id);
