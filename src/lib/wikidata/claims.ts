/**
 * Reading Wikidata statements without trusting them.
 *
 * A claim is a statement about the game — "award received: The Game Awards −
 * Game of the Year" — with a main value (the *mainsnak*), qualifiers that
 * refine it (the year, the character, the language) and a rank. Any of those
 * can be missing or odd: a mainsnak can be `somevalue` ("some unknown person
 * voiced this") or `novalue`, a datavalue can be absent, an id can be the
 * pre-2015 numeric-only form. Every reader here takes `unknown` and returns
 * a value or null; nothing throws on a malformed statement, it is skipped.
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

/** A decimal string as Wikibase serialises quantities: sign optional, no exponent. */
const DECIMAL = /^[+-]?\d+(?:\.\d+)?$/;

/** A Wikibase time: `+2015-00-00T00:00:00Z`. The sign is part of the year. */
const TIME = /^([+-])(\d+)-\d{2}-\d{2}T/;

/** Wikibase's precision for "the year is known" — 9. Coarser means a decade or a century. */
const YEAR_PRECISION = 9;

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
 * statements with no references: an unsourced award is still an award someone
 * recorded, and discarding it would empty most of this screen.
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

/**
 * Wikidata's "best rank": the preferred statements if there are any, the
 * normal ones otherwise.
 *
 * For a property that holds *one* current value with superseded ones beside it
 * — a budget revised upward, say, with the latest figure marked preferred. Not
 * for lists: one award marked preferred must not hide the other thirteen.
 */
export function bestStatementsOf(claims: WikidataClaims, property: string): Statement[] {
  const statements = statementsOf(claims, property);
  const preferred = statements.filter((statement) => statement.rank === 'preferred');
  return preferred.length > 0 ? preferred : statements;
}

/** The value of a snak, or undefined when it is `somevalue`, `novalue` or malformed. */
function valueOf(snak: unknown): unknown {
  if (!isRecord(snak) || snak.snaktype !== 'value' || !isRecord(snak.datavalue)) return undefined;
  return snak.datavalue.value;
}

/** An item id from an entity-valued snak: `mainsnak.datavalue.value.id`. */
export function entityIdOf(snak: unknown): string | null {
  const value = valueOf(snak);
  if (!isRecord(value)) return null;
  if (isItemId(value.id)) return value.id;

  /* Older serialisations carried only the number. */
  const numeric = value['numeric-id'];
  if (value['entity-type'] === 'item' && typeof numeric === 'number' && Number.isSafeInteger(numeric) && numeric > 0) {
    return `Q${numeric}`;
  }
  return null;
}

/** A non-empty string from a string-valued snak — a character's name, an external id. */
export function stringOf(snak: unknown): string | null {
  const value = valueOf(snak);
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed || null;
}

/**
 * A quantity: `{ amount: "+306000000", unit: "http://www.wikidata.org/entity/Q123213" }`.
 *
 * The unit comes back as an item id, or null for a bare number (Wikibase writes
 * that unit as `"1"`) and for a unit it cannot read — in which case the amount
 * still prints, without one.
 */
export function quantityOf(snak: unknown): { amount: number; unit: string | null } | null {
  const value = valueOf(snak);
  if (!isRecord(value) || typeof value.amount !== 'string' || !DECIMAL.test(value.amount)) {
    return null;
  }

  const amount = Number(value.amount);
  if (!Number.isFinite(amount)) return null;

  let unit: string | null = null;
  if (typeof value.unit === 'string' && value.unit !== '1') {
    const id = value.unit.slice(value.unit.lastIndexOf('/') + 1);
    unit = isItemId(id) ? id : null;
  }
  return { amount, unit };
}

/** The year of a time snak, when the year itself is known. */
export function yearOf(snak: unknown): number | null {
  const value = valueOf(snak);
  if (!isRecord(value) || typeof value.time !== 'string') return null;
  if (typeof value.precision !== 'number' || value.precision < YEAR_PRECISION) return null;

  const match = TIME.exec(value.time);
  if (!match || match[1] !== '+') return null;
  const year = Number(match[2]);
  return Number.isSafeInteger(year) && year > 0 ? year : null;
}

function qualifierSnaks(statement: Statement, property: string): unknown[] {
  const snaks = statement.qualifiers[property];
  return Array.isArray(snaks) ? snaks : [];
}

/** Every item id in one qualifier of one statement, in order, once each. */
export function qualifierEntityIds(statement: Statement, property: string): string[] {
  const ids = qualifierSnaks(statement, property).map(entityIdOf);
  return unique(ids.filter((id): id is string => id !== null));
}

/** Every string in one qualifier of one statement, in order, once each. */
export function qualifierStrings(statement: Statement, property: string): string[] {
  const values = qualifierSnaks(statement, property).map(stringOf);
  return unique(values.filter((value): value is string => value !== null));
}

/** The first readable year in one qualifier of one statement. */
export function qualifierYear(statement: Statement, property: string): number | null {
  for (const snak of qualifierSnaks(statement, property)) {
    const year = yearOf(snak);
    if (year !== null) return year;
  }
  return null;
}

export function unique<T>(values: readonly T[]): T[] {
  return [...new Set(values)];
}
