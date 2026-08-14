/**
 * Design tokens.
 *
 * Dark only, and never true black. The page is #121212 and depth is built from
 * *surface steps* — background → surface → surfaceElevated → surfaceSelected —
 * rather than from shadows, which are close to invisible on a dark screen
 * anyway. A card looks lifted because it is lighter than what is behind it.
 *
 * **One accent: PlayStation blue.** It appears on selected navigation, primary
 * buttons, active states, badges and links, and nowhere else. Roughly 90% of
 * the interface is greyscale so that the blue is genuinely directive and the
 * game artwork stays the only other source of colour. The score ramp
 * (`scoreHigh` / `scoreMid` / `scoreLow`) is the deliberate exception: it is
 * data rather than chrome — see the note beside it.
 *
 * Everything is a token. Colours, spacing, radii, type, motion and the minimum
 * tap target all live here, and a value typed directly into a component is a
 * bug rather than a shortcut.
 *
 * Read colours through `useTheme()` rather than importing `Colors` directly.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  /*
   * Dark only.
   *
   * `light` exists so the `ThemeColor` type stays honest and so nothing has to
   * branch, but it holds the same values: this app is a dark room by design and
   * a light counterpart would be a second product. `APP_SCHEME` in
   * `hooks/use-theme` is the single place that says so.
   */
  dark: {
    text: '#F5F5F5',
    textSecondary: '#A8A8A8',
    /** Deliberately low contrast — timestamps, counts, captions. */
    textMuted: '#767676',

    /** The page. Never true black: #000 on OLED smears on scroll and kills the
     *  sense of depth the surface steps are built on. */
    background: '#121212',
    /** Cards and the tab bar. One perceptible step off the page. */
    surface: '#1C1C1C',
    /** Nested surfaces — a block inside a card, a chip, a thumbnail well. */
    surfaceElevated: '#242424',
    /** Selected / pressed surface, and the chip fill. */
    surfaceSelected: '#2A2A2A',
    /** Text fields and the search bar: darker than a card, so an input reads as
     *  a recess rather than as another card. */
    input: '#202020',

    /** Overlays for touch feedback. Layered *over* a surface, never instead. */
    hover: 'rgba(255, 255, 255, 0.04)',
    pressed: 'rgba(255, 255, 255, 0.07)',

    /** Dividers. Barely there on purpose — separation is the surface step's job. */
    border: 'rgba(255, 255, 255, 0.05)',
    borderStrong: 'rgba(255, 255, 255, 0.12)',

    /** The one accent. PlayStation blue. Selected nav, primary buttons, active
     *  states, badges, links — and nothing else. */
    primary: '#0070CC',
    onPrimary: '#FFFFFF',
    /** A wash of the accent, for the fill behind an active chip or badge. */
    primaryMuted: 'rgba(0, 112, 204, 0.16)',
    accent: '#0070CC',

    /*
     * The score ramp. Three colours that are *data*, not chrome.
     *
     * They are exempt from the one-accent rule because a 0-100 score has to be
     * readable as good/mixed/bad before the digits are, and blue cannot say
     * that. They appear on numerals and their labels — never on a fill, an
     * outline or a control.
     */
    scoreHigh: '#4ADE80',
    scoreMid: '#F5A524',
    scoreLow: '#EF4444',

    /** Platinum trophies. */
    platinum: '#A9B6CC',

    danger: '#EF4444',
    success: '#4ADE80',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0, 0, 0, 0.6)',
    /** Skeleton placeholder fill. */
    skeleton: '#242424',

    /**
     * Ink for gradient ramps over artwork, and the palette's only true black.
     *
     * Not a surface: `background` is still the floor and nothing is ever *filled*
     * with this. It exists because a fade sitting under a photograph has to
     * reach real black, which `scrim` (a flat 60% overlay) cannot do. Always
     * fade it with `withAlpha(shadowInk, 0)`, never the keyword `transparent`.
     */
    shadowInk: '#000000',

    /*
     * The tier-list ramp. Data rather than chrome, and exempt from the
     * one-accent rule for the same reason the score ramp is: a tier list is a
     * chart of the user's own judgement, and six rows that are all grey is not a
     * tier list. Warm → cool so the ordering reads before the letters do.
     *
     * Row-header fills only. These are tuned as backgrounds for near-black type
     * and are not legible as text colours on a dark surface.
     */
    tierS: '#FF7B7B',
    tierA: '#FFB068',
    tierB: '#FFD86B',
    tierC: '#B6E07A',
    tierD: '#7ACBE0',
    tierF: '#B0A6E0',

    /** Legacy aliases kept so older call sites keep compiling. */
    backgroundElement: '#202020',
    backgroundSelected: '#2A2A2A',
  },
} as const;

/** Dark-only: the light palette is the dark one. See the note above. */
export const Palette = Colors.dark;

export type ThemeColor = keyof typeof Colors.dark;
export type ThemePalette = typeof Colors.dark;

/**
 * A palette colour at a given opacity.
 *
 * Exists for gradients. `expo-linear-gradient` interpolates in premultiplied
 * space on Android, so fading a colour to the keyword `transparent` fades it
 * through black and leaves a grey bruise across the middle of the ramp. Fading
 * to the *same* colour at zero alpha has no such midpoint. Every gradient stop
 * in the app should therefore end on `withAlpha(colour, 0)`, never
 * `'transparent'`.
 *
 * Only handles the `#RRGGBB` literals in `Colors`; anything else is returned
 * unchanged rather than silently producing `rgba(NaN, …)`.
 */
export function withAlpha(color: string, alpha: number): string {
  if (!/^#[0-9a-f]{6}$/i.test(color)) return color;
  const value = parseInt(color.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

/**
 * Inter, in four weights, and nothing else.
 *
 * **Weight is a family here, not a `fontWeight`.** React Native on Android will
 * not synthesise a bold from a custom font: `fontFamily: 'Inter_400Regular'`
 * plus `fontWeight: '700'` renders regular, silently, and the bug only shows on
 * one platform. Every weight is therefore a separate loaded family, and nothing
 * in the app should set `fontWeight` on text again — reach for one of these.
 *
 * Four weights because the system uses three: 400 for reading, 500 for small
 * dense metadata, 600 for anything that has to be picked out of a page. 700 is
 * reserved for the two largest steps, which are page titles.
 */
export const FontFamily = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
} as const;

export const Fonts = Platform.select({
  ios: {
    sans: FontFamily.regular,
    serif: 'ui-serif',
    rounded: FontFamily.regular,
    mono: 'ui-monospace',
  },
  default: {
    sans: FontFamily.regular,
    serif: 'serif',
    rounded: FontFamily.regular,
    mono: 'monospace',
  },
});

/**
 * The 8-point scale, named for the value.
 *
 * `Spacing.x16` is sixteen pixels — there is nothing to remember and nothing to
 * misread, which the old ordinal names (`four` = 16) could not claim. The ladder
 * is fixed: 4, 8, 12, 16, 20, 24, 32, 40, 48. A gap that is not on it is a bug,
 * not a decision.
 */
/**
 * Spacing ladder.
 *
 * ⚠️ **The names are step names, not dp values.** `x16` is "the sixteenth-step
 * slot", and it currently resolves to 12. They were literal once; the ladder was
 * compressed when the interface was scaled down so the artwork would out-weigh
 * the chrome around it, and renaming ~470 call sites to chase the numbers would
 * have been a far larger and riskier diff than the change itself. Read the value
 * here, never infer it from the name. (Tailwind's `p-4` is 16px on the same
 * principle.)
 *
 * `x4` is the atom and did not move — below 4 there is no meaningful gap.
 * Everything above it lost roughly a quarter, which is where the "zoomed in"
 * feeling actually lived: a 16dp page margin and 24dp between sections are what
 * made a 74dp cover look like an incidental thumbnail.
 */
export const Spacing = {
  x4: 4,
  x8: 6,
  x12: 10,
  x16: 12,
  x20: 16,
  x24: 18,
  x32: 24,
  x40: 30,
  x48: 36,
} as const;

/**
 * Radii. See DESIGN.md § 5.
 *
 * The UI is deliberately not highly rounded: small corners keep the artwork the
 * roundest thing on screen. The scale is `none`…`lg` plus a pill; the role
 * aliases below map onto it and are what components should actually reach for.
 *
 * Naming by role is what keeps them in place — `Radius.card` cannot drift onto a
 * button the way `md` could.
 */
export const Radius = {
  none: 0,
  xs: 2,
  sm: 3,
  md: 5,
  lg: 8,
  /** Chips, badges, progress tracks, avatar rings. */
  pill: 999,

  /** Game covers, screenshots, thumbnails — anything rectangular and pictorial. */
  image: 4,
  /** Every button, icon button and control. */
  control: 6,
  /** Cards and modular surfaces. */
  card: 6,
  /** Text fields and the search bar. */
  input: 6,

  /*
   * Preserved — the physical game case keeps its own radii. See DESIGN.md § 5.3.
   *
   * `caseImage` was the same number as `image` under the previous scale and is
   * not under this one, so they are separate tokens on purpose: folding them
   * back together would silently redesign the case. `caseImage` covers both the
   * artwork inside the case window and the hairline frame around the PC/mobile
   * cover that stands in when a platform has no case.
   */
  caseImage: 12,
  caseSpine: 3,
} as const;

/**
 * Type scale. See DESIGN.md § 2.
 *
 * Each step pairs a size, a line height and a *family* (see `FontFamily`: on
 * Android the weight has to be the family or it is ignored). Nothing here sets
 * `fontWeight` — the family carries it.
 *
 * Structural steps are `display` and `h1`–`h6`; prose is `body` / `bodySmall`;
 * `caption` and `label` are the metadata steps; `button` is control text.
 * Hierarchy is carried by weight and colour before size — the gaps between the
 * heading steps are deliberately small.
 *
 * **Tracking is in points, not em.** React Native has no `em`, so DESIGN.md's
 * relative values are resolved against each step's own size: -0.02em on 32
 * becomes -0.64, 0.08em on 11 becomes 0.88. Changing a step's size means
 * recomputing its tracking.
 */
export const Type = {
  display: { fontSize: 26, lineHeight: 31, fontFamily: FontFamily.bold, letterSpacing: -0.52 },
  h1: { fontSize: 23, lineHeight: 28, fontFamily: FontFamily.bold, letterSpacing: -0.35 },
  h2: { fontSize: 19, lineHeight: 24, fontFamily: FontFamily.bold, letterSpacing: -0.19 },
  h3: { fontSize: 16, lineHeight: 21, fontFamily: FontFamily.bold },
  h4: { fontSize: 14, lineHeight: 19, fontFamily: FontFamily.bold },
  h5: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.bold },
  h6: { fontSize: 11, lineHeight: 15, fontFamily: FontFamily.bold, letterSpacing: 0.22 },

  body: { fontSize: 13, lineHeight: 19, fontFamily: FontFamily.regular },
  /* Long-form reading — an article or review body, not UI copy. Deliberately
     looser than `body`: those two screens are the ones people actually read. */
  prose: { fontSize: 15, lineHeight: 24, fontFamily: FontFamily.regular },
  bodySmall: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.regular },

  /*
   * 10 is the floor. Below this the metadata steps stop being small text and
   * start being unreadable — iOS puts its legibility guidance at 11pt and this
   * is already a point under it, which is affordable for a timestamp or a count
   * and would not be for anything you have to actually read. Do not shrink
   * these two further; take it out of the steps above instead.
   */
  caption: { fontSize: 10, lineHeight: 13, fontFamily: FontFamily.regular, letterSpacing: 0.2 },
  label: {
    fontSize: 10,
    lineHeight: 13,
    fontFamily: FontFamily.medium,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },

  button: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.semibold },

  /*
   * Preserved — the physical game case keeps its own type. See DESIGN.md § 2.3.
   *
   * These are the exact metrics the case rendered at before this scale was
   * adopted, pinned so its appearance did not move with the migration. Do not
   * use them anywhere else and do not tidy them onto `h1`/`h6`: `h1` grows the
   * placeholder letter by 4, and `h6`'s bold weight widens the uppercase edition
   * badge enough to truncate it on the 108dp case.
   */
  caseTitle: { fontSize: 24, lineHeight: 30, fontFamily: FontFamily.bold },
  caseEdition: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
} as const;

/**
 * Score numeral sizes. See DESIGN.md § 15.
 *
 * The score is a bare coloured numeral at 700, so it sits outside the type scale
 * — its size is chosen by how much room the score has, not by where it falls in
 * a document hierarchy. `inline` is body height, for a feed row where the score
 * is one fact among several; `hero` is the headline number on a review page.
 */
export const ScoreSizes = {
  inline: 13,
  medium: 19,
  large: 27,
  hero: 38,
} as const;

/**
 * Elevation. See DESIGN.md § 6.
 *
 * Depth is carried by **two** things working together: the surface step
 * (`background` → `surface` → `surfaceElevated` → `surfaceSelected`) and a
 * shadow on top of it. The step still does most of the work — a shadow alone is
 * nearly invisible against #121212 — but the shadow is what makes an element
 * read as sitting *above* the page rather than being painted on it.
 *
 * Four interface tiers, and they are deliberately restrained. On a near-black
 * page a large soft shadow does not look like depth, it looks like a grey
 * smudge; the lift comes from a tight radius and a short offset, not from
 * opacity.
 *
 *   card     a block resting on the page
 *   control  something you can press
 *   raised   pressed, active, or floating above siblings
 *   overlay  a dock, popover, sheet or modal — off the page entirely
 *
 * **The ceiling is the game case.** `game-case.tsx` casts at opacity 0.45,
 * radius 18, offset (6, 12) — strictly larger than `overlay` in opacity, offset
 * and radius, and the only shadow in the app with a horizontal component. That
 * gap is not decoration: the case is a depicted physical object and everything
 * here is interface. If an interface tier ever grows past `overlay`, the case
 * stops reading as the one real thing on the shelf. See DESIGN.md § 6.1.
 */
export const Elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.2,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 2 },
    },
    android: { elevation: 2 },
    default: {},
  }),
  control: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.24,
      shadowRadius: 8,
      shadowOffset: { width: 0, height: 3 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 5 },
    },
    android: { elevation: 6 },
    default: {},
  }),
  overlay: Platform.select({
    ios: {
      shadowColor: Palette.shadowInk,
      shadowOpacity: 0.38,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 10 },
    default: {},
  }),
} as const;

/**
 * Motion. Short and ease-out, and only where it helps you understand what moved.
 */
export const Motion = {
  fast: 150,
  normal: 200,
  slow: 300,
  /** Scale applied while a card or button is held down. */
  pressScale: 0.98,
} as const;

/** Minimum tap target, per both platforms' guidelines. Nothing tappable is smaller. */
export const TapTarget = 44;

/** Portrait box art. Every poster in the app uses this ratio. */
export const PosterAspectRatio = 2 / 3;
/** Landscape key art (Steam headers, IGDB artworks). */
export const HeroAspectRatio = 16 / 9;

/**
 * How much of the display a full-bleed hero fills.
 *
 * Sized against the screen rather than the art's own 16:9, because the hero is
 * the page's opening statement and 16:9 on a tall phone is a 26%-high band — a
 * banner above the content rather than a backdrop behind it. At 38% the art
 * carries the top of the screen the way it does on a store page.
 *
 * The trade is a centre crop: a 16:9 source shown at ~1.2:1 loses its outer
 * thirds. Key art is composed centrally, and `heroHeightFor` never returns less
 * than the untouched 16:9 height, so wide displays keep the whole frame.
 */
export const HeroHeightRatio = 0.38;

export const MaxContentWidth = 800;
