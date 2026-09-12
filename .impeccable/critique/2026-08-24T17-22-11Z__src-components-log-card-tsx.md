---
target: the game review card display in the feed
total_score: 21
max_score: 32
na_heuristics: 9,10
p0_count: 1
p1_count: 3
timestamp: 2026-08-24T17-22-11Z
slug: src-components-log-card-tsx
---
Method: dual-agent (A: design review, isolated · B: detector + evidence, isolated).
Detector clean. Browser visualization skipped: native RN component, no DOM, no servable HTML entrypoint.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | Truncation signalled only by RN's automatic ellipsis; on Home there is no like state to show at all |
| 2 | Match System / Real World | 4 | STATUS_VERB written as sentence fragments — "is playing", "wants to play" |
| 3 | User Control and Freedom | 2 | One destination per card, and it's the wrong one; the game title opens the author's profile |
| 4 | Consistency and Standards | 1 | DESIGN.md § 8 specs this component and it implements none of it; engagement bar in 1 of 4 call sites; success and scoreHigh are the same hex 40dp apart |
| 5 | Error Prevention | 3 | Degrades safely on null game/rating; real risk is mis-targeting a 26dp row above a 150dp one |
| 6 | Recognition Rather Than Recall | 3 | Box art at real size is excellent; the bare 82 with no /100 and no band word is not |
| 7 | Flexibility and Efficiency | 2 | One tap, one destination. No long-press, no expand, no shortcut to log the same game |
| 8 | Aesthetic and Minimalist Design | 4 | Three bands, nothing decorative, status carried by the verb rather than added chrome |
| 9 | Error Recovery | n/a | Presentational row over query data; parents gate on isError, card accepts no input |
| 10 | Help and Documentation | n/a | A feed row is not a help surface, and there is no help system to link into |
| **Total** | | **21/32** | **Acceptable (66%)** |

n/a heuristics: 9, 10.

## Design Specificity Verdict

~70% authored for this product. Three things could not have come from anywhere else: the one-Text-three-spans author sentence (wraps as prose rather than truncating); the score pinned to the cover instead of leading a text row, freeing the column for the writing; and body omitting alignItems so flex stretch hands the poster the text column's height, with MIN_ART_HEIGHT 132 = exactly 88 / (2/3).

Where it goes generic: the information budget is a social-feed budget, not a criticism budget. Four lines at 13/19 in a ~244dp column is ~180 characters. PRODUCT.md pillar #2 is "serious long-form reviews, magazine-shaped pieces." The card advertises the pillar it is least able to demonstrate.

Deterministic scan: detect.mjs exit 0, zero findings on log-card.tsx, engagement-bar.tsx, home-section.tsx (verified combined and individually). tsc --noEmit and eslint both clean. Zero hardcoded colour literals in either file. The scan's value here was measurement, not rule-matching.

## Overall Impression

A well-made card with a hole in the middle. The craft is real and specific — the height-matching construction and the three-span sentence exist because someone noticed a problem and solved it properly. But the card is pleasant to look at and unrewarding to finish: every one ends on a denial, and on the primary surface offers no way to respond. Biggest opportunity: the tap model. The largest element on the card, in a box-art-led app, does not open the game.

## What's Working

1. The author sentence (log-card.tsx:116-133). ~120 characters over two lines at bodySmall 12px across ~270dp — absorbs the longest IGDB titles. Timestamp keeps the right edge via flex:1 on `sentence`.
2. Art and text share a height by construction (log-card.tsx:251-255 + Poster fillHeight). No alignItems, so stretch applies; MIN_ART_HEIGHT is the exact 2:3 derivation. A fixed box beside a variable column only aligns by accident.
3. Colour is never the only carrier — verified at every site. Verb tints a word that IS the status; ScoreNumber renders digits; both badges ship an icon AND a word.

## Priority Issues

### [P0] The primary social surface has no social affordances
index.tsx:297 and :353 render <LogCard log={log} /> with no engagement prop, so EngagementBar never mounts. Only discover-lists.tsx:53 passes it — 1 of 4 call sites. Home contains a section titled "From people you follow". This is a data-fetching gap wearing a props costume: getEngagement is a batched two-query call Home never fires.
Why: you can read a friend's review on the screen you open first and have no way to acknowledge it. PRODUCT.md's success metric is the return visit; the reciprocity loop is absent from the primary surface.
Fix: collect ids after reviews resolves, run the same useQuery(['engagement','log', ids, userId]) Discover uses, pass engagement at both call sites. Two queries for the whole page.
Command: /impeccable harden

### [P1] The score numeral fails WCAG on bright box art (measured, confirmed by both agents independently)
log-card.tsx:256-264 fills scoreTag with theme.scrim = rgba(0,0,0,0.6) — a flat 60% overlay, not an opaque fill. Over a pale capsule the backdrop composites to ~#666666.
  scoreHigh #4ADE80 -> 3.30:1 (fails AA)
  scoreMid  #F5A524 -> 2.81:1 (fails AA and 3:1)
  scoreLow  #F35555 -> 1.71:1 (fails everything)
The comment at :218-219 claims the scrim "keeps a coloured numeral legible over whatever the box art happens to be." It does not. This is the ONLY contrast failure on the card — all 13 tokens rendering on surface #1C1C1C pass AA with margin.
Why: the failing case is scoreLow (a bad review) over bright art, at 13px bold, on the most-repeated element in the app.
Fix: backgroundColor: withAlpha(theme.shadowInk, 0.82) — the exact value Poster's edition badge already uses (poster.tsx:241) for this reason.
Command: /impeccable audit

### [P1] The card's tap model contradicts its own content
- The poster opens an essay. The Link at :155-161 wraps both columns and routes to /review/[id] whenever a review exists — on Home, always. Tapping box art never opens the game.
- The game title opens the author's profile. :126 renders it in the brightest ink on the row, nested inside the Link to /profile/[id]. In the showAuthor={false} branch the identical-looking title is inert.
- ~180 characters with no read-more. REVIEW_LINES = 4 truncates with only RN's automatic ellipsis; when a review is exactly <=4 lines the two states are indistinguishable.
Why: a reader who doesn't know the card is tappable concludes the app hosts one-paragraph opinions.
Fix: make styles.art its own <Link href="/game/[id]">, let the body link keep only the text column, free the title to be its own link. Add a "Read review" line in primaryText beneath the prose, gated on onTextLayout (lines.length > REVIEW_LINES) so it stays out of an effect.
Command: /impeccable shape

### [P1] Undersized targets, and the card is nearly silent to a screen reader
Targets: TapTarget (44 iOS / 48 Android) is imported nowhere in this file. authorRow has no vertical padding and no hitSlop -> 26dp. EngagementBar's action is 21px icon + 4dp padding -> 29dp, three of them. Zero hitSlop and zero accessibilityState across both files; the like toggle never announces state. Fitts geometry inverted: 26dp target 10dp above a ~150dp target.
Screen reader: :164 sets accessibilityLabel={headline ?? title} on a Pressable that defaults accessible:true, collapsing the subtree. Silent: the entire review prose, the score, "Platinum", "100%". ScoreNumber's label ("Scored 82 out of 100 — Very Good", score.tsx:36) is built and discarded. When review_title is null the label degrades to title, producing a duplicate focus stop. Both pressables declare role="button" while navigating; "link" is honest.
Fix: paddingVertical: Spacing.x12 on authorRow (46dp) + hitSlop for Android; same for engagement-bar.tsx:138; import TapTarget. Drop the blanket label or compose a full one. Add accessibilityState={{selected: liked}}.
Command: /impeccable audit

### [P2] DESIGN.md is orphaned — two documents claim normativity and describe opposite systems
DESIGN.md says "Tokens are normative... Where the two disagree, one of them is a bug." Quantified: APP_SCHEME is 'dark' vs declared scheme: light-only; of 18 shared colour keys, 17 have different values; 29 DESIGN.md keys have no code counterpart; 37 code keys have no spec counterpart; LibreFranklin vs Inter, no overlap. On this component, § 8 specs square avatar (code: round), bold blue name (grey), 3:4 bordered thumb (2:3, no border), boxed /100 badge (bare numeral on scrim), "no outer shadow, nowhere" (three shadows).
Why: CLAUDE.md's opening paragraph sends every contributor and agent to DESIGN.md claiming its frontmatter mirrors theme.ts. It does not. A landmine with a 100% trigger rate. PRODUCT.md's Brand Commitments already settle it in favour of dark.
Fix: archive the light spec to DESIGN_SOCIAL_PLAYBACK.md (or promote OLD_DESIGN.md into DESIGN.md) and update CLAUDE.md's pointer.
Command: /impeccable document

## Persona Red Flags

Casey (one-handed, thumb zone): 26dp author row, 18-22dp short of TapTarget, the exact bug theme.ts:722 warns about. Like button undersized (29dp) and on Home absent, so a double-tap reflex does nothing. The score tag looks pressable (rounded corner, coloured numeral, dark fill) and has no onPress.

Sam (screen reader, contrast): whole card body announces one string, hiding prose/score/badges. scoreLow at 1.71:1 over a white cover. Colour-alone passes at every site (genuinely right). Structural risk: at 200% OS text the column grows to ~245dp and fillHeight crops the poster to aspect ~0.36 — the app's primary content degrades as a function of the accessibility setting. MIN_ART_HEIGHT protects the floor; nothing protects the ceiling.

Riley (stress tester): empty states, missing covers, null ratings all degrade cleanly (lettered placeholder measures 4.80:1). Three breakages:
- Rating with no review and no title: on the game page only (getGameReviews uses .or(review.not.is.null,rating.not.is.null)) — a ~156dp card, two-thirds empty, showing a redundant copy of the cover you're already looking at.
- review_title set, review null: headline renders, prose doesn't, and :157's ternary keys off review — the card shows a review headline while routing to /game/[id].
- RTL: scoreTag uses physical left:0 / borderTopLeftRadius / borderBottomRightRadius. RN auto-flips flexDirection:'row', so the poster moves left but the tag stays pinned physically left with a mismatched radius. Fix: start, borderTopStartRadius, borderBottomEndRadius. Same class of bug at poster.tsx:305-306.

## Minor Observations

- shareMessage (:234) pushes the entire untruncated review body into the share sheet. With no review it shares "Dispatch — wants to play", a fragment with no subject.
- Proximity inverted: stack gap Spacing.x12 = 10; authorRow and left internal gaps x8 = 6. The gap between bands is only 4dp larger than the gap inside them — index.tsx:398-405 argues separation must be "unmistakably bigger than any interval inside one."
- success and scoreHigh are byte-identical (#4ADE80); on a log with rating 90 and completion 100 the same green appears twice, 40dp apart, meaning different things. platinum (#A9B6CC) is an invented hex outside the ten-hue ramp and sits ~2 luminance units from textSecondary, so the glyph carries the entire signal.
- ScoreLine already renders "82 VERY GOOD" in the file the card imports from; the card uses the variant that omits the word, on the one surface with no context to supply it.
- MIN_ART_HEIGHT = 132 is exactly BOX_ART_WIDTH / PosterAspectRatio but written as a literal.
- paddingVertical: 1 and Spacing.x4 + 2 are off the spacing ladder; size={13} and 21/25 in engagement-bar.tsx are bare literals.
- memo is correct and well-reasoned. No complaint.
- No testID anywhere, which will matter for the store release.
- verb and verbTint are computed unconditionally but consumed only in the showAuthor branch.

Likely false positive: a web-oriented linter would flag style={{ color: verbTint }} as an inline style. Not a defect — the value is computed per render from useTheme(), and RN has no class mechanism.

## Questions to Consider

1. If the poster is the biggest element and the app's stated primary content, why is it not the link to the game? Does that not also fix the game-title-opens-a-profile bug for free?
2. What is four lines actually for? For "decide whether to open it," 180 characters of a magazine piece is too few; for "read it," four lines is far too few.
3. Is showAuthor a prop or a fork? With false you lose five of the band's six elements.
4. Home is titled "From people you follow" and offers no way to respond to them. Is a feed you cannot answer quieter, or just deader?
