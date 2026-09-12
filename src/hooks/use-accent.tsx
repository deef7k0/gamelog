import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { identityColorFor } from '@/constants/identity';
import { accentRoles, type AccentRoles } from '@/constants/theme';
import { useAlbumArtColor } from '@/hooks/use-album-art-color';
import { useTheme } from '@/hooks/use-theme';
import { DynamicThemeValueProvider } from '@/theme/dynamic-theme-provider';

/**
 * The accent in force for this part of the tree.
 *
 * Context rather than props, for one specific reason: the controls that should
 * take a game's colour are nowhere near the screen that knows what game it is.
 * `<Button>`, `<TabBar>` and `<Chip>` are shared primitives used by forty
 * screens, and threading `accent` down to each of them would put a prop on
 * every one of those call sites to change the behaviour of four.
 *
 * **The default is the house blue**, so nothing changes anywhere until a screen
 * opts in. `<AccentProvider>` wraps a game's page — and only a game's page, plus
 * the screens that are about one game (log, review, achievements, diary). The
 * feed, search, news and profile stay on `primary` deliberately: twenty games in
 * a list is twenty hues, and a scrolling fruit salad is not identity, it is
 * noise. Colour identifies a game when you are looking at *that game*.
 */
const AccentContext = createContext<AccentRoles | null>(null);

export type AccentProviderProps = {
  children: ReactNode;
  /**
   * The game's artwork. Its dominant colour becomes the accent — the cover by
   * preference, since it is the image the player pictures when they think of
   * the game.
   */
  artwork?: string | null;
  /** The game's genres. The fallback hue when the artwork yields no colour. */
  genres?: readonly string[] | null;
  /** Bypass everything with an explicit hue. For a tier row or a preview. */
  color?: string | null;
};

export function AccentProvider({ children, artwork, genres, color }: AccentProviderProps) {
  const hue = useArtworkHue({ artwork, genres, color });
  /* `tonal`: this hue came off box art, so the whole screen is built out of it —
     a Material 3 tonal palette seeds the page, the surfaces, the cards and the
     one loud fill. The house blue below stays in the legacy mode. See
     `accentRoles`. */
  const roles = useMemo(() => accentRoles(hue, { tonal: true }), [hue]);

  /* Both contexts, from one extraction. `useAccent()` is what the app's own
     components read; `useDynamicTheme()` is the full M3 role set underneath it,
     for the places that need a role the app's ten have no name for. Nesting them
     rather than mounting `<DynamicThemeProvider>` separately is what guarantees
     they agree — two independent extractions of the same URI would agree only
     once the shared query cache had filled. */
  return (
    <AccentContext.Provider value={roles}>
      <DynamicThemeValueProvider colors={roles.m3}>{children}</DynamicThemeValueProvider>
    </AccentContext.Provider>
  );
}

/**
 * The hue for a game: read from its artwork, falling back to its genres.
 *
 * Two sources, in that order, and the order is the whole point. The artwork is
 * the honest answer — a page lit in the colour of the box on it — but it can
 * fail: the network is down, a legacy Steam URL 404s, or the art genuinely has
 * no dominant hue (Celeste's cover is several colours and no one of them wins).
 * The genre ramp is what catches all of that, so a page always has a colour and
 * never a grey hole where one should be.
 *
 * The extraction is a TanStack Query keyed on the URL, so it runs once per game
 * per session and is served from `AsyncStorage` on every later visit — see
 * `use-album-art-color.ts`. While it resolves, the genre hue is already on
 * screen, which is why the page never opens colourless and then lurches: the two
 * are usually close, and the change lands as a settle rather than a flash.
 */
function useArtworkHue({
  artwork,
  genres,
  color,
}: Pick<AccentProviderProps, 'artwork' | 'genres' | 'color'>): string {
  const theme = useTheme();
  const fallback = color ?? identityColorFor(genres, theme);

  /*
   * `useAlbumArtColor` rather than a query on `extractArtworkColor` directly.
   *
   * Two changes, both of which matter. It reaches for `react-native-image-colors`
   * first — the native extractor, which reads the decoded bitmap and handles
   * every format the platform can display — and falls back to the pure-JS JPEG
   * decoder only where that module cannot load, which is Expo Go. And it seeds
   * from the artwork's **raw dominant colour** rather than from the normalised
   * accent hue that `extractArtworkColor` also returns.
   *
   * That second one is the important one now. The normalisation existed to drag
   * a muted average up to something usable as a button fill, because the old
   * ramp used the hue directly at a fixed saturation. A Material 3 palette does
   * that job itself and does it better: `TONAL_SPOT` rebuilds the primary
   * palette at chroma 36 whatever the seed's own chroma was. Pre-saturating the
   * seed would be applying the correction twice.
   */
  const seed = useAlbumArtColor(color ? null : artwork, { fallback });

  return color ?? seed;
}

/**
 * The accent roles for the current screen.
 *
 * Safe to call from any component: outside a provider it resolves to the house
 * blue, so a primitive can read it unconditionally rather than branching on
 * whether it happens to be on a game page.
 */
export function useAccent(): AccentRoles {
  const theme = useTheme();
  const provided = useContext(AccentContext);
  const house = useMemo(() => accentRoles(theme.primary), [theme.primary]);
  return provided ?? house;
}

/**
 * A game's accent, computed on the spot.
 *
 * For the screen that *renders* the provider and therefore cannot consume it —
 * a component is not inside its own context. Same two sources in the same
 * order, so the value matches what the children below will read.
 */
export function useGameAccent(
  artwork: string | null | undefined,
  genres: readonly string[] | null | undefined
): AccentRoles {
  const hue = useArtworkHue({ artwork, genres });
  return useMemo(() => accentRoles(hue, { tonal: true }), [hue]);
}
