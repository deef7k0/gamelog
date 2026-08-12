---
name: Social Playback
description: A 2010-era social network for game reviews. Light, boxy, tactile, feed-first.
scheme: light-only
target: react-native
colors:
  # Page and containers
  background: '#f9f9f9'
  surface: '#ffffff'
  surfaceElevated: '#f3f3f3'
  surfaceSelected: '#e2e2e2'
  surfaceDim: '#dadada'
  input: '#ffffff'
  commentBackground: '#eeeff4'
  skeleton: '#e8e8e8'
  # Type
  text: '#1a1c1c'
  textSecondary: '#444650'
  textMuted: '#747781'
  onPrimary: '#ffffff'
  # Brand
  primary: '#3b5998'
  primaryDark: '#21417f'
  primaryMuted: '#d9e2ff'
  secondary: '#475e8c'
  # Structure — solid, and meant to be seen
  border: '#cccccc'
  borderStrong: '#c4c6d2'
  outline: '#747781'
  # Tactile depth
  headerGradientTop: '#3b5998'
  headerGradientBottom: '#21417f'
  buttonGradientTop: '#4c70ba'
  buttonGradientBottom: '#31518f'
  buttonBorder: '#29487d'
  secondaryGradientTop: '#ffffff'
  secondaryGradientBottom: '#e8e8e8'
  glossWhite: 'rgba(255,255,255,0.28)'
  bevelLight: 'rgba(255,255,255,0.85)'
  bevelDark: 'rgba(0,0,0,0.10)'
  # Meaning
  danger: '#ba1a1a'
  dangerContainer: '#ffdad6'
  onDangerContainer: '#93000a'
  success: '#3c763d'
  # Score bands — data, not chrome. See § 4.
  scoreGreatBg: '#dff0d8'
  scoreGreatFg: '#2d6a2f'
  scoreGreatBorder: '#b2d8a8'
  scoreGoodBg: '#d9e2ff'
  scoreGoodFg: '#21417f'
  scoreGoodBorder: '#afc6ff'
  scoreMixedBg: '#fcf3d4'
  scoreMixedFg: '#7a5c1e'
  scoreMixedBorder: '#e8d9a0'
  scorePoorBg: '#ffdad6'
  scorePoorFg: '#93000a'
  scorePoorBorder: '#f0b5b0'
  # Object ink — the game case shadow only
  shadowInk: '#000000'
  scrim: 'rgba(0,0,0,0.55)'
typography:
  display: { fontFamily: LibreFranklin_700Bold, fontSize: 22, lineHeight: 26, fontWeight: '700' }
  headerTitle: { fontFamily: LibreFranklin_700Bold, fontSize: 19, lineHeight: 24, fontWeight: '700' }
  headerTitleMobile: { fontFamily: LibreFranklin_700Bold, fontSize: 17, lineHeight: 22, fontWeight: '700' }
  gameTitle: { fontFamily: LibreFranklin_700Bold, fontSize: 16, lineHeight: 20, fontWeight: '700' }
  bodyStrong: { fontFamily: LibreFranklin_700Bold, fontSize: 14, lineHeight: 18, fontWeight: '700' }
  bodyMd: { fontFamily: LibreFranklin_400Regular, fontSize: 14, lineHeight: 18, fontWeight: '400' }
  prose: { fontFamily: LibreFranklin_400Regular, fontSize: 15, lineHeight: 22, fontWeight: '400' }
  labelSm: { fontFamily: LibreFranklin_400Regular, fontSize: 12, lineHeight: 16, fontWeight: '400' }
  capsLabel: { fontFamily: LibreFranklin_700Bold, fontSize: 11, lineHeight: 14, fontWeight: '700', letterSpacing: 0.6, textTransform: uppercase }
  scoreDisplay: { fontFamily: LibreFranklin_700Bold, fontSize: 24, lineHeight: 24, fontWeight: '700' }
  buttonText: { fontFamily: LibreFranklin_700Bold, fontSize: 13, lineHeight: 16, fontWeight: '700' }
  caseTitle: { fontFamily: LibreFranklin_700Bold, fontSize: 24, lineHeight: 30, fontWeight: '700' }
  caseEdition: { fontFamily: LibreFranklin_500Medium, fontSize: 12, lineHeight: 16, fontWeight: '500' }
rounded:
  sm: 2
  DEFAULT: 4
  md: 6
  lg: 8
  xl: 12
  pill: 9999
  card: 4
  control: 4
  input: 4
  image: 2
  caseImage: 12
spacing:
  marginPage: 12
  gutterCard: 8
  paddingInner: 10
  stackGap: 4
  sectionGap: 16
layout:
  maxContentWidth: 800
  tapTarget: 44
  posterAspectRatio: '2:3'
  thumbAspectRatio: '3:4'
  appBarHeight: 48
  tabBarHeight: 56
---

# Design System: Social Playback

> **Implementation target:** React Native 0.86 / Expo SDK 57 / expo-router.
> No DOM, no Tailwind, no CSS. Values are **dp**, applied through
> `StyleSheet.create` and read through `useTheme()`.
>
> **Tokens are normative; prose is context.** The frontmatter mirrors
> `src/constants/theme.ts`. Where the two disagree, one of them is a bug.
>
> **Light only.** `APP_SCHEME` is `'light'` and `Colors` has a single palette.
> There is no dark mode and no OS-scheme branching.

---

## 0. Brand & Style

A nostalgic, utility-focused 2010 social network. Communal, straightforward,
**social-first** — user activity over cinematic polish. **Tactile /
skeuomorphic**: subtle vertical gradients, glossy overlays, inset inputs, 1px
borders everywhere.

High information density inside a familiar, rigid structure. It should feel like
early mobile web: reliable, boxy, and legible before it is beautiful.

This replaces a dark, cinema-led catalogue. The previous system's whole logic —
surface steps instead of borders, shadows for depth, poster-led horizontal rails,
a transparent floating header — is **inverted here**. `OLD_DESIGN.md` is retained
for its engineering notes only; nothing in it describes the current look.

---

## 1. Layout doctrine

This is the structural core. **Nothing renders directly onto the page
background** — all content lives in cards.

| Primitive | Anatomy |
|---|---|
| **Page** | `background` grey. Cards stacked vertically, `gutterCard` (8) between, `marginPage` (12) at the edges. |
| **Card** | `surface` white, 1px `border`, 4px radius, `paddingInner` (10). The universal container. **No shadow.** |
| **In-card section heading** | Bold `primary` title row, then a 1px rule spanning the full card width, then content. |
| **Label/value row** | Label left in `textSecondary`, value right-aligned in `bodyStrong`. Hairline separators between rows. |
| **Button stack** | Primary and secondary at full card width, stacked vertically, `stackGap` apart. Never side by side. |
| **Card action bar** | `Like · Comment` at the card foot: `surfaceElevated` fill, 1px top border, icon+label pairs spread evenly. |
| **Likes strip** | Thin `commentBackground` band: thumb glyph + "X and 12 others like this." |
| **Comment strip** | `commentBackground` region at the card foot: square avatar + rounded bubble, blue name inline before the text, then a timestamp/Like line. |
| **Comment composer** | Small square avatar + inset input + `primary` "Post" button, inline. |
| **Grey section bar** | Full-bleed `surfaceElevated` strip, bold `primary` label, 1px top and bottom border. Separates page regions. |
| **Folder tabs** | Active tab `surface` white with **no bottom border**, merging into the content below. Inactive tabs `surfaceElevated` with a full border. |
| **Caps field label** | `capsLabel` above a control — `YOUR SCORE`, `REVIEW`. |
| **Score badge** | Boxed: band fill + 1px band border + `scoreDisplay` numeral + smaller `/100`. |

### Retired patterns

Structural, not cosmetic. Each is a rebuild, not a restyle.

| Was | Is now |
|---|---|
| Horizontal poster rails | Vertical stacked cards |
| 3–4 across poster grids | Bordered list rows: thumb left, title + metadata + score right |
| Full-bleed hero under a transparent header | Hero **boxed in a card** below the opaque bar, score badge overlapping its bottom-right |
| In-content mastheads | The single opaque blue app bar |
| Floating icon dock | Folder tabs |
| Bare coloured score numeral | Boxed score badge |
| Circular avatars | **Square** avatars with a 1px border |
| Metadata chips | Label/value rows |

**The one permitted horizontal scroll** in the whole app is the profile's
"Recent Favorites" row. Every other `horizontal` list is a bug.

Three things are `horizontal` and are *not* content rails, so they do not count:
`<TabBar>` (a scrolling tab strip), `<MediaCarousel>` (a paging image viewer),
and the image tray in the post composer. Rows of small fixed-size items — the
Steam showcases, the achievement strips — use `<WrapList>`, which wraps instead
of scrolling.

---

## 2. Colour

**Social Blue** `#3b5998` dominates: the header bar, primary buttons, every link
and username. `primaryDark` `#21417f` is the gradient floor and button border.

Neutrals do the rest. The page is `#f9f9f9` so that white cards pop off it — a
smaller step than it sounds, and the 1px `#cccccc` border is what actually
defines every boundary.

### Borders are load-bearing

This is the biggest inversion from the old system, which drew depth with surface
steps and hid its borders at 5% white. **Here the border is the structure.**
Every card, input, button, thumbnail and tab has a visible 1px edge. If an
element has no border, it is either inside another bordered element or it is
wrong.

### Links

Usernames, game titles in body text, and "See all" affordances are `primary` and
bold. Nothing else is blue.

---

## 3. Typography

**Libre Franklin**, four loaded weights, standing in for the Helvetica/Arial of
the era. Hierarchy comes from **weight and colour before size** — the scale is
deliberately compressed, 11 to 24.

**Weight is a loaded family, never `fontWeight`.** React Native on Android will
not synthesise bold from a custom font: `fontFamily: 'LibreFranklin_400Regular'`
with `fontWeight: '700'` renders regular, on one platform only. Every weight is
a separately loaded family and nothing sets `fontWeight` on text.

Text goes through `<Text variant="…">`, never a raw `<Text>`.

The spec named seven roles; the scale below has twelve. The extras exist because
the reference screens need them: `display` for a profile name, `bodyStrong` for
the bold blue usernames and right-aligned stat values, `capsLabel` for
`YOUR SCORE`, and `prose` for article bodies which would be punishing at 14/18.

---

## 4. Score bands — data, not chrome

The score is a **boxed badge**, not a bare numeral: fill, 1px border, bold
numeral, smaller `/100`. It appears on every review card, cover thumbnail and
wall entry.

`scoreBand(score)` returns `{ bg, fg, border }` from four bands:

| Band | Range | Fill | Ink |
|---|---|---|---|
| Great | 75–100 | `#dff0d8` | `#2d6a2f` |
| Good | 60–74 | `#d9e2ff` | `#21417f` |
| Mixed | 45–59 | `#fcf3d4` | `#7a5c1e` |
| Poor | 0–44 | `#ffdad6` | `#93000a` |

These are the **only** colours in the app outside the blue/neutral system, and
they earn it by being data: a reader parses good/mixed/bad before the digits.

Two of the four come straight from the supplied palette (`primary-fixed` +
`primary` for Good, `error-container` + `on-error-container` for Poor). **Green
and amber were added** — the spec asks for badges "ranging from red to green"
but supplies no green at all.

`logs.rating` is an integer 0–100 and remains the only score anything reads.

---

## 5. Shapes

Soft, but architectural. `DEFAULT` is **4** and almost everything uses it —
cards, buttons, inputs, tabs. Thumbnails are 2 (nearly square corners, period
correct). Only badges and avatar rings go pill.

The game case keeps `caseImage` 12 — see § 7.

---

## 6. Elevation & depth

**There are no ambient shadows.** Depth is tactile layering:

- **Gradients.** The header bar and every button run a vertical top-to-bottom
  gradient, lighter at the top. Never diagonal, never radial.
- **Gloss.** Primary buttons carry a white overlay across their top 50% at low
  opacity — the "gel" reflection of the era.
- **Bevel.** A 1px `bevelLight` top edge and 1px `bevelDark` bottom edge reads as
  a raised surface; reverse them for a recess.
- **Inset.** Inputs are recessed: white fill, 1px `border`, and a darker top
  border. React Native has no inset shadow, so the bevel *is* the technique.
- **Borders.** Every card is white with a 1px light-grey border. No blur, no
  outer shadow, nowhere.

### The exceptions

The **physical game case** (§ 7) keeps its cast shadow. It is the only depicted
physical object in the app and the only thing permitted to cast. Everything else
is interface and stays flat.

> **Android trap, carried over and still true:** `elevation` is clipped by
> `overflow: 'hidden'`. Where a view needs both, split it — outer view owns the
> fill and shadow, inner view owns the clip.

> **Gradient trap, carried over and now critical:** every gradient stop must end
> on `withAlpha(colour, 0)`, never the keyword `'transparent'`.
> `expo-linear-gradient` premultiplies on Android and fades through black. This
> design is gradient-heavy; the rule matters more than it did.

---

## 7. The physical game case — **PRESERVED, MODIFIED**

The case survives the redesign. It is the app's signature object and the one
thing allowed to look expensive.

**It is now upright.** The previous version was turned slightly toward the
viewer on a perspective transform and carried a printed spine down its left
edge. Both are gone:

- **No tilt.** No `rotateY`, no `perspective`. The case renders flat-on.
- **No spine.** No spine slab, no rotated spine text, no `spineWidth` offset. The
  rendered width is the face width.

What remains, unchanged:

- Template PNG per console platform, with the cover window punched out.
- Artwork drawn beneath the template, `caseImage` (12) radius, 2:3, cropped
  never stretched.
- The diagonal gloss sheen.
- The edition badge across the foot.
- **The drop shadow** — `#000` at 0.45, radius 18, offset (6, 12), elevation 12.
  With the tilt and spine gone this is the only remaining cue that the case is
  an object rather than a poster, which is exactly why it stays.

### Geometry

Template authored at 540 × 680; height is always derived from rendered width:
`caseHeightFor(width) = (width / 540) * 680`. Named widths 108 / 168 / 232, but
a caller that knows the viewport passes a measured width. Every internal offset
derives from `scale = renderedWidth / 540`.

### Placement

Game page, log form, review masthead, shelf screens. **Never** a feed, review
card, search result, notification, comment or list tile — those use a flat
thumbnail. Console only (`ps5 | ps4 | xbox | switch`); PC and mobile show bare
cover art in a bordered frame.

---

## 8. Components

- **App bar.** Fixed, opaque, vertical `#3b5998 → #21417f` gradient. Grid glyph
  left, wordmark centre, contextual action right (`New Review`, `Post`, `X`) as a
  bordered inset button. `headerTitleMobile`, white.
- **Review card** (`<LogCard>`). Square avatar, bold blue name, grey timestamp;
  body row with a 3:4 bordered thumbnail left and title + boxed score + review
  text right; `Like · Comment` action bar; likes strip; comment composer. One
  component, used by the feed, the game page, a profile and search.
- **Game row** (`<GameListItem>`). What every 3-and-4-across poster grid became.
  Cover left, title + year + studio + platforms + boxed score right. `boxed`
  wraps it in its own card for a row that stands alone; unboxed, a run of them
  share one container and are separated by rules.
- **Boxed hero** (`<BoxedHero>`). Key art flush inside a card, optionally with a
  score badge hanging off its bottom-right corner. Replaced the full-bleed
  `<HeroArt>` masthead on the game, review, collection and Top 10 screens.
- **Buttons.** Primary: blue gradient, white label, 1px `buttonBorder`, gloss.
  Secondary: light grey gradient, dark label, 1px `border`. Full width in cards.
- **Inputs.** Recessed white, 1px border, darker top edge. The status box is a
  larger textarea.
- **Tabs.** Folder metaphor — active is white and merges with the card below.
- **Avatars.** Square, 1px border. Never circular.

---

## 9. Navigation

Four tabs: **Feed · Search · News · Profile**. Icon above label, white bar, 1px
top border, `primary` when active, no shadow.

"New Review" is not a tab — it is the app bar's right action, opening a modal.
The grid glyph at the app bar's left opens Notifications and other utilities,
the way that icon did in 2010.

---

## 10. Desktop — specified, not built

The brief calls for a fixed ~960px three-column layout (Sidebar / Feed /
Activity) collapsing to a single feed on mobile. **This is not implemented.**
The app is phone-first: a centred `maxContentWidth` (800) column and a bottom tab
bar, with no breakpoints anywhere.

Building it means a breakpoint-aware `<Screen>` (the single shell every route
passes through) and swapping the bottom bar for a left rail. The seam is clean;
the work is simply not done.

---

## 11. Do / Don't

**Do** put every piece of content in a bordered card. Use vertical gradients on
chrome. Make borders visible. Keep the scale compressed and lean on weight.
Right-align values in label/value rows. End every gradient on
`withAlpha(colour, 0)`.

**Don't** use ambient shadows, blur, or glassmorphism. Don't add a horizontal
rail. Don't round anything past 8 except pills and the case. Don't use a second
accent colour — the score bands are data and are the only exception. Don't set
`fontWeight`. Don't put the game case in a feed. Don't make an avatar circular.
