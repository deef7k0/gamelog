-- GameLog — linked gaming accounts (Steam first, provider-generic by design)
--
-- Steam is the first implementation of a generic "gaming account provider", not
-- a special case. Every table here is keyed by (user_id, provider) so adding
-- Xbox, PlayStation, Epic, GOG, Battle.net, Riot or Ubisoft is a CHECK-constraint
-- change plus a client-side provider implementation — no new tables.
--
-- Safe to run as a single script.
--
-- ---------------------------------------------------------------------------
-- WHY `provider` IS text + CHECK RATHER THAN AN ENUM
-- ---------------------------------------------------------------------------
-- An enum would be the obvious choice, but `alter type ... add value` cannot be
-- used in the same transaction that references the new value, which is exactly
-- what broke migrations 0006/0007 (ERROR 55P04). Since the entire point of this
-- schema is that providers get added later, an enum would guarantee that trap
-- recurs on every single future provider. text + CHECK makes adding one a
-- one-line, single-transaction change.
--
-- ---------------------------------------------------------------------------
-- WHY THE CLIENT CANNOT WRITE THESE TABLES
-- ---------------------------------------------------------------------------
-- `external_id` is a SteamID64 proven by an OpenID assertion that only the
-- server can verify. If the client could write it, anyone could claim any
-- Steam account and inherit its library, playtime and achievements — the whole
-- verification step would be decoration. So there is deliberately no INSERT or
-- UPDATE policy for `authenticated` on any table here: writes happen in the
-- `steam-auth` / `steam-sync` Edge Functions using the service role. Users may
-- SELECT (profiles are public in this app) and DELETE their own rows (unlink).

-- ---------------------------------------------------------------------------
-- 1. Provider vocabulary
-- ---------------------------------------------------------------------------
create or replace function public.gaming_providers()
returns text[]
language sql
immutable
parallel safe
as $$
  -- Keep in step with GamingProviderId in src/lib/gaming/types.ts.
  select array[
    'steam', 'xbox', 'playstation', 'epic', 'gog', 'battlenet', 'riot', 'ubisoft'
  ]::text[];
$$;

-- ---------------------------------------------------------------------------
-- 2. The linked account itself
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_accounts (
  user_id     uuid not null references public.profiles (id) on delete cascade,
  provider    text not null,
  /** SteamID64 for Steam; XUID for Xbox; whatever the provider's stable id is. */
  external_id text not null,

  handle       text,
  display_name text,
  avatar_url   text,
  profile_url  text,
  country      text,

  /** Steam level / Xbox gamerscore tier / etc. Null when the provider has none. */
  level     integer,
  /** Steam XP. Null where the concept does not exist. */
  xp        integer,

  /**
   * What the provider let us see. 'private' is a normal outcome, not an error —
   * the UI shows a "Profile is Private" state instead of failing.
   */
  visibility text not null default 'unknown'
    check (visibility in ('public', 'friends', 'private', 'unknown')),

  /** online / offline / away / busy / snooze / looking_to_trade / looking_to_play */
  status text not null default 'unknown',

  /** Denormalised so the profile header needs no join to say "playing X". */
  current_game_app_id text,
  current_game_name   text,

  linked_at      timestamptz not null default now(),
  last_synced_at timestamptz,

  primary key (user_id, provider),
  constraint gaming_accounts_provider_known
    check (provider = any (public.gaming_providers())),
  /**
   * One app user per external account. Without this, two GameLog users could
   * both claim the same Steam profile and the "friends already using this app"
   * lookup would return duplicates.
   */
  unique (provider, external_id)
);

create index if not exists gaming_accounts_external_idx
  on public.gaming_accounts (provider, external_id);

-- ---------------------------------------------------------------------------
-- 3. Owned games
--
-- Stored per user rather than shared, because playtime is per user. The game's
-- own metadata still lives in `games` — `game_id` links across when the title
-- has been cached there, so tapping a library entry opens the normal game page.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_owned_games (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  /** Steam appid, as text so non-numeric provider ids also fit. */
  app_id   text not null,

  name     text not null,
  icon_url text,

  /** Minutes, which is what Steam reports. Formatted for display client-side. */
  playtime_minutes        integer not null default 0,
  playtime_recent_minutes integer not null default 0,
  last_played_at          timestamptz,

  /**
   * Denormalised achievement rollup so the library grid can render counts for
   * 500 games without 500 joins. Null total = the game has no achievements or
   * has not been scanned yet; the two are distinguished by achievements_synced_at.
   */
  achievements_total    integer,
  achievements_unlocked integer,
  achievements_synced_at timestamptz,

  /**
   * Steam does not expose purchase dates anywhere in its Web API, so this stays
   * null for Steam. It exists because GOG and Epic do expose it, and the
   * "recently purchased" sort should light up for free when they land.
   */
  acquired_at timestamptz,

  /** Set when this title also exists in the shared `games` cache. */
  game_id text references public.games (id) on delete set null,

  synced_at timestamptz not null default now(),

  primary key (user_id, provider, app_id),
  constraint gaming_owned_games_provider_known
    check (provider = any (public.gaming_providers())),
  constraint gaming_owned_games_playtime_sane
    check (playtime_minutes >= 0 and playtime_recent_minutes >= 0)
);

-- Covers the default "most played" ordering.
create index if not exists gaming_owned_games_playtime_idx
  on public.gaming_owned_games (user_id, provider, playtime_minutes desc);

create index if not exists gaming_owned_games_recent_idx
  on public.gaming_owned_games (user_id, provider, last_played_at desc nulls last);

create index if not exists gaming_owned_games_game_idx
  on public.gaming_owned_games (game_id) where game_id is not null;

-- ---------------------------------------------------------------------------
-- 4. Achievements
--
-- One row per (user, game, achievement). Locked achievements are stored too, so
-- the UI can show "12 of 40" and render the locked ones greyed out without a
-- second call to the provider.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_achievements (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  app_id   text not null,
  /** Provider's stable key — Steam's `apiname`. */
  achievement_key text not null,

  name        text not null,
  description text,
  icon_url    text,
  icon_gray_url text,

  unlocked    boolean not null default false,
  unlocked_at timestamptz,

  /** Percentage of all owners who have it — drives "rarest achievement". */
  global_percent numeric(5,2),

  synced_at timestamptz not null default now(),

  primary key (user_id, provider, app_id, achievement_key),
  constraint gaming_achievements_provider_known
    check (provider = any (public.gaming_providers())),
  constraint gaming_achievements_percent_range
    check (global_percent is null or global_percent between 0 and 100),
  /** An unlock without a timestamp is fine; a timestamp without an unlock is not. */
  constraint gaming_achievements_unlock_consistent
    check (unlocked or unlocked_at is null)
);

create index if not exists gaming_achievements_recent_idx
  on public.gaming_achievements (user_id, provider, unlocked_at desc nulls last)
  where unlocked;

create index if not exists gaming_achievements_game_idx
  on public.gaming_achievements (user_id, provider, app_id);

-- Rarest-first showcase.
create index if not exists gaming_achievements_rarity_idx
  on public.gaming_achievements (user_id, provider, global_percent asc nulls last)
  where unlocked;

-- ---------------------------------------------------------------------------
-- 5. Inventory
--
-- Deliberately price-free. `market_hash_name` is the join key every third-party
-- pricing service keys on, so a future price provider can be added without
-- touching this table or re-syncing anything.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_inventory_items (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  app_id   text not null,
  /** Steam's asset id, unique within (app, context). */
  item_id  text not null,

  name       text not null,
  type       text,
  icon_url   text,

  /** Human-readable rarity plus the provider's own colour for it. */
  rarity       text,
  rarity_color text,

  amount     integer not null default 1,
  tradable   boolean not null default false,
  marketable boolean not null default false,

  /**
   * The canonical market identifier. Null for untradable items. This is the ONLY
   * hook a pricing integration needs — no pricing API is referenced anywhere in
   * this schema or the code, by design.
   */
  market_hash_name text,

  /** Ordering hint for "featured items" — rarity rank, then amount. */
  feature_rank integer,

  synced_at timestamptz not null default now(),

  primary key (user_id, provider, app_id, item_id),
  constraint gaming_inventory_provider_known
    check (provider = any (public.gaming_providers())),
  constraint gaming_inventory_amount_positive check (amount > 0)
);

create index if not exists gaming_inventory_featured_idx
  on public.gaming_inventory_items (user_id, provider, feature_rank asc nulls last);

create index if not exists gaming_inventory_market_idx
  on public.gaming_inventory_items (market_hash_name)
  where market_hash_name is not null;

-- ---------------------------------------------------------------------------
-- 6. Badges
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_badges (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  /** Steam badgeid, or `${badgeid}:${appid}` for game badges. */
  badge_key text not null,

  name        text,
  icon_url    text,
  level       integer,
  xp          integer,
  earned_at   timestamptz,
  /** Steam's Years of Service badge is level = years, flagged for the UI. */
  is_years_of_service boolean not null default false,

  synced_at timestamptz not null default now(),

  primary key (user_id, provider, badge_key),
  constraint gaming_badges_provider_known
    check (provider = any (public.gaming_providers()))
);

create index if not exists gaming_badges_xp_idx
  on public.gaming_badges (user_id, provider, xp desc nulls last);

-- ---------------------------------------------------------------------------
-- 7. Provider friends
--
-- The product requirement is "friends already using this app", so the useful
-- column is `matched_user_id`: the GameLog profile whose linked account has this
-- external id. Resolved at sync time by joining gaming_accounts.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_provider_friends (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  friend_external_id text not null,

  friend_handle     text,
  friend_avatar_url text,
  friends_since     timestamptz,

  /** Non-null when this Steam friend also uses GameLog. */
  matched_user_id uuid references public.profiles (id) on delete set null,

  synced_at timestamptz not null default now(),

  primary key (user_id, provider, friend_external_id),
  constraint gaming_provider_friends_provider_known
    check (provider = any (public.gaming_providers()))
);

create index if not exists gaming_provider_friends_matched_idx
  on public.gaming_provider_friends (user_id, provider)
  where matched_user_id is not null;

-- ---------------------------------------------------------------------------
-- 8. Per-section sync state
--
-- Sections sync independently: the profile is cheap and refreshed often, the
-- achievement scan is expensive (two provider calls per owned game) and resumes
-- across runs via `cursor`. Storing status here is what lets the UI show a
-- skeleton for the library while the profile is already rendered.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_sync_state (
  user_id  uuid not null references public.profiles (id) on delete cascade,
  provider text not null,
  section  text not null
    check (section in ('profile', 'library', 'achievements', 'inventory', 'badges', 'friends')),

  status text not null default 'idle'
    check (status in ('idle', 'syncing', 'ok', 'partial', 'private', 'error')),

  last_run_at    timestamptz,
  last_success_at timestamptz,
  /** Rate-limit floor: the sync service refuses to run a section before this. */
  next_run_after timestamptz,

  /** Resume point for paged/chunked sections. Opaque to the client. */
  cursor text,
  /** Consecutive failures, for exponential backoff. Reset on success. */
  attempts integer not null default 0,
  error    text,

  primary key (user_id, provider, section),
  constraint gaming_sync_state_provider_known
    check (provider = any (public.gaming_providers()))
);

-- ---------------------------------------------------------------------------
-- 9. OpenID link requests
--
-- Single-use nonces tying a Steam OpenID round trip back to the user who
-- started it. This is what keeps the user's Supabase JWT out of the redirect
-- URL that Steam echoes back.
-- ---------------------------------------------------------------------------
create table if not exists public.gaming_link_requests (
  state      text primary key,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  provider   text not null,
  /** Deep link to bounce back to once verification succeeds. */
  redirect_to text,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '15 minutes',

  constraint gaming_link_requests_provider_known
    check (provider = any (public.gaming_providers()))
);

create index if not exists gaming_link_requests_expiry_idx
  on public.gaming_link_requests (expires_at);

-- ---------------------------------------------------------------------------
-- 10. RLS
--
-- Read: public, like `profiles` and `logs` — viewing someone's profile shows
-- their gaming stats. Write: service role only (see the header note), except
-- DELETE, which is how a user unlinks.
-- ---------------------------------------------------------------------------
alter table public.gaming_accounts         enable row level security;
alter table public.gaming_owned_games      enable row level security;
alter table public.gaming_achievements     enable row level security;
alter table public.gaming_inventory_items  enable row level security;
alter table public.gaming_badges           enable row level security;
alter table public.gaming_provider_friends enable row level security;
alter table public.gaming_sync_state       enable row level security;
alter table public.gaming_link_requests    enable row level security;

-- Written out rather than generated in a DO block: policies are the only thing
-- standing between the anon key and this data, so they should be greppable.

drop policy if exists "gaming accounts are viewable by everyone" on public.gaming_accounts;
create policy "gaming accounts are viewable by everyone"
  on public.gaming_accounts for select using (true);
drop policy if exists "users unlink their own account" on public.gaming_accounts;
create policy "users unlink their own account"
  on public.gaming_accounts for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "owned games are viewable by everyone" on public.gaming_owned_games;
create policy "owned games are viewable by everyone"
  on public.gaming_owned_games for select using (true);
drop policy if exists "users clear their own owned games" on public.gaming_owned_games;
create policy "users clear their own owned games"
  on public.gaming_owned_games for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "gaming achievements are viewable by everyone" on public.gaming_achievements;
create policy "gaming achievements are viewable by everyone"
  on public.gaming_achievements for select using (true);
drop policy if exists "users clear their own gaming achievements" on public.gaming_achievements;
create policy "users clear their own gaming achievements"
  on public.gaming_achievements for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "inventory is viewable by everyone" on public.gaming_inventory_items;
create policy "inventory is viewable by everyone"
  on public.gaming_inventory_items for select using (true);
drop policy if exists "users clear their own inventory" on public.gaming_inventory_items;
create policy "users clear their own inventory"
  on public.gaming_inventory_items for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "badges are viewable by everyone" on public.gaming_badges;
create policy "badges are viewable by everyone"
  on public.gaming_badges for select using (true);
drop policy if exists "users clear their own badges" on public.gaming_badges;
create policy "users clear their own badges"
  on public.gaming_badges for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "provider friends are viewable by everyone" on public.gaming_provider_friends;
create policy "provider friends are viewable by everyone"
  on public.gaming_provider_friends for select using (true);
drop policy if exists "users clear their own provider friends" on public.gaming_provider_friends;
create policy "users clear their own provider friends"
  on public.gaming_provider_friends for delete to authenticated using (auth.uid() = user_id);

drop policy if exists "sync state is viewable by everyone" on public.gaming_sync_state;
create policy "sync state is viewable by everyone"
  on public.gaming_sync_state for select using (true);
drop policy if exists "users clear their own sync state" on public.gaming_sync_state;
create policy "users clear their own sync state"
  on public.gaming_sync_state for delete to authenticated using (auth.uid() = user_id);

-- Link requests are never readable by clients: the state nonce is a bearer
-- secret for the duration of the OpenID round trip. Only the service role in
-- `steam-auth` touches this table, so it gets no policies at all — RLS with
-- zero policies denies everything, which is exactly right here.

-- ---------------------------------------------------------------------------
-- 11. Derived rollup for the profile header
--
-- A view rather than trigger-maintained columns: these numbers are read on
-- profile open and nowhere else, and a view cannot drift out of sync with the
-- rows it summarises.
-- ---------------------------------------------------------------------------
create or replace view public.gaming_profile_stats as
select
  a.user_id,
  a.provider,
  count(distinct g.app_id)                                          as games_owned,
  coalesce(sum(g.playtime_minutes), 0)                              as total_playtime_minutes,
  coalesce(sum(g.achievements_unlocked), 0)                         as achievements_unlocked,
  coalesce(sum(g.achievements_total), 0)                            as achievements_total,
  count(distinct g.app_id) filter (
    where g.achievements_total > 0 and g.achievements_unlocked >= g.achievements_total
  )                                                                 as perfect_games,
  -- Average is over *played* games only: dividing by a 900-game library full of
  -- bundle filler would make the number meaningless.
  case
    when count(distinct g.app_id) filter (where g.playtime_minutes > 0) = 0 then 0
    else coalesce(sum(g.playtime_minutes), 0)::numeric
       / count(distinct g.app_id) filter (where g.playtime_minutes > 0)
  end                                                               as avg_playtime_minutes
from public.gaming_accounts a
left join public.gaming_owned_games g
  on g.user_id = a.user_id and g.provider = a.provider
group by a.user_id, a.provider;

comment on view public.gaming_profile_stats is
  'Per-provider rollup for the profile header. avg_playtime_minutes counts only '
  'games with playtime > 0.';

-- ---------------------------------------------------------------------------
-- 12. Link owned games to the shared `games` cache
--
-- A library sync writes up to a thousand rows; discovering which of those titles
-- already exist in `games` one lookup at a time would be a thousand round trips.
-- This does it as a single set-based update after each sync.
--
-- SECURITY DEFINER with a fixed search_path so it can be called from the sync
-- Edge Function without granting it broader table access, and cannot be tricked
-- into resolving `games` to something else.
-- ---------------------------------------------------------------------------
create or replace function public.link_gaming_owned_games(
  p_user_id uuid,
  p_provider text
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  linked integer;
begin
  if p_provider <> 'steam' then
    -- Only Steam shares an id space with `games` today (`steam:<appid>`).
    return 0;
  end if;

  update public.gaming_owned_games owned
  set game_id = g.id
  from public.games g
  where owned.user_id = p_user_id
    and owned.provider = p_provider
    and g.id = p_provider || ':' || owned.app_id
    and (owned.game_id is null or owned.game_id <> g.id);

  get diagnostics linked = row_count;
  return linked;
end $$;

revoke all on function public.link_gaming_owned_games(uuid, text) from public;
grant execute on function public.link_gaming_owned_games(uuid, text) to service_role;
