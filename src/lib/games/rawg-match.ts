/**
 * RAWG's tags, matched onto this app's games. Pure: `rawg-tags.ts` asks RAWG
 * and IGDB, and this decides what the answers mean, under `npm test`.
 *
 * RAWG is not a catalogue here and must not become one (CLAUDE.md, "One
 * catalogue: IGDB"): a game RAWG tags is shown only as the IGDB game of the
 * same name and year. RAWG publishes no IGDB ids, so the bridge is the name —
 * one IGDB request a page, `name = ("…","…")` — and a game whose names differ
 * between the two is not shown rather than shown as the wrong one.
 */

/** One RAWG tag: its id (what `tags=` takes), its name, and how many games carry it. */
export type RawgTag = { id: number; name: string; slug: string; games: number };

/** A tag as RAWG's `/tags` and its game rows return it. */
export type RawgTagRow = {
  id?: number;
  name?: string;
  slug?: string;
  language?: string;
  games_count?: number;
};

/**
 * RAWG's tags in English, the most-used first. RAWG keeps a Russian set beside
 * the English one (`language: "rus"`); the interface here is English only.
 */
export function englishTags(rows: readonly RawgTagRow[] | null | undefined): RawgTag[] {
  return (rows ?? [])
    .filter(
      (row): row is Required<Pick<RawgTagRow, 'id' | 'name'>> & RawgTagRow =>
        typeof row.id === 'number' &&
        !!row.name?.trim() &&
        (!row.language || row.language === 'eng')
    )
    .map((row) => ({
      id: row.id,
      name: row.name.trim(),
      slug: row.slug ?? String(row.id),
      games: row.games_count ?? 0,
    }))
    .sort((a, b) => b.games - a.games);
}

/**
 * What two names are compared on: lower case, the trademark signs out, "&"
 * as "and", every other mark a space, and no space twice. "Marvel's
 * Spider-Man™" and "marvels spider man" are the same name.
 */
export function titleKey(name: string): string {
  /* The marks first: NFKD spells "™" as the letters "TM". */
  return name
    .replace(/[\u2122\u00ae\u00a9]/g, '')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['\u2019`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The year of a RAWG `released` ("2018-04-20"), or null. */
export function rawgYear(released: string | null | undefined): number | null {
  const year = Number(released?.slice(0, 4));
  return Number.isInteger(year) && year > 1950 ? year : null;
}

/**
 * The RAWG game that is this one: the same name, and a year within one of
 * IGDB's when both know it — "Prey" is a 2006 game and a 2017 one. Null when
 * none is.
 */
export function pickRawgGame<T extends { name?: string; released?: string | null }>(
  results: readonly T[],
  title: string,
  year: number | null
): T | null {
  const key = titleKey(title);
  const named = results.filter((row) => row.name && titleKey(row.name) === key);
  if (year === null) return named[0] ?? null;
  return (
    named.find((row) => {
      const other = rawgYear(row.released);
      return other === null || Math.abs(other - year) <= 1;
    }) ?? null
  );
}

/**
 * IGDB's games in RAWG's order: for each RAWG row, the IGDB game of the same
 * name, the nearest year first; each IGDB game used once. A row with no IGDB
 * game of its name is left out.
 */
export function inRawgOrder<G extends { title: string; releaseYear: number | null }>(
  rows: readonly { name?: string; released?: string | null }[],
  games: readonly G[]
): G[] {
  const used = new Set<G>();
  const out: G[] = [];
  for (const row of rows) {
    if (!row.name) continue;
    const key = titleKey(row.name);
    const year = rawgYear(row.released);
    const candidates = games
      .filter((game) => !used.has(game) && titleKey(game.title) === key)
      .sort((a, b) => distance(a.releaseYear, year) - distance(b.releaseYear, year));
    const pick = candidates[0];
    if (
      !pick ||
      (year !== null && pick.releaseYear !== null && Math.abs(pick.releaseYear - year) > 1)
    ) {
      continue;
    }
    used.add(pick);
    out.push(pick);
  }
  return out;
}

function distance(a: number | null, b: number | null): number {
  return a === null || b === null ? 50 : Math.abs(a - b);
}

/**
 * IGDB's clause for "one of these names, exactly" — the names RAWG answered
 * with, as `name = ("A","B")` (checked live: IGDB takes a list of strings and
 * matches each exactly, case and all). Quotes and backslashes are escaped.
 */
export function exactNamesClause(names: readonly string[]): string {
  const quoted = [...new Set(names.map((name) => name.trim()).filter(Boolean))].map(
    (name) => `"${name.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
  );
  return quoted.length > 0 ? `name = (${quoted.join(',')})` : 'id = 0';
}

/** Whether a RAWG row carries every one of these tags — "Combined". */
export function hasEveryTag(
  row: { tags?: readonly RawgTagRow[] | null },
  tagIds: readonly number[]
): boolean {
  const carried = new Set((row.tags ?? []).map((tag) => tag.id));
  return tagIds.every((id) => carried.has(id));
}

/** The catalogue's orders, as RAWG's `ordering` and, for what is not out yet, its `dates`. */
export type RawgOrder = { ordering: string; dates?: 'past' | 'future' };

/**
 * One of the catalogue's orders (`CatalogueSort`, the Search tab's menu) in
 * RAWG's words. RAWG counts "popular" as how many people added a game.
 */
export function rawgOrdering(sort: string): RawgOrder {
  switch (sort) {
    case 'rating':
      return { ordering: '-rating' };
    case 'newest':
      return { ordering: '-released', dates: 'past' };
    case 'oldest':
      return { ordering: 'released', dates: 'past' };
    case 'upcoming':
      return { ordering: 'released', dates: 'future' };
    case 'title':
      return { ordering: 'name' };
    case 'added':
      return { ordering: '-created' };
    default:
      return { ordering: '-added' };
  }
}

/** RAWG's `dates` for an order that needs one, from today: "2026-10-22,2100-12-31". */
export function rawgDates(dates: RawgOrder['dates'], today: Date): string | null {
  if (!dates) return null;
  const day = today.toISOString().slice(0, 10);
  return dates === 'future' ? `${day},2100-12-31` : `1950-01-01,${day}`;
}
