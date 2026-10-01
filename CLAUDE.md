# CLAUDE.md

Working notes for AI agents (and humans) in this repo. For what the product *is*
and where it is going, read [PROJECT.md](PROJECT.md). For how it should **look**
— tokens, type scale, surfaces, the game case — read [DESIGN.md](DESIGN.md); its
YAML frontmatter mirrors `src/constants/theme.ts` and is the normative layer.
The conventions below are the code-level rules that follow from it.

> **One design system, and DESIGN.md is it.** For a period this file pointed at
> a light, boxy, 2010-era spec ("Social Playback") that the app never
> implemented — its `scheme` was `light-only` against a hard-coded dark
> `APP_SCHEME`, and 17 of the 18 token names the two shared held different
> values. Anyone following the pointer built for the wrong app. That spec is
> archived, unimplemented, at
> [DESIGN_SOCIAL_PLAYBACK.md](DESIGN_SOCIAL_PLAYBACK.md); it is a record of a
> direction that was considered, and nothing in it describes this codebase.

## Expo SDK 57 has changed — check the docs

This project is on **Expo SDK 57 / React Native 0.86 / React 19.2**, which is
newer than most training data. Before writing navigation, routing or Expo-module
code, check the versioned docs: https://docs.expo.dev/versions/v57.0.0/

Things that are genuinely different from older tutorials:

- `ThemeProvider`, `DarkTheme`, `DefaultTheme` come from `expo-router`, **not**
  `@react-navigation/native`.
- Route protection uses `<Stack.Protected guard={...}>`, not a redirect effect.
- `StyleSheet.absoluteFillObject` is gone from the RN types. Write the four
  offsets out, or use `StyleSheet.absoluteFill`.
- Routes live in `src/app/`, not a top-level `app/`.

## Commands

```bash
npm start          # Expo dev server (scan the QR code with Expo Go)
npm run android    # dev server targeting an Android device/emulator
npm run web        # browser — see the Steam/CORS caveat below
npx tsc --noEmit   # typecheck
npx eslint src     # lint
npx prettier --write "src/**/*.{ts,tsx}"
npm test           # node:test — pure modules only: the M3 scheme generator, the
                   # genre reach order, barcodes, progress choices, review filters,
                   # the report reasons against 0031's CHECKs, the Wikidata
                   # claim parsing and game lookup (lib/wikidata), the Commons
                   # logo licence check, and the immersive page colour
                   # (Palette port, Oklab darkening)
```

`npm test` runs the `*.test.ts` files under plain Node, so a module under test
may only import neighbours by **relative** path (`scripts/esm-extensionless.mjs`
resolves an extensionless `./x` to `x.ts`, as Metro does; nothing resolves `@/`),
and nothing it imports may reach React Native or `constants/platform-cases.ts`,
which `require()`s the case artwork. That is why `lib/review-facets.ts` takes the
platform-family resolver as an argument instead of importing it.

Node is a portable install at `~/.local/node-v24.18.0-linux-x64/bin`, already on
PATH via `~/.profile`. SDK 57 needs Node ≥ 22.13.

## Setup that is not optional

1. `cp .env.example .env` and fill in the Supabase URL + anon key.
   `src/lib/supabase.ts` throws a clear error at import time if these are
   missing, so the app will not start without them.
2. Run every migration in `supabase/migrations/` in order, in the Supabase SQL
   editor. Nothing works before this: there are no tables and every query 404s.
   `0001`–`0011` are already applied to the current project; `0012` onwards are
   not — without `0013` the Reviews/Collections/People tabs 404 on their RPCs
   and collections cannot be liked, without `0015`+`0016` an Award show
   cannot be created at all, and without `0018` posting a comment on a
   collection fails the CHECK on `comments.target_type`.
   `0022`–`0026` are progress, physical copies, community similarity and review
   stats. The log form writes `completion` and `coop`, so **without `0023` no log
   can be saved at all**; without `0024` scanning and copies fail, without `0025`
   the Similar tab's community section errors, and without `0026` the reviews
   sheet loses its breakdown and its platform filter. `0028` is the library's
   stats: without it the profile's digital / physical line never appears and the
   head of a library says its stats did not load. `0031` is reports on
   suggestions and reviews: without it the report form fails for those two (a
   pick still reports, through 0025) and the moderation queue's Suggestions and
   Reviews tabs error. **Run `0032` straight after it**: 0031 alone makes every
   query that embeds a log's author fail (PGRST201 — see the gotcha on join
   tables), which is every list of reviews in the app. Without `0033` every
   collection shows the mosaic and choosing "Show one cover" fails.
   `0006`, `0015`, `0019` and `0022` each add an enum value and must run
   **alone** — see the notes in those files.
   Moderators are rows in `public.moderators`, which no client can write; make
   one in the SQL editor with
   `insert into public.moderators (user_id) select id from public.profiles where username = '…';`
3. Env vars are **inlined at build time**. After editing `.env`, restart with
   `npx expo start --clear` — a hot reload will not pick up the change.
4. Deploy the IGDB Edge Function — it is now the app's **only** game source, so
   nothing game-shaped works without it:
   `supabase secrets set TWITCH_CLIENT_ID=… TWITCH_CLIENT_SECRET=…` then
   `supabase functions deploy igdb`. `EXPO_PUBLIC_IGDB_ENABLED=false` no longer
   degrades search to other providers — it disables search.
5. Optional: deploy the ITAD Edge Function for storefront prices —
   `supabase secrets set ITAD_API_KEY=…` then `supabase functions deploy itad`.
   Only the **API key** is used; ITAD's OAuth client id and secret are for
   user-scoped endpoints this app does not call. See
   `supabase/functions/README.md`. Without it the game page simply has no
   "Where to buy" section.
6. Optional: deploy the ScanDex Edge Function so a scan identifies boxes nobody
   has added yet — run migration `0027`, then
   `supabase secrets set SCANDEX_API_TOKEN=…` and
   `supabase functions deploy scandex`. The token is the one on your ScanDex
   developer account, pasted as issued (no `Bearer `). Without it, scanning
   still works against Gamelog's own releases and ends at "unknown" otherwise.

## Adding a route

Typed routes are generated into `.expo/types/router.d.ts` **by the dev server**,
not by `expo export`. A brand-new route file will fail typecheck until you run
`npx expo start` once. This is expected, not a bug in your code.

## Architecture

```
src/
  app/               Expo Router routes (file = route)
    (tabs)/          home, search, news, profile
    game/[id]        game detail + reviews + action row
    log/[id]         create/edit a log (modal)
    achievements/[id]  per-game achievement list
    game-info/[id]   Additional information: awards, nominations, cast, budget
                     and the people behind a game, from Wikidata. Opened from
                     the Overview tab; see § Wikidata
    list/[id]        a list / tier list / award show
    add-to-list/[id]   pick a game to add to that list (modal)
    award-game/[id]    pick the winner of one award (modal)
    award-edit/[id]    name an award, or say why it won (modal)
    comments/[type]/[id]  comment thread for a post or log
    game-stats/[user]/[game]  one person's record of one game — their log plus
                     Steam's measured playtime. Opened from a library cover or a
                     profile's Steam rail, never from the game page
    playthroughs/[game]  your runs of one game; playthrough/[id] edits one (modal)
    library/[id]     a person's games: All (stats header + grid), Physical
                     (the CD binder), Logged, Favourites, Steam. Takes ?tab=
    copies/[user]    a physical collection as a plain list; copy/[id] one copy,
                     showcased — its case, its disc, its back; add-copy the
                     copy form (modal)
    scan             barcode camera (full-screen modal), with typed entry as the
                     fallback for a denied or missing camera
    add-release      submit or edit a barcode's release claim (modal)
    submissions      your release claims and what became of them
    moderation       moderators only: release claims, and reports on picks,
                     suggestions and reviews
    suggest-similar/[id]  recommend a game like this one, with reasons (modal)
    similar/[id]     one community pick (?game= the side you came from): agree
                     or disagree, and every suggestion behind it, upvotable
    report/[kind]/[id]  report a pick, a suggestion (?author=) or a review
                     (modal). Every `<ReportFlag>` in the app opens it
    profile/[id]     someone else's profile
    new-list, edit-list/[id], edit-profile (modals)
    settings         the games hidden from Surprise Me, a link to the
                     moderation queue for moderators, and Sign out. Opened from
                     the profile tab's bar. It was deliberately empty for a long
                     time and the argument in its docblock still stands —
                     nothing goes here until it works
    quick-log        the profile's +: pick a game, then ?mode=review replaces
                     this with the log form and ?mode=log raises the game
                     page's progress sheet over it (modal)
    surprise         Surprise Me: one dealt game, one song from it
    sign-in, sign-up
  components/        shared UI; components/ui/ is the primitive layer
                     ui/frosted-top-bar a floating 44dp disc of glass holding the
                                        back chevron. Not a bar; see § Conventions
                     app-tab-bar        the bottom navigation: SimpMusic's 64dp
                                        capsule (Home, Search, News, Profile)
                                        with a sliding 56dp indicator, floating
                                        over the page. Tab screens pad their
                                        scroll content by `useTabBarClearance()`
                                        — a new tab screen must too
                     award-show / award-slot  an award ballot, and one row of it
                     game-filter-bar    genre / platform / studio / year pills
                     game-lineage       original game / editions & extras
                     game-insights      rating histogram, time to beat, events
                     game-details-sheet the full IGDB record, behind a button
                     add-to-collection  pick which collection a game joins
                     store-prices       where to buy, from IsThereAnyDeal
                     ui/soft-glow       Skia radial glow (+ .web.tsx fallback)
                     ui/scroll-ambience scroll-driven page gradient (+ .web.tsx)
                     collection-mosaic  a collection's artwork: its first four
                                        IGDB covers 2x2, or the owner's one cover
                                        (0033), cropped — never SteamGridDB
                     ui/ambient-light   Home's soft light in the top-left
                                        corner (Skia, + .web.tsx CSS fallback)
                     surprise-deck / -bloom / -sheen / -page-wash
                                        the dealt card's deck, its light, its
                                        gloss and the page's colour transition.
                                        DESIGN.md § 4.2; that screen only
                     ui/square-art / ui/round-action / ui/marquee-text
                                        the square cover, the round keys beside
                                        its title, and the title that scrolls —
                                        shared by Surprise Me and a review
                     ui/stats-strip     a row of figures with rules between;
                                        the game page's strip and a review's,
                                        and `size="compact"` on a review card
                     review-cells       a review's playthrough as strip cells,
                                        shared by the review page and the card
                     log-card           the review card in every list, after
                                        Letterboxd: title + year left and the
                                        writer (name, avatar) right on the top
                                        row; 83dp box art with five lines of the
                                        review beside it; the score bottom-right,
                                        its baseline on the art's bottom edge.
                                        No likes, date or report flag on the
                                        card — those are on the review page
                     ui/selectable      `useSelectable()`: the one selected
                                        state (accent wash + edge + label) for
                                        any control that draws its own shape
                     ui/selection-marks <Checkbox> and <RadioMark>, the drawn
                                        state inside a checkbox or radio row
                     ui/selection-card  <SelectionCard>: one choice as the
                                        owner's reference draws it — the 34dp
                                        circle first, name, hint. Every
                                        single-choice list with words uses it
                     ui/score-meter     a score's readout and bar, shared by the
                                        review page and the log form's input
                     progress-sheet     the seven progress choices + details
                     community-similar  the Similar tab's card, and the sortable
                                        sheet of community picks it opens
                     report-flag        the flag on a suggestion or a review,
                                        and `reportHref()` for anything else
                     review-breakdown   the reviews sheet's split averages
                     choice-chips       one (or several) of a short vocabulary
                     game-picker        search-and-tap, for forms that need a game
                     cd-binder / cd-binder-page  the zip binder of discs
                     cd-disc            a game's art printed on game_cd.png
                     copy-showcase / copy-case-back  a copy's case, disc and back
                     library-stats      the head of a library (0028)
                     game-info-sections the Wikidata screen's cards — awards,
                                        cast, budget, credits, people
                     studio-identity    a studio's name, or its Commons logo in
                                        its place; see § Immersive pages
                     ui/smooth-scrim    SimpMusic's artworkScrimBrush: artwork
                                        melting into a page colour
                     ui/section         SimpMusic's artist-page sections: the
                                        heading + More, the description card,
                                        the art rail, and `useSectionMetrics`
                                        (its sizes as fractions of the display)
                     ui/expandable-text text in a card that opens in place, the
                                        window's height animating (the
                                        reference's DescriptionView)
                     ui/dropdown-button SimpMusic's DropdownButton: an outlined
                                        pill holding the current choice, and a
                                        menu that opens *from* it (anchored,
                                        computed, CSS keyframes). One option
                                        draws a metadata chip instead
                     game-platforms     the Overview's Platforms section: the
                                        case (and its turn-over) for the chosen
                                        platform, the dropdown, the price
  constants/         theme tokens, log-status vocabulary, the identity ramp
                     (identity.ts: genre → hue), rarity bands,
                     game-editions.ts (remake/remaster/DLC labels),
                     stores.ts (storefront brand marks), progress.ts (the seven
                     progress choices), physical.ts (region / completeness /
                     condition words), platform-media.ts (disc, cartridge…),
                     similarity.ts (the twelve reasons), reports.ts (what a
                     report can say, per kind), wikidata.ts (every Wikidata
                     property the additional-information screen reads)
  theme/
    dynamic-color.ts    Material 3 (Monet): one seed hex → 23 M3 roles, via
                        DynamicScheme + TONAL_SPOT. Pure; `npm test` covers it
    dynamic-theme-provider  <DynamicThemeProvider> + useDynamicTheme()
  hooks/
    use-accent          the accent in force: house blue, or a game's own colour
    use-album-art-color the seed for the above — native extractor on a dev build,
                        pure-JS JPEG decoder in Expo Go. Never import
                        react-native-image-colors statically; see § Conventions
    use-screen-chrome   what a page publishes to its top bar (Android blur
                        target, modal flag) + `useTopBarScroll()`
    use-header-height   how much space the floating back disc occupies
    use-steam-artwork   Steam CDN URLs + the hashed-path fallback, cached 7 days
    use-wikidata-game-info  one query per game: its Wikidata item, claims and
                        labels, cached a day. Null means "nothing found"
    use-immersive-background  a page colour from one piece of artwork, or null
                        for the app's page. Background only — never a control
    use-studio-catalogue  a studio's company (identity + game ids) and its
                        games — the one company request the logo shares
    use-studio-banner   the studio's banner URL, remembered per device so a
                        return visit paints art and colour before IGDB answers
    use-studio-logo     a studio's verified public-domain logo, or null;
                        stored on the device (a month; "none" a week). No
                        IGDB request of its own
    use-square-cover    a game's 1:1 cover from SteamGridDB, persisted to
                        AsyncStorage. Returns `resolved` — do not draw the IGDB
                        cover before it is true; that is the swap it prevents
  lib/
    color.ts         contrast, mixing, luminance-preserving tint, readable ink
    artwork-color.ts dominant hue of a cover, decoded from the real pixels
    games/           IGDB (the catalogue) + Steam/RAWG/itch id lookup only,
                     steam-artwork.ts for Steam CDN covers (preferred over IGDB),
                     sort.ts for in-memory ordering, recommend.ts for
                     "Games for you" (your logs → IGDB similarity),
                     itad.ts for storefront prices,
                     steamgriddb.ts for square (1:1) and per-platform cover
                     art — artwork only, never a catalogue; see the note below
    wikidata/        the additional-information screen's data: finding a game's
                     item by exact id (lookup.ts), reading claims (claims.ts,
                     normalize.ts — pure, under `npm test`), and the Action API
                     (client.ts). See § Wikidata. Also the studio logo:
                     commons.ts (the licence check — pure, tested) and
                     studio-logo.ts (finding the file)
    immersive-color.ts  SimpMusic's page colour: Palette's dominant swatch,
                     darkened in Oklab, and the scrim's stops. Pure, tested
    logo-luminance.ts   how light a logo's ink is, decoded with Skia
                     (+ .web.ts, which has no Skia and returns null)
    barcode.ts       GTIN check digits, UPC-E expansion, normalising to GTIN-14
    review-facets.ts what the review list filters and tallies by. Pure
    postgrest.ts     `inList()`, the safe `in` filter for strings people typed
    platform-options.ts  a game's platforms as picker options
    api/             everything that talks to Supabase, split by domain
      core.ts        games cache, logs, profiles, follows, achievements,
                     the reviews sheet
      engagement.ts  likes and comments (was posts.ts)
      lists.ts       lists, tier lists, favourites, wishlist
      awards.ts      award shows: the ballot and its slots
      progress.ts    progress writes and playthroughs
      physical.ts    releases, barcode lookup, claims, moderation, copies
      similarity.ts  community similar games: pairs, votes, reports
      reports.ts     reports on suggestions and reviews, and their queues
      notifications.ts
      songs.ts       the one starred track per profile
      storage.ts     image upload
    supabase.ts      client + session persistence
  store/auth.ts      zustand auth state
supabase/
  migrations/        0001 core, 0002 media+achievements, 0003 social,
                     0004 0-100 reviews, 0005 friends+wall, 0006 article kind,
                     0007 events+articles, 0008 review metrics,
                     0009 gaming accounts, 0010 collection tags, 0011 diary,
                     0012 starred song, 0013 collection likes + ranking fns,
                     0014 chosen collection cover, 0015 awards list kind,
                     0016 award categories, 0017 game editions,
                     0018 comments on collections,
                     0019 captioned list kind, 0020 soundtrack cache,
                     0021 review spoilers, 0022 paused status,
                     0023 completion + co-op + playthroughs,
                     0024 releases, barcodes, claims, copies, moderators,
                     0025 community similarity, 0026 review stats,
                     0027 ScanDex answer cache, 0028 a person's game stats,
                     0029 sortable similar picks + upvotes on suggestions,
                     0030 each pick's top suggestion + suggester/agreer counts,
                     0031 reports on suggestions and reviews,
                     0032 those report tables keyed on their own id,
                     0033 a collection's artwork: four covers or one
                     (0006, 0015, 0019 and 0022 each add an enum value and must
                      run alone — see those files)
  functions/igdb/    Edge Function proxying IGDB
  functions/opencritic/  per-outlet critic scores; IGDB has none
  functions/itad/    Edge Function proxying IsThereAnyDeal (prices)
  functions/scandex/ Edge Function proxying ScanDex (barcode → IGDB game)
```

**Data flow.** Game metadata comes from external providers (`lib/games/`), but
anything social lives in Supabase (`lib/api.ts`). The join between them is the
`games` table: when a user logs a game we copy its metadata into Postgres, so
the feed can render 50 items with one query instead of 50 Steam calls.

**Game identity.** A game's app-wide id is `` `${source}:${sourceId}` `` — e.g.
`steam:367520`. Build it with `makeGameId()`, take it apart with `parseGameId()`.
Never assume a bare numeric id.

**One catalogue: IGDB.** `PROVIDERS` in `lib/games/index.ts` holds `igdbProvider`
and nothing else, so every game that enters the app — search, charts, franchise,
studio, recommendations — has one identity, one cover and one id. Steam, RAWG and
itch.io survive only in `LOOKUP_PROVIDERS`, which `getGameById()` uses so rows
logged before the cutover (and games matched out of a linked Steam library) still
open. Nothing may put a non-IGDB game *into* the app again.

**Artwork.** `coverUrl` is portrait box art (2:3); `heroUrl` is landscape key
art. IGDB publishes both, so a missing cover means the game genuinely has none —
`<Poster>` still falls back to the hero, and chart queries filter on
`cover != null` rather than rendering placeholders. Never stretch a hero into a
poster slot; that is what the fallback is for.

**Steam CDN artwork is a preference over IGDB, never a replacement.** Where a
game has a Steam listing, `<Poster steamAppId>` and `<HeroArt steamAppId>` show
the publisher's own store assets instead — see the Steam CDN section below. The
ladder is always **Steam → IGDB → lettered placeholder**, and the middle rung is
load-bearing: half this catalogue is console-exclusive and has no appid at all.

**SteamGridDB is the square rung, and it is artwork only.** IGDB publishes
nothing at 1:1, so every square slot was cropping 2:3 box art — which is composed
for 2:3, so the crop cuts the logo. `lib/games/steamgriddb.ts` is not a provider
and must never become one: nothing there may put a game *into* the app, only art
onto a game already in it.

**Exactly three surfaces use it**, all through `useSquareCover()`: a profile's
Reviews tab (`<ReviewListRow>`, 80dp), Surprise Me, and a review's own page,
which is built as Surprise Me is — the art at 84% of the width, its title and two
round actions under it, the portrait at the same height when there is no square
(`app/review/[id].tsx`). **Collections are not a square surface, by the owner's
decision**: the mosaic used SteamGridDB per tile for a while and was taken back
to cropped IGDB covers — a community grid is somebody's redesign of the box, and
a collection is a shelf of the boxes themselves.

**There is no per-platform lookup, and rebuilding one against this API will not
work.** The game page briefly asked for the selected platform's own box front.
`/grids/{platform}/{id}` takes *store* slugs — `steam`, `gog`, `egs`, `origin`,
`eshop` — not console families, so `playstation` and `xbox` had no endpoint to
resolve against and every console tap spent a request to fall back to the cover
it already had. The switcher — the Overview's Platforms section — re-draws the
case and the price; the artwork is IGDB's.

Resolution is Steam appid, then a title search, because `games.source_id` is an
IGDB id and SteamGridDB does not index IGDB; the title path is a string match and
its docblock says what that costs. Everything returns `null` on a miss and
**every caller must have an IGDB fallback** — `null` is the normal answer, not an
error. No `EXPO_PUBLIC_SGDB_API_KEY` means no requests at all and every slot keeps
the IGDB cover. Requests are capped at four in flight (`MAX_CONCURRENT`): the
square lookup is per *tile*, so a Collections tab is eighty of them leaving at
once, and a 429 is indistinguishable from "no art" once it has been cached.

**`useSquareCover()` returns `{ uri, resolved }` and callers must honour
`resolved`.** Drawing the IGDB cover while the answer is unknown is what made
every square slot paint a portrait and then swap it for a square, on every mount,
forever — a query cache does not survive a cold start. The hook is a module store
persisted to AsyncStorage (mirroring `use-steam-artwork`) and **caches the misses
too**, so a game resolves before its first paint on every sighting after the
first. While `resolved` is false, show a skeleton or the container's own fill —
anything that is not a *different piece of artwork*.

## Steam CDN artwork

Base: `https://shared.steamstatic.com/store_item_assets`. **Not**
`shared.cloudflare.steamstatic.com`, which 301s here — using it costs a redirect
on every image.

| Slot | Filename | Size |
| --- | --- | --- |
| `library` | `library_600x900_2x.jpg` | 1200×1800, exactly `PosterAspectRatio` |
| `header` | `header.jpg` | 460×215 |
| `hero` | `library_hero.jpg` | 1920×620 |
| `logo` | `library_logo.png` | transparent wordmark |

`steam/apps/<appid>/<filename>` is right for roughly 95% of appids. The rest put
their assets behind a content hash and 404 on the plain path — verified live:
`730` (CS2) serves directly, `2623190` (Oblivion Remastered) does not and needs
`…/apps/2623190/b52322f…/library_600x900_2x.jpg`.

Three things that are easy to get wrong, all verified against the live API:

- **`asset_url_format` is a template, not a prefix.** It comes back as
  `steam/apps/2623190/${FILENAME}?t=1786648304` — substitute the filename with
  `.replace('${FILENAME}', name)`. Splitting on `${FILENAME}` and keeping the
  left half drops the `?t=` cache token, so a re-uploaded capsule keeps serving
  the stale image.
- **The template is relative to `store_item_assets/`, not to the host.**
  Prepending the bare CDN host yields `…steamstatic.com/steam/apps/…`, which
  404s for every game — the missing segment is the difference between the
  fallback working and never working.
- **`GetItems` returns no `logo` key.** Assets are `main_capsule`,
  `small_capsule`, `header`, `library_capsule`, `library_hero` and their `_2x`
  variants. A logo can only ever be the direct URL, so a hashed app has none.

`IStoreBrowseService/GetItems/v1` needs **no API key** and is called as a GET
with a URL-encoded `input_json` blob, not a POST body.

**No HEAD probe, ever.** The direct URL costs nothing to build, so it is used
optimistically and `<Image onError>` is what triggers the hashed lookup —
one round trip per game per week, versus fifty probes to discover that
forty-eight were already right. `hooks/use-steam-artwork` batches those failures
into one call and persists the result for 7 days.

## Wikidata

The game page's **Additional information** door opens `game-info/[id]`:
awards (P166), nominations (P1411), cast with their characters (P161/P725,
characters from *that statement's* P453/P4633 qualifiers), budget (P2130), and
producers, composers, designers, screenwriters and a deduplicated People
section. Every property id is in `constants/wikidata.ts`. All verified against
the live Action API:

- **A game is found by exact identifier, never by title.** The IGDB slug — the
  last segment of `storeUrl`, which is IGDB's `url` — through
  `haswbstatement:P5794=<slug>`, then the Steam appid through P1733. A search
  must return exactly one item; two is narrowed once by the IGDB numeric id
  (`P5794=<slug>[P9043=<id>]`, a qualifier search Wikidata does index) and is
  otherwise given up. A found item whose own P5794 record names a *different*
  IGDB game is rejected (`itemMatchesGame`). No match is `null` — "no
  additional information" — never a guess.
- **`steamAppId` is null on every IGDB game today.** IGDB renamed
  `external_games.category` to `external_game_source` (same numbers; Witcher 3's
  appid 292030 comes back as `external_game_source: 1`), and `GAME_FIELDS` still
  requests `category`, so `steamAppIdOf` never matches. The Wikidata lookup
  does not need it — the slug covers the catalogue — but the Steam CDN artwork
  preference above has been inert for IGDB games for the same reason. Fixing
  the field changes covers app-wide, so it is its own decision.
- **Labels are requested as `en|mul`.** Wikidata now keeps one `mul` label for
  names spelled the same in every language and removes the `en` copy: Doom and
  Overwatch have no `en` label at all. English-only drops them silently.
- **Anonymous traffic is rate-limited per IP, and it bites.** A burst of test
  calls got `429 text/plain` with `retry-after: 25`. The client runs its three
  or four requests in series, the query is cached for a day, and a 429 is
  surfaced, not retried. Space out anything you script against it.
- **API errors are HTTP 200 with an `error` object**, and a missing entity is
  `{"missing": ""}`, not an error. `wbgetentities` takes 50 ids per request
  anonymously. A merged item answers under the id you asked for with the
  survivor's labels and `redirects.to`, so identity is the returned `id`.
- **Who is a person is asked of search, not of claims:**
  `haswbstatement:P31=Q5 pageid:<a>|<b>` returns the humans among those pages in
  one small response, where reading each P31 means fetching every claim (43 KB
  for Nintendo). **`pageid:` with an empty list is ignored and returns every
  human on Wikidata** — never send an empty batch, and only read back pages you
  asked about.
- `origin=*` is what makes the API answer CORS, so the same requests work on
  `npm run web`; browsers cannot set `User-Agent`, so the client also sends
  `Api-User-Agent`, which the preflight allows.

## Immersive pages and studio logos

A **collection with one cover** and the **studio page** fill their background
with a colour taken from their artwork; a collection showing several covers
stays on the app's page. "One cover" is what is on screen, not the setting: the
owner's `single` (0033), or a mosaic with only one cover to draw — a one-game
collection — both count (`collectionCover`). The colour is the artwork's own
*tone*, so a dark or grey cover gives a near-black page, correctly: Disco
Elysium's lands on `#0A0A06`, Marvel's Spider-Man's on `#530000`. The recipe is SimpMusic's, read from its source (`UIExt.kt`
`toImmersiveBackground` / `artworkScrimBrush`, `AlbumScreen.kt`,
`ArtistScreen.kt`), and `lib/immersive-color.ts` is a port, not a lookalike:

- **The colour is the background's, never a control's.** No `<AccentProvider>`
  on either screen: buttons, pills and links keep their neutral fills and the
  house blue. `useImmersiveBackground` returns a page colour or null (the app's
  page); `<Screen background>` and the header's scrim take it, nothing else.
- **Palette's dominant swatch, ported** — 5-bit quantisation, median cut into
  16 boxes, Palette's default filter (near-black, near-white, skin tones). Greys
  survive, so black-and-white art gives a grey page. `extractArtworkColor`'s
  hue vote is the *accent* and must not be used here: it drops greys by design.
- **Darkened in Oklab**, as Compose's `lerp` does: `0.35 + 0.45 × lightness`
  toward black. sRGB gives visibly different pages (white → #333 instead of
  #161616); SimpMusic's own screenshots measure #1A1A1A / #1B1B1B / #3B1129 and
  the Oklab port reproduces them. The page is then darkened further, rarely, if
  `textMuted` would fall under AA on it.
- **Geometry.** Collections: artwork half the display, scrim over its bottom
  70%. Studio: a square banner (≤ half the display), 5% black veil, the same
  scrim, the name or logo centred over the bottom with one meta line under it.

The **studio logo** replaces the name with the studio's logo from Wikimedia
Commons — only ever a verified public-domain or CC0 file:

- **The licence rule lives in `lib/wikidata/commons.ts` and nowhere else.** It
  reads `extmetadata.License` (the licence template's *code*: `pd`, `cc0`,
  `cc-by-sa-4.0`…) and cross-checks `Copyrighted`, `LicenseShortName`,
  `LicenseUrl` and `NonFree`. `pd` requires `Copyrighted: False`; CC0 says
  `True` and is fine. "No known copyright restrictions" and enwiki fair-use
  files have **no** `License` code, so the allowlist rejects them without a
  special case. Never infer a licence from a title or description.
- **Which file**: the studio's Wikidata item, found by IGDB slug (P9650, fetched
  from IGDB's `companies`) or — failing that — by an exact label/alias match
  among video game companies, then its P154 (logo image) at best rank, never an
  ended one. Only when Wikidata names no logo is Commons searched, and a searched
  file's title must be the studio's name plus "logo" and nothing that names
  something else. Two false positives this already caught, verified live:
  Commons' "depicts Valve" data returns the **Steam** logo, and a title search
  for "Valve" returns **"Valve Index logo.svg"**. Neither is Valve's logo.
- **Commons' media host 403s a generic client.** `thumb.wikimedia.org` /
  `upload.wikimedia.org` answer Android's default `okhttp/4.x` with "Please set a
  user-agent". Every Wikimedia image is loaded with `USER_AGENT` in its source
  headers (`<StudioIdentity>`, `measureLogoLuminance`).
- **A logo's ink is measured, not assumed.** Commons logos are drawn for white
  pages — FromSoftware's is pure black. `measureLogoLuminance` decodes the PNG
  with Skia once and caches the number; `logoNeedsLightInk` draws the logo as a
  light silhouette only when its ink is under 3:1 on the page (Mojang's
  white-on-red block stays as it is). The web build has no Skia and draws light.
  It measures the **same download the logo is drawn from**: `Image.prefetch`
  into expo-image's disk cache, `Image.getCachePathAsync`, then Skia reads the
  file — it used to `fetch` the PNG and let `<Image>` download it again. Keep
  `<StudioIdentity>`'s `cacheKey` equal to the URL, or the two stop meeting.
- **The studio page asks IGDB twice, and never by involvement.** `companies`
  (`developed` + `published`, plus the name and slug the logo needs), then
  `games where id = (…)`: 1.5–2.2s for every studio measured, Nintendo's 2,953
  ids included. `games where involved_companies.company = X` — what it used to
  ask — took 3.1–5.5s for Naughty Dog, Rockstar and FromSoftware, and the
  payload was not why: the same query with a third of the fields was as slow.
  `STUDIO_FIELDS` is the studio's own field list (a third of `GAME_FIELDS`, with
  artwork sizes so a wordmark strip is never downloaded as a banner). The
  involvement query survives only for a company with no games of its own.
- Everything fails to the name: no item, no free logo, a rate limit, no
  network, an image that will not load.

## Conventions

- **State**: server data → TanStack Query; auth session → the zustand store.
  Do not duplicate server data into zustand.
- **Query keys** are used for invalidation across screens — grep before renaming
  one. `['feed']`, `['my-log', userId, gameId]`, `['game-reviews', gameId]`,
  `['user-logs', userId]`, `['profile-stats', profileId]`,
  `['playthroughs', userId, gameId]`, `['copies', userId, gameId | 'all']`,
  `['community-similar', gameId, sort]`, `['similar-pair', pairId, gameId]`,
  `['similar-suggestions', pairId]`, and the reviews sheet's three:
  `['game-review-list', gameId, …]`, `['rating-breakdown', gameId]`,
  `['review-stats', gameId]` — anything that writes a log's status, completion,
  score or co-op invalidates all three.
- **Colours**: always `useTheme()`. Never hardcode a hex in a component; add the
  token to `Colors.dark` in `constants/theme.ts` — that object is the entire
  palette. There is no `Colors.light`: `APP_SCHEME` is `'dark'` and `useTheme()`
  returns `Colors[APP_SCHEME]`. This app is a dark room by design and a light
  counterpart would be a second product.
- **The room is dark; the light comes from the games in it.** The chrome is a
  near-black and grey — surfaces, rules, body copy — and every control
  rests on it neutral; the house accent appears only on what is selected,
  focused or primary. Separation is by surface step (`background` → `surface` →
  `surfaceElevated` → `surfaceSelected`); controls are the translucent action
  grey (`controlFill`) or, when they are choices, an `outline`.
  Colour enters from *content*, in exactly three ways. A colour that is none of
  these three is decoration and does not belong:
  1. **Identity — read from the box art.** `lib/artwork-color.ts` fetches the
     game's IGDB `t_thumb` (90×90, ~3 KB), decodes it with `jpeg-js` (pure JS, so
     it works in Expo Go where a native module would not) and returns the
     dominant *hue*. Watch Dogs 2 resolves blue, DOOM red, Cyberpunk yellow.
     That hue lights the page: the ambient ramp, the active tab, the primary
     button, the links. Cached in `AsyncStorage` — box art does not change.
     **The ten-hue ramp (`identityEmber` … `identityMagenta`) is now the
     fallback**, used when extraction fails or when no hue dominates (Celeste's
     cover holds only 20% on its best hue, under the confidence floor). Do not
     delete `constants/identity.ts`: without it those games have no colour.
  2. **Meaning.** Score, log status, achievement rarity and tier are *data* —
     they alias onto the same ten hues rather than introducing new ones. Add a
     meaning by aliasing, never by inventing a hex.
  3. **Atmosphere.** `<Ambience>` is a *gradient*, never an image. The first
     version laid a blurred copy of the cover behind the page and it was visibly
     broken — a bitmap has edges, and its top edge cut across the key art while
     its bottom edge ended mid-screen, with the hero's own fade closing on an
     opaque background in between. Three hard horizontal seams in one screenful.
     A gradient has no edges; that is the whole argument. **Never put an image
     behind a page again to get colour out of it.**
- **`primary` is the house colour and `primaryText` is its legible twin.**
  PlayStation blue `#0070CC` is 3.94:1 on the page — correct under white on a
  filled button (5.01:1), below AA the moment it becomes a word. Blue *fills*
  use `primary`; blue *type* uses `primaryText` (`#2E93E8`, 6.07:1). Lavender
  was the house colour for one pass of the control migration and the owner took
  it back to blue; nothing else from that pass was reverted. `accentRoles()`
  computes the whole set for any hue — `color` (fill), `onSurface` (type),
  `ink`, and the state roles `wash` (selected fill), `edge` (selected/focused
  edge), `ring` (focus ring) and `pressed` (a held fill, deeper). **On the house
  accent the state roles are built from `primaryText`, not the fill:** a 14%
  wash of `#0070CC` over near-black is *darker* than a resting control, which
  would make a selected pill the dimmest one in its row. See `HOUSE_STATES`.
- **Accent shifts by screen, through context, never by prop.** `useAccent()`
  returns the accent in force and defaults to the house blue, so a shared
  primitive reads it unconditionally. `<AccentProvider genres={…}>` wraps the
  four screens that are about one game — its page, its log form, its review, its
  achievements. **The feed, search, news, profile and the bottom tab bar stay on
  the house blue on purpose**: twenty games in a list is twenty hues, and colour
  identifies a game only when you are looking at that game.
- **A tinted surface is not a lighter one.** `tint()` in `lib/color.ts` mixes the
  hue in and restores the original luminance, so a tinted card measures the same
  as the grey it replaced (max drift 0.07, no AA verdict flips at any hue). Never
  reach for a plain `mix()` toward a hue for a surface — every hue in the ramp is
  far brighter than `#1C1C1C`, so a naive 7% mix reorders the surface steps.
- **Verify colour with `lib/color.ts`, not with your eyes.** `contrast()`,
  `ensureContrast()` and `readableInk()` exist so a value that is *not* ours — a
  platform's brand hex, a provider's tag — is lifted to 4.5:1 before it ships.
  Xbox's official `#107C10` is 2.0:1 on near-black; shipping it raw is an
  unreadable authenticity.
- **One score ramp.** `scoreColor()` in `constants/score.ts` returns
  `scoreHigh` / `scoreMid` / `scoreLow`. The old second ramp is gone: it used to
  return `success` / `accent` / `danger` while `<ScoreBadge>` used the score
  tokens on identical thresholds, so a 55 was amber in a metadata row and blue
  in a review. Amber won — a mixed game is mixed, and the house accent made a
  middling verdict look endorsed.
- **Colour is never the only carrier.** Every status, rarity and score ships its
  word or its glyph beside the hue (`STATUS_ICON`, `RARITY_BANDS.label`,
  `labelFor`). `statusBacklog` is deliberately pale because the dusty violet it
  replaced collapsed into `statusPlayed` under simulated protanopia. A
  *selected control* carries two non-hue signals too — its wash is lighter than
  the resting fill and its edge far brighter than the resting edge.
- **In-page tabs are pills, and there is one implementation.** `<TabBar>` is a
  scrollable row of uppercase pills at the reference's chip size (32 drawn, the
  row 15 in) — the selected one takes the accent's wash with its label in the
  accent, everything else is bare `textMuted` type on the page. News uses it
  too: it had a segmented icon dock of its own (`ui/dock.tsx`, now unused) until
  the owner asked for it to match the rest. No underline and no
  container hairline: a rule needs an edge to sit on, which read as a divider
  wherever the bar sat over artwork, and two pixels of it disappeared into a
  busy screenshot. Counts are **inline and neutral** (`ALL GAMES 135`); the red
  badge is opt-in via `alert`, for things genuinely unseen. The profile used to
  carry its own copy of this row and the two drifted the moment one was
  restyled — if a screen needs tabs, it uses `<TabBar>`.
- **Choices are outlined; actions are filled. Selection comes from
  `useSelectable()`.** Any control with an on/off state rests with no fill and a
  1px `outline` (16% white) and a `textSecondary` label, and when selected takes
  `accent.wash` inside, `accent.edge` around and a `text` label. Every action —
  a button, an icon key, a row that opens something — is the filled grey pill
  instead, so the two never read as the same kind of thing. `<SortBar>`,
  `<ChoiceChips>`, `<SelectionCard>`, the RSVP pills, vote buttons, segments and
  every screen-local toggle read the hook rather than restating it; a new one
  must too. **A single-choice list with words is a `<SelectionCard>`**: the
  owner's reference (SimpMusic's Server options), a 34dp circle on the
  *leading* edge that fills with the accent at 18% and holds a check when
  chosen, then the name (`optionTitle`) and its hint. Inside a selected control `textMuted`
  steps up to `textSecondary` (4.32:1 on the wash). The exceptions are
  deliberate: a **log status** fills with the status's own colour and the
  **platinum / spoiler toggles** light in theirs, because the colour is the
  datum; an **open disclosure** (a collapsible row) is an action, so it is
  grey-filled and brightens a step when open; and the game page's action row
  (Favourite / Wishlist / Progress / Collect) keeps its Material 3 tonal keys,
  on/off by `primaryContainer` fill, **glyph** and label.
- **Metadata chips stay grey, and have no edge.** A filter pill is the same
  shape with a 1px border, because a filter can be pressed and a fact cannot.
  Platform and genre chips are deliberately uncoloured: they were tinted once and it read as confetti under artwork that is
  already the loudest thing on the page. `<Chip color={…}>` exists for the cases
  where the colour *is* the datum — a rarity band, a status — and tints the label
  only, never the fill. A run of filled colour capsules reads as a row of buttons
  demanding to be pressed, and chips are not buttons.
- **The dealt card is the app's second depicted object, and the deck behind it is
  face down.** Surprise Me shows a stack: the card you are holding, and two
  behind it in the app's own material with no artwork and no glyph. `games[cursor
  + 1]` is already in memory, so drawing the next cover would be free and would
  spoil the surprise — which is the feature. Blank *is* the meaning of a
  face-down card. The card may lean (±7°) and catch light (0.16 peak), and the
  game case stays the ceiling on cast, gloss and turn; DESIGN.md § 4.2 states by
  how much. The deck belongs to that one screen — feeds and rails stay flat.
- **The ambient effect belongs on a game's own page and the review, nowhere
  else.** Not on rails, grids, feeds or any screen showing several games side by
  side: one glow per screen is atmosphere, eight is a lava lamp. `<Poster>`
  deliberately has no coloured-shadow prop — it was added, it looked like a
  sticker, it was removed.
- **Controls follow the owner's reference, SimpMusic — read from its code, not
  traced from screenshots.** `maxrave-dev/SimpMusic` is open source:
  `ListenTogetherScreen.kt` (the name field, "Create room", the disabled "Join
  room"), `ListenTogetherSettingsScreen.kt` (the Server options) and
  `AnalyticsScreen.kt` (the typography and spacing). Go back to those files
  before changing a control's measurements. DESIGN.md § 9 is the full statement.
  In short:
  - **Every action is the same grey pill** (`<Button>`): 52dp
    (`ControlHeight.medium`), `Radius.pill`, filled `controlFill` (#181818 on
    black), a small semibold label in `controlInk`. Variants change the label,
    not the object — `primary` a step brighter, `danger` red, `ghost` a bare
    text action. **Disabled** is the reference's disabled "Join room": no fill,
    a faint edge, a dimmed label. No default shadow.
  - `<IconButton>` is the round sibling: a circle in `controlFill`, no edge,
    drawn at 40/32 and touched at the floor through vertical slop.
  - **Fields** (`<TextField>`, `<SelectField>`, search, text areas) are one
    object: a soft well in `input` (#0F0F0F on black), **no border**,
    `Radius.input` (18), 54dp (`ControlHeight.field`), `fieldText` (13), a
    small `fieldLabel` above. Focus draws the accent's edge (1.5dp, as the
    reference's code boxes do); an error keeps it red.
  - **States are drawn, not faded.** `PressableScale` takes `pressedColor` (a
    fill eased in on the UI thread with the sink) and `focusRing` (a 3dp
    `accent.ring` outline for keyboard focus).
  - Filters, tabs and chips are pills. Small controls are drawn at
    `ControlHeight.small` with `SmallControlSlop`, and wrapped rows of them use
    `SmallControlRowGap` as their `rowGap` so the slop tiles and never overlaps.
  - Sheets, dialogs and menus: `Radius.sheet` (24), a hairline edge, a round
    close key.
  **What kept its own treatment:** the game page's Material 3 cluster (the vivid
  review button — `tone="vivid"`, the one `<Button>` that is not grey — the
  connected tonal action keys, platform keys), `<RoundAction>`,
  `<TopBarDisc>`'s frosted glass, the collection header's playlist-hero pill,
  the sign-in brand buttons (same pill shape, brand colours), meaning colours,
  and the physical objects. Do not "fix" them toward the rest.
- **Type and spacing follow the reference's Analytics screen.** Bold is for
  titles and figures only; everything that explains them is regular, smaller and
  quieter. A fact is a **quiet label over a bold value** (or a bold figure over a
  quiet line — "53" / "Songs played"), in **sentence case**: no uppercase,
  tracked micro-labels on a stat strip, a masthead fact or a notice. A row or a
  card in a list titles itself in `itemTitle` (13 semibold) with a `bodySmall`
  line under it. Sections sit ~32dp apart (`x32`) with ~16dp from heading to
  content (`<HomeSection>` uses `x16`, 15); a card's inset is ~15dp. The game page's
  sections are measured from SimpMusic's artist page instead, as fractions of
  the display — see the Overview bullet below. The studio page's banner is the worked example: the name, then the
  subject on the left (a bold figure over a quiet line) and one measurement on
  the right (label over value). **The side margin is the reference's 15**
  (`Spacing.x16`) — SimpMusic's Home, Library and every row use it; its
  Analytics screen's 24 is that screen's own. It was 10 while the interface was
  zoomed out, and it moved on every screen at once, rails included. **The game
  page's Overview tab is the one exception**: its sections sit at the artist
  page's 20 (to scale), rails included, so nothing inside it misaligns — the
  step is at the tab bar, between the masthead's 15 and the sections.
- **Ratings** are an integer 0-100 on `logs.rating`; `constants/score.ts` maps
  that to a verdict band ("Excellent", "Mixed") and a colour.
- **`logs.rating` is the only score anything reads.** A reviewer can score by
  category instead (`logs.review_metrics`, see `constants/review-metrics.ts`),
  but the client writes the mean into `rating` at the same time. Feeds, game
  averages, profile stats and share text all stay on `rating` and never need to
  know which way the score was entered.
- **No setState in effects.** The React Compiler lint rules are on and treat it
  as an error. To seed form state from a query, render a child with a `key` (see
  `app/log/[id].tsx`) rather than syncing in `useEffect`.
- **Reanimated shared values**: use `.get()` / `.set()`, never `.value =`. The
  React Compiler rules flag assignment to `.value` as mutating a captured
  binding; the accessors behave identically. See `ui/pressable-scale.tsx`.
- **Two families, and the line between them is a rule.** Inter is the
  *interface*: every label, button, tab, count and caption. **Source Serif 4 is
  reviews and nothing else** — a review's game title, its prose, and the
  writer's headline on a feed card (`reviewHeadlineSmall`; the card's
  three-line excerpt is sans since its redesign). The eight `review*` steps in
  `Type` are the serif's whole extent; reaching for one outside a review surface
  spends the distinction for nothing. The brief this came from names Tiempos and Graphik, both commercial
  and unshippable; Source Serif 4 and Inter are the open stand-ins. Every weight
  is its own family name — Android synthesises neither bold nor oblique from a
  custom font, so `fontWeight: '700'` on Inter silently renders regular.
  `proseInk` is the serif's ink: quieter than `textSecondary`, because a thousand
  words at interface brightness is a wall.
- **The fixed-colour surface ladder is on the page's faint cool trace.** The page is
  `#0B0A0D` — darker than the cool `#14171b` it replaced and not black — and
  `surface` (`#141317`), `surfaceElevated` (`#1B1A20`, the resting fill of every
  control), `surfaceSelected`, `input` and `skeleton` share its hue with slightly
  wider steps than before. The three text inks stayed neutral on purpose: the
  protected game case's back is set in them. Nothing on a game's own screens
  uses the ladder for surfaces — those derive them from the artwork through
  `accentRoles`.
- **Typography** goes through `<Text variant="…">` from `components/ui/text`,
  not raw `<Text>`. `Type` in `constants/theme.ts` and DESIGN.md's `typography:`
  frontmatter now agree, so either is safe to read and neither needs migrating.
  They did not agree for a long while, and the note that used to sit here sent
  new work at a *different* scale on purpose — that instruction is gone because
  the spec it pointed at is no longer the one this app is built on. Same for
  `Radius`: the frontmatter's `rounded:` block matches what ships.
- **A `fontSize` set outside `Type` brings its own `lineHeight`.** `<Text>`
  defaults to the `body` variant, so a style that overrides only `fontSize`
  keeps body's 18px line — and Android clips glyphs to their line box. The log
  form's 35px score showed only the middle band of each digit, and
  `<ScorePill size="large">` did the same at 25px. `<ScoreNumber>` and
  `<ScoreReadout>` set one now; anything else drawn larger than `Type` must too.
- **Actions are filled, choices are outlined, content takes a shadow.** An action
  is the grey `controlFill` with no edge; a choice is an `outline` with no fill
  until chosen; neither casts. A card of content takes `Elevation.card` and never
  an edge or the action grey — a review card that looked like either would read
  as one huge control.
- **`<Card style>` cannot lay out the card's contents.** It lands on the outer
  view (fill and shadow), whose only child is the inner view holding
  `children` — so padding works there and `flexDirection`, `gap` and
  `alignItems` silently do not. This is what stacked the community sheet's text
  *under* each cover instead of beside it, and what left a suggestion card's
  byline, text and reasons flush against each other. Put a `<View>` with the
  layout inside the card.
- **`Spacing.x*` names are step names.** Every step equals its name except
  `x16`, which is the page margin and is 15, the reference's. Read the value in
  `constants/theme.ts`; never infer it from the token name, and never "fix" a
  name to match its number.
- **Sizes are SimpMusic's, read from its code, at the owner's direction.** The
  spacing ladder is 4 / 8 / 12 / 15 / 20 / 24 / 32 / 40 / 48 / 64 and `Type` is
  the reference's `Typo.kt` one style per step (`h2` 20 is Home's shelf title,
  `h4` 16 the artist page's section heading, `body` 13, `caption` 11). The
  interface had been zoomed out ~8% (type) and ~17% (spacing) for density; that
  was undone. The controls were already at the reference's sizes on the old
  ladder (52dp buttons, 54dp fields, 15 inside a field) and were re-pointed so
  they kept them — a control's padding is not a page's rhythm, so check what a
  token resolves to before reusing it in one. `ControlHeight.small` is the
  reference's 32dp chip, and `<TabBar>` is drawn at it. `h6` and `label` stay at
  10: they are badges over art. **Artwork did not move**: see the next bullet,
  which is the whole point of art not riding the ladder. Corner radii were left
  alone — several were already the reference's (16 on a selection card, 18 on a
  field) and art corners are this app's.
- **A portrait is three across, and a row of games is the game page's
  franchise rail.** Every box-art grid is `PORTRAIT_COLUMNS` (3) wide — the
  collection, the studio, the library, and Search's results when their toolbar
  is flipped to the grid (the collection's own `<CollectionToolbar>`, given
  Search's sorts). At four a cover was ~84dp on a 360dp phone, a thumbnail of
  the box. Every *row* of games — Home's "Games for you" and "Releases", the
  studio's three rails, Search's "Most popular", "Similar to…" and "Highly
  rated" — is `<GameCoverRail>`: the franchise and editions rail from the game
  page, covers at the album height of the owner's reference with the title in
  two held lines and one quiet line under it (year, studio or rank). It replaced
  three rails with three sizes — the 92dp poster rail, Home's captioned card
  rail and Search's scaling chart carousel. `inset` puts the first cover in line
  with the heading on a screen that keeps the app's 15dp margin; `parallax` is
  Home's drift, kept. The Steam library rail on a profile is still sized by
  `usePortraitWidth()`. The profile's four favourites stay four — a set, not a
  grid.
- **Search has one "Similar to **<game>**" rail, from the game you reviewed
  last.** The heading is `<HomeSection lead="Similar to" title={…}>` — the
  title bold after a regular lead. It said "Because you loved/played …", split
  on a score of 80, which guessed at a feeling the rail does not depend on.
  `recommendationSeed` (`lib/news/recommendations.ts`, pure and tested) picks
  the most recently written-about or scored IGDB log, falling back to the
  latest log, and the rail is `getSimilarTo` for that seed under the game page's
  own `['similar', gameId]` key. The seed is read from `['user-logs', userId]`,
  so saving a review moves the rail on. It was a rail for each of the four
  best-rated games, which never moved and stacked four bands on a screen meant
  to be simple.
- **Artwork does not ride the ladder.** Cover, poster and case sizes are fixed dp
  in their components (`BOX_ART_WIDTH`, `POSTER_WIDTH`, the case's `WIDTHS`) or
  derived from the display (`usePortraitWidth`), never from `Spacing` —
  precisely so retuning `Spacing` or `Type` moves the interface and
  leaves the art where it is — the art is meant to be the largest thing on any
  screen. Grid covers go through `gridItemWidth()`, which subtracts spacing from
  the viewport, so tightening the ladder makes them *bigger*, which is the
  intent. The game case is pinned twice over: its own widths, geometry,
  `Type.caseTitle`/`caseEdition`, `Radius.caseImage`/`caseSpine`, its shadow and
  even its two internal paddings are all literals.
- **`<GameCase />` is for dedicated game pages only.** Game detail, log, review
  masthead, and future collection/shelf screens. It must never appear in a feed,
  review card, search result, notification, comment, list tile or any other
  social or list context — those all use `<Poster />`. The rule is intentional:
  social surfaces stay fast and flat; the case is what makes opening a game page
  feel like picking something off a shelf. Diluting it everywhere destroys that.
- **An award show is a fourth kind of list, and the only one whose rows exist
  before there is a game in them.** `list_awards` holds the ballot — a label, a
  position, a *nullable* `game_id` and the owner's reasons — because
  `list_items`' key is `(list_id, game_id)` and cannot express an empty slot. A
  named winner is mirrored into `list_items` by a trigger in 0016, which is what
  lets the tile mosaic, the item count, likes and "which lists is this game in"
  keep working without a single existing query learning that awards exist.
  **Never write `list_items` for an awards list from the client** — two
  categories may name the same game, and deciding when the last one lets go is
  the trigger's job. The eight seeded categories are a starting point, not a
  schema: every one of them, Game of the Year included, can be renamed,
  reordered and deleted, and `create_awards_list()` exists so a show can never
  arrive with half a ballot.
- **A captioned board is a fifth kind of list, and the caption is the content.**
  `kind = 'captioned'` renders three across with each cover under a line of the
  owner's own text — "Games that should… get a remake / be a TV show". The text
  lives in `list_items.note`, a 300-character column that has existed unused
  since 0003, so 0019 adds a *kind* and nothing else; see that file for why it
  reuses `note` rather than adding a `caption` column. No sort row: the
  arrangement is authored, so re-ordering it by release year is not a view of the
  same thing.
- **IGDB has no per-outlet critic scores.** `aggregated_rating` is one averaged
  number and a count — nothing in the schema says "IGN gave this 90". The named
  outlets come from OpenCritic through `functions/opencritic`, which needs
  `OPENCRITIC_API_KEY`; undeployed, `getCriticReviews` returns empty and the
  section is absent, exactly as ITAD prices are. The title is the only join
  available, so the match threshold is deliberately tight — a near-miss would
  print another game's reviews under this game's name.
- **`ratingVerdict()` grades a distribution; `labelFor()` grades one score.**
  They share a scale and make different claims, which is why the superlative
  bands ("Overwhelmingly Positive") need `CONSENSUS_FLOOR` ratings behind them.
  Three ratings of 95 is three people, not a consensus.
- **A remake is not the game, and the catalogue says so.** IGDB models this two
  ways and both are read: `game_type` for a release with its own catalogue entry
  (remake, remaster, port, DLC, expansion) and `version_parent` for a repackage
  ("Definitive Edition"), with `constants/game-editions.ts` collapsing fifteen
  IGDB categories into six words. The badge is near-black at 82% with white
  type, **never a hue** — colour on artwork belongs to the game itself, which is
  why `<Poster>` has no coloured-shadow prop either — and it is dropped under
  72dp, where a word would not fit above the 10px type floor. Franchise rails
  filter to originals (`ORIGINALS_ONLY`); the versions live on the parent's page
  under "Editions & extras", and a derivative's page swaps the franchise rail for
  its one original. `games.edition_kind` / `parent_game_id` (0017) carry the
  label into collections and feeds, where there is no IGDB response to read.
- **A profile's games are one shelf, not three widgets.** `<GamesWidget>` shows
  the five most recent covers as an overlapping staircase — each with a hairline
  and a short right-cast shadow, both load-bearing: without the outline two dark
  covers merge into one shape, and without the shadow the stack reads as a flat
  collage. It replaced a Steam-only library row *and* a four-number achievements
  block, which were two sections about the same library, and the first of which
  never appeared for anyone who had not linked Steam. Achievements and hours are
  now one caption line under the stack. `buildShelf()` merges logs with the
  Steam library, **logs winning on a tie** — a log carries a real catalogue id,
  so its art is IGDB box art rather than a Steam capsule that may not exist.
- **A collection is its first four covers, or the one its owner chose.**
  `<CollectionMosaic>` is the one artwork for a collection, at both sizes: a
  96dp block on `<ListTile>` and full-width behind `<CollectionHeader>`, and
  `lists.cover_style` (0033) says which it draws — `mosaic`, the first four items
  in `position` order, or `single`, the owner's `cover_game_id` (the menu's
  "Choose the cover", which switching to one cover opens straight away), falling
  back to the first item. Tapping the small one must land on the big one showing
  the *same* artwork, so the tile and the header resolve it the same way
  (`resolvePreview` / `singleCover`). Every tile is IGDB box art centre-cropped;
  the header's single cover is cropped to the banner and anchored a fifth of the
  way down, where a box's subject and logo sit. The header itself is a
  music-app playlist hero: ~44% of the display, the art tinted toward the page,
  then a long early fade into it, so there is no edge where the image stops. A
  database before 0033 has no `cover_style` at all, and every reader treats that
  as `mosaic`. A mosaic with only one cover to draw is shown as the single cover
  — banner crop, page colour and all — except on an award show, whose trophy is
  drawn over the mosaic. Under the header the body is SimpMusic's album body
  (`AlbumScreen.kt`): one column `bodyInset` in (32 to scale), the action row
  centred in it, then the description start-aligned across it — three lines and
  a More that opens in place — with "No description" in the same place and type
  when nothing is written. The rows *inside* a collection are a list of games and
  keep portrait box art.
- **Three ways to show a game, and they are not interchangeable.** `<GameCase />`
  on a game's own page; `<GameListItem />` for a row that needs a surface behind
  it (search results, feeds); `<CoverTile />` for a grid where the artwork *is*
  the screen — the Top 10, the News chart. A CoverTile has no card, no pill and
  no badge on purpose: wrapping covers in the app's rounded containers turns a
  wall of art into a list of buttons with pictures on them.
- **There is no header anywhere — native or otherwise.** `app/_layout.tsx` and
  `app/(tabs)/_layout.tsx` both set `headerShown: false`, and `<FrostedTopBar>`
  is no longer a bar: it is a **44dp disc of frosted glass holding a back
  chevron**, floated over the page through `<Screen topBar={…}>`. The full-width
  version cost `inset + 56` — about 111dp, 13% of an 844pt display — to carry one
  word and one chevron, and it blurred the top of every piece of key art in an
  app whose subject is artwork.
  **Screens therefore have no title and must state their own heading in
  content** if they open on a list or a form rather than on art; `award-edit` and
  `award-game` are the worked examples. `title`, `subtitle`,
  `revealTitleOnScroll` and `hideOnScroll` no longer exist as props — do not
  reintroduce them. Right-hand controls go through the exported `<TopBarDisc>`
  so both ends of the row are the same object; an `<IconButton>` there would be an
  opaque circle beside one of frosted glass.
  **Two screens carry no floating bar**: your own profile tab and Home. Home
  opens with an *in-flow* masthead row — wordmark, greeting, notification bell —
  which scrolls away with the content because a root tab has nothing to go back
  to. The profile tab has a fixed row of its own, Instagram's: the + (quick log
  or review, `quick-log`), your handle, and Settings, with the profile starting
  `x32 + x4` under it — the distance Home's greeting sits under its masthead.
- **The bar is a layer, not a surface.** Blur, then a scrim (22% on the disc,
  lighter than the old bar's 30% because it only has to carry one glyph), then
  the glyph — no `backgroundColor`, ever. It has nothing of its own to show; it softens
  what the page put behind it, which is why a page's ambience (`<SoftGlow>`,
  `<ScrollAmbience>`) belongs in `<Screen backdrop>` and never in the bar. Giving
  the bar its own gradient would put two ramps in the same column meeting at its
  bottom edge, which is a seam — the exact thing `<Ambience>` exists to avoid.
- **`<Screen topBar>` is a slot, not a child.** The bar blurs the page, so it has
  to be a *sibling* of the content it blurs and sit outside the `<BlurTargetView>`
  that `<Screen>` wraps around everything else. A bar rendered as a child would be
  inside its own blur source. It reserves no space, exactly like the header it
  replaced: screens leading with artwork (game, collection, review, profile,
  Top 10) let content run underneath, and everything else passes
  `<Screen insetHeader>`. Modals additionally pass `<Screen modal>` — an iOS sheet
  starts below the status bar and must not be inset again; see `useTopBarInset`.
- **Nothing hides on scroll any more.** The disc is small enough to stay put, and
  a back affordance that slides out of reach is a trap rather than a saving.
  `useTopBarScroll()` survives as a general-purpose UI-thread scroll offset,
  but the bar does not read it — nor does Home any more, since its corner glow
  (the one thing that faded against it) was removed — and roughly a dozen
  screens still call it and use nothing from it. That is an inert
  worklet write per frame: harmless, dead, and worth deleting the next time you
  are in one of those files.
- **Gradients end on `withAlpha(colour, 0)`, never `'transparent'`.**
  `expo-linear-gradient` interpolates through black on Android, so fading to the
  keyword leaves a grey bruise mid-ramp. `withAlpha` is in `constants/theme.ts`.
- **Picking a game is not browsing for one.** `<GameSearchResults>` holds the
  query, sort and load states; the *caller* owns the text field and decides what
  a tap does. No `onSelect` means the row links to the game page (Search tab);
  an `onSelect` means it returns the game (`add-to-list/[id]`). Never send a
  picker flow to `/search` — it has no idea what to do with the result, which is
  exactly how "Add games" managed to do nothing at all.
- **Sorting is `<SortBar />` plus `sortGames()`** (`lib/games/sort.ts`) for lists
  already in memory — studio catalogues, collections, search results. A linked
  Steam library is the exception and sorts in Postgres via `LibrarySort`,
  because it can be nine hundred rows. Sorting is a view: never write the new
  order back, and read a ranked collection's numbers from its stored sequence.
- **A game's screens run Material 3 dynamic colour, seeded by its box art.**
  `theme/dynamic-color.ts` turns one seed hex into the twenty-three M3 roles via
  `DynamicScheme` + `Variant.TONAL_SPOT`. **The tones are read off the palettes,
  not off the scheme's getters** — those implement whichever M3 spec revision the
  library defaults to (2021 today, whose dark `surfaceContainer` is tone 12, not
  the 20 this app wants), so `ROLES` in that file is the single statement of what
  the colours are and survives a library upgrade.
  `accentRoles(hue, { tonal: true })` is the bridge: it renames M3's roles onto
  the app's ten so the twenty-odd components already reading `accent.card` or
  `accent.elevated` got M3 colours without being edited —
  `page`→`background`, `card`→`surfaceContainer`, `elevated`→`surfaceContainerHigh`,
  `color`→`primary`, `ink`→`onPrimary`, `quietInk`→`onSurfaceVariant`. The full
  set is on `accent.m3` for the roles the ten have no name for
  (`primaryContainer`, the secondary/tertiary families, `outlineVariant`).
  **The masthead's selected states are `primaryContainer`, not `primary`**: the
  review button is the one filled `primary` on the screen, and a lit action key
  or platform key wearing the same tone would be a second primary action.
  `tonal: false` is the **house blue** — `primary` is a chosen brand colour
  on a fixed `background`, not a measurement, so the forty screens off a game
  page never move with any game.
  `npm test` asserts every role is a valid hex and that every ink/surface pair
  clears 4.5:1, across six seeds and both modes. Run it after touching `ROLES`.
- **`react-native-image-colors` must never be imported statically.** Its entry is
  a bare `requireNativeModule('ImageColors')` evaluated at import scope, and Expo
  Go ships only Expo SDK modules — so a static import throws while the module is
  *evaluating* and takes down everything that transitively imported it, exactly
  as `expo-notifications` did. `use-album-art-color.ts` loads it with a lazy
  `import()` behind a latching availability flag and falls back to
  `lib/artwork-color.ts` (pure-JS `jpeg-js`, works anywhere). Dev builds get the
  native extractor; Expo Go gets the decoder; neither branch is a degraded mode.
- **The game page, Surprise Me and a review have no gradient.** `<ScrollAmbience>`
  is gone from all three; they fill flat with `<Screen background={accent.page}>`.
  (The review page stayed a neutral dark room for a long time; it now runs on the
  game's colour like the other two, and its prose keeps `proseInk` on M3's
  darkest tone.) The
  gradient put the page's brightest colour directly behind the masthead, so
  every control there was competing with a backdrop made of its own hue — which
  is why so many notes in those files read "this measures 2.02:1 on the
  brightest stop". A flat page is a known quantity and gives the accent seven
  tone steps of headroom. Do not reintroduce it there. Home's light is
  `<AmbientLight>` alone — a very soft field in the **top-left corner**, fixed
  to the viewport, lighting the left of the screen and gone before the right
  quarter. That is the owner's brief and the position of the stronger corner
  `<SoftGlow>` it replaced; that glow was removed because it read as a lit
  corner rather than as light, and the soft light was briefly centred, which
  lit both sides. Keep it in the corner. It peaks at 0.42 of `glowCore` — about
  as bright as the reference's own top light — which puts `textMuted` under AA on
  its brightest pixels, so Home's greeting there is `textSecondary`; anything
  muted placed in that corner later needs the same step. `<SoftGlow>` itself
  survives for Surprise Me's bloom and swipe edge.
- **The game page's Overview tab is SimpMusic's artist page, section for
  section** — read from `ArtistScreen.kt`, `AdapterItems.kt` and
  `DescriptionView.kt`, at the owner's direction. Every section is a heading on
  the page (`h4`, the reference's 16sp bold) with its content under it, and
  what the content is decides its shape:
  - **Pictures → a rail, no card.** Screenshots, Featured in (events), Original
    game, Editions & extras and the franchise are `<Section>` + `<ArtRail>`
    (covers through `<GameCoverRail>`): the art, a two-line title always held
    open, one quiet line — the reference's "Singles" / "Albums". Covers are 2:3
    at the albums' height; 16:9 art is at its videos' height. The art keeps the
    app's `Radius.image`: the rails are SimpMusic's, the boxes are this app's.
  - **The object → on the page.** Platforms (`<GamePlatforms>`) is the one
    section that is neither: the game's box on the left — the console case for
    the chosen platform, which turns over to your record — and beside it the
    title, "is available on …", the platform `<DropdownButton>` and the price.
    No card, because its subject is an object, and the case casts its own
    shadow. **The case lives here, not in the masthead**: the masthead shows
    the plain cover, still (`PLAIN_COVER`), and has no gesture and no price.
    The section opens on the platform you logged, else the first with a case,
    else the first; its art slot reserves the tallest shape the game can show
    so switching PS5 → PC does not move the page.
  - **Words and figures → a card.** About, Where to buy, Your copy, Reviews,
    Time to beat, Developers, Additional information and Achievements are
    `<InfoCard>` (read) or `<InfoCardButton>` (a door, whose heading carries the
    reference's More and whose card is the same door). The card is the
    reference's description card: 8 in the corner, 16 in, filled with
    `primaryContainer` at half brightness — SimpMusic halves Palette's
    dark-vibrant swatch, and that is the tone the dynamic scheme holds.
  - **A heading's More** (`<SectionMore>`) is the reference's `TextButton`: one
    quiet word at the end of the heading row — all reviews, the copies, the
    Wikidata screen, the achievements. About's is "Details", the full IGDB
    record; its card has a More of its own that opens the synopsis in place.
  - **Sizes are fractions of the display** (`useSectionMetrics`): the
    reference's dp values over the 360dp phone it was measured on, where its
    180dp album art is exactly half the width. Type stays on `Type`. The
    Overview pads nothing sideways; `<SectionInsetProvider>` hands every
    heading, card and rail the reference's inset, so a rail runs edge to edge
    and still starts in line with its heading. Screens that pad themselves (the
    additional-information screen, the Similar tab) leave the inset at 0.
  - **A card that opens in place animates** (`<ExpandableText>`): the whole
    text is laid out and the *height of its window* moves, 250ms on
    FastOutSlowIn, the reference's own method — the clamp itself never
    changes, which is what stops the text being cut before the box catches
    up. Used by About, a collection's description, a similar pick's suggestion
    and an award's note. Lists that grow ("Show all 24") are not text and still
    step.
  Nothing here is `Radius.cardLarge` any more; the token survives for the
  `Card` panel variant and the welcome screen.
- **A hidden game is a promise, not a preference.** Double-tapping a cover in
  Surprise Me writes it to `lib/surprise-hidden.ts` and it never comes up again.
  **The card does not change when you hide it** — the gesture means "not in
  future", not "next please", so the game stays on screen and fully usable, a
  panel says so over the artwork for `NOTICE_MS`, and moving on stays the
  reader's choice. `excludeHidden` therefore runs inside `getSurpriseBatch` and
  **never over `batch.data` in the screen**; re-filtering there is what made the
  deck shorten under the cursor.
  `excludeHidden` is deliberately unlike `excludeLogged` beside it: that one
  abandons its filter rather than return an empty batch, which is right for
  "exclude games I've played" and wrong for an instruction given about one
  specific game. It is applied **last**, after every other filter, to every mode
  including `foryou`, and the only way back is the list in `app/settings.tsx`.
  The list is keyed `['surprise-hidden', userId]` and both writers `setQueryData`
  with the whole new list rather than invalidating — the store is a single
  AsyncStorage value, so the write already knows the answer.
- **Surprise Me's filters are catalogue filters, and `foryou` says so.** Genre,
  perspective and minimum rating become a `where` clause in `getSurprisePool`;
  "Based on my games" issues no such query, so `<SurpriseSettings>` replaces the
  whole group with one line explaining why rather than leaving it inert. Genres
  and perspectives match as **any of** (`(a,b)` in APIcalypse, never `{a,b}`) —
  ticking more boxes must widen, or a third genre silently empties the pool.
  Perspective ids are a local literal in `constants/player-perspectives.ts`
  because `player_perspectives` is **not** on the Edge Function's allowlist;
  genres are fetched, under the key `<GenreGrid>` already uses.
- **`<Link asChild>` needs a flattened `style` on its child.** Expo Router clones
  that child and throws rather than guess precedence when `style` is an array —
  "You are passing an array of styles to a child of `<Slot>`". Wrap it:
  `style={StyleSheet.flatten([a, b])}`. A `({ pressed }) => …` function style has
  the same problem; use `PressableScale` for press feedback instead.

## Linked gaming accounts

Steam is one implementation of a **generic provider**, not a special case. See
`lib/gaming/types.ts` for the contract and `supabase/functions/README.md` for
deployment, rate limits and verified API behaviour.

Adding Xbox/PlayStation/Epic/GOG is three steps: add the id to
`GAMING_PROVIDER_IDS` **and** `gaming_providers()` in migration 0009, implement
`GamingAccountProvider`, register it in `lib/gaming/registry.ts`. No screen gains
a conditional — the UI renders from `provider.capabilities`.

- **`provider` is text + CHECK, not an enum.** Deliberate: `alter type … add
  value` cannot be used in the same transaction that references the new value
  (the 55P04 trap that split 0006/0007), and this schema exists to have providers
  added later. An enum would guarantee that trap recurs every time.
- **The client cannot write `gaming_*` tables.** No INSERT/UPDATE policies exist.
  `external_id` is only trustworthy because `steam-auth` verified an OpenID
  assertion for it, so writes happen in Edge Functions with the service role.
  Clients SELECT (profiles are public) and DELETE their own rows (unlink).
- **Capabilities must stay honest.** `purchaseDates: false` for Steam is why the
  library hides the "recently purchased" sort — Steam exposes no purchase date
  anywhere. A sort that quietly fell back to last-played would misrepresent
  itself. Same reasoning applies to every other capability flag.
- **Never sync someone else's account.** Every `useGamingSync` call site guards
  on `isSelf`. Viewing a profile must not spend the shared Steam rate budget or
  refresh a stranger's presence on demand.
- **Sections sync independently** with their own TTLs, because `profile` is one
  request and `achievements` is two *per owned game*. `achievements_synced_at`
  doubles as the resume cursor.
- **Prices come from IsThereAnyDeal, across ~40 storefronts.** IGDB publishes no
  pricing at all. `lib/games/itad.ts` resolves a game to an ITAD id (Steam appid
  first, exact title as a fallback) and then asks for current deals; the key
  lives in the `itad` Edge Function, so prices need a signed-in session like
  everything IGDB. `fetchSteamPrice` survives for the masthead's per-platform
  line, where the question is "what does it cost on *this* platform" rather than
  "where is it cheapest". A store with no usable price is dropped rather than
  rendered blank, and a game ITAD does not track shows no section at all —
  never fill either gap from another platform's price.
- **No inventory pricing API, anywhere.** Inventory carries `market_hash_name` — the join
  key every price service uses — and nothing else. Adding valuation later must
  not require re-syncing or a schema change.

## Progress, physical copies, similarity and review filters (0022–0026)

Six systems that extend what was there rather than sitting beside it. The rules
that are easy to break:

- **A log is still the user↔game relationship; progress is two columns on it.**
  `status` (with `paused`, 0022) says where you are and `completion`
  (`story` / `main` / `full`, 0023) says the furthest you ever got. The seven
  choices in `constants/progress.ts` are named pairs of the two, and both the
  progress sheet and the log form write through them. **Completion only rises**:
  status-only choices leave it alone (`progressPatch`), and a playthrough that
  got further raises it by trigger. Never write it down from a playthrough.
- **Playthroughs are children of the log** (composite FK to `logs (user_id,
  game_id)`, cascading). One game, many runs, one log — a second log per run
  would split the review, the score and every count that assumes one row.
- **Game ≠ release ≠ copy.** `game_releases` is one platform/region/edition of a
  game, `release_barcodes` maps GTIN-14 codes onto it, and `owned_copies` is one
  person's box, with its own completeness and condition. "Copies", never
  "collection" — a collection is a curated list here. **No column anywhere holds
  a price, and none may be added**: condition describes wear, not worth.
- **Clients cannot write the canonical release tables.** Every write goes through
  the 0024 RPCs. A submission is a *claim*; it becomes canonical when a second,
  independent account files a matching one (`release_consensus_threshold()`, 2)
  or a moderator approves it. Two colluding accounts can therefore canonise a
  wrong release — moderation exists to reverse that, and a moderator is a row in
  `public.moderators`, written only from the SQL editor.
- **Barcodes are GTIN-14 on both sides.** `lib/barcode.ts` and
  `normalize_gtin()` agree; UPC-E is expanded using the scanner's own type
  (`scannerType`), since an eight-digit code alone is ambiguous with EAN-8.
- **ScanDex identifies; it never canonises.** `lookupBarcode` asks Gamelog's
  releases, then pending claims, and only then the `scandex` Edge Function. A
  ScanDex answer is a game and a platform with no region or edition, so it is
  shown as "Identified by ScanDex", prefills the copy and release forms, and is
  never written into `game_releases`. Its cache (`scandex_lookups`, 0027) has no
  policies and no grants — only the function's service role touches it — and the
  function refuses the anon key, which is a valid JWT, so the token's quota is
  spent only by signed-in people. A failure there must end at "unknown", never
  at an error on the scan screen.
- **Community similarity is its own section, never merged with IGDB's.** Pairs
  are stored once (`game_a < game_b`); suggesting a pair *is* voting for it.
  Votes from accounts with no logs are kept but not counted, ranking is the
  Wilson lower bound, and three open reports hide a pair until a moderator
  restores it. A positive vote with reasons or a comment is a **suggestion**
  (0029): it is listed on the pick's screen and can be upvoted by others, never
  by its author. Agreeing with the pair and upvoting someone's reasoning are
  separate acts and separate controls. A positive vote with neither reasons nor
  a comment is an **agreement** (the Agree button); every positive vote is
  exactly one of the two, which is what lets a pick say "3 users suggested this
  game, with 12 users agreeing" without counting anyone twice (0030). Deleting
  your suggestion deletes the vote, and the upvotes on it go with it.
- **A pick can be reported down; somebody's writing cannot.** Three open
  reports hide a pick (0025), because a pick is the community's claim and
  belongs to nobody. A suggestion or a review is one person's words, so reports
  on those (0031) only queue them: a moderator removes the *words* — a
  suggestion keeps its vote, a review keeps its log and score — or dismisses the
  reports, and removal is not reversible. Every flag opens `report/[kind]/[id]`
  and a flag reports the thing it sits on. Never report through `Alert.alert`:
  Android draws at most three buttons, and with three reasons plus Cancel it
  dropped Cancel, so the pick's old report dialog could not be dismissed.
- **Review filters are clauses on the request, never a sift on the phone.**
  `lib/review-facets.ts` says what "Finished" or "PlayStation" means and
  `getGameReviewList` spells it in PostgREST. A platform filter is a *family*:
  the client resolves the stored `played_on` strings (from `game_review_stats`)
  into families and sends the matching strings through `inList()` — never
  `.in()`, which does not escape a `"` in text somebody typed. A platinum counts
  as finished and 100% in both the filters and the stats.
- **Physical and digital never overlap.** `user_game_stats` (0028) counts a game
  with a physical copy as physical only; digital is the Steam library plus
  logged games (not the backlog), each game once. So the profile's
  "128 digital · 14 physical" adds up to the collection.
- **The disc is not the case's disc.** `<CdDisc>` draws `game_cd.png` over the
  art, with its geometry in `constants/cd-template.ts` (measured from the file);
  `<GameDisc>` and `DISC_TEMPLATE` belong to the protected case feature and are
  untouched. The copy showcase *uses* `<GameCaseDisplay>` as it is and composes
  its own gesture — tap for the disc, drag to turn — because `<GameCaseFlip>`'s
  tap already means "turn over". Its constants are copied, not changed.
- **Stored platforms are short forms; read them back with `familyForStored` /
  `platformKeyForStored`.** Everything the pickers write is `PLATFORMS[key].short`
  ("PS5", "SWITCH 2"). `platformFamilies()` matches *provider* names ("Nintendo
  Switch") and misses most short forms — it is for IGDB's lists, not for ours.

## This is React Native, not a web app

Worth stating because component snippets found online almost always assume the
opposite. There is **no DOM, no Tailwind, no NativeWind and no shadcn** here.
`src/global.css` defines four font variables for `react-native-web` and nothing
else — it is not a stylesheet.

A copy-pasted web component will not run. What has to change:

| Web | Here |
|---|---|
| `<div>`, `<span>`, `<button>` | `<View>`, `<Text>`, `<Pressable>` |
| `className` + `clsx`/`tailwind-merge` | `StyleSheet.create` + `useTheme()` |
| `motion/react` (`layoutId`, `animate`) | `react-native-reanimated` |
| `backdrop-blur` | `expo-blur`'s `<BlurView>` |
| `lucide-react` | `@expo/vector-icons`' Ionicons |
| CSS `:hover`, `focus-visible` | press states; there is no hover on a phone |

`components/ui/dock.tsx` is a worked example: it began as a Tailwind + `motion`
web component and the header comment maps every construct to what replaced it.
Port snippets that way rather than installing DOM libraries — `motion` and
`tailwind-merge` would bundle and then do nothing.

## Gotchas

- **An animated style's end value can be lost; commit the end state as a plain
  style.** Reanimated keeps an animated style's *first-render* value as the
  view's React props (`PropsFilter` snapshots it once). Later values live in its
  props registry, and 4.x hands a settled value back to React from a 500ms JS
  interval — but the native side deletes entries over 2s old *before* returning
  those over 1s old, so a JS stall of more than a second while something settles
  drops the end value, and the next re-render shows the first frame again. On the
  game page that was the review button and the action keys vanishing (opacity 0)
  and the case frozen mid-fall. `useLandingArrival` reports `landed` in React
  state so the caller adds the landed pose after the animated style (see
  `game-actions.tsx`'s `Arriving` and `game-case-flip.tsx`). `<SlideUpSheet>`
  does the same with its own `settled` flag — the quick-log progress sheet was
  sliding off-screen a second after it opened, when its data arrived and
  re-rendered it. Anything whose first frame differs from its resting state is
  exposed the same way; a slide between
  React-known positions (the tab bar's indicator) uses a Reanimated CSS
  transition instead, whose target is a React prop. The real fix is the static
  flag `FORCE_REACT_RENDER_FOR_SETTLED_ANIMATIONS`, which Expo Go cannot change.
- **Skia works in Expo Go, but only at the pinned version.** `@shopify/react-native-skia`
  is bundled with Expo Go for SDK 57 at exactly 2.6.2, which is what
  `package.json` holds. Install it with `npx expo install`, never a bare
  `npm install` — a newer version is a native mismatch Expo Go cannot load, and
  the failure is at runtime, not at build.
- **Skia on the web needs CanvasKit, so it is not used there.** The browser needs
  `LoadSkiaWeb()` and a multi-megabyte WASM binary before a single Skia
  component renders, which is a real cost for a real web target (`app.json` sets
  `web.output: 'static'`). `ui/soft-glow.web.tsx` is a CSS-radial-gradient
  fallback that Metro resolves automatically; a verified web export contains no
  CanvasKit at all. Any new Skia component needs the same treatment.
- **A blurred copy of a remote image is a second download on Android.**
  expo-image blurs with a Glide transformation, and Glide keeps two
  differently-transformed requests for one URL apart, so a sharp and a blurred
  `<Image>` mounted together both go to the network — every cold `<HeroArt>`
  fetched its 1080p art twice. `<HeroArt>` now mounts the blurred copy once the
  sharp one has loaded, when it decodes from the disk cache that load filled.
  iOS coalesces the two already. Anything else that stacks a blurred copy over
  the same remote image needs the same order.
- **A `<BlurView>` on Android does nothing without a `blurTarget`.** SDK 57
  changed the contract: `blurMethod: 'dimezisBlurView'` with no target silently
  falls back to `'none'` — a flat translucent slab, no blur, one console warning.
  The target is a `<BlurTargetView>` wrapping the content to be blurred, which
  `<Screen>` already renders; a bar inside a `<Screen>` picks it up from
  `useScreenChrome()` and needs nothing. If you add a blurred surface somewhere
  else, it needs its own target — and the target has to be a *sibling* of the
  blur, never its descendant. iOS and the web ignore all of this and sample what
  is behind them for free, so a broken target is a bug you will only see on
  Android.
- **The blur target must be held in state, not a `useRef`.** `BlurView` resolves
  it in `componentDidMount`/`componentDidUpdate` by comparing
  `prevProps.blurTarget?.current`. A ref is filled after first render and never
  causes a second, so the comparison never runs and the blur stays unconfigured
  for the life of the screen. `ScreenChromeProvider` uses a getter/setter object
  that looks like a `RefObject` and calls `setState` on assignment.
- **A page-wide backdrop goes in `<Screen backdrop>`, not in its children.**
  The safe-area inset is applied to the container children sit in, so even an
  `absoluteFill` child begins below the status bar and ends up drawing a hard
  line across it. The `backdrop` slot renders outside the inset.

- **Never `import` `expo-notifications` at module scope.** Its entry point pulls
  in `DevicePushTokenAutoRegistration.fx`, a side-effect module that registers a
  push-token listener *while evaluating*, and that call throws on Android under
  Expo Go (push was removed from Expo Go in SDK 53). One static import took down
  every module that transitively imported it — the News tab went blank and Expo
  Router reported `news.tsx` "missing the required default export", because the
  module had thrown before assigning any. `lib/reminders.ts` loads it with a
  lazy `import()` behind `remindersAvailable`; keep it that way.
- **Preload icon fonts; do not let `@expo/vector-icons` fetch them lazily.**
  `createIconSet`'s `componentDidMount` does a bare `await Font.loadAsync(font)`
  with no `catch`, so each mounted icon fires its own request and each failure is
  an unhandled rejection — 44 `<Ionicons>` in this app meant 44 of them. The root
  layout calls `useFonts(Ionicons.font)` and holds the splash screen; once the
  family is registered, `componentDidMount` short-circuits and never fetches.
  Pass `Ionicons.font`, never a hand-written `{ Ionicons: … }` — the real family
  name is lowercase `ionicons`.
- **IGDB never talks to the client.** Its Twitch `client_secret` cannot ship in
  a bundle, so `lib/games/igdb.ts` calls the `igdb` Edge Function via
  `supabase.functions.invoke`. That also means IGDB only works for signed-in
  users — fine, since every search screen is behind the auth guard.
- **Platinums are self-reported.** No console publishes a trophy API; PSN in
  particular has nothing public. `logs.platinum` is a plain boolean the user
  ticks. Only Steam can be genuinely synced, via a Steam Web API key plus a
  public profile — and Steam's API returns an *error*, not an empty list, when
  the profile is private.
- **A platform family is not an IGDB platform.** IGDB publishes 200+ platforms;
  `PlatformKey` collapses them onto ~35 families a player would actually name,
  through the substring table in `constants/platform-cases.ts`. **Order in
  `PATTERNS` is load-bearing and a mistake there is silent** — every entry is a
  valid key, so nothing type-errors. Two traps already caught: `'nes'` matches
  inside "Ge**nes**is", so the Sega row must precede the NES row; and a bare
  `'xbox'` is the *original* console, so "xbox series"/"xbox one" go first.
  Verify a change by sweeping real IGDB platform names through `platformKeyFor`,
  not by reading the table. An unmatched name becomes `other` rather than being
  dropped — silently discarding it made the switcher claim a game was PC-only.
  **Only the four console families have cases**; everything else renders the bare
  cover, and `externalCategory`/`storeLabel` are `null` unless the id has been
  verified against the live API, because a wrong one sends people to the wrong
  storefront.
- **Three IGDB endpoints beyond `games`.** `game_time_to_beats` — **plural**,
  like every IGDB path; the singular 404s — is keyed on `game_id` and returns
  **seconds** (not minutes — that guess puts every game at 60× its length); `events` is filtered on its own `games` array, since IGDB
  exposes that join in one direction only and there is no `game.events` field to
  add to `GAME_FIELDS`. `age_ratings` and `language_supports` moved from integer
  enums to referenced rows — expand `rating_category.rating`,
  `organization.name` and `language.name`, or a client mapping the old integers
  gets nothing back and no error.
- **The rating breakdown is the app's own scores, never IGDB's.** The masthead
  already carries IGDB's aggregate as `COMMUNITY`; `getRatingBreakdown` reads
  `logs.rating` and is a separate query from `getGameReviews` on purpose — that
  one caps at 50 rows and joins profiles because it renders cards, so tallying it
  would print "up to fifty" as the total.
- **IGDB has no achievement data at all.** Every game added through search now
  shows zero achievements. Only legacy `steam:` rows and games matched out of a
  linked Steam account still resolve definitions — the game page treats an empty
  list as "no achievements tracked", not as an error.
- **Allowlisting an IGDB endpoint in source does nothing until the function is
  redeployed, and the failure is a feature that is silently missing.** This has
  now bitten twice. `ALLOWED_ENDPOINTS` in `functions/igdb/index.ts` is checked in
  the *deployed* Deno function, so a new entry is inert until
  `supabase functions deploy igdb`; until then the endpoint returns
  400 `Endpoint "…" is not allowed`, `igdbQuery` throws, and any query with
  `retry: false` resolves to `undefined` — indistinguishable from "IGDB has no
  data for this game".
  - **The Top 10** (`popularity_primitives`) catches the rejection and falls back
    to the most-rated releases of the past year — a *different* ranking, which is
    why it returns a `basis` the screen footnotes rather than one fixed claim.
  - **Time to beat** had no such fallback and simply never appeared:
    `<TimeToBeatWidget>` renders `null` on no data, so a failed request looked
    exactly like a catalogue with no submitted times. **And redeploying did not
    fix it**, because the allowlist was not the only fault: the path was spelled
    `game_time_to_beat`, which IGDB answers with a 404. Once redeployed, the
    request got past the allowlist and failed one hop later, at IGDB, looking
    identical on screen. The path is `game_time_to_beats`.
    **Verify a new endpoint by calling the deployed function, not by reading the
    allowlist** — `curl` it with the anon key as the bearer (the function checks
    the JWT, not the user); a 400 means the allowlist, a 502 wrapping an IGDB 404
    means the path. IGDB's schema is published at
    `https://api.igdb.com/v4/igdbapi.proto`, and every `…Result` message there
    names its endpoint's plural. `api-docs.igdb.com` refuses automated fetches.
    `<GameStatsStrip>` separates the two cases on screen — an "unavailable" label
    for a failed request, a "not found" one for a real absence — which is the only
    visible sign of which one you are looking at.
- **Steam's undocumented store endpoints are no longer called for search.**
  `lib/games/steam.ts` stays for id lookups only, keeping its CORS limitation
  (`npm run web`) and its ~200 req / 5 min rate limit off the hot path.
- **RLS is the only authorization.** The anon key ships in the bundle; it is
  powerless *only* because of the policies in the migration. If you add a table,
  add its policies in the same migration.
- **`typeof document !== 'undefined'` is false on a phone.** React Native aliases
  `global.window` to `global` and never defines `document`, so a "do I have a
  DOM" test is `false` on iOS and Android — not just in the Node prerender it was
  written for. Gating the auth storage adapter on it made every AsyncStorage call
  a no-op on device, and auth-js's `getSession()` reads the session **from
  storage and nowhere else** when `persistSession` is true (`inMemorySession` is
  only consulted when it is false). The result is the nastiest shape a bug can
  take: sign-in succeeds, `onAuthStateChange` fires from the sign-in response,
  the store fills in and the auth guard lets you through — while every PostgREST
  request goes out with the anon key, `auth.uid()` is null, and unrelated-looking
  RLS failures appear on `lists`, `games` and any SECURITY DEFINER function that
  checks the caller. Ask "is this storage safe to call here"
  (`Platform.OS !== 'web' || hasDOM`), never "is there a DOM".
- **A signed-in UI is not proof of a signed-in database.** When a write fails RLS
  but the app thinks you are signed in, check the session the *client* would
  send, not the policy: `supabase.auth.getSession()` returning null with the app
  showing you as signed in means the request is arriving anonymous, and no
  amount of policy editing will fix it.
- **`Relationships` in `database.types.ts` is not decoration.** supabase-js reads
  it to type embedded selects (`select('*, profile:profiles(*)')`). Leave it `[]`
  and every embed resolves to `SelectQueryError` instead of the joined row. Add
  an `FK<…>` entry for each foreign key you actually embed across.
- **A table whose primary key holds two foreign keys is a join table to
  PostgREST**, whether you meant one or not. It infers a many-to-many
  relationship through it, and if the two tables it links were already related
  directly, every unhinted embed between them becomes ambiguous and is refused
  (PGRST201, "more than one relationship was found"). 0031 keyed
  `review_reports` on `(log_id, user_id)` and took down every
  `profile:profiles(*)` on `logs` — the feed, profiles, the review page, every
  review list — until 0032 gave it an `id` key. A table that only *records*
  something about a pair (a report, a vote, a flag) gets its own `id` primary
  key and a UNIQUE constraint on the pair; PostgREST reads only the primary key,
  and `upsert(..., { onConflict })` works against the unique constraint just the
  same. `game_similarity_reports` (0025) and `game_similarity_upvotes` (0029)
  still have the junction shape; nothing embeds `profiles` from pairs or votes
  today, and the first thing that does must name its key (`profiles!…_fkey`).
- **Likes and comments are polymorphic** over `(target_type, target_id)`, and
  since 0018 both work on logs **and lists** — the two CHECK constraints used to
  differ deliberately and no longer do. Postgres cannot FK a polymorphic column,
  so integrity is enforced by the `assert_target_exists` trigger. **Widening a
  CHECK means checking three things, not one**, which is what 0018 exists to
  demonstrate: `assert_target_exists` (or a like/comment points at a row that
  does not exist), `notifications.target_type`'s own CHECK (or the AFTER INSERT
  notification trigger raises 23514 and takes the comment down with it, in the
  same transaction, reporting the wrong table), and `target_owner()` (or the
  recipient resolves to null and *nobody is notified*, silently — which is
  exactly what happened to every like on a collection between 0013 and 0018).
  `TargetType` is declared **once**, in `database.types.ts`; `api/types.ts`
  re-exports it. It was declared twice, and the copy silently kept `list` out of
  the barrel.
- **Emphasis in user-written text goes through `<RichText>`**, which understands
  `**bold**`, `*italic*` and `***both***` and nothing else. It is deliberately
  not markdown — see the component's own docblock for why headings, links and
  images are each a liability here. Italic is a **family** (`FontFamily.italic`),
  never `fontStyle: 'italic'`: a custom font has no oblique for Android to
  synthesise, so the property is the same silent no-op `fontWeight` is.
- **The per-game diary was removed from the app.** Dated notes per game
  (`diary_entries`, migration 0011) had a route, a composer, a card on the game
  page's Overview tab, a `diary` kind on the wall's derived activity and its own
  `lib/api/diary.ts`. All of it is gone; PRODUCT.md explicitly declined to name it
  a differentiator, which is the licence that was spent here.
  **The `diary_entries` table still exists** — nothing was dropped and no
  migration was written, exactly as with `posts` below — and `database.types.ts`
  carries a note where its row type was, because a row type is the first thing
  that would let something start reading it again.
  **What survived is `game-stats/[user]/[game]`**, which was the diary route's
  *second* tab and is a different feature: one person's log plus Steam's measured
  figures for one game. It has two live entry points (a library cover, a profile's
  Steam rail) and was renamed off the `/diary/` path because a route spelled that
  way would be the last mention of a feature that no longer exists.
- **User posts and articles were removed from the app.** The composer, the
  article reader, `PostCard`/`ArticleCard`, `MediaCarousel`, the post+log union
  feed and the whole post API are gone; `posts.ts` became `engagement.ts`
  because likes and comments were never part of that feature. **The `posts` and
  `post_media` tables still exist** — nothing was dropped and no migration was
  written — and `TargetType` no longer includes `'post'` even though the column
  and its CHECK still accept it. Two things that survive and are easy to confuse
  with it: **the wall** (`wall_posts`, a different table, still live) and
  **News** (`lib/news/`, RSS from real outlets, which has its own `ArticleCard`
  in `news-cards.tsx`).
- **Notifications are written by triggers, never by the client.** There is
  deliberately no INSERT policy on `notifications`; only the SECURITY DEFINER
  functions in 0003 can create them, so a user cannot forge one.
- **Storage paths must start with the user id** (`media/<uid>/…`). The storage
  RLS policy authorises writes by reading that first path segment, so uploading
  anywhere else is rejected.
- **The app can be a migration ahead of its database.** Migrations are run by
  hand in the SQL editor, so a column a newer migration adds to an RPC's result
  may simply be absent — not null, *absent* — on a database that has not run it.
  Reading one as a number is a crash, not an empty state: the community sheet
  went down on `suggesters.toLocaleString()` against a database at 0029. Make
  such fields nullable in the type, turn a missing one into `null` in
  `lib/api/` (see `withSuggestionFields`), and give the screen something it can
  say without it.
- **The colour extractor only decodes thumbnails.** `lib/artwork-color.ts`
  decodes JPEGs in JavaScript, on the JS thread, so its cost is the pixel count:
  a 90×90 IGDB `t_thumb` is nothing, and a 600×900 Steam `library_600x900.jpg`
  froze the app for seconds on every legacy game's page. `swatchUrl()` maps IGDB
  to `t_thumb` and Steam to `capsule_sm_120.jpg`, returns null for any other
  host (the genre hue takes over), and the decoder is capped at 0.1 MP and
  120 KB. Never feed it a URL it has not shrunk.
- **Performance traps that have already cost this app.** A one-item `FlatList`
  wrapping a whole page (`data={[null]}`) re-renders its page-sized cell whenever
  `renderItem` changes identity — which, as an inline arrow, is every render; use
  a `ScrollView` unless the content is genuinely a list. An inline
  `ItemSeparatorComponent={() => …}` is a new component type per render and
  remounts every separator on screen. And a page that holds its sheets' open
  flags in its own state re-renders itself to open one: the game page keeps them
  in a small store `<GameSheets>` subscribes to. Performance warnings from Expo Go
  are measured in **dev mode**, several times slower than a release build — judge
  speed with `npx expo start --no-dev --minify`.
- **The path contains a space** (`claude code app/`). Fine for Expo Go, but
  Android Gradle builds historically break on it. If you ever run
  `expo prebuild` / a local native build and see odd path errors, rename that
  folder to `claude-code-app`.

## 🛡️ Critical Preservation Rules
- **DO NOT MODIFY**: The "physical videogame cases" feature logic, styles, or components.
- **Protected Tokens**: Do not alter any design tokens related to `game-case-*`, `physical-item-*`, or `case-dimensions`.
- **Verification**: Before finalizing any refactor, explicitly confirm that the videogame case feature remains visually and functionally identical to the pre-refactor state.   