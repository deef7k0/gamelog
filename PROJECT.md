# GameLog

A "Letterboxd for videogames" — track what you play, rate and review it, and see
what the people you follow are playing.

Solo project, one semester, React Native + Expo.

---

## ⚠️ Where this actually stands

**Everything below "The social layer" has been written but never executed.** It
typechecks, lints and bundles clean (`npx expo export` verified each time), but
no migration past `0005` is confirmed applied, the Steam Edge Functions have
never been deployed, and none of it has been exercised on a device.

The next working session is **execution and repair**, not new features.

### 1. Migrations — run in the Supabase SQL editor, in order

| File | Status |
|---|---|
| `0001` – `0005` | Applied |
| `0006_add_article_kind` | **Unconfirmed** — must run *alone*, before 0007 |
| `0007_events_and_articles` | **Unconfirmed** |
| `0008_review_metrics` | **Unconfirmed** |
| `0009_gaming_accounts` | **Outstanding** |
| `0010_collection_tags` | **Outstanding** |
| `0011_diary` | **Outstanding** |

`0006` must be a **separate execution** from `0007`. Postgres refuses to let a
new enum value be *used* in the transaction that added it, and 0007's CHECK
constraints compare `kind` against `'article'`. That is the `ERROR: 55P04` you
already hit once.

### 2. Edge Functions — none of the new ones are deployed

```bash
supabase secrets set STEAM_API_KEY=…          # you do not have a key yet
supabase functions deploy igdb        --project-ref uhlbjqbgmcvyhimatatj --use-api
supabase functions deploy steam-sync  --project-ref uhlbjqbgmcvyhimatatj --use-api
supabase functions deploy steam-auth  --project-ref uhlbjqbgmcvyhimatatj --use-api --no-verify-jwt
```

- **`igdb` redeploy** unlocks the News *Events* tab (`events`), the game Overview
  *Cast* section (`characters`) and the real Top 10 ranking
  (`popularity_primitives`). The first two are silently empty until then; the
  Top 10 falls back to the most-rated releases of the past year and says so in
  its footnote.
- **`steam-auth` needs `--no-verify-jwt`** — Steam's OpenID return is a browser
  redirect with no Authorization header, so the gateway would reject it. Each leg
  authenticates itself instead (Bearer token to start, single-use nonce to
  return). See [`supabase/functions/README.md`](supabase/functions/README.md).
- Without these, the entire Steam section of a profile is inert.

### 3. Do not put the Steam key in `.env`

`EXPO_PUBLIC_STEAM_API_KEY` exists in `.env` but is **empty**, so nothing is
leaking today. It is a trap: `EXPO_PUBLIC_*` is inlined into the bundle at build
time, and an APK can be unzipped. The Steam Web API key belongs **only** in
`supabase secrets set`.

Get one at <https://steamcommunity.com/dev/apikey> (needs an account that has
spent $5; any domain value is accepted).

That `.env` line and the dead code path reading it in
[`src/lib/games/steam.ts`](src/lib/games/steam.ts) should both be deleted — the
server-side sync supersedes them.

### 4. Expect these to break first

Reasoned-through, never run:

- **SQL** — the two IMMUTABLE-function CHECKs (`is_valid_review_metrics`,
  `is_valid_collection_tags`) and the `link_gaming_owned_games` RPC. No Postgres
  was available to parse them.
- **Edge Functions** — never typechecked; Deno is not installed locally. The
  OpenID round trip in particular can only be tested deployed.
- **PostgREST embed hints** — e.g.
  `profiles!gaming_provider_friends_matched_user_id_fkey` assumes Postgres
  auto-named that foreign key exactly as expected.

---

## Status

**Core** — auth; game search (IGDB only — see below); game detail
with hero art, physical `<GameCase />`, synopsis, screenshots; logging with
status, score, completion %, platinum, hours, played-on; per-game achievements
with Steam sync; profile with banner, bio, follow counts and stats; feed with
Following / Everyone scopes.

**Social** — posts with media carousels; likes and comments (one level of
threaded replies) over a polymorphic target; trigger-generated notifications;
collections, ranked lists and tier lists; favourites; wishlist; friends
(ordered-pair, consent-based) and profile **walls** with derived activity.

**Long-form** — reviews are 0–100 scored magazine articles with verdict bands,
plus **advanced review metrics** (14 categories, score averaged from the ones you
fill in). **Articles** are a second post type with tags and spoiler blurring.

**News** — Discover (default) with a Top 10 This Month widget and "because you
played…" recommendation rails; X-style news feed; trailers, releases, the IGDB
popularity chart, industry events with RSVP and local reminders; soundtracks with
30s previews.

**Linked accounts** — Steam via OpenID, as one implementation of a generic
provider (see below). Library, achievements, inventory, badges, friends.

**Diary** — per-game dated notes, surfaced on the wall and reachable from a game
page, a library cover, or a wall row.

---

## Getting started

```bash
cp .env.example .env      # Supabase URL + anon key
npm install
npm start                 # scan the QR with Expo Go
```

Then run **every** migration in `supabase/migrations/` in order — see the table
above, and note that `0006` runs alone. Until they are applied there are no
tables and every query fails.

Test on a **phone or emulator**, not the browser — see the Steam/CORS note below.

Node is a portable install at `~/.local/node-v24.18.0-linux-x64/bin`, already on
PATH via `~/.profile`. SDK 57 needs Node ≥ 22.13.

---

## Platform coverage: the honest version

The original concept named Steam, Epic, PlayStation, Xbox, itch.io and Roblox.
After checking each against what a solo developer can actually integrate:

| Platform | Public API? | Status |
|---|---|---|
| **IGDB** | Yes — Twitch OAuth, needs a `client_secret` | **The catalogue.** Live via Edge Function; the only source with true portrait box art |
| **Steam** | Yes — undocumented but keyless store endpoints | Id lookup only. Still resolves legacy `steam:` rows and library matches; no longer searched |
| **RAWG** | Yes — one free query-param key | Retired from search. Code retained for id lookup |
| **itch.io** | Only with a personal API key | Retired from search. Code retained for id lookup |
| Epic Games | No public catalog API | Not viable |
| PlayStation | No public third-party API | Not viable |
| Xbox | Restrictive partner access only | Not viable |
| Roblox | APIs exist, but "experiences" are a different data shape | Out of scope |

Each was verified against the live API, not assumed.

### Why one catalogue and not four

Fanning search across every provider was the original design, and it was wrong.
The same game came back two or three times with different art, different release
years and a *different id per screen*, because whichever provider answered first
decided what you logged. Title+year dedupe hid some of it and could not fix the
rest: log Hades from a Steam result and from an IGDB result and you have two
games. On top of that only IGDB publishes portrait box art, which the entire
poster-led UI is built on, and only IGDB has franchises, studios and characters.

So IGDB is the catalogue and the others are read-only. `getGameById()` still
resolves `steam:` / `rawg:` / `itch:` ids so nothing already logged turns into a
dead page, but nothing can create one.

The cost, stated plainly: achievements. IGDB has none, so games added from now on
have no achievement list — only legacy Steam rows and linked-library matches do.
Consistent identity was worth more than a feature two of the four sources never
had either.

### Things the APIs genuinely do not provide

Worth recording so they are not re-attempted:

- **Steam has no purchase dates.** Nothing in the Web API exposes when a game was
  bought or added. `gaming_owned_games.acquired_at` exists for providers that do
  (GOG, Epic) and stays null for Steam — which is why the library *hides* the
  "recently purchased" sort rather than faking it from last-played.
- **Steam has no badge names or icons.** `GetBadges` returns ids, levels, XP and
  timestamps only.
- **IGDB has no cast or credits.** v4 has a `characters` endpoint (name,
  portrait, description) but zero actor data; the `credits` endpoint from v2/v3
  was removed and never replaced. `GameCharacter.actor` is always null, and the
  Cast rail already renders a second line if a provider ever fills it.
  **GiantBomb** has a `people` resource and is the obvious candidate — but its
  API sits behind Cloudflare's bot challenge, and its per-game credit list has no
  character mapping either.
- **PSN has no public trophy API.** `logs.platinum` is a self-reported boolean.

### Two Steam caveats

Both now only apply to id lookups of pre-existing rows, not to search:

1. **No CORS headers** → those lookups fail in `npm run web`, work on native.
2. **Rate limited** (~200 req / 5 min per IP) on the detail endpoint. Mitigated
   by an in-module cache plus TanStack Query.

---

## Architecture

External game metadata and internal social data are deliberately separate:

```
IGDB (via Edge Function)    ──►  src/lib/games/   ──┐
Steam account data          ──►  Edge Functions   ──┤──►  screens
Supabase (Postgres + Auth)  ──►  src/lib/api/     ──┘
```

They meet at the `games` table. When someone logs a game, its metadata is copied
into Postgres — so a 50-item feed is one query, not 50 calls to IGDB.

### Data model

```
profiles              username, display_name, avatar_url, banner_url, bio, steam_id
games                 id ('igdb:1029'), source, title, cover_url, hero_url, …
logs                  status, rating (0-100), review, review_metrics (jsonb),
                      completion_percent, platinum, hours_played, played_on
follows               follower_id, following_id
friendships           ordered pair (user_a < user_b), status, requested_by
wall_posts            wall_owner_id, author_id, body
posts                 kind ('post' | 'article' | …), title, tags[], has_spoilers
post_media            url, kind, position
likes / comments      polymorphic over (target_type, target_id)
lists / list_items    kind ('list'|'favorites'|'tier'|'wishlist'), tags[], tier
notifications         trigger-written only; no client INSERT policy
events / event_attendance
game_achievements / user_achievements
gaming_*              linked accounts — see below
diary_entries         user_id, game_id, body, entry_date
```

Ratings are stored as an integer **0–100**; `constants/score.ts` maps that to a
verdict band ("Excellent", "Mixed") and a colour. `logs.rating` is the **only**
score anything reads — when a reviewer uses advanced metrics, the client writes
their mean into `rating` at the same time.

### Linked gaming accounts

Steam is one implementation of a **generic provider**, not a special case.
Adding Xbox/PlayStation/Epic/GOG is three steps: add the id to
`GAMING_PROVIDER_IDS` *and* `gaming_providers()` in migration 0009, implement
`GamingAccountProvider`, register it in `lib/gaming/registry.ts`. No screen gains
a conditional — the UI renders from `provider.capabilities`.

Two deliberate choices:

- **`provider` is `text` + CHECK, not an enum.** `alter type … add value` cannot
  be used in the same transaction that references the new value — the 55P04 trap
  that split 0006/0007. An enum would guarantee it recurs on every future
  provider.
- **The client cannot write any `gaming_*` table.** `external_id` is only
  trustworthy because `steam-auth` verified an OpenID assertion for it, so writes
  happen in Edge Functions with the service role. Clients SELECT and DELETE only.

No pricing API is referenced anywhere. Inventory carries `market_hash_name` — the
join key every price service uses — and nothing else.

### Security

Row Level Security is the *only* thing protecting the database — the anon key
ships in the bundle and is powerless without it. Everything is world-readable
(the app is public by design, like Letterboxd) and writable only by the row's
owner. **Any new table needs its policies written in the same migration.**

Secrets that cannot ship in a bundle live as Supabase Edge Function secrets:
`TWITCH_CLIENT_ID` / `TWITCH_CLIENT_SECRET` (IGDB) and `STEAM_API_KEY`.

---

## Roadmap

**After the deploy-and-repair pass above:**

1. **Discussions / forums** — the largest remaining surface from the brief.
   Reddit-style topics scoped to a game; the `comments` threading models most
   of it already.
2. **Avatar/banner picker** — storage upload exists and posts use it, but
   profile editing still takes *URLs*.
3. **Pagination** — every feed query is capped (40–100 rows) with no infinite
   scroll.
4. **Video posts and polls** — `post_media` has a `video` kind; nothing produces
   or renders one.
5. **Likes on collections** — the Letterboxd reference shows a like count.
   Extending the polymorphic like target to `'list'` means a migration plus the
   `assert_target_exists` trigger and notification kinds.
6. **Collaborative lists** — single-owner schema today.
7. **Drag-and-drop reordering** — lists use up/down arrows.
8. **Realtime** — could replace the 60s poll on the unread badge.

### Known limitations

- **The feed is two queries merged in JS.** Posts and logs are different row
  types, each capped at 40 and merged newest-first. This should become a Postgres
  function or a materialised `feed_items` view before real pagination.
- The feed fetches the follow list first, then content — two round trips.
- The wall derives activity at read time (six queries per profile load). Accurate
  by construction, but the cost grows with each activity source.
- Achievement scans process 15 games per run and resume across sessions, so a
  900-game library takes several passes to fill in.
- No offline support.
- `database.types.ts` is hand-written and must be kept in sync with the SQL by
  hand — including `Relationships`, which supabase-js needs to type embedded
  joins. Once live: `npx supabase gen types typescript --project-id <ref>`.
