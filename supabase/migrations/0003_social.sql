-- GameLog — the social layer
--
-- Run AFTER 0002. Adds the surfaces the app was missing: free-form posts with
-- media, likes, comments, curated lists (including favourites and tier lists),
-- and notifications.
--
-- Design note: likes and comments are polymorphic over (target_type, target_id)
-- so they work on both posts and logs (reviews) without duplicating tables.
-- Postgres cannot foreign-key a polymorphic column, so integrity is enforced by
-- triggers below rather than by FK constraints.

-- ---------------------------------------------------------------------------
-- posts
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.post_kind as enum ('post', 'recommendation', 'screenshot', 'question');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.posts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  body       text check (char_length(body) <= 5000),
  kind       public.post_kind not null default 'post',
  -- Optional game tag. Nullable: not every post is about a specific game.
  game_id    text references public.games (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- A post with neither text nor media is meaningless. Media is checked in the
  -- app; this at least stops a completely empty row.
  constraint post_has_content check (body is not null and char_length(trim(body)) > 0)
);

create index if not exists posts_created_idx on public.posts (created_at desc);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists posts_game_idx on public.posts (game_id);

-- Attached images/videos, ordered. Separate table so a post can carry a
-- swipeable carousel rather than a single image.
create table if not exists public.post_media (
  id       uuid primary key default gen_random_uuid(),
  post_id  uuid not null references public.posts (id) on delete cascade,
  url      text not null,
  kind     text not null default 'image' check (kind in ('image', 'video')),
  width    int,
  height   int,
  position int not null default 0
);

create index if not exists post_media_post_idx on public.post_media (post_id, position);

-- ---------------------------------------------------------------------------
-- likes and comments (polymorphic over posts + logs)
-- ---------------------------------------------------------------------------
create table if not exists public.likes (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'log')),
  target_id   uuid not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, target_type, target_id)
);

create index if not exists likes_target_idx on public.likes (target_type, target_id);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  target_type text not null check (target_type in ('post', 'log')),
  target_id   uuid not null,
  body        text not null check (char_length(trim(body)) between 1 and 2000),
  -- Self-reference gives one level of nesting (replies to comments).
  parent_id   uuid references public.comments (id) on delete cascade,
  created_at  timestamptz not null default now()
);

create index if not exists comments_target_idx
  on public.comments (target_type, target_id, created_at);

/*
 * Enforce that a like/comment points at a row that actually exists. This is the
 * price of a polymorphic target: no FK can do it, so a trigger must.
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
  end if;
  return new;
end;
$$;

drop trigger if exists likes_assert_target on public.likes;
create trigger likes_assert_target
  before insert on public.likes
  for each row execute function public.assert_target_exists();

drop trigger if exists comments_assert_target on public.comments;
create trigger comments_assert_target
  before insert on public.comments
  for each row execute function public.assert_target_exists();

-- ---------------------------------------------------------------------------
-- lists
--
-- One table covers plain lists, the pinned four favourites, and tier lists —
-- they differ only in `kind` and whether items carry a `tier`.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.list_kind as enum ('list', 'favorites', 'tier', 'wishlist');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.lists (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles (id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 100),
  description text check (char_length(description) <= 1000),
  kind        public.list_kind not null default 'list',
  /* Ranked lists render with position numbers; unranked are just collections. */
  is_ranked   bool not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists lists_user_idx on public.lists (user_id, updated_at desc);

/*
 * Exactly one favourites list and one wishlist per user — these are singletons
 * the profile reads by kind, not user-created collections.
 */
create unique index if not exists lists_one_favorites_per_user
  on public.lists (user_id) where kind = 'favorites';
create unique index if not exists lists_one_wishlist_per_user
  on public.lists (user_id) where kind = 'wishlist';

create table if not exists public.list_items (
  list_id  uuid not null references public.lists (id) on delete cascade,
  game_id  text not null references public.games (id) on delete cascade,
  position int not null default 0,
  /* Tier lists only: 'S', 'A', 'B', 'C', 'D', 'F'. Null for normal lists. */
  tier     text check (tier is null or tier in ('S', 'A', 'B', 'C', 'D', 'F')),
  note     text check (char_length(note) <= 300),
  added_at timestamptz not null default now(),
  primary key (list_id, game_id)
);

create index if not exists list_items_order_idx on public.list_items (list_id, position);

drop trigger if exists lists_touch_updated_at on public.lists;
create trigger lists_touch_updated_at
  before update on public.lists
  for each row execute function public.touch_updated_at();

drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at
  before update on public.posts
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- notifications
--
-- Written by triggers rather than the client, so a user cannot forge one and
-- the app never has to remember to create them.
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.notification_kind as enum ('like', 'comment', 'follow', 'reply');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id          uuid primary key default gen_random_uuid(),
  /* Recipient. */
  user_id     uuid not null references public.profiles (id) on delete cascade,
  /* Who caused it. */
  actor_id    uuid not null references public.profiles (id) on delete cascade,
  kind        public.notification_kind not null,
  target_type text check (target_type in ('post', 'log')),
  target_id   uuid,
  read        bool not null default false,
  created_at  timestamptz not null default now()
);

create index if not exists notifications_user_idx
  on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx
  on public.notifications (user_id) where not read;

/** Resolve who owns a post/log, so we know whom to notify. */
create or replace function public.target_owner(p_type text, p_id uuid)
returns uuid
language plpgsql
stable
as $$
declare
  owner uuid;
begin
  if p_type = 'post' then
    select user_id into owner from public.posts where id = p_id;
  elsif p_type = 'log' then
    select user_id into owner from public.logs where id = p_id;
  end if;
  return owner;
end;
$$;

create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner uuid := public.target_owner(new.target_type, new.target_id);
begin
  -- Never notify someone about their own action.
  if owner is null or owner = new.user_id then return new; end if;

  insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
  values (owner, new.user_id, 'like', new.target_type, new.target_id);
  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert on public.likes
  for each row execute function public.notify_on_like();

create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  owner        uuid := public.target_owner(new.target_type, new.target_id);
  parent_owner uuid;
begin
  if owner is not null and owner <> new.user_id then
    insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
    values (owner, new.user_id, 'comment', new.target_type, new.target_id);
  end if;

  -- A reply also pings the parent commenter, unless that is the same person we
  -- just notified (or the replier themselves).
  if new.parent_id is not null then
    select user_id into parent_owner from public.comments where id = new.parent_id;
    if parent_owner is not null
       and parent_owner <> new.user_id
       and parent_owner is distinct from owner then
      insert into public.notifications (user_id, actor_id, kind, target_type, target_id)
      values (parent_owner, new.user_id, 'reply', new.target_type, new.target_id);
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (user_id, actor_id, kind)
  values (new.following_id, new.follower_id, 'follow');
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert on public.follows
  for each row execute function public.notify_on_follow();

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.posts         enable row level security;
alter table public.post_media    enable row level security;
alter table public.likes         enable row level security;
alter table public.comments      enable row level security;
alter table public.lists         enable row level security;
alter table public.list_items    enable row level security;
alter table public.notifications enable row level security;

-- posts: public read, owner write
drop policy if exists "posts are viewable by everyone" on public.posts;
create policy "posts are viewable by everyone" on public.posts for select using (true);

drop policy if exists "users write their own posts" on public.posts;
create policy "users write their own posts"
  on public.posts for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own posts" on public.posts;
create policy "users update their own posts"
  on public.posts for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own posts" on public.posts;
create policy "users delete their own posts"
  on public.posts for delete to authenticated using (auth.uid() = user_id);

-- post_media: readable by all, writable only by the post's author
drop policy if exists "post media is viewable by everyone" on public.post_media;
create policy "post media is viewable by everyone"
  on public.post_media for select using (true);

drop policy if exists "authors attach media" on public.post_media;
create policy "authors attach media"
  on public.post_media for insert to authenticated
  with check (exists (
    select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()
  ));

drop policy if exists "authors remove media" on public.post_media;
create policy "authors remove media"
  on public.post_media for delete to authenticated
  using (exists (
    select 1 from public.posts p where p.id = post_id and p.user_id = auth.uid()
  ));

-- likes
drop policy if exists "likes are viewable by everyone" on public.likes;
create policy "likes are viewable by everyone" on public.likes for select using (true);

drop policy if exists "users like as themselves" on public.likes;
create policy "users like as themselves"
  on public.likes for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users unlike their own" on public.likes;
create policy "users unlike their own"
  on public.likes for delete to authenticated using (auth.uid() = user_id);

-- comments
drop policy if exists "comments are viewable by everyone" on public.comments;
create policy "comments are viewable by everyone" on public.comments for select using (true);

drop policy if exists "users comment as themselves" on public.comments;
create policy "users comment as themselves"
  on public.comments for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users delete their own comments" on public.comments;
create policy "users delete their own comments"
  on public.comments for delete to authenticated using (auth.uid() = user_id);

-- lists
drop policy if exists "lists are viewable by everyone" on public.lists;
create policy "lists are viewable by everyone" on public.lists for select using (true);

drop policy if exists "users manage their own lists" on public.lists;
create policy "users manage their own lists"
  on public.lists for insert to authenticated with check (auth.uid() = user_id);

drop policy if exists "users update their own lists" on public.lists;
create policy "users update their own lists"
  on public.lists for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own lists" on public.lists;
create policy "users delete their own lists"
  on public.lists for delete to authenticated using (auth.uid() = user_id);

-- list_items: gated on owning the parent list
drop policy if exists "list items are viewable by everyone" on public.list_items;
create policy "list items are viewable by everyone"
  on public.list_items for select using (true);

drop policy if exists "owners add list items" on public.list_items;
create policy "owners add list items"
  on public.list_items for insert to authenticated
  with check (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

drop policy if exists "owners update list items" on public.list_items;
create policy "owners update list items"
  on public.list_items for update to authenticated
  using (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

drop policy if exists "owners remove list items" on public.list_items;
create policy "owners remove list items"
  on public.list_items for delete to authenticated
  using (exists (
    select 1 from public.lists l where l.id = list_id and l.user_id = auth.uid()
  ));

-- notifications: strictly private to the recipient. Note there is no INSERT
-- policy — only the SECURITY DEFINER triggers above may create these.
drop policy if exists "users read their own notifications" on public.notifications;
create policy "users read their own notifications"
  on public.notifications for select to authenticated using (auth.uid() = user_id);

drop policy if exists "users mark their own notifications" on public.notifications;
create policy "users mark their own notifications"
  on public.notifications for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own notifications" on public.notifications;
create policy "users delete their own notifications"
  on public.notifications for delete to authenticated using (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- Storage: user-uploaded avatars, banners and post media
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'media',
  'media',
  true,
  10485760, -- 10 MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

/*
 * Uploads are namespaced by user id — `media/<uid>/<file>` — so the policy can
 * check ownership from the path itself.
 */
drop policy if exists "media is publicly readable" on storage.objects;
create policy "media is publicly readable"
  on storage.objects for select using (bucket_id = 'media');

drop policy if exists "users upload to their own folder" on storage.objects;
create policy "users upload to their own folder"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users replace their own media" on storage.objects;
create policy "users replace their own media"
  on storage.objects for update to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "users delete their own media" on storage.objects;
create policy "users delete their own media"
  on storage.objects for delete to authenticated
  using (bucket_id = 'media' and (storage.foldername(name))[1] = auth.uid()::text);
