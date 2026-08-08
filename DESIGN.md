---
name: GameLog
description: A premium, calm, information-dense gaming social platform. Dark, greyscale, one blue accent, and a lot of games.
scheme: dark-only
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
  text: "#F5F5F5"
  textSecondary: "#A8A8A8"
  textMuted: "#767676"
  scoreHigh: "#4ADE80"
  scoreMid: "#F5A524"
  scoreLow: "#EF4444"
  platinum: "#A9B6CC"
typography:
  display:
    fontFamily: "Inter"
    fontSize: "32px"
    fontWeight: 700
    lineHeight: "40px"
  title:
    fontFamily: "Inter"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "30px"
  heading:
    fontFamily: "Inter"
    fontSize: "18px"
    fontWeight: 600
    lineHeight: "24px"
  section:
    fontFamily: "Inter"
    fontSize: "16px"
    fontWeight: 600
    lineHeight: "22px"
  body:
    fontFamily: "Inter"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: "23px"
  bodyStrong:
    fontFamily: "Inter"
    fontSize: "15px"
    fontWeight: 600
    lineHeight: "22px"
  caption:
    fontFamily: "Inter"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
  micro:
    fontFamily: "Inter"
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
  image: "12px"
  control: "18px"
  card: "20px"
  input: "24px"
  pill: "999px"
motion:
  fast: "150ms"
  normal: "200ms"
  slow: "300ms"
  easing: "ease-out"
  pressScale: 0.98
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
  button-secondary:
    backgroundColor: "{colors.surfaceElevated}"
    textColor: "{colors.text}"
    rounded: "{rounded.control}"
    padding: "12px 20px"
    height: "46px"
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
    selectedColor: "{colors.primary}"
    unselectedColor: "{colors.textMuted}"
  score:
    display: "bare numeral, verdict colour"
    typography: "700"
    sizes: "inline 15 / medium 22 / large 32 / hero 44"
---

# Design System: GameLog

## Overview

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

## Colours

### The room

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

### The accent

**PlayStation blue** `#0070CC`, and there is only one.

It appears on: selected navigation, primary buttons, active states, badges,
links, and the "See all" affordance. It appears nowhere else. The rule is
absolute because the accent only directs attention while it is rare — a screen
with six blue things has no primary action, it has six.

`primaryMuted` (blue at 16%) is the fill behind an *active* chip or badge. It is
the only tinted fill in the system.

### Text

`#F5F5F5` primary, `#A8A8A8` secondary, `#767676` muted. Three steps, and
hierarchy within a block is expressed by moving between them before it is
expressed by changing size.

### The score ramp

`scoreHigh` `#4ADE80` · `scoreMid` `#F5A524` · `scoreLow` `#EF4444`

The one exception to the single-accent rule, and it earns the exemption by being
**data rather than chrome**. A 0-100 score has to read as good, mixed or bad
before the digits are parsed, and blue cannot say that. The ramp appears on
numerals and their verdict labels — never on a fill, an outline or a control.

### Named rules

**The One Accent Rule.** Blue means "this, here, now". If a second thing on the
screen is blue, one of them is wrong.

**The Borrowed Colour Rule.** Every other hue on screen belongs to a game's
artwork. The interface supplies greyscale and one blue; the covers supply the
rest.

## Typography

**Inter**, in four weights, and nothing else.

**Weight is a family, not a number.** React Native on Android will not
synthesise a bold from a custom font — `fontFamily: 'Inter_400Regular'` with
`fontWeight: '700'` silently renders regular, on one platform only. Every weight
is a separately loaded family (`FontFamily.regular` / `.medium` / `.semibold` /
`.bold`) and **nothing in the app sets `fontWeight` on text**.

### Hierarchy

- **display** (700, 32/40) — the app name on Home, a review's own title.
- **title** (700, 24/30) — page titles. A game's name on its page.
- **heading** (600, 18/24) — card titles, a review's headline in a feed.
- **section** (600, 16/22) — section headings: "Latest releases", "News".
- **body** (400, 15/23) — reading copy. Review text, synopses.
- **bodyStrong** (600, 15/22) — a row's title, a button's label, a username.
- **caption** (500, 13/18) — metadata, timestamps, counts.
- **micro** (500, 12/16) — small labels, usually in caps.

Line heights are generous relative to size — 23 on 15 for body — because the
thing being read is usually a paragraph somebody wrote about a game.

### Named rules

**The Three Weights Rule.** 400 for prose, 500 for dense metadata, 600 for
anything that must be picked out of a page. 700 belongs to `display`, `title`
and a score — nothing else. To make something matter, go up a step or change its
colour; do not reach for a heavier weight.

**Density Without Shrinking.** Medium-high density is the target, and it is
reached with chips, spacing and alignment. Never by reducing type size. If a
layout only fits at 11px, the layout is wrong.

## Layout

**8-point spacing**, named for the value: `Spacing.x16` is sixteen pixels. The
ladder is fixed — 4, 8, 12, 16, 20, 24, 32, 40, 48 — and a gap that is not on it
is a bug rather than a decision.

- Outer page padding: **16**
- Card padding: **16**
- Between sections: **24**
- Scroll tails end in **48**

Phone-first, single column, with a centred `MaxContentWidth` (800px) cap so a
tablet or `react-native-web` stays readable without becoming a desktop layout.

**Heroes bleed.** A screen that opens on artwork — a game, a collection, a
review, the Top 10 — cancels its container's horizontal padding so the image
reaches both edges and runs under the transparent header.

## Elevation

**There are no interface shadows.**

Depth is `background` → `surface` → `surfaceElevated` → `surfaceSelected`. A card
looks lifted because it is lighter than what is behind it, and on a dark screen
that reads far better than a shadow nobody can see against `#121212`.

The two shadow tokens that remain are for the one thing that genuinely casts: a
**depicted physical object** — the game case, and the poster it derives from.

**The Object Rule.** If it depicts a physical object, it may cast a shadow. If it
is interface, it may not. There is no third case, and "this card feels flat" is
not one — that is what the surface step is for.

## Shapes

Four primitives and a pill. Everything in the app is one of them.

- **image** (12px) — game covers, screenshots, thumbnails. Never stretched;
  always the true aspect ratio, portrait 2:3 for covers.
- **control** (18px) — every button and icon button.
- **card** (20px) — cards and modular surfaces.
- **input** (24px) — text fields and the search bar.
- **pill** (999px) — chips, badges, progress tracks. Avatars are circles.

Radii are named for **what they wrap**, not for how big they are. That is what
keeps them in place: `Radius.card` cannot drift onto a button the way `large`
could.

## Components

### Cards

Filled `surface`, 20px corners, 16px padding, **no border and no shadow**. The
card is the app's basic unit and it should feel modular — a thing you could pick
up and move somewhere else. `elevated` puts it on `surfaceElevated`, for a card
that sits on another card.

### Chips

The metadata capsule, and the main reason this app is dense without being
cramped: `📅 Played` · `⏱ 45h` · `🏁 Completed` · `🎮 Main Story`. Six facts in
two rows of chips are scannable in a way six lines of small grey text are not.

34px tall, 14px horizontal padding, fully rounded, on `surfaceSelected`. Active
chips take `primaryMuted` with blue text.

Chips are **not** buttons. The fully-round shape is what says so — every real
control is an 18px rounded rectangle.

### Buttons

Three styles, all filled, **no outlines**.

- **Primary** — filled accent blue, white label. At most one per screen.
- **Secondary** — filled `surfaceElevated`. The default.
- **Ghost** — no fill. For an action that must not draw the eye.
- **Danger** — secondary's shape with a red label. Deliberately not a red slab:
  a filled red button is the loudest thing a dark screen can show, and deleting
  a collection does not warrant outshouting the artwork beside it.

46px tall (40 when small) so the tap target clears 44 without padding tricks.

### Search bar

56px tall, `Radius.input`, filled `input`, magnifier on the left, placeholder
vertically centred. It is the primary control on the screen it appears on and it
is sized to say so.

### Bottom navigation

Five tabs, maximum. Icons above labels — labels shown, not hidden, because an
icon-only bar asks every new user to guess what a newspaper glyph leads to, and
five words cost 14px. Selected is blue on both glyph and label; unselected is
`textMuted`. `surface`, no top border, 68px.

Five is the ceiling. A sixth destination means something belongs one level down.

### Review card

The structure, top to bottom:

```
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
- A review requires **both** a headline and a body. The log form enforces both
  or neither: half a review has nowhere to render.
- **The score is a bare coloured numeral at body size.** No box, no outline, no
  fill. Digits in a bordered capsule read as a button, and at feed sizes the
  container was consistently bigger than the number inside it.
- Review text truncates at 3–4 lines.
- Box art is 2:3, `image` radius, and is the tallest object in the card.

Hierarchy, fixed and in this order: **game → rating → review → completion →
playtime → interactions**. Nothing competes equally.

### Game page

The masthead is unchanged and stays that way: full-bleed hero art with a heavy
blur ramp, the physical case overlapping it on the left, and the game's identity
— title, price, release date, developer, publisher, platform buttons — on the
right. Actions run full width beneath both columns. Soundtrack, achievements,
cast, franchise and screenshots follow in tabs.

The **physical case** is the app's signature object and the one thing allowed to
look expensive. It appears on a game's own page, the log form and a review
masthead — never in a feed, a search result or a list.

### Home

Not a feed. A stack of independently-sourced bands, each answering one question:
popular this month, from people you follow, news, latest releases, coming soon,
fresh collections, newest reviews. Every band is its own query with its own
ranking and its own failure — a dead RSS feed removes one section and leaves the
page working.

This is the **foundation for recommendations, not the recommender**. Adding a
personalised band means adding a band, not unpicking a merged timeline.

## Motion

Subtle, short, ease-out.

- Press: scale to **0.98**
- Cards and transitions: **150–200ms**
- Navigation: fade + scale
- Loading: **skeleton placeholders**, never spinners unless unavoidable

A spinner says "wait"; a skeleton says "here is what is coming". Prefer the
second every time.

## Interaction

Every tap target is at least **44×44**. No exceptions and no tiny buttons — where
a control looks smaller, padding is doing the work.

Lists scroll with momentum. Cards are touch-friendly. Scanning is the priority:
a user should understand a card without reading it.

## Do's and Don'ts

### Do

- **Do** separate surfaces with a tonal step before reaching for anything else.
- **Do** put metadata in chips. It is how the app stays dense and calm at once.
- **Do** keep the accent rare enough to mean something.
- **Do** use skeletons for every loading state.
- **Do** name spacing and radii from the tokens — `Spacing.x16`, `Radius.card`.
- **Do** end scroll containers with 48px of bottom padding.
- **Do** use `withAlpha(colour, 0)` as a gradient's transparent stop, never the
  keyword `transparent` — Android interpolates through black and leaves a grey
  bruise across the ramp.

### Don't

- **Don't** use true black, gradients (outside artwork fades), glassmorphism,
  neumorphism, skeuomorphism or glow. Any of them dates the app instantly.
- **Don't** give interface a drop shadow. Only depicted objects cast.
- **Don't** outline a button. Fills and surface steps already separate them.
- **Don't** introduce a second accent colour. The score ramp is the only
  exception and it is data, not chrome.
- **Don't** set `fontWeight` on text — Inter's weights are separate families and
  `fontWeight` is silently ignored on Android.
- **Don't** shrink type to fit more in. Use chips, spacing and alignment.
- **Don't** put the game case in a feed, a search result or a list tile.
- **Don't** stretch cover art. 2:3, always, cropped rather than distorted.
- **Don't** add a sixth bottom-nav tab.
