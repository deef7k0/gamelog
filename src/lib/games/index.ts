import { getSimilarGames, igdbProvider } from './igdb';
import { itchProvider } from './itch';
import { rawgProvider } from './rawg';
import { steamProvider } from './steam';
import {
  parseGameId,
  type Achievement,
  type Game,
  type GameProvider,
  type GameSearchResult,
} from './types';

export * from './types';
export * from './sort';
export { fetchSteamUnlocks, isSteamAchievementSyncAvailable } from './steam';

/**
 * IGDB is the *only* catalogue the app surfaces.
 *
 * Search, discovery, charts, franchises, studios and cast all come from one
 * source, so a game has exactly one identity everywhere: the cover you saw in
 * search is the cover on the game page is the cover in your collection. Mixing
 * catalogues used to mean the same title appeared twice with different art,
 * different years and a different id depending on which screen found it first —
 * and only IGDB publishes true portrait box art, which this whole UI is built
 * around. Steam, RAWG and itch.io lost that comparison on every axis that
 * matters here.
 *
 * Adding a provider back means adding it here *and* accepting the dedupe
 * problem again — read the note on `LOOKUP_PROVIDERS` first.
 */
const PROVIDERS: GameProvider[] = [igdbProvider];

/**
 * Providers consulted when resolving an id that already exists.
 *
 * Wider than `PROVIDERS` on purpose. Nothing new can enter the app as a
 * `steam:`/`rawg:`/`itch:` game any more, but rows logged before the cutover
 * still carry those ids, and so do games matched from a linked Steam library.
 * Dropping them from lookup would turn every one of those into a dead page;
 * keeping them read-only lets old data open while no new data is created.
 */
const LOOKUP_PROVIDERS: GameProvider[] = [igdbProvider, steamProvider, rawgProvider, itchProvider];

export function enabledProviders(): GameProvider[] {
  return PROVIDERS.filter((provider) => provider.isEnabled());
}

function providerFor(source: string): GameProvider | undefined {
  return LOOKUP_PROVIDERS.find((provider) => provider.source === source);
}

/**
 * Search IGDB.
 *
 * Kept as a fan-out over `enabledProviders()` rather than a direct call to
 * `igdbProvider.search` so the aggregation, dedupe and per-provider failure
 * handling stay in one place if a second catalogue is ever justified again.
 */
export async function searchGames(
  query: string,
  signal?: AbortSignal
): Promise<GameSearchResult[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const providers = enabledProviders();
  const settled = await Promise.allSettled(
    providers.map((provider) => provider.search(trimmed, signal))
  );

  const succeeded = settled.filter(
    (result): result is PromiseFulfilledResult<GameSearchResult[]> => result.status === 'fulfilled'
  );

  if (succeeded.length === 0 && settled.length > 0) {
    const firstError = settled.find(
      (result): result is PromiseRejectedResult => result.status === 'rejected'
    );
    throw firstError?.reason instanceof Error ? firstError.reason : new Error('Game search failed');
  }

  return dedupe(interleave(succeeded.map((result) => result.value)));
}

/**
 * Round-robin the per-provider lists so a provider that returns 40 results
 * cannot bury one that returned 3. Preserves each provider's own relevance
 * ordering within its list.
 */
function interleave(lists: GameSearchResult[][]): GameSearchResult[] {
  const merged: GameSearchResult[] = [];
  const longest = Math.max(0, ...lists.map((list) => list.length));

  for (let i = 0; i < longest; i++) {
    for (const list of lists) {
      const item = list[i];
      if (item) merged.push(item);
    }
  }
  return merged;
}

/**
 * IGDB itself lists re-releases and regional cuts as separate games, so collapse
 * obvious duplicates on title + release year and keep the first — which is the
 * one IGDB ranked highest for the query.
 */
function dedupe(results: GameSearchResult[]): GameSearchResult[] {
  const seen = new Set<string>();
  const unique: GameSearchResult[] = [];

  for (const result of results) {
    const key = `${result.title.toLowerCase().replace(/[^a-z0-9]/g, '')}|${result.releaseYear ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(result);
  }
  return unique;
}

/**
 * Games IGDB considers similar to this one.
 *
 * Only IGDB publishes this relationship, so a legacy Steam/RAWG/itch.io row
 * returns an empty list rather than a fabricated one.
 */
export async function getSimilarTo(id: string, signal?: AbortSignal): Promise<GameSearchResult[]> {
  const parsed = parseGameId(id);
  if (parsed?.source !== 'igdb' || !igdbProvider.isEnabled()) return [];

  try {
    return await getSimilarGames(parsed.sourceId, signal);
  } catch {
    // A recommendation rail is not worth failing the page over.
    return [];
  }
}

/** Look up one game by its app-wide `${source}:${sourceId}` id. */
export async function getGameById(id: string, signal?: AbortSignal): Promise<Game | null> {
  const parsed = parseGameId(id);
  if (!parsed) return null;

  const provider = providerFor(parsed.source);
  if (!provider || !provider.isEnabled()) return null;

  return provider.getById(parsed.sourceId, signal);
}

/**
 * Achievement definitions for a game, when its provider has any.
 *
 * IGDB has no achievement data at all, so every game added through search
 * returns an empty list and the UI treats that as "no achievements tracked"
 * rather than an error. Only legacy `steam:` rows and games matched from a
 * linked Steam account can still resolve definitions here.
 */
export async function getGameAchievements(
  id: string,
  signal?: AbortSignal
): Promise<Achievement[]> {
  const parsed = parseGameId(id);
  if (!parsed) return [];

  const provider = providerFor(parsed.source);
  if (!provider?.isEnabled() || !provider.getAchievements) return [];

  return provider.getAchievements(parsed.sourceId, signal);
}
