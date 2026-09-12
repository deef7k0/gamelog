import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { APP_SCHEME } from '@/hooks/use-theme';
import { useAlbumArtColor } from '@/hooks/use-album-art-color';
import {
  FALLBACK_SEED,
  generateDynamicTheme,
  type DynamicThemeColors,
} from '@/theme/dynamic-color';

/**
 * Material 3 dynamic colour, scoped to a subtree.
 *
 * ## Why there is no fade
 *
 * The brief allowed "a simple fade or instant swap". It is an instant swap, and
 * the reason is that the thing which actually changes is the *artwork*, not the
 * palette. Every screen using this is keyed on the game — a new game is a new
 * mount, with its own arrival springs and crossfade already running — so the
 * colours arrive as part of that transition rather than as a separate one.
 *
 * There is one case where the palette changes under a mounted tree: the seed
 * resolves a beat after the screen opens, because extraction is a network round
 * trip on a cold cache. Crossfading *that* would be worse, not better. It would
 * mean animating from the fallback purple to the game's real colour on every
 * first visit — drawing attention to the one moment the app would rather nobody
 * noticed. `artwork-color.ts` caches in `AsyncStorage` for good, so it happens
 * once per game, ever.
 *
 * ## Why the whole scheme is memoised on the seed
 *
 * `generateDynamicTheme` builds five tonal palettes and reads twenty-three tones
 * off them — cheap, but not free, and it would otherwise run on every render of
 * every consumer's parent. The seed is a string, so the memo is exact.
 */

const DEFAULT_COLORS = generateDynamicTheme(FALLBACK_SEED, APP_SCHEME === 'dark');

const DynamicThemeContext = createContext<DynamicThemeColors>(DEFAULT_COLORS);

export type DynamicThemeProviderProps = {
  children: ReactNode;
  /**
   * The artwork the palette is read from — a game's cover, by preference.
   *
   * Named for the brief's music-player framing; here it is box art. The cover
   * rather than the hero because the cover is the image a player pictures when
   * they think of the game, and it is the one the case on screen is showing.
   */
  albumArtUri?: string | null;
  /**
   * Which half of the tone table to read.
   *
   * Defaults to the app's own scheme, which is `'dark'` and is not a user
   * setting — `APP_SCHEME` is a constant and `Colors` has no light half at all
   * (see CLAUDE.md: "this app is a dark room by design"). The prop exists so the
   * generator's light column is reachable and testable rather than dead, and so
   * that wiring this to a real preference later is a one-line change here rather
   * than a redesign.
   */
  isDark?: boolean;
  /** Skip extraction and use this seed. For a preview, a tier row, a test. */
  seed?: string | null;
};

export function DynamicThemeProvider({
  children,
  albumArtUri,
  isDark = APP_SCHEME === 'dark',
  seed,
}: DynamicThemeProviderProps) {
  const extracted = useAlbumArtColor(seed ? null : albumArtUri);
  const source = seed ?? extracted;

  const colors = useMemo(() => generateDynamicTheme(source, isDark), [source, isDark]);

  return <DynamicThemeContext.Provider value={colors}>{children}</DynamicThemeContext.Provider>;
}

/**
 * Publish an already-computed scheme.
 *
 * `<AccentProvider>` has resolved the hue and built the roles by the time it
 * renders, so it hands the result down rather than making this provider extract
 * the same artwork a second time. That is the only way both contexts can be
 * guaranteed to agree: two independent extractions of the same URI would agree
 * *in practice*, through the shared query cache, and disagreeing during the one
 * frame before that cache fills is exactly the bug nobody would find.
 */
export function DynamicThemeValueProvider({
  colors,
  children,
}: {
  colors: DynamicThemeColors;
  children: ReactNode;
}) {
  return <DynamicThemeContext.Provider value={colors}>{children}</DynamicThemeContext.Provider>;
}

/**
 * The M3 roles in force for this part of the tree.
 *
 * Safe to call anywhere: outside a provider it resolves to the baseline purple
 * scheme, so a shared primitive can read it unconditionally rather than
 * branching on whether it happens to be on a game screen.
 */
export function useDynamicTheme(): DynamicThemeColors {
  return useContext(DynamicThemeContext);
}

/**
 * The scheme for a seed, computed on the spot.
 *
 * For the component that *renders* the provider and therefore cannot consume it
 * — a component is not inside its own context. Same inputs, same result, so the
 * value matches what the children below will read.
 */
export function useDynamicThemeFor(
  albumArtUri: string | null | undefined,
  isDark: boolean = APP_SCHEME === 'dark'
): DynamicThemeColors {
  const seed = useAlbumArtColor(albumArtUri);
  return useMemo(() => generateDynamicTheme(seed, isDark), [seed, isDark]);
}
