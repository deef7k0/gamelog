import { useQuery, type QueryClient } from '@tanstack/react-query';

import { platformKeyForStored } from '@/constants/platform-family';
import type { CopyWithRelations } from '@/lib/api';
import { NO_COPY_ART, getCopyArt, type CopyArt, type CopyArtQuery } from '@/lib/api/copy-art';

/** A day: the function keeps its answers for months; the phone asks again daily. */
const COPY_ART_STALE_MS = 24 * 60 * 60_000;

/** What a copy is looked up by, or null when it has no game or platform to go on. */
export function copyArtQuery(
  copy: Pick<CopyWithRelations, 'platform' | 'region' | 'game'> | null | undefined
): CopyArtQuery | null {
  const platform = platformKeyForStored(copy?.platform);
  const title = copy?.game?.title?.trim();
  if (!platform || platform === 'other' || !title) return null;
  return { title, platform, region: copy?.region ?? null };
}

function keyFor(query: CopyArtQuery | null) {
  return ['copy-art', query?.platform ?? null, query?.region ?? null, query?.title ?? null];
}

/**
 * A copy's back cover and disc label (`getCopyArt`), shared by every copy of
 * the same game, platform and region. Small answers — three addresses — kept
 * on the device like any query.
 */
export function useCopyArt(
  copy: Pick<CopyWithRelations, 'platform' | 'region' | 'game'> | null | undefined
): CopyArt {
  const query = copyArtQuery(copy);
  const art = useQuery({
    queryKey: keyFor(query),
    queryFn: ({ signal }) => getCopyArt(query!, signal),
    enabled: !!query,
    staleTime: COPY_ART_STALE_MS,
    retry: false,
  });
  return art.data ?? NO_COPY_ART;
}

/** Start the lookup as a copy is saved, so its page opens with it under way. */
export function prefetchCopyArt(queryClient: QueryClient, query: CopyArtQuery | null): void {
  if (!query) return;
  void queryClient.prefetchQuery({
    queryKey: keyFor(query),
    queryFn: ({ signal }) => getCopyArt(query, signal),
    staleTime: COPY_ART_STALE_MS,
  });
}
