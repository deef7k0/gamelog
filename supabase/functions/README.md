# Edge Functions

## Why these exist

These secrets can never ship in an Expo bundle, because anyone can unzip an APK:

- the Twitch `client_secret` IGDB authenticates with (`igdb`)
- the Steam Web API key (`steam-auth`, `steam-sync`)
- the IsThereAnyDeal API key (`itad`)
- the ScanDex access token (`scandex`) and the OpenCritic key (`opencritic`)
- SoundCloud's client id and secret (`soundcloud`)

And one operation can never be trusted to a client at all: verifying a Steam
OpenID assertion. A client that skipped verification could claim any SteamID64
and inherit a stranger's library, playtime and achievements — which is why
`gaming_accounts.external_id` has no client write policy and only `steam-auth`
can set it.

## Deploying

All of them need a Supabase access token (`sbp_…`) in the environment or passed
with `--token`.

```bash
# One-time secrets
supabase secrets set TWITCH_CLIENT_ID=xxx TWITCH_CLIENT_SECRET=yyy
supabase secrets set STEAM_API_KEY=zzz
supabase secrets set ITAD_API_KEY=aaa
supabase secrets set SCANDEX_API_TOKEN=bbb
supabase secrets set OPENCRITIC_API_KEY=ccc
supabase secrets set SOUNDCLOUD_CLIENT_ID=ddd SOUNDCLOUD_CLIENT_SECRET=eee

# Functions
supabase functions deploy igdb        --project-ref <ref> --use-api
supabase functions deploy itad        --project-ref <ref> --use-api
supabase functions deploy scandex     --project-ref <ref> --use-api
supabase functions deploy opencritic  --project-ref <ref> --use-api
supabase functions deploy soundcloud  --project-ref <ref> --use-api
supabase functions deploy steam-sync  --project-ref <ref> --use-api
supabase functions deploy steam-auth  --project-ref <ref> --use-api --no-verify-jwt
```

### Where the IsThereAnyDeal key comes from

Register an app at <https://isthereanydeal.com/apps/>. That page issues three
things and **only one of them is used here**:

| Credential | Used? | What it is for |
| --- | --- | --- |
| API key | **yes** — `ITAD_API_KEY` | App-authenticated endpoints: lookups and prices |
| Client ID | no | OAuth, for acting on *a user's* waitlist or collection |
| Client secret | no | The same OAuth flow |

The app never signs a user in to ITAD, so there is no OAuth flow to run and
nothing to store per user. If that changes — a "add to my ITAD waitlist" button
would need it — the client id and secret go in as two more secrets and the
function grows an authorization-code leg; nothing about the key path changes.

Without `ITAD_API_KEY` the function returns a 500 that says exactly that, rather
than letting ITAD answer 401 and sending you looking at the wrong layer. The
game page degrades to no "Where to buy" section, which is the same thing it does
for a game ITAD does not track.

### Where the ScanDex token comes from

[ScanDex](https://scandex.gamery.app/documentation/api/) maps game-box
barcodes to IGDB games and platforms. Its access token is on your ScanDex
developer account; it goes in `SCANDEX_API_TOKEN` exactly as issued — ScanDex
expects it as the bare `Authorization` header, with no `Bearer ` in front.

`scandex` also needs migration **0027**, which creates the answer cache it
writes with the service role. It only serves signed-in users: the anon key is a
valid JWT and ships in the bundle, so without that check anyone could spend the
token's quota. The scanner asks it only when Gamelog's own releases and pending
claims know nothing about a barcode, and falls back to "unknown" when it fails —
so an undeployed function or a missing token costs identification, never the
scan. Verify a deploy by scanning (or typing) `0711719577966`, which ScanDex's
docs give as Super Mario Odyssey on Switch.

### Where the OpenCritic key comes from

OpenCritic's API is on RapidAPI: subscribe to the **OpenCritic API** listing and
copy the key RapidAPI shows for it into `OPENCRITIC_API_KEY`. It feeds the game
page's "Critic reviews" rail — each outlet's score and a snippet of what it
wrote, which IGDB does not have.

Three things about it:

- **The plans are metered per day and the free one is small.** One game costs
  three upstream requests (find it, its summary, its reviews), so the function
  keeps its answers in `critic_review_cache` — run migration **0035**. Without
  the table it still works and simply asks OpenCritic every time; with it, the
  first person to open a game pays and everyone after reads a row. A settled
  game is kept two weeks, a new release two days, "OpenCritic has nothing" three.
- **It only serves signed-in users**, for the reason `scandex` does: the anon
  key is a valid JWT and ships in the bundle.
- **A deployment from before the rail still answers, with scores and no
  snippets.** The app then has nothing to quote and leaves the section out, so
  redeploy after pulling the change. Verify by opening a recent, well-reviewed
  game — the rail sits under Reviews on its Overview.

### Where the SoundCloud keys come from, and what to check the day they arrive

Register an app at <https://soundcloud.com/you/apps>; it is given a **client
id** and a **client secret**. Both go in as secrets — neither may be put in
`.env`, which ships in the bundle. Then deploy `soundcloud` and run migration
**0036** (read its header first: it deletes every starred song and drops the
old Apple Music cache, at the owner's decision).

`soundcloud` finds a game's soundtrack and hands the app's player something to
play. Without its secrets it answers `{ "status": "unconfigured" }` and the app
says soundtracks are not connected yet — **that is the state it was built and
shipped in**; the project had no credentials. Nothing in it has run against the
live API. What it does, from SoundCloud's published guide and OpenAPI document:

- **One token for the whole app, kept and renewed.** Client-credentials tokens
  are rationed (50 per 12 hours per app, 30 an hour per IP) and last about an
  hour, so the token lives in `soundcloud_tokens` and is renewed with its
  refresh token — single-use, so the row is swapped on the old one and two
  instances cannot both spend it. One renewal and one fresh exchange per
  request at most; a 401 replaces the token once and retries once.
- **It stores which upload matched, and nothing about it.** SoundCloud's terms
  forbid an app to keep titles, names, artwork or audio. `soundcloud_matches`
  holds a playlist's URN or a list of track URNs; everything shown is fetched
  when it is asked for. A found match stands 14 days, a "nothing found" 7, and
  the app's "Look again" is honoured at most every ten minutes per game.
- **A stream is resolved per play and never stored.** Each one counts against
  15,000 plays a day per app. A 429 there is not retried — it is the day's
  quota — and is answered as `{ "status": "rate_limited", "resetAt": … }`,
  which the app shows with the time it lifts. A 429 on a search is retried
  twice (0.5s, 1s) and then reported the same way.
- **Only signed-in users**, as `scandex`: the anon key is refused.
- **The matcher is `_shared/soundcloud-match.ts`**, pure, and under `npm test`
  (`src/lib/soundcloud/match.test.ts`). Bump `MATCHER_VERSION` when its
  judgement changes and stored matches are searched again.

**Five things could not be checked without keys.** Both branches are built
where it matters; settle these on the first run:

1. **How a stream address answers.** `/tracks/{urn}/streams` returns addresses
   that need the app's token. The function requests one with it and expects a
   redirect to a signed address on SoundCloud's media host, which the phone's
   player opens directly. If the answer is the HLS playlist itself — or a
   redirect whose path does not end `.m3u8`, which Android's player would not
   recognise — the player is pointed at this function's own
   `…/soundcloud/hls/<urn>.m3u8?t=<ticket>` instead. Look at which branch a
   play takes (`needsAuth` in the `stream` answer).
2. **That expo-audio plays the address** in Expo Go on Android and iOS.
3. **Whether several `tags` mean all or any.** The search asks once per tag
   (`videogame`, `videogames`, `games`), so either is safe; if it is "any",
   three requests can become one.
4. **`urns=` with a long list**, and what `playback_count` is when an uploader
   hides their stats (the app treats a missing count as unknown).
5. **That a client-credentials token comes with a refresh token** that renews
   as the guide describes. If it does not, every hour costs one of the 50.

**The relay never sees a session, on purpose.** A phone's audio player sends
the headers it is given with *every* request for a track — the playlist on this
function, and then each media segment on SoundCloud's host. So it is given the
project's public key and nothing else, and the relay is authorised by a ticket
signed into its address (HMAC, one track, five minutes), issued only to a
signed-in caller of `stream`. Do not "simplify" it to the listener's bearer
token: that hands their session to a third party a hundred times a song.

**Before this ships to anyone, read SoundCloud's API terms** and describe the
feature plainly when registering the app. Two clauses sit close to what it
does — no "page … dedicated to one or more specific artists or set of
repertoire", and no service that "aggregates and streams User Content from
multiple users into an on-demand listening service" — and whether a soundtrack
screen per game is acceptable is SoundCloud's call, not something code can
settle. What the code does about them: it prefers one uploader's playlist over
tracks gathered from several, credits every uploader, shows SoundCloud's logo
unmodified, links back to every track, and keeps nothing.

### The `igdb` allowlist is checked in the deployed function

`ALLOWED_ENDPOINTS` in `igdb/index.ts` does nothing until the function is
redeployed. The newest entry is `games/count`, the page count on a platform's
games; until it is deployed the app works the count out through `games` in a
dozen small requests instead of one. Check with the anon key as the bearer:

```bash
curl -s -X POST "$SUPABASE_URL/functions/v1/igdb" \
  -H "Authorization: Bearer $ANON_KEY" -H "Content-Type: application/json" \
  -d '{"endpoint":"games/count","query":"where platforms = (167);"}'
# {"count": 12345} once deployed; {"error":"Endpoint \"games/count\" is not allowed."} before
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
