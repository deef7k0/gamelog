# CLAUDE.md

Working notes for AI agents (and humans) in this repo. For what the product *is*
and where it is going, read [PROJECT.md](PROJECT.md). For how it should **look**
— tokens, type scale, surfaces, the game case — read [DESIGN.md](DESIGN.md); its
YAML frontmatter mirrors `src/constants/theme.ts` and is the normative layer.
The conventions below are the code-level rules that follow from it.

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
```

Node is a portable install at `~/.local/node-v24.18.0-linux-x64/bin`, already on
PATH via `~/.profile`. SDK 57 needs Node ≥ 22.13.

## Setup that is not optional

1. `cp .env.example .env` and fill in the Supabase URL + anon key.
   `src/lib/supabase.ts` throws a clear error at import time if these are
   missing, so the app will not start without them.
2. Run every migration in `supabase/migrations/` in order, in the Supabase SQL
   editor. Nothing works before this: there are no tables and every query 404s.
   `0001`–`0011` are already applied to the current project; `0012` and `0013`
   are not — without `0013` the Reviews/Collections/People tabs 404 on their
   RPCs and collections cannot be liked.
   `0006` must run **alone** — see the note in the file.
3. Env vars are **inlined at build time**. After editing `.env`, restart with
   `npx expo start --clear` — a hot reload will not pick up the change.
4. Deploy the IGDB Edge Function — it is now the app's **only** game source, so
   nothing game-shaped works without it:
   `supabase secrets set TWITCH_CLIENT_ID=… TWITCH_CLIENT_SECRET=…` then
   `supabase functions deploy igdb`. `EXPO_PUBLIC_IGDB_ENABLED=false` no longer
   degrades search to other providers — it disables search.

## Adding a route

Typed routes are generated into `.expo/types/router.d.ts` **by the dev server**,
not by `expo export`. A brand-new route file will fail typecheck until you run
`npx expo start` once. This is expected, not a bug in your code.

## Architecture

```
src/
  app/               Expo Router routes (file = route)
    (tabs)/          home, search, create, notifications, profile
    game/[id]        game detail + reviews + action row
    log/[id]         create/edit a log (modal)
    achievements/[id]  per-game achievement list
    list/[id]        a list / tier list
    add-to-list/[id]   pick a game to add to that list (modal)
    comments/[type]/[id]  comment thread for a post or log
    profile/[id]     someone else's profile
    new-list, edit-profile (modals)
    sign-in, sign-up
  components/        shared UI; components/ui/ is the primitive layer
                     ui/soft-glow  Skia radial glow (+ .web.tsx CSS fallback)
  constants/         theme tokens, log-status vocabulary, the identity ramp
                     (identity.ts: genre → hue) and rarity bands
  hooks/
    use-accent          the accent in force: house blue, or a game's own colour
  lib/
    color.ts         contrast, mixing, luminance-preserving tint, readable ink
    artwork-color.ts dominant hue of a cover, decoded from the real pixels
    games/           IGDB (the catalogue) + Steam/RAWG/itch id lookup only,
                     sort.ts for in-memory ordering, recommend.ts for
                     "Games for you" (your logs → IGDB similarity)
    api/             everything that talks to Supabase, split by domain
      core.ts        games cache, logs, profiles, follows, achievements
      feed.ts        the post+log union feed
      posts.ts       posts, likes, comments
      lists.ts       lists, tier lists, favourites, wishlist
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
                     0012 starred song, 0013 collection likes + ranking fns
                     (0006 must run alone — see the note in the file)
  functions/igdb/    Edge Function proxying IGDB
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
- **Selection is one step lighter, never a colour.** Any control with an on/off
  state goes `surfaceElevated` → `surfaceSelected` for the fill, `border` →
  `borderStrong` for the edge, and `textSecondary`/`textMuted` → `text` for the
  label. `<SortBar>`, the search mode switch, tag pickers and RSVP buttons all
  follow it; a new one should too. The exceptions are the two controls that
  answer "where am I" rather than "what is set": `<TabBar>` and the bottom nav,
  which take the accent.
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
- **Typography** goes through `<Text variant="…">` from `components/ui/text`,
  not raw `<Text>`. `Type` in `constants/theme.ts` is what currently ships;
  **DESIGN.md § 2 is the specified scale and the code has not been migrated to
  it yet** (`h1`–`h6`, `label`, `button`, an 11px caption). Follow DESIGN.md for
  new work and check § 26.2 for the per-variant diff before adding a variant.
  The same applies to `Radius`: DESIGN.md § 5 specifies 4–6px where the code
  still ships 12–24px.
- **Elevation, not borders.** Reach for `Elevation.card` before a `borderWidth`.
- **`Spacing.x*` names are step names, not dp values.** The ladder was
  compressed to scale the chrome down — `x16` is 12, `x24` is 18, `x48` is 36.
  Only `x4` still equals its name. Read the value in `constants/theme.ts`; never
  infer it from the token name, and never "fix" a name to match its number.
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
- **Three ways to show a game, and they are not interchangeable.** `<GameCase />`
  on a game's own page; `<GameListItem />` for a row that needs a surface behind
  it (search results, feeds); `<CoverTile />` for a grid where the artwork *is*
  the screen — the Top 10, the News chart. A CoverTile has no card, no pill and
  no badge on purpose: wrapping covers in the app's rounded containers turns a
  wall of art into a list of buttons with pictures on them.
- **The stack header floats.** `headerTransparent` plus `<HeaderBackdrop />` is
  set once in `app/_layout.tsx`, never per screen. It draws a page-coloured ramp
  for legibility and a short black tail as the shadow, because a transparent
  view cannot cast one. Screens leading with artwork (game, collection, review,
  profile, Top 10) let content run underneath; every other screen passes
  `<Screen insetHeader>` to reserve the space. Modals opt out entirely — see the
  note next to `modalHeader` in the root layout.
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
- **Steam is the only source of a game price.** IGDB has none; `fetchSteamPrice`
  reads Steam's `price_overview` using the appid from IGDB's `external_games`.
  Every other storefront shows a link and no number, which is the honest shape of
  the data — never fill the gap from another platform's price.
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
- **`Relationships` in `database.types.ts` is not decoration.** supabase-js reads
  it to type embedded selects (`select('*, profile:profiles(*)')`). Leave it `[]`
  and every embed resolves to `SelectQueryError` instead of the joined row. Add
  an `FK<…>` entry for each foreign key you actually embed across.
- **Likes and comments are polymorphic** over `(target_type, target_id)`. Likes
  work on posts, logs **and lists**; comments still only on posts and logs, so
  the two CHECK constraints deliberately differ. Postgres cannot FK a
  polymorphic column, so integrity is enforced by the `assert_target_exists`
  trigger — extend that function whenever you widen a CHECK, or a like can point
  at a row that does not exist. `TargetType` is declared **once**, in
  `database.types.ts`; `api/types.ts` re-exports it. It was declared twice, and
  the copy silently kept `list` out of the barrel.
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