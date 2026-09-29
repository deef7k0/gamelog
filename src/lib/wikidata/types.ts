/**
 * What the additional-information screen receives from Wikidata.
 *
 * Plain labels, already resolved. The screen never sees a claim, a snak or a
 * Q-ID it would have to print: every `id` below is an identity — a React key,
 * a dedupe key — and is never displayed. A value whose label could not be
 * resolved is dropped by the normaliser rather than shown as `Q123456`.
 *
 * Every list may be empty and the screen renders a section only when its list
 * has something in it. No field is ever a placeholder: there is no "Unknown",
 * no "N/A", and nothing inferred from anything else.
 */

/** An award received or a nomination. Both are the same shape of fact. */
export type WikidataAward = {
  /** The award item — one per category, "The Game Awards − Best Narrative". */
  id: string;
  name: string;
  /** From the statement's own P585 qualifier. Null when Wikidata gives none. */
  year: number | null;
};

/**
 * One performer and the characters they played.
 *
 * P161 (cast member) and P725 (voice actor) arrive as separate statements and
 * are merged here by performer, so an actor credited under both — or once per
 * character — is one row. `cast` and `voice` keep which property said so; the
 * screen marks a row as a voice only when P725 is the *only* one that did.
 */
export type WikidataCastMember = {
  /** The performer's item, canonical after merges. */
  id: string;
  name: string;
  /** From P453 on the performer's own statements; P4633 strings when no P453 label resolves. May be empty. */
  characters: string[];
  cast: boolean;
  voice: boolean;
  /**
   * The language of a dubbed performance — "Portuguese" — or null for the
   * original. Set only when the statement's P407 qualifiers leave English out,
   * which is what tells a localised cast from the one the game shipped with.
   */
  dub: string | null;
};

export type WikidataBudget = {
  amount: number;
  /** ISO 4217 when the unit is a currency this app knows; null otherwise. */
  currency: string | null;
  /** Ready to print: "$40 million", "PLN 306 million", "20 million Deutsche Mark". */
  formatted: string;
  /** What the figure covers, from P518: "Development and marketing". */
  scope: string | null;
  year: number | null;
};

/** A name credited in one role — a person, or a studio where no person is. */
export type WikidataCredit = { id: string; name: string };

/** One person and every role they are credited with, most senior first. */
export type WikidataPerson = { id: string; name: string; roles: string[] };

export type WikidataGameInfo = {
  /** The item these facts came from. For the source link only. */
  qid: string;
  sourceUrl: string;
  awards: WikidataAward[];
  nominations: WikidataAward[];
  cast: WikidataCastMember[];
  budgets: WikidataBudget[];
  producers: WikidataCredit[];
  composers: WikidataCredit[];
  designers: WikidataCredit[];
  screenwriters: WikidataCredit[];
  people: WikidataPerson[];
};

/**
 * An entity a claim points at, as the label request resolved it.
 *
 * `id` is where the entity lives *now*: `wbgetentities` follows a merge and
 * answers under the id that was asked for, so a claim still pointing at a
 * merged-away item resolves to the surviving one. Identity is always this id,
 * never the one written in the claim.
 */
export type WikidataEntityRef = {
  id: string;
  /** English, else Wikidata's language-neutral `mul` label. Null when it has neither. */
  label: string | null;
  /** The item's page id — how the human check addresses it. */
  pageId: number | null;
};
