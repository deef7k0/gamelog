---
name: GameLog
description: A premium, calm, information-dense gaming social platform. Dark, greyscale, one blue accent, and a lot of games.
scheme: dark-only
target: react-native
colors:
  background: "#121212"
  surface: "#1C1C1C"
  surfaceElevated: "#242424"
  surfaceSelected: "#2A2A2A"
  input: "#202020"
  hover: "rgba(255,255,255,0.04)"
  pressed: "rgba(255,255,255,0.07)"
  border: "rgba(255,255,255,0.05)"
  borderStrong: "rgba(255,255,255,0.12)"
  primary: "#0070CC"
  onPrimary: "#FFFFFF"
  primaryMuted: "rgba(0,112,204,0.16)"
  accent: "#0070CC"
  text: "#F5F5F5"
  textSecondary: "#A8A8A8"
  textMuted: "#767676"
  scoreHigh: "#4ADE80"
  scoreMid: "#F5A524"
  scoreLow: "#EF4444"
  danger: "#EF4444"
  success: "#4ADE80"
  platinum: "#A9B6CC"
  scrim: "rgba(0,0,0,0.6)"
  skeleton: "#242424"
  # Ink for gradient ramps over artwork. Not a surface — never fill with it.
  shadowInk: "#000000"
  # Tier-list ramp. Data, not chrome. See § 1.5.
  tierS: "#FF7B7B"
  tierA: "#FFB068"
  tierB: "#FFD86B"
  tierC: "#B6E07A"
  tierD: "#7ACBE0"
  tierF: "#B0A6E0"
  # Legacy aliases, kept so older call sites keep compiling. Do not use in new code.
  backgroundElement: "#202020"
  backgroundSelected: "#2A2A2A"
typography:
  display:
    fontFamily: "Inter_700Bold"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "38px"
    letterSpacing: "-0.02em"
  h1:
    fontFamily: "Inter_700Bold"
    fontSize: "28px"
    fontWeight: 700
    lineHeight: "34px"
    letterSpacing: "-0.015em"
  h2:
    fontFamily: "Inter_700Bold"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: "28px"
    letterSpacing: "-0.01em"
  h3:
    fontFamily: "Inter_700Bold"
    fontSize: "18px"
    fontWeight: 700
    lineHeight: "24px"
    letterSpacing: "0"
  h4:
    fontFamily: "Inter_700Bold"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "22px"
    letterSpacing: "0"
  h5:
    fontFamily: "Inter_700Bold"
    fontSize: "14px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0"
  h6:
    fontFamily: "Inter_700Bold"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "16px"
    letterSpacing: "0.02em"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
  prose:
    fontFamily: "Inter_400Regular"
    fontSize: "17px"
    fontWeight: 400
    lineHeight: "28px"
    letterSpacing: "0"
  bodySmall:
    fontFamily: "Inter_400Regular"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  caption:
    fontFamily: "Inter_400Regular"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "15px"
    letterSpacing: "0.02em"
  label:
    fontFamily: "Inter_500Medium"
    fontSize: "11px"
    fontWeight: 500
    lineHeight: "14px"
    letterSpacing: "0.08em"
    textTransform: "uppercase"
  button:
    fontFamily: "Inter_600SemiBold"
    fontSize: "14px"
    fontWeight: 600
    lineHeight: "20px"
    letterSpacing: "0"
  # Preserved — the game case keeps its own type. See § 2.3. Do not use elsewhere
  # and do not fold these into the scale above.
  caseTitle:
    fontFamily: "Inter_700Bold"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
  caseEdition:
    fontFamily: "Inter_500Medium"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
spacing:
  x4: "4px"
  x8: "8px"
  x12: "12px"
  x16: "16px"
  x20: "20px"
  x24: "24px"
  x32: "32px"
  x40: "40px"
  x48: "48px"
rounded:
  none: "0px"
  xs: "2px"
  sm: "3px"
  md: "5px"
  lg: "8px"
  pill: "999px"
  # Role aliases, mapped onto the scale above.
  image: "4px"
  control: "6px"
  card: "6px"
  input: "6px"
  # Preserved — the game case keeps its own radii. See § 4.1. Do not fold these
  # into the scale above.
  caseImage: "12px"
  caseSpine: "3px"
motion:
  fast: "150ms"
  normal: "200ms"
  slow: "300ms"
  easing: "ease-out"
  pressScale: 0.98
elevation:
  none: "none"
  card: { opacity: 0.2, radius: 6, offsetY: 2, android: 2 }
  control: { opacity: 0.24, radius: 8, offsetY: 3, android: 3 }
  raised: { opacity: 0.3, radius: 12, offsetY: 5, android: 6 }
  overlay: { opacity: 0.38, radius: 16, offsetY: 8, android: 10 }
  # Ceiling — the depicted object (§ 4.1.7). Interface must never reach this.
  gameCase: { opacity: 0.45, radius: 18, offsetX: 6, offsetY: 12, android: 12 }
score:
  inline: 15
  medium: 22
  large: 32
  hero: 44
layout:
  maxContentWidth: "800px"
  tapTarget: "44px"
  posterAspectRatio: "2:3"
  heroAspectRatio: "16:9"
  heroHeightRatio: 0.38
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "16px"
    border: none
    shadow: none
  card-elevated:
    backgroundColor: "{colors.surfaceElevated}"
  chip:
    backgroundColor: "{colors.surfaceSelected}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.caption}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
  chip-active:
    backgroundColor: "{colors.primaryMuted}"
    textColor: "{colors.primary}"
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.onPrimary}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "46px"
    border: none
  button-secondary:
    backgroundColor: "{colors.surfaceElevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "46px"
    border: none
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
  button-small:
    padding: "8px 16px"
    height: "40px"
  icon-button:
    backgroundColor: "{colors.surfaceElevated}"
    rounded: "{rounded.control}"
    size: "44px"
    border: "hairline {colors.border}"
  input:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.input}"
    padding: "12px 16px"
    height: "48px"
  search-bar:
    backgroundColor: "{colors.input}"
    rounded: "{rounded.input}"
    height: "56px"
    iconPosition: "leading"
  bottom-nav:
    backgroundColor: "{colors.surface}"
    height: "68px"
    maxItems: 5
    selectedColor: "{colors.primary}"
    unselectedColor: "{colors.textMuted}"
  score:
    display: "bare numeral, verdict colour"
    typography: "700"
    sizes: "inline 15 / medium 22 / large 32 / hero 44"
gameCase:
  templateSize: { width: 540, height: 680 }
  widths: { small: 108, medium: 168, large: 232 }
  perspective: 900
  tilt: 6
  shadow:
    color: "#000000"
    opacity: 0.45
    radius: 18
    offset: { width: 6, height: 12 }
    elevation: 12
  gloss:
    - "rgba(255,255,255,0.20)"
    - "rgba(255,255,255,0.04)"
    - "rgba(255,255,255,0)"
  glossStart: { x: 0, y: 0 }
  glossEnd: { x: 0.9, y: 0.55 }
  spineRadius: 3
  platforms:
    ps5:
      coverArea: { x: 16, y: 58, width: 508, height: 606 }
      spineWidth: 26
      spineColor: "#0D47A1"
      spineTextColor: "#FFFFFF"
      accent: "#1565C0"
    ps4:
      coverArea: { x: 16, y: 52, width: 508, height: 612 }
      spineWidth: 26
      spineColor: "#0D47A1"
      spineTextColor: "#FFFFFF"
      accent: "#1565C0"
    xbox:
      coverArea: { x: 14, y: 62, width: 512, height: 604 }
      spineWidth: 24
      spineColor: "#107C10"
      spineTextColor: "#FFFFFF"
      accent: "#107C10"
    switch:
      coverArea: { x: 14, y: 46, width: 512, height: 620 }
      spineWidth: 22
      spineColor: "#E60012"
      spineTextColor: "#FFFFFF"
      accent: "#E60012"
  disc: { size: 512, artRadius: 248, hubRadius: 78 }
---

# Design System: GameLog

> **Implementation target:** React Native 0.86 / Expo SDK 57 / expo-router. There
> is no DOM, no Tailwind and no CSS-in-JS here — see § 26. Values below are
> **density-independent pixels**, applied through `StyleSheet.create` and read
> through `useTheme()`.
>
> **Tokens are normative; prose is context.** The YAML frontmatter above is the
> machine-readable layer consumed by `.impeccable/design.json` and the live
> panel. Where prose and the frontmatter disagree, the frontmatter wins and the
> prose is a bug.
>
> **Colour mirrors the code; typography and radius lead it.** All 26 colour
> tokens match `src/constants/theme.ts` exactly. The type scale (§ 2) and radius
> scale (§ 5) are a **specified target the code has not been migrated to yet** —
> adopted deliberately over the shipped values. New work follows this document;
> § 26.2 lists every value that still differs and what it takes to close the gap.
> Expect the live panel to report drift on type and radius until it does.
>
> **Preserved feature.** The **physical videogame case** is specified in
> **§ 4.1**. Its rules, dimensions, materials and placement constraints are
> normative and are not superseded by anything else in this document. Where a
> global rule would conflict with it — the shadow ban, the poster radius — § 4.1
> wins.

---

## 0. Design Language Summary

**A premium gaming social platform, built for long sessions.**

The people who use this app spend hours browsing games, reviews, collections and
profiles. Everything here follows from that: the interface has to be calm enough
to sit in for an hour, dense enough to be worth scrolling, and readable enough
that none of it is work.

Quality comes from spacing, typography, consistency, hierarchy and proportion —
never from effects. There are no gradients (except as fades over artwork), no
glass, no glow, no neumorphism, no skeuomorphism. If something looks expensive
here it is because the spacing is right, not because it is doing a trick.

**Key characteristics:**

- Dark only, and never true black. `#121212` is the floor.
- Depth is a *surface step*, not a shadow: background → surface → elevated.
- One accent — PlayStation blue — on selected nav, primary actions, active
  states and badges. Nothing else.
- ~90% of any screen is greyscale. Artwork and the accent are the colour.
- Medium-high density, achieved with chips and spacing, never by shrinking text.
- Four geometric primitives: rounded rectangle, circle, pill, rounded square.
- Small radii, generally **3–6px** rather than highly rounded cards. The artwork
  should be the roundest thing on screen, not the chrome around it.

The one deliberate exception to all this restraint is the **physical game case**
(§ 4.1) — the single depicted physical object in the system, and the only
element allowed to cast, gloss and tilt.

---

# 1. Colour

## 1.1 The room

Six neutral steps, and each one has a job. Separation between them is what
replaces every border and every shadow in the app.

- **Background** `#121212` — the page. Never `#000`: true black smears on OLED
  during scroll and removes the contrast the whole depth model is built on.
- **Surface** `#1C1C1C` — cards and the bottom bar. One clear step off the page.
- **Surface elevated** `#242424` — a block inside a card, a secondary button, a
  thumbnail well.
- **Surface selected** `#2A2A2A` — chips, and the resting state of anything
  selected.
- **Input** `#202020` — text fields and the search bar. Deliberately *darker*
  than a card: an input is a well you type into, not an object sitting on the
  page, and inverting that relationship is what makes a form read as a form.
- **Hover** `rgba(255,255,255,0.04)` / **Pressed** `rgba(255,255,255,0.07)` —
  layered *over* a surface, never replacing it.
- **Border** `rgba(255,255,255,0.05)` — dividers only. Barely visible on purpose.
  `borderStrong` `rgba(255,255,255,0.12)` marks a selected edge.

## 1.2 The accent

**PlayStation blue** `#0070CC`, and there is only one.

It appears on: selected navigation, primary buttons, active states, badges,
links, and the "See all" affordance. It appears nowhere else. The rule is
absolute because the accent only directs attention while it is rare — a screen
with six blue things has no primary action, it has six.

`primaryMuted` (blue at 16%) is the fill behind an *active* chip or badge. It is
the only tinted fill in the system.

`accent` is an alias of `primary` and holds the same `#0070CC`. It exists so that
score code can ask for "the meaningful neutral colour" without reaching for the
button colour by name.

## 1.3 Text

`#F5F5F5` primary, `#A8A8A8` secondary, `#767676` muted. Three steps, and
hierarchy within a block is expressed by moving between them before it is
expressed by changing size.

## 1.4 Colour usage

| Token              | Value                    | Usage                                        |
| ------------------ | ------------------------ | -------------------------------------------- |
| `background`       | `#121212`                | The page                                     |
| `surface`          | `#1C1C1C`                | Cards, tab bar                                |
| `surfaceElevated`  | `#242424`                | Nested block, secondary button, thumbnail well|
| `surfaceSelected`  | `#2A2A2A`                | Chips, selected resting state                 |
| `input`            | `#202020`                | Text fields, search bar                       |
| `text`             | `#F5F5F5`                | Titles, headings, primary copy                |
| `textSecondary`    | `#A8A8A8`                | Supporting copy                               |
| `textMuted`        | `#767676`                | Metadata, timestamps, counts                  |
| `primary`          | `#0070CC`                | Primary action, selected nav, links, badges   |
| `primaryMuted`     | `rgba(0,112,204,.16)`    | Active chip / badge fill                      |
| `border`           | `rgba(255,255,255,.05)`  | Dividers                                      |
| `borderStrong`     | `rgba(255,255,255,.12)`  | Selected edge, icon-button hairline           |
| `scrim`            | `rgba(0,0,0,.6)`         | Overlay on hero artwork                       |
| `platinum`         | `#A9B6CC`                | Platinum trophy marker                        |

## 1.5 Colour that carries meaning

Three colours mean something, and they are **data rather than chrome**:

- `success` `#4ADE80` — a positive verdict.
- `accent` `#0070CC` — a neutral verdict.
- `danger` `#EF4444` — a negative verdict, and destructive actions.

`scoreColor()` in `constants/score.ts` maps a 0-100 score's tone to exactly these
three. A score has to read as good, mixed or bad before the digits are parsed,
and one accent alone cannot say that.

A separate three-stop ramp — `scoreHigh` `#4ADE80`, `scoreMid` `#F5A524`,
`scoreLow` `#EF4444` — exists in the palette and is used by
`components/ui/surface.tsx`. See § 26: the app currently has two score colourings
and they disagree at the neutral band.

### The tier ramp

`tierS` `#FF7B7B` · `tierA` `#FFB068` · `tierB` `#FFD86B` · `tierC` `#B6E07A` ·
`tierD` `#7ACBE0` · `tierF` `#B0A6E0`

Six hues for the tier-list rows, and they take the same exemption as the score
ramp: a tier list is **a chart of the user's own judgement**, and six rows that
are all grey is not a tier list. The ramp runs warm-to-cool so the ordering reads
before the letters do.

They appear on a row's header fill and nowhere else — never on a control, a
button or a piece of chrome, and never as a text colour on a dark surface (they
are tuned as backgrounds for near-black type).

### Ink

`shadowInk` `#000000`. Pure black, and the palette's only one.

It is **not a surface** — `#121212` remains the floor and nothing is ever filled
with `shadowInk`. It exists solely as the far stop of a gradient ramp over
artwork, where a fade has to reach true black to sit under a photograph. `scrim`
`rgba(0,0,0,0.6)` is the flat overlay; `shadowInk` is the gradient ink. Fade it
with `withAlpha(shadowInk, 0)`, never the keyword `'transparent'`.

### Named rules

**The One Accent Rule.** Blue means "this, here, now". If a second thing on the
screen is blue, one of them is wrong.

**The Borrowed Colour Rule.** Every other hue on screen belongs to a game's
artwork. The interface supplies greyscale and one blue; the covers supply the
rest.

> **Case exception.** The per-platform case colours in § 4.1 (`#0D47A1`,
> `#107C10`, `#E60012`) are **not** UI accents and are exempt from the One Accent
> Rule. They are properties of a depicted physical object, the way a real PS5
> case is blue. They never appear on a control, a fill or a piece of chrome.

---

# 2. Typography

**Inter**, in four weights, and nothing else.

**Weight is a family, not a number.** React Native on Android will not
synthesise a bold from a custom font — `fontFamily: 'Inter_400Regular'` with
`fontWeight: '700'` silently renders regular, on one platform only. Every weight
is a separately loaded family (`FontFamily.regular` / `.medium` / `.semibold` /
`.bold`) and **nothing in the app sets `fontWeight` on text**.

Typography goes through `<Text variant="…">` from `components/ui/text`, never a
raw `<Text>`.

## 2.1 The scale

| Variant     | Size / line height | Weight | Tracking  | Used for                                    |
| ----------- | ------------------ | -----: | --------- | ------------------------------------------- |
| `display`   | 32 / 38            |    700 | -0.02em   | The app name on Home, a review's own title   |
| `h1`        | 28 / 34            |    700 | -0.015em  | Page titles. A game's name on its page       |
| `h2`        | 22 / 28            |    700 | -0.01em   | Major section headings                       |
| `h3`        | 18 / 24            |    700 | 0         | Card titles, a review's headline in a feed   |
| `h4`        | 16 / 22            |    700 | 0         | Sub-headings, a developer name               |
| `h5`        | 14 / 20            |    700 | 0         | A row's title, a username                    |
| `h6`        | 12 / 16            |    700 | 0.02em    | Smallest emphatic label                      |
| `body`      | 15 / 22            |    400 | 0         | UI copy. Synopses, descriptions, form text   |
| `prose`     | 17 / 28            |    400 | 0         | Long-form reading: an article or review body |
| `bodySmall` | 13 / 18            |    400 | 0         | Secondary copy                               |
| `caption`   | 11 / 15            |    400 | 0.02em    | Metadata, timestamps, counts                 |
| `label`     | 11 / 14            |    500 | 0.08em    | Uppercase section labels                     |
| `button`    | 14 / 20            |    600 | 0         | Every button label                           |

Tight tracking on the large steps and open tracking on the small ones is what
keeps a 32px title and an 11px label reading as the same system.

**`prose` is not `body`.** `body` is interface copy — it sits next to controls
and inside cards, where being compact is part of being legible. `prose` is for
the two screens someone actually *reads*: an article and a review. A paragraph
somebody wrote about a game deserves a longer measure and a looser leading than a
form label does, and squeezing it onto the UI step to save a token makes the app
worse at the one thing it exists for.

## 2.2 Observed hierarchy

```text
Page title       24–28 / bold
Section heading  11–13 / muted / uppercase
Game title       14–18 / semibold-bold
Metadata         12–14 / muted
Body copy        14–16
Navigation       12–14
```

The most important visual distinction is **weight + colour**, not large
font-size jumps.

### Named rules

**Hierarchy by weight and colour.** 400 carries prose, 500 the uppercase labels,
600 button text, 700 everything structural. To make something matter, move it up
a step or change its colour before reaching for anything else.

**Density is deliberate.** Medium-high density is the target, reached with chips,
spacing and alignment. The 11px caption and label steps exist for genuine
metadata — timestamps, counts, section labels — and are not a licence to shrink
reading copy to make a layout fit.

## 2.3 Case type — **PRESERVED**

The game case does **not** take the scale above. Two steps are pinned to the
values they rendered at before this scale was adopted, so the case's appearance
is unchanged:

| Variant       | Size / line height | Weight | Used for                              |
| ------------- | ------------------ | -----: | ------------------------------------- |
| `caseTitle`   | 24 / 30            |    700 | The lettered placeholder in the window |
| `caseEdition` | 12 / 16            |    500 | The "COLLECTOR'S EDITION" badge strip  |

These exist for the same reason as `caseImage` and `caseSpine` in § 5.3: they are
properties of a depicted physical object, not steps in a document hierarchy. Do
not use them anywhere else, and do not "tidy" them onto `h1`/`h6` — `h1` would
grow the placeholder letter by 4px, and `h6`'s bold weight widens the uppercase
badge enough to truncate it on the 108dp case.

> **Spine typography (§ 4.1.8) is not on any scale.** It is sized as a fraction
> of the case width — `width * 0.045` and `width * 0.038` — because it is printed
> on an object that scales, not laid out on a page. It needs no token.

---

# 3. Spacing & Layout

## 3.1 The ladder

**8-point spacing**, named for the value: `Spacing.x16` is sixteen pixels. The
ladder is fixed — 4, 8, 12, 16, 20, 24, 32, 40, 48 — and a gap that is not on it
is a bug rather than a decision.

- Outer page padding: **16**
- Card padding: **16**
- Between sections: **24**
- Scroll tails end in **48**

**One sanctioned exception: the hairline gap.** A `gap` of `1` or `2` between a
label and the value directly beneath it — a stat cell, a byline, a track row — is
allowed and is not a ladder violation. Those pairs are one object read as one
unit, and promoting them to `4` visibly loosens the dense rows the chip system
exists to keep tight. The exception covers `gap` and sub-4px `padding` inside a
badge or pill only. It is not a licence to invent a 6 or a 10 anywhere else.

## 3.2 Structure

Phone-first, single column, with a centred `MaxContentWidth` (800) cap so a
tablet or `react-native-web` stays readable without becoming a desktop layout.

```text
Screen
│
├── Floating transparent header + <HeaderBackdrop />
│
├── ScrollView
│   ├── section            (24 between)
│   ├── poster rail        (horizontal FlatList)
│   └── poster grid
│
└── Bottom tab bar: 68
```

**Heroes bleed.** A screen that opens on artwork — a game, a collection, a
review, the Top 10 — cancels its container's horizontal padding so the image
reaches both edges and runs under the transparent header.

## 3.3 Rails and grids

A horizontal rail is a `FlatList` with `horizontal`, a 12 gap, and the page's 16
padding applied as `contentContainerStyle` so the first poster aligns with the
text above it.

A grid is a `FlatList` with `numColumns`, gap 12–16, sized from
`useWindowDimensions()` rather than a fixed column count. There are no media
queries in React Native.

---

# 4. Poster Geometry

Movie and box artwork uses the standard **2:3 portrait ratio**, exported as
`PosterAspectRatio`.

```ts
aspectRatio: PosterAspectRatio,   // 2 / 3
```

Never stretched; always the true aspect ratio, cropped rather than distorted.
`<Poster />` falls back to `heroUrl` when a game has no cover, which is why chart
queries filter on `cover != null` rather than rendering placeholders.

Landscape key art uses `HeroAspectRatio` (16:9), and a full-bleed hero fills
`HeroHeightRatio` (0.38) of the display — see § 13.

Do **not** force a fixed pixel size on a poster. Set the aspect ratio and let the
rail or grid determine width.

---

# 4.1 Physical Game Case — **PRESERVED FEATURE**

> Carried over **verbatim in intent and value** from the previous design system
> and from the live implementation in
> [`src/components/game-case.tsx`](src/components/game-case.tsx) and
> [`src/constants/platform-cases.ts`](src/constants/platform-cases.ts).
> **Do not alter its logic or visual definition.** No rule elsewhere in this
> document overrides it.

The **physical case** is the app's signature object and the one thing allowed to
look expensive. It is a game rendered as a boxed copy you could have taken off a
shelf.

## 4.1.1 The Object Rule

**If it depicts a physical object, it may cast a shadow. If it is interface, it
may not.** There is no third case, and "this card feels flat" is not one — that
is what the surface step is for.

The only shadow tokens in the system that describe a real cast belong to the one
thing that genuinely casts: the **game case**, and the poster/disc it derives
from. Everything else uses the surface-step model in § 6.

## 4.1.2 Placement — where the case may appear

The case appears on:

* A game's own page (the masthead).
* The log form.
* A review masthead.
* Future collection / shelf screens.

It appears **nowhere else**. It must **never** appear in a feed, a review card, a
search result, a notification, a comment, a list tile, or any other social or
list context — those all use `<Poster />` or `<GameListItem />`.

The rule is intentional: social surfaces stay fast and flat; the case is what
makes opening a game page feel like picking something off a shelf. Diluting it
everywhere destroys that.

## 4.1.3 Platform eligibility — console only

```ts
type CasePlatformKey = 'ps5' | 'ps4' | 'xbox' | 'switch';
const CASE_PLATFORMS = ['ps5', 'ps4', 'xbox', 'switch'];
```

Console only, and that is the whole rule: a boxed copy is a real object you could
have put on a shelf. PC has been digital-first for a decade and mobile never had
a box at all, so rendering one there is a prop, not a memory — those platforms
show the bare cover art instead.

## 4.1.4 Dimensions

Every case template PNG is authored at a single size, so one ratio describes them
all:

```ts
CASE_TEMPLATE_SIZE = { width: 540, height: 680 }
```

Rendered width of the case face, in dp:

```ts
WIDTHS = { small: 108, medium: 168, large: 232 }
```

Height is always derived, never authored:

```ts
caseHeightFor(width) = (width / 540) * 680
```

A caller that knows the viewport passes a **measured width** instead of a named
size. The three named sizes are fixed dp, which on a 320pt phone made the large
case 73% of the screen width while the hero above it scaled freely — two elements
in the same composition disagreeing about how big the screen is. Height excludes
the spine, which extends sideways rather than down.

All internal offsets derive from a single scale factor:

```ts
scale = renderedWidth / templateSize.width
```

## 4.1.5 Per-platform template geometry & materials

`coverArea` is the transparent window in the template PNG, in template pixels.
`spineWidth` is in template pixels and scales with the case.

| Platform | Spine label | coverArea (x, y, w, h) | spineWidth | spineColor | spineTextColor | accent    |
| -------- | ----------- | ---------------------- | ---------: | ---------- | -------------- | --------- |
| `ps5`    | `PS5`       | 16, 58, 508, 606       |         26 | `#0D47A1`  | `#FFFFFF`      | `#1565C0` |
| `ps4`    | `PS4`       | 16, 52, 508, 612       |         26 | `#0D47A1`  | `#FFFFFF`      | `#1565C0` |
| `xbox`   | `XBOX`      | 14, 62, 512, 604       |         24 | `#107C10`  | `#FFFFFF`      | `#107C10` |
| `switch` | `SWITCH`    | 14, 46, 512, 620       |         22 | `#E60012`  | `#FFFFFF`      | `#E60012` |

**Template contract.** A template is a PNG of the case's front face: opaque
chrome (border, top band, branding) with the cover window punched out as
transparent pixels. Artwork is drawn *beneath* the template and shows through
that window, which is why `coverArea` is never hardcoded in the component.
Swapping artwork is free provided you:

* keep `templateSize` accurate for the new file,
* keep `coverArea` describing the transparent window, in template pixels,
* keep the window genuinely transparent (alpha 0), not white.

## 4.1.6 Layering

Bottom to top, exactly five layers:

```text
1. drop shadow      — on the outer wrapper, so it follows the whole object
2. spine slab       — offset behind and to the left of the face
3. cover artwork    — positioned into the template's transparent window
4. platform template PNG
5. soft diagonal gloss
```

## 4.1.7 Materials

**Drop shadow** — applied to the object wrapper so it wraps face and spine as one:

```ts
shadowColor: '#000',
shadowOpacity: 0.45,
shadowRadius: 18,
shadowOffset: { width: 6, height: 12 },
elevation: 12,
```

**Gloss** — a narrow diagonal sheen across the plastic. Low opacity on purpose:
the brief asks for subtle, not a lens flare.

```ts
colors: ['rgba(255,255,255,0.20)', 'rgba(255,255,255,0.04)', 'rgba(255,255,255,0)'],
start: { x: 0, y: 0 },
end:   { x: 0.9, y: 0.55 },
```

**Perspective / tilt** — a slight 3D turn. `0` renders flat-on. Exposed as a prop
rather than fixed so a future "rotate the case" animation can drive it from a
shared value.

```ts
transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }]   // tilt defaults to 6
```

**Spine radius** — `3` on the top-left and bottom-left corners only, with
`overflow: 'hidden'`.

**Cover window** — `overflow: 'hidden'`, backed by `surfaceElevated` before the
image resolves, artwork drawn with `contentFit="cover"`. Cover crops rather than
distorts, because the window is rarely the same aspect ratio as the artwork.

## 4.1.8 Spine typography

The spine text row is rotated `90deg` so the title reads bottom-to-top, the way a
shelved case does. The row is laid out at a width equal to the case **height**,
because it is measured pre-rotation.

```ts
spineTitle: { fontSize: Math.max(7, width * 0.045), fontFamily: FontFamily.semibold, flexShrink: 1 }
spineBrand: { fontSize: Math.max(6, width * 0.038), fontFamily: FontFamily.bold, opacity: 0.85, letterSpacing: 0.5 }
paddingHorizontal: Spacing.x8
justifyContent: 'space-between'
```

The title is `numberOfLines={1}`.

## 4.1.9 Edition badge

An optional band across the bottom of the face — "Collector's Edition", "Deluxe".

```ts
position: 'absolute', left: 0, right: 0, bottom: 0,
backgroundColor: theme.scrim,
paddingVertical: Spacing.x4,
alignItems: 'center',
// text: variant="micro", uppercase, #FFFFFF, letterSpacing 1, numberOfLines 1
```

## 4.1.10 Cover artwork rules

* Artwork is **never stretched**. True aspect ratio always: portrait **2:3**.
* `caseImage` is **12** for the cover art inside the case window. This is the
  case's own radius and is deliberately larger than `Radius.image` (§ 5.3).
* Fallback order for a case's artwork: `coverUrl` → `heroUrl` → lettered
  placeholder (first character of the title, `textMuted`, on `surfaceElevated`).

## 4.1.11 The optical disc

The case's companion object, sharing the same Object Rule.

```ts
DISC_TEMPLATE = { size: 512, artRadius: 248, hubRadius: 78 }
```

Artwork is masked to the `artRadius` circle, centred, matching the template's
annulus. The centre hole is punched out by the template inside `hubRadius`.

## 4.1.12 Case rules — do / don't

* **Do** derive every case offset from the template metadata and the single scale
  factor. Nothing about the geometry belongs in a call site.
* **Do** pass a measured width when the caller knows the viewport.
* **Do** let the case cast — it is the one thing in the system that may.
* **Don't** put the case in a feed, a search result, a notification, a comment or
  a list tile.
* **Don't** render a case for PC, iOS or Android.
* **Don't** stretch cover art. 2:3, always, cropped rather than distorted.
* **Don't** hardcode `coverArea`, `spineWidth` or the template size in a component.
* **Don't** raise the gloss opacity. It is subtle by specification.

---

# 5. Shapes & Radius

The UI is deliberately **not highly rounded**. Small radii keep the artwork the
roundest thing on screen.

## 5.1 The scale

| Token  | Value |
| ------ | ----: |
| `none` |     0 |
| `xs`   |     2 |
| `sm`   |     3 |
| `md`   |     5 |
| `lg`   |     8 |
| `pill` |   999 |

## 5.2 Role aliases

Named for **what they wrap**, not for how big they are — that is what stops
`card` drifting onto a button the way `large` could.

| Alias            | Value | Wraps                                              |
| ---------------- | ----: | -------------------------------------------------- |
| `Radius.image`   |     4 | Covers, screenshots, thumbnails (3–5 acceptable)    |
| `Radius.control` |     6 | Every button and icon button (4–6 acceptable)       |
| `Radius.card`    |     6 | Cards and modular surfaces (4–6 acceptable)         |
| `Radius.input`   |     6 | Text fields and the search bar                      |
| `Radius.pill`    |   999 | Chips, badges, progress tracks, avatar rings        |

Avatars are circles. A circular icon button or FAB is `50%`, not a token.

`Radius.pill` is reserved for progress tracks, badges, avatar rings and `<Chip>`.
A chip staying a pill is deliberate: shape is the only thing left distinguishing
metadata from a control.

Do not reach for 12–20px "soft UI" corners. At this scale roundness reads as
padding, and the app is dense.

## 5.3 Case exception — **PRESERVED**

The game case does **not** take the scale above. Its radii are properties of a
depicted object and are fixed by § 4.1:

| Token             | Value | Wraps                                        |
| ----------------- | ----: | --------------------------------------------- |
| `caseImage`       |    12 | Cover artwork inside the case window          |
| `caseSpine`       |     3 | Left corners of the case spine (§ 4.1.7)      |

Do not fold `caseImage` into `Radius.image`. They were the same value under the
previous system and are not under this one.

**`caseImage` also covers the PC/mobile framed cover.** When a game has no case
(§ 4.1.3), `game-case-display.tsx` renders the bare cover inside a hairline frame
at `caseImage + 1`. That frame is part of the same feature — it is what stops a
2:3 crop of dark key art dissolving into a near-black page, and it is deliberately
tuned to seat the cover without imitating the case's physicality. It takes
`caseImage`, not `Radius.image`.

---

# 6. Elevation

**Depth is a surface step and a shadow, working together.**

`background` → `surface` → `surfaceElevated` → `surfaceSelected` still does most
of the work: a card reads as lifted mainly because it is lighter than the page.
The shadow is what turns that from *painted on* into *sitting above*. Neither
alone is enough on a near-black screen — the step has no edge, and a shadow
against `#121212` has almost nothing to darken.

## 6.1 The interface scale

Four tiers. Every interactive or grouping element sits on one of them; nothing
that a user can touch should be flat.

| Tier      | Opacity | Radius | Offset Y | Android | Used for                                    |
| --------- | ------: | -----: | -------: | ------: | ------------------------------------------- |
| `none`    |       — |      — |        — |       — | Text, dividers, things inside a lifted block |
| `card`    |    0.20 |      6 |        2 |       2 | A block resting on the page                  |
| `control` |    0.24 |      8 |        3 |       3 | Buttons, icon buttons, chips, inputs         |
| `raised`  |    0.30 |     12 |        5 |       6 | Pressed, active, or floating above siblings  |
| `overlay` |    0.38 |     16 |        8 |      10 | Dock, popovers, sheets, modals               |

All four use `shadowInk` and a **zero horizontal offset** — light comes from
straight above. The lift comes from a tight radius and a short offset, not from
opacity: a large soft shadow on this background does not read as height, it
reads as a grey smudge.

## 6.2 The Object Rule — now a ceiling, not a ban

The rule used to be *interface may not cast at all*. It is now:

> **Interface may cast, but never as much as a depicted object.**

The **physical game case** (§ 4.1) sits above the whole scale — opacity `0.45`,
radius `18`, offset `(6, 12)`, elevation `12`. It is strictly larger than
`overlay` in opacity, radius and vertical offset, and it is the **only** shadow
in the app with a horizontal component, so it alone looks lit from an angle
rather than from directly overhead.

That gap is load-bearing. The case is the one thing in the app depicting a real
object you could pick up, and it stays special only while nothing else casts as
hard. **No interface tier may be raised past `overlay`.** If something needs to
feel heavier than that, it needs a different design, not a bigger shadow.

## 6.3 Android

`elevation` is the only shadow Android honours, and it needs an opaque
`backgroundColor` on the same view to render at all. It is also **clipped by
`overflow: 'hidden'`** — a very common combination on artwork, which rounds its
corners by clipping. Where both are needed, split them: an outer view carries
the elevation and the background, an inner view does the clipping. `<Poster>` is
the worked example.

---

# 7. Header

The stack header **floats**. `headerTransparent` plus `<HeaderBackdrop />` is set
once in `app/_layout.tsx`, never per screen. It draws a page-coloured ramp for
legibility and a short black tail as the shadow, because a transparent view
cannot cast one.

Screens leading with artwork (game, collection, review, profile, Top 10) let
content run underneath. Every other screen passes `<Screen insetHeader>` to
reserve the space. Modals opt out entirely.

Page title: `h1` variant, 28 / 34, bold.

---

# 8. Bottom Navigation

Five tabs, maximum: home, search, create, notifications, profile.

```ts
backgroundColor: theme.surface,   // #1C1C1C
height: 68,
// no top border
```

Icons above labels — labels shown, not hidden, because an icon-only bar asks
every new user to guess what a newspaper glyph leads to, and five words cost
14px. Selected is `primary` on both glyph and label; unselected is `textMuted`.

Five is the ceiling. A sixth destination means something belongs one level down.

---

# 9. Buttons & Controls

Three styles, all filled, **no outlines**.

- **Primary** — filled `primary`, `onPrimary` label. At most one per screen.
- **Secondary** — filled `surfaceElevated`. The default.
- **Ghost** — no fill. For an action that must not draw the eye.
- **Danger** — secondary's shape with a `danger` label. Deliberately not a red
  slab: a filled red button is the loudest thing a dark screen can show, and
  deleting a collection does not warrant outshouting the artwork beside it.

46 tall (40 when small) so the tap target clears 44 without padding tricks.
`Radius.control`.

An outline is a fourth signal in a system that already separates by surface step,
and a screen of outlined rectangles reads as a form.

`<IconButton>` is the one exception: 44 square, `surfaceElevated`, with a
`StyleSheet.hairlineWidth` edge in `border` — or `danger` at 33% for a
destructive glyph. The `plain` tone drops both fill and outline, for clusters
like up/down/remove where a second outline around each glyph would turn a row of
controls into a grid.

### Selection is one step lighter, never a colour

Any control with an on/off state goes `surfaceElevated` → `surfaceSelected` for
the fill, `border` → `borderStrong` for the edge, and `textSecondary` /
`textMuted` → `text` for the label. `<SortBar>`, the search mode switch, tag
pickers and RSVP buttons all follow it; a new one should too.

---

# 10. Search Bar

56 tall, `Radius.input`, filled `input`, magnifier leading, placeholder
vertically centred. It is the primary control on the screen it appears on and it
is sized to say so.

---

# 11. Cards

Filled `surface`, `Radius.card` (6), 16 padding, **no border and no shadow**.
The card is the app's basic unit and it should feel modular — a thing you could
pick up and move somewhere else. `elevated` puts it on `surfaceElevated`, for a
card that sits on another card.

---

# 12. Chips

The metadata capsule, and the main reason this app is dense without being
cramped: `📅 Played` · `⏱ 45h` · `🏁 Completed` · `🎮 Main Story`. Six facts in
two rows of chips are scannable in a way six lines of small grey text are not.

34 tall, 14 horizontal padding, `Radius.pill`, on `surfaceSelected`. Active chips
take `primaryMuted` with `primary` text.

Chips are **not** buttons. The fully-round shape is what says so — every real
control is a 6px rounded rectangle.

---

# 13. Hero Image Treatment

A full-bleed hero fills `HeroHeightRatio` (0.38) of the display, sized against
the screen rather than the art's own 16:9. On a tall phone a strict 16:9 is a
26%-high band — a banner above the content rather than a backdrop behind it. At
38% the art carries the top of the screen the way it does on a store page.

The trade is a centre crop: a 16:9 source shown at ~1.2:1 loses its outer thirds.
Key art is composed centrally, and `heroHeightFor` never returns less than the
untouched 16:9 height, so wide displays keep the whole frame.

The hero ramps into the page beneath it with a `LinearGradient` — and every
gradient stop ends on `withAlpha(colour, 0)`, **never** the keyword
`'transparent'`. `expo-linear-gradient` interpolates through black on Android and
leaves a grey bruise mid-ramp.

---

# 14. Game Page

The masthead: full-bleed hero art with a heavy blur ramp, the **physical case**
(§ 4.1) overlapping it on the left, and the game's identity — title, price,
release date, developer, publisher, platform buttons — on the right. Actions run
full width beneath both columns. Soundtrack, achievements, cast, franchise and
screenshots follow in tabs.

```text
┌──────────────────────────────────────────┐
│               HERO (0.38h)               │
│  ┌──────┐                                │
│  │ CASE │   TITLE                        │
│  │      │   metadata · developer         │
│  └──────┘   platform buttons             │
├──────────────────────────────────────────┤
│  actions (full width)                    │
├──────────────────────────────────────────┤
│  synopsis                                │
├──────────────────────────────────────────┤
│  score + verdict                         │
├──────────────────────────────────────────┤
│  tabs: soundtrack / achievements / …     │
└──────────────────────────────────────────┘
```

---

# 15. Score Display

**The score is a bare coloured numeral.** No box, no outline, no fill. Digits in a
bordered capsule read as a button, and at feed sizes the container was
consistently bigger than the number inside it.

```text
inline  15
medium  22
large   32
hero    44
```

Always 700 weight. Colour comes from `scoreColor()` — `success` / `accent` /
`danger` by tone (§ 1.5). The verdict label ("Excellent", "Mixed") sits beside it
in the same colour.

Ratings are an integer 0-100 on `logs.rating`, and that is the only score
anything reads.

---

# 16. Review Card

The structure, top to bottom:

```text
avatar   username                              timestamp
"The review's headline"
82  Halo Infinite   PLAYED  GREAT              ┌────────┐
                                               │ cover  │
Three or four lines of what they actually      │  2:3   │
wrote before it truncates…                     └────────┘
♥  12  💬 4  ↗
```

- The top line is the **review's headline**, never the game's name. The game is
  named in the verdict row below it.
- A review requires **both** a headline and a body. The log form enforces both or
  neither: half a review has nowhere to render.
- Review text truncates at 3–4 lines.
- Box art is 2:3, `Radius.image` (4), and is the tallest object in the card.

Hierarchy, fixed and in this order: **game → rating → review → completion →
playtime → interactions**. Nothing competes equally.

> A review **card** never contains a game case (§ 4.1.2). A review **masthead**
> may.

---

# 17. Section Headers

Section headings are small and quiet, not large. A band label — "Latest
releases", "Popular this month", "News" — is `caption` (11 / 15) or `bodySmall`
(13 / 18) in `textMuted`, **not** a heading step.

Metadata-style labels above dense content use `label` — 11 / 14, medium,
`textMuted`, uppercase, 0.08em tracking.

Do **not** promote a band label to `h1`/`h2`, and do not make it 18–20px. A page
has one page title, and the posters underneath carry the weight.

---

# 18. Home

Not a feed. A stack of independently-sourced bands, each answering one question:
popular this month, from people you follow, news, latest releases, coming soon,
fresh collections, newest reviews. Every band is its own query with its own
ranking and its own failure — a dead RSS feed removes one section and leaves the
page working.

This is the **foundation for recommendations, not the recommender**. Adding a
personalised band means adding a band, not unpicking a merged timeline.

---

# 19. Three ways to show a game

Not interchangeable:

- **`<GameCase />`** — a game's own page, the log form, a review masthead,
  collection/shelf screens. See § 4.1.
- **`<GameListItem />`** — a row that needs a surface behind it: search results,
  feeds.
- **`<CoverTile />`** — a grid where the artwork *is* the screen: the Top 10, the
  News chart. A CoverTile has no card, no pill and no badge on purpose — wrapping
  covers in the app's rounded containers turns a wall of art into a list of
  buttons with pictures on them.

---

# 20. Iconography

**Ionicons**, from `@expo/vector-icons`. Not Lucide — there is no DOM here.

```ts
xs: 12,  sm: 16,  md: 20,  lg: 24,  xl: 32
```

Outlined rather than filled. `icon` colour by default is `text` or
`textSecondary`; `primary` only for an active or positive state.

Preload the family in the root layout with `useFonts(Ionicons.font)` and hold the
splash screen — `createIconSet`'s `componentDidMount` otherwise fires one
unhandled font request per mounted icon.

---

# 21. Image Treatment

Artwork is **content**, not UI decoration.

```ts
contentFit: 'cover'
```

Never apply a brightness or saturation filter to a cover. For hero photography a
`scrim` overlay is appropriate so text stays legible on any cover.

Never stretch a hero into a poster slot — that is what `<Poster />`'s fallback is
for.

> The **case gloss** (§ 4.1.7) is not a filter on artwork — it is a sheen on the
> plastic, drawn as a separate layer above the template. It stays.

---

# 22. Motion

Subtle, short, ease-out.

```ts
fast: 150,  normal: 200,  slow: 300,  pressScale: 0.98
```

- Press: scale to **0.98** via `<PressableScale>`.
- Cards and transitions: **150–200ms**.
- Navigation: fade + scale.
- Loading: **skeleton placeholders**, never spinners unless unavoidable.

A spinner says "wait"; a skeleton says "here is what is coming". Prefer the
second every time.

Reanimated shared values use `.get()` / `.set()`, never `.value =` — the React
Compiler rules flag assignment to `.value` as mutating a captured binding.

> The case's `rotateY` tilt is a **static property of the object**, not a hover
> animation, and is exempt from the press-scale convention.

---

# 23. Interaction

Every tap target is at least **44×44** (`TapTarget`). No exceptions and no tiny
buttons — where a control looks smaller, padding is doing the work.

There is no hover on a phone. `hover` and `pressed` are overlays layered *over* a
surface, never replacing it.

Lists scroll with momentum. Cards are touch-friendly. Scanning is the priority: a
user should understand a card without reading it.

---

# 24. Layout Hierarchy Rules

Visual hierarchy follows this priority:

```text
1. Artwork — the game case, or the hero
2. Game title
3. Primary action / score
4. User / developer
5. Metadata
6. Supporting description
7. Section labels
```

Use contrast in this order:

```text
#F5F5F5  →  #A8A8A8  →  #767676
```

Do not use multiple bright colours for hierarchy. The interface should remain
overwhelmingly:

```text
dark neutral + near-white + muted grey + one blue
```

Platform case colours are part of the depicted object, not the interface palette
(§ 1.5).

---

# 25. Do's and Don'ts

### Do

- **Do** separate surfaces with a tonal step before reaching for anything else.
- **Do** put metadata in chips. It is how the app stays dense and calm at once.
- **Do** keep the accent rare enough to mean something.
- **Do** use skeletons for every loading state.
- **Do** name spacing and radii from the tokens — `Spacing.x16`, `Radius.card`.
- **Do** end scroll containers with 48 of bottom padding.
- **Do** read colours through `useTheme()`, never a hardcoded hex in a component.
- **Do** use `withAlpha(colour, 0)` as a gradient's transparent stop, never the
  keyword `transparent`.

### Don't

- **Don't** use true black, gradients (outside artwork fades), glassmorphism,
  neumorphism, skeuomorphism or glow. Any of them dates the app instantly.
- **Don't** give interface a drop shadow. Only depicted objects cast.
- **Don't** outline a button. Fills and surface steps already separate them.
- **Don't** introduce a second accent colour.
- **Don't** set `fontWeight` on text — Inter's weights are separate families and
  `fontWeight` is silently ignored on Android.
- **Don't** shrink type to fit more in. Use chips, spacing and alignment.
- **Don't** put the game case in a feed, a search result or a list tile.
- **Don't** stretch cover art. 2:3, always, cropped rather than distorted.
- **Don't** add a sixth bottom-nav tab.
- **Don't** reach for web idioms — no `className`, no Tailwind, no CSS files.

---

# 26. Platform Reality & Known Deltas

## 26.1 This is React Native, not a web app

Worth restating in a design document because component snippets and design specs
found online almost always assume the opposite. There is **no DOM, no Tailwind,
no NativeWind and no shadcn** here. `src/global.css` defines four font variables
for `react-native-web` and nothing else — it is not a stylesheet.

| Web | Here |
|---|---|
| `<div>`, `<span>`, `<button>` | `<View>`, `<Text>`, `<Pressable>` |
| `className` + `clsx` | `StyleSheet.create` + `useTheme()` |
| CSS custom properties | `constants/theme.ts` tokens |
| media queries | `useWindowDimensions()` |
| `motion/react` | `react-native-reanimated` |
| `backdrop-blur` | `expo-blur`'s `<BlurView>` |
| `lucide-react` | `@expo/vector-icons`' Ionicons |
| `:hover`, `focus-visible` | press states; there is no hover on a phone |
| `box-shadow` | `shadow*` on iOS + `elevation` on Android |

Every value in this document is **dp**, not CSS px.

## 26.2 State of the code

**The frontmatter mirrors `src/constants/theme.ts`.** Colour, typography, radius,
spacing, motion and the score sizes all match. This document is descriptive, not
aspirational — if the two drift, one of them is a bug.

### What the migration changed

Recorded so the diff is explicable a year from now.

| Was | Became | Note |
|---|---|---|
| `title` 24/30 | `h1` 28/34 | Page titles grew |
| `heading` 18/24 semibold | `h3` 18/24 bold | Weight only |
| `section` 16/22 semibold | `h4` 16/22 bold | Weight only |
| `bodyStrong` 15/22 semibold | `h5` 14/20 bold | 52 sites |
| `caption` 13/18 medium | `bodySmall` 13/18 regular | Weight only, 82 sites |
| `micro` 12/16 medium | `caption` 11/15 regular | **147 sites — the largest change** |
| `body` 15/23 | `body` 15/22 | Leading only |
| — | `h2`, `h6`, `label`, `button`, `prose` | New steps |
| `Radius.image` 12 | 4 | |
| `Radius.control` 18 | 6 | |
| `Radius.card` 20 | 6 | |
| `Radius.input` 24 | 6 | |

`micro` did not map wholesale: uppercase section headings were promoted to
`label` rather than demoted to `caption`. `prose` was added rather than folding
article and review bodies onto `body` — see § 2.1.

Two platform facts survived untouched: **weight is a loaded family**, never a
`fontWeight` (Android silently ignores it), and text goes through
`<Text variant="…">`, never a raw `<Text>`.

### The case came through unchanged

Four lines were touched across the protected files, all of them identifier swaps
that render identically: `game-case.tsx` moved to `caseTitle`/`caseEdition`, and
`game-case-display.tsx` moved to `Radius.caseImage`. `platform-cases.ts`,
`game-disc.tsx` and `assets/cases/` were not touched at all.

Under the previous scale `Radius.image` and the case's cover radius were the same
number. They are separate tokens now for exactly that reason — a find-and-replace
on `12` would have silently redesigned the case.

### Remaining deltas

| # | Delta | Status |
|---|---|---|
| 1 | Two score colourings coexist. `scoreColor()` in `constants/score.ts` returns `success` / `accent` / `danger`; `components/ui/surface.tsx` uses the `scoreHigh` / `scoreMid` / `scoreLow` ramp. They disagree at the neutral band — blue vs amber `#F5A524`. | **Unresolved. Pick one.** |
| 2 | Colour was evaluated against a Letterboxd-style alternate (`#14181C` background, `#00E054` accent) and **rejected**; the palette stays PlayStation blue on `#121212`. Typography and radius from that same spec were **adopted**. | Decided. |
| 3 | `MaxContentWidth` is 800 and the layout is phone-first single-column. There is no desktop grid. | By design. |
| 4 | Component geometry — 46 buttons, 34 chips, 56 search bar, 68 tab bar, 44 tap target — was outside the migration and still describes shipped code. | Current. |
| 5 | `game-disc.tsx` is protected, so its stray colour literals and its two bare `'transparent'` gradient stops were left alone. Those stops are the Android black-bruise bug this document warns about in § 1.5. | Knowingly deferred. |
| 6 | Regenerate `.impeccable/design.json` after any frontmatter change. No hook enforces it. | Manual. |
