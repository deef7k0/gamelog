import type { ThemeColor } from './theme';

/**
 * How one onboarding page is coloured — the owner's reference (2026-10-15).
 *
 * Two kinds of page, and which is which is the rule: **black when the app asks
 * about you, a poster colour when it asks for access.** The reference does the
 * same — its questions are black and its permission and integration screens
 * are red, cobalt and pink, edge to edge — and the change of colour is how a
 * reader knows they are being asked for something rather than told something.
 *
 * Every field names a token in `theme.ts`, never a hex, so the palette stays in
 * one place; `poster.test.ts` reads those tokens and holds every pair below at
 * AA (3:1 for the headline, which is large; 4.5:1 for everything else).
 */
export type PosterTheme = {
  /** The page, edge to edge. */
  page: ThemeColor;
  /** The headline, the brackets and the progress dashes. */
  ink: ThemeColor;
  /** The sentence in the brackets and the mono instruction. */
  quiet: ThemeColor;
  /** The full-width pill. */
  button: ThemeColor;
  buttonInk: ThemeColor;
  /** "Not now", under the pill. */
  link: ThemeColor;
};

export type PosterKey = 'night' | 'red' | 'cobalt' | 'pink';

export const POSTER_THEMES: Record<PosterKey, PosterTheme> = {
  night: {
    page: 'onboardingPage',
    ink: 'text',
    quiet: 'textMuted',
    button: 'posterPaper',
    buttonInk: 'posterNavy',
    link: 'text',
  },
  /* The reference's location page. Here: the last one, the games you'll like. */
  red: {
    page: 'posterRed',
    ink: 'posterRedInk',
    quiet: 'posterRedInk',
    button: 'posterRedInk',
    buttonInk: 'text',
    link: 'posterRedInk',
  },
  /* Notifications, as in the reference. */
  cobalt: {
    page: 'posterCobalt',
    ink: 'posterButter',
    quiet: 'posterButter',
    button: 'posterButter',
    buttonInk: 'posterNavy',
    link: 'text',
  },
  /* Bringing a linked account, as in the reference ("bring your runs."). */
  pink: {
    page: 'posterPink',
    ink: 'posterPinkInk',
    quiet: 'posterPinkInk',
    button: 'posterPinkInk',
    buttonInk: 'text',
    link: 'posterPinkInk',
  },
};
