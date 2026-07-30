# Edge Functions

## Why these exist

Two secrets can never ship in an Expo bundle, because anyone can unzip an APK:

- the Twitch `client_secret` IGDB authenticates with (`igdb`)
- the Steam Web API key (`steam-auth`, `steam-sync`)

And one operation can never be trusted to a client at all: verifying a Steam
OpenID assertion. A client that skipped verification could claim any SteamID64
and inherit a stranger's library, playtime and achievements — which is why
`gaming_accounts.external_id` has no client write policy and only `steam-auth`
can set it.

## Deploying

All three need a Supabase access token (`sbp_…`) in the environment or passed
with `--token`.

```bash
# One-time secrets
supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy
supabase secrets set STEAM_API_KEY=zzz

# Functions
supabase functions deploy igdb        --project-ref <ref> --use-api
supabase functions deploy steam-sync  --project-ref <ref> --use-api
supabase functions deploy steam-auth  --project-ref <ref> --use-api --no-verify-jwt
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are injected
by the platform — do **not** set them as secrets.

### `--no-verify-jwt` on `steam-auth` is required, not a shortcut

Step 3 of the OpenID flow is a **browser redirect from Steam**, which carries no
Authorization header. With JWT verification on, the gateway rejects it before the
function runs and linking can never complete.

The function is still not open. Each leg authenticates itself:

| Leg | Authenticated by |
| --- | --- |
| `POST {action:'start'}` | Bearer token, verified via `auth.getUser()` |
| `POST {action:'unlink'}` | Bearer token, verified via `auth.getUser()` |
| `GET ?state=…&openid.*` | single-use `state` nonce + Steam's own signature check |

`steam-sync` keeps JWT verification **on** — every caller there is an
authenticated app user.

## Getting a Steam Web API key

<https://steamcommunity.com/dev/apikey>. It is tied to a Steam account, needs a
domain (any value is accepted), and requires the account to have spent at least
$5. One key serves every user of the app.

**Never paste it into a chat, a commit, or `.env`.** `EXPO_PUBLIC_*` variables
are inlined into the bundle at build time, so a key placed there is extractable
from the APK. It belongs only in `supabase secrets set`.

## Rate limits

The Steam Web API allows roughly 100,000 calls/day per key, but burst tolerance
is the real constraint. Costs per sync section:

| Section | Requests |
| --- | --- |
| `profile` | 3 |
| `library` | 1 |
| `badges` | 1 |
| `friends` | 1 + ceil(matched friends / 100) |
| `inventory` | 1 per supported game, on a slower limiter |
| `achievements` | **2–3 per owned game** |

A 500-game library is ~1,200 requests for a full achievement scan, so that
section processes `ACHIEVEMENT_BATCH` (15) games per run, ordered by playtime so
the games a user actually cares about populate first, and reports `hasMore`. The
client chains a bounded number of follow-ups per screen visit and the rest
catches up on later runs.

Two limiters are enforced in `_shared/steam-api.ts`: 120ms between Web API calls,
1.5s between community (inventory) calls. The community endpoint is far stricter
than the documented API and starts refusing after a handful of requests a minute.

## Testing the OpenID flow locally

`supabase functions serve` will not work for the round trip: Steam must be able
to reach `return_to` from the public internet, and `functionBaseUrl()`
deliberately derives that from `SUPABASE_URL` rather than from the incoming
request. Deploy to the project and test against it.

## Verified API behaviour

Checked against the live endpoints rather than assumed, because several of these
are undocumented:

- `check_authentication` replies with **`key:value` lines, not JSON** — a bogus
  assertion returns `ns:…\nis_valid:false`.
- `GetOwnedGames` without a key → 401; `GetPlayerSummaries` without one → 400.
  There is no keyless fallback.
- `GetGlobalAchievementPercentagesForApp` **is** keyless.
- The community inventory endpoint returns `assets` and `descriptions` as
  **separate arrays joined on `classid` + `instanceid`**. Rarity lives in
  `tags[category="Rarity"]`, with the display colour in `name_color` as bare hex.
  `icon_url` is a CDN path fragment, not a URL.

## Known Steam limitations

- **No purchase dates.** Nothing in the Steam Web API exposes when a game was
  bought or added. `gaming_owned_games.acquired_at` exists for providers that do
  (GOG, Epic) and stays null for Steam, which is why the library hides the
  "recently purchased" sort instead of faking it from last-played.
- **No badge names or icons.** `GetBadges` returns ids, levels, XP and timestamps
  only. Game badges are illustrated with the app's capsule art; the rest lean on
  level and XP.
- **Private is normal.** A private profile, private game details or a private
  inventory all return success-shaped responses with nothing in them. Each
  section reports `private` rather than `error` so the UI can say "Profile is
  Private" instead of showing a failure.
