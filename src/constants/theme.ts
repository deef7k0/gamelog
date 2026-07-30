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

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: 'var(--font-display)',
    serif: 'var(--font-serif)',
    rounded: 'var(--font-rounded)',
    mono: 'var(--font-mono)',
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

/** Generous radii — the brief calls for rounded corners throughout. */
export const Radius = {
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
 * Type scale. Hierarchy matters more than raw size, so each step pairs a size
 * with a line height and weight that hold together.
 */
export const Type = {
  display: { fontSize: 34, lineHeight: 40, fontWeight: '800' },
  title: { fontSize: 26, lineHeight: 32, fontWeight: '800' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '700' },
  section: { fontSize: 17, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22, fontWeight: '400' },
  bodyStrong: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '500' },
  micro: { fontSize: 11, lineHeight: 14, fontWeight: '600' },
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

export const MaxContentWidth = 800;
