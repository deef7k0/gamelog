import { createContext, createElement, useContext, useMemo, type ReactNode } from 'react';

import { Colors } from '@/constants/theme';

/**
 * The app is dark, always.
 *
 * Not a default the OS can override: the design is a dark room, the surface
 * steps that carry every bit of depth are tuned for it, and a light counterpart
 * would be a second product rather than a second stylesheet. Exported so that
 * anything needing to name the scheme — `expo-blur`'s `tint`, a status bar
 * style — asks this constant instead of guessing.
 */
export const APP_SCHEME = 'dark' as const;

/**
 * The palette as components read it. Its type is the palette's literal one,
 * which a dozen helpers take; a page's inks (`ThemeInks`) are other strings of
 * the same kind, and are cast to it in the one place they are made.
 */
export type ThemeColors = (typeof Colors)[typeof APP_SCHEME];

const ThemeContext = createContext<ThemeColors | null>(null);

export function useTheme(): ThemeColors {
  return useContext(ThemeContext) ?? Colors[APP_SCHEME];
}

/**
 * The inks of a page whose colour is its artwork's — the game page's, from
 * its hero (`lib/page-color`, `pageInks`): white, and white at 60% for
 * everything quieter, the brief's two levels. Every `<Text>` and every
 * component reading `useTheme()` below takes them; nothing else changes.
 */
export type PageInks = { text: string; secondary: string; rule: string };

/**
 * Sets the page's inks for everything under it, or — with `inks={null}` —
 * puts the app's own back.
 *
 * **The reset is load-bearing.** The physical case's printed back is set in
 * `text`, `textSecondary` and `textMuted` (`game-case-back`), and the case is
 * protected: it must render exactly as it always has. So wherever a page with
 * its own inks draws a case, the case is wrapped in `<ThemeInks inks={null}>`
 * — the Platforms section does — and the case's own files are not touched.
 */
export function ThemeInks({ inks, children }: { inks: PageInks | null; children: ReactNode }) {
  const text = inks?.text;
  const secondary = inks?.secondary;
  const rule = inks?.rule;
  const value = useMemo<ThemeColors | null>(
    () =>
      text && secondary && rule
        ? ({
            ...Colors[APP_SCHEME],
            text,
            textSecondary: secondary,
            textMuted: secondary,
            proseInk: secondary,
            border: rule,
          } as unknown as ThemeColors)
        : null,
    [text, secondary, rule]
  );
  return createElement(ThemeContext.Provider, { value }, children);
}
