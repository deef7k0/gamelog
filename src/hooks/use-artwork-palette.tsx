import { useQuery } from '@tanstack/react-query';

import { extractArtworkColor } from '@/lib/artwork-color';

/**
 * A game's three-depth colour ramp, read from its cover art.
 *
 * Returns `null` until the extraction resolves, and `null` for good when the art
 * has no dominant hue — both mean "use the fallback", which every consumer
 * already has to handle anyway.
 *
 * Shares its query key with `useAccent`, so a screen that reads both the accent
 * and the ramp — the game page does — pays for one fetch and one decode. The
 * result is cached in `AsyncStorage` beyond that, keyed by cover URL, because a
 * piece of box art does not change colour.
 */
export function useArtworkPalette(
  artwork: string | null | undefined
): readonly [string, string, string] | null {
  const extracted = useQuery({
    queryKey: ['artwork-color', artwork],
    queryFn: () => extractArtworkColor(artwork!),
    enabled: !!artwork,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return extracted.data?.palette ?? null;
}
