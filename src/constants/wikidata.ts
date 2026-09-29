/**
 * Wikidata's vocabulary, as the additional-information screen reads it.
 *
 * Every property and item id that feature depends on is here and nowhere else,
 * so the whole of what is asked of Wikidata can be read in one place, and a
 * property that is deprecated upstream is one edit. Each id was checked against
 * the live API (`wbgetentities` with `props=labels|datatype`) when this was
 * written — the comment beside it is Wikidata's own English label.
 *
 * No imports: `npm test` loads this under plain Node, through
 * `lib/wikidata/normalize.ts`.
 */

export const WikidataProperty = {
  /* What the screen shows. */
  awardReceived: 'P166', // award received
  nominatedFor: 'P1411', // nominated for
  castMember: 'P161', // cast member
  voiceActor: 'P725', // voice actor
  capitalCost: 'P2130', // capital cost — Wikidata's "budget"
  director: 'P57', // director
  producer: 'P162', // producer
  executiveProducer: 'P1431', // executive producer
  designedBy: 'P287', // designed by
  screenwriter: 'P58', // screenwriter — also used for game writers
  programmer: 'P943', // programmer
  composer: 'P86', // composer

  /* Qualifiers, read off the statement they are attached to and never off the
     game. A P453 belongs to one cast statement; collected game-wide it would
     hand every actor every character. */
  characterRole: 'P453', // character role (an item)
  characterName: 'P4633', // name of the character role (a string)
  languageOfWork: 'P407', // language of work or name — which dub a voice is in
  appliesToPart: 'P518', // applies to part — what a budget covers
  pointInTime: 'P585', // point in time — the year of an award

  /* How the item for a game is found. Exact identifiers only: nothing here is
     ever matched by title. */
  igdbGameId: 'P5794', // Internet Game Database game ID — the slug
  igdbNumericGameId: 'P9043', // IGDB numeric game ID — a qualifier on P5794
  steamAppId: 'P1733', // Steam application ID

  /* How a person is told from a studio. */
  instanceOf: 'P31', // instance of
} as const;

export const WikidataItem = {
  human: 'Q5',
  english: 'Q1860',
} as const;

/**
 * The people behind a game, in the order the People section ranks roles.
 *
 * The five the feature was specified with — director, producer, designer,
 * screenwriter, composer — plus the two other person-specific credits that are
 * in real use on game items: programmer (P943, on ~350 items with an IGDB id)
 * and executive producer (P1431). Creator (P170) and author (P50) were left out
 * on purpose: on games they hold studios and franchise owners about as often as
 * people, and this list exists to name the people who made the thing.
 *
 * Order matters twice. A person's roles are listed in this order, and the
 * People section lists people by the first role they appear under — so the
 * director leads and the composer closes, as in a credit roll.
 */
export const CREDIT_ROLES = [
  { property: WikidataProperty.director, role: 'Director' },
  { property: WikidataProperty.producer, role: 'Producer' },
  { property: WikidataProperty.executiveProducer, role: 'Executive producer' },
  { property: WikidataProperty.designedBy, role: 'Designer' },
  { property: WikidataProperty.screenwriter, role: 'Screenwriter' },
  { property: WikidataProperty.programmer, role: 'Programmer' },
  { property: WikidataProperty.composer, role: 'Composer' },
] as const;

export type CurrencyFormat = {
  /** ISO 4217. */
  code: string;
  /** Printed before the amount instead of the code — only where it is unambiguous in English. */
  symbol?: string;
};

/**
 * Currency items, by Wikidata id, for printing a budget as "$40 million".
 *
 * A budget arrives as an amount and a unit *item*: `+306000000` in
 * `Q123213`. The item's label ("złoty") is always resolved as well, so a
 * currency missing from this table still prints — as "306 million złoty" —
 * and nothing is ever converted. Each id was checked against the item's ISO
 * 4217 code (P498). Symbols only for the four an English reader takes at face
 * value; every other currency prints its code, because "$" alone would claim
 * a Canadian budget was American.
 */
export const CURRENCIES: Readonly<Record<string, CurrencyFormat>> = {
  Q4917: { code: 'USD', symbol: '$' },
  Q4916: { code: 'EUR', symbol: '€' },
  Q25224: { code: 'GBP', symbol: '£' },
  Q8146: { code: 'JPY', symbol: '¥' },
  Q123213: { code: 'PLN' },
  Q1104069: { code: 'CAD' },
  Q259502: { code: 'AUD' },
  Q39099: { code: 'CNY' },
  Q202040: { code: 'KRW' },
  Q122922: { code: 'SEK' },
  Q41044: { code: 'RUB' },
  Q25344: { code: 'CHF' },
  Q25417: { code: 'DKK' },
  Q132643: { code: 'NOK' },
  Q131016: { code: 'CZK' },
  Q173117: { code: 'BRL' },
  Q80524: { code: 'INR' },
  Q1472704: { code: 'NZD' },
};
