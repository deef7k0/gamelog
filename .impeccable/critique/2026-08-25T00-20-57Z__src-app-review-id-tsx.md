---
target: the review full view screen
total_score: 18
max_score: 36
na_heuristics: 10
p0_count: 2
p1_count: 2
timestamp: 2026-08-25T00-20-57Z
slug: src-app-review-id-tsx
---
Method: dual-agent (A: a382d981bfe76c67e · B: aa7ccd3be6ca473b9)

# Critique — Review full view (`src/app/review/[id].tsx`)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | `showsVerticalScrollIndicator={false}` (:177) removes the only progress signal on the app's longest page; loading is a spinner, not a skeleton |
| 2 | Match System / Real World | 2 | "NOW VIEWING REVIEW" is media-player machine-speak; `chevron-down` + "Close review" says *sheet*, but the route is a plain push (_layout.tsx:136) |
| 3 | User Control and Freedom | 2 | Loading, error and not-found branches render a bare `<Screen>` with no bar and no control at all (:60-91) |
| 4 | Consistency and Standards | 1 | The only non-auth route file of 31 without `<FrostedTopBar>`; boxed score against an explicit ban; 1.28 aspect vs `PosterAspectRatio`; all 8 `fontWeight` declarations in the repo live in this one file |
| 5 | Error Prevention | 3 | Small mutation surface, handled cleanly |
| 6 | Recognition Rather Than Recall | 2 | `layout="stacked"` suppresses the comment count entirely — nothing on the page says a discussion exists |
| 7 | Flexibility and Efficiency | 1 | Nothing accelerates a long read: no progress, no jump-to-comments, no in-body share |
| 8 | Aesthetic and Minimalist Design | 3 | Genuinely calm composition; loses points for 140dp of chrome around two digits |
| 9 | Error Recovery | 2 | `ErrorState` surfaces the raw PostgREST message; the "Go back" escape is an unlabelled `<Text>` with no `accessibilityRole` |
| 10 | Help and Documentation | n/a | A review page legitimately needs none |
| **Total** | | **18/36** | **Acceptable — bottom edge (50%)** |

## Design Specificity Verdict

**Not authored for GameLog. A music app could ship this unchanged — and the file says so out loud.**

The header comment at :25-34 names the frame: "inspired by the 'Now Playing' aesthetic… Track info: Game title in bold + publisher / developer." Every consequential decision follows from that borrowed frame rather than from the content.

A Now Playing screen is a **terminal** view — the artwork *is* the content, nothing lives below it. A criticism surface is a **document** — the masthead is the doorway and the prose is the content. Borrowing the first shape for the second produces the three defining problems:

- **The game outranks the criticism.** Game title `h1`/23px, the review's own headline `h2`/19px, the reviewer `bodySmall`/12px behind an 18dp avatar. DESIGN.md § 2.1 assigns `display` (26/31) to "a review's own title" — `display` is not used on this screen at all, and § 16's rule for the card form is explicit: "The top line is the review's headline, never the game's name." This inverts it.
- **`publisherName` is the "artist" slot.** `publisher ?? developer` (:98) collapses two different facts into one line because the template has exactly one line there. Meanwhile `status`, `played_on`, `completion_percent` and `updated_at` — all present on `GameLog` — render nowhere.
- **`<GameCase />` is explicitly permitted here and was declined.** DESIGN.md:732 lists "A review masthead" as one of four sanctioned placements. The screen instead builds an imitation that casts `shadowOpacity 0.45 / radius 20 / offset 12 / elevation 10` — above `Elevation.overlay` on every axis, and a wider radius than the game case itself. It refused the one object allowed to cast and then out-cast it.

**Deterministic scan: 0 findings, and that is a false negative across the board.** `detect.mjs` returned `[]` on the target and on both supporting components. Verified with controls: `game-case.tsx` → `[]`, `global.css` → `[]`, a synthetic `.css` probe → 2 findings. The ruleset matches CSS declaration syntax (`font-family:`) and cannot see React Native's `StyleSheet.create({ fontFamily: 'Inter_400Regular' })`. The app's face *is* Inter — the exact `overused-font` trigger — and the rule never fired. Every finding below required manual verification. `npx tsc --noEmit` and `npx eslint` are both clean; none of this is type- or lint-visible.

**Visual overlays: not available.** No dev server listening (8081/19006/3000 all refused), native RN target, no browser automation exposed. No overlay exists and none is claimed.

## Overall Impression

The instinct is right and the execution reached for the wrong reference. Committing half a viewport to one cover is *correct* for this product — PRODUCT.md names "the physical shelf feel" as a load-bearing differentiator and this is the only screen that honours it at full scale. But the screen then bypasses nearly every piece of infrastructure the app built for exactly this moment: `<GameCase>`, `<ScorePill>`, `ScoreSizes.hero`, `<FrostedTopBar>`, `<ScrollAmbience>`, `accentRoles().quietInk`, `contrast()`, `Type.label`, `Type.prose` — several of them re-implemented by hand at slightly wrong values.

**The single biggest opportunity:** invert the hierarchy so the writer and the writing lead, and route the colour through the accent roles that already exist. Both are mostly deletion, not new design.

## What's Working

1. **The prose column is left genuinely alone.** :270-286 is title, body, nothing — no pull-quotes, no related-reviews rail, no sidebar. `Spacing.x24` gives ~45 characters per line at 15px, a better measure than the app's standard gutter. Leaving a reading surface empty is the hardest discipline in editorial design and this file has it.
2. **The backdrop reuses real extraction infrastructure, not decoration.** `useArtworkPalette` and `useGameAccent` share one query key, so the page costs one 3KB thumbnail and one decode, cached in `AsyncStorage`. The colour on screen is the actual colour of the box, and `<AccentProvider>` scopes it correctly. The plumbing is right; only the values fed through it are wrong.
3. **Committing a full screen-height to one cover is the right call, and no other screen makes it.** Opening a review should feel like an event. That judgment survives everything below.

## Priority Issues

### [P0] The colour backdrop puts almost all of the screen's own text below AA

Both assessments computed this independently and agree. `withAlpha(dominantColor, 0.75)` composited over `#121212` at :124, held from y=0 through 35% of screen height — covering the entire header block and most of the cover:

| Hue | `text` #F5F5F5 | `textSecondary` | `textMuted` |
|---|---|---|---|
| identityLime | **2.48** | 1.14 | 1.20 |
| identityGold | **2.56** | 1.17 | 1.16 |
| identityJade | **2.78** | 1.27 | 1.07 |
| identitySky | **3.39** | 1.55 | 1.14 |
| identityCrimson | **3.93** | 1.80 | 1.32 |

30 of 33 pairs fail AA; 21 of 33 fail even 3:1. On the plain page those same inks measure 17.18 / 7.88 / 5.79 — the backdrop destroys 71–86% of available contrast exactly where the reviewer's name and the "NOW VIEWING REVIEW" label sit, the latter at 1.07–1.34:1, i.e. invisible.

Two compounding causes:

- **`dominantColor = palette?.[0] ?? accent.color` (:96) mixes two incompatible tunings.** `palette[0]` is normalised to luminance 0.11 (a *field*); `accent.color` is 0.34 (a *button*), and on extraction failure it is a raw ramp hex at 0.41–0.60 (*type on near-black*). That fallback fires on every cold open, every `MIN_SHARE` miss, every legacy `steam:` 404, and permanently for any cover with no dominant hue.
- **Grey type on a lit backdrop, with `quietInk` sitting unused.** `artwork-color.ts:282-287` documents this failure in advance: "the token measures 2.75:1 at 0.11 and no amount of tuning fixes that… Put grey back on this backdrop and the ceiling comes back with it." `accentRoles().quietInk` exists solely to solve it and holds 4.66:1. The screen builds an `AccentProvider` at :116 and never reads a single role from it. `contrast()`, `ensureContrast()` and `readableInk()` are imported nowhere — and `readableInk()` run against these composited backdrops returns dark ink for all ten identity hues.

**Fix:** `palette?.[0] ?? paletteFor(accent.color)[0]` for the fallback; the lit band runs on `text` and `accent.quietInk` only; move score/hours/date out of the lit zone or onto `accent.surface`.
**Suggested command:** `/impeccable audit`

### [P0] The headline score renders at regular weight — and is boxed like a button

**It renders wrong.** Only four Inter faces are loaded (_layout.tsx:53-56): 400/500/600/700. There is no 800 or 900. `<Text>` applies `Type[variant]` then `style` (text.tsx:23), and `styles.scoreNumber` has no variant, so it inherits `body` → `Inter_400Regular`, then sets `fontWeight: '900'`. React Native will not synthesise a bold from a custom family on Android. The 38px headline number of the entire screen renders regular. Four more are silent no-ops the same way: `verdictLabel` (800), `nowViewingBadge` (700), `reviewerText` (600), `publisherName` (500). `grep -rn fontWeight src/` returns 8 code hits and all 8 are in this file — every other occurrence in the tree is a comment forbidding it, including game-availability.tsx:132-136 where this exact bug was already found and fixed.

**It is the shape DESIGN.md bans by name.** DESIGN.md:1184: "The score is a bare coloured numeral. No box, no outline, no fill. Digits in a bordered capsule read as a button." `styles.scoreBox` (:390-399) is `borderWidth: 1` tinted, filled, at `Radius.card` — the same 6px radius as every button in the app — `minWidth: 140`, centred. It is dimensionally and tonally a primary button. `<ScorePill>` and `ScoreSizes.hero` (38) both exist; the file hardcodes `fontSize: 38` by hand instead, and `hero` currently has no consumer anywhere in the app despite being created for this screen. It also loses `<ScoreNumber>`'s composed label, so VoiceOver reads three disconnected nodes: "89", "/100", "EXCELLENT".

**Fix:** `<ScorePill score={review.rating} size="hero" showLabel />`, no container, and delete all eight `fontWeight` lines.
**Suggested command:** `/impeccable typeset`

### [P1] No `<FrostedTopBar>` — the one route file in the app that hand-rolls its header

29 of 31 route files import `FrostedTopBar`; 27 pass `topBar={…}`; 14 wire `useTopBarScroll`. This file does none of the three. Five consequences:

1. **No blur, no scrim** — the 30% scrim is *the* mechanism keeping a title legible over bright content, and this bar sits on the brightest gradient stop.
2. **It never hides.** A static row in the column flow, permanently consuming 111dp — 13% of an 844pt screen — on the app's one reading surface. CLAUDE.md lists reading screens as the ones that *take* hide-on-scroll. The `ScrollView` has no `onScroll` and no `scrollEventThrottle`, so it isn't available even in principle.
3. **Wrong affordance.** `chevron-down` on a pushed screen teaches a swipe-down gesture that does nothing.
4. **38×38 tap targets, no `hitSlop`** — `TapTarget` is 44 iOS / 48 Android. `grep hitSlop` on the file returns zero hits.
5. **Structurally in the wrong place.** Passed as `children` rather than into the `topBar` slot, so it renders inside the `<BlurTargetView>` — bypassing the slot's entire documented purpose ("a bar rendered as a child would be inside its own blur source").

**Fix:** `topBar={<FrostedTopBar back scrollY={scrollY} subtitle={displayNameFor(author)} />}` with `<Screen edges={['bottom']}>`. Recovers 111dp of reading room, fixes contrast, targets and the chevron, and keeps the byline on screen for the whole read.
**Suggested command:** `/impeccable layout`

### [P1] The review body starts at y≈782 on a 390×844 phone

Measured block by block: header 111 → cover 410 (49% of the viewport) → title 40 → score box 79 → hours 13 → headline 24 → prose at 782, leaving 62dp of actual review above the fold. The ceremony is a fixed cost regardless of what it introduces:

- **2,000-word review:** ~15 screenfuls under a viewport-pinned gradient. `locations={[0, 0.35, 0.65, 1]}` map to the viewport, not the document, so the top third stays lit forever and every paragraph passes through it. DESIGN.md § 0 describes exactly this: "a glow pinned to the viewport for six screenfuls is a wash." Siblings use `<ScrollAmbience>` with `scrollY` (game/[id].tsx:289); this screen re-implemented the effect without the argument.
- **40-word review:** ~85% packaging. The score box is physically larger than the paragraph it introduces.
- **`EngagementBar` lands at y≈962 minimum** and scales with length, so like/comment sit thousands of dp down on a long piece. `layout="stacked"` also suppresses the comment count unconditionally — if three people replied to a review, its own page never says so. That is the exact loop that brings a reviewer back for a second game.

Also: `artHeight = artWidth * 1.28` at :102 is commented "// 2:3 box art proportion". 2:3 is 1.5. `<Poster>` uses `width / PosterAspectRatio` = ×1.5. At `artWidth: 320` this renders 410 instead of 480 and, with `contentFit="cover"`, crops ~15% off every cover on the one screen that presents artwork full-size. Line 100 says "Spotify album art proportion" (1:1); the two comments disagree with each other and both disagree with the code.

**Suggested command:** `/impeccable layout`

### [P2] An unscored review renders with no date, and the platinum trophy is silent

`hours_played` and `timeAgo(created_at)` are nested two levels deep inside the `review.rating !== null` guard (:233-260). When `rating` is null, the only timestamp anywhere on the screen disappears along with the score. This is a live path — `getGameReviews` filters `.or('review.not.is.null,rating.not.is.null')`, so a written review with no score is explicitly supported. On a criticism surface a 2019 verdict on a live-service game means something entirely different from a 2026 one.

The platinum pill (:224-229) is a plain `View` around a bare `<Ionicons name="trophy">` — no role, no label, no text. Arguably the proudest fact in the log, conveyed by glyph and hue alone, and invisible to a screen reader. Direct violation of "Colour is never the only carrier."

Never rendered at all despite existing on `GameLog`: `status`, `played_on` (which platform they played it on — material to a review), `completion_percent`, `updated_at`. `<ReviewMeta>` exists and is unused.

**Suggested command:** `/impeccable harden`

## Persona Red Flags

**Casey (distracted mobile, one hand, interrupted):** Both chrome controls sit at y≈63-101 — the least reachable strip on the screen — at 38×38 with no `hitSlop`. Like and comment require finishing the article; there is no way to react without reading all of it. No scroll indicator, no progress affordance, no position restored on return: an interruption at paragraph nine costs the whole read. The `chevron-down` glyph teaches a swipe-down that does nothing on a pushed screen.

**Sam (screen reader, contrast, tap targets):** The trophy announces nothing. Contrast failures enumerated above — `textMuted` at 1.07–1.34:1 in the fallback case, at 10px. Four of five interactive targets under the floor: `headerButton` 38×38 ×2, the reviewer row ≈18dp tall, the title link 28dp. `accessibilityState` appears zero times in the file. The score announces as three disconnected fragments. The error state's only escape is an unlabelled `<Text>` announcing as static text; loading and not-found have no exit at all. Meanwhile `EngagementBar` right below solves precisely this with a documented `ACTION_SLOP`, and `person-row.tsx` uses `minHeight: TapTarget` — the pattern exists and this screen doesn't use it.

**Priya (the reviewer — the person PRODUCT.md says the product must retain):** Her byline is the smallest type on the page, inside a bar labelled with the app's own machine-speak, while the game she reviewed is at 23px. Her 14-category scorecard — the app's second named differentiator — renders misaligned: `ReviewMetricsBreakdown` carries its own `marginHorizontal: Spacing.x16` inside a container already padded `Spacing.x24`, so the bars sit 30dp from the edge while her prose sits at 18dp. Her comment count is deleted by the layout. Her word count is invisible and unrewarded.

## Minor Observations

- **`Type.label` is hand-rebuilt twice**, at two different tracking values (1 and 1.2) — the token is 10/13, medium, 0.8, uppercase, and the text is already hardcoded uppercase anyway.
- **`reviewBody` spreads `Type.prose` into a `variant="body"` Text.** It works (style wins), but `variant="prose"` exists and the duplicated `lineHeight: 24` will silently diverge the moment the token is retuned. Token laundering: right today by hand rather than by reference.
- **Two hardcoded hexes with exact token equivalents:** `withAlpha('#FFFFFF', 0.12)` *is* `theme.borderStrong`; `shadowColor: '#000'` *is* `theme.shadowInk`.
- **`Radius.card` (6) on artwork** — covers take `Radius.image` (4).
- **The gradient's whole perceptual ramp happens in the top 35%.** `tint()` restores base luminance, so stops 2–4 are all effectively `#121212` and the ramp is over by y≈295.
- **`elevation: 10` sits on a view with `overflow: 'hidden'` and no opaque background** — per DESIGN.md § 6.3 that combination is clipped on Android, so the cast exists on iOS and not on Android. Combined with the `fontWeight` no-ops, that is per-OS visual divergence, which PRODUCT.md's `adaptive` note explicitly forbids.
- **`game === undefined`** degrades to "Unknown Game" with an empty `artworkUrl` — `<Image source={undefined}>` renders a transparent 320×410 hole with a hairline border and a 20dp shadow around nothing. `<Poster>`'s lettered placeholder exists for this.
- **`edges={[]}`** opts out of `<Screen>`'s safe-area handling and re-implements it by hand at two call sites.

## Questions to Consider

1. If `<GameCase />` is explicitly permitted on a review masthead and this screen built an imitation that casts harder than the case does — was the case rejected on design grounds, or was the "Now Playing" reference simply stronger than the design system? DESIGN.md named this placement in advance. Someone read past it.
2. Whose screen is this? The game gets 410dp of artwork, a 23px title, a publisher line and two routes to its own page. The reviewer gets 12px of name. If the answer is "the game's," this is a second game page with the review as a footer — in which case what is `game/[id]` for?
3. Is there any reading of a 140dp tinted capsule at the control radius on which a first-time user does *not* try to tap it?
4. Why is this the one screen that refuses hide-on-scroll? The screens that decline do so because their bar names what a tab bar just switched. This bar says "NOW VIEWING REVIEW" — the one thing 410dp of cover art and 2,000 words of prose have already established.
5. If nobody's reply count is ever shown on their own review page, what brings a reviewer back for a third game?
