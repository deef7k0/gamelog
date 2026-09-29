---
name: GameLog
description: A premium, calm, information-dense gaming social platform. A near-black room, soft rounded controls in the language of a premium music player, one blue accent, and a lot of games.
scheme: dark-only
target: react-native
colors:
  # A near-black with a faint cool trace: darker than the #14171b it replaced
  # and without its blue-grey cast — not black. The whole ladder shares the
  # trace (hue ~260°, too faint to read as a colour), with slightly wider steps
  # than before: card on page 1.068:1,
  # elevated on card 1.070, selected on elevated 1.100. Nothing on a game's
  # screens uses these for surfaces — those derive them from the artwork
  # through `accentRoles`.
  background: "#0B0A0D"
  surface: "#141317"
  # Nested blocks and wells.
  surfaceElevated: "#1B1A20"
  surfaceSelected: "#24222A"
  # The owner's reference, SimpMusic, measured from its code: a field's well is
  # its onSurfaceVariant at 8% (#0F0F0F on black), an action's fill at 12%
  # (#181818 on black). Translucent, so the lift is the same on every floor.
  input: "rgba(255,255,255,0.06)"
  controlFill: "rgba(255,255,255,0.094)"
  controlPressed: "rgba(255,255,255,0.15)"
  # The soft label on an action button (#D6D4D9 measured). 12.4:1 on its fill.
  controlInk: "#D6D6D6"
  # The resting edge of a choice — a selection card, a filter pill. Choices are
  # outlined; actions are filled.
  outline: "rgba(255,255,255,0.16)"
  hover: "rgba(255,255,255,0.04)"
  pressed: "rgba(255,255,255,0.07)"
  # Dividers. 1.15:1 on the page.
  border: "rgba(255,255,255,0.07)"
  # Unchanged: the protected game case's PC-cover frame is drawn in it.
  borderStrong: "rgba(255,255,255,0.12)"
  # PlayStation blue, the house accent. Fills only: 3.94:1 on the page, right
  # under white (5.01:1), wrong for a word. Blue *type* uses `primaryText`,
  # and so do the house selected and focus states — a 14% wash of the fill
  # blue over near-black lands darker than a resting control.
  primary: "#0070CC"
  onPrimary: "#FFFFFF"
  # `primaryText` at 16%: the house `wash`, lighter than the resting control fill.
  primaryMuted: "rgba(46,147,232,0.16)"
  accent: "#0070CC"
  # 6.07:1 on the page, 5.31 on `surfaceElevated`.
  primaryText: "#2E93E8"
  # Neutral, deliberately: the reference's violet inks are within a few units
  # of these, and these are what the protected case's printed back is set in.
  text: "#F5F5F5"
  textSecondary: "#A8A8A8"
  textMuted: "#8F8F8F"
  scoreHigh: "#4ADE80"
  scoreMid: "#F5A524"
  scoreLow: "#F35555"
  danger: "#F35555"
  success: "#4ADE80"
  # Identity ramp — genre → hue, the fallback when a cover's dominant hue
  # cannot be extracted. See `constants/identity.ts`.
  identityEmber: "#FF9142"
  identityCrimson: "#FF6F7D"
  identityGold: "#F3C24B"
  identityLime: "#A8DC5A"
  identityJade: "#43D98C"
  identityAqua: "#3CD6CE"
  identitySky: "#57B2FF"
  identityCobalt: "#8394FF"
  identityViolet: "#B98CFF"
  identityMagenta: "#FF7ACB"
  # Log status. Data, not chrome — each ships its word or glyph beside the hue.
  statusPlaying: "#43D98C"
  statusPlayed: "#2E93E8"
  statusBacklog: "#C9A6FF"
  statusDropped: "#CE7B62"
  statusPaused: "#F3C24B" # = identityGold; 0022
  # Achievement rarity bands.
  rarityCommon: "#9AA3AE"
  rarityUncommon: "#43D98C"
  rarityRare: "#57B2FF"
  rarityEpic: "#B98CFF"
  rarityLegendary: "#F3C24B"
  # The ambient page glow. A gradient, never an image.
  glowCore: "#6B4C9A"
  glowEdge: "#3A2050"
  platinum: "#A9B6CC"
  # Review prose, and only review prose: a muted grey, quieter than
  # `textSecondary` and carrying the surfaces' cool trace (it was blue-green
  # when the room was). 6.29:1 on the page. See § Typography — the serif block.
  proseInk: "#958F9D"
  # A liked review's heart. Deliberately not `danger`: a like is an endorsement,
  # `danger` means something is about to be destroyed. 8.67:1 on the page.
  liked: "#FF9D35"
  scrim: "rgba(0,0,0,0.6)"
  skeleton: "#1B1A20"
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
  # The whole scale was zoomed out ~8% alongside the spacing ladder. `caption`
  # and `label` held at the 10px floor and are the reason it is only 8% — every
  # other step lost a point or two. If it is tightened again it comes out of
  # `display` through `body`, never out of the floor.
  # `caseTitle` / `caseEdition` are pinned and did not move: see § 2.3.
  display:
    fontFamily: "Inter_700Bold"
    fontSize: "24px"
    fontWeight: 700
    lineHeight: "29px"
    letterSpacing: "-0.52px"
  h1:
    fontFamily: "Inter_700Bold"
    fontSize: "21px"
    fontWeight: 700
    lineHeight: "26px"
    letterSpacing: "-0.35px"
  h2:
    fontFamily: "Inter_700Bold"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: "21px"
    letterSpacing: "-0.19px"
  h3:
    fontFamily: "Inter_700Bold"
    fontSize: "15px"
    fontWeight: 700
    lineHeight: "20px"
    letterSpacing: "0"
  h4:
    fontFamily: "Inter_700Bold"
    fontSize: "13px"
    fontWeight: 700
    lineHeight: "18px"
    letterSpacing: "0"
  h5:
    fontFamily: "Inter_700Bold"
    fontSize: "12px"
    fontWeight: 700
    lineHeight: "17px"
    letterSpacing: "0"
  h6:
    fontFamily: "Inter_700Bold"
    fontSize: "10px"
    fontWeight: 700
    lineHeight: "14px"
    letterSpacing: "0.22px"
  body:
    fontFamily: "Inter_400Regular"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "18px"
    letterSpacing: "0"
  prose:
    fontFamily: "Inter_400Regular"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "22px"
    letterSpacing: "0"
  bodySmall:
    fontFamily: "Inter_400Regular"
    fontSize: "11px"
    fontWeight: 400
    lineHeight: "15px"
    letterSpacing: "0"
  caption:
    fontFamily: "Inter_400Regular"
    fontSize: "10px"
    fontWeight: 400
    lineHeight: "13px"
    letterSpacing: "0.2px"
  label:
    fontFamily: "Inter_500Medium"
    fontSize: "10px"
    fontWeight: 500
    lineHeight: "13px"
    letterSpacing: "0.8px"
    textTransform: "uppercase"
  # 13 semibold, the reference's titleSmall: the small label in a 52dp pill.
  button:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
    letterSpacing: "0"
  # A form field's label, small and medium weight, above the field.
  fieldLabel:
    fontFamily: "Inter_500Medium"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: "16px"
    letterSpacing: "0"
  # What is typed into a field. No lineHeight on purpose: on Android a
  # lineHeight on a TextInput clips descenders.
  fieldText:
    fontFamily: "Inter_400Regular"
    fontSize: "13px"
    fontWeight: 400
    letterSpacing: "0"
  # The name on a selection card.
  optionTitle:
    fontFamily: "Inter_500Medium"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: "18px"
    letterSpacing: "0"
  # The title of a row or a card in a list — the reference's titleSmall.
  itemTitle:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
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
  # ---------------------------------------------------------------------------
  # Reviews, and nothing else in the app.
  #
  # The serif is the rule and these eight steps are its whole extent: serif for
  # the editorial content (a review's game title, its prose, the writer's
  # headline on a feed card), sans for everything *about* it (byline, year,
  # playthrough facts, like count). The feed card's three-line excerpt is sans:
  # beside a score and a strip it previews the prose rather than being it, and
  # the serif headline above it carries the distinction. A review is the one
  # thing in this product a person wrote, and the split is what makes it read as
  # writing rather than as app output.
  #
  # Source Serif 4 stands in for Tiempos, which is commercial and cannot ship.
  # Inter stands in for Graphik on the sans side, and is already here.
  # ---------------------------------------------------------------------------
  reviewTitle:
    fontFamily: "SourceSerif4_700Bold"
    fontSize: "20px"
    fontWeight: 700
    lineHeight: "24px"
  reviewTitleSmall:
    fontFamily: "SourceSerif4_700Bold"
    fontSize: "16px"
    fontWeight: 700
    lineHeight: "20px"
  reviewHeadlineSmall:
    fontFamily: "SourceSerif4_700Bold"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: "15px"
  reviewProse:
    fontFamily: "SourceSerif4_400Regular"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: "23px"
  reviewExcerpt:
    fontFamily: "SourceSerif4_400Regular"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: "20px"
  reviewYear:
    fontFamily: "Inter_300Light"
    fontSize: "14px"
    fontWeight: 300
    lineHeight: "19px"
  reviewByline:
    fontFamily: "Inter_600SemiBold"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: "17px"
  reviewMeta:
    fontFamily: "Inter_600SemiBold"
    fontSize: "13px"
    fontWeight: 600
    lineHeight: "18px"
spacing:
  # STEP NAMES, NOT DP VALUES. The ladder has been compressed twice to scale the
  # chrome down and the names were deliberately left alone: `x16` is 10, `x24`
  # is 15, `x48` is 30. Only `x4` still equals its name. Read the value, never
  # infer it from the token name, and never "fix" a name to match its number.
  #
  # The second pass took ~17% off every step from `x12` up — the spacing half of
  # a deliberate zoom-out of the whole interface (see `typography`). `x4` and
  # `x8` held: they are the intervals *inside* a pair, where there was no air to
  # reclaim, and below ~6 a gap stops reading as a gap.
  x4: "4px"
  x8: "6px"
  x12: "8px"
  x16: "10px"
  x20: "13px"
  x24: "15px"
  x32: "20px"
  x40: "25px"
  x48: "30px"
  # The top of the ladder. It exists for a single job: the gap *between* Home's
  # sections, and it keeps a clear margin over `x48` so that reads.
  x64: "40px"
rounded:
  # Two regimes: interface is large and soft; artwork keeps small corners.
  none: "0px"
  xs: "2px"
  sm: "3px"
  md: "5px"
  lg: "8px"
  # Chips, filters, tabs, search, badges, progress tracks, avatar rings.
  pill: "999px"
  # Role aliases.
  image: "4px"
  # Pressable controls that are not buttons — toggles, segments. Buttons are
  # full pills (`pill`); icon buttons are circles: size / 2, not a token.
  control: "20px"
  # Cards, notices, selection cards (the reference's Server options are 16).
  card: "16px"
  # The Card `panel` variant and the welcome screen. It was the game page's
  # <InfoCard> panels until those became SimpMusic's description card (§ 14).
  cardLarge: "18px"
  # Every field — text, text area, select, search: the reference's 18. Squarer
  # than a button's full pill, so a field and its button read as two objects.
  input: "18px"
  # Bottom sheets (top corners), dialogs and menus.
  sheet: "24px"
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
  # Controls do not cast: buttons, fields, chips and icon buttons are drawn by a
  # surface step and a 1px `border`. These tiers are for cards and overlays.
  none: "none"
  card: { opacity: 0.2, radius: 6, offsetY: 2, android: 2 }
  control: { opacity: 0.24, radius: 8, offsetY: 3, android: 3 }
  raised: { opacity: 0.3, radius: 12, offsetY: 5, android: 6 }
  overlay: { opacity: 0.38, radius: 16, offsetY: 8, android: 10 }
  # Ceiling — the depicted object (§ 4.1.7). Interface must never reach this.
  gameCase: { opacity: 0.45, radius: 18, offsetX: 6, offsetY: 12, android: 12 }
score:
  inline: 12
  medium: 17
  large: 25
  hero: 35
layout:
  maxContentWidth: "800px"
  # Resolves per platform in `constants/theme.ts` — 44 on iOS, 48 on Android.
  # This is the one place the two platforms diverge, and it is behavioural
  # rather than visual, which PRODUCT.md permits. Import `TapTarget`; never
  # hard-code either number in a component.
  tapTarget: "44px"
  tapTargetAndroid: "48px"
  # How tall a control is drawn, as distinct from how large it is to touch.
  # `small` reaches the tap floor through vertical slop, and wrapped rows of
  # small controls are spaced by exactly the two slops (`SmallControlRowGap`)
  # so their touch boxes tile rather than overlap.
  # The reference's: a button is 52 and a field 54.
  controlHeight: { small: "36px", medium: "52px", field: "54px", large: "60px" }
  posterAspectRatio: "2:3"
  heroAspectRatio: "16:9"
  heroHeightRatio: 0.38
components:
  card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
    padding: "10px"
    # No edge: an edge is what marks something pressable.
    border: none
    shadow: "{elevation.card}"
  card-elevated:
    backgroundColor: "{colors.surfaceElevated}"
  # Metadata — not pressable, so no edge.
  chip:
    backgroundColor: "{colors.surfaceSelected}"
    textColor: "{colors.textSecondary}"
    typography: "{typography.bodySmall}"
    rounded: "{rounded.pill}"
    height: "34px"
    padding: "0 14px"
    border: none
  chip-active:
    backgroundColor: "{colors.primaryMuted}"
    textColor: "{colors.primaryText}"
  # The app's one selected state (`useSelectable`), for every pressable control
  # with an on/off: sort and filter pills, selection cards, segments, toggles.
  # Choices are outlined at rest; actions are filled.
  selectable:
    backgroundColor: "transparent"
    border: "1px {colors.outline}"
    textColor: "{colors.textSecondary}"
  selectable-selected:
    backgroundColor: "accent wash"
    border: "1px accent edge"
    textColor: "{colors.text}"
  filter-pill:
    rounded: "{rounded.pill}"
    height: "{layout.controlHeight.small}"
    padding: "0 13px"
  # The reference's Server option, from its code.
  selection-card:
    rounded: "{rounded.card}"
    padding: "15px"
    gap: "13px"
    leading: "radio, 34px"
    title: "{typography.optionTitle}"
    hint: "{typography.bodySmall}, {colors.textSecondary}"
  radio:
    size: "34px (26px on a compact picker row)"
    border: "1px text at 22%"
    selected: "accent (legible) at 18% fill, accent check"
  # Every action: the reference's "Create room".
  button:
    backgroundColor: "{colors.controlFill}"
    pressedColor: "{colors.controlPressed}"
    textColor: "{colors.controlInk}"
    typography: "{typography.button}"
    rounded: "{rounded.pill}"
    height: "{layout.controlHeight.medium}"
    padding: "0 20px"
    border: none
    shadow: none
  button-primary:
    extends: button
    textColor: "{colors.text}"
  button-danger:
    extends: button
    textColor: "{colors.danger}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.text}"
  # The reference's disabled "Join room".
  button-disabled:
    backgroundColor: "transparent"
    border: "1px {colors.borderStrong}"
    textColor: "{colors.textMuted}"
  # The game page's review button only; its Material 3 treatment is preserved.
  button-vivid:
    backgroundColor: "accent, saturation lifted"
    textColor: "readable ink"
  button-small:
    height: "{layout.controlHeight.small}"
    padding: "0 13px"
  button-large:
    height: "{layout.controlHeight.large}"
  icon-button:
    backgroundColor: "{colors.controlFill}"
    rounded: "50%"
    size: "40px (32px small), touched at the tap floor"
    border: none
  focus-ring:
    outline: "3px accent ring, outside the control"
  # The reference's name field, from its code.
  input:
    backgroundColor: "{colors.input}"
    border: none
    borderFocused: "1.5px accent (legible)"
    borderError: "1.5px {colors.danger}"
    rounded: "{rounded.input}"
    height: "{layout.controlHeight.field}"
    padding: "0 15px"
    typography: "{typography.fieldText}"
    label: "{typography.fieldLabel}, above, 8px gap"
  textarea:
    extends: input
    minHeight: "120px"
  select:
    extends: input
    trailing: "chevron-down"
    menu: "{components.sheet}"
  search-bar:
    extends: input
    iconPosition: "leading"
  checkbox:
    size: "20px"
    rounded: "{rounded.md}"
    border: "1.5px {colors.borderStrong}"
    checked: "accent fill, accent ink check"
  sheet:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.sheet} (top corners)"
    border: "hairline {colors.border}"
  tab:
    rounded: "{rounded.pill}"
    selectedBackground: "accent wash"
    selectedText: "accent"
    text: "{colors.textMuted}"
  bottom-nav:
    backgroundColor: "{colors.surface}"
    borderTop: "hairline {colors.border}"
    height: "58px"
    maxItems: 5
    selectedColor: "{colors.primaryText}"
    unselectedColor: "{colors.textMuted}"
  score:
    display: "bare numeral, verdict colour"
    fontWeight: "700"
    sizes: "inline 12 / medium 17 / large 25 / hero 35"
gameCase:
  templateSize: { width: 540, height: 680 }
  widths: { small: 108, medium: 168, large: 232 }
  perspective: 900
  # The case rests square. Rotation is motion now — the arrival landing and the
  # drag-to-turn — not a permanent skew across the artwork. See § 4.1.
  tilt: 0
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
  # Nothing draws a spine — see § 4.1.5. `spineRadius`, `spineWidth` and
  # `spineTextColor` still exist in `constants/` so this block mirrors them, but
  # only `spineColor` is read, by the back face's branding band.
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
> **The frontmatter mirrors the code.** Colour, type, radius, spacing, motion
> and the component geometry match `src/constants/theme.ts` and
> `src/components/ui/`. Some prose below predates a later pass and quotes older
> numbers; where it does, the frontmatter wins. § 9 is the current statement of
> how controls look and behave.
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
never from effects. No neumorphism, no skeuomorphism, no gradients as decoration.
If something looks expensive here it is because the spacing is right, not because
it is doing a trick.

**Two sanctioned exceptions, both structural rather than decorative**, and both
defined in the frontmatter, which is normative where this prose disagrees:

- **The ambient light** (`glowCore`). A gradient, never an image, and never
  behind content it would compete with — see § 25's rule on `<Ambience>`.
  Home's `<AmbientLight>` is a very large, very soft field in the top-left
  corner — where an earlier, far stronger corner glow sat — lighting the left of
  the screen and falling off before it reaches the right. 1.12:1 against the
  page at its brightest, so it can stay fixed while the page scrolls through it
  without dragging any text below AA. The earlier glow was a `<SoftGlow>` that
  faded out on scroll; it read as a lit corner rather than as light.
- **The frosted bar.** `<FrostedTopBar>` is blur plus a 30% scrim and no fill of
  its own. It is a layer, not a surface: it has nothing to show and exists to
  soften what the page put behind it.

**Key characteristics:**

- Dark only, and never true black. `#0B0A0D` is the floor — a near-black with
  a faint cool trace, darker than the blue-grey it replaced.
- Depth is a *surface step*, not a shadow: background → surface → elevated.
  **Actions are filled** (a translucent grey pill) and **choices are outlined**
  (an edge, no fill, until chosen).
- One accent — **PlayStation blue** `#0070CC`, with `#2E93E8` for type — on
  selected nav, primary actions, selected and focused controls, and links. It
  is an accent, not a theme: most of any screen is black, near-black, grey and
  white.
- A game's own screens keep their **Material 3** palette, read from the box art;
  the accent in force there is the game's colour, not the house blue.
- Medium-high density, achieved with chips and spacing, never by shrinking text.
- **Two radius regimes.** Interface is large and soft — controls at 20, fields
  and cards at 16, sheets at 24, a pill for anything that filters or tags, a
  circle for a glyph on its own. Artwork keeps its small, square-ish corners.

**The control language is a premium music player's — specifically the owner's
reference, SimpMusic, read from its source.** Grey pills for actions, soft wells
for fields, outlined cards with a leading circle for choices, the accent only
where something is selected, focused or primary, and next to no shadow. See § 9.

The deliberate exceptions to all this restraint are the system's two **depicted
physical objects** — the things that are drawn as objects rather than as
interface, and the only elements allowed to cast, gloss and turn:

- the **physical game case** (§ 4.1), the app's signature object, and
- the **dealt card** on Surprise Me (§ 4.2), which is a card off a deck.

They are not equals. The case is the ceiling on every material axis and § 4.2
exists mostly to say by how much.

---

# 1. Colour

## 1.1 The room

Six steps on one faint cool trace, and each one has a job.

- **Background** `#0B0A0D` — the page. Never `#000`: true black smears on OLED
  during scroll and removes the contrast the whole depth model is built on. It
  replaced the cool `#14171b` at the owner's request — darker, not bluer, not
  black.
- **Surface** `#141317` — cards and the bottom bar. 1.068:1 against the page.
- **Surface elevated** `#1B1A20` — a block inside a card, a thumbnail well.
- **Surface selected** `#24222A` — the chip fill, and a control while pressed.
- **Input** `rgba(255,255,255,0.06)` — every field's well, #0F0F0F on black:
  the reference's name field. No border; the fill alone draws it.
- **Control fill** `rgba(255,255,255,0.094)` — every action button and icon key,
  #181818 on black: the reference's "Create room". A step lighter than a field,
  so an action and the field it acts on are two objects. Its label is
  `controlInk` `#D6D6D6`.
- **Outline** `rgba(255,255,255,0.16)` — the resting edge of a choice.
- **Hover** `rgba(255,255,255,0.04)` / **Pressed** `rgba(255,255,255,0.07)` —
  layered *over* a surface, never replacing it.
- **Border** `rgba(255,255,255,0.07)` — dividers, and the 1px edge every resting
  control carries. `borderStrong` `rgba(255,255,255,0.12)` is the strong edge.

## 1.2 The accent

**PlayStation blue** `#0070CC`, and there is only one per screen. (Lavender was
tried for one pass of the control migration; the owner took it back to blue.)

It appears on: selected navigation, the primary button, selected and focused
controls, badges, and links. The rule is absolute because the accent only
directs attention while it is rare — a screen with six blue things has no
primary action, it has six. **Most of any screen stays black, near-black, grey
and white.**

**Fills only.** At 3.94:1 on the page it is below AA for text — right under
white on a filled button (5.01:1), wrong for a word. Blue *type* uses
`primaryText` `#2E93E8` (6.07:1 on the page, 5.31 on `surfaceElevated`).

Every state is derived from whichever accent is in force (`accentRoles`). On the
house accent they are built from `primaryText`, not from the fill: `wash` (16%)
is the selected fill, `edge` (55%) the selected or focused edge, `ring` (30%)
the keyboard focus ring. A 14% wash of the *fill* blue over near-black lands
darker than a resting control, and a selected pill would look dimmer than its
neighbours. `pressed` is the primary fill 14% deeper (`#0060AF`, 6.38:1 under
white). On a game's screens the same roles come from the game's Material 3
palette — so a selected sort pill is blue on the Search tab and the game's own
colour on its reviews sheet.

`accent` is an alias of `primary`.

## 1.3 Text

`#F5F5F5` primary, `#A8A8A8` secondary, `#8F8F8F` muted. Three neutral steps —
they did not take the room's cool trace, because the protected game case's printed
back is set in them — and hierarchy within a block is expressed by moving
between them before it is expressed by changing size. Inside a *selected*
control, muted steps up to secondary: it is 4.32:1 on the accent's wash.

## 1.4 Colour usage

| Token              | Value                    | Usage                                        |
| ------------------ | ------------------------ | -------------------------------------------- |
| `background`       | `#0B0A0D`                | The page                                     |
| `surface`          | `#141317`                | Cards, tab bar, sheets                        |
| `surfaceElevated`  | `#1B1A20`                | Nested block, every control's resting fill    |
| `surfaceSelected`  | `#24222A`                | Chips, a control while pressed                |
| `input`            | `rgba(255,255,255,.06)`  | Every field's well                            |
| `controlFill`      | `rgba(255,255,255,.094)` | Every action button and icon key              |
| `controlInk`       | `#D6D6D6`                | The label on an action button                 |
| `outline`          | `rgba(255,255,255,.16)`  | A choice's resting edge                       |
| `text`             | `#F5F5F5`                | Titles, headings, primary copy                |
| `textSecondary`    | `#A8A8A8`                | Supporting copy                               |
| `textMuted`        | `#8F8F8F`                | Metadata, timestamps, counts                  |
| `primary`          | `#0070CC`                | Primary fill, badges — never type             |
| `primaryText`      | `#2E93E8`                | Links, selected nav, the accent as type       |
| `primaryMuted`     | `rgba(46,147,232,.16)`   | Active chip / badge fill, the house wash      |
| `border`           | `rgba(255,255,255,.07)`  | Dividers, every control's 1px edge            |
| `borderStrong`     | `rgba(255,255,255,.12)`  | Strong edge, unchecked box and radio rings    |
| `scrim`            | `rgba(0,0,0,.6)`         | Overlay on hero artwork                       |
| `platinum`         | `#A9B6CC`                | Platinum trophy marker                        |

## 1.5 Colour that carries meaning

Score is **data rather than chrome**, and it has one ramp: `scoreHigh`
`#4ADE80`, `scoreMid` `#F5A524`, `scoreLow` `#F35555`, returned by
`scoreColor()` in `constants/score.ts`. A score has to read as good, mixed or bad
before the digits are parsed, and the accent must never be one of the three — a
blue 55 would look endorsed. `danger` `#F35555` is also destructive actions;
`success` `#4ADE80` a positive result.

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

It is **not a surface** — `#0B0A0D` remains the floor and nothing is ever filled
with `shadowInk`. It exists solely as the far stop of a gradient ramp over
artwork, where a fade has to reach true black to sit under a photograph. `scrim`
`rgba(0,0,0,0.6)` is the flat overlay; `shadowInk` is the gradient ink. Fade it
with `withAlpha(shadowInk, 0)`, never the keyword `'transparent'`.

### Named rules

**The One Accent Rule.** Blue means "this, here, now" — selected, focused,
or the thing to press. If it is decorating something that is none of those, it
is wrong.

**The Borrowed Colour Rule.** Every other hue on screen belongs to a game's
artwork or to data (score, status, rarity, tier). The interface supplies
near-black, grey, white and one blue; the covers supply the rest.

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

> **There is no spine typography.** The case drew a generated spine slab for a
> while — a rectangle in `spineColor` carrying the game's title rotated
> bottom-to-top plus the platform's short name — and it was removed. It put
> hand-drawn app type, in a different face and a different colour, flush against
> a template PNG that is already finished artwork; the object read as a case
> with something stuck to its edge. The template is the whole object.

## 2.4 The reference's rhythm — bold for figures, quiet for everything else

Taken from the owner's reference, SimpMusic's Analytics screen
(`AnalyticsScreen.kt`), and applied where this app has the same kind of page —
the studio page, the game page's stats and cards, the collection rows.

- **Bold is for titles and figures only.** Everything that explains them is
  regular, a step smaller and quieter. The reference sets its page title at 25
  bold, its section headers and values at 16 bold, and every label, caption and
  secondary line at 11–13 regular in a muted grey.
- **A fact is a quiet label over a bold value** ("Total listened time" /
  **2 h 19 min**), or a bold figure over a quiet line (**53** / "Songs played").
  Label and value sit 2–4dp apart and read as one object.
- **Sentence case, no tracking.** No uppercase micro-labels on a stat strip, a
  masthead fact or a notice: "To beat", "Collections", "Planned release",
  "Community". Acronyms stay acronyms (PEGI, ESRB).
- **Rows and cards title themselves in `itemTitle`** (13 semibold) with a
  `bodySmall` line under them — a game in a collection, a collection in a list,
  a search result.
- **Sections breathe.** ~32dp between sections, ~16dp from a heading to what it
  heads (`<HomeSection>`: `x24`), ~15dp inside a card. The game page's sections
  are measured from the reference's artist page instead (§ 14).
- **A header over artwork** puts the title first, then a row: the subject on the
  left (a bold figure over a quiet line) and one measurement on the right,
  right-aligned (label over value). The studio page is the worked example: its
  name, then "*N* games" over its years, and "Average rating" over the score.
- **The accent is not a number's colour.** The reference tints its secondary
  figures ("13 min", "+15%") in its seed colour; here a *score* keeps its own
  ramp (`scoreColor`), because a blue 55 reads as endorsed.

The reference's 24dp side margin was **not** adopted: this app's 10dp margin is
shared by every screen and its rails bleed off the left edge, so widening one
screen would misalign it with its own rails.

---

# 3. Spacing & Layout

## 3.1 The ladder

**8-point spacing**, named for the value: `Spacing.x16` is sixteen pixels. The
ladder is fixed — 4, 8, 12, 16, 20, 24, 32, 40, 48 — and a gap that is not on it
is a bug rather than a decision.

- Outer page padding: **16**
- Card padding: **16**
- Between sections: **24** — except Home, which uses **48** (`Spacing.x64`).
  Home stacks unrelated bands rather than sections of one document, and at 24
  the gap between two bands was barely larger than the gap between a heading and
  its own rail. The interval separating bands has to be unmistakably bigger than
  any interval inside one.
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
in the same composition disagreeing about how big the screen is.

All internal offsets derive from a single scale factor:

```ts
scale = renderedWidth / templateSize.width
```

## 4.1.5 Per-platform template geometry & materials

`coverArea` is the transparent window in the template PNG, in template pixels.

| Platform | coverArea (x, y, w, h) | spineColor | accent    |
| -------- | ---------------------- | ---------- | --------- |
| `ps5`    | 16, 58, 508, 606       | `#0D47A1`  | `#1565C0` |
| `ps4`    | 16, 52, 508, 612       | `#0D47A1`  | `#1565C0` |
| `xbox`   | 14, 62, 512, 604       | `#107C10`  | `#107C10` |
| `switch` | 14, 46, 512, 620       | `#E60012`  | `#E60012` |

**`spineColor` no longer paints a spine.** Nothing draws one. The field survives
because `<GameCaseBack>` uses it for the branding band across the head of the
back face, which is printing on a face and matches the strip the front template
already carries. `spineWidth`, `spineLabel` and `spineTextColor` remain in
`constants/platform-cases.ts` and are read by nothing; they are kept rather than
deleted so a future template that genuinely depicts an edge has its measurements
to hand.

**Template contract.** A template is a PNG of the case's front face: opaque
chrome (border, top band, branding) with the cover window punched out as
transparent pixels. Artwork is drawn *beneath* the template and shows through
that window, which is why `coverArea` is never hardcoded in the component.
Swapping artwork is free provided you:

* keep `templateSize` accurate for the new file,
* keep `coverArea` describing the transparent window, in template pixels,
* keep the window genuinely transparent (alpha 0), not white.

## 4.1.6 Layering

Bottom to top, exactly four layers:

```text
1. drop shadow      — on the outer wrapper, so it follows the whole object
2. cover artwork    — positioned into the template's transparent window
3. platform template PNG
4. soft diagonal gloss
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

**Perspective / tilt** — **the case rests square, at `0`.** It sat at a permanent
6° for a long time, and that skew was doing one job: saying "this is an object,
not a picture of one". Two things say it better now and neither costs the
artwork anything — the case *lands* on arrival, and it *turns over* on a drag.
Motion is a stronger claim about physicality than a static rotation, and a
permanent one foreshortens an edge of the cover for as long as the page is open,
on the largest rendering of box art in the app.

The prop stays, because it is the seam `<GameCaseFlip>` drives every degree of
rotation through — the landing, the turn, the rubber band — without touching the
protected component.

```ts
transform: [{ perspective: 900 }, { rotateY: `${tilt}deg` }]   // tilt defaults to 0
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

# 4.2 The dealt card

Surprise Me deals one game at a time and you swipe it away. That card is the
system's **second depicted physical object**, and this section exists because
§ 0 used to say there was only one.

## 4.2.1 Why it is an object at all

Because the feature already insisted it was, everywhere except on screen. The
code calls it `deal()` and `dealX`; its docblocks say "the card is dealt"; the
Home entry point draws a three-card fan of a hand being cut. What shipped was a
flat rectangle that slid sideways on a flat field — a picture of a card rather
than a card.

Giving it a deck to come off, a lean as it is pulled, and a highlight that moves
across it is not decoration added to an interface element. It is the element
finally behaving like the thing every other part of the feature calls it.

## 4.2.2 The ceiling — the case wins on every axis

| | game case (§ 4.1) | dealt card |
| --- | --- | --- |
| **cast** | 0.45 / r18 / (6, 12) / elev 12 | `Elevation.raised` — 0.30 / r12 / (0, 5) / elev 6 |
| **gloss** | 0.20 peak | 0.16 peak |
| **turn** | full 180°, draggable, readable from the back | ±7°, drag-linked only |

The gap is load-bearing, exactly as § 6.2 says of the shadow: the case is the one
thing you could pick up and inspect, and it stays special only while nothing else
comes close. **A card may lean and catch light. Only the case may be turned over.**

`perspective: 900` is shared, and deliberately: two objects in one app disagreeing
about how far away the viewer is standing is worse than either value being wrong.

## 4.2.3 The deck

Two cards behind the dealt one, **face down** — one surface step, one hairline,
no artwork and no glyph.

Face down is not a stylistic choice. The next game is already in memory, and
drawing its cover would spoil the surprise, which is the whole feature. The card
behind is blank because there is nothing to read yet; that is what a face-down
card *means*.

The three depths cast in descending order — `raised`, `control`, `card` — which
is physically right (a card lower in a stack is closer to the table) and keeps the
whole object a clear tier under the case.

Surfaces come from `accentRoles`, never the grey ladder: the page is filled with
the game's own tone-10 neutral, and a fixed `surfaceElevated` card on it would be
the one object in the room lit by a different lamp.

## 4.2.4 The sheen, and the line it must not cross

§ 25 bans gradients as decoration. **At rest the sheen is at opacity 0.** It
exists only while the card is tilting: no tilt, no sheen. That is the entire
difference between a texture painted on a card and a reflection coming off one,
and it is the test any future change to it has to pass.

## 4.2.5 Where the card may appear

On the Surprise Me reveal, and nowhere else. The deck is not a pattern for feeds,
rails or lists — those use `<Poster>` and stay flat and fast, for the same reason
§ 4.1.2 keeps the case off them.

---

# 4.3 The binder and the CD

A person's physical games are kept the way discs are kept: in a zip binder.
Two more depicted objects, under the same Object Rule (§ 4.1.1) and under the
case's ceiling on every axis.

- **The CD** (`<CdDisc>`) is the game's box art printed on `game_cd.png`. The
  PNG follows the case contract — opaque rim and clear hub, the label punched
  out — so the art is drawn beneath it, cropped to a circle, never stretched.
  The hub shows what the disc lies on. Gloss peaks at 0.16, under the case's
  0.20; its cast (0.35 / r8 / (2, 5)) is well under the case's.
- **The binder** (`<CdBinder>`) arrives shut: the surface ladder as padding,
  a dashed stitch, a zip and its pull, the count debossed. Tap and the cover
  swings about the spine and *becomes* the left page. Two sleeves a page, two
  pages a spread; a turned page carries the next spread on its back. Sleeves
  are film — a faint wash, a hairline, a heavier lip over the disc's lower
  third — and discs in sleeves do not cast; the binder does.
- **The showcase** (`copy/[id]`) is a collection screen in § 4.1.2's sense: the
  copy's case for its platform, its disc sliding out ~58% from under it on a
  tap, and a drag turning the case to a back that prints the copy (release, what
  is in the box, condition, when it was got, the masked barcode).

**Where they may appear:** the library's Physical tab and the copy showcase.
Nowhere else — a profile shows the digital / physical *count*, not the binder.
No colour of their own: everything is the surface ladder and the artwork.

---

# 5. Shapes & Radius

**Two regimes.** Interface is large and soft — the music-app language. Artwork
keeps small, square-ish corners, because a box is a box: rounding a cover to
match the buttons beside it would make it look like one of them.

## 5.1 The scale

| Token  | Value | Used for                                                     |
| ------ | ----: | ------------------------------------------------------------ |
| `none` |     0 |                                                              |
| `xs`   |     2 | Details inside a control                                     |
| `sm`   |     3 |                                                              |
| `md`   |     5 | A checkbox                                                   |
| `lg`   |     8 | The game page's Material 3 seams — preserved                  |
| `pill` |   999 | Chips, filters, tabs, search, badges, tracks, avatar rings   |

## 5.2 Role aliases

Named for **what they wrap**, not for how big they are.

| Alias              | Value | Wraps                                                   |
| ------------------ | ----: | ------------------------------------------------------- |
| `Radius.image`     |     4 | Covers, screenshots, thumbnails                          |
| `Radius.pill`      |   999 | Every button, filter, tab, chip and the search pill      |
| `Radius.control`   |    20 | Pressable controls that are not buttons: toggles, segments|
| `Radius.card`      |    16 | Cards, notices, list tiles, selection cards, menu rows  |
| `Radius.cardLarge` |    18 | The `Card` panel variant, the welcome screen             |
| `Radius.input`     |    18 | Every field: text, text area, select, search            |
| `Radius.sheet`     |    24 | Bottom sheets (top corners), dialogs, menus             |

Buttons are full pills, as the reference's are. A radius larger than half a
control's side clamps to a pill, so `control` is a soft stadium on a 48dp toggle
and a true pill on anything 40dp or shorter. Icon-only buttons are circles —
`size / 2`, not a token.

**No one radius for everything.** A field is squarer than the button that
submits it, and a sheet is rounder than the rows in it, so each reads as a
different kind of object. Filters and tabs are pills; buttons are stadiums;
containers are rounded rectangles.

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
against `#0B0A0D` has almost nothing to darken. That is also why controls do not
use shadows at all: they carry a 1px edge instead (§ 6.1).

## 6.1 The interface scale

Four tiers. Every interactive or grouping element sits on one of them; nothing
that a user can touch should be flat.

| Tier      | Opacity | Radius | Offset Y | Android | Used for                                    |
| --------- | ------: | -----: | -------: | ------: | ------------------------------------------- |
| `none`    |       — |      — |        — |       — | Text, dividers, things inside a lifted block |
| `card`    |    0.20 |      6 |        2 |       2 | A block resting on the page                  |
| `control` |    0.24 |      8 |        3 |       3 | An object *on* the page, rarely used now      |
| `raised`  |    0.30 |     12 |        5 |       6 | Pressed, active, or floating above siblings  |
| `overlay` |    0.38 |     16 |        8 |      10 | Dock, popovers, sheets, modals               |

**Controls do not cast.** Buttons, fields, chips, pills and icon buttons are
drawn by a surface step and a 1px `border`, the way the music-app reference
draws them; a control that needs more presence gets a brighter edge or a fill,
not a tier. The one exception is the game page's review button, which takes
`raised` because its fill and the page behind it are the same hue.

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
backgroundColor: theme.surface,   // #141317
borderTopWidth: StyleSheet.hairlineWidth,
borderTopColor: theme.border,
height: 58 + insets.bottom,
```

Icons above labels — labels shown, not hidden, because an icon-only bar asks
every new user to guess what a newspaper glyph leads to. Selected is the house
blue (`primaryText`) on both glyph and label; unselected is `textMuted`. It never
takes a game's colour. Separated by tone and a hairline, not a shadow.

Five is the ceiling. A sixth destination means something belongs one level down.

---

# 9. Buttons & Controls

**Read from the owner's reference, not traced from it.** SimpMusic is open source
(`maxrave-dev/SimpMusic`), and every measurement below comes from its Compose
code: `ListenTogetherScreen.kt` (the name field, "Create room", the disabled
"Join room"), `ListenTogetherSettingsScreen.kt` (the Server options) and
`AnalyticsScreen.kt` (§ 2.4). Go back to those files before changing a control.

**Three families, told apart by fill.** Actions are **filled** grey pills.
Fields are **soft wells**. Choices are **outlined** until chosen. The accent
appears only on what is selected, focused, or — on a game's own page — the one
vivid review button.

**What kept its own treatment.** The game page's Material 3 cluster — the vivid
"Write a review" (`tone="vivid"`), the connected row of tonal action keys, the
platform keys — and `<RoundAction>` on Surprise Me and a review. So did the
collection header's white "Like" pill and round keys (a playlist hero), the
sign-in providers' brand colours (on the shared pill shape), and every *meaning*
colour: a log status fills with the status's hue, a platinum or spoiler toggle
lights in its own colour, a tier chip fills with its tier. The physical game
case and the dealt card are objects, not controls, and are untouched.

## 9.1 Buttons — every action is the same grey pill

The reference's "Create room": **52dp, fully round, filled `controlFill`**
(#181818 on black), a small semibold label (`button`, 13) in the middle. One
object for every action; the variants change the label, not the object:

- **Primary** — the label a step brighter (`text`). At most one per screen.
- **Secondary** — the label in `controlInk`, the reference's soft grey.
- **Danger** — the same pill with a red label.
- **Ghost** — no fill at all: a text action, like the reference's "Connect".
- **Disabled** — the reference's disabled "Join room": no fill, a faint
  `borderStrong` edge, a dimmed label. Told apart by shape as well as by
  brightness, never by opacity alone.

36dp when small (touched at the floor through slop), 60dp when large. Held, the
fill brightens to `controlPressed` and the pill sinks 3% (`PressableScale`'s
`pressedColor`, eased on the UI thread). Focused from a keyboard, a 3dp ring in
`accent.ring`. Loading keeps the pill and swaps the label for a spinner without
resizing. No shadow.

## 9.2 Icon buttons

The round sibling: a circle in `controlFill` with no edge — the reference's
glyph keys — drawn at 40dp (32 small) and touched at the platform floor through
vertical slop. `active` lights wash, edge and glyph in the accent; `danger`
reddens the glyph; `plain` drops the fill, for rows that already have a
container. The floating back/close disc (`<TopBarDisc>`) is frosted glass and
stays glass.

## 9.3 Fields

The reference's name field: a label above in `fieldLabel` (12, medium), then a
**soft well** — `input` (#0F0F0F on black), **no border**, `Radius.input` (18),
54dp (`ControlHeight.field`), `fieldText` (13) with 15dp of side padding — and a
hint or error under it, 8dp apart. **Focus** draws the accent's edge (1.5dp, in
`accent.onSurface`), as the reference outlines the code box you are typing in;
an **error** keeps the edge red until it is fixed. Text areas, `<SelectField>`
(a chevron where the typing would be; its open sheet wears the same edge) and
every search field are the same object.

## 9.4 Selection — choices are outlined

**One selected state, everywhere** (`useSelectable()`): at rest a choice has no
fill and a 1px `outline`; chosen, the accent's `wash` inside, its `edge` around,
and the label up from `textSecondary` to `text`. Three carriers, only one of them
a hue — the wash is lighter than the bare page and the edge far brighter than
the resting one, so a choice survives colour blindness and greyscale.

- **Selection cards** (`<SelectionCard>`) — the reference's Server options:
  `Radius.card` (16), 15dp padding, 13dp between parts, **a 34dp circle on the
  leading edge**, then the name (`optionTitle`, 13 medium) and its hint
  (`bodySmall`). The circle is an empty ring at rest; chosen, it fills with the
  accent at 18% and holds a check. A report's reasons, a copy's condition, a
  collection's type, the seven progress choices, a release, a select field's
  options (`compact`, a 26dp circle) and the filter pickers (`frame="row"`,
  bare until chosen) all use it.
- **Filter and sort pills** — `ControlHeight.small`, `Radius.pill`, outlined.
  Wrapped rows are spaced by `SmallControlRowGap`, exactly the two slops that
  meet across the gap, so touch boxes tile and never overlap.
- **Checkboxes** — `<Checkbox>`, 20dp: an empty rounded square in `borderStrong`,
  or the accent's fill with its ink's check. The row around it is the control.
- **Tabs** — pills; the selected one takes the accent's wash and its label goes
  to the accent. `<TabBar>` and the News dock (a segmented capsule) both.

## 9.5 Sheets, dialogs and menus

`surface` (or `surfaceElevated` for a centred dialog), `Radius.sheet`, a hairline
edge against the scrim, `Elevation.overlay`. Close is a round key. Menu rows are
flat until pressed and inset from the sheet's edge so their rounded ends show;
a destructive row presses in red. `Alert.alert` stays native — it is the
platform's own dialog and is not ours to restyle.

---

# 10. Search Bar

A field like every other (§ 9.3) with a magnifier leading: the `input` well,
no border, 18dp corners, 54dp, the accent's edge while focused. Every field that
searches — the Search tab, the game pickers, a library's search — is this shape.

---

# 11. Cards

Filled `surface`, `Radius.card` (16), `x16` padding, a light `Elevation.card`,
and **no border**: an edge is what marks something pressable, and a card of
content is not one big button. `elevated` puts it on `surfaceElevated`, for a
card on a card.

---

# 12. Chips

The metadata capsule, and the main reason this app is dense without being
cramped: `📅 Played` · `⏱ 45h` · `🏁 Completed`.

34 tall, `Radius.pill`, on `surfaceSelected`, **no edge and no shadow**. A filter
pill is the same shape *outlined* and unfilled, because a filter is a choice and
a fact is not. Active chips take the accent's wash with accent text.

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
full width beneath both columns. About, soundtrack, achievements, franchise and
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

## 14.1 The Overview tab — SimpMusic's artist page

Below the tabs the page is the reference's artist page, section for section
(`ArtistScreen.kt`): a bold heading on the page, and under it either a **rail of
art** — screenshots, events, the original game, editions, the franchise, as its
"Singles" and "Albums" are — or a **card** of words and figures, as its
"Description" is. A heading may end in the reference's **More**, one quiet word
that goes to the rest of the section.

```text
Screenshots
[ 16:9 ][ 16:9 ][ 16…                      ← the reference's video height
About                               Details
┌──────────────────────────────────────┐
│ Five lines of synopsis…              │    ← the description card
│ More                                 │    ← opens in place, animated
└──────────────────────────────────────┘
Editions & extras
[cover][cover][cover][co…                  ← 2:3 at the album height
Title   Title   Title
2019    2020    2021
```

- **Sizes are fractions of the display**: the reference's dp over the 360dp
  phone it was measured on, where its 180dp album art is half the width
  (`useSectionMetrics`). Inset 20, heading row 40, items 20 apart, card 8 in the
  corner and 16 in. Type stays on the scale — `h2` headings, `itemTitle` over
  `bodySmall` under the art, `body` in a card.
- **The card** is filled with the game's `primaryContainer` at half brightness —
  the reference halves Palette's dark-vibrant swatch — with `Elevation.card`.
  Every ink on it clears AA: `textSecondary` 6.4:1, `controlInk` 10.5:1.
- **Opening in place** animates the height of a window onto the whole text,
  250ms on FastOutSlowIn (`<ExpandableText>`), never the line clamp.
- **The art keeps the app's corner** (`Radius.image`): the layout is the
  reference's, the boxes are this app's.

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

**A band label is `h2` — 19 / 24 bold, in `text`.** This section used to
specify the opposite (`caption` or `bodySmall` in `textMuted`, with an explicit
ban on `h1`/`h2`), and the code has never matched it. The code is right.

A band heading has to win against the artwork *directly underneath it*. At 14px
bold in a muted grey it lost to every cover on the page, and Home stopped
reading as separate sections at all — it read as one continuous scroll with
captions floating in it. 19px bold is the step where the heading reads first.
The quiet-label rule was written for a page whose bands were lists of text; this
app's bands are walls of box art, which is a different problem.

Metadata-style labels above dense content still use `label` — 10 / 13, medium,
`textMuted`, uppercase, 0.8px tracking. That is a different job: it names a
*column or a group inside* a band, not the band. Home's "MORE FROM EVERYONE"
seam is the canonical use.

The rule that survives: **a page has one page title.** `h1` is the page's
subject, `h2` is a band inside it, and nothing on a band heading goes above
`h2`.

---

# 18. Home

Not a feed. A stack of independently-sourced bands, each answering one
question. Every band is its own query with its own ranking and its own failure —
a dead RSS feed removes one band's contents, says so in place, and leaves the
rest of the page working.

**Four bands, and the order is the argument.** The page opens on *you* and
widens outward:

| # | Band | Question | Source |
|---|---|---|---|
| 1 | Games for you | what might I play | your logs → IGDB similarity |
| 2 | Reviews | what did people write | Postgres |
| 3 | Releases | what came out, what's next | IGDB |
| 4 | Latest news | what happened | RSS |

It was seven, and two of those pairs were the same band twice. "Latest releases"
and "Coming soon" were both 92dp poster rails with an inverted date predicate,
stacked back to back. "From people you follow" and "Latest reviews" were the
same component from the same query — `newest` is *defined* as the residue after
`followed` is removed — separated by ~2,900dp of other content, so reaching the
bottom of Home meant finding a band indistinguishable from one you read five
screens earlier. Both pairs are single bands now.

**A band whose only distinction from its neighbour is its heading is not a
band.** Merge it, or make the two look different.

**On a first run, band 1 is the ask, not a rail.** An account with no logs
cannot fill bands 1 or 2, and a home screen for a logging app that never says
"log a game" has no path to its own product. The recommendation slot carries an
empty state with an action until there is one log.

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

> The case's `rotateY` is **motion, not a resting style**: it is 0 at rest, and
> the only things that turn it are the arrival landing and the drag-to-turn
> gesture. Both live on `<GameCaseFlip>`, and neither is a press-scale.

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
#F5F5F5  →  #A8A8A8  →  #8F8F8F
```

Do not use multiple bright colours for hierarchy. The interface should remain
overwhelmingly:

```text
near-black + near-white + muted grey + one blue
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

- **Don't** use true black, decorative gradients, neumorphism or skeuomorphism.
  Any of them dates the app instantly. The two exceptions are the ambient glow
  and the frosted bar — both structural, both defined in the frontmatter, both
  argued in § 0.
- **Don't** give a control a shadow. Controls are drawn by a fill and a 1px edge;
  depicted objects cast.
- **Don't** put an edge on a card of content. The edge means "you can press
  this".
- **Don't** hand-roll a selected state. Read it from `useSelectable()`.
- **Don't** introduce a second accent colour, and don't spend the accent on
  anything that is not selected, focused or primary.
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

### The control migration

Every generic control moved to the language of a premium music player; the
game page's Material 3 treatment, the brand buttons, the meaning colours and the
physical objects kept theirs (§ 9).

| Was | Became |
|---|---|
| `primary` PlayStation blue `#0070CC`, white ink | Unchanged. Lavender `#C4A1FF` was tried for one pass and the owner took it back to blue; the state roles are built from `primaryText` |
| `background` `#14171b`, ladder on hue 206° | `#0B0A0D`, ladder on a faint cool trace |
| `Radius.control` 6, `card` 6, `input` 6 | 20, 16, 16 — plus `inputArea` 20, `sheet` 24 |
| Selection one surface step lighter, never a hue | The accent's wash + edge + a brighter label (`useSelectable`) |
| Buttons filled, never outlined; `control` shadow | 1px edge on secondary and danger; no shadow |
| Square icon buttons | Circles, touched at the floor through slop |
| Fields: `bodySmall` label, no edge, card shadow | `fieldLabel` above, 1px edge, accent focus ring |
| Filter pills 44/48 tall, 6px corners | 36 tall pills touched at the floor, rows gapped by the slop |
| Home's strong corner glow + a centred ambient light | The soft ambient light alone, moved into the corner glow's place |
| **The reference pass** (SimpMusic's own code) | |
| Buttons: accent-filled primary, grey-with-edge secondary, 48dp | Every action one grey pill: `controlFill`, 52dp, full round, small label; disabled outlined |
| Fields: `input` #111014 + 1px edge, 16 radius, 48dp | A soft well: `input` 6% white, no border, 18 radius, 54dp; focus draws the accent's edge |
| Choices: resting fill + edge; radio on the trailing edge, 20dp | Outlined, no fill; `<SelectionCard>` with a 34dp circle on the leading edge and a check |
| Stat labels: uppercase `h6` (`TO BEAT`) | Sentence case `bodySmall` ("To beat"); rows title in `itemTitle` |
| Home's light at 0.18 | 0.42, near the reference's own top light |

The case came through this one unchanged too: its files were not touched, and
the three text inks and `borderStrong` it reads were deliberately left at their
old values. Its artwork wells use `surfaceElevated`, which darkened with the
room — visible only while a cover is loading or where a game has none.

### Remaining deltas

| # | Delta | Status |
|---|---|---|
| 1 | One score ramp: `scoreColor()` returns `scoreHigh` / `scoreMid` / `scoreLow` everywhere (amber won the neutral band). | Resolved. |
| 2 | The accent is **PlayStation blue** `#0070CC` (lavender was tried and reverted) and the page a near-black `#0B0A0D`, both by owner decision in the control migration (below). The cool `#14171b` is retired. | Decided. |
| 7 | The surface ladder shares the page's hue and its steps are slightly wider than before (1.068 / 1.070 / 1.100). | Resolved. |
| 3 | `MaxContentWidth` is 800 and the layout is phone-first single-column. There is no desktop grid. | By design. |
| 4 | Component geometry: 48 buttons and fields (36 small, 60 large), 34 chips, 48 search pill, 58 tab bar, 44/48 tap target. | Current. |
| 5 | `game-disc.tsx` is protected, so its stray colour literals and its two bare `'transparent'` gradient stops were left alone. Those stops are the Android black-bruise bug this document warns about in § 1.5. | Knowingly deferred. |
| 6 | Regenerate `.impeccable/design.json` after any frontmatter change. No hook enforces it. | Manual. |
