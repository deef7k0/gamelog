import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';

import { studioCompanyQuery } from '@/hooks/use-studio-catalogue';
import { measureLogoLuminance } from '@/lib/logo-luminance';
import type { StudioLogo } from '@/lib/wikidata/commons';
import { getStudioLogo } from '@/lib/wikidata/studio-logo';

/** Bump to discard every stored answer after a change to how logos are chosen. */
const CACHE_PREFIX = 'studio-logo:v1:';

/** A found logo is kept a month; "no logo" a week, since a free one can be uploaded later. */
const FOUND_TTL_MS = 30 * 24 * 60 * 60_000;
const NONE_TTL_MS = 7 * 24 * 60 * 60_000;

type Stored = { savedAt: number; logo: StudioLogo | null };

/**
 * A studio's verified logo, or null — the studio page's name in its place.
 *
 * ## Cached twice, and "none" is cached too
 *
 * A logo costs three or four Wikimedia requests and one download of the image,
 * and changes about never, so the answer is stored on the device (AsyncStorage)
 * as well as in the query cache: reopening the page — this session or next week
 * — asks no one. "No free logo" is stored as well, or Naughty Dog would be
 * searched for on every visit and found missing every time.
 *
 * **No IGDB request of its own.** The name and slug come from the company
 * request the catalogue makes anyway (`studioCompanyQuery`) — the same query,
 * so it is asked once however the two hooks' timing falls. It used to be a
 * second `companies` request for the same row.
 *
 * A **failure** is never stored: it throws, the query holds no data, the page
 * shows the name, and the next visit asks again. Nothing about the page waits
 * on this — the name is on screen from the route, and the logo replaces it when
 * (and if) it arrives.
 *
 * Not in Supabase: a shared table would spare other devices the lookup, but
 * clients cannot be trusted to write a *verified* answer to it, so it would
 * need a server-side function doing this same check. Worth it only at a scale
 * this does not have yet.
 */
export function useStudioLogo(companyId: number, name: string | undefined) {
  const client = useQueryClient();
  return useQuery({
    queryKey: ['studio-logo', companyId],
    queryFn: ({ signal }) => loadStudioLogo(client, companyId, name, signal),
    enabled: Number.isFinite(companyId),
    staleTime: Infinity,
    gcTime: 60 * 60_000,
    /* Wikimedia rate-limits by IP; a failed logo is not worth asking twice. */
    retry: false,
  });
}

async function loadStudioLogo(
  client: QueryClient,
  companyId: number,
  fallbackName: string | undefined,
  signal?: AbortSignal
): Promise<StudioLogo | null> {
  const key = `${CACHE_PREFIX}${companyId}`;
  const cached = await read(key);
  if (cached !== undefined) return cached;

  /* IGDB's own name and slug: the slug is the exact key into Wikidata, and the
     name is IGDB's rather than whatever the route happened to carry. Only on a
     miss — a stored answer never waits on IGDB. */
  const { identity } = await client.ensureQueryData(studioCompanyQuery(companyId));
  const name = identity?.name ?? fallbackName;
  if (!name) return null;

  const found = await getStudioLogo({ name, slug: identity?.slug ?? null }, signal);
  const logo = found ? { ...found, luminance: await measureLogoLuminance(found.url) } : null;

  try {
    await AsyncStorage.setItem(key, JSON.stringify({ savedAt: Date.now(), logo } satisfies Stored));
  } catch {
    /* A full disk costs a lookup next time, nothing more. */
  }
  return logo;
}

/** The stored answer if it is still fresh — `undefined` when there is none to use. */
async function read(key: string): Promise<StudioLogo | null | undefined> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return undefined;
    const stored = JSON.parse(raw) as Stored;
    if (typeof stored?.savedAt !== 'number') return undefined;
    const ttl = stored.logo ? FOUND_TTL_MS : NONE_TTL_MS;
    if (Date.now() - stored.savedAt > ttl) return undefined;
    if (
      stored.logo &&
      (typeof stored.logo.url !== 'string' || !stored.logo.url.startsWith('https://'))
    ) {
      return undefined;
    }
    return stored.logo ?? null;
  } catch {
    return undefined;
  }
}
