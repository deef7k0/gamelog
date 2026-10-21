import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { useGameColours } from '@/hooks/use-game-colours';
import { useTheme } from '@/hooks/use-theme';
import { extractDominantColor } from '@/lib/artwork-color';
import { immersiveBackground, nearBlackBackground } from '@/lib/immersive-color';

/**
 * The page colour for a screen whose background is one piece of artwork — a
 * collection with a single cover, a studio under its banner — or null.
 *
 * Null means "use the ordinary page": there is no artwork (a four-cover
 * collection, a studio whose catalogue has not loaded), its colour is still
 * being read, or nothing survived Palette's filter. Callers fall back to
 * `theme.background` rather than to a guessed colour, so a page never flashes
 * a hue that is about to change.
 *
 * **The background only.** This colour is never handed to a control: buttons,
 * pills and links on these screens keep the app's own neutral styles, and the
 * accent stays the house blue. That is the difference from `<AccentProvider>`,
 * which re-colours a whole screen from a game's art — right for a game's own
 * page, wrong for a studio or a shelf, which are about many games.
 *
 * `textMuted` is passed as the ink to protect: the page darkens further in the
 * rare case where a saturated cover would put that grey under AA.
 *
 * `depth: 'black'` is the studio page's: near black with the colour's hue as
 * a trace (`nearBlackBackground`), so a trailer's letterbox bars meet it
 * without an edge (2026-10-17). A collection keeps SimpMusic's darkening.
 *
 * **Off with game colours** (Settings → Game colours, the owner's, 2026-10-20:
 * "it should apply for collection and studio page"). Nothing is decoded; a
 * collection is the app's page (null), and a studio keeps its near black —
 * from the app's own page colour, not the art's — so a trailer's letterbox
 * bars still meet it without an edge.
 */
export function useImmersiveBackground(
  artwork: string | null | undefined,
  { depth = 'immersive' }: { depth?: 'immersive' | 'black' } = {}
): string | null {
  const theme = useTheme();
  const colours = useGameColours();

  const dominant = useQuery({
    queryKey: ['artwork-dominant', artwork],
    queryFn: () => extractDominantColor(artwork!),
    enabled: !!artwork && colours.on,
    /* An image's colours do not change; the far cache is AsyncStorage. */
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const color = artwork && colours.on ? (dominant.data ?? null) : null;
  return useMemo(
    () =>
      !colours.on
        ? depth === 'black'
          ? nearBlackBackground(theme.background)
          : null
        : !color
          ? null
          : depth === 'black'
            ? nearBlackBackground(color)
            : immersiveBackground(color, { ink: theme.textMuted }),
    [colours.on, color, depth, theme.background, theme.textMuted]
  );
}
