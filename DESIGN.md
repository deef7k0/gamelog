---
name: GameLog
description: A near-black shelf for videogames — the room is dark so the boxes are the only thing lit.
colors:
  ink: "#0A0A0A"
  slate: "#141414"
  graphite: "#1C1C1C"
  iron: "#282828"
  seam: "#262626"
  ridge: "#383838"
  bone: "#FAFAFA"
  ash: "#A3A3A3"
  smoke: "#6E6E6E"
  amber: "#F5A524"
  ember: "#EF4444"
  moss: "#4ADE80"
  pewter: "#A9B6CC"
typography:
  display:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "30px"
    fontWeight: 700
    lineHeight: "36px"
  title:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
  heading:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "23px"
  section:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "20px"
  body:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "21px"
  bodyStrong:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
  caption:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "17px"
  micro:
    fontFamily: "Inter, system-ui, -apple-system, Roboto, sans-serif"
    fontSize: "11px"
    fontWeight: 600
    lineHeight: "14px"
rounded:
  xs: "4px"
  small: "8px"
  control: "10px"
  medium: "12px"
  large: "18px"
  xlarge: "24px"
  pill: "999px"
spacing:
  half: "2px"
  one: "4px"
  two: "8px"
  three: "12px"
  four: "16px"
  five: "24px"
  six: "32px"
  seven: "48px"
  eight: "64px"
components:
  button-primary:
    backgroundColor: "{colors.bone}"
    textColor: "{colors.ink}"
    typography: "{typography.bodyStrong}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "46px"
  button-secondary:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.bone}"
    typography: "{typography.bodyStrong}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "46px"
  button-secondary-pressed:
    backgroundColor: "{colors.iron}"
  button-danger:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.ember}"
    typography: "{typography.bodyStrong}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "46px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.bone}"
    typography: "{typography.bodyStrong}"
    rounded: "{rounded.control}"
    padding: "11px 16px"
    height: "46px"
  button-small:
    typography: "{typography.caption}"
    rounded: "{rounded.control}"
    padding: "7px 12px"
    height: "34px"
  icon-button:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.ash}"
    rounded: "{rounded.control}"
    size: "40px"
  icon-button-small:
    rounded: "{rounded.control}"
    size: "32px"
  sort-pill:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.ash}"
    typography: "{typography.micro}"
    rounded: "{rounded.control}"
    padding: "8px 12px"
  sort-pill-selected:
    backgroundColor: "{colors.iron}"
    textColor: "{colors.bone}"
  chip:
    backgroundColor: "{colors.graphite}"
    textColor: "{colors.ash}"
    typography: "{typography.micro}"
    rounded: "{rounded.pill}"
    padding: "6px 12px"
  input:
    backgroundColor: "{colors.slate}"
    textColor: "{colors.bone}"
    rounded: "{rounded.medium}"
    padding: "10px 12px"
    height: "48px"
  card:
    backgroundColor: "transparent"
    borderTop: "1px {colors.seam}"
    textColor: "{colors.bone}"
    rounded: "0"
    padding: "16px 0"
  review-meta:
    backgroundColor: "{colors.slate}"
    rounded: "12px"
    padding: "12px"
    gap: "12px"
  score-square:
    borderColor: "{score ramp}"
    borderWidth: "1.5px"
    rounded: "12px"
    size: "54px"
    fontSize: "24px"
    fontWeight: 700
  tab:
    backgroundColor: "transparent"
    textColor: "{colors.smoke}"
    typography: "{typography.bodyStrong}"
    padding: "12px 16px"
  tab-selected:
    textColor: "{colors.bone}"
---

# Design System: GameLog

## Overview

**Creative North Star: "The Unlit Shelf"**

The room is dark so the boxes are the only thing lit. GameLog's interface is a
near-black room — `Ink` (#0A0A0A) walls, `Slate` (#141414) shelving you sense
rather than look at — and everything with colour in it belongs to a game, not to
the app. Box art is the content on nearly every screen, so the chrome's job is to
be a frame that never argues with what it frames.

The temperament is quiet and exacting. Confidence here is expressed through
consistency and tight detail, not through statements: every interactive rectangle
is the same rectangle at the same radius, every selected thing is exactly one
step lighter than an unselected one, every hero image fades into the page on the
same ramp. Nothing is loud unless it is artwork. The components are refined and
restrained — low contrast, generous padding, controls that ask for attention only
when you go looking for them — while the game case, the one object the app
renders as a physical thing, is allowed to be as present as a real boxed copy on
a shelf.

The system replaced a blue-accented predecessor, and that predecessor is the
named anti-reference. A blue button beside orange key art read as a second,
louder piece of artwork; the whole point of moving to a monochrome scale was to
stop the interface competing for the eye it is supposed to be directing.

**Key Characteristics:**

- Near-black, monochrome chrome; every hue on screen is borrowed from a game.
- Separation by tonal step plus a hairline edge — never by fill colour.
- One rectangle for every control: 10px radius, hairline outline. Box art gets 4px.
- Emphasis is a change in *value*, not in hue: selected is one step lighter.
- Interface is flat; depicted objects cast real shadows.
- Inter throughout, in four weights; hierarchy comes from size, weight and colour.

## Colors

A near-black monochrome scale named for the materials it evokes, with exactly
three signal colours and nothing else.

### Primary

- **Bone** (#FAFAFA): The accent and the primary fill in one. It is text at full
  strength, the fill of the single most important button on a screen, the active
  tab's underline, and the active tab's label. It is a *value*, not a brand hue —
  in light mode this role inverts to near-black (#111111) and nothing else about
  the system changes.

### Secondary

The three signal colours. Each carries information no other treatment can, which
is the only reason any of them is allowed to exist.

- **Amber** (#F5A524): Ratings and the middle of the score ramp. The warm colour
  in the palette, used for the star on a favourite and for scores in the 45–69
  band ("Mixed" through "Decent").
- **Ember** (#EF4444): Destructive actions, errors, unseen counts, and the bottom
  of the score ramp (0–34). On a `Delete` button it colours the label and tints
  the edge — never the fill.
- **Moss** (#4ADE80): Success, "Playing" status, and the top of the score ramp
  (70–100).

### Tertiary

- **Pewter** (#A9B6CC): Platinum trophies, and only those. A cold metallic that
  reads as achievement without joining the signal set.

### Neutral

The room, in six steps. Each is one perceptible increment from the last, which is
what lets the system separate surfaces without drawing a single line.

- **Ink** (#0A0A0A): The page. Every screen's floor.
- **Slate** (#141414): Sheets and text field fills. One step off the page. It no
  longer backs cards or list rows — see Cards / Containers.
- **Graphite** (#1C1C1C): Control fill — buttons, icon buttons, sort pills, chips.
  Sits above a card so a button on a card is still visible.
- **Iron** (#282828): The selected state of any control, and the dock's moving
  pill. One step above Graphite; that step *is* the selection.
- **Seam** (#262626): The hairline around anything interactive.
- **Ridge** (#383838): The hairline around anything interactive *and selected*.
- **Ash** (#A3A3A3): Secondary text — an unselected control's label, a subtitle.
- **Smoke** (#6E6E6E): Muted text — timestamps, counts, captions, inactive tabs.

### Light mode

Every token has a counterpart and the register inverts rather than shifting. The
frontmatter carries the dark values because dark is this system's home; these are
the light pairs: Ink → #FFFFFF, Slate → #FAFAFA, Graphite → #F4F4F4, Iron →
#E8E8E8, Seam → #E4E4E4, Ridge → #D0D0D0, Bone → #111111, Ash → #5A5A5A, Smoke →
#8C8C8C. Amber deepens to #E8940C, Ember to #DC2626, Moss to #16A34A, Pewter to
#7C8AA5.

### Named Rules

**The Borrowed Colour Rule.** Every colour on a screen belongs to a game, not to
the app. Amber, Ember and Moss are the only exceptions, and each is licensed by a
single job — ratings, danger, success. A fourth app-owned hue is a bug.

A control may wear one of the three **only when the control's meaning is that
colour's job**. Two do: Favourite takes Amber, because marking a game a
favourite is the same judgement the rating scale's warm colour already carries;
Playing takes Moss, because it is a live status the app colours `success`
everywhere else it appears. Wishlist, Played and Share do not — a wishlist is a
list you are on or off, and those three previously borrowed the accent for no
meaning at all. The test is not "is this state important" but "would the reader
lose information if it were grey".

**The Value-Not-Hue Rule.** Selection, emphasis and primacy are expressed by
moving one step lighter — Graphite → Iron for the fill, Seam → Ridge for the
edge, Ash → Bone for the label. Never by changing hue. This is what makes a row
of five sort pills stay quiet while still showing which one is on.

## Typography

**Display Font:** Inter
**Body Font:** Inter
**Label/Mono Font:** none distinct

**Character:** Inter and nothing else, in four weights. It is a neutral grotesque
with a tall x-height and unambiguous figures, and figures are the point: this app
sets a lot of numbers small — scores, years, playtimes, like counts — and a face
whose `1`, `7` and `9` are legible at 11px does more for it than any amount of
personality would. The register is editorial and quiet; type is asked to organise
the page, not to decorate it.

**The scale is small on purpose.** It ran one step larger for a revision and was
wrong on a phone: a single feed card filled the screen and a review's own score
outweighed the box art beside it. This is a dense app — one feed row carries a
name, a headline, a score, a verdict, a game, a cover and four lines of prose —
and density is only legible if the type stays quiet. Body sits at 14.

**Weight is a family, not a number.** React Native on Android will not synthesise
a bold from a custom font — `fontFamily: 'Inter_400Regular'` with
`fontWeight: '700'` silently renders regular, on one platform only. Every weight
is a separately loaded family (`FontFamily.regular` / `.medium` / `.semibold` /
`.bold`) and **nothing in the app sets `fontWeight` on text**.

### Hierarchy

- **display** (700, 30/36): The one headline on a screen that has one — the Top 10
  masthead, a long-form review's title. Never twice on a screen.
- **title** (700, 22/28): A game's name on its own page, a collection's name. The
  subject of the screen.
- **heading** (600, 18/23): Section headings inside a scroll; a game's name in a
  masthead beside its case; a review's headline on a feed card.
- **section** (600, 15/20): `SectionHeader` — "About", "Screenshots", "Cast".
- **body** (400, 14/21): Reading copy. Synopses and review text.
- **bodyStrong** (600, 14/20): The same size promoted — a row's title, a button's
  label, a username. Pairs beside `caption` in a two-line row.
- **caption** (500, 12/17): Metadata and timestamps. Subtitles under a title, the
  second line of a list row, like and comment counts, an activity excerpt.
- **micro** (600, 11/14): Counts and classification labels, usually in caps.

### Named Rules

**The One Family Rule.** Inter is the only typeface. Hierarchy is built from size,
weight and colour, and a ninth step must be justified against the eight that
exist rather than added beside them.

**The Three Weights Rule.** 400 for prose, 500 for dense metadata, 600 for
anything that has to be picked out of a page. **700 is reserved** for the two
largest steps — which are page titles — and for a score, the one number in this
app that has to be readable at arm's length. Reaching for a heavier weight to
make something matter is how a screen ends up with six competing emphases; go up
a step or change the colour instead.

**The Caps-For-Counting Rule.** `micro` set in caps is for labels that count or
classify — `12 GAMES`, `COMMUNITY`, `THIS MONTH`, `RANKED`. It is never used for
a sentence, and sentence-case `micro` is never used for a classification. Caps
always carry positive letter spacing; set tight, capitals read as one long word
rather than as a label.

## Layout

Phone-first, single column, with a centred `MaxContentWidth` (800px) cap so the
app stays readable on a tablet or in `react-native-web` without becoming a
desktop layout.

**Spacing** is a 4pt scale with numeric names (`one` = 4 … `eight` = 64) rather
than t-shirt sizes, so the steps stay orderable and `Spacing.four` reads as "four
units". Screen gutters are `four` (16px); the gap between related controls is
`two` (8px); the gap between sections is `four` or `five`; every scroll ends in
`seven` (48px) of bottom padding so the last row clears the tab bar.

**Grids** are derived from one helper (`gridItemWidth`) so every grid in the app
resolves the same way: four across for poster grids (a collection, a studio
catalogue, a Steam library), two across for cover tiles that carry a caption
beside the art (the Top 10, the popularity chart). Artwork holds two fixed
ratios and only two: `2/3` portrait for box art, `16/9` landscape for key art.

**Heroes bleed.** A screen that opens on artwork — a game, a collection, a
review, the Top 10 — cancels its scroll container's horizontal padding with a
negative margin so the image reaches both edges and runs up under the transparent
header, off the top of the display. The identity block below it is pulled back up
over the tail of the fade by `-Spacing.five`.

**Heroes are sized against the display, not the art.** One component (`HeroArt`)
serves all four screens at `HeroHeightRatio` (38%) of the window height, floored
at the art's own 16:9 height so a wide screen never crops a frame that already
fits. 16:9 on a tall phone is a 26%-high band — a banner above the content rather
than a backdrop behind it. The cost is a centre crop, which key art survives
because key art is composed centrally.

### Named Rules

**The Bleed Rule.** Hero artwork always reaches both edges and always runs under
the header. A hero inset by its container's padding is a hero that has been
turned into a picture of a hero.

## Elevation & Depth

Flat chrome, lit objects. Interface surfaces cast nothing: a card, a button, a
sheet and a dock are separated from what is behind them by a tonal step
(`Ink → Slate → Graphite → Iron`) plus a hairline edge, and by nothing else. On a
near-black page a drop shadow is close to invisible anyway, so paying for one
would buy separation you cannot see.

Real shadows are reserved for the things the app *depicts* rather than the things
it is built from — above all the game case, which carries its own 45%-opacity
shadow, offset and blurred as an object on a shelf would be. The floating header
is the one piece of chrome that darkens what is beneath it, and even there the
shadow is drawn as a gradient rather than cast, because a transparent view has
nothing to cast from.

### Shadow Vocabulary

- **Object** (`shadowOpacity: 0.45, shadowRadius: 18, shadowOffset: 6/12,
  elevation: 12`): The game case and the disc. Depicted physical objects only.
- **Card** (`shadowOpacity: 0.18, shadowRadius: 12, shadowOffset: 0/4,
  elevation: 3`): No longer reachable from `Card`, which has no fill to cast
  from. It survives on `Poster` and on the framed cover the game page shows for
  PC and mobile, where a faint lift is what separates portrait art from the page.
- **Raised** (`shadowOpacity: 0.28, shadowRadius: 20, shadowOffset: 0/8,
  elevation: 8`): Reserved for a future lifted surface. Not currently applied.
- **Header tail** (a black gradient from 28% to 0% across the bottom fifth of the
  header): Drawn, not cast, so the floating bar has an edge over artwork.

### Named Rules

**The Object Rule.** If it depicts a physical object, it casts a shadow. If it is
interface, it does not. There is no third case, and "this card feels flat" is not
one.

## Shapes

One rectangle, repeated. Every interactive element — button, icon button, sort
pill, segmented control, tag picker, RSVP toggle, log status, dock pill — is a
rounded rectangle at `control` (10px) with a hairline outline. That single shared
silhouette is most of what makes the controls read as a family. `control` shares
its value with `small` and keeps its own name anyway: a control should say it is
a control at the call site rather than borrowing a size token that happens to
match today.

The scale, smallest first:

- **xs** (4px): Box art, and only box art. A real game case has a corner you can
  barely see, so anything more reads as a sticker of one. See the Box Art Rule.
- **small** (8px): Small posters, thumbnails, tiles.
- **control** (10px): Every control. Its own step because `small` makes a 44pt
  button look boxy and `medium` makes it look like a card that happens to be
  tappable.
- **medium** (12px): Text fields, screenshots, the review card's meta surface and
  its score square.
- **large** (18px): Sheets and the dock shell.
- **xlarge** (24px): Held in reserve.

List rows and cards are not on this scale at all — they are hairlines, and a
hairline has no radius. The score square keeps its numbers in `SCORE_SQUARE`
rather than reading `Radius` even where the values coincide, so that changing
the global scale cannot silently redraw a component that was specified.

`pill` (999px) has one meaning and it is *not* "button": it marks things that are
not controls. Progress tracks, count badges, avatars, and `Chip` — the metadata
tag for genres and platforms. Shape is now the only thing distinguishing a tag
from a control, so it has to keep doing that job.

Borders are always `StyleSheet.hairlineWidth`, never a whole pixel. The
2px underline beneath an active tab is the single exception, and it is a marker
rather than an outline.

### Named Rules

**The One Rectangle Rule.** Every control is `Radius.control`. If you are
reaching for `Radius.pill` on something tappable, you are about to make a tag
look like a button.

**The Box Art Rule.** Cover art is `xs` (6px) and never more. The app depicts
physical boxed copies; a rounded cover is a picture of an app icon. Portrait art
in a *control* — a picker row, a tappable tile — may take `small`, because there
the rounding belongs to the control, not to the artwork.

## Components

### Buttons

Refined and restrained: a slightly-lifted rectangle with a hairline outline, no
flourish, and a press that sinks 3% rather than dimming. Opacity feedback is
useless on near-black, so press state is scale plus a fill step.

- **Shape:** Gently rounded (10px), hairline outline in `Seam`.
- **Primary:** `Bone` fill with an `Ink` label (11px/16px padding, 46px tall).
  At most one per screen.
- **Secondary:** `Graphite` fill, `Bone` label, `Seam` edge. The default for
  everything; pressed it steps to `Iron`.
- **Ghost:** No fill, `Seam` edge, `Bone` label. For actions that must not draw
  the eye at all.
- **Danger:** `Graphite` fill, `Ember` label, `Ember`-at-33% edge. Deliberately
  not a red slab — a filled red button is the loudest object possible on a dark
  screen, and deleting a collection does not warrant outshouting the cover art
  beside it.
- **Small:** 34px tall, `caption` label, 7px/12px padding.
- **Optional leading icon** (17px, 15px at small) and an **optional trailing
  count** in a recessed pill — `Iron` on a dark button, white-at-10% on a
  `Bone` one, because the recess has to go darker on a light fill.

### Icon Buttons

The same rectangle with equal sides (40px, or 32px small), so an overflow "…" or
an "add" at the end of a row of labelled buttons reads as one of them rather than
as a loose glyph. Square, not round: a circle would be a third control shape and
the family only has one. A `plain` tone drops the fill and outline entirely, for
glyphs inside an already-bordered row where a second outline around each would
turn a tidy row into a grid of boxes.

### Chips

- **Style:** `Graphite` fill, `Seam` hairline, `Ash` label at `micro`, fully
  rounded (999px).
- **State:** A `primary`-toned chip steps to `Iron` with a `Bone` label. Chips are
  not interactive; the pill shape is what says so.

### Cards / Containers

There is no card. `Card` is a hairline and some vertical space, and the name is
now a historical accident.

- **Separator:** `borderTopWidth: hairlineWidth` in `Seam`.
- **Background:** None. The page shows through.
- **Corner Style:** None. A rule has no corners.
- **Internal Padding:** `four` (16px) vertical; horizontal padding belongs to the
  page, so a block runs the full column width.
- **No fills at all.** There was a `tone="selected"` that marked a block as *the
  viewer's own* with a `Graphite` fill. It is gone: on a page of near-black, the
  one filled rectangle read as a notice the app was showing you rather than as
  your own writing. What is yours is said in words and in the score's colour.

This replaced an 18px rounded `Slate` surface, and the reason is worth keeping.
A feed of rounded cards turns every post, collection and widget into a floating
object with its own edge, and twenty objects stacked on a near-black page read
as twenty containers rather than as a list of things to read. The rule does the
same job — *this ends, that begins* — using one pixel instead of a shape, and it
hands every block the full page width that the inset was spending on nothing.

**What kept an outline.** Three cases, and no fourth: a **control** (a button, a
toggle, a tappable row that has to look tappable), an **exception in the flow**
(the Steam privacy notice — a warning filed as another section stops being a
warning), and an **attachment** (the game tagged onto a post, which must look
stuck to the post rather than be another paragraph of it). Each is transparent
with a hairline `Seam` edge at `Radius.control`, so they read as the same family
as every other control on the screen.

### Inputs / Fields

- **Style:** `Slate` fill, `Seam` hairline, `medium` radius (12px), 48px minimum
  height, 16px text so iOS does not zoom on focus.
- **Error:** The outline and the footnote both turn `Ember`; the fill does not
  change.
- **Multiline:** 120px minimum, top-aligned. Review bodies get 260px, because a
  short box invites a short review.

### Navigation

- **Tabs:** Scrollable underline tabs. Selected is `Bone` label over a 2px `Bone`
  underline; unselected is `Smoke` with a transparent underline. Contrast between
  states is a difference in *brightness*, which survives sitting over artwork in
  a way a coloured underline does not. An optional `Ember` count badge marks
  "something here you have not seen".
- **Floating header:** Transparent app-wide, backed by a page-coloured ramp
  (97% → 88% → 0% down its height) for legibility plus the drawn shadow tail
  described in Elevation. Screens leading with artwork let content run under it;
  everything else reserves the space. Modals opt out and take a solid bar.
- **Dock:** A blurred, `large`-radius shell holding 44px icon items, with one
  `Iron` pill that springs between them (stiffness 360, damping 32, mass 0.6).
  Used where six destinations need to fit a narrow phone without scrolling.

### Hero Art

Full-bleed key art that dissolves into the page, in two layers.

- **Blur ramp:** one copy of the image blurred at radius 24, revealed through a
  `MaskedView` whose mask is a transparent-to-opaque gradient — nothing across
  the top half, then an eased ramp to full at the bottom edge. Blurring the
  image's own pixels rather than reaching for `expo-blur`: a `BlurView` blurs its
  *backdrop*, which needs the Dimezis implementation and API 31+ on Android and
  degrades to a flat translucent panel everywhere else.

  The first version stacked three clipped copies at increasing blur radius, and
  it was wrong: rendered at the real 390×321 against high-contrast art, each band
  boundary was a visible rectangular step. Adding bands does not fix it — twelve
  looked worse than three, because every extra band is another edge rather than a
  smaller one. Blend, don't stack.
- **Colour fade:** a three-stop gradient over the bottom 62% ending on the page
  colour, weighted dark at the middle stop. A straight ramp spends its first half
  barely tinting anything and then closes the whole distance in the second, which
  reads as the art dropping off a shelf.
- **Scrim:** an optional 50%-black gradient across the top 40%, so the floating
  back arrow survives bright art.

### Score

Two presentations of the same 0–100 number, and the choice between them is about
volume.

- **`ScoreSquare`** — the review header's anchor. 54×54, 12px radius, a 1.5px
  outline in the verdict colour, the numeral at 24px/700 in the same colour, over
  a 10%-opacity wash of it. Outlined rather than filled: a solid block of Ember
  would be the loudest thing on the page, and the box art is meant to be the only
  element carrying real colour.

  It was 80 with a 40px numeral for one revision, and that is worth recording: at
  80 the badge plus its padding stood taller than the 2:3 cover beside it, so the
  block that is supposed to sit *under* the artwork hung below it instead. The
  score leads the reading order; it does not have to be the biggest object on
  screen to do that.
- **`ScorePill`** — a tinted block in four sizes from 32px to an 84px `hero`. Used
  where a score has to appear inside something else: a game page's own log, a
  diary entry, a stat block.
- **`ScoreLine`** — the number and the word for it, side by side on a baseline:
  "82 Very Good". For rows too tight for the square. Both halves carry the verdict
  colour so the line is parseable at a glance the way five green stars are, but a
  100-point scale has fifteen verdicts and the word is what stops 82 and 88
  reading as the same opinion.

The colour comes from a three-stop ramp — Moss / Amber / Ember — rather than a
per-band palette, because fifteen distinct colours would be noise and the tone is
what a reader actually parses at a glance.

### Review Card

How a review looks everywhere it appears: the feed, a profile, a game's review
list, the popular-reviews tab, and its own page. Editorial rather than card-like
— four bands, top to bottom.

```
avatar  username                            timestamp

“Halo needs to die already”      ┌────────┐
┌──────────────────────────────┐ │        │
│ ┌────┐  Halo: Campaign Evo…  │ │ box art│
│ │ 12 │  DROPPED   AWFUL      │ │  2:3   │
│ └────┘                       │ │        │
└──────────────────────────────┘ └────────┘

Wow. This is… so sad. I cannot believe this is supposedly…

♥  LIKED   12,109 likes
```

- **The top line is the review's headline, never the game's name.** The game is
  named in the meta block below it, beside its score and verdict, where it
  belongs. Printing it in both places made the card look like it was about two
  different things. `heading` (18/600).
- **A review must have a headline and a body.** The log form enforces both or
  neither: half a review has nowhere to render — a body with no headline arrives
  as an untitled block, a headline with no body is a promise of writing that is
  not there. A log with no review at all is still fine; it simply gets no
  headline rather than a borrowed one.
- **Meta surface** (`ReviewMeta`): `Slate`, 12px radius, 12px padding, 12px
  between badge and text. It groups; it does not frame — no border, no shadow.
  Score badge and game identity read as one unit because they answer one question
  together: *what did they think of what*.
- **Status labels**: 11px/600, uppercase, +0.6 tracking, on one line. They take
  the **score's** colour, not the status colour. A red 12 above a green "DROPPED"
  would be two verdicts on the same line; the block is one opinion and reads as
  one only if it is one colour. With no score there is no verdict, so they fall
  back to `Smoke` — correct, because "PLAYED" without a rating is a fact rather
  than a judgement.
- **Box art**: 88px wide at 2:3 — 132 tall — `xs` radius, hanging from the top.
  It is the tallest object in the block by design; the whole left column has to
  finish inside its height or the composition reads as two things that failed to
  line up.
- **Everything else is quiet**: no borders, no gradients, no shadows.

The hierarchy is fixed and in this order: **the score first, the artwork second,
the metadata third.** The score leads the *reading* order without being the
largest thing on screen — that is the cover's job.

### Game Case

The signature component, and the reason the system exists in the shape it does. A
game rendered as a physical boxed copy: a platform template PNG over the cover
art, a coloured spine slab offset behind it with the title rotated to read
bottom-to-top, a soft diagonal gloss across the plastic, a 6° turn on a 900px
perspective, and a real drop shadow wrapping face and spine as one object. Three
sizes (108 / 168 / 232px wide). All geometry derives from template metadata and
scales from the rendered width.

It appears **only** on a game's own dedicated pages — game detail, the log form,
a review masthead, a shelf screen. Everywhere else uses flat cover art.

### Cover Tile

Box art, then the title, then the year. Nothing else. The unit a chart or a
curated shelf is built from: no card, no surface, no pill. Art takes a bit over a
third of the column (38%, clamped 52–84px). An optional rank is set in muted
`micro` beside the cover rather than as a numbered badge — the order is already
legible from the layout, so the numeral is a confirmation, not the headline.

## Do's and Don'ts

### Do:

- **Do** express every selected, active or emphasised state as one step lighter —
  `Graphite` → `Iron`, `Seam` → `Ridge`, `Ash`/`Smoke` → `Bone`.
- **Do** give every interactive rectangle `Radius.control` (10px) and a
  `hairlineWidth` outline in `Seam`.
- **Do** let hero artwork bleed to both edges and run under the transparent
  header, cancelling container padding with a negative margin.
- **Do** end scroll containers with `Spacing.seven` (48px) of bottom padding.
- **Do** use `withAlpha(colour, 0)` as a gradient's transparent stop, never the
  keyword `transparent` — Android interpolates through black and leaves a grey
  bruise across the middle of the ramp.
- **Do** separate blocks of content with a hairline rule and vertical space.
  Filling and rounding them is what the de-bubble removed.
- **Do** reach for a tonal step before a border, and a border before a shadow.
- **Do** keep the count badge on a tab in `Ember` and the count badge inside a
  button recessed and colourless. One means "unseen"; the other means "how many".

### Don't:

- **Don't** introduce a coloured accent. No brand hue on buttons, links, tabs or
  selected states — the blue-accented predecessor is the named anti-reference.
  Only Amber (ratings), Ember (danger) and Moss (success) may carry colour, and
  each only for its one job.
- **Don't** make a control pill-shaped. `Radius.pill` means "this is not a
  control" — progress tracks, count badges, avatars, metadata chips. Shape is the
  only thing left telling a tag apart from a button.
- **Don't** put the game case anywhere but a game's own dedicated page. Not in a
  feed, a search result, a list tile, a comment, a notification or a widget —
  those use flat cover art. Diluting it destroys the one moment in the app that
  feels physical.
- **Don't** give interface a drop shadow. Cards, buttons, sheets and docks are
  flat; only depicted objects cast.
- **Don't** put content in a filled, rounded box. A card, a stat panel, a list
  row and a widget are separated by a rule, not by a container. The three
  exceptions are a control, a warning, and an attachment — and each of those is
  *outlined*, never filled. `Slate` on a block of content is the bug this rule
  exists to catch.
- **Don't** stretch landscape key art into a portrait poster slot. `Poster` crops
  with `cover` and falls back to a lettered placeholder — that fallback is what
  the missing cover is for.
- **Don't** add a ninth step to the type scale, or a second typeface, without
  first failing to express the idea with the eight steps that exist.
- **Don't** set `fontWeight` on text. Inter's weights are separate loaded
  families — `fontWeight` is ignored on Android and the bug shows on one platform
  only. Use `FontFamily.regular` / `.medium` / `.semibold` / `.bold`.
- **Don't** round cover art past `xs` (4px). The app depicts boxed copies, and a
  rounded cover is a picture of an app icon.
- **Don't** let a component's own block outgrow the artwork beside it. The cover
  is the tallest object in a review card and the case is the tallest on a game
  page; anything that overhangs them is oversized, not emphasised.
