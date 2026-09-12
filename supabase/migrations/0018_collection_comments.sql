-- ---------------------------------------------------------------------------
-- 0018 — comments on collections
-- ---------------------------------------------------------------------------
--
-- 0013 gave `likes` a third target type so a collection could be liked, and
-- said this in as many words:
--
--   "Comments are deliberately *not* extended: their own CHECK still allows
--    only post and log, so this branch is unreachable from the comments trigger
--    until someone decides collections take comments."
--
-- Someone decided. A collection is a piece of curation with an argument behind
-- it — the description is where the argument goes — and an argument nobody can
-- answer is a broadcast. This is the same polymorphic shape doing the same job
-- a second time: no new table, no new column, one CHECK and the plumbing that
-- CHECK made reachable.
--
-- Three statements, and the third is the one that is easy to miss.

-- ---------------------------------------------------------------------------
-- 1. comments may point at a list
-- ---------------------------------------------------------------------------
--
-- `assert_target_exists` already grew its `list` branch in 0013, for likes. It
-- is shared by both triggers, so widening this CHECK is what makes that branch
-- reachable from `comments_assert_target` — the integrity check is already
-- written and simply starts being used. Nothing else to do there.

alter table public.comments drop constraint if exists comments_target_type_check;
alter table public.comments
  add constraint comments_target_type_check
  check (target_type in ('post', 'log', 'list'));

-- ---------------------------------------------------------------------------
-- 2. notifications may point at a list
-- ---------------------------------------------------------------------------
--
-- Without this the comment trigger below raises 23514 on the *notification*
-- insert and takes the whole comment with it, because the trigger is AFTER
-- INSERT in the same transaction. The failure would read as "you cannot comment
-- on a collection" and point at the wrong table entirely.

alter table public.notifications drop constraint if exists notifications_target_type_check;
alter table public.notifications
  add constraint notifications_target_type_check
  check (target_type in ('post', 'log', 'list'));

-- ---------------------------------------------------------------------------
-- 3. `target_owner` learns what a list is
-- ---------------------------------------------------------------------------
--
-- This one is not new work for comments — it is a **latent bug from 0013 that
-- widening the CHECK would otherwise carry forward**. `notify_on_like` and
-- `notify_on_comment` both resolve the recipient through this function, and it
-- has only ever known `post` and `log`. Since 0013 a collection has been
-- likeable, so every like on a collection has resolved `owner` to null, skipped
-- the `owner is not null` guard, and silently notified nobody. Curators have
-- not been told about a single like on their work for as long as the feature
-- has existed.
--
-- Adding the branch fixes that retroactively for likes and makes comments work
-- correctly on the first try. It is deliberately in this migration rather than
-- its own: shipping the comment CHECK without it would mean adding a second
-- silent notification hole rather than closing the first.
--
-- Still `stable` and still SECURITY INVOKER: `lists` is world-readable, so the
-- caller can see any row this returns an owner for anyway.

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
  elsif p_type = 'list' then
    select user_id into owner from public.lists where id = p_id;
  end if;
  return owner;
end;
$$;
