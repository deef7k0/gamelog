import { WikidataProperty } from '../../constants/wikidata';
import type { Game } from '../games/types';
import { qualifierStrings, statementsOf, stringOf, type WikidataClaims } from './claims';

/**
 * How a game is found on Wikidata: by the identifiers it already carries, and
 * never by its title.
 *
 * The app holds no Q-ID for any game, but it holds two ids Wikidata records
 * against game items as exact statements:
 *
 *  - **The IGDB slug** (P5794, "Internet Game Database game ID"). Every game in
 *    the catalogue has one — it is the last segment of IGDB's `url`, which
 *    `GAME_FIELDS` already fetches and `toGame` keeps as `storeUrl` — and over
 *    150,000 Wikidata items carry it. This is the primary route.
 *  - **The Steam appid** (P1733). The fallback, and the only route for a legacy
 *    `steam:` row, whose appid *is* its id.
 *
 * A title search was never an option: "Doom" is five games, and the feature
 * would print one of their casts under another one's name.
 */
export type WikidataLookup = {
  /** IGDB's numeric id — not searchable on Wikidata, but used to confirm a match. */
  igdbId: string | null;
  igdbSlug: string | null;
  steamAppId: string | null;
};

const DIGITS = /^\d+$/;

/**
 * An IGDB slug is lower-case ASCII, digits and hyphens. Anything else is
 * refused rather than escaped: it goes into a search expression where `|`,
 * `[` and whitespace are syntax.
 */
const SLUG = /^[a-z0-9][a-z0-9._-]*$/;

const IGDB_GAME_URL = /^https?:\/\/(?:www\.)?igdb\.com\/games\/([^/?#]+)\/?(?:[?#].*)?$/i;

/** `https://www.igdb.com/games/the-witcher-3-wild-hunt` → `the-witcher-3-wild-hunt`. */
export function igdbSlugFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const match = IGDB_GAME_URL.exec(url.trim());
  if (!match) return null;

  let slug: string;
  try {
    slug = decodeURIComponent(match[1]);
  } catch {
    return null;
  }
  return SLUG.test(slug) ? slug : null;
}

/**
 * The lookup for one game, or null when it carries nothing Wikidata can be
 * searched by — a RAWG or itch.io row, or an IGDB row with no usable URL. The
 * Overview button is hidden for those rather than opening onto a screen that
 * can only ever say there is nothing.
 *
 * **`steamAppId` is null on every IGDB game at present**, and not because of
 * anything here: IGDB renamed `external_games.category` to
 * `external_game_source`, and `GAME_FIELDS` still asks for the old name. The
 * slug route does not depend on it; the Steam route starts working for IGDB
 * games the moment that field is corrected.
 */
export function wikidataLookupFor(
  game: Pick<Game, 'source' | 'sourceId' | 'storeUrl' | 'steamAppId'>
): WikidataLookup | null {
  const isIgdb = game.source === 'igdb';
  const igdbId = isIgdb && DIGITS.test(game.sourceId) ? game.sourceId : null;
  const igdbSlug = isIgdb ? igdbSlugFromUrl(game.storeUrl) : null;

  const steam = game.steamAppId ?? (game.source === 'steam' ? game.sourceId : null);
  const steamAppId = steam && DIGITS.test(steam) ? steam : null;

  if (!igdbSlug && !steamAppId) return null;
  return { igdbId, igdbSlug, steamAppId };
}

/**
 * One exact-statement search: `haswbstatement:P5794=the-witcher-3-wild-hunt`.
 *
 * `narrowed` is asked only when `statement` matches more than one item. It
 * adds the IGDB numeric id as a qualifier, which Wikidata's search indexes on
 * P5794 statements — so a slug shared by two items is settled by a second
 * exact identifier rather than by picking one.
 */
export type ItemSearch = { statement: string; narrowed: string | null };

/** The searches for a game, in the order they are tried. */
export function itemSearchesFor(lookup: WikidataLookup): ItemSearch[] {
  const { igdbGameId, igdbNumericGameId, steamAppId } = WikidataProperty;
  const searches: ItemSearch[] = [];

  if (lookup.igdbSlug) {
    searches.push({
      statement: `${igdbGameId}=${lookup.igdbSlug}`,
      narrowed: lookup.igdbId
        ? `${igdbGameId}=${lookup.igdbSlug}[${igdbNumericGameId}=${lookup.igdbId}]`
        : null,
    });
  }
  if (lookup.steamAppId) {
    searches.push({ statement: `${steamAppId}=${lookup.steamAppId}`, narrowed: null });
  }
  return searches;
}

/**
 * Whether an item found by identifier is this game, by its own IGDB record.
 *
 * The search proves the item carries *one* of this game's identifiers. This
 * checks that nothing else on it contradicts that: an item whose P5794
 * statements name a *different* IGDB game — by the numeric id qualifier, or
 * by slug where there is none — is a different game, however it was reached.
 * That is what stops a Steam appid shared by a base game and its Complete
 * Edition from lending one's credits to the other, and a slug IGDB reassigned
 * from matching the game that used to hold it.
 *
 * An item with no IGDB record at all has nothing to contradict, and stands on
 * the identifier that found it.
 */
export function itemMatchesGame(claims: WikidataClaims, lookup: WikidataLookup): boolean {
  if (!lookup.igdbId && !lookup.igdbSlug) return true;

  const records = statementsOf(claims, WikidataProperty.igdbGameId);
  if (records.length === 0) return true;

  return records.some((record) => {
    const numericIds = qualifierStrings(record, WikidataProperty.igdbNumericGameId);
    if (numericIds.length > 0) return lookup.igdbId !== null && numericIds.includes(lookup.igdbId);
    return lookup.igdbSlug !== null && stringOf(record.mainsnak) === lookup.igdbSlug;
  });
}
