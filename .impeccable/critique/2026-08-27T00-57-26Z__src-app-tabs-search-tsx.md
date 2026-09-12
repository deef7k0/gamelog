---
target: the search tab and its categories
total_score: 15
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-27T00-57-26Z
slug: src-app-tabs-search-tsx
---
**Method: dual-agent (A: a9fb8c6bb0ffcf76a · B: a1f0d0f50b1a43afe)**

# Critique — Search tab and its four categories (`src/app/(tabs)/search.tsx`)

Mode: **Operate**. Target is the Search tab plus the four surfaces it switches between — Discover, Reviews, Collections, People. Browser inspection n/a (native RN, no viewable URL); Assessment B substituted a measured static sweep.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 1 | 350ms of a fully inert screen after each keystroke, then every debounce tick mints a new queryKey with no `placeholderData`, so the entire list is destroyed and replaced by a centred spinner. No result count anywhere. |
| 2 | Match System / Real World | 2 | The tab is "Discover", the field inside it says "Search games…". "Collections" here, "Lists" on the profile, `new-list` in the route — one object, three names, and `discover-lists.tsx:106` tells the user both. |
| 3 | User Control and Freedom | 2 | `clearButtonMode="while-editing"` is iOS-only, so Android has no clear affordance. `returnKeyType="search"` with no `onSubmitEditing` — the Search key only dismisses the keyboard. No history. |
| 4 | Consistency and Standards | 1 | Four different band-heading treatments on one screen (`h3`+caption eyebrow, `h5`, `h5`, `h4`), none of them the `h2` DESIGN.md § 17 mandates. `<HomeSection>` enforces it and is used **zero times** in `discover-feed.tsx`. One skeleton, three spinners. |
| 5 | Error Prevention | 1 | `searchProfiles` interpolates raw user text into a PostgREST logic tree — verified at `core.ts:476`. No escaping, no `.order()`, no `AbortSignal`. |
| 6 | Recognition Rather Than Recall | 2 | The scope switch sits *below* the field it scopes. The screen has no heading, against CLAUDE.md's own rule for screens that open on a list. No recent searches, no "you logged this" on a result. |
| 7 | Flexibility and Efficiency | 1 | Four sorts, zero filters, on the app's only route into a 300k-title catalogue — while `<GameFilterBar>` (genre/platform/studio/year) ships and is wired into exactly one place: the award-winner modal. |
| 8 | Aesthetic and Minimalist Design | 2 | ~103dp (iOS) reserved for a top bar that renders `null`. ~85 interactive targets on Discover before a single keystroke. |
| 9 | Error Recovery | 1 | `DiscoverPeople` has no `isError` branch at all — verified. A failed RPC is reported to the user as "Nobody here yet". `ErrorState` prints raw `error.message`, and no `ErrorState` on this screen is passed a retry action. |
| 10 | Help and Documentation | 2 | `DiscoverPeople` explains each ranking's rule, which is good. The one reassuring line — "Searching IGDB. Type at least 2 characters" — sits in a branch this screen can never render. |
| **Total** | | **15/40** | **Poor — major UX work required** |

That is eight points below the log screen, and it is not a taste judgement: two of the findings are data-integrity bugs, and one of them lies to the user.

## Design Specificity Verdict

**LLM assessment: ~20% specific — a generic four-tab search wearing one authored idea.**

The authored idea is real: **Discover *is* the empty state** (`search.tsx:125-129`). A search screen whose resting content is "type at least two characters" does nothing most of the time it is open; this one answers "what should I play next" instead. The substitution is total — no ghost sort row, no 0-results scaffolding. That is the decision the rest of the screen should have been built around.

Everything structural around it is default, and the central problem is that **the four categories are not peers**. Discover and People are search *scopes* — nouns the field can find. Reviews and Collections are global popularity *charts* with no relationship to the field. A tab bar's contract is "same kind of thing, different slice"; this set is two searches and two leaderboards, and the code apologises for it twice (`searchable = tab === 'discover' || tab === 'people'` at line 73, plus a 40-line docblock).

**And the docblock's justification is factually wrong.** Lines 41-43 say Reviews and Collections "are ranked charts with nothing to filter." `lists.title`, `lists.description`, `logs.review` and the review headline are all text columns — `discover.ts:195-202` already filters on `review`. Searching review text is the single highest-value query a Letterboxd-for-games can serve and the one thing a generic social app cannot. It is absent, and its absence is documented as a design decision rather than as unbuilt work. That is the sharpest specificity failure here: **a technical omission promoted to a principle.**

Four more places where the product's own character fails to reach this screen, all verified:

- **The score on a search result is IGDB's, unattributed.** `game-list-item.tsx:161` renders the provider's aggregate through the app's own ramp and verdict word, in a product positioned on "criticism, not five stars" and whose game page carefully labels the same number `COMMUNITY`.
- **A search result does not know you.** `badgeFor` exists on `GameSearchResults`, `add-to-list/[id].tsx:109` uses it — and `search.tsx:129` does not pass it. Searching "Hades" cannot tell you that you scored it 91. One prop.
- **`<PersonRow>` was extracted because of this screen and never applied to it.** Only caller is `people/[id].tsx:108`; `search.tsx:101-118` and `discover-people.tsx:136-157` both still hand-roll it, with divergent a11y labels.
- **`variant="search"` has zero callers app-wide**, so DESIGN.md § 10's search bar ships in no place at all — including the search screen.

**Deterministic scan: clean, and genuinely so.** `detect.mjs` exit 0 / `[]` on all six files. Token compliance is spotless — zero hardcoded hex, zero raw `fontSize`, zero raw `fontWeight`, zero `fontStyle: 'italic'`, zero bare `'transparent'` in gradients, zero raw `react-native` `<Text>`. `tsc --noEmit` exit 0. **Every contrast pair on this screen passes** — worst is the search placeholder at 5.04:1.

The gap between that and 15/40 is the point: the token layer is disciplined and the composition layer is not. None of this screen's real problems are visible to a regex.

**Visual overlays:** none. Native target, no injection path, no server started.

## Overall Impression

This screen is well-built out of the wrong parts. The carousel is the best-crafted component in this codebase, the `DiscoverPeople` ranking logic is genuinely sophisticated, and the Discover-as-rest-state call is correct. But the tab bar asserts a symmetry that doesn't exist, the primary interaction has no feedback loop, and two categories fail in ways that are invisible until someone's network drops. The biggest opportunity is structural and cheap: **stop pretending there are four peers.** Field + a Games/People scope, with Reviews and Collections as bands inside Discover, resolves the dead deep link, the jumping tab row, and the shared-query trap in one move.

## What's Working

**1. Discover *is* the empty state (`search.tsx:125-129`).** Covered above — the right call, cleanly executed, and correctly documented as a decision.

**2. `DiscoverPeople` refuses to average two different questions** (`discover-people.tsx:16-28, 96-108`). "Most reviews" is volume, "Most liked" is reception, and a merged "top users" number answers neither. Each section carries a one-line hint stating its own rule, so a ranking is arguable rather than authoritative — the right posture for a criticism product toward its own leaderboards. `getRecommendedPeople` goes further: it *ranks* by overlap × agreement in SQL but *displays* shared-game count (`discover.ts:142-161`), so the visible number is the one a reader can verify.

**3. `GameSearchResults` deliberately does not own the field** (`game-search-results.tsx:51-59`), and the sort row is progressively disclosed (`:113-126`). That split is why one field serves four contexts without duplicating a field or clearing on mode switch, and the "no sort row above a single result" restraint is something most search UIs never bother with.

## Priority Issues

### [P0] People search returns arbitrary rows and breaks on ordinary punctuation

**What.** Verified at `core.ts:473-477`: `.or(\`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%\`).limit(25)` — raw interpolation, **no `.order()`**, no `AbortSignal`.

**Why it matters.** Two independent failures of the tab's only job. With no ordering, Postgres returns 25 *arbitrary* matching rows — an exact username match is not guaranteed to be among them, and the same query can return different people twice. And a comma, `(` or `)` breaks the filter tree into a 400, which `ErrorState` renders as a raw PostgREST parser message as the page body; `%` and `_` are unescaped SQL wildcards, so typing `_` matches every profile.

**Fix.** Escape `% _ , ( ) .` before interpolation, or move to a `search_profiles(p_query text)` RPC — the pattern `discover.ts` already prefers for ranked queries. Order explicitly: exact username, then prefix, then similarity. Accept an `AbortSignal` like `searchGames` does, so responses cannot race.

**Suggested command:** `/impeccable harden`

### [P0] A network failure is reported as a fact about the product's users

**What.** Verified: `discover-people.tsx` branches on `isLoading` (line 51) and on `hasAnything` (54) and **never on `isError`** — `ErrorState` isn't even imported. Any RPC failure yields empty arrays and renders *"Nobody here yet — Once people start reviewing games, they will show up in these lists."*

**Why it matters.** PRODUCT.md principle 2 and its Evidence rule, violated directly. This codebase already wrote the correct argument for exactly this bug class in `lib/games/index.ts:144-160` — asserting a fact about a data source on the strength of a dropped connection, told to the person least able to check it. On a pre-launch product where "there are no users yet" is plausibly true, the failure is **invisible**: it looks like honest emptiness. The sibling components handle it correctly (`discover-lists.tsx:41, :84`), so this is a gap, not a policy.

**Fix.** Add the `isError` branch before the emptiness check. Stop printing raw `error.message` to users in `screen.tsx:161` — map to a sentence, keep the raw string behind a dev branch. Pass a retry `action` to every `ErrorState` on this screen; none currently has one.

**Suggested command:** `/impeccable harden`

### [P1] Nothing happens between keystroke and result, then the page is wiped

**What.** 350ms of inert UI (`use-debounced-value.ts:9`), then a full content replacement with a centred spinner because every debounce tick is a fresh queryKey with no placeholder (`game-search-results.tsx:70-76, :96`).

**Why it matters.** It is the core interaction, it fires on every pause, and it produces the two worst signals in sequence: "your typing did nothing", then "your results are gone." Typing "elden ring" with two natural pauses means two full page-wipes-to-spinner. Search feels like it's *losing* your results rather than refining them.

**Fix.** Three small changes: `placeholderData: keepPreviousData` on both search queries; a 16px activity glyph inside the field's trailing edge driven by `input.trim() !== query || isFetching`, which is the only thing that covers the debounce window; and skeleton rows instead of `<LoadingState />` per DESIGN.md § 22, which the sibling carousel already honours.

**Suggested command:** `/impeccable optimize`

### [P1] ~103dp reserved for a component that renders nothing, and a 48dp jump under the thumb

**What.** `search.tsx:141` passes `<FrostedTopBar />` with no `back`, no `dismiss`, no `right`; the component returns `null` at line 112. `insetHeader` still reserves `insets.top + 56`: **~103dp on iOS, ~80dp on Android, containing nothing.** Separately, the field's conditional render (line 143) collapses the header by `TapTarget` (44/48) on every switch to Reviews or Collections, so the `<TabBar>` directly beneath jumps up under the finger that just tapped it.

**Why it matters.** Chrome before content on Discover is roughly 215dp of an 844pt display — 25% — and 56 of those dp are provably empty, on a screen whose entire top-bar system was redesigned to reclaim exactly that band. The jump is a Fitts's-law failure on a one-handed control row: the target moves *after* you commit and *before* you can make a second choice. There is also a 7-line docblock (lines 134-140) reasoning carefully about the scroll behaviour of a component that draws nothing.

**Fix.** Drop `topBar` and `insetHeader`, use `edges={['top']}` — Search is a root tab with nothing to go back to, the same reasoning Home already applies. Reserve the field's height on all four tabs so the tab row never moves.

**Suggested command:** `/impeccable layout`

### [P1] Two of four tabs ignore the primary input, and `?tab=` is dead after the first visit

**What.** `search.tsx:66-68` reads `tabParam` **only in a `useState` initializer**. Expo Router keeps a tab screen mounted, so Home's `<HomeSection seeAll="/search?tab=reviews">` updates params without remounting, the initializer never re-runs, and the user lands on whatever tab they last used.

**Why it matters.** The docblock at lines 52-63 documents the exact bug it fails to fix: *"a VoiceOver user was told 'See all reviews' and arrived at a game search."* Still true for anyone who has opened Search once. The comment's reasoning conflates a re-render with a fresh navigation intent — different events, and only one should move the tab.

**Fix.** Apply the param once per focus via `useFocusEffect` and clear it with `router.setParams({ tab: undefined })`, or attach a nonce to the link. Structurally, collapsing to a Games/People scope with Reviews and Collections as Discover bands removes the problem rather than patching it.

**Suggested command:** `/impeccable shape`

## Persona Red Flags

**Alex (power user)** — No search history anywhere (`grep` for recent/history across `src/` returns nothing). No filters on the only catalogue surface while `<GameFilterBar>` ships in the award modal. The keyboard's Search key is inert. Cannot search their own logs — `library/[id].tsx:210` can search a linked Steam library, but the Search tab cannot answer "what did I score Hades?" Cannot search review text, and the screen presents that gap as a design decision.

**Sam (accessibility)** — The tab bar does **not** announce as tabs: each pill has `accessibilityRole="tab"` and `accessibilityState`, but the container `ScrollView` has no `accessibilityRole="tablist"` (zero hits for "tablist" repo-wide), so VoiceOver cannot say "tab 2 of 4" — four buttons, one claiming to be selected, with no set to place it in. The disappearing field unmounts a possibly-focused `TextInput` with no announcement, no focus retarget, no live region (`accessibilityLiveRegion`: zero hits repo-wide). Results arriving are announced by nothing. Tap targets: `discover-feed.tsx:83` "See all" is a bare `<Text>` at **~16dp** with no padding and no `hitSlop`, and `discover.ts:36-40`'s rail seed heading is **~18dp** — against DESIGN.md § 23's "44×44, no exceptions". Verified that `home-section.tsx` gets this right (16 line + 20 padding + 12 slop = 48), so the house pattern exists and this screen didn't use it. The person row at `search.tsx:104` has `accessibilityRole="button"` and **no `accessibilityLabel`**, so name and handle read as two separate nodes — while `discover-people.tsx:143` and `person-row.tsx:58` both compose one. Same list of people, three announcement behaviours.

**Riley (stress tester)** — Comma or paren in a People query → 400 with a raw parser error as the page body. `_` or `%` silently matches everyone. A one-character query shows the full Discover feed *with a character still in the field* and no message saying why — the line that would explain it is in an unreachable branch. Network failure behaves four different ways across four tabs, one of them a lie. With `EXPO_PUBLIC_IGDB_ENABLED=false`, `providerNames` resolves empty and the zero-result copy reads "Nothing on  for "zelda"" with a double space.

**"The Letterboxd-keeper" (project persona, PRODUCT.md § Users)** — Search knows nothing about who they follow: `searchProfiles` doesn't join `follows`, so a friend ranks identically to a stranger — and with no ordering at all, possibly below one. Meanwhile `getHomeReviews` proves the follow graph is available and already used for exactly this prioritisation on Home. The one Letterboxd behaviour they reach for on day one — search a title, see your own rating on the row — is one unused prop away.

## Minor Observations

1. `<View style={styles.header}>` renders unconditionally with 12dp of top padding even when the field inside it is hidden.
2. **Estimated, not measured:** the `<TabBar>` likely overflows — DISCOVER + REVIEWS + COLLECTIONS + PEOPLE computes to roughly 420dp against a 390dp iPhone 14/15 viewport, with `showsHorizontalScrollIndicator={false}` and no affordance saying the row scrolls. "COLLECTIONS" is the offender, and "Lists" — the app's own word for the same object — would fix both this and the vocabulary split. Worth confirming on device.
3. All four `ListEmptyComponent` empty states are top-anchored because none of the `contentContainerStyle`s sets `flexGrow: 1`, while directly-returned empty states are vertically centred. Two empty states in one flow at two different heights.
4. `discover-feed.tsx:107-109` maps 20 `GameListItem`s inside a `ScrollView`, below a horizontal `FlatList` carousel and N more rails — ~30+ images mounted eagerly on the default tab.
5. `discover-feed.tsx:105` flips the heading between "Highly rated" and "Start here" while the content is identical in both cases. Two names for one list.
6. `use-debounced-value.ts:6` still justifies its delay by "Steam's store API is rate limited." Steam left the search path at the IGDB cutover. Stale rationale on a live tuning constant.
7. `DiscoverPeople`'s loading guard is `reviewers.isLoading && popular.isLoading` — `&&`, so if one resolves first the page renders with a section silently missing.
8. `discover-people.tsx:107` describes likes "across their reviews **and posts**." Posts were removed from the app. Copy describing a deleted feature.
9. **B caught one A missed, verified:** `log-card.tsx:53`'s `READ_MORE_SLOP` is `{top: 11, bottom: 11}` on a 16dp line = **38dp**, under both floors — while the comment directly above it claims it "lifts the inline 'Read more' to the platform floor." A false claim in a comment, on a component this screen renders via the Reviews tab.
10. No `keyboardDismissMode="on-drag"` on any scroller here, though `profile-view.tsx:412` establishes it as the house pattern.

## Questions to Consider

1. If Reviews and Collections cannot be searched, why are they behind the search icon? Home already has a Reviews band with a "See all" — what does this tab add beyond a second, differently-ranked copy of it?
2. `lists.title`, `logs.review` and the review headline are all text columns. What is the actual reason review text is unsearchable in a product positioned on *"serious long-form reviews"*? If the answer is "nobody built it", the docblock should say so rather than call it a design decision.
3. `<GameFilterBar>` browses IGDB by genre, platform, studio and year — and it lives in the modal for picking an award winner. Which screen is the catalogue's front door, and why is the better browser behind the smaller feature?
4. The number on a search result is IGDB's aggregate, rendered in the app's own ramp with the app's own verdict word. What is the app's answer when a user asks "who gave this an 82?"
5. Home's masthead scrolls away because "a root tab has nothing to go back to." Search is a root tab. Why does it render a top bar at all — and having rendered one that draws nothing, why does it reserve 103dp for it?
6. `<PersonRow>` was extracted *specifically* because this screen and `discover-people` had duplicated the row. Both duplicates survive. What in the workflow lets an extraction ship without its callers?
