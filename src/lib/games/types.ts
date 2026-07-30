/**
 * One normalized game shape, whatever platform it came from.
 *
 * Every provider maps its own response into this so the UI never branches on
 * platform. `id` is the app-wide identity and is always `${source}:${sourceId}`
 * — stable, human-readable, and safe to use as a React key or route param.
 */
export type GameSource = 'igdb' | 'rawg' | 'steam' | 'itch';

/**
 * Search cards and the detail hero need different art:
 *  - `coverUrl` is portrait box art (2:3). The primary visual everywhere.
 *  - `heroUrl` is landscape key art, used behind the detail page header.
 *
 * Steam only publishes landscape headers, so its `coverUrl` is null and the UI
 * falls back to the hero. IGDB is the only source with true portrait covers,
 * which is why it is the preferred provider.
 */
export type Game = {
  /** `${source}:${sourceId}` — e.g. "igdb:1029" */
  id: string;
  source: GameSource;
  /** The provider's own id, as a string. */
  sourceId: string;
  title: string;
  /** Portrait box art (2:3), or null if this provider has none. */
  coverUrl: string | null;
  /** Landscape key art for hero headers. */
  heroUrl: string | null;
  /** Plain text — providers that return HTML are stripped before this point. */
  description: string | null;
  releaseDate: string | null;
  releaseYear: number | null;
  developer: string | null;
  publisher: string | null;
  genres: string[];
  /** Human-readable platform names: "PlayStation 5", "PC (Microsoft Windows)". */
  platforms: string[];
  /** Provider's own score, normalized to 0-100. */
  score: number | null;
  storeUrl: string | null;
  screenshots: string[];
};

/**
 * Search results carry enough for a rich card — poster, year, studio, platforms
 * and score — so the list does not need a follow-up request per row.
 */
export type GameSearchResult = Pick<
  Game,
  | 'id'
  | 'source'
  | 'sourceId'
  | 'title'
  | 'coverUrl'
  | 'heroUrl'
  | 'releaseYear'
  | 'developer'
  | 'genres'
  | 'platforms'
  | 'score'
>;

/** One achievement definition, shared across every user who owns the game. */
export type Achievement = {
  /** `${gameId}:${externalId}` */
  id: string;
  gameId: string;
  externalId: string;
  name: string;
  description: string | null;
  iconUrl: string | null;
  /** Percent of all players who unlocked it, when reported. */
  globalPercent: number | null;
  hidden: boolean;
};

export type GameProvider = {
  source: GameSource;
  /** Human label for UI ("IGDB", "RAWG"). */
  label: string;
  /**
   * Whether this provider can actually run right now. Providers needing an API
   * key report false when the key is missing, and the aggregator skips them
   * instead of failing the whole search.
   */
  isEnabled: () => boolean;
  search: (query: string, signal?: AbortSignal) => Promise<GameSearchResult[]>;
  getById: (sourceId: string, signal?: AbortSignal) => Promise<Game | null>;
  /** Optional: not every provider exposes achievements. */
  getAchievements?: (sourceId: string, signal?: AbortSignal) => Promise<Achievement[]>;
};

export function makeGameId(source: GameSource, sourceId: string | number): string {
  return `${source}:${sourceId}`;
}

/** Inverse of `makeGameId`. Returns null on anything malformed. */
export function parseGameId(id: string): { source: GameSource; sourceId: string } | null {
  const separator = id.indexOf(':');
  if (separator < 1) return null;

  const source = id.slice(0, separator);
  const sourceId = id.slice(separator + 1);
  if (!sourceId) return null;
  if (source !== 'igdb' && source !== 'rawg' && source !== 'steam' && source !== 'itch') {
    return null;
  }

  return { source, sourceId };
}

/** Pull a four-digit year out of the wildly inconsistent date strings providers return. */
export function yearFrom(value: string | null | undefined): number | null {
  if (!value) return null;
  const match = value.match(/\b(19|20)\d{2}\b/);
  return match ? Number(match[0]) : null;
}

/**
 * Providers return store descriptions as HTML. We render into <Text>, which has
 * no HTML parser, so flatten to something readable rather than showing raw tags.
 */
export function stripHtml(html: string | null | undefined): string | null {
  if (!html) return null;

  const text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  return text || null;
}
