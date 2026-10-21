---
target: the game page
total_score: 24
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-21T23-34-36Z
slug: src-app-game-id-tsx
---
Method: dual-agent (A: design review · B: detector). Source-based; no device, emulator or browser render available.

## Design Health Score

| # | Heuristic | Score | Key issue |
|---|---|---|---|
| 1 | Visibility of System Status | 3 | Whole stats strip waits on the slowest of four queries; Favourite/Wishlist flash off→on as list membership loads (game-actions.tsx:94) |
| 2 | Match System / Real World | 2 | IGDB's score labelled "Community" ([id].tsx:776) on an app whose community is its users; "N/A / No ratings found" |
| 3 | User Control and Freedom | 3 | Tabs scroll away with the masthead; deep in Overview, Similar is a long scroll back |
| 4 | Consistency and Standards | 2 | "N ratings" vs "Based on N reviews"; Platforms cuts the title to 2 lines (game-platforms.tsx:145) though a name is never cut; "LOWEST" in caps (store-prices.tsx:255) |
| 5 | Error Prevention | 3 | Unreleased games gated well; Favourite and Wishlist share one isPending |
| 6 | Recognition Rather Than Recall | 2 | Four icon-only tonal keys; the progress key is an unlabelled "+" beside Collect |
| 7 | Flexibility and Efficiency | 2 | No share anywhere on the page; tabs not sticky; no quick status path that looks quick |
| 8 | Aesthetic and Minimalist Design | 3 | Authored and restrained; title ×3, score ×2, price ×2 in a row |
| 9 | Error Recovery | 2 | "Pull to refresh" ([id].tsx:1219) with no refresh control on the page |
| 10 | Help and Documentation | 2 | Score method explained in the sheet only; nothing explains the keys or the case turn-over |
| **Total** | | **24/40** | **Acceptable** |

## Design Specificity Verdict

LLM: authored for GameLog above the tabs — the measured Letterboxd masthead, the cover in the hero's fade, M3 colour from the box art, the case that turns over to your record, the honest unreleased-game handling. Below the tabs it becomes a ~15-section stacked catalogue (heading + rail/card, [id].tsx:1069–1254) that any media app could ship.

Detector: 0 findings across the route and 33 components, exit 0 (also with --no-config). Its rules are web-pattern (Tailwind/CSS) and a probe showed it misses RN StyleSheet anti-patterns, so clean = "no web tells", not proof. Only hex literals in these files are in comments. No browser overlay: no device/adb, and Expo web does not bundle here.

## Priority Issues

1. [P1] The ten-second log is unlabelled; the sit-down task has the big button. "Write a review" opens the full form (which needs a progress choice to save); the two-tap path is a "+" key (game-actions.tsx:146). Fix: one visible label on the progress key only while there is no log, or a caption under the group. Touches the owner's no-labels ruling — ask. (clarify, layout)
2. [P1] On an unrated game the masthead contradicts itself: "86 Community" (IGDB) over the strip's "N/A / No ratings found". Fix: keep the only-when-unrated rule, rename to "IGDB"; empty cell "Not rated yet" / "Be the first" (it already opens the sheet). Word is in DESIGN.md § 14 — confirm. (clarify)
3. [P1] Copy that states false things: "Edit your review" for any log, even a status ([id] → game-actions.tsx:226); "Pull to refresh" with no refresh control; a comment says share lives in the top bar's disc, but the only disc is the trailer toggle — the page has no share at all. Fix: "Write your review" unless hasWriting; Retry button; decide where share goes. (clarify, harden)
4. [P2] Tabs unreachable once scrolled; Overview is ~15 sections with Reviews fifth and price shown twice in a row (Platforms, then Where to buy). Fix: pin the TabBar under the top bar when it reaches it; fold the Platforms price into Where to buy. Order of sections is ruled; stickiness is not. (layout, distill)
5. [P2] No header role on the game's name ([id].tsx:687); the bar's title is hidden until it arrives. Fix: accessibilityRole="header". (audit)

## Persona Red Flags

- Casey (one-handed): wants "Played"; the labelled target is the long form; quick path is a state-changing glyph; keys flash; Similar is a long scroll back up.
- Sam (screen reader): no heading for the title; Collect announces selected:false; "LOWEST"; tappable vs fact strip cells differ visually only by ink.
- Riley (edge cases): unrated game contradiction + panel of zeros; long title cut in Platforms; no hero art = grey block on a coloured page; status-only log says "Edit your review"; Soundtrack tab is "not connected yet" for everyone; achievements error points to a gesture that doesn't exist.
- Just-put-the-controller-down player: must guess "+" is progress, not collection; a mis-tap on "Write a review" lands in a form that won't save a bare status.

## Minor Observations

- [id].tsx:1329: comment argues for `center`, code passes `spread` (the spread is the owner's later ruling; the comment is stale).
- DESIGN.md § 14.1 still says Ratings is a three-part bar; it is the 11-row graph now.
- score-summary.tsx: "Based on N reviews" in textMuted on the game-tinted card — unverified contrast there.
- "On GameLog" vanishes on error but shows three zeros on no data.
- Trailer autoplays by default on a first cellular visit (Reduce Motion respected).
- source.toUpperCase() gives "RAWG"/"ITCH" link labels.

## Questions to Consider

- If a status is the commonest log, why does the only labelled action lead to the long form?
- With nobody rating yet, whose voice does the masthead's number speak in?
- Should a tab whose only production content is "not connected yet" be one of three?
- The arrival is the page's peak — what is its last moment?
