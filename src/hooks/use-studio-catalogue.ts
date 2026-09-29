import { queryOptions, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { getStudioCompany, getStudioGames } from '@/lib/games/igdb';

/**
 * The widest art the studio banner can crop to its square. IGDB's first
 * "artwork" is sometimes a wordmark strip rather than key art — Elden Ring's is
 * 1920×295, 6.5:1 — and a square crop of that is a close-up of one black letter.
 * Steam's 3.1:1 `library_hero` passes.
 */
export const BANNER_MAX_ASPECT = 3.2;

/** A studio's catalogue changes when it ships something — not within a visit. */
const CATALOGUE_STALE_MS = 30 * 60_000;

/**
 * Kept for the whole of that time after the page closes. The default five
 * minutes meant stepping into a game and back out later re-asked IGDB for all
 * 200 games, and the banner and its colour waited on the answer again.
 */
const CATALOGUE_GC_MS = 30 * 60_000;

/**
 * The company request — identity and game ids — shared by the catalogue and the
 * logo, so opening a studio asks IGDB about the company once.
 *
 * A company's name, slug and back catalogue move more slowly than its newest
 * release, so it is fresh for a day; the catalogue it feeds refetches on its own
 * clock.
 */
export function studioCompanyQuery(companyId: number) {
  return queryOptions({
    queryKey: ['studio-company', companyId],
    queryFn: ({ signal }) => getStudioCompany(companyId, signal),
    staleTime: 24 * 60 * 60_000,
    gcTime: CATALOGUE_GC_MS,
  });
}

/** The catalogue: the company request, then its games — see `getStudioCompany`. */
function studioCatalogueQuery(companyId: number, client: QueryClient) {
  return queryOptions({
    queryKey: ['studio-catalogue', companyId],
    queryFn: async ({ signal }) => {
      const company = await client.ensureQueryData(studioCompanyQuery(companyId));
      return getStudioGames(
        companyId,
        company.gameIds,
        { maxHeroAspect: BANNER_MAX_ASPECT },
        signal
      );
    },
    staleTime: CATALOGUE_STALE_MS,
    gcTime: CATALOGUE_GC_MS,
  });
}

/**
 * A studio's games, newest first, 200 at most — two IGDB requests on a cold
 * visit, none on a warm one.
 */
export function useStudioCatalogue(companyId: number) {
  const client = useQueryClient();
  return useQuery({
    ...studioCatalogueQuery(companyId, client),
    enabled: Number.isFinite(companyId),
  });
}
