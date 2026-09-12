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
npm test           # node:test — the Material 3 scheme generator
```

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
   `0006`, `0015` and `0019` each add an enum value and must run **alone** —
   see the notes in those files.
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
    list/[id]        a list / tier list / award show
    add-to-list/[id]   pick a game to add to that list (modal)
    award-game/[id]    pick the winner of one award (modal)
    award-edit/[id]    name an award, or say why it won (modal)
    comments/[type]/[id]  comment thread for a post or log
    profile/[id]     someone else's profile
    new-list, edit-list/[id], edit-profile (modals)
    settings         one real section: the games hidden from Surprise Me. It was
                     deliberately empty for a long time and the argument in its
                     docblock still stands — nothing goes here until it works
    surprise         Surprise Me: one dealt game, one song from it
    sign-in, sign-up
  components/        shared UI; components/ui/ is the primitive layer
                     ui/frosted-top-bar a floating 44dp disc of glass holding the
                                        back chevron. Not a bar; see § Conventions
                     award-show / award-slot  an award ballot, and one row of it
                     game-filter-bar    genre / platform / studio / year pills
                     game-lineage       original game / editions & extras
                     game-insights      rating histogram, time to beat, events
                     game-details-sheet the full IGDB record, behind a button
                     add-to-collection  pick which collection a game joins
                     store-prices       where to buy, from IsThereAnyDeal
                     ui/soft-glow       Skia radial glow (+ .web.tsx fallback)
                     ui/scroll-ambience scroll-driven page gradient (+ .web.tsx)
                     collection-mosaic  a collection's first four covers, 2x2,
                                        each square (SteamGridDB, IGDB crop below)
  constants/         theme tokens, log-status vocabulary, the identity ramp
                     (identity.ts: genre → hue), rarity bands,
                     game-editions.ts (remake/remaster/DLC labels) and
                     stores.ts (storefront brand marks)
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
    api/             everything that talks to Supabase, split by domain
      core.ts        games cache, logs, profiles, follows, achievements
      engagement.ts  likes and comments (was posts.ts)
      lists.ts       lists, tier lists, favourites, wishlist
      awards.ts      award shows: the ballot and its slots
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
                     0019 captioned list kind
                     (0006, 0015 and 0019 each add an enum value and must run
                      alone — see those files)
  functions/igdb/    Edge Function proxying IGDB
  functions/opencritic/  per-outlet critic scores; IGDB has none
  functions/itad/    Edge Function proxying IsThereAnyDeal (prices)
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
Reviews tab (`<ReviewListRow>`, 80dp), the collection mosaic
(`<CollectionMosaic>`, per tile) and Surprise Me. The mosaic is the one where the
crop was *structural* — every quarter of that shape is a square. **The rows
inside a collection are not a square surface** and keep portrait box art; square
art belongs to the mosaic shape, not to collections.

**There is no per-platform lookup, and rebuilding one against this API will not
work.** The game page briefly asked for the selected platform's own box front.
`/grids/{platform}/{id}` takes *store* slugs — `steam`, `gog`, `egs`, `origin`,
`eshop` — not console families, so `playstation` and `xbox` had no endpoint to
resolve against and every console tap spent a request to fall back to the cover
it already had. The switcher re-draws the case's spine, the price and the store
link; the artwork is IGDB's.

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

## Conventions

- **State**: server data → TanStack Query; auth session → the zustand store.
  Do not duplicate server data into zustand.
- **Query keys** are used for invalidation across screens — grep before renaming
  one. `['feed']`, `['my-log', userId, gameId]`, `['game-reviews', gameId]`,
  `['user-logs', userId]`, `['profile-stats', profileId]`.
- **Colours**: always `useTheme()`. Never hardcode a hex in a component; add the
  token to `Colors.dark` in `constants/theme.ts` — that object is the entire
  palette. There is no `Colors.light`: `APP_SCHEME` is `'dark'` and `useTheme()`
  returns `Colors[APP_SCHEME]`. This app is a dark room by design and a light
  counterpart would be a second product.
- **The room is dark; the light comes from the games in it.** The chrome is
  still greyscale — surfaces, rules, body copy, every control that is not the
  primary one — and separation is still by surface step (`background` →
  `surface` → `surfaceElevated` → `surfaceSelected`) plus a hairline `border`.
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
  `#0070CC` is 3.74:1 on the page — correct under white on a filled button,
  below AA the moment it becomes a word. Blue *fills* use `primary`; blue *type*
  uses `primaryText`. The same split is computed for any hue by `accentRoles()`,
  which returns `color` (fill) and `onSurface` (type).
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
  replaced collapsed into `statusPlayed` under simulated protanopia.
- **In-page tabs are pills, and there is one implementation.** `<TabBar>` is a
  scrollable row of uppercase pills — the selected one takes a 14% white wash,
  everything else is bare `textMuted` type on the page. No underline and no
  container hairline: a rule needs an edge to sit on, which read as a divider
  wherever the bar sat over artwork, and two pixels of it disappeared into a
  busy screenshot. Counts are **inline and neutral** (`ALL GAMES 135`); the red
  badge is opt-in via `alert`, for things genuinely unseen. The profile used to
  carry its own copy of this row and the two drifted the moment one was
  restyled — if a screen needs tabs, it uses `<TabBar>`.
- **Selection is one step lighter, never a colour.** Any control with an on/off
  state goes `surfaceElevated` → `surfaceSelected` for the fill, `border` →
  `borderStrong` for the edge, and `textSecondary`/`textMuted` → `text` for the
  label. `<SortBar>`, the search mode switch, tag pickers and RSVP buttons all
  follow it; a new one should too. Two sets of exceptions, both on screens that
  already run on a game's own colour: `<TabBar>` and the bottom nav, which answer
  "where am I" rather than "what is set"; and the game page's action row
  (Favourite / Wishlist / Playing / Played / Share), which is **solid accent in
  both states**, matching the primary button below it — a grey strip above a
  coloured button read as disabled. With no fill left to change, those five carry
  on/off on the **glyph** (outline vs solid) and the **label** (`textSecondary` →
  `text`). Two carriers, neither of them hue.
- **Metadata chips stay grey.** Platform and genre chips are deliberately
  uncoloured: they were tinted once and it read as confetti under artwork that is
  already the loudest thing on the page. `<Chip color={…}>` exists for the cases
  where the colour *is* the datum — a rarity band, a status — and tints the label
  only, never the fill. A run of filled colour capsules reads as a row of buttons
  demanding to be pressed, and chips are not buttons.
- **The ambient effect belongs on a game's own page and the review, nowhere
  else.** Not on rails, grids, feeds or any screen showing several games side by
  side: one glow per screen is atmosphere, eight is a lava lamp. `<Poster>`
  deliberately has no coloured-shadow prop — it was added, it looked like a
  sticker, it was removed.
- **Buttons are `<Button>` and `<IconButton>`.** Every interactive rectangle is
  `Radius.control` — that shared shape is most of what makes them a family, so
  `Radius.pill` is reserved for progress tracks, badges, avatar rings and
  `<Chip>`. A chip staying a pill is deliberate: shape is the only thing left
  distinguishing metadata from a control. `<Button>` is **filled and never
  outlined** (three styles: primary, secondary, ghost — plus a danger *label*,
  not a red slab); an outline would be a fourth signal in a system that already
  separates by surface step. `<IconButton>` is the one exception and carries a
  `StyleSheet.hairlineWidth` edge in `border`, except in its `plain` tone.
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
  reviews and nothing else** — a review's game title, its prose, and its excerpt
  in a feed card. The seven `review*` steps in `Type` are the serif's whole
  extent; reaching for one outside a review surface spends the distinction for
  nothing. The brief this came from names Tiempos and Graphik, both commercial
  and unshippable; Source Serif 4 and Inter are the open stand-ins. Every weight
  is its own family name — Android synthesises neither bold nor oblique from a
  custom font, so `fontWeight: '700'` on Inter silently renders regular.
  `proseInk` is the serif's ink: quieter than `textSecondary`, because a thousand
  words at interface brightness is a wall.
- **The fixed-colour surface ladder is on the page's hue.** `surface`
  (`#181C1F`), `surfaceElevated`, `surfaceSelected`, `input` and `skeleton` were
  neutral greys on a cool near-black page; they now share its hue at their own
  original lightness, so the ladder's *spacing* is untouched and only its
  temperature moved. Nothing on a game's own screens uses any of it — those
  derive their surfaces from the artwork through `accentRoles`.
- **Typography** goes through `<Text variant="…">` from `components/ui/text`,
  not raw `<Text>`. `Type` in `constants/theme.ts` and DESIGN.md's `typography:`
  frontmatter now agree, so either is safe to read and neither needs migrating.
  They did not agree for a long while, and the note that used to sit here sent
  new work at a *different* scale on purpose — that instruction is gone because
  the spec it pointed at is no longer the one this app is built on. Same for
  `Radius`: the frontmatter's `rounded:` block matches what ships.
- **Elevation, not borders.** Reach for `Elevation.card` before a `borderWidth`.
- **`Spacing.x*` names are step names, not dp values.** The ladder has been
  compressed twice to scale the chrome down — `x16` is 10, `x24` is 15, `x48` is
  30. Only `x4` still equals its name. Read the value in `constants/theme.ts`;
  never infer it from the token name, and never "fix" a name to match its number.
- **The interface was zoomed out ~8% (type) and ~17% (spacing from `x12` up),
  together, on purpose.** The target was density — a review excerpt was getting
  five lines before it ran out of card. `caption` and `label` held at the 10px
  floor, which is why the type half is only 8%: tighten it again and it comes out
  of `display` through `body`, never out of the floor. `Spacing.x4`/`x8` held for
  the same kind of reason — they are the intervals *inside* a pair, where there
  was no air to reclaim. **Artwork did not move**: see the next bullet, which is
  the whole point of art not riding the ladder.
- **Artwork does not ride the ladder.** Cover, poster and case sizes are fixed dp
  in their components (`BOX_ART_WIDTH`, `POSTER_WIDTH`, `RAIL_POSTER`, the case's
  `WIDTHS`) precisely so retuning `Spacing` or `Type` moves the interface and
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
- **A collection is its first four covers.** `<CollectionMosaic>` is the one
  artwork for a collection, at both sizes: a 164dp block on `<ListTile>` and
  full-width behind `<CollectionHeader>`. Tapping the small one must land on the
  big one showing the *same four covers*, which is why both read items in
  `position` order rather than using the owner's chosen `cover_game_id` — that
  still picks `preview`, which is a different question ("what represents this")
  from what the mosaic answers ("what is in this"). **Each tile is square art,
  not a square crop** — this is the shape where the crop was structural, since
  every quarter of it is a 1:1 slot. `<Tile>` resolves its own cover through
  `useSquareCover()` and falls back to the cropped IGDB cover per tile, so a
  mixed collection draws some composed squares and some crops rather than waiting
  on the slowest lookup or refusing the feature to every game SteamGridDB has not
  heard of. The rows *inside* a collection are a list of games and keep portrait
  box art.
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
  so both ends of the row are the same object; an `<IconButton>` there would be a
  rounded rectangle on a fill beside a circle of glass.
  **Two screens carry no bar at all**: both profiles' owner tab and Home. Home
  instead opens with an *in-flow* masthead row — wordmark, greeting, notification
  bell, settings — which scrolls away with the content because a root tab has
  nothing to go back to and a floating layer there would be reserving space for
  two icons.
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
  `useTopBarScroll()` survives as a general-purpose UI-thread scroll offset —
  Home's ambient glow fades against it — but the bar does not read it, and
  roughly a dozen screens still call it and use nothing from it. That is an inert
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
  `tonal: false` is the **house blue** and is unchanged — `primary` is a chosen
  brand colour on a fixed grey `background`, not a measurement, so the forty
  screens off a game page move not at all.
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
- **The game page and Surprise Me have no gradient.** `<ScrollAmbience>` is gone
  from both; they fill flat with `<Screen background={accent.page}>`. The
  gradient put the page's brightest colour directly behind the masthead, so
  every control there was competing with a backdrop made of its own hue — which
  is why so many notes in those files read "this measures 2.02:1 on the
  brightest stop". A flat page is a known quantity and gives the accent seven
  tone steps of headroom. Do not reintroduce it there; `<SoftGlow>` on Home is
  unaffected.
- **The game page's Overview tab is cards, and `<InfoCard>` is the one
  implementation.** Every section on it — About, Studios, Reviews, the insight
  widgets, Where to buy, Editions, Franchise, Achievements, the diary — is
  an `<InfoCard>` (read) or an `<InfoCardButton>` (a door), each stating its own
  subject in an `h6` title. **Screenshots is the deliberate exception**: the art
  is the content and a frame around a frame is a box in a box. `Radius.cardLarge`
  (18) is theirs alone and is deliberately far from `Radius.control` (6) — a
  container must not share the corner of the buttons inside it.
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
- **Three IGDB endpoints beyond `games`.** `game_time_to_beat` is keyed on
  `game_id` and returns **seconds** (not minutes — that guess puts every game at
  60× its length); `events` is filtered on its own `games` array, since IGDB
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
- **The Top 10 needs `popularity_primitives` allowlisted and the function
  redeployed.** Until then `getPopularGames()` catches the rejection and falls
  back to the most-rated releases of the past year — a *different* ranking, which
  is why it returns a `basis` the screen footnotes rather than one fixed claim.
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
- **The path contains a space** (`claude code app/`). Fine for Expo Go, but
  Android Gradle builds historically break on it. If you ever run
  `expo prebuild` / a local native build and see odd path errors, rename that
  folder to `claude-code-app`.

## 🛡️ Critical Preservation Rules
- **DO NOT MODIFY**: The "physical videogame cases" feature logic, styles, or components.
- **Protected Tokens**: Do not alter any design tokens related to `game-case-*`, `physical-item-*`, or `case-dimensions`.
- **Verification**: Before finalizing any refactor, explicitly confirm that the videogame case feature remains visually and functionally identical to the pre-refactor state.   