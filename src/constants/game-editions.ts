/**
 * What kind of release a game is, when it is not simply *the* game.
 *
 * A catalogue is not a flat list of titles. "Mafia" and "Mafia: Definitive
 * Edition" are two rows in IGDB and two pages in this app, and without a word on
 * the second one a franchise rail reads as though the series shipped the same
 * game twice. This vocabulary is that word.
 *
 * ## Where the data comes from
 *
 * IGDB models the relationship two different ways and the app needs both:
 *
 *  - **`game_type`** (formerly `category`) marks a release that is its own
 *    entry in the catalogue — a remake, a remaster, a port, a DLC, an
 *    expansion. Those have a `parent_game` and appear in search on their own.
 *  - **`version_parent`** marks a *repackage* of an existing entry — "Game of
 *    the Year Edition", "Complete Edition" — with the marketing name in
 *    `version_title`. Those are deliberately filtered out of search everywhere
 *    in this app (`where version_parent = null`), so the only place they surface
 *    is the parent game's own page, which is exactly where they belong.
 *
 * `null` is the common case and means "this is the game", which is why nothing
 * renders a badge by default.
 *
 * ## Why this is a closed vocabulary and not IGDB's raw enum
 *
 * IGDB has fifteen categories and most of them are not distinctions a reader
 * cares about on a poster. `episode`, `season`, `pack` and `bundle` all mean
 * "a slice or a box of the thing you already know"; `fork` and `mod` are
 * cataloguing detail. Collapsing them to six labels keeps the badge readable at
 * 10px and keeps the game page from having eight one-item sections.
 */
export type EditionKind =
  'remake' | 'remaster' | 'dlc' | 'expansion' | 'port' | 'edition' | 'bundle';

export type EditionMeta = {
  /** What the badge says. Short enough to fit across a rail poster. */
  label: string;
  /**
   * Sorting weight for the parent's "Editions & extras" list, low first.
   *
   * Not alphabetical and not chronological: a reader scanning a base game's
   * page wants the *other versions of this game* before the add-ons to it, and
   * a remake before a port. Ties fall back to release date.
   */
  rank: number;
};

export const EDITIONS: Record<EditionKind, EditionMeta> = {
  remake: { label: 'Remake', rank: 0 },
  remaster: { label: 'Remaster', rank: 1 },
  edition: { label: 'Edition', rank: 2 },
  port: { label: 'Port', rank: 3 },
  expansion: { label: 'Expansion', rank: 4 },
  dlc: { label: 'DLC', rank: 5 },
  bundle: { label: 'Bundle', rank: 6 },
};

/**
 * IGDB's `game_type` ids, mapped onto the six labels above.
 *
 * The numbers are the long-standing `GameCategoryEnum` values, which the newer
 * `game_types` reference table kept — so this table reads either field. Ids not
 * listed here (0 `main_game`, 5 `mod`, 12 `fork`, 14 `update`) deliberately
 * produce no badge: a main game is the default, and the other three are
 * cataloguing detail nobody browsing a franchise is asking about.
 */
const IGDB_TYPE_TO_KIND: Record<number, EditionKind> = {
  1: 'dlc',
  2: 'expansion',
  3: 'bundle',
  4: 'expansion', // standalone_expansion — still an expansion to a reader.
  6: 'dlc', // episode
  7: 'dlc', // season
  8: 'remake',
  9: 'remaster',
  10: 'expansion', // expanded_game
  11: 'port',
  13: 'bundle', // pack
};

/**
 * Resolve a release into one of the six kinds, or null for a plain game.
 *
 * `versionParent` wins over `gameType` when both are set, and that order is
 * deliberate. A repackage carries its parent's `game_type` — "Mafia II:
 * Director's Cut" is still typed `main_game` — so reading the type first would
 * label every edition as nothing at all. If IGDB has said "this is a version of
 * that", that is the more specific fact.
 */
export function editionKindFor(input: {
  gameType?: number | null;
  versionParent?: number | null;
}): EditionKind | null {
  if (input.versionParent != null) return 'edition';
  if (input.gameType == null) return null;
  return IGDB_TYPE_TO_KIND[input.gameType] ?? null;
}

/** The badge's text, or null when there is nothing to say. */
export function editionLabel(kind: EditionKind | null | undefined): string | null {
  return kind ? EDITIONS[kind].label : null;
}

/** Sort weight for a parent game's list of related releases. */
export function editionRank(kind: EditionKind | null | undefined): number {
  return kind ? EDITIONS[kind].rank : -1;
}
