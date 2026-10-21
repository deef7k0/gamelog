/**
 * The things a game *is* in IGDB's vocabulary — its genres, themes, modes,
 * perspectives, engine, series, franchises, languages and age ratings — as
 * ways to find more games like it.
 *
 * Pure, so `npm test` holds it (`facets.test.ts`). It imports nothing.
 *
 * ## The owner's request (2026-10-16)
 *
 * "Every information in the details card should be tappable and it should show
 * games from that specific thing… users can tap 'thriller' and they are sent to
 * the search screen with the selected theme. The search screen should include
 * options for looking stuff like genres, where the user types the genre and
 * the app gives the options, same for perspective, themes, engine, etc."
 *
 * A **facet** is one of those values — `{ kind: 'theme', id: 20, name:
 * 'Thriller' }` — and `facetClause` is how IGDB is asked for its games. The
 * details card makes every value a facet; the Search tab takes one through its
 * route (`facetFromParams`) and offers each kind in "Search by".
 *
 * ## Why four of the vocabularies are literals
 *
 * `themes`, `game_modes`, `player_perspectives` and `languages` are not on the
 * `igdb` function's allowlist, and an allowlist entry does nothing until the
 * function is redeployed (CLAUDE.md, § Gotchas) — the reason
 * `constants/player-perspectives.ts` is a literal too. Their games need no
 * allowlist: they are a `where` clause on `games`. So the tables below were
 * read off the live catalogue on 2026-10-16, through `games` (every distinct
 * value across a few thousand records, ids and names as IGDB gives them), and
 * they are short and fixed: 22 themes, 6 modes, 7 perspectives, 28 languages.
 * Genres are fetched (`genres` is allowed); engines, series and franchises are
 * thousands, and are searched by name.
 */

export type FacetKind =
  | 'genre'
  | 'theme'
  | 'mode'
  | 'perspective'
  | 'engine'
  | 'series'
  | 'franchise'
  | 'language'
  | 'rating';

export type Facet = { kind: FacetKind; id: number; name: string };

export type FacetValue = { id: number; name: string };

type FacetInfo = {
  /** One of them, in sentence case: "Theme". */
  label: string;
  /** Several, lower case, for a sentence: "themes". */
  plural: string;
  /** The `games` field the clause filters on. */
  field: string;
  /** Whether the field is a list (`themes = (20)`) or one value (`collection = 4`). */
  list: boolean;
  /**
   * How "Search by" finds its values: a fixed list filtered as you type, a
   * fetched list filtered the same way, a search by name — or not at all (an
   * age rating is reached from a game's details only).
   */
  lookup: 'fixed' | 'fetched' | 'remote' | null;
};

export const FACET_INFO: Record<FacetKind, FacetInfo> = {
  genre: { label: 'Genre', plural: 'genres', field: 'genres', list: true, lookup: 'fetched' },
  theme: { label: 'Theme', plural: 'themes', field: 'themes', list: true, lookup: 'fixed' },
  mode: {
    label: 'Game mode',
    plural: 'game modes',
    field: 'game_modes',
    list: true,
    lookup: 'fixed',
  },
  perspective: {
    label: 'Perspective',
    plural: 'perspectives',
    field: 'player_perspectives',
    list: true,
    lookup: 'fixed',
  },
  engine: {
    label: 'Engine',
    plural: 'game engines',
    field: 'game_engines',
    list: true,
    lookup: 'remote',
  },
  /* IGDB's `collections`, the numbered series. **Plural**: the singular
     `collection` that `getCollectionGames` still asks for answers nothing now
     (checked 2026-10-16: `collection = 106` is empty, `collections = (106)` is
     Zelda) — the same rename as `category` and `platform_type`. */
  series: { label: 'Series', plural: 'series', field: 'collections', list: true, lookup: 'remote' },
  franchise: {
    label: 'Franchise',
    plural: 'franchises',
    field: 'franchises',
    list: true,
    lookup: 'remote',
  },
  language: {
    label: 'Language',
    plural: 'languages',
    field: 'language_supports.language',
    list: true,
    lookup: 'fixed',
  },
  rating: {
    label: 'Age rating',
    plural: 'age ratings',
    field: 'age_ratings.rating_category',
    list: true,
    lookup: null,
  },
};

/** The kinds "Search by" offers, in its order. */
export const LOOKUP_KINDS: readonly FacetKind[] = [
  'genre',
  'theme',
  'perspective',
  'mode',
  'engine',
  'series',
  'franchise',
  'language',
];

/** IGDB's themes, read off the live catalogue on 2026-10-16. */
export const THEMES: readonly FacetValue[] = [
  { id: 1, name: 'Action' },
  { id: 17, name: 'Fantasy' },
  { id: 18, name: 'Science fiction' },
  { id: 19, name: 'Horror' },
  { id: 20, name: 'Thriller' },
  { id: 21, name: 'Survival' },
  { id: 22, name: 'Historical' },
  { id: 23, name: 'Stealth' },
  { id: 27, name: 'Comedy' },
  { id: 28, name: 'Business' },
  { id: 31, name: 'Drama' },
  { id: 32, name: 'Non-fiction' },
  { id: 33, name: 'Sandbox' },
  { id: 34, name: 'Educational' },
  { id: 35, name: 'Kids' },
  { id: 38, name: 'Open world' },
  { id: 39, name: 'Warfare' },
  { id: 40, name: 'Party' },
  { id: 41, name: '4X (explore, expand, exploit, and exterminate)' },
  { id: 42, name: 'Erotic' },
  { id: 43, name: 'Mystery' },
  { id: 44, name: 'Romance' },
];

/** IGDB's game modes. */
export const GAME_MODES: readonly FacetValue[] = [
  { id: 1, name: 'Single player' },
  { id: 2, name: 'Multiplayer' },
  { id: 3, name: 'Co-operative' },
  { id: 4, name: 'Split screen' },
  { id: 5, name: 'Massively Multiplayer Online (MMO)' },
  { id: 6, name: 'Battle Royale' },
];

/** IGDB's player perspectives — the same table as `constants/player-perspectives.ts`. */
export const PERSPECTIVES: readonly FacetValue[] = [
  { id: 1, name: 'First person' },
  { id: 2, name: 'Third person' },
  { id: 3, name: 'Bird view / Isometric' },
  { id: 4, name: 'Side view' },
  { id: 5, name: 'Text' },
  { id: 6, name: 'Auditory' },
  { id: 7, name: 'Virtual Reality' },
];

/** IGDB's languages, alphabetical. */
export const LANGUAGES: readonly FacetValue[] = [
  { id: 1, name: 'Arabic' },
  { id: 2, name: 'Chinese (Simplified)' },
  { id: 3, name: 'Chinese (Traditional)' },
  { id: 4, name: 'Czech' },
  { id: 5, name: 'Danish' },
  { id: 6, name: 'Dutch' },
  { id: 7, name: 'English' },
  { id: 8, name: 'English (UK)' },
  { id: 11, name: 'Finnish' },
  { id: 12, name: 'French' },
  { id: 27, name: 'German' },
  { id: 13, name: 'Hebrew' },
  { id: 14, name: 'Hungarian' },
  { id: 15, name: 'Italian' },
  { id: 16, name: 'Japanese' },
  { id: 17, name: 'Korean' },
  { id: 18, name: 'Norwegian' },
  { id: 19, name: 'Polish' },
  { id: 21, name: 'Portuguese (Brazil)' },
  { id: 20, name: 'Portuguese (Portugal)' },
  { id: 22, name: 'Russian' },
  { id: 10, name: 'Spanish (Mexico)' },
  { id: 9, name: 'Spanish (Spain)' },
  { id: 23, name: 'Swedish' },
  { id: 25, name: 'Thai' },
  { id: 24, name: 'Turkish' },
  { id: 28, name: 'Ukrainian' },
  { id: 26, name: 'Vietnamese' },
];

/** The fixed vocabularies, by kind. */
export const FIXED_VALUES: Partial<Record<FacetKind, readonly FacetValue[]>> = {
  theme: THEMES,
  mode: GAME_MODES,
  perspective: PERSPECTIVES,
  language: LANGUAGES,
};

/** The `where` clause for a facet's games: `themes = (20)`, `collection = 4`. */
export function facetClause(facet: Pick<Facet, 'kind' | 'id'>): string {
  const info = FACET_INFO[facet.kind];
  const id = Math.trunc(facet.id);
  return info.list ? `${info.field} = (${id})` : `${info.field} = ${id}`;
}

/** "Theme · Thriller" — what a chosen facet is called on screen. */
export function facetTitle(facet: Facet): string {
  return `${FACET_INFO[facet.kind].label} · ${facet.name}`;
}

export function isFacetKind(value: unknown): value is FacetKind {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(FACET_INFO, value);
}

/**
 * How several chosen facets combine — the owner's "selection mode"
 * (2026-10-16):
 *
 * - **`all`, "Combined"**: a game must be *every one of them* — an RPG,
 *   isometric, a comedy and made in Unity (80 games on IGDB, checked live),
 *   never a Unity MOBA.
 * - **`any`, "Any of"**: a game that is at least one of them.
 */
export type MatchMode = 'all' | 'any';

export const MATCH_MODE_LABEL: Record<MatchMode, string> = {
  all: 'Combined',
  any: 'Any of',
};

/** The route's params for one facet — what a game's details card sends. */
export function facetParams(facet: Facet): { facets: string; match: MatchMode } {
  return facetsParams([facet], 'all');
}

/**
 * The route's params for the facets chosen, in order, and how they combine.
 * One param holding a list, so a name with a comma or a colon in it — "4X
 * (explore, expand, exploit, and exterminate)" — survives the trip.
 */
export function facetsParams(
  facets: readonly Facet[],
  match: MatchMode
): { facets: string; match: MatchMode } {
  return {
    facets: JSON.stringify(facets.map((facet) => [facet.kind, facet.id, facet.name])),
    match,
  };
}

/** The facets back out of the route — or none, for anything that is not one. */
export function facetsFromParams(params: {
  facets?: string | string[];
  match?: string | string[];
}): { facets: Facet[]; match: MatchMode } {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const match: MatchMode = one(params.match) === 'any' ? 'any' : 'all';
  let raw: unknown = [];
  try {
    raw = JSON.parse(one(params.facets) ?? '[]');
  } catch {
    raw = [];
  }
  const facets: Facet[] = [];
  for (const entry of Array.isArray(raw) ? raw : []) {
    if (!Array.isArray(entry)) continue;
    const facet = facetFromParams({
      facet: String(entry[0]),
      facetId: String(entry[1]),
      facetName: typeof entry[2] === 'string' ? entry[2] : '',
    });
    if (facet && !facets.some((known) => sameFacet(known, facet))) facets.push(facet);
  }
  return { facets, match };
}

export function sameFacet(a: Pick<Facet, 'kind' | 'id'>, b: Pick<Facet, 'kind' | 'id'>): boolean {
  return a.kind === b.kind && a.id === b.id;
}

/**
 * Several facets as one clause: joined by `&` when combined, by `|` in
 * brackets when any will do. `genres = (12) & genres = (31)` is a game in both
 * — the same answer as `genres = [12,31]`, checked live.
 */
export function facetsClause(
  facets: readonly Pick<Facet, 'kind' | 'id'>[],
  match: MatchMode
): string {
  const clauses = facets.map(facetClause);
  if (clauses.length <= 1) return clauses[0] ?? '';
  return match === 'all' ? clauses.join(' & ') : `(${clauses.join(' | ')})`;
}

/** "RPG, Isometric, Comedy and Unity" — the facets in a sentence. */
export function facetsSentence(facets: readonly Facet[], match: MatchMode): string {
  const names = facets.map((facet) => facet.name);
  if (names.length <= 1) return names[0] ?? '';
  return `${names.slice(0, -1).join(', ')} ${match === 'all' ? 'and' : 'or'} ${names[names.length - 1]}`;
}

/** A facet back out of route params, or null for anything else. */
export function facetFromParams(params: {
  facet?: string | string[];
  facetId?: string | string[];
  facetName?: string | string[];
}): Facet | null {
  const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  const kind = one(params.facet);
  const id = Number(one(params.facetId));
  const name = one(params.facetName)?.trim();
  if (!isFacetKind(kind) || !Number.isInteger(id) || id <= 0 || !name) return null;
  return { kind, id, name };
}

/** Lower case, accents and punctuation out — what two names are compared on. */
export function nameKey(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/**
 * The values whose names match what was typed, best first: the whole name,
 * then a name that starts with it, then one with a word that starts with it,
 * then one that holds it anywhere. Ties keep the list's own order — popularity
 * for a search, alphabetical for a fixed list. Nothing typed is every value,
 * as given.
 */
export function matchValues<T extends FacetValue>(values: readonly T[], typed: string): T[] {
  const term = nameKey(typed);
  if (!term) return [...values];

  const rank = (value: T): number => {
    const name = nameKey(value.name);
    if (name === term) return 0;
    if (name.startsWith(term)) return 1;
    if (name.split(' ').some((word) => word.startsWith(term))) return 2;
    if (name.includes(term)) return 3;
    return -1;
  };

  return values
    .map((value, index) => ({ value, index, rank: rank(value) }))
    .filter((entry) => entry.rank >= 0)
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map((entry) => entry.value);
}

/**
 * Distinct values out of many games' expansions, most common first — how the
 * engines matching a name are found through `games` (`game_engines` is not on
 * the allowlist), counted so the engine most games use leads.
 */
export function tallyValues(lists: readonly (readonly FacetValue[] | undefined)[]): FacetValue[] {
  const counts = new Map<number, { value: FacetValue; count: number; first: number }>();
  let order = 0;
  for (const list of lists) {
    for (const value of list ?? []) {
      if (!Number.isInteger(value.id) || !value.name?.trim()) continue;
      const known = counts.get(value.id);
      if (known) known.count += 1;
      else
        counts.set(value.id, {
          value: { id: value.id, name: value.name.trim() },
          count: 1,
          first: order++,
        });
    }
  }
  return [...counts.values()]
    .sort((a, b) => b.count - a.count || a.first - b.first)
    .map((entry) => entry.value);
}

/**
 * Platforms as a player names them — PlayStation, not its seven machines — and
 * the IGDB ids each stands for. The platform menu over a facet's games and
 * Surprise Me's platform filter both read this. Every id was checked against
 * IGDB's `platforms` on 2026-10-16.
 */
export type PlatformGroupKey =
  'pc' | 'playstation' | 'xbox' | 'switch' | 'nintendo-classic' | 'mobile' | 'mac-linux' | 'vr';

export type PlatformGroup = { key: PlatformGroupKey; label: string; ids: readonly number[] };

export const PLATFORM_GROUPS: readonly PlatformGroup[] = [
  { key: 'pc', label: 'PC', ids: [6] },
  /* PS5, PS4, PS3, PS2, PlayStation, Vita, PSP. */
  { key: 'playstation', label: 'PlayStation', ids: [167, 48, 9, 8, 7, 46, 38] },
  /* Series X|S, One, 360, the first. */
  { key: 'xbox', label: 'Xbox', ids: [169, 49, 12, 11] },
  { key: 'switch', label: 'Nintendo Switch', ids: [508, 130] },
  /* Wii U, Wii, 3DS, DS, GameCube, N64, SNES, NES, Game Boy, GBA, GBC. */
  {
    key: 'nintendo-classic',
    label: 'Older Nintendo',
    ids: [41, 5, 37, 20, 21, 4, 19, 18, 33, 24, 22],
  },
  { key: 'mobile', label: 'iOS & Android', ids: [39, 34] },
  { key: 'mac-linux', label: 'Mac & Linux', ids: [14, 3] },
  /* PlayStation VR, SteamVR. */
  { key: 'vr', label: 'VR', ids: [165, 163] },
];

/** The `platforms` clause for some groups, "any of" — or null for none chosen. */
export function platformGroupsClause(keys: readonly string[]): string | null {
  const ids = PLATFORM_GROUPS.filter((group) => keys.includes(group.key)).flatMap(
    (group) => group.ids
  );
  return ids.length > 0 ? `platforms = (${[...new Set(ids)].join(',')})` : null;
}

/**
 * A facet's games as a catalogue slice: the facet, optionally on some
 * platforms, optionally with a word in the name. A `name ~` match rather than
 * IGDB's `search` so the slice can be sorted, paged and counted like any
 * other — `search` refuses a `sort`.
 */
export function facetSubject(
  facets: readonly Pick<Facet, 'kind' | 'id'>[],
  match: MatchMode,
  options: { platforms?: readonly string[]; term?: string } = {}
): string {
  const parts = [facetsClause(facets, match)].filter(Boolean);
  const platforms = platformGroupsClause(options.platforms ?? []);
  if (platforms) parts.push(platforms);
  const term = options.term?.trim();
  if (term) parts.push(`name ~ *"${term.replace(/\\/g, '').replace(/"/g, '\\"')}"*`);
  return parts.join(' & ');
}
