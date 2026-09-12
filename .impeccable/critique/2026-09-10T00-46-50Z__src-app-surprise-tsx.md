---
target: the surprise me feature and UI
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-09-10T00-46-50Z
slug: src-app-surprise-tsx
---
Method: dual-agent (A: design review · B: detector + mechanical evidence, isolated).
No browser/emulator available — all visual judgments computed from tokens and code, not seen.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 2 | Batch exhaustion tears the screen down to a spinner; starring gives no confirmation; rerolling announces nothing |
| 2 | Match System / Real World | 3 | Deck/shuffle is player-native, but "pool" leaks into user copy; "Surprise me" names both the feature and a sub-option |
| 3 | User Control and Freedom | 2 | Star overwrites the profile's one pinned song, no confirm/undo; no way back to the previous game |
| 4 | Consistency and Standards | 3 | Reuse exemplary; hardcoded 44 play disc, scaleTo 0.985 off-token, deck shadow above the case ceiling |
| 5 | Error Prevention | 2 | "Try soundtrack again" offered in the two cases where it cannot succeed |
| 6 | Recognition Rather Than Recall | 3 | Result never states which pool it drew from |
| 7 | Flexibility and Efficiency | 2 | Batch cursor is superb engineering the interaction discards — every reroll needs a scroll |
| 8 | Aesthetic and Minimalist Design | 3 | Result restrained; idle puts eight controls before one button |
| 9 | Error Recovery | 1 | ErrorState discards authored copy; retry usually cannot work; star.mutate has no onError |
| 10 | Help and Documentation | 2 | Exclude-played caption is good inline help; three game modes get none |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

Entry deck: highly specific, could not be lifted unchanged. Real IGDB art borrowed from an existing query, GamesWidget's hairline/shadow vocabulary, face-down card in the app's own material, docblock arguing its metaphor against GamesWidget's recorded rejection of the same tilt.

Result screen: specific in materials, generic in composition. Full-bleed art -> centred object -> centred title -> card -> stacked button pair is the universal random-result screen. The game page's masthead is asymmetric (case rises ~93dp INTO the hero); Surprise yields a +6dp GAP instead, so the case sits under the art. Two single-game screens, two mastheads, and the reveal uses the more generic one.

Idle screen: weakest, and the first thing a newcomer sees. A form, on a screen promising "No browsing."

Deterministic scan: detect.mjs exit 0, ZERO findings on all five component files. Verified non-vacuous (control run on src/ returned exit 2 / 14 findings, all in constants/stores.ts and lib/news/rss.ts). No false positives to triage. Zero hardcoded colours, zero rgba(, zero 'transparent'. Zero raw <Text>; all 16 usages carry a variant. Zero fontWeight/fontStyle. Reduced motion fully handled including the hand-rolled fan.

Visual overlays: none. No Playwright/Puppeteer/chromium. No live server started, no overlay exists.

## What's Working

1. The entry deck is design argument, not decoration — real box art, deliberately unrelated covers (previewing real candidates would be a promise the random-offset roll does not keep), collapses to one labelled control for VoiceOver, one shared press driver.
2. Cost architecture is an interaction property: one IGDB call per 50 rolls, three-tier soundtrack cache ladder, pure pickTrack.
3. Failure copy at the moment it matters: "The soundtrack lookup did not come back. Your game is still here."

## Priority Issues

### [P0] The loop happens below the fold, and the reveal is seen once per session
"Surprise me again" begins at y ~= 950 on 390x844 (~180dp below fold on 667pt). The Animated.ScrollView has no ref; anotherGame() only mutates cursor/round, so scroll position persists across rolls — the new game's case and title render above the viewport. Loop is scroll -> tap -> see nothing -> scroll up, for a user PRODUCT.md describes as one-handed and just off a controller.
FIX: ref + scrollTo({y:0}); AccessibilityInfo.announceForAccessibility(game.title) (pattern at game-case-flip.tsx:171). Better: make the roll a swipe on the case.
COMMAND: /impeccable layout

### [P0] The reveal is unstaged, and the staging is already in the repo
src/hooks/use-arrival.ts exports ARRIVAL_OBJECT ("a physical object settling — the game case") and ARRIVAL_CONTROL, both reduced-motion-aware; game/[id].tsx:416 uses <GameCaseFlip>. Surprise uses static <GameCaseDisplay> and no arrival. DESIGN.md §22 mandates skeletons over spinners; batch exhaustion hits the isPending early return and replaces everything with an ActivityIndicator, which also makes loading={batch.isFetching} dead code in that path.
FIX: swap to <GameCaseFlip> (identical protected <GameCase> underneath); stagger title/buttons off useArrival; result-shaped skeleton; keep previous game on screen during refetch.
COMMAND: /impeccable animate

### [P1] Failure and empty states misinform, and one loops forever
- new Error('That pool came back empty.') is discarded by readableError() (screen.tsx:178); user reads "Something went wrong on our side." Button says "Try another pool" but anotherGame() re-rolls the same pool.
- One-track album breaks "Another song" permanently: pickTrack with length 1 returns the same track; anotherSong() then pauses playback and re-sets it.
- star.mutate() has no onError — failed write is invisible.
- excludeLogged silently returns the unfiltered batch, so "Exclude games I've played" quietly stops being true.
FIX: EmptyState not ErrorState; guard anotherSong when tracks.length < 2; add onError; surface the exclusion fallback.
COMMAND: /impeccable harden

### [P1] Touch targets fall below the floor on the primary controls
DESIGN.md §23: 44/48 minimum, "no exceptions".
- <SortBar> pills (7 of them, the idle screen's primary control): ~26dp
- Star IconButton size="small": 32x32
- "Try soundtrack again" size="small": minHeight 36
- Play disc: hardcoded 44 — passes iOS, 4dp short on Android
No hitSlop anywhere in the five files. Three of four are inherited from shared primitives (SortBar used in 7 files); the hardcoded 44 is authored here and theme.ts explicitly warns against it.
COMMAND: /impeccable audit

### [P1] The feature opens on a form and closes without a verb
Idle: eight visible controls guard one button on a screen promising "No browsing" — 4 of 8 cognitive-load checks fail, all on this screen. Result: the two actions are reroll and "Open game page". Nothing lets the user say "yes, this one" — no wishlist, backlog or log, in a logging app. Success state is indistinguishable from skip state.
FIX: collapse idle to heading + subtitle + button, controls behind the "Tune it" disclosure that already ships. Add wishlist/backlog to the result, arguably as primary.
COMMAND: /impeccable shape

## Persona Red Flags

Casey (one-handed, distracted — PRODUCT.md's literal operating context): reroll at y~950 with off-screen result; spinner destroys context on batch exhaustion; the 30-second preview KEEPS PLAYING after navigating to /game/[id] (TrackStage's player releases only on unmount, and the screen stays mounted) with no transport control visible.

Sam (screen reader): neither page title carries accessibilityRole="header" (surprise.tsx:187, :287); game title announced twice (GameCase self-labels, then visible text below); LoadingState is not a live region; reroll announces nothing.

Riley (stress tester): one-track loop; changing SOUNDTRACK under "Tune it" does nothing visible (TrackStage reads trackMode only in a lazy initialiser); foryou exhausts in 24 rolls not 50 (recommendFromLogs(logs, 24)) against a docblock promising fifty; game title and developer render with no numberOfLines against unbounded IGDB strings.

The Letterboxd keeper (from PRODUCT.md): the star silently overwrites the one curated item on their profile, mid-shuffle, via a 32dp glyph with no confirm/undo/error handling — and there is still no way to record a game they liked.

## Minor Observations

- Game case usage is legal in spirit but DESIGN.md §4.1.2 says the case appears "nowhere else"; this is a fifth place. The usage is correct; the document is wrong. Same for <AccentProvider> in CLAUDE.md ("the four screens").
- AMBIENCE_OPACITY = 0.55 under a comment claiming it "matches the game page". The game page is 0.98. Comment is false (verified).
- Accent taken then not used: quiet masthead lines stay textSecondary/textMuted where the game page uses accent.quietInk. Three accent fills coexist (button, play disc, progress fill).
- Deck shadow 0.5/6/(3,2)/5 exceeds GamesWidget's 0.45/5/(3,0)/4 and Elevation.overlay's 0.38; DESIGN.md §6.2 makes the case the ceiling at 0.45.
- scaleTo={0.985} vs Motion.pressScale 0.98.
- Copy drift: "track" (idle) vs "song" (entry card); &rsquo; vs straight apostrophe; "pool" is an implementation word.
- One entry point only: the second band of Discover.
- <Animated.ScrollView> on the idle branch drives nothing.

## Questions to Consider

1. If the defaults are right, why is the form the first screen at all?
2. Should a roll be a swipe? A deck was cut to get here.
3. What does the user do when they like the game? Would "Add to backlog" as primary make this the front door to the logging loop?
4. Most obscure games have no soundtrack and "Hidden gems" is first-class. Honest pairing, or prefer games with a cached soundtrack?
5. Why is the ambience 0.55 here and 0.98 on the game page?
