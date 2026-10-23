---
target: review screen
total_score: 25
max_score: 40
na_heuristics: 
p0_count: 0
p1_count: 3
timestamp: 2026-10-21T23-54-22Z
slug: src-app-review-id-tsx
---
Method: dual-agent (A: design review · B: detector + manual RN grep). Source-based; no device or browser render.

Score 25/40 (Acceptable). H1 3, H2 3, H3 2, H4 2, H5 2, H6 3, H7 2, H8 3, H9 3, H10 2.

Specificity: strongly authored (measured music-app review, typed quote, score subordinate as "87 AMAZING"), but the 1:1 copy imported a paragraph-length reading setting for long-form criticism.

Detector: 0 findings; manual RN grep: 0 true positives.

Priority issues:
- [P1] Body is 14/18 (review-page.ts:69) against DESIGN's prose 17/28 and reviewProse 14/22 — long reviews read cramped; fixed line boxes may clip at large font scale. typeset. Touches the "follow the screenshot" ruling.
- [P1] Spoiler flag covers the text but not the quote, which types out above the notice (review/[id].tsx:368) — cards cover whichever half they show. harden. Touches a recorded decision.
- [P1] Author has no Edit from their own page; share copy says "Your one sentence" to every reader; score-only review offers Share that dead-ends; you can like your own review; "scored this game without writing it up" shows even with no score. clarify/harden.
- [P2] Tap targets under Android's 48: like/share 44, send 34, B/I 32, report flag ~34×42. harden (hitSlop).
- [P2] Platform line in bold white outranks the review body and sits apart from the details sentence. quieter. Touches the screenshot ruling.

Personas: Sam — comment labels read **asterisks**, avatar+name are two links, swatches "Background 2…5", quote allowFontScaling false, name line fixed height 16; Riley — orphan "Replies" heading at 0, "Show 292 more comments" vs Replies, missing game = empty veiled hero; Casey — like/share after the whole article, 34dp send in the corner, comment delete no confirm; author — no edit, no edited marker.

Minor: CLAUDE.md says Inter and drawn blocky marks; code is Poppins with the font's marks. "0/500" counter shown when empty. Body not selectable. Android KeyboardAvoidingView behaviour undefined with edge-to-edge. "Wants to play it." can print on a review.
