-- GameLog — physical releases, barcodes, community contributions, owned copies
--
-- Run after 0023.
--
-- ## Three things that are not the same thing
--
--   game     Resident Evil 2 — `games`, seeded from IGDB, unchanged here
--   release  Resident Evil 2, PS1, PAL, Standard — `game_releases`
--   copy     *your* PAL PS1 copy, complete in box, very good — `owned_copies`
--
-- One game has many releases; one release has many barcodes (reprints, bundles)
-- and many copies. Releases are Gamelog's own data: IGDB publishes platforms and
-- release dates but no barcodes and no editions a collector would recognise, so
-- this is the part of the catalogue the community builds.
--
-- ## Contributions are not canonical data
--
-- Nothing a user types goes straight into `game_releases` or `release_barcodes`.
-- Those tables have **no client write policies at all**. A user submits a
-- `release_contributions` row (through `submit_release_contribution`, never a
-- raw insert), and it becomes canonical one of two ways:
--
--   1. a moderator approves it (`moderate_release_contribution`), or
--   2. **two different people independently submit the same claim** — same
--      barcode, same game, platform, region and edition. Two strangers holding
--      the same box and agreeing on what it is, is the validation; it is also
--      what lets the database grow before anyone has been made a moderator.
--
-- Everything that writes canonical rows is SECURITY DEFINER and checks its
-- caller itself. `promote_release_contribution` is not callable by clients at all.
--
-- ## Barcodes are GTIN-14
--
-- UPC-A (12 digits, North America), EAN-13 (13, Europe), JAN (EAN-13 with a 45
-- or 49 prefix, Japan) and EAN-8 are all the same numbering system at different
-- lengths. Left-padded with zeros to 14 digits they become one comparable key,
-- which is what makes a UPC-A scan find a release someone entered as its EAN-13.
-- UPC-E (the 8-digit compressed UPC) is expanded to UPC-A by the client before
-- it gets here, because only the scanner knows which of the two an 8-digit code
-- was. The check digit is verified in the database as well as on the phone.
--
-- ## Moderators
--
-- A table with no client write path. Make someone a moderator in the SQL editor:
--
--   insert into public.moderators (user_id)
--   select id from public.profiles where username = 'your_username';
--
-- ## Vocabularies
--
-- text + CHECK, never enums, for the reason CLAUDE.md gives for gaming
-- providers: these are expected to grow, and `alter type … add value` cannot be
-- used in the transaction that adds it. The client's labels live in
-- `src/constants/physical.ts`; these lists and those keys must agree.

-- ---------------------------------------------------------------------------
-- Barcodes: normalising and validating
-- ---------------------------------------------------------------------------

/*
 * Digits only, left-padded to GTIN-14. Null for anything that is not 8, 12, 13
 * or 14 digits once the separators are gone — which is what the client sends a
 * hyphenated or space-grouped code as.
 */
create or replace function public.normalize_gtin(raw text)
returns text
language sql
immutable
as $$
  select case
    when length(regexp_replace(coalesce(raw, ''), '\D', '', 'g')) in (8, 12, 13, 14)
      then lpad(regexp_replace(raw, '\D', '', 'g'), 14, '0')
    else null
  end
$$;

/*
 * The GS1 mod-10 check digit, on a normalised 14-digit code.
 *
 * Weights run 3,1,3,1… from the left across the first thirteen digits, so the
 * digit immediately before the check digit always carries 3 — the rule for
 * every GTIN length once it is padded to 14. A misread scan almost always fails
 * this, which is what lets the scanner reject noise instead of looking it up.
 */
create or replace function public.gtin_is_valid(code text)
returns boolean
language plpgsql
immutable
as $$
declare
  total int := 0;
  i int;
begin
  if code is null or code !~ '^\d{14}$' then
    return false;
  end if;
  for i in 1..13 loop
    total := total + substr(code, i, 1)::int * (case when i % 2 = 1 then 3 else 1 end);
  end loop;
  return (10 - total % 10) % 10 = substr(code, 14, 1)::int;
end;
$$;

-- ---------------------------------------------------------------------------
-- Moderators
-- ---------------------------------------------------------------------------

create table if not exists public.moderators (
  user_id    uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.moderators enable row level security;

-- Who moderates is public, the way a forum's moderator list is. Nobody can add
-- themselves: there is no insert, update or delete policy.
drop policy if exists "moderators are viewable by everyone" on public.moderators;
create policy "moderators are viewable by everyone"
  on public.moderators for select using (true);

create or replace function public.is_moderator()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (select 1 from public.moderators where user_id = auth.uid())
$$;

revoke all on function public.is_moderator() from public;
grant execute on function public.is_moderator() to authenticated;

-- ---------------------------------------------------------------------------
-- Canonical releases
-- ---------------------------------------------------------------------------

create table if not exists public.game_releases (
  id             uuid primary key default gen_random_uuid(),
  game_id        text not null references public.games (id) on delete cascade,
  -- The platform's short form ("PS1"), the same vocabulary as `logs.played_on`.
  platform       text not null check (char_length(platform) between 1 and 40),
  region         text not null
                   check (region in ('ntsc_u', 'pal', 'ntsc_j', 'asia', 'region_free', 'other')),
  edition        text not null default 'Standard'
                   check (char_length(btrim(edition)) between 1 and 80),
  publisher      text check (char_length(publisher) <= 80),
  release_date   date,
  catalog_number text check (char_length(catalog_number) <= 40),
  created_at     timestamptz not null default now()
);

-- One canonical row per game/platform/region/edition, whatever the case of the
-- edition name. A second barcode for the same box (a reprint) attaches to the
-- existing release instead of creating a twin.
create unique index if not exists game_releases_identity_idx
  on public.game_releases (game_id, platform, region, lower(btrim(edition)));

create index if not exists game_releases_game_idx on public.game_releases (game_id);

-- ---------------------------------------------------------------------------
-- Contributions — what users submit
-- ---------------------------------------------------------------------------

create table if not exists public.release_contributions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles (id) on delete cascade,
  barcode        text not null check (public.gtin_is_valid(barcode)),
  game_id        text not null references public.games (id) on delete cascade,
  platform       text not null check (char_length(platform) between 1 and 40),
  region         text not null
                   check (region in ('ntsc_u', 'pal', 'ntsc_j', 'asia', 'region_free', 'other')),
  edition        text not null default 'Standard'
                   check (char_length(btrim(edition)) between 1 and 80),
  publisher      text check (char_length(publisher) <= 80),
  release_date   date,
  catalog_number text check (char_length(catalog_number) <= 40),
  notes          text check (char_length(notes) <= 500),
  -- pending → approved (it is canonical now), rejected (a moderator said no), or
  -- superseded (another claim about the same barcode became canonical first).
  status         text not null default 'pending'
                   check (status in ('pending', 'approved', 'rejected', 'superseded')),
  release_id     uuid references public.game_releases (id) on delete set null,
  reviewed_by    uuid references public.profiles (id) on delete set null,
  reviewed_at    timestamptz,
  review_note    text check (char_length(review_note) <= 300),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- One open claim per person per barcode. A second submission is an edit.
create unique index if not exists release_contributions_one_pending_idx
  on public.release_contributions (user_id, barcode)
  where status = 'pending';

create index if not exists release_contributions_barcode_idx
  on public.release_contributions (barcode, status);

create index if not exists release_contributions_queue_idx
  on public.release_contributions (created_at)
  where status = 'pending';

drop trigger if exists release_contributions_touch_updated_at on public.release_contributions;
create trigger release_contributions_touch_updated_at
  before update on public.release_contributions
  for each row execute function public.touch_updated_at();

create table if not exists public.release_contribution_photos (
  id              uuid primary key default gen_random_uuid(),
  contribution_id uuid not null references public.release_contributions (id) on delete cascade,
  kind            text not null
                    check (kind in ('front', 'back', 'barcode', 'media', 'manual', 'markings', 'other')),
  -- A public URL in the `media` bucket. Never the image itself.
  url             text not null check (url ~ '^https://' and char_length(url) <= 1000),
  created_at      timestamptz not null default now()
);

create index if not exists release_contribution_photos_idx
  on public.release_contribution_photos (contribution_id);

-- ---------------------------------------------------------------------------
-- Canonical barcodes and images
-- ---------------------------------------------------------------------------

create table if not exists public.release_barcodes (
  -- One barcode, one release: the primary key is the duplicate detection.
  barcode         text primary key check (public.gtin_is_valid(barcode)),
  release_id      uuid not null references public.game_releases (id) on delete cascade,
  contribution_id uuid references public.release_contributions (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists release_barcodes_release_idx on public.release_barcodes (release_id);

create table if not exists public.release_images (
  id              uuid primary key default gen_random_uuid(),
  release_id      uuid not null references public.game_releases (id) on delete cascade,
  kind            text not null
                    check (kind in ('front', 'back', 'barcode', 'media', 'manual', 'markings', 'other')),
  url             text not null check (url ~ '^https://' and char_length(url) <= 1000),
  contribution_id uuid references public.release_contributions (id) on delete set null,
  created_at      timestamptz not null default now()
);

create index if not exists release_images_release_idx on public.release_images (release_id);

-- ---------------------------------------------------------------------------
-- Owned copies — the user's physical collection
--
-- Named "copies" rather than "collection" because in this app a collection is a
-- curated list (`lists`), and "Add to collection" already means that.
--
-- Completeness and condition are independent columns because they are
-- independent facts: complete-in-box and battered is not loose and mint.
-- Neither carries a price, and nothing here ever will.
-- ---------------------------------------------------------------------------

create table if not exists public.owned_copies (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles (id) on delete cascade,
  game_id         text not null references public.games (id) on delete cascade,
  -- The specific release, when it is known. When it is not — the barcode is
  -- still pending, or the copy was added by hand — the copy describes itself
  -- with the three columns below, and gains a release when one is approved.
  release_id      uuid references public.game_releases (id) on delete set null,
  contribution_id uuid references public.release_contributions (id) on delete set null,
  ownership       text not null default 'physical' check (ownership in ('physical', 'digital')),
  platform        text check (char_length(platform) between 1 and 40),
  region          text check (region is null
                    or region in ('ntsc_u', 'pal', 'ntsc_j', 'asia', 'region_free', 'other')),
  edition         text check (char_length(edition) <= 80),
  completeness    text check (completeness is null or completeness in
                    ('sealed', 'cib_inserts', 'cib', 'game_manual', 'game_box', 'loose', 'other')),
  condition       text check (condition is null or condition in
                    ('mint', 'near_mint', 'excellent', 'very_good', 'good', 'fair', 'poor')),
  notes           text check (char_length(notes) <= 500),
  acquired_on     text check (acquired_on ~ '^\d{4}(-\d{2}(-\d{2})?)?$'),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists owned_copies_user_idx on public.owned_copies (user_id, created_at desc);
create index if not exists owned_copies_game_idx on public.owned_copies (game_id);
create index if not exists owned_copies_waiting_idx
  on public.owned_copies (contribution_id)
  where release_id is null and contribution_id is not null;

drop trigger if exists owned_copies_touch_updated_at on public.owned_copies;
create trigger owned_copies_touch_updated_at
  before update on public.owned_copies
  for each row execute function public.touch_updated_at();

/*
 * A copy with a release takes the release's description.
 *
 * The release is the authority on what the box is; the copy's own platform,
 * region and edition columns exist for the copies that have no release yet. So
 * whenever a release is attached — by the user, or by an approval linking a copy
 * that was waiting on its barcode — the copy is overwritten from it, and the
 * quick view can always read one row without asking which source is current.
 */
create or replace function public.sync_owned_copy_release()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  r public.game_releases;
begin
  if new.release_id is not null then
    select * into r from public.game_releases where id = new.release_id;
    if found then
      new.game_id  := r.game_id;
      new.platform := r.platform;
      new.region   := r.region;
      new.edition  := r.edition;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists owned_copies_sync_release on public.owned_copies;
create trigger owned_copies_sync_release
  before insert or update of release_id, game_id, platform, region, edition
  on public.owned_copies
  for each row execute function public.sync_owned_copy_release();

-- ---------------------------------------------------------------------------
-- Promotion: a contribution becomes canonical
-- ---------------------------------------------------------------------------

/*
 * Make a pending contribution canonical, and settle every other open claim about
 * the same barcode in the same statement.
 *
 * Internal: revoked from every client role below. The only ways in are the
 * consensus check and the moderator RPC, both of which check their caller.
 *
 * If the barcode became canonical while this sat in the queue, nothing new is
 * created — the claims that agree with the existing release are approved into
 * it, and the ones that do not are superseded.
 */
create or replace function public.promote_release_contribution(
  p_contribution uuid,
  p_reviewer uuid
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.release_contributions;
  target   uuid;
  r        public.game_releases;
begin
  select * into c
    from public.release_contributions
   where id = p_contribution
     for update;

  if not found then
    raise exception 'Contribution not found.' using errcode = 'P0002';
  end if;
  if c.status <> 'pending' then
    raise exception 'This contribution is already %.', c.status using errcode = '22023';
  end if;

  select release_id into target from public.release_barcodes where barcode = c.barcode;

  if target is null then
    select id into target
      from public.game_releases
     where game_id = c.game_id
       and platform = c.platform
       and region = c.region
       and lower(btrim(edition)) = lower(btrim(c.edition));

    if target is null then
      insert into public.game_releases
        (game_id, platform, region, edition, publisher, release_date, catalog_number)
      values
        (c.game_id, c.platform, c.region, btrim(c.edition), c.publisher, c.release_date,
         c.catalog_number)
      returning id into target;
    end if;

    insert into public.release_barcodes (barcode, release_id, contribution_id)
    values (c.barcode, target, c.id);
  end if;

  select * into r from public.game_releases where id = target;

  -- The evidence travels with *every* agreeing claim, not just the one that
  -- tipped the count. Consensus is usually reached by a confirmation, which
  -- carries no photos of its own — copying only that row's would throw away
  -- the first contributor's pictures at the exact moment they were vindicated.
  -- References only: the files stay where their contributors uploaded them.
  insert into public.release_images (release_id, kind, url, contribution_id)
  select target, p.kind, p.url, rc.id
    from public.release_contributions rc
    join public.release_contribution_photos p on p.contribution_id = rc.id
   where rc.barcode = c.barcode
     and rc.status = 'pending'
     and rc.game_id = r.game_id
     and rc.platform = r.platform
     and rc.region = r.region
     and lower(btrim(rc.edition)) = lower(btrim(r.edition));

  update public.release_contributions rc
     set status = case
           when rc.game_id = r.game_id
            and rc.platform = r.platform
            and rc.region = r.region
            and lower(btrim(rc.edition)) = lower(btrim(r.edition))
           then 'approved'
           else 'superseded'
         end,
         release_id  = target,
         reviewed_by = p_reviewer,
         reviewed_at = now()
   where rc.barcode = c.barcode
     and rc.status = 'pending';

  -- Copies added while their barcode was still pending gain the release now.
  -- `sync_owned_copy_release` fills in the platform, region and edition.
  update public.owned_copies oc
     set release_id = target
   where oc.release_id is null
     and oc.contribution_id in (
       select id
         from public.release_contributions
        where barcode = c.barcode
          and status = 'approved'
     );

  return target;
end;
$$;

revoke all on function public.promote_release_contribution(uuid, uuid) from public, anon, authenticated;

/*
 * How many different people must agree before a claim becomes canonical
 * without a moderator. Two: one person can be wrong about their own box, two
 * strangers independently scanning the same barcode and describing it the same
 * way almost never are.
 */
create or replace function public.release_consensus_threshold()
returns int
language sql
immutable
as $$ select 2 $$;

/*
 * Promote a contribution if enough independent people now agree with it.
 * Returns the release id when it promoted, null when the claim stays pending.
 */
create or replace function public.settle_release_consensus(p_contribution uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  c        public.release_contributions;
  agreeing int;
begin
  select * into c from public.release_contributions where id = p_contribution;
  if not found or c.status <> 'pending' then
    return null;
  end if;

  select count(distinct user_id) into agreeing
    from public.release_contributions
   where barcode = c.barcode
     and status = 'pending'
     and game_id = c.game_id
     and platform = c.platform
     and region = c.region
     and lower(btrim(edition)) = lower(btrim(c.edition));

  if agreeing >= public.release_consensus_threshold() then
    return public.promote_release_contribution(c.id, null);
  end if;

  return null;
end;
$$;

revoke all on function public.settle_release_consensus(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Client RPCs
-- ---------------------------------------------------------------------------

/*
 * Submit a release for a barcode.
 *
 * Returns one of:
 *   { status: 'exists',    release_id }       the barcode is already canonical
 *   { status: 'duplicate', contribution_id }  you already have a pending claim
 *   { status: 'pending',   contribution_id }  queued
 *   { status: 'approved',  contribution_id, release_id }
 *                                             it agreed with someone else's and
 *                                             is canonical now
 *
 * Photos arrive in the same call, as `[{ kind, url }]`, so they are attached
 * before the consensus check can promote the claim — uploaded after, they would
 * miss the copy into `release_images`. Each URL must be a public object in the
 * caller's own `releases` folder of the `media` bucket: evidence you uploaded,
 * not a link to anything on the internet.
 *
 * Rate limited to 25 submissions a day and 100 open claims per person.
 */
create or replace function public.submit_release_contribution(
  p_barcode        text,
  p_game_id        text,
  p_platform       text,
  p_region         text,
  p_edition        text default 'Standard',
  p_publisher      text default null,
  p_release_date   date default null,
  p_catalog_number text default null,
  p_notes          text default null,
  p_photos         jsonb default '[]'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  code     text := public.normalize_gtin(p_barcode);
  existing uuid;
  mine     uuid;
  today    int;
  open     int;
  new_id   uuid;
  promoted uuid;
  photo    jsonb;
begin
  if uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  if code is null or not public.gtin_is_valid(code) then
    raise exception 'That is not a valid game barcode.' using errcode = '22023';
  end if;

  select release_id into existing from public.release_barcodes where barcode = code;
  if existing is not null then
    return jsonb_build_object('status', 'exists', 'release_id', existing);
  end if;

  select id into mine
    from public.release_contributions
   where user_id = uid and barcode = code and status = 'pending';
  if mine is not null then
    return jsonb_build_object('status', 'duplicate', 'contribution_id', mine);
  end if;

  select count(*) into today
    from public.release_contributions
   where user_id = uid and created_at > now() - interval '1 day';
  if today >= 25 then
    raise exception 'You have submitted a lot of releases today. Try again tomorrow.'
      using errcode = '54000';
  end if;

  select count(*) into open
    from public.release_contributions
   where user_id = uid and status = 'pending';
  if open >= 100 then
    raise exception 'You have 100 releases waiting for review. Wait for some to be approved first.'
      using errcode = '54000';
  end if;

  if jsonb_typeof(coalesce(p_photos, '[]'::jsonb)) <> 'array'
     or jsonb_array_length(coalesce(p_photos, '[]'::jsonb)) > 8 then
    raise exception 'Attach up to eight photos.' using errcode = '22023';
  end if;

  for photo in select * from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) loop
    if (photo ->> 'url') !~ ('^https://[^/]+/storage/v1/object/public/media/' || uid::text || '/releases/') then
      raise exception 'Photos must be uploaded from this app.' using errcode = '22023';
    end if;
  end loop;

  insert into public.release_contributions
    (user_id, barcode, game_id, platform, region, edition, publisher, release_date,
     catalog_number, notes)
  values
    (uid, code, p_game_id, btrim(p_platform), p_region,
     coalesce(nullif(btrim(p_edition), ''), 'Standard'),
     nullif(btrim(p_publisher), ''), p_release_date,
     nullif(btrim(p_catalog_number), ''), nullif(btrim(p_notes), ''))
  returning id into new_id;

  insert into public.release_contribution_photos (contribution_id, kind, url)
  select new_id, coalesce(p ->> 'kind', 'other'), p ->> 'url'
    from jsonb_array_elements(coalesce(p_photos, '[]'::jsonb)) p;

  promoted := public.settle_release_consensus(new_id);

  return jsonb_build_object(
    'status', case when promoted is null then 'pending' else 'approved' end,
    'contribution_id', new_id,
    'release_id', promoted
  );
end;
$$;

revoke all on function public.submit_release_contribution(
  text, text, text, text, text, text, date, text, text, jsonb
) from public, anon;
grant execute on function public.submit_release_contribution(
  text, text, text, text, text, text, date, text, text, jsonb
) to authenticated;

/*
 * Edit your own pending claim. The barcode is the one thing you cannot change —
 * a different barcode is a different claim. An edit can bring the claim into
 * agreement with someone else's, so consensus is checked again after it.
 */
create or replace function public.update_release_contribution(
  p_id             uuid,
  p_game_id        text,
  p_platform       text,
  p_region         text,
  p_edition        text default 'Standard',
  p_publisher      text default null,
  p_release_date   date default null,
  p_catalog_number text default null,
  p_notes          text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid      uuid := auth.uid();
  promoted uuid;
begin
  if uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  update public.release_contributions
     set game_id        = p_game_id,
         platform       = btrim(p_platform),
         region         = p_region,
         edition        = coalesce(nullif(btrim(p_edition), ''), 'Standard'),
         publisher      = nullif(btrim(p_publisher), ''),
         release_date   = p_release_date,
         catalog_number = nullif(btrim(p_catalog_number), ''),
         notes          = nullif(btrim(p_notes), '')
   where id = p_id
     and user_id = uid
     and status = 'pending';

  if not found then
    raise exception 'Only your own pending submissions can be edited.' using errcode = '42501';
  end if;

  promoted := public.settle_release_consensus(p_id);

  return jsonb_build_object(
    'status', case when promoted is null then 'pending' else 'approved' end,
    'contribution_id', p_id,
    'release_id', promoted
  );
end;
$$;

revoke all on function public.update_release_contribution(
  uuid, text, text, text, text, text, date, text, text
) from public, anon;
grant execute on function public.update_release_contribution(
  uuid, text, text, text, text, text, date, text, text
) to authenticated;

/*
 * "This matches my copy" — second someone else's pending claim.
 *
 * A confirmation is the confirmer's own contribution with the same details, not
 * a counter on the original, so each person's claim stays an attributable row
 * and consensus is the same count of distinct people it always is.
 */
create or replace function public.confirm_release_contribution(p_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  c   public.release_contributions;
begin
  if uid is null then
    raise exception 'You must be signed in.' using errcode = '42501';
  end if;

  select * into c from public.release_contributions where id = p_id;
  if not found or c.status <> 'pending' then
    raise exception 'That submission is no longer waiting for confirmation.' using errcode = '22023';
  end if;
  if c.user_id = uid then
    raise exception 'You cannot confirm your own submission.' using errcode = '22023';
  end if;

  return public.submit_release_contribution(
    c.barcode, c.game_id, c.platform, c.region, c.edition, c.publisher, c.release_date,
    c.catalog_number, null, '[]'::jsonb
  );
end;
$$;

revoke all on function public.confirm_release_contribution(uuid) from public, anon;
grant execute on function public.confirm_release_contribution(uuid) to authenticated;

/*
 * Approve or reject a pending contribution. Moderators only — checked here,
 * because SECURITY DEFINER bypasses every policy on the tables it writes.
 */
create or replace function public.moderate_release_contribution(
  p_id       uuid,
  p_decision text,
  p_note     text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  release uuid;
begin
  if not public.is_moderator() then
    raise exception 'Only moderators can review submissions.' using errcode = '42501';
  end if;

  if p_decision = 'approve' then
    release := public.promote_release_contribution(p_id, auth.uid());
    if p_note is not null then
      update public.release_contributions set review_note = left(p_note, 300) where id = p_id;
    end if;
    return jsonb_build_object('status', 'approved', 'release_id', release);
  end if;

  if p_decision = 'reject' then
    update public.release_contributions
       set status      = 'rejected',
           reviewed_by = auth.uid(),
           reviewed_at = now(),
           review_note = left(p_note, 300)
     where id = p_id
       and status = 'pending';
    if not found then
      raise exception 'That submission is no longer pending.' using errcode = '22023';
    end if;
    return jsonb_build_object('status', 'rejected');
  end if;

  raise exception 'Decision must be approve or reject.' using errcode = '22023';
end;
$$;

revoke all on function public.moderate_release_contribution(uuid, text, text) from public, anon;
grant execute on function public.moderate_release_contribution(uuid, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.game_releases               enable row level security;
alter table public.release_barcodes            enable row level security;
alter table public.release_images              enable row level security;
alter table public.release_contributions       enable row level security;
alter table public.release_contribution_photos enable row level security;
alter table public.owned_copies                enable row level security;

-- Canonical data: readable by everyone, writable by nobody from the client.
drop policy if exists "releases are viewable by everyone" on public.game_releases;
create policy "releases are viewable by everyone"
  on public.game_releases for select using (true);

drop policy if exists "barcodes are viewable by everyone" on public.release_barcodes;
create policy "barcodes are viewable by everyone"
  on public.release_barcodes for select using (true);

drop policy if exists "release images are viewable by everyone" on public.release_images;
create policy "release images are viewable by everyone"
  on public.release_images for select using (true);

-- Contributions are public so a pending claim can be confirmed by the next
-- person to scan the same box. Written only through the RPCs above; withdrawing
-- your own pending claim is the one direct write.
drop policy if exists "contributions are viewable by everyone" on public.release_contributions;
create policy "contributions are viewable by everyone"
  on public.release_contributions for select using (true);

drop policy if exists "users withdraw their pending contributions" on public.release_contributions;
create policy "users withdraw their pending contributions"
  on public.release_contributions for delete to authenticated
  using (auth.uid() = user_id and status = 'pending');

drop policy if exists "contribution photos are viewable by everyone" on public.release_contribution_photos;
create policy "contribution photos are viewable by everyone"
  on public.release_contribution_photos for select using (true);

-- Evidence can be added to or removed from your own claim while it is pending.
drop policy if exists "users add photos to their pending contributions" on public.release_contribution_photos;
create policy "users add photos to their pending contributions"
  on public.release_contribution_photos for insert to authenticated
  with check (
    exists (
      select 1 from public.release_contributions c
       where c.id = contribution_id
         and c.user_id = auth.uid()
         and c.status = 'pending'
    )
  );

drop policy if exists "users remove photos from their pending contributions" on public.release_contribution_photos;
create policy "users remove photos from their pending contributions"
  on public.release_contribution_photos for delete to authenticated
  using (
    exists (
      select 1 from public.release_contributions c
       where c.id = contribution_id
         and c.user_id = auth.uid()
         and c.status = 'pending'
    )
  );

-- Copies: the same shape as `logs` — public to read, owner to write.
drop policy if exists "copies are viewable by everyone" on public.owned_copies;
create policy "copies are viewable by everyone"
  on public.owned_copies for select using (true);

drop policy if exists "users add their own copies" on public.owned_copies;
create policy "users add their own copies"
  on public.owned_copies for insert to authenticated
  with check (auth.uid() = user_id);

drop policy if exists "users update their own copies" on public.owned_copies;
create policy "users update their own copies"
  on public.owned_copies for update to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "users delete their own copies" on public.owned_copies;
create policy "users delete their own copies"
  on public.owned_copies for delete to authenticated
  using (auth.uid() = user_id);
