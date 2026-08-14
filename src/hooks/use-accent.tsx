import { useQuery } from '@tanstack/react-query';
import { createContext, useContext, useMemo, type ReactNode } from 'react';

import { identityColorFor } from '@/constants/identity';
import { accentRoles, type AccentRoles } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { extractArtworkColor } from '@/lib/artwork-color';

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
  const roles = useMemo(() => accentRoles(hue), [hue]);

  return <AccentContext.Provider value={roles}>{children}</AccentContext.Provider>;
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
 * The extraction is a TanStack Query keyed on the URL, so it is fetched and
 * decoded once per game per session and served from `AsyncStorage` on every
 * later visit — see `artwork-color.ts`. While it resolves, the genre hue is
 * already on screen, which is why the page never opens colourless and then
 * lurches: the two are usually close, and the change lands as a settle rather
 * than a flash.
 */
function useArtworkHue({
  artwork,
  genres,
  color,
}: Pick<AccentProviderProps, 'artwork' | 'genres' | 'color'>): string {
  const theme = useTheme();
  const fallback = color ?? identityColorFor(genres, theme);

  const extracted = useQuery({
    queryKey: ['artwork-color', artwork],
    queryFn: () => extractArtworkColor(artwork!),
    enabled: !color && !!artwork,
    // The colour of a piece of box art does not change. Ever.
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return color ?? extracted.data?.color ?? fallback;
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
  return useMemo(() => accentRoles(hue), [hue]);
}
