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
export const Spacing = {
  x4: 4,
  x8: 8,
  x12: 12,
  x16: 16,
  x20: 20,
  x24: 24,
  x32: 32,
  x40: 40,
  x48: 48,
} as const;

/**
 * Radii, named for what they wrap rather than for how big they are.
 *
 * Four rounded primitives and a pill, and every surface in the app is one of
 * them. Naming by role is what keeps it that way: `Radius.card` cannot drift
 * onto a button the way `large` could.
 */
export const Radius = {
  /** Game covers, screenshots, thumbnails — anything rectangular and pictorial. */
  image: 12,
  /** Every button, icon button and control. */
  control: 18,
  /** Cards and modular surfaces. */
  card: 20,
  /** Text fields and the search bar. */
  input: 24,
  /** Chips, badges, progress tracks, avatars. */
  pill: 999,
} as const;

/**
 * Type scale — Inter, deliberately small.
 *
 * Each step pairs a size, a line height and a *family* (see `FontFamily`: on
 * Android the weight has to be the family or it is ignored).
 *
 * The scale ran a step larger for one revision and it was wrong on a phone: a
 * single feed card filled the screen, and a review card's own score outweighed
 * the box art beside it. This is a dense app — a feed row carries a name, a
 * headline, a score, a verdict, a game, a cover and four lines of prose — and
 * density is only legible if the type stays quiet. Body sits at 14, not 16.
 *
 * 700 appears exactly twice, on the two steps that are page titles. Everything
 * else is 400 for prose, 500 for dense metadata, 600 for anything that has to
 * be picked out of a page. Hierarchy is carried by size and colour; reaching
 * for a heavier weight to make something matter is how a screen ends up with
 * six competing emphases.
 */
export const Type = {
  display: { fontSize: 32, lineHeight: 40, fontFamily: FontFamily.bold },
  title: { fontSize: 24, lineHeight: 30, fontFamily: FontFamily.bold },
  heading: { fontSize: 18, lineHeight: 24, fontFamily: FontFamily.semibold },
  section: { fontSize: 16, lineHeight: 22, fontFamily: FontFamily.semibold },
  body: { fontSize: 15, lineHeight: 23, fontFamily: FontFamily.regular },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontFamily: FontFamily.semibold },
  caption: { fontSize: 13, lineHeight: 18, fontFamily: FontFamily.medium },
  micro: { fontSize: 12, lineHeight: 16, fontFamily: FontFamily.medium },
} as const;

/**
 * Elevation is a *surface step*, not a shadow.
 *
 * `background` → `surface` → `surfaceElevated` → `surfaceSelected` is the whole
 * depth model: a card looks lifted because it is lighter than the page, and on
 * a dark screen that reads far better than a shadow nobody can see against
 * #121212. The two shadow entries survive for the one thing that genuinely
 * casts — a depicted physical object, i.e. the game case and its poster.
 */
export const Elevation = {
  none: {},
  card: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.18,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
    },
    android: { elevation: 3 },
    default: {},
  }),
  raised: Platform.select({
    ios: {
      shadowColor: '#000',
      shadowOpacity: 0.28,
      shadowRadius: 20,
      shadowOffset: { width: 0, height: 8 },
    },
    android: { elevation: 8 },
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
