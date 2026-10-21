import { useQuery } from '@tanstack/react-query';
import { decode } from 'jpeg-js';

import { meshImages, meshOf, meshSourceUrl, seedOf, whiteHoldsOn } from '@/lib/artwork-mesh';

/** What `<ArtworkMeshPage>` draws, and what is drawn over it. */
export type ArtworkMeshImages = {
  /** The mesh, a data URI, hung from the seam down. */
  page: string;
  /** Its first row, a data URI, held behind the artwork above the seam. */
  seam: string;
  /** How bright the artwork's top band is — the top wash's strength. */
  topLuminance: number;
  /** Whether white type holds on the page where the keys stand. */
  whiteHolds: boolean;
};

/** Larger than any cover thumbnail (~5 KB), far below anything that would be felt. */
const MAX_BYTES = 60_000;
const MAX_MP = 0.05;

/**
 * SimpMusic's Apple Music page for one cover (`lib/artwork-mesh.ts`), or null
 * until it is read — and null for good when it cannot be, where the caller's
 * own page colour stands in.
 *
 * One ~5 KB thumbnail, decoded in JavaScript as the accent's is (`jpeg-js`, so
 * it runs in Expo Go), averaged to thirty-six cells. A query keyed on the
 * thumbnail, never written to the device (`NEVER_PERSIST`): it is cheaper to
 * read again than to keep.
 */
export function useArtworkMesh(coverUrl: string | null | undefined): ArtworkMeshImages | null {
  const source = meshSourceUrl(coverUrl);
  const query = useQuery({
    queryKey: ['artwork-mesh', source],
    queryFn: async ({ signal }) => {
      const response = await fetch(source!, { signal });
      if (!response.ok) return null;
      const bytes = new Uint8Array(await response.arrayBuffer());
      if (bytes.byteLength > MAX_BYTES) return null;
      /* `useTArray`: a Uint8Array, not Node's Buffer, which React Native has
         not got. */
      const image = decode(bytes, {
        useTArray: true,
        maxMemoryUsageInMB: 8,
        maxResolutionInMP: MAX_MP,
      });
      const mesh = meshOf(image.data, image.width, image.height, seedOf(source!));
      if (!mesh) return null;
      return {
        ...meshImages(mesh),
        topLuminance: mesh.topLuminance,
        whiteHolds: whiteHoldsOn(mesh, 0.2, 0.9),
      };
    },
    enabled: !!source,
    staleTime: Infinity,
    retry: false,
  });
  return query.data ?? null;
}
