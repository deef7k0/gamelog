/**
 * Reading Wikidata statements without trusting them.
 *
 * A claim is a statement about an item — "logo image: Naughty Dog logo.svg" —
 * with a main value (the *mainsnak*), qualifiers that refine it (when it
 * started, when it ended) and a rank. Any of those can be missing or odd: a
 * mainsnak can be `somevalue` or `novalue`, a datavalue can be absent. Every
 * reader here takes `unknown` and returns a value or null; nothing throws on a
 * malformed statement, it is skipped.
 *
 * What is here is what a studio's logo needs (`commons.ts`, `studio-logo.ts`).
 * The readers for entities, quantities, years and qualifiers belonged to the
 * game's "Additional information" screen and left with it.
 *
 * Pure: no imports from React Native or `@/`, so `npm test` can load it.
 */

/** The `claims` object of one entity, keyed by property id. Validated as a record, nothing more. */
export type WikidataClaims = Readonly<Record<string, unknown>>;

/** A statement narrowed to the three parts this app reads. */
export type Statement = {
  mainsnak: unknown;
  qualifiers: Readonly<Record<string, unknown>>;
  rank: 'preferred' | 'normal';
};

const ITEM_ID = /^Q[1-9]\d*$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isItemId(value: unknown): value is string {
  return typeof value === 'string' && ITEM_ID.test(value);
}

/**
 * Every usable statement for a property, in Wikidata's order.
 *
 * Deprecated statements are dropped — deprecation is Wikidata's way of saying
 * "recorded, and known to be wrong". Everything else is kept, including
 * statements with no references.
 */
export function statementsOf(claims: WikidataClaims, property: string): Statement[] {
  const raw = claims[property];
  if (!Array.isArray(raw)) return [];

  const statements: Statement[] = [];
  for (const entry of raw) {
    if (!isRecord(entry) || entry.rank === 'deprecated') continue;
    statements.push({
      mainsnak: entry.mainsnak,
      qualifiers: isRecord(entry.qualifiers) ? entry.qualifiers : {},
      rank: entry.rank === 'preferred' ? 'preferred' : 'normal',
    });
  }
  return statements;
}

/** The value of a snak, or undefined when it is `somevalue`, `novalue` or malformed. */
function valueOf(snak: unknown): unknown {
  if (!isRecord(snak) || snak.snaktype !== 'value' || !isRecord(snak.datavalue)) return undefined;
  return snak.datavalue.value;
}

/** A non-empty string from a string-valued snak — a Commons file name. */
export function stringOf(snak: unknown): string | null {
  const value = valueOf(snak);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
