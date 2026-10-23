---
target: collection screen
total_score: 19
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 3
timestamp: 2026-10-21T23-54-22Z
slug: src-app-list-id-tsx
---
Method: dual-agent (A: design review · B: detector + manual RN grep). Source-based; no device or browser render.

Score 19/40 (Poor). H1 2, H2 2, H3 1, H4 2, H5 1, H6 2, H7 3, H8 3, H9 1, H10 2.

Specificity: the reader's first screen is GameLog's own (half-display art into a page colour from the box art; the award show's crowned category; the captioned board). The header is a playlist header with nouns swapped, and the tier list has no tiers.

Detector: 0 findings (with and without config). Manual: owner-menu sheet's inner Pressable (collection-header.tsx:453) groups its rows into one unnamed a11y node — probable TP; captioned board is a one-item PageFlatList with inline renderItem (list/[id].tsx:570) — low.

Priority issues:
- [P0] Delete collection: one tap, no confirm, no onError (list/[id].tsx:427, collection-header.tsx:475); favourites/wishlist deletable. harden.
- [P1] Ranked collections and boards cannot be reordered — `move` only renders under `isTierList && !isTierList` (dead); boards cannot remove games. shape.
- [P1] Tier list is not grouped by tier: rows in position order with a badge. layout.
- [P1] "Choose the cover" on boards and award shows: those views ignore pickingCover; tap opens the game, mode stays on. harden.
- [P2] Award show: plain FlatList (award-show.tsx:91) so the top bar never moves; header vanishes while loading; no comments; inert layout toggle. polish.

Personas: Sam — tier chips no selected state, grid tile omits rank, owner menu rows hidden; Riley — "1 games" share text, award count counts winners, visitor sees owner copy on empty board, no windowing on 300-game board; Casey — owner menu top-right, 24dp tier chips; owner — no reorder, no visible Add games, cover picked from box art shows square art.

Minor: inconsistent quotes in empty states; uppercase micro-labels (award category, comments heading, SORT); empty award slot asks why before a winner; unused styles; single remove has no error; owner sheet ignores bottom safe area; "List not found".
