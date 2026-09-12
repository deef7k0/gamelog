---
target: the home screen
total_score: 26
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 2
timestamp: 2026-08-24T23-40-30Z
slug: src-app-tabs-index-tsx
---
Method: dual-agent (A: design review · B: detector + evidence, isolated).
Browser visualization skipped: native RN screen, no servable HTML, no browser tool exposed.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 3 of 7 bands render a skeleton; news skeleton is 96dp against a real card of ~350dp |
| 2 | Match System / Real World | 3 | "Based on the games you rated highest" is false — recommend.ts:80 admits unrated logs as seeds |
| 3 | User Control and Freedom | 3 | No maintainVisibleContentPosition; a late band yanks the page from under a scrolling thumb |
| 4 | Consistency and Standards | 3 | HomeSection enforces one band grammar; two poster rails at two widths 48dp apart |
| 5 | Error Prevention | 3 | Low destructive surface; the risk is navigational |
| 6 | Recognition Rather Than Recall | 4 | Strongest axis. Box-art-led, every band self-labels, status ships word beside hue |
| 7 | Flexibility and Efficiency | 1 | Following 200 people shows 3 reviews, no path to the fourth. No reorder, no scroll-to-top |
| 8 | Aesthetic and Minimalist Design | 2 | ~5,100dp scroll, ~110 tap targets, >half is one component split across two sections |
| 9 | Error Recovery | 2 | ErrorState fires only when all three of news+releases+upcoming fail |
| 10 | Help and Documentation | 3 | subtitle slot does real work; only 3 of 7 bands use it |
| **Total** | | **26/40** | **Acceptable** |

## Design Specificity Verdict

The components are authored for this product; the page is not. LogCard, GameCardRail's 132-vs-92 decision, and Spacing.x64 are all specific. The page is seven co-equal bands, none of them the answer.

Tells: nothing leads (largest type on 5,100dp is the user's own name at h1/23px; first artwork ~290dp down); the greeting is said twice (bar subtitle + "Welcome back,"); "Latest releases" and "Coming soon" are the same 92dp rail twice, back to back; "From people you follow" and "Latest reviews" are one job split across 2,900dp (newest is literally the residue after followed is subtracted).

Proportion is the finding underneath: 51% of the page is review cards, 14% is box art, in a product positioned on "box art everywhere".

DETECTOR COVERAGE GAP (important): detect.mjs returned [] exit 0 on the target and all five dependencies. Assessment B sanity-checked it against files with unambiguous hardcoded hex (game-case-back.tsx:60, scroll-ambience.tsx:95) and got [] there too. Its regex matchers target CSS/Tailwind syntax (border-left:\s*\d+px solid, text-purple-500, bg-clip-text) and structurally cannot match StyleSheet.create. The clean result is a coverage gap, not a verdict. Every finding here came from reading code and arithmetic.

NORMATIVE VIOLATION: DESIGN.md § 17 says do not promote a band label to h1/h2 or 18-20px. All seven headings are h2 = 19px. The document pass earlier this session reconciled frontmatter tokens against theme.ts but did not audit the prose, so this was live and uncaught. Likely the code is right and § 17 is stale, but it must be resolved in one direction.

## What's Working

1. Independent band failure, built in rather than retrofitted. Seven queries, seven isLoadings, no shared gate. getGamingNews throws only when every RSS feed fails; recommendFromLogs returns empty rather than throwing.
2. Spacing.x64 and the band rhythm. 48dp between bands against 10dp inside one — 4.8x, verified. One uncompressed step invented for one job, with the reasoning documented.
3. getHomeReviews's two-query shape. Both fetched, returned SEPARATELY so the caller can label them rather than blending them into a list pretending one rule produced it.

## Priority Issues

### [P0] Home never asks anyone to log a game
New account: "Games for you" is enabled on logs.length > 0 so never runs, but showRecommended includes logs.isLoading — so the heading and five skeletons render, then the section deletes itself. Three other bands gate on .length > 0 and never render. THREE OF SEVEN BANDS APPEAR, all generic industry content. EmptyState is not imported into this file. The create tab was removed, so the path to the core action is Search -> type -> open game -> find action row, and Home never says so.
Why: PRODUCT.md's success metric is the second review. Nothing here moves anyone toward the first.
Fix: when logs.data?.length === 0, replace the "Games for you" slot with a first-run block -> /search. EmptyState already has an action slot (screen.tsx:145).
Command: /impeccable onboard

### [P0] Late-arriving bands insert above the viewport and steal scroll position
Animated.ScrollView, no maintainVisibleContentPosition. Four bands materialise on query resolve — "From people you follow" inserts at position 2 with ~1,310dp; "Latest reviews" ~1,290dp. Each news Skeleton height={96} is replaced by an ArticleCard of ~350dp (~760dp growth in place). B's matrix confirms four sections gate on data length with no isLoading escape hatch.
Why: the common interaction is open, thumb down, keep reading — by someone who just put a controller down and cannot recover a lost position.
Fix: maintainVisibleContentPosition={{ minIndexForVisible: 1 }}, plus skeletons at real heights so layout is stable from frame one.
Command: /impeccable harden

### [P1] Three measured accessibility failures
- Notification bell: 36x36 (icon 24 + Spacing.x8 = 6, x2) vs 44/48. Sole entry to /notifications, top-right, hardest one-handed reach.
- "See all" x7: 36 tall (bodySmall 16 + Spacing.x12 = 10, x2) vs 44/48. The comment above it claims "padded to clear 44" reasoning from an 18px label that is actually 16px — wrong in premise and conclusion.
- Footer search link: ~22-38dp, no accessibilityLabel.
Zero hitSlop anywhere in the file.
Separately: SoftGlow is in <Screen backdrop> which does not scroll, while FrostedTopBar hides after 56dp. Composited worst case #493666: textSecondary 4.41:1, textMuted 3.24:1, primaryText 3.22:1 — all below AA. GamePosterRail's year caption is textMuted at 10px and lands in it.
Fix: bell to width/height TapTarget matching frosted-top-bar.tsx:355; bump seeAll padding and fix the comment; make the glow scroll with the page or fade on scrollY.
Command: /impeccable audit then /impeccable harden

### [P1] Five "See all" links, one destination, none of it what was promised
Four sections plus the footer all point at /search. search.tsx is useState<SearchTab>('discover') with no param reading, so all five land on Discover (highly-rated games of the last 730 days). VoiceOver announces "See all from people you follow" and lands on a game-search grid. Also makes REVIEW_PREVIEW = 3 indefensible — the comment justifies three because "the pages it links to are the lists", and no such page is reachable.
Fix: seed search.tsx's tab from a route param; /search?tab=reviews, /search?tab=collections. Drop seeAll on "Games for you" — there is no destination. /releases and /upcoming are already correct and are the model.
Command: /impeccable clarify

### [P2] Proportion, duplication, and ~70 images at first paint
Two sections render the same LogCard from the same query 2,900dp apart (51% of the page). Two poster rails render near-identical 92dp rows 48dp apart. The three game rails total 14%.
~70 image-bearing components mounted before any scroll, against a viewport showing 8-12. Worst offender: "Fresh collections" is a plain <ScrollView horizontal>, not a FlatList — 6 tiles x 4 mosaic covers = 24 images fetched unconditionally, ~21 off-screen, no windowing available.
Fix: make the collections rail a FlatList (five lines, biggest cold-start win). Merge the two release rails; put the two review bands adjacent as one editorial block.
Command: /impeccable optimize then /impeccable distill

## Persona Red Flags

Jordan (first-timer): P0 above. Three of seven bands, no onboarding, no invitation to log. "Games for you" renders its heading and five skeletons, then vanishes.

Casey (one-handed, interrupted, slow connection): P0 scroll-jacking hits hardest. Only two controls in the top 110dp — the 36dp bell (hardest reach) and the greeting. Four horizontal scrollers stacked vertically, three running parallax, so artwork drifts under the finger during gesture disambiguation. Pull-to-refresh watches only 4 of 7 queries.

Riley (stress tester): a single band erroring is silent — heading, "See all" chevron, nothing beneath. Following the 3 most recent reviewers empties `newest` via the dedupe, so "Latest reviews" vanishes entirely — punished for following well. getHomeReviews never excludes viewerId, so your own review is shown back to you as a discovery. The all-bands-failed ErrorState uses flex: 1 inside a content-driven container and almost certainly collapses to its padding.
Long titles, missing avatars and 200% text are handled well and deliberately — no findings.

## Minor Observations

- refreshAll() double-fetches the recommendation rail (refetches logs and recommended together, but recommended's key contains logs.data?.length).
- recommended's key uses logs.data?.length as a proxy for content — editing a rating without changing the count leaves it stale for 30 minutes.
- The engagement query added this session is correctly keyed (TanStack hashes structurally). But it cannot start until reviews resolves, and it is not in refreshAll(), so pull-to-refresh leaves like counts stale.
- RailSkeleton under-measures by ~43dp (138 vs ~181). GameCardRail's own skeleton gets it right.
- home-section.tsx:31 says "24px between sections"; the page sets 48. DESIGN.md § 3.1 also still says 24 while its frontmatter says 48.
- The footer link has no visual affordance and no accessibilityLabel.
- Tab re-press does not scroll to top on a 5,100dp page with a hiding bar.
- DESIGN.md § 0 and § 25 ban "glow" and "glassmorphism" while the frontmatter defines glowCore/glowEdge and the top bar is glass. Frontmatter wins per DESIGN.md's own precedence rule; the prose bans are stale.

## Questions to Consider

1. If a reader may only see one band before they look away, which is it? Pick one and make it twice the size of the rest.
2. Why does a criticism-first product open on a clock? What if the top of Home were the single best thing someone wrote today?
3. You removed the month's chart for being "the least personal thing on the page". By that standard, why do News, Latest releases and Coming soon survive?
4. Would this page be better with four sections? ~3,200dp, nothing repeated.
