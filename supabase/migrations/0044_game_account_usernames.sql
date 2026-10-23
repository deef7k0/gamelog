-- GameLog — PlayStation, Xbox and GOG linked by username, as RAWG does
--
-- Safe to run on its own and more than once; nothing is dropped, no enum value
-- is added. Run after 0009.
--
-- ## What RAWG does, and what this follows
--
-- RAWG's web app (read from its shipped bundle, 2026-10-22) asks for a public
-- identifier per service — a PSN Online ID, an Xbox gamertag, a GOG username —
-- and saves it to the user (`PATCH /api/users/current`); its server imports the
-- games and reports a status per account: process, ready, error, private-user,
-- private-games, unavailable. It never asks for a password and never verifies
-- the account is the person's own. The `game-accounts` Edge Function does the
-- same against the same public data.
--
-- ## Decisions worth stating
--
-- 1. AN ACCOUNT LINKED BY USERNAME SAYS SO.
--    `gaming_accounts.linked_by` is `sign-in` (Steam's OpenID: the person
--    proved it is theirs) or `username` (they typed a public name). 0009's
--    `unique (provider, external_id)` still holds, so a name already linked to
--    another GameLog account is refused rather than shared — which also means a
--    name claimed first by somebody else blocks its owner until they unlink.
--    That is RAWG's model's weakness, kept on purpose: the alternative is
--    signing in to Sony and Microsoft, which neither offers third parties.
--
-- 2. THE APP'S OWN SERVICE TOKENS ARE KEPT, NOT RE-ISSUED.
--    PlayStation's trophy API answers only a signed-in caller. The function
--    signs in once with the project's own PSN account (an NPSSO cookie, a
--    secret) and keeps the access and refresh tokens here, so every import does
--    not log in again. One row per service; service role only, as
--    `soundcloud_tokens` (0036).

alter table public.gaming_accounts
  add column if not exists linked_by text not null default 'sign-in'
    check (linked_by in ('sign-in', 'username'));

comment on column public.gaming_accounts.linked_by is
  'sign-in: the person proved the account is theirs (Steam OpenID). username: '
  'they typed a public name and its public data was imported (PSN, Xbox, GOG).';

create table if not exists public.gaming_service_tokens (
  service       text primary key check (service in ('playstation')),
  access_token  text not null,
  refresh_token text,
  expires_at    timestamptz not null,
  refresh_expires_at timestamptz,
  updated_at    timestamptz not null default now()
);

alter table public.gaming_service_tokens enable row level security;
revoke all on public.gaming_service_tokens from anon, authenticated;

comment on table public.gaming_service_tokens is
  'The app''s own sign-in to a service it imports public data from (PSN). '
  'Service role only: no policies, no grants.';
