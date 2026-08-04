---
target: src/app/game/[id].tsx
total_score: 23
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 2
timestamp: 2026-08-04T02-02-41Z
slug: src-app-game-id-tsx
---
⚠️ DEGRADED: single-context (sub-agent tool use declined by user)

Assessment A was formed and recorded in full before the detector ran.

Target: src/app/game/[id].tsx · Mode: Operate · Platform: native (iOS + Android, one design language)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Five status toggles mutate with zero pending/success feedback; `isPending` never referenced in game-actions.tsx |
| 2 | Match System / Real World | 3 | Good vocabulary; "COMMUNITY" unexplained |
| 3 | User Control and Freedom | 2 | No undo, and no way to clear a status |
| 4 | Consistency and Standards | 3 | Strong control language, drifts from its own DESIGN.md in four places |
| 5 | Error Prevention | 2 | Status writes instant, silent, irreversible |
| 6 | Recognition Rather Than Recall | 3 | Every icon carries a text label |
| 7 | Flexibility and Efficiency | 2 | One rigid path; no long-press or swipe |
| 8 | Aesthetic and Minimalist Design | 3 | Strategy works; masthead ~2.5 screens before content |
| 9 | Error Recovery | 2 | Raw provider strings; no retry on tab queries |
| 10 | Help and Documentation | 1 | Nothing explains the toggles or the two scores |
| **Total** | | **23/40** | **Acceptable** |

## Design Specificity Verdict

The masthead is genuinely authored: hero art fading into a rendered physical game case over a centred title delivers the "physical shelf feel" PRODUCT.md names as untouchable. Below the masthead it flattens into a category-standard media-detail page. The case does all the specificity work and stops at the fold. Reviews, the second-ranked differentiator, are three taps and two screens away.

Deterministic scan: detect.mjs clean (exit 0, []) on the target; one advisory across src/components — undocumented colour #3c87f7 at themed-text.tsx:66 (old blue accent in a dead Expo scaffold). Caveat: the detector is built for web markup; on React Native it can check colour literals and little else. A clean result is not a clean bill of health.

Visual overlays: unavailable (no browser tool exposed; native target).

### Contrast (computed, WCAG 2.1)

| Pair | Dark | Light |
|---|---|---|
| textMuted on background | 3.88 FAIL | 3.36 FAIL |
| textMuted on surface | 3.61 FAIL | 3.22 FAIL |
| textMuted on control | 3.34 FAIL | — |
| danger on control | 4.53 PASS | 4.39 FAIL |
| success on control | 9.78 PASS | 3.00 FAIL |
| accent on control | 8.35 PASS | 2.20 FAIL |
| border vs background (3:1 UI) | 1.31 FAIL | 1.27 FAIL |

text and textSecondary pass everywhere (16.3–19.0, 6.8–7.3). Light mode is materially worse than dark.

## Overall Impression

The visual system is good and this screen shows it off. The blocker is not taste: the screen's most-used controls give no feedback at all. Second: this screen violates a DESIGN.md written four hours ago, in four places.

## What's Working

1. The masthead composition — hero, fade, case, title, score read as one object. `identity` pulling up -Spacing.five over the fade tail is what makes it cohere.
2. Query discipline — only the active tab fetches; IGDB-only extras gated on source so three guaranteed-empty requests never fire.
3. One primary action — exactly one near-white button, and it is the one the product exists for.

## Priority Issues

[P1] The five status toggles are silent. toggleList.isPending / setStatus.isPending referenced nowhere. Fix: disable the tapped tile and swap its glyph for an ActivityIndicator while pending; move the error inline. → /impeccable harden

[P1] A status cannot be cleared. Tapping "Played" when already played re-writes it. No un-log. Fix: active status toggle clears it, matching Favourite/Wishlist. → /impeccable harden

[P2] Four DESIGN.md violations: `transparent` gradient stops at game/[id].tsx:181, review/[id].tsx:98, discover.tsx:61, game-disc.tsx:123 (DESIGN.md forbids the keyword; Android interpolates through black); action tiles tint with accent/primary/success against the Borrowed Colour Rule; inline Card backgroundColor override at line 216; #3c87f7 in themed-text.tsx:66. → /impeccable polish

[P2] textMuted fails AA everywhere (3.34–3.88 dark, 3.22–3.36 light) and carries real information. Light mode also fails accent (2.20), success (3.00), danger (4.39). Fix: lift dark textMuted to ~#8A8A8A; darken the light signal colours. → /impeccable audit

[P2] Reviews buried under ~2.5 screens of masthead. On a 667pt iPhone SE nothing but chrome is visible until the third scroll. → /impeccable layout

## Persona Red Flags

Casey (distracted mobile): every control is top-two-thirds and reached by scrolling; "Write a review" sits below a 16:9 hero and a 232pt case, never in the thumb zone on first paint. The 64pt toggles are the one win.

Sam (screen reader, low vision): toggles carry accessibilityRole/Label/State — genuinely good. But textMuted fails AA on every surface, the hairline border sits at 1.22–1.45:1 while DESIGN.md makes it load-bearing, and ErrorState announces raw strings like "IGDB request failed: …".

Jordan (first-timer): five icon tiles with no explanation of what logging does, no distinction between Wishlist (a list) and Played (a status writing a log row), no help anywhere. ScoreBadge shows a number and "COMMUNITY" with no indication whose score it is.

## Minor Observations

- caption at game/[id].tsx:201 has no numberOfLines; a long studio name wraps unbounded while the title above is capped at 3.
- Tab-level errors render ErrorState with no retry; only the top-level query gets Retry.
- Touch targets on this screen are fine (tiles 64pt, tabs 46pt, button 46pt), but shared primitives are short elsewhere: SortBar pills 30pt, IconButton small 32pt, tier chips in list/[id].tsx 24pt. All below the 44pt iOS floor; 46pt controls also miss Material's 48dp.
- Type uses fixed numbers with no allowFontScaling handling; lineHeight will not follow OS font scaling proportionally.

## Questions to Consider

1. What if logging did not need the modal at all? The toggles already write to the database.
2. Should the case shrink and pin as you scroll, so reviews are one gesture away?
3. Is a monochrome system allowed five tinted toggles? The file and the doctrine currently disagree.
