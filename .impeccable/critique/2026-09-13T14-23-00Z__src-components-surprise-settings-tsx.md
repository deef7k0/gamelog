---
target: the surprise me settings/sorting options screen
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-09-13T14-23-00Z
slug: src-components-surprise-settings-tsx
---
Method: dual-agent (A: design review · B: detector + measured evidence, isolated until synthesis).
No emulator or device available — every dimension is computed from StyleSheet literals, Type line heights and Spacing values, not seen.

## OWNER CONSTRAINTS — BINDING ON ALL FUTURE RUNS

Stated by the owner in this session, after the first draft of this critique. Any
later command that re-opens these has misread the product, not found a problem:

1. **The settings screen stays.** It is not a gate in front of the payoff to be
   removed, deferred behind the gear, or skipped with a "just deal me something"
   path. Do not propose opening the tab onto a card dealt from defaults.
2. **The name "Surprise Me" stays.** Do not propose renaming the screen or the
   feature, and do not treat the headline "One game, one song, no browsing" as a
   contradiction to be resolved by cutting controls.
3. **Every setting matters. This is a discovery tool.** The purpose is finding
   obscure games. The option count is the *feature*. Genre, perspective, rating
   floor, pool mode, soundtrack mode and the played exclusion are all load-bearing
   and none may be removed, demoted to a secondary screen, or folded into an
   "advanced" disclosure to shorten the page.

**What this invalidates from the first draft**, withdrawn and not to be revived:
all four "Questions to Consider"; the "a surprise you specified is not a surprise"
emotional-journey framing; the recommendation to move SOUNDTRACK to the dealt
card; the "which of these six groups has anyone changed twice" observation; and
the original P1 fix of collapsing 23 genres to a curated 6.

**What this does not touch.** Every finding below is about ergonomics, legibility,
accessibility and state handling. None depends on the premise. Two get *stronger*
under the discovery framing and are re-scoped accordingly: the genre wall (§P1)
and the pool estimate (§P1) — a tool for finding obscure games must make a long
vocabulary navigable and must say when a narrowing has reached zero.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|---|---|---|
| 1 | Visibility of System Status | 1 | Nothing reports what the settings will yield — no pool size, no example, no count. `updatePrefs` invalidates a batch that is `enabled: dealt`, so pre-deal no pixel moves. `genres.isError` unhandled: an IGDB failure leaves the "any of these" caption floating above nothing |
| 2 | Match System / Real World | 3 | "Genres — a game matching any of these" pre-empts the AND/OR misread; IGDB provenance named. Undercut by "Mixed", which means a coin-flip and says so nowhere |
| 3 | User Control and Freedom | 2 | `Clear` resets 3 of 6 prefs with nothing marking the boundary; the gear round trip silently destroys your place in the deck |
| 4 | Consistency and Standards | 3 | `<SortBar>`, `Radius.control`, the selection rule all correct. Two breaks: band headings at `label` against DESIGN.md §17, and `TapTarget` imported by 26 files but by neither this file nor `sort-bar.tsx` |
| 5 | Error Prevention | 1 | 40 of 43 controls under the tap floor at a 31dp row pitch; a mis-tap silently re-runs the query. The `foryou` collapse jumps ~310dp under the thumb with no animation |
| 6 | Recognition Rather Than Recall | 2 | Filters set then hidden by `foryou` become pure recall — not shown, not counted, not mentioned |
| 7 | Flexibility and Efficiency | 2 | Persistence is genuinely good. No genre search, no presets, one saved configuration per user — a real miss for a tool meant to be used repeatedly in different moods |
| 8 | Aesthetic and Minimalist Design | 2 | Revised up from 1 after the owner constraint: the option count is the feature, not clutter. What remains is that the chip wall has no internal hierarchy, no rhythm and no anchors, and the page's only three structural headings are its faintest type |
| 9 | Error Recovery | 2 | `EMPTY_FILTERED` / `EMPTY_FORYOU` / `EMPTY_POOL` are three genuinely distinct diagnoses — all firing after a wasted roll |
| 10 | Help and Documentation | 3 | Four pieces of real in-place help. Docked because SOUNDTRACK gets none while the other three groups each get one |
| **Total** | | **21/40** | **Acceptable** |

For comparison, the 2026-09-10 run on the Surprise feature as a whole scored 23/40
and called this screen "the weakest, and the first thing a newcomer sees."

## Design Specificity Verdict

**LLM assessment: generic.** Strip four strings — GAME, NARROW IT DOWN, SOUNDTRACK,
"Exclude games I've played" — and this file drops into a podcast app unchanged.
`surprise-settings.tsx:126-277` contains zero references to artwork, zero to the
case, zero to the deck, zero to a game's identity hue. It is the only screen in the
flow that never touches `AccentProvider` — the `!dealt` branch sits outside the
provider at `surprise.tsx:749`, so the single coloured pixel on the page is the
word "Clear".

Seventy lines later the same feature has a ±7° lean, a 0.16 sheen ceiling, a
face-down deck and a page that washes colour on the UI thread. Someone thought very
hard about the payoff. The configuration surface got a stack of `<View
style={styles.group}>`. The code is disciplined — correct reuse, correct radii,
docblocks that argue radiogroup-vs-checkbox semantics properly. That is
craftsmanship in service of a shape nobody designed. Reuse is not authorship.

This verdict is about composition and material, not about the screen's right to
exist, and survives the owner constraints intact. A discovery tool for obscure
games is if anything a *stronger* invitation to look like this app: none of the
identity vocabulary the rest of the feature owns appears here.

**Deterministic scan: `detect.mjs` exit 0, zero findings on both files — and that
result is near-vacuous, verified.** The registry holds 59 rules; for `.tsx` the
extractor pulls only styled-components/emotion tagged templates, and this project
uses `StyleSheet.create` object literals with token indirection. The entire CSS
rule family (`tiny-text`, `low-contrast`, `cramped-padding`, `design-system-color`…)
has nothing to parse. `PAGE_ANALYZER_EXTS` excludes `.tsx`, so every page-level
analyzer never runs. Zero findings means "no CSS text found," not "no problems."
No false positives to triage — the inverse problem applies. `npx tsc --noEmit` and
`npx eslint` both pass clean.

**Visual overlays: none.** No browser, no dev server, no injection — this is React
Native. No user-visible overlay exists.

## What's Working

1. **Controls are replaced, not disabled — and the replacement explains itself.**
   `filtersApply` swaps the whole filter block for an authored sentence when
   `foryou` is on, rather than greying three groups out. PRODUCT.md principle 2
   executed literally: "half a filter applied silently is worse than a filter
   openly not offered." Most apps ship a disabled state and a tooltip.
2. **The multi-select chips are a second control with a real second carrier,
   argued from semantics.** Lines 288-298 refuse `<SortBar>` for many-of because a
   radiogroup announcing "selected" on four radios "is a lie to a screen reader
   rather than a styling shortcut." The tick is the sighted channel for the same
   fact. Two carriers, neither of them hue.
3. **Copy that names the operator and the provenance.** "Genres — a game matching
   any of these" kills the AND/OR ambiguity that would silently empty a pool on a
   third genre. "IGDB's community score… Unrated games are kept on 'Any' and
   dropped by every other step" names whose number it is and the non-obvious side
   effect. Both are sentences you only write after watching the failure happen.

## Priority Issues

### [P0] The primary action is clipped by the chip wall above it

**What.** "Surprise me" is the last child of a `ScrollView` with
`showsVerticalScrollIndicator={false}`. Content totals ~763dp against a 707dp
viewport (844 − 47 top inset − 56 bar − 34 bottom). The CTA's top edge lands at
y≈673, bottom at 733 — 34 of its 60dp visible at rest. The two assessments
disagree on severity: B measures 34dp showing, A measures it entirely below the
fold, and the difference is whether the 4-option GAME row wraps to two lines. Both
are reachable; "Based on my games" appearing for an experienced user pushes it
under. Honest statement: between 0 and 34dp of a 60dp button is on screen, and it
gets worse with OS text scaling (`<Text>` sets no `allowFontScaling={false}`),
never better.

**Why it matters.** The element clipping at the fold is a wrapping chip row — the
least fold-legible object possible, because a half-row of chips reads as "the row
wrapped," not "there is a button down there." `surprise.tsx:116-129` already
documents this exact bug being found and fixed on the dealt screen. The fix was
never applied here.

**Fix.** Pin it. Move the `<Button>` out of the `ScrollView` into a sibling footer
inside `<Screen>`, padded off the bottom safe-area edge. Always reachable, always
under the thumb, and the scroll becomes purely about refinement. Note this is
*compatible* with the owner constraints — it keeps every control on the page and
changes only where the commit action lives.
**Suggested command**: /impeccable layout

### [P0] 40 of 43 controls are under the tap floor, and selection rests on a 1.08:1 step

**What.** `styles.chip` and `sort-bar.tsx`'s `pill` both compute to
`Spacing.x8`(6)×2 + `Type.caption.lineHeight`(13) + hairlines = **25.67dp**.
`TapTarget` is 44/48. That is 58% of the iOS floor, 53% of Android's, across 23
genre chips, 5 perspective chips and 11 `SortBar` pills, at a 31dp row pitch with
6dp gaps. `CLEAR_SLOP` is documented as "Lifts a one-word inline control to the tap
floor" and lands at **37dp** — failing both. Only the toggle (49.67) and the CTA
(60) pass, and the toggle passes incidentally: drop its caption line and it falls
to 35.67.

**Why it matters.** `theme.ts:986` states the rule — "A hard-coded 44 in a
component is the same bug this constant exists to prevent, one file further down."
`TapTarget` is imported by 26 files; neither of these two is one. A mis-tap
silently toggles a neighbouring genre *and* silently re-runs the query. Compounding
it: the selection fill delta measures `surfaceElevated` → `surfaceSelected` =
**1.081:1** and `borderStrong` over it = **1.45:1**, both ~2× below WCAG 1.4.11's
3:1 for a non-text boundary carrying state. On the chips the 13px tick rescues it.
On the four `SortBar` groups there is no glyph — "which pool is selected" rests
entirely on a 10px word going `#A8A8A8` → `#F5F5F5`.

The app's selection law is not the problem and must not change; this screen is
where its weakest signal is most load-bearing. This issue scales *with* the owner
constraint: more controls kept means more sub-floor targets, so the floor fix is a
precondition for the screen staying as dense as it is.

**Fix.** Height only — leave `Radius`, `Elevation` and the selection tokens alone.
Add `minHeight: TapTarget` + `justifyContent: 'center'` to `styles.chip` and to
`sort-bar.tsx`'s `pill`; set `CLEAR_SLOP` to `{ top: 18, bottom: 18, left: 16,
right: 16 }`. A 44dp surface also makes the 1.08:1 delta legible where a 25dp one
does not. Knock-on: the genre wall grows ~184dp → ~300dp, which makes the next
issue a prerequisite rather than an option.
**Suggested command**: /impeccable audit

### [P1] 23 genres are unnavigable — a findability problem, not a count problem

**Re-scoped under the owner constraint.** The original finding proposed collapsing
to a curated 6. That is withdrawn: this is a discovery tool and the full IGDB
vocabulary is the point. The defect is that the vocabulary is presented as an
undifferentiated wall.

**What.** `getGenres` returns IGDB's full 23-genre vocabulary (`limit 100`, `sort
name asc`, no curation), rendered as 6 wrapped rows ≈ 184dp — 26% of the viewport,
growing to ~300dp once the tap floor is fixed. Alphabetical ordering buries
Shooter, Strategy and RPG mid-wall behind Adventure and Arcade. No search, no
grouping, no anchors, no ordering by usefulness, and no indication of which genres
are even productive for the pool you are in.

**Why it matters.** For a tool whose job is surfacing obscure games, the genre
vocabulary is the primary instrument and it is currently a flat list sorted by an
accident of spelling. The user cannot scan it, cannot find a genre without reading
all 23, and gets no signal about which combinations are fertile. Note the contrast
inside your own codebase: `getPlatforms` sits directly below `getGenres` in the
same file, is sorted and capped deliberately, and its docblock says an unsorted
picker of 200 is "unusable" — the same argument applies at 23 without implying the
list should be shortened.

**Fix (keeping all 23).** Make the wall navigable rather than shorter: order by
catalogue frequency or by pool productivity instead of alphabetically; keep
selected genres pinned to the front so the current configuration is always
readable without scanning; and give the group a sticky caption so the 6 rows have
a header while they are being read. If the row count after the tap-target fix is
still too tall, a scrollable fixed-height genre region preserves every option while
capping the page cost — it removes nothing.
**Suggested command**: /impeccable layout

### [P1] The user commits blind; every diagnosis costs a wasted roll

**Strengthened under the owner constraint.** Finding obscure games means
deliberately narrowing toward a small pool. That makes "how small is it now" the
central readout of the whole screen, and it does not exist.

**What.** `updatePrefs` diffs, bumps `round` and invalidates a batch that is
`enabled: dealt && …` — so pre-deal, nothing fetches, nothing changes, no pixel
moves beyond the chip's own selected state. No pool count, no example, no estimate.
The user tightens four filters, presses the CTA, and learns from `EMPTY_FILTERED`
that the combination matched nothing.

**Why it matters.** This is the gap the excellent empty states exist to paper over.
Diagnosis after the fact is strictly worse than prediction before it, and here it
costs a full IGDB round trip plus a failed roll. For a discovery tool it also
destroys the core loop: the interesting configurations are the narrow ones, and the
screen gives no way to steer toward "narrow but non-empty."

**Fix.** `getSurprisePool` already builds the exact `where` clause. A debounced
`count` against the same clause, cached on the filter tuple at `staleTime:
Infinity`, renders one caption under the `NARROW IT DOWN` head: "About 1,200 games
match." Under a threshold: "Only 6 games match — try loosening one." Cheapest item
on this list, and it converts the screen from blind commitment into a steering
instrument. Minimum version: put the estimate on the CTA — `Surprise me · ~1,200
games`.
**Suggested command**: /impeccable harden

### [P1] Peeking at your settings destroys your place in the deck

**What.** The gear at `surprise.tsx:745` calls `setDealt(false)`. Returning via the
CTA calls `setCursor(0)`. The batch is `staleTime: Infinity`. So: twelve swipes
deep, tap the gear to check a setting, change nothing, come back — you are returned
to index 0 of the same cached batch and the twelve cards are gone. No warning, no
confirm, and the CTA label is identical to the first-run label, so nothing
distinguishes "start" from "restart."

**Why it matters.** Silent data loss on the one interaction the batch architecture
exists to make cheap. The screen's own docblock celebrates "fifty deals before a
request"; this throws the deals away while keeping the request. It is also
*more* likely under the discovery framing, where tuning filters mid-session
against what you are being shown is the expected behaviour rather than an edge case.

**Fix.** Only reset `cursor` when `updatePrefs` reported `changed`. When nothing
changed, `setDealt(true)` alone and relabel the CTA "Back to my card" — the state
is already reachable, it just has no affordance.
**Suggested command**: /impeccable harden

## Persona Red Flags

**Casey (distracted, one-handed — the defining persona, per PRODUCT.md's "a phone,
in the hands of someone who has just stopped playing")**: the CTA is clipped at the
bottom edge and `showsVerticalScrollIndicator={false}` removes the only cue that
says so. 23 chips at 25dp on a 31dp pitch guarantee thumb mis-taps, each silently
re-running the query with no undo. Worst: tapping "Based on my games" collapses
~310dp in a single frame with no animation — the second tap, already in flight
toward where the toggle was, lands on something else.

**Sam (screen reader + contrast)**: `FilterChips`' container is a plain `<View>`
carrying an `accessibilityLabel` and **no role** — so on iOS it is not an
accessibility element and "Genres" / "Player perspective" are never announced. All
28 chips announce as bare unscoped checkboxes. `sort-bar.tsx:39` gets this right
with `accessibilityRole="radiogroup"`; this file's docblock argues carefully for
the child role and omits the container's. `NARROW IT DOWN  3` is one Text node —
VoiceOver collapses the double space and says "narrow it down 3", an unlabelled
integer glued to an imperative. None of the three band headings carry
`accessibilityRole="header"` (the page title does), so there is no heading
structure to navigate 763dp of form by. Zero `accessibilityHint` in either file.
`textMuted` on `surfaceSelected` measures 4.43:1 — 0.07 short of AA, and the fixed
grey ladder never goes through `ensureContrast`.

**Alex (impatient power user)**: no genre search, no presets, and
`surprise-prefs.ts` stores exactly one configuration per user — there is no way to
keep "short thing tonight" and "deep RPG" around. Under the discovery framing this
is the most costly omission on the list after the tap floor: a discovery tool is
used in distinct modes, and the app can only remember one.

**Mira, the controller-down logger** (derived from PRODUCT.md): in week one she has
fewer than 3 rated logs, so `canUseForYou` is false and `FORYOU_OPTION` is simply
absent. The one mode most likely to make this feel personal to her is invisible and
unexplained. Hiding it is right per principle 2; saying nothing about it is the
other half of that principle, unimplemented — "Rate 3 games and this learns your
taste" turns a hidden control into an onboarding hook without adding a control.

## Minor Observations

- **Band headings are set at the quietest step in the scale, against your own
  spec.** GAME, NARROW IT DOWN and SOUNDTRACK are `variant="label"
  color="textMuted"` — 10px `#8F8F8F`. DESIGN.md §17 is unambiguous: "A band label
  is `h2` — bold, in `text`", and reserves `label` for "a column or a group *inside*
  a band." §17 even records that the spec once said the opposite and that the code
  was right to reject it. The page runs `display` (24) → `label` (10) with nothing
  between — a 14-point cliff where the only three structural elements are the
  faintest type on screen. Promoting the three bands to `h2` is the cheapest fix
  for the hierarchy failure and removes nothing. Keep the three subgroup captions
  as they are; those genuinely are groups inside a band.
- Related drift, NOT acted on: §17's prose says `h2` is "19 / 24" while `Type.h2`
  is 17/21. One of them is a bug; that is a /impeccable doctor question.
- `genres.isError` is unhandled — line 173 branches only on `isPending`, and
  `FilterChips` returns `null` on an empty list, so an IGDB failure orphans the
  caption above blank space with no message and no retry. Material for a discovery
  tool whose primary instrument is that list.
- `Elevation.control` on 23 chips is `elevation: 3` × 23 on Android, real overdraw
  for a shadow nobody perceives at 25dp — and DESIGN.md §11 says cards carry no
  shadow at all. The hairline already separates them.
- `activeFilterCount` conflates opposite effects: three genres *widen* the pool, a
  rating floor *narrows* it, and both increment one number under a heading that
  says "NARROW IT DOWN".
- SOUNDTRACK is the only group on the page with no explanatory caption, and
  "Mixed" agrees with neither its key (`surprise`) nor its behaviour (a 50/50 coin
  flip between the other two). Per the owner constraint the group stays where it
  is at the weight it has; the missing caption is still a gap, since the other
  three groups all have one.
- "Surprise me" is both the page heading and the button label; a screen reader
  hears it twice with nothing distinguishing them.

## Questions to Consider

The first draft's four questions all challenged the screen's existence, name or
option count. All four are withdrawn under the owner constraints above and are
recorded here only so a later run does not regenerate them. Replacements, scoped
inside the constraints:

- The genre list is the primary instrument of a discovery tool and is currently
  ordered by spelling. What ordering would actually help someone find an obscure
  game — catalogue frequency, pool productivity, or something the app knows that
  IGDB does not?
- A discovery session has moods. The app remembers exactly one configuration. What
  would it take for "deep RPG" and "something short tonight" to both survive?
- The interesting configurations are the narrow ones, and narrow is where the pool
  silently hits zero. If the screen showed a live match count, would the filters
  stop being settings and start being an instrument?

---

## RUN CLOSE — accepted scope (owner, 2026-09-13)

All five priority issues accepted for work. No code was written in this run.

**Ordered plan, with the one dependency that matters:**

1. `/impeccable audit` — tap-target floor. `minHeight: TapTarget` on `styles.chip`
   and `sort-bar.tsx`'s `pill`; `CLEAR_SLOP` to 18/18/16/16. **Must precede item 4**:
   it grows the genre wall ~184dp → ~300dp, so the findability work has to be
   designed against the post-fix heights, not the current ones.
2. `/impeccable layout` — pin the CTA out of the `ScrollView` into a `<Screen>`
   footer. Pairs with item 1, which makes the page taller.
3. `/impeccable harden` — deck position. Reset `cursor` only when `updatePrefs`
   reports `changed`; relabel the CTA "Back to my card" when it did not.
4. `/impeccable harden` — live pool count off `getSurprisePool`'s existing `where`
   clause, debounced, cached on the filter tuple.
5. `/impeccable layout` — genre findability. All 23 genres stay. Ordering by
   frequency/pool-productivity, selected chips pinned first, scannable at the new
   row height.
6. `/impeccable polish` — final pass.

**Visual direction: LEAVE IT PLAIN.** Owner ruling. The screen is a working
instrument, not a showpiece. Do **not** bring it inside `AccentProvider`, and do
not give it the deck/case/artwork vocabulary the dealt card owns. The
"design specificity: generic" verdict above is acknowledged and **accepted as a
deliberate trade** — it is not a defect to fix. Scope is ergonomics, accessibility
and state handling only.

**Left unresolved:** the DESIGN.md §17 violation (band headings at `label`/
`textMuted` rather than `h2`/`text`). It was offered as the third option and not
chosen. It is a documented design-system break and a hierarchy/scanability fix
rather than a decorative one, so it is *arguably* inside "ergonomics and
accessibility" — but it was not explicitly accepted. Ask before changing it.
