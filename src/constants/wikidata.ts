/**
 * Wikidata's vocabulary, as the studio page's logo lookup reads it.
 *
 * Every property and item id that lookup depends on is here and nowhere else,
 * so the whole of what is asked of Wikidata can be read in one place, and a
 * property that is deprecated upstream is one edit. Each id was checked against
 * the live API (`wbgetentities` with `props=labels|datatype`) when this was
 * written — the comment beside it is Wikidata's own English label.
 *
 * It was three times this long: the game's "Additional information" screen
 * read awards, cast, budgets and credits through two dozen more properties, a
 * table of roles and one of currencies. The owner had that screen scrapped
 * (2026-10-09) and its vocabulary went with it.
 *
 * No imports: `npm test` loads this under plain Node, through
 * `lib/wikidata/commons.ts`.
 */

export const WikidataProperty = {
  /* How a studio's item is found. */
  igdbCompanyId: 'P9650', // Internet Game Database company ID — the IGDB slug
  industry: 'P452', // industry
  instanceOf: 'P31', // instance of

  /* Its logo. */
  logoImage: 'P154', // logo image — a Commons file name
  endTime: 'P582', // end time — marks a logo the studio has retired
} as const;

export const WikidataItem = {
  /* What a studio is, for finding one by name: the industry, or the kind of company. */
  videoGameIndustry: 'Q941594',
  videoGameDeveloper: 'Q210167',
  videoGamePublisher: 'Q1137109',
} as const;
