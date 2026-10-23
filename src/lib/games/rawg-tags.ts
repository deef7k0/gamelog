import { getGamesWhere } from './igdb';
import { PAGE_SIZE } from './paging';
import { fetchJson, rawgConfigured } from './rawg';
import {
  englishTags,
  exactNamesClause,
  hasEveryTag,
  inRawgOrder,
  pickRawgGame,
  rawgDates,
  rawgOrdering,
  type RawgTag,
  type RawgTagRow,
} from './rawg-match';
import type { Game } from './types';

export { rawgConfigured as rawgTagsAvailable };
export type { RawgTag };

/**
 * RAWG's tags — the owner's request (2026-10-22): "Add from rawg's api their
 * tags for games. And include them as searchable on any screen that contains
 * other things to search about games." RAWG tags are its players' words for a
 * game ("Atmospheric", "Great Soundtrack", "Story Rich", "Co-op"), which IGDB's
 * genres and themes are not.
 *
 * Three questions, each one or two requests: which tags there are (the most
 * used English ones), which tags a game has, and which games carry a tag. The
 * last answers RAWG's games, which are shown as IGDB's of the same name and
 * year (`rawg-match.ts`) — RAWG never puts a game into the app.
 *
 * **Built without a working key.** `.env`'s `EXPO_PUBLIC_RAWG_API_KEY` was
 * empty on 2026-10-22, and RAWG answers nothing without one, so every request
 * here is written from RAWG's published API description
 * (`api.rawg.io/docs/?format=openapi`) and not one has run. Without a key
 * every tag control is simply absent (`rawgTagsAvailable`). Two things to
 * check on the first run with a key: that game rows carry `tags` (the API
 * description lists them on a game's own record only), and whether
 * `tags=1,2` means both or either — "Combined" filters the rows itself either
 * way (`hasEveryTag`).
 */

type RawgGameRow = {
  id: number;
  name?: string;
  released?: string | null;
  tags?: RawgTagRow[] | null;
};

type RawgPage<T> = { count?: number; next?: string | null; results?: T[] };

/** How many of RAWG's most-used tags are offered: three of its pages of forty. */
const TAG_PAGES = 3;

/**
 * The tags offered to search by: RAWG's most used, in English — about a
 * hundred, filtered on the phone as a name is typed.
 */
export async function getRawgTags(signal?: AbortSignal): Promise<RawgTag[]> {
  const pages = await Promise.all(
    Array.from({ length: TAG_PAGES }, (_, index) =>
      fetchJson<RawgPage<RawgTagRow>>(`/tags?page_size=40&page=${index + 1}`, signal).catch(
        (error: unknown) => {
          /* A later page that fails costs its tags, not the list. */
          if (index === 0) throw error;
          return { results: [] } as RawgPage<RawgTagRow>;
        }
      )
    )
  );
  return englishTags(pages.flatMap((page) => page.results ?? []));
}

/** How many of a game's tags its page lists: the most used first. */
const GAME_TAGS = 16;

/**
 * A game's RAWG tags, or none: RAWG searched for its name, the result of the
 * same name and year taken (`pickRawgGame`), its English tags kept.
 */
export async function getGameRawgTags(
  title: string,
  year: number | null,
  signal?: AbortSignal
): Promise<RawgTag[]> {
  const page = await fetchJson<RawgPage<RawgGameRow>>(
    `/games?search=${encodeURIComponent(title)}&search_precise=true&page_size=8`,
    signal
  );
  const match = pickRawgGame(page.results ?? [], title, year);
  return match ? englishTags(match.tags).slice(0, GAME_TAGS) : [];
}

/** One page of a tag's games, and how many RAWG says there are. */
export type TagGamesPage = { games: Game[]; count: number };

/**
 * One page of the games that carry these tags, as IGDB games.
 *
 * RAWG's page of ten (`PAGE_SIZE`, the catalogue's), in the catalogue's order
 * as RAWG reads it (`rawgOrdering`); "Combined" keeps only the rows carrying
 * every tag. Then one IGDB request for those names — with `where`, the rest of
 * the search (other facets, a platform, a word), so a tag combines with
 * everything else on the screen. A page can come back short: a name IGDB does
 * not know, or a game the rest of the search rules out. The count is RAWG's.
 */
export async function getTagGamesPage(
  {
    tagIds,
    match,
    where,
    sort,
    page,
    pageSize = PAGE_SIZE,
  }: {
    tagIds: readonly number[];
    match: 'all' | 'any';
    /** The IGDB clause for everything else asked, or '' for nothing. */
    where: string;
    sort: string;
    page: number;
    pageSize?: number;
  },
  signal?: AbortSignal
): Promise<TagGamesPage> {
  const order = rawgOrdering(sort);
  const dates = rawgDates(order.dates, new Date());
  const params = [
    `tags=${tagIds.map((id) => Math.trunc(id)).join(',')}`,
    `ordering=${order.ordering}`,
    `page_size=${pageSize}`,
    `page=${Math.max(1, Math.trunc(page))}`,
    'exclude_additions=true',
    ...(dates ? [`dates=${dates}`] : []),
  ];
  const answer = await fetchJson<RawgPage<RawgGameRow> & { detail?: string }>(
    `/games?${params.join('&')}`,
    signal
  );
  const rows = (answer.results ?? []).filter(
    (row) => match === 'any' || tagIds.length < 2 || hasEveryTag(row, tagIds)
  );
  const names = rows.flatMap((row) => (row.name ? [row.name] : []));
  if (names.length === 0) return { games: [], count: answer.count ?? 0 };

  const clause = [exactNamesClause(names), 'version_parent = null', where ? `(${where})` : '']
    .filter(Boolean)
    .join(' & ');
  const games = await getGamesWhere(clause, names.length * 3, signal);
  return { games: inRawgOrder(rows, games), count: answer.count ?? 0 };
}

/** The deepest page Surprise Me draws from: RAWG pages past this are slow and stale. */
const SURPRISE_MAX_PAGE = 25;
const SURPRISE_PAGE = 40;

/**
 * Surprise Me's pool when tags are chosen: a random page of RAWG's games with
 * those tags — the first page tells how many pages there are — as IGDB games,
 * narrowed by the rest of the settings (`where`).
 */
export async function getTagSurprisePool(
  {
    tagIds,
    match,
    where,
    random,
  }: {
    tagIds: readonly number[];
    match: 'all' | 'any';
    where: string;
    /** 0 to 1: which page. The caller's randomness, so this stays testable. */
    random: number;
  },
  signal?: AbortSignal
): Promise<Game[]> {
  const first = await getTagGamesPage(
    { tagIds, match, where, sort: 'popular', page: 1, pageSize: SURPRISE_PAGE },
    signal
  );
  const pages = Math.min(SURPRISE_MAX_PAGE, Math.ceil(first.count / SURPRISE_PAGE));
  const page = Math.min(pages, 1 + Math.floor(random * pages));
  if (page <= 1) return first.games;
  const pick = await getTagGamesPage(
    { tagIds, match, where, sort: 'popular', page, pageSize: SURPRISE_PAGE },
    signal
  );
  return pick.games.length > 0 ? pick.games : first.games;
}
