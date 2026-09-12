---
target: the profile page
total_score: 16
max_score: 40
na_heuristics: 
p0_count: 2
p1_count: 3
timestamp: 2026-08-23T23-30-03Z
slug: src-components-profile-view-tsx
---
# Critique: Profile (`src/components/profile-view.tsx`)

Method: dual-agent (A: design review · B: detector + measured evidence), run in isolation.

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | 14 queries fire on mount; header assembles in pieces, StarredSongWidget inserts ~100dp mid-read |
| 2 | Match System / Real World | 3 | Gaming vocabulary is native; "Wall" is 2009 Facebook; `ownerName.split(' ')[0]` renders "Become friends with The" |
| 3 | User Control and Freedom | 1 | Sign out, unfriend, unfollow, Steam disconnect — four state changes, zero confirmations, zero undo |
| 4 | Consistency and Standards | 2 | Counts use X's tappable-count idiom but are inert Views; three section-header treatments; About alone in a Card |
| 5 | Error Prevention | 1 | A button labelled "Friends" calls `removeFriendship` on tap. Same shape on "Following" |
| 6 | Recognition Rather Than Recall | 1 | No `title` on either route + `hideOnScroll` default + tabs inside ListHeaderComponent = nothing says whose profile this is |
| 7 | Flexibility and Efficiency | 2 | `tab` is useState not a route param — unlinkable, resets on remount; pull-to-refresh refreshes the wrong query |
| 8 | Aesthetic and Minimalist Design | 2 | Strong underlying system, undercut by a 442dp banner, platform/location twice, dead `styles.tabs` |
| 9 | Error Recovery | 1 | `friendAction.error` never rendered anywhere; ErrorState given no retry action |
| 10 | Help and Documentation | 1 | All four empty tabs pass title only — no message, no action — though EmptyState supports both |
| **Total** | | **16/40** | **Poor — major UX work needed** |

## Design Specificity Verdict

The components are authored; the page is not. The docblock concedes it: "Profile, laid out the way X/Twitter does it." Delete GamesWidget, FavoritesWidget and SteamSection and this ships unchanged as the profile for a running app or a book club. The game-specific work is excellent and is all placed below the fold. Letterboxd (PRODUCT.md's named reference) opens a profile on four favourite films at full width; this opens on a follower count.

Deterministic scan: 4 files, exit 0, zero findings — and near-vacuous. For non-HTML files the detector loads 9 of 46 rules, and 7 of those test CSS constructs impossible in React Native. A synthetic probe confirmed the engine runs on .tsx but caught 1 of 8 injected anti-patterns. Everything here is hand-measured.

Visual overlays: none. No emulator, device, or browser build.

## What's Working

1. GamesWidget's solved geometry. `MIN_OVERLAP = 0.18` is load-bearing; the horizontal-only shadow is right because the cards are level.
2. Contrast is solid. 31 text pairs measured, every one passes, lowest 4.80:1, up to 17.18:1. Avatar hsl fallback swept across 360 hues, worst 5.35:1.
3. The wall's separator logic — `leadingItem` suppresses the hairline above a date heading.

## Priority Issues

### [P0] Banner aspect ratio inverted — eats 52–63% of the first screen
`profile-view.tsx:643` — `aspectRatio: HeroAspectRatio / 2`. RN aspectRatio is width÷height, so 1.778/2 = 0.889 means height = width × 1.125, a portrait banner. 360dp on 320-wide (63.4%), 442dp on Pixel (51.9%), 900dp at MaxContentWidth (70.3%). The only place in the codebase that divides HeroAspectRatio; all four other uses pass it undivided. Committed at HEAD. No onError/fallback on the Image either.
Fix: `aspectRatio: HeroAspectRatio * 2` (→111dp); shorter block or nothing when banner_url is null.
Command: /impeccable layout

### [P0] Four destructive actions, zero confirmations; two buttons destroy what their label states
FriendButton case 'friends' (line 540) labels "Friends", calls removeFriendship. Follow/Following (342) same shape. Sign out ((tabs)/profile.tsx:51) is `onPress={signOut}` raw — auth.ts:68 throws, so failure is an unhandled rejection; it also wears `ghost`, which CLAUDE.md reserves for actions that must not draw the eye. connect-card.tsx:62 Disconnect fires immediately.
The app already ships this pattern at game-actions.tsx:150.
Fix: destructive Alert.alert on sign out/unfriend/disconnect; change the label at moment of intent; catch signOut.
Command: /impeccable harden

### [P1] 13 of 14 queries fail silently; three render confident false statements
`profile` is the only query with a full triad. friendState on error/loading renders "Add friend" to an existing friend AND "Become friends with {name}" simultaneously. stats failure makes the Follow button cease to exist (`{stats.data && ...}` line 341). logs failure renders "No reviews yet" and "No games yet." friendAction.isError is never rendered anywhere, while toggleFollow twelve lines away handles its own.
Fix: error branch per query; never let `?? default` turn a failure into a claim.
Command: /impeccable harden

### [P1] Once you scroll, nothing says whose profile this is
Neither route passes `title`; hideOnScroll defaults true; TabBar is the last child of ListHeaderComponent with no stickyHeaderIndices in the repo. Two screens in: no name, no tab label, no back chevron on /profile/[id]. CLAUDE.md names this exact shape as the case for not hiding.
Fix: hideOnScroll={false} + name as title; better, pin the TabBar.
Command: /impeccable layout

### [P1] The four counts imitate links, aren't tappable, have no destination
Count (617) is a bare View, no Pressable, no role. Route search confirms no followers/following/friends screen exists anywhere. Strands PRODUCT.md's social pillar.
Fix: a people/[id] route with a TabBar; make all four counts push to it.
Command: /impeccable shape

## Also worth fixing
- [P1] Three controls under TapTarget: FavoritesWidget "Edit" 13dp tall ~20dp wide, no style/minHeight/hitSlop (profile-widgets.tsx:65) — the only route to changing your top four. GamesWidget header 18dp (games-widget.tsx:302). All four relationship buttons size="small" = 36dp.
- [P1] Pull-to-refresh refreshes logs/stats/achievementStats/favorites — never wall, posts, lists. Default tab is wall. tintColor is iOS-only.
- [P2] Back chevron over a light banner measures 1.92:1; any region lighter than ~#CBCBCB is under the 3:1 non-text minimum.
- [P2] Six tabs, ~540dp estimated in a 390dp viewport, showsHorizontalScrollIndicator false — STEAM (differentiator #1) off the right edge with no cue.

## Persona Red Flags

**Casey (one-handed, interrupted):** first 442dp is a grey rectangle; every action top-right via alignItems flex-end; unconfirmed Sign out 10dp from Edit profile; pull-to-refresh doesn't move the wall; WallComposer body is local useState with no draft persistence.

**Sam (screen reader / low vision):** profile-view.tsx has zero accessibility props of its own. Counts emit eight unrelated nodes. `<Button title="Friends">` announces "Friends, button" and activating it runs removeFriendship — no hint, no confirm, no announcement. No accessibilityRole="header" anywhere (SectionHeader sets it elsewhere with a comment explaining why). avatar.tsx:34 is a hard height box containing size*0.42 text — clips at large font scales.

**Priya (day one, nothing logged):** 442dp grey slab, four zeros, four dashed slots, "No games yet." at 10px muted, EmptyState with no message and no action. Nothing on her own profile ever says "go log a game."

## Minor Observations
- `styles.tabs` (655) is dead.
- `styles.widgets` is a row container used three times with one child each; why three widgets carry defensive flex:1.
- Platform and location render twice (Meta row + About).
- Three section-header treatments; Type.label exists for this and is unused.
- favorite_platform and location have no maxLength in edit-profile.tsx, rendered in a space-between row with no numberOfLines and no flexShrink.
- Bio has no numberOfLines and no read-more (300 char max).
- Two adjacent variant="primary" buttons on incoming friend request, against button.tsx:51.
- contentContainerStyle lacks flexGrow:1, so EmptyState's flex:1 centring collapses.

## Questions to Consider
1. Why is the chassis of a microblog right for a shelf? What if favourites and the shelf were above the fold and banner/name/counts/follow collapsed into one 56dp row?
2. The default tab is Wall, so the answer to "who is this person" is a log of their clicks — but WRITTEN_KINDS already distinguishes criticism from taps. Why is the default the view that mixes them?
3. Six tabs, two off-screen, one is Steam. Is the honest tab set three?
