---
target: the review logging screen
total_score: 22
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-27T00-05-58Z
slug: src-app-log-id-tsx
---
**Method: dual-agent (A: a03cc7fd63c395015 · B: a5516ff4a8316acb4)**

# Critique — Review logging screen (`src/app/log/[id].tsx`)

Mode: **Operate**. Target is the modal where a user logs a played game and writes the review. Browser inspection is n/a (native RN target, no viewable URL); Assessment B substituted a measured static evidence sweep.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Nothing acknowledges a save — `onSuccess` invalidates and calls `router.back()` (line 216). No toast, no haptic, no landing. Create-vs-edit is disclosed only by the button label 690dp down. |
| 2 | Match System / Real World | 3 | Player vocabulary is right ("Backlog", "Platinum", verdict bands). But the entry CTA says "Write a review" and the exit CTA says "Log game" (line 431) — the app renames the task mid-flow. |
| 3 | User Control and Freedom | 1 | Unconfirmed delete (437–445), no unsaved-draft guard, iOS swipe-to-dismiss live, no undo after either. |
| 4 | Consistency and Standards | 2 | Destructive action uses `variant="ghost"` when `variant="danger"` exists; the *same* deletion is confirmed at `game-actions.tsx:155`. Spinner where DESIGN.md § 22 mandates skeletons. Two validation philosophies on one screen. |
| 5 | Error Prevention | 2 | `SelectField` and per-keystroke metric clamping are real wins — but ticking Advanced with zero metrics scored silently nulls an existing rating (line 168 → `core.ts:105`). |
| 6 | Recognition Rather Than Recall | 3 | Strong: all 14 metric labels visible, selected platform rendered, running average live. Deduction: the ± nudges act on an invisible 75 anchor (`score-input.tsx:45`) — readout says "—", pressing `−1` yields 74. |
| 7 | Flexibility and Efficiency | 2 | Primary action sits at the end of a ~1400dp scroll. No keyboard chaining across 14 metric inputs. No last-used platform default. No draft. |
| 8 | Aesthetic and Minimalist Design | 2 | Six identically-weighted section labels; score type outranks the game title 38:16 against DESIGN.md § 24; the advanced panel detonates ~810dp inline. |
| 9 | Error Recovery | 2 | The hours error renders ~600dp from the field that caused it (line 189 → 423), with `TextField`'s own `error` prop unused there — while the review errors are exemplary and inline. |
| 10 | Help and Documentation | 3 | The metrics copy is genuinely editorial. The flagship long-form feature gets no guidance at all — only two rules about rejection. |
| **Total** | | **22/40** | **Acceptable — significant improvements needed** |

## Design Specificity Verdict

**LLM assessment: 4/10 — a competently tokenised settings form with three authored moments bolted on.**

Strip the box art and the composition is: grey 12px section word → control, ×6, then two full-width buttons. That is an account-settings screen. "Review" — positioning pillar #2 — is announced by the same grey word, same size, same weight, as "Completion".

The affordance count states the priority plainly:

| Concern | Affordances |
|---|---|
| Score | 38pt numeral, verdict word, drag track, ±1/±10 nudges, clear, 14-category expansion — **6** |
| Writing | two undecorated text fields — **2** |

PRODUCT.md principle #3: *"anything that makes a score easier to give than an opinion is pushing the product the wrong way."* This screen makes the score three times easier by construction.

**Measured, using the real ladder values** (`x8`=6, `x16`=12, `x24`=18): the word "Review" lands at ≈ y=690 on a ≈780dp iOS modal viewport. The 260dp body box is **entirely below the fold on every shipped device**. With Advanced metrics ticked, the panel injects ~810dp *between* score and review, putting "Review" at ≈ y=1500 — two full screens of number boxes between the user and the writing surface they pressed "Write a review" to reach.

**Deterministic scan: clean.** `detect.mjs --json` returned exit 0 / `[]` on all five files (target plus `score-input`, `review-metrics`, `text-field`, `select-field`). Verified genuine, not an unsupported-filetype no-op. `npx tsc --noEmit` → exit 0, zero errors. Token compliance is near-spotless: no hardcoded hex in code, no raw `fontWeight`, no `fontStyle: 'italic'`, no bare `'transparent'` inside a gradient. Two small hits only — `review-metrics.tsx:292` uses a raw `fontSize: 17` not aliased to any `Type` step, and `text-field.tsx:3` imports `Text` from `react-native` rather than the `<Text variant>` primitive, using it at lines 55 and 76.

**Where the detector and the design review disagree:** the detector's silence is not a clean bill. Every issue below is invisible to a regex — ordering, guard rails, and computed tap geometry. Treat the clean pass as evidence the *token layer* is disciplined, which it genuinely is.

**Visual overlays:** not available. Native target, no injection path, no live server started.

## Overall Impression

The craft in this file is real and visible — the both-or-neither review rule, the `foreign` platform escape hatch, the clamp-as-you-type metrics. All three are decisions someone thought hard about and documented. But they are local wins inside a global composition that argues against the product. The screen is a scoring console with a text box at the bottom, and the single biggest opportunity is not a new feature: it is **reordering what is already there** so the writing comes before the number, and giving the act of finishing a review an ending.

## What's Working

**1. The both-or-neither review rule, enforced by derivation (line 172, 193–200, 408, 419).** `writingReview` is inferred from what was typed, so there is no "write a review?" toggle adding an eleventh decision. Errors appear inline on the offending field the moment state becomes invalid. An editorial standard enforced at zero interface cost — the hardest kind to get right.

**2. `<SelectField>` for "Played on", with the `foreign` escape hatch (138–158).** Constraining a free-text field is easy; constraining it without rewriting anyone's existing record is not. Legacy values are kept, offered and marked `SAVED`. The options come from the game's own IGDB platform list, so the menu is the release's, not a global one.

**3. Metrics held as text, clamped per keystroke, blank meaning "excluded"** (`review-metrics.tsx:28, 40–61`). A partially-typed "8" is representable, the running average never lurches through a transient 250, and a blank box is an absent opinion rather than a 50 — so a four-category reviewer makes a narrower claim than a fourteen-category one, and the model says so.

*Honourable mention:* `AccentProvider artwork={game.coverUrl}` (line 85). One line, and it is the only thing making this screen feel like it belongs to *this game*.

## Priority Issues

### [P0] The form is ordered against the product's founding principle

**What.** Order is Status → Score → Advanced Metrics → Completion → Hours/Platform → Review → Save. The review body is below the fold on 100% of devices. Score gets 6 affordances and 38pt of type; writing gets 2 bare boxes under a 12pt grey label. The button leading here says "Write a review"; the button leaving says "Log game".

**Why it matters.** Success is defined in PRODUCT.md as *"someone coming back to write about a second game."* This layout is a measurable statement that the number matters more than the words. It is also a DESIGN.md § 24 violation — the hierarchy ladder puts the game title above the score, and the score is 2.4× the title here.

**Fix.** Reorder to `gameHead → Status → Review → Score → Completion → Hours/Platform`: status first because it is the ten-second task's only field, writing next because it is what the app is for, the score after the opinion it summarises. Pin the primary action into a footer inside the existing `KeyboardAvoidingView` (line 240) so both tasks end somewhere reachable. Make the CTA name the work — `writingReview ? 'Publish review' : existing ? 'Save changes' : 'Log game'`, using the flag that already exists at line 172. Give the Review section a heading with real weight.

**Suggested command:** `/impeccable layout`

### [P0] Both irreversible paths are unguarded

**What.** (a) "Remove log" (437–445) deletes rating, review, metrics, hours, platinum and platform with **no confirmation** — `grep "Alert\|confirm("` returns nothing — styled `ghost` (white label, not danger), full-width, directly beneath the primary action, and 18dp above the safe-area edge. (b) Dismissing the modal via the X disc or iOS swipe discards an unsaved 40,000-character review with no prompt and no draft; all state is plain `useState` (111–124), no AsyncStorage anywhere.

**Why it matters.** The app already solved (a) correctly at `game-actions.tsx:155–162` with a written alert naming the game — this is the *inconsistent* screen, and it is the one where the writing lives. For (b), PRODUCT.md's operating context is a phone, one-handed, someone who just put a controller down. Interruption is the default condition. Sharply: **the only control always on screen is the one that throws your work away, and it does not ask; the one that saves it is 1400dp below.**

**Fix.** Reuse the existing alert and switch to `variant="danger"`. Raise the scroll container's bottom padding to `Spacing.x64` (48) per DESIGN.md § 25 — one token, and it moves a silent delete out of the Android gesture strip. Add a dirty check that sets `gestureEnabled: false` and routes the X through `<FrostedTopBar onBack>` (which already exists) with a discard prompt. Persist a draft to AsyncStorage keyed `['log-draft', userId, gameId]`.

**Suggested command:** `/impeccable harden`

### [P1] The score cannot be set with a screen reader, and four control types are under the tap floor

**Confirmed by both assessments.** `score-input.tsx:100–102` declares `accessibilityRole="adjustable"` with `accessibilityValue`, but implements **no `accessibilityActions` and no `onAccessibilityAction`** — VoiceOver announces it as adjustable, the user swipes, nothing happens. The only other path is a `locationX` drag on a raw responder.

Measured heights against `TapTarget` (44 iOS / 48 Android, `theme.ts:738`), with **no `hitSlop` anywhere in these five files**:

| Control | Computed | Short by |
|---|---|---|
| "Clear all metrics" (`review-metrics.tsx:126`) | ~13dp | 31/35 |
| Score drag track (`score-input.tsx:143`) | 14dp | 30/34 |
| "Clear score" (`score-input.tsx:73`) | 22dp | 22/26 |
| Status pills (503–511), 6dp apart | 28dp | 16/20 |
| ± nudges (`score-input.tsx:152`) | 28dp | 16/20 |
| Advanced tick row (`review-metrics.tsx:263`) | 36dp | 8/12 |
| Toggle rows (516–524) | 38dp | 6/10 |

**Why it matters.** DESIGN.md § 23: *"at least 44×44. No exceptions and no tiny buttons — where a control looks smaller, padding is doing the work."* Here padding is explicitly not doing the work; the responder props sit on the 14dp view itself. This is the app's own no-exceptions rule, broken on the primary control of its flagship feature.

Separately: the two Review fields (402, 411) have **no accessible name at all** — no `label`, no `accessibilityLabel`, only placeholders, which stop being announced once text is entered. And `TextField` never forwards its `label` to the input, so even "Hours played" has no programmatic name. Contrast, by contrast, is clean: every text pair clears 4.5:1 (worst is `textMuted` on `surfaceElevated` at 4.80:1). The only sub-3:1 numbers are the Toggle "on" wash fills against the page (1.25–1.28:1) — a fill-visibility boundary, mitigated because the label and glyph both change colour.

**Fix.** Add `accessibilityActions` + `onAccessibilityAction` calling `nudge(±1)`. Wrap the track in `paddingVertical: 15` so the touch area is 44 and the visual stays 14. `minHeight: TapTarget` with `justifyContent: 'center'` on pills, nudges and the clear buttons. Pass `label` on both review fields, and have `TextField` forward it to `accessibilityLabel`. Add `accessibilityRole="header"` to the four section labels — on a 1400dp form it is the only way to navigate.

**Suggested command:** `/impeccable audit`

### [P1] Ticking "Advanced review metrics" and scoring nothing silently destroys an existing rating

**What.** `effectiveRating = advanced ? averageMetrics(metrics) : rating` (line 168). With `advanced` on and zero boxes filled, `averageMetrics` returns `null`, and `saveLog` writes it over whatever was there (`core.ts:105`). A user with a saved 85 who ticks the box out of curiosity and taps Save loses the 85. Two passive captions are the only signal.

**Why it matters.** `logs.rating` is, per CLAUDE.md, *"the only score anything reads"* — feeds, game averages, profile stats, share text. This nulls the most load-bearing column in the product, silently, from a control whose whole purpose is exploratory.

**Fix.** Gate Save when `advanced && metricCount === 0 && existing?.rating != null`, and surface the reason inline on the metrics panel where the cause is: *"Advanced metrics are on but nothing is scored — saving would clear your score of 85."*

**Suggested command:** `/impeccable harden`

### [P2] The hours error is reported 600dp from the field that caused it

**What.** `'Hours played must be a positive number.'` is thrown inside `mutationFn` (189–191) and rendered as a bare red line above the buttons (423–427). The Hours field receives no `error` prop, is not scrolled to and is not highlighted — despite `TextField` supporting `error` and rendering both a red outline and a footnote (`text-field.tsx:9, 68`). The review fields, on the same screen, do exactly the right thing.

**Why it matters.** It is the only save-blocking condition the user cannot see coming, and the pointer to it is off-screen by the time it fires. `"1,5"` on a numeric keyboard produces `NaN` and lands here.

**Fix.** Derive `hoursError` during render the way `writingReview` already is, pass it to `<TextField error={…}>`, and gate Save on it.

**Suggested command:** `/impeccable clarify`

## Persona Red Flags

**Sam (accessibility-dependent)** — Cannot score a game *at all*: the `adjustable` role has no action handler, and the alternative is a pixel-position drag. Seven control types under the tap floor with zero `hitSlop`. No `role="header"` on any section, so no landmark navigation on a 1400dp form. The status pills are four `role="radio"` with no radiogroup and no group label. *Genuinely good:* `role="switch"` with correct `checked`+`disabled` on the toggles, `"{label} score out of 100"` on every metric input, and a glyph beside every status hue.

**Casey (distracted mobile)** — The persona PRODUCT.md's operating context is literally written about, and the screen fails them hardest. No draft persistence plus two unguarded exits. The thumb zone is inverted: the only permanently reachable control is the X that discards, and the nearest-to-thumb control at the bottom of the scroll is an unconfirmed delete 18dp above the safe area. The ten-second status change costs a full-screen scroll past score, metrics, completion, hours, platform and a 260dp review box to reach Save. On iOS the 14 metric inputs use `number-pad`, which has no return key — the `returnKeyType="done"` at `review-metrics.tsx:196` is a no-op, so there is no keyboard-dismiss affordance beyond tapping dead space.

**Riley (stress tester)** — A 40,000-char `multiline` field with unbounded auto-growing height inside a `ScrollView` (411–420); the outer scroll owns the gesture, so caret tracking degrades exactly on the content pillar #2 promises. Silent truncation at both limits — the 140-char headline has **no counter at all** while the 40,000-char body does, which is backwards. Unsaved-state loss on refresh/interruption, no undo after Remove log. And the body counts *characters*; writers count words.

**"The person who keeps a Letterboxd" (project persona, from PRODUCT.md § Users)** — The composition is Letterboxd inverted: that product's log sheet leads with the review box and puts the rating in a small row beside it. This one leads with a 38pt numeral, a drag track, ±10 nudges and a 14-category expansion, and puts the writing below the fold. There is also **no re-read moment** — the Letterboxd loop is write → see it typeset → see it in the feed, and here the loop is write → the modal closes. `src/app/review/[id].tsx` already exists and is a full magazine-shaped reader; the flow never routes there.

## Minor Observations

1. Line 495 — `paddingVertical: Spacing.x24` gives 18dp bottom against DESIGN.md § 25's 48. One token, and it also mitigates the delete-in-gesture-strip problem.
2. Lines 60/68/76 — `<LoadingState />` is a spinner; DESIGN.md § 22 says skeletons. The shape of this screen is fully known before data arrives.
3. `score-input.tsx:45` — the invisible 75 anchor: readout says "Tap the bar to score", `−1` yields 74.
4. Line 406 — the 140-char headline has no counter; line 418's 40,000-char body does.
5. `review-metrics.tsx:181` — `accessibilityRole="none"` on an interactive `Pressable` that focuses the input.
6. `review-metrics.tsx:292` — raw `fontSize: 17`, not aliased to a `Type` step. `text-field.tsx:3, 55, 76` — raw `react-native` `Text` bypassing the `<Text variant>` primitive.
7. Line 431 — `existing ? 'Save changes' : 'Log game'` is the only disclosure of create-vs-edit, and it is at the very bottom.
8. Line 172 — `writingReview` is the best signal on the screen about what the user is actually doing, and it is spent entirely on validation. It could drive the CTA, the section emphasis and the post-save destination.
9. No haptics anywhere in the project, despite PRODUCT.md § Platform naming them among the OS affordances the `adaptive` decision commits to honouring.
10. Lines 240–243 — `KeyboardAvoidingView behavior={undefined}` on Android correctly relies on `adjustResize`, which is set in both `app.json:26` and the manifest. **Verified working, not a finding** — recorded so it is not re-flagged.
11. `review/[id].tsx:285` renders `"{n}% complete"`, but nothing in the codebase ever writes a partial percent. The binary UI here is honest; the reader implies a granularity that cannot exist.
12. 🛡️ **Preservation check.** Nothing above touches `<GameCase>`, `<GameCaseDisplay>`, `Type.caseTitle`/`caseEdition`, `Radius.caseImage`/`caseSpine`, the case `WIDTHS`, geometry or shadow. `<GameCaseDisplay size="small">` at line 249 is used correctly per the placement rule, and every proposal leaves it exactly as it is.

## Questions to Consider

1. **If you removed the score entirely, would this screen still be recognisably GameLog?** Right now: yes — a game diary with a text box. Remove the *review* and it is still a fully functional tracker. Which of those two is the product PRODUCT.md describes?
2. **The button that leads here says "Write a review." Why does the button that leaves say "Log game"?** The app changes its mind about the task between entering and exiting the same screen.
3. **`<SelectField>` proves this team knows many options belong on their own surface.** Why do 14 metric inputs expand in place, between the user and the writing, when the alternative pattern is imported into the same file?
4. **Nothing marks the end of writing a review.** What would this product feel like if finishing landed you on `review/[id]` — your own words, typeset, score as masthead — instead of on the page you were already on?
5. **PRODUCT.md says the ten-second log and the sit-down review "should not be made to feel like the other."** This screen is both, in one scroll, one order, one Save. Should it be two stages rather than one form that serves neither well?
6. **The best writing on this screen is a caption on the scoring panel** (*"how well the game does it, not how much of it there is"*). What would the Review section say if someone wrote it with that care instead of a rule about rejection?
