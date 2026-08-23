---
target: game page
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 4
timestamp: 2026-08-23T16-39-55Z
slug: src-app-game-id-tsx
---
Method: dual-agent (A: design review · B: detector + measured evidence, isolated & parallel)
Target: src/app/game/[id].tsx + its 23-file render tree. Geometry basis 390x844dp.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | `Action` has no pending state; mutation round trip shows nothing |
| 2 | Match System / Real World | 3 | Tab "Similar" vs empty state "No recommendations"; COMMUNITY has no source/denominator |
| 3 | User Control and Freedom | 2 | Playing/Played cannot be unset; no toggle-off path on this page |
| 4 | Consistency and Standards | 2 | 3 real toggles, 2 one-way writes, 1 stateless — all render identically |
| 5 | Error Prevention | 1 | Played invalidates ['feed'] (public write) with no confirm, undo, or disclosure |
| 6 | Recognition Rather Than Recall | 2 | No stickyHeaderIndices anywhere in src/; tab bar scrolls away past ~640dp masthead |
| 7 | Flexibility and Efficiency | 2 | No path from game to collections; Backlog/Dropped have no shortcut |
| 8 | Aesthetic and Minimalist Design | 2 | 12 Overview sections, platforms stated twice, store rail uncapped, synopsis ~513dp |
| 9 | Error Recovery | 1 | Raw error.message at 10px below wrong button, no retry; Similar tab misreports network error |
| 10 | Help and Documentation | 2 | Three unexplained numbers; ScoreBadge has no accessibilityLabel |
| Total | | 19/40 | Poor band |

NOTE: the band undersells the page. Failures cluster in states/feedback/recovery; composition,
colour derivation and query architecture are strong. Well-composed page, unfinished plumbing.

## Design Specificity Verdict

Two product-specific ideas on a generic chassis. Structure (hero -> title column -> icon action
row -> pill tabs -> stacked sections+rails) is Steam/App Store/Letterboxd's. Swap GameCaseDisplay
for an album cover and it is a music app with zero other edits.

Genuinely product-specific: (1) the case overlapping the hero 86dp into 321dp of key art, 46% of
its own height, shadow larger in all 3 dimensions than Elevation.overlay; (2) the page lit by the
box's own decoded pixels via one 90x90 JS-decoded thumbnail.

Missed opportunity: THE CASE IS INERT. `tilt` is already a shared-value-ready prop; scrollY is
already a shared value on this screen. Nothing is bound. Every other affordance sinks on press.

DETERMINISTIC SCAN: detect.mjs = 0 findings, exit 0 on target and full 23-file tree (--no-config
confirmed not suppression). Detector verified working via planted probe. BUT the clean result is
near information-free: text engine implements 9 rules, all DOM/CSS-shaped. A planted RN file with
fontSize:9 + #808080 on #242424 + padding:1 also scores 0. True negative for 9 web rules only.
Real positive corroborated: zero hardcoded hex in the render tree.
FALSE POSITIVES elsewhere in src/: broken-image at lib/news/rss.ts:78 (regex literal in an RSS
parser); 13 design-system-color advisories in constants/stores.ts (storefront brand hexes, which
CLAUDE.md requires be lifted via ensureContrast rather than added to the palette).

VISUAL OVERLAYS: none. No adb, no xcrun, no emulator, Linux host. Browser injection not applicable
to an RN source tree; a web export would not be faithful (ScrollAmbience is Skia with no .web.tsx,
so the entire lit backdrop these numbers measure against would be absent).

## What's Working

1. The masthead is a proportion, not a layout. CASE_WIDTH_RATIO 0.38 capped 200, overlap 0.46 of
   the case's own computed height, heroHeightFor = max(width/1.778, height*0.38). The max() guard
   keeps a wide display from centre-cropping art that already fit.
2. fade="mask" genuinely solves a hard problem — MaskedView sampled for alpha only, so the art
   dissolves over a live gradient with no seam and the two layers never know about each other.
3. Only the active tab's queries run (reviews/similar/achievements/extras/cast all gate on tab).

## Priority Issues

[P0] The masthead is illegible exactly where it is lit brightest.
ScrollAmbience paints the viewport at L=0.11 at top of page. Masthead is on screen at progress~0,
the worst case. 14 pairs fail WCAG there: PlatformPicker inactive label+glyph 1.66:1; GamePrice
struck price 1.66:1; all chevrons/section counts/diary caption 1.66:1; status "Played"/"Dropped"
2.02/2.07:1; ScoreBadge low score 1.95:1; action row inactive labels 2.76:1.
ROOT CAUSE: page applies accent.quietInk correctly to its own 6 lines (4.25-5.71:1 across all ten
hues), but GamePrice/PlatformPicker/GameActions are shared components that read textMuted/
textSecondary/primaryText unconditionally. quietInk is not reachable through context the way
useAccent() is. Also textMuted fails on opaque steps: 4.32 / 3.93 / 3.63:1.
FIX: expose quietInk through useAccent(); have the three masthead components consume it. Retune
textMuted (peaks 4.74:1 even on a descended page). Command: /impeccable colorize then audit.

[P1] Two of five action buttons are false toggles that publish with no undo.
Favourite/Wishlist use next:!state. Playing/Played are one-way setStatus.mutate('played'). All
four render identically (same 73x63 accent well, same outline->solid glyph, same
accessibilityState.selected). They write logs and invalidate ['feed'] — broadcast to followers.
No undo, no confirm, no null-status route from this page. FIX: real toggle + optimistic onMutate,
or stop making them look like toggles. Command: /impeccable harden.

[P1] The tab bar scrolls away, burying the product's #2 differentiator.
No stickyHeaderIndices anywhere in src/. Masthead ~640dp of an 844dp viewport; top bar also hides
on scroll. TABS carries no count although TabBar supports one. FIX: split header, sticky bar,
cached count(*) review query. Command: /impeccable layout.

[P1] Eight sections fail silently; one reports a network error as a fact about IGDB.
getSimilarTo has try/catch returning [], so similar.isError is structurally unreachable — a
timeout/500/offline all render "IGDB has no similar games listed for this title." Achievements,
Studios, Franchise, Cast, StorePrices, OriginalGame all vanish identically on failure. Zero
NetInfo/onlineManager/navigator.onLine hits repo-wide. Violates PRODUCT.md Principle 2.
FIX: let getSimilarTo throw; add isError branch with retry; add offline detection.
Command: /impeccable harden.

[P1] Six controls under 44dp, including both outbound commerce links.
ExternalLink "Open on Steam" 120x18 (-26); GamePrice store link 90x16 (-28); PlatformPicker pill
47x25 (-19); Studio chip 174x28 (-16); TabBar tab 98x40 (-4); Achievements "View all" 366x42 (-2).
hitSlop appears exactly once in the whole tree. theme.ts:667 says "Nothing tappable is smaller."
The 25dp pill is the control that re-drives case + price + store link simultaneously.
FIX: padding only, no visual weight change. Command: /impeccable audit.

## Persona Red Flags

SAM (screen reader / contrast / motor): GameCase (148x209dp, largest element) has no
accessibilityRole/Label — VoiceOver announces rotated spine text then unlabelled images.
ScoreBadge reads "82" while ScorePill announces "Scored 82 out of 100 — Very Good" on the same
page. SectionHeader has no role="header" (no rotor nav across 12 sections). ExternalLink
announces as plain text. 7 of 8 animated surfaces ignore useReducedMotion (PressableScale,
FrostedTopBar, ScrollAmbience, Button, TabBar, expo-image cross-fades); the one guarded path
(poster parallax) is off by default on this page.

RILEY (stress tester): data.description has no numberOfLines/expand — ~27 lines / 513dp.
company.name has neither numberOfLines nor flex/maxWidth in a wrapping row -> horizontal overflow.
logged.review_title is user-supplied and unbounded. StorePrices maps the entire ITAD result with
no slice (15-25 storefronts). "Reviews" includes bare ratings rendering as 132dp cards saying
only "Ada played Elden Ring".

CASEY (one-handed / slow connection): Favourite is a dead control for the full round trip (no dim,
no spinner, no glyph change) — double-tap recomputes from stale state and sends true twice.
Failure caption is 10px, below the primary button, away from the icon that failed, no retry.
Price quoted twice and can disagree: masthead shows selected-platform deal, StorePrices 500dp
below shows global cheapest and ignores activePlatform (PS5 £69.99 vs "from £14.99" PC key).

## Minor Observations

- Title can render behind the top bar, silently. styles.identity uses alignItems:'flex-end'; a
  3-line title + 7 platforms + 2-line developer = ~337dp column, title top at 83.5dp, under a
  115dp FrostedTopBar on iPhone 14. Inverse failure on a sparse game: ~100dp void above title.
  P1 severity, narrow scope.
- Four fontWeight:'700' that do nothing on Android (game-availability.tsx:115,123;
  store-prices.tsx:179,186) — theme.ts:388 documents this exact trap.
- store-prices.tsx:186 sets fontSize:9, under the documented 10px floor.
- Type.label exists for COMMUNITY / PLANNED RELEASE / LOWEST and is not used for them.
- The case shows no edition badge on the game's own page though the prop exists.
- Screenshots are not tappable; media-carousel.tsx already exists for exactly that.
- Dynamic Type will clip: no maxFontSizeMultiplier, Chip height:34 and actionIcon 46x46 fixed.
- The backdrop comment is copy-pasted verbatim across four identical Screen shells.

## Questions to Consider

1. What if the case were the interaction rather than the illustration? Bind tilt to scrollY; then
   consider dragging it to the back, where the spine, platform brand and YOUR record are printed.
2. Why does this page put your own record in the masthead but the community verdict at 12px and
   criticism behind a 640dp scroll? PRODUCT.md: "Criticism over stars."
3. Is the platform picker one control or two wearing one coat? It drives case+price+store link
   while a fourth control below ignores and contradicts it.
4. What is Overview for? Twelve sections ordered by nothing but the sequence they were written in.
