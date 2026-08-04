/**
 * Design tokens.
 *
 * The visual language is content-first: the interface is a near-black neutral so
 * that game artwork supplies essentially all of the colour.
 *
 * **The interface is monochrome.** `primary` is near-white in dark mode and
 * near-black in light mode — it is a *value*, not a hue. A blue accent used to
 * sit here, and on a screen whose whole job is showing cover art it competed
 * with every poster it sat next to: a blue button beside orange key art reads as
 * a second, louder piece of art. Ranking by lightness instead means the only
 * colours on screen are the game's own, plus three semantic exceptions that
 * carry meaning nothing else can: `accent` for ratings, `danger`, `success`.
 *
 * Chrome is separated by **surface steps and a hairline outline**, not by fill
 * colour: `background` → `surface` → `surfaceElevated`, each with `border`
 * around anything interactive. That is why every control looks like a slightly
 * lighter rectangle with an edge rather than a coloured slab.
 *
 * Every colour is defined for both light and dark — `ThemeColor` is derived from
 * the intersection of the two, so a key missing from either side is a type error
 * rather than a runtime hole.
 *
 * Read colours through `useTheme()` rather than importing `Colors` directly,
 * unless you genuinely need a specific scheme.
 */

import '@/global.css';

import { Platform } from 'react-native';

export const Colors = {
  light: {
    text: '#0A0A0A',
    textSecondary: '#5A5A5A',
    /** Deliberately low contrast — timestamps, counts, captions. */
    textMuted: '#8C8C8C',

    /** Page background. */
    background: '#FFFFFF',
    /** Cards: one step off the page. */
    surface: '#FAFAFA',
    /** Controls and nested surfaces (a button, a chip on a card). */
    surfaceElevated: '#F4F4F4',
    /** Pressed / selected state. */
    surfaceSelected: '#E8E8E8',
    /** Legacy alias kept so older components keep compiling. */
    backgroundElement: '#FAFAFA',
    backgroundSelected: '#E8E8E8',

    /** Control outlines. Every button carries one. */
    border: '#E4E4E4',
    borderStrong: '#D0D0D0',

    /** The accent, and the fill of a primary button. */
    primary: '#111111',
    onPrimary: '#FAFAFA',
    /** Selected-control fill: a wash of `primary`, not a tint of it. */
    primaryMuted: '#EFEFEF',

    /** Ratings and stars. The one warm colour in the palette. */
    accent: '#E8940C',
    /** Platinum trophies. */
    platinum: '#7C8AA5',

    danger: '#DC2626',
    success: '#16A34A',

    /** Scrim over hero artwork so text stays legible on any cover. */
    scrim: 'rgba(0,0,0,0.55)',
    /** Skeleton placeholder fill. */
    skeleton: '#EDEDED',
  },
  dark: {
    text: '#FAFAFA',
    textSecondary: '#A3A3A3',
    textMuted: '#6E6E6E',

    background: '#0A0A0A',
    surface: '#141414',
    surfaceElevated: '#1C1C1C',
    surfaceSelected: '#282828',
    backgroundElement: '#141414',
    backgroundSelected: '#282828',

    border: '#262626',
    borderStrong: '#383838',

    primary: '#FAFAFA',
    onPrimary: '#0A0A0A',
    primaryMuted: '#1F1F1F',

    accent: '#F5A524',
    platinum: '#A9B6CC',

    danger: '#EF4444',
    success: '#4ADE80',

    scrim: 'rgba(0,0,0,0.65)',
    skeleton: '#1C1C1C',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;
export type ThemePalette = (typeof Colors)['light' | 'dark'];

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
 * 4pt scale. Names are deliberately numeric rather than t-shirt sizes so that
 * `Spacing[4]` reads as "4 units" and stays orderable.
 */
export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 12,
  four: 16,
  five: 24,
  six: 32,
  seven: 48,
  eight: 64,
} as const;

export const Radius = {
  /** Box art. Just enough to not be a hard corner — a real case is nearly square. */
  xs: 4,
  small: 8,
  /**
   * Buttons, icon buttons, segmented controls.
   *
   * Its own step because controls sit between the two: `small` makes a 44pt
   * button look boxy and `medium` makes it look like a card that happens to be
   * tappable. Every interactive rectangle in the app uses this one value, which
   * is most of what makes them read as a family.
   */
  control: 10,
  medium: 12,
  large: 18,
  xlarge: 24,
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
  display: { fontSize: 30, lineHeight: 36, fontFamily: FontFamily.bold },
  title: { fontSize: 22, lineHeight: 28, fontFamily: FontFamily.bold },
  heading: { fontSize: 18, lineHeight: 23, fontFamily: FontFamily.semibold },
  section: { fontSize: 15, lineHeight: 20, fontFamily: FontFamily.semibold },
  body: { fontSize: 14, lineHeight: 21, fontFamily: FontFamily.regular },
  bodyStrong: { fontSize: 14, lineHeight: 20, fontFamily: FontFamily.semibold },
  caption: { fontSize: 12, lineHeight: 17, fontFamily: FontFamily.medium },
  micro: { fontSize: 11, lineHeight: 14, fontFamily: FontFamily.semibold },
} as const;

/**
 * Elevation through shadow rather than borders. Android only reads
 * `elevation`; iOS needs the shadow* group, so both are always set together.
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
 * Motion. Soft and short — the brief asks for polished, not flashy.
 * Anything above ~250ms starts to feel sluggish on a feed.
 */
export const Motion = {
  fast: 140,
  normal: 220,
  slow: 320,
  /** Scale applied while a card is held down. */
  pressScale: 0.97,
} as const;

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
