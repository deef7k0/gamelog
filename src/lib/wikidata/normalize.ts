import {
  CREDIT_ROLES,
  CURRENCIES,
  WikidataItem,
  WikidataProperty as P,
  type CurrencyFormat,
} from '../../constants/wikidata';
import {
  bestStatementsOf,
  entityIdOf,
  qualifierEntityIds,
  qualifierStrings,
  qualifierYear,
  quantityOf,
  statementsOf,
  unique,
  type Statement,
  type WikidataClaims,
} from './claims';
import type {
  WikidataAward,
  WikidataBudget,
  WikidataCastMember,
  WikidataCredit,
  WikidataEntityRef,
  WikidataGameInfo,
  WikidataPerson,
} from './types';

/**
 * From a game's claims to what the additional-information screen shows.
 *
 * Two passes around one network round trip. `referencedEntityIds` lists every
 * item the claims point at that the screen could show — so their labels are
 * fetched in one batched request, not one per award or per actor — and
 * `normalizeGameInfo` builds the screen's data from the claims and those
 * labels. Only the properties in `constants/wikidata.ts` are read; the other
 * hundred-odd claims on a game item (platforms, genres, identifiers) are never
 * touched.
 *
 * Pure, and covered by `npm test`.
 */

type EntityRefs = ReadonlyMap<string, WikidataEntityRef>;

/** The printable form of an item a claim points at: its current id and a label, or null. */
function resolve(id: string | null, refs: EntityRefs): { id: string; label: string } | null {
  if (!id) return null;
  const ref = refs.get(id);
  return ref?.label ? { id: ref.id, label: ref.label } : null;
}

/** Every item whose label the screen might print. */
export function referencedEntityIds(claims: WikidataClaims): string[] {
  const ids: string[] = [];
  const add = (id: string | null) => {
    if (id) ids.push(id);
  };

  for (const property of [P.awardReceived, P.nominatedFor]) {
    for (const statement of statementsOf(claims, property)) add(entityIdOf(statement.mainsnak));
  }
  for (const property of [P.castMember, P.voiceActor]) {
    for (const statement of statementsOf(claims, property)) {
      add(entityIdOf(statement.mainsnak));
      qualifierEntityIds(statement, P.characterRole).forEach(add);
      qualifierEntityIds(statement, P.languageOfWork).forEach(add);
    }
  }
  for (const statement of bestStatementsOf(claims, P.capitalCost)) {
    add(quantityOf(statement.mainsnak)?.unit ?? null);
    qualifierEntityIds(statement, P.appliesToPart).forEach(add);
  }
  ids.push(...creditCandidateIds(claims));

  return unique(ids);
}

/** Every item credited in a role — the ones the human check has to classify. */
export function creditCandidateIds(claims: WikidataClaims): string[] {
  const ids: string[] = [];
  for (const { property } of CREDIT_ROLES) {
    for (const statement of statementsOf(claims, property)) {
      const id = entityIdOf(statement.mainsnak);
      if (id) ids.push(id);
    }
  }
  return unique(ids);
}

/**
 * The screen's data.
 *
 * @param refs    Every id from `referencedEntityIds`, resolved. Anything
 *                missing from it, or resolved without a label, is dropped.
 * @param humans  The current ids of the credited entities that are people
 *                (P31 = Q5). Decides who is listed under People, and whether
 *                Producers and Designers name people or a studio.
 */
export function normalizeGameInfo(
  qid: string,
  claims: WikidataClaims,
  refs: EntityRefs,
  humans: ReadonlySet<string>
): WikidataGameInfo {
  return {
    qid,
    sourceUrl: `https://www.wikidata.org/wiki/${qid}`,
    awards: awardsFrom(claims, P.awardReceived, refs),
    nominations: awardsFrom(claims, P.nominatedFor, refs),
    cast: castFrom(claims, refs),
    budgets: budgetsFrom(claims, refs),
    producers: preferPeople(creditsFrom(claims, P.producer, refs), humans),
    composers: creditsFrom(claims, P.composer, refs),
    designers: preferPeople(creditsFrom(claims, P.designedBy, refs), humans),
    screenwriters: creditsFrom(claims, P.screenwriter, refs),
    people: peopleFrom(claims, refs, humans),
  };
}

/** Whether there is anything at all to show. Null — no item found — is nothing. */
export function hasGameInfo(info: WikidataGameInfo | null | undefined): info is WikidataGameInfo {
  if (!info) return false;
  return [
    info.awards,
    info.nominations,
    info.cast,
    info.budgets,
    info.producers,
    info.composers,
    info.designers,
    info.screenwriters,
    info.people,
  ].some((list) => list.length > 0);
}

// ---------------------------------------------------------------------------
// Awards and nominations
// ---------------------------------------------------------------------------

const UNDATED = Number.MAX_SAFE_INTEGER;

/**
 * P166 or P1411, oldest first.
 *
 * Each award item is one category ("The Game Awards − Best Narrative"), so an
 * award plus its year is the identity: the same pair twice is one row, the
 * same award in two years is two. A copy with no year beside a dated one is
 * dropped — it says nothing the dated one does not, and printed it would look
 * like a duplicate. Undated awards close the list, in Wikidata's order.
 *
 * Awards and nominations are read independently. Winning is not taken to
 * imply a nomination, nor the other way round.
 */
function awardsFrom(claims: WikidataClaims, property: string, refs: EntityRefs): WikidataAward[] {
  const found: (WikidataAward & { order: number })[] = [];
  const seen = new Set<string>();

  for (const statement of statementsOf(claims, property)) {
    const award = resolve(entityIdOf(statement.mainsnak), refs);
    if (!award) continue;
    const year = qualifierYear(statement, P.pointInTime);
    const key = `${award.id}|${year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    found.push({ id: award.id, name: award.label, year, order: found.length });
  }

  const dated = new Set(found.filter((award) => award.year !== null).map((award) => award.id));
  return found
    .filter((award) => award.year !== null || !dated.has(award.id))
    .sort((a, b) => (a.year ?? UNDATED) - (b.year ?? UNDATED) || a.order - b.order)
    .map((award) => ({ id: award.id, name: award.name, year: award.year }));
}

// ---------------------------------------------------------------------------
// Cast
// ---------------------------------------------------------------------------

/**
 * P161 and P725, one row per performer.
 *
 * The character comes from **the qualifiers of that performer's own
 * statement** — P453 is attached to one cast statement, never to the game —
 * so "Michael Mando as Vaas Montenegro" can only ever pair the two a single
 * statement pairs. Several statements for one performer (one per character,
 * or one under each property) merge into a row listing each character once.
 *
 * A dub is its own row: "Portuguese" voices are a different performance from
 * the original, and merging them would put two languages' casts under one
 * name. Originals come first, dubs after, each in Wikidata's order.
 */
function castFrom(claims: WikidataClaims, refs: EntityRefs): WikidataCastMember[] {
  const members = new Map<string, WikidataCastMember>();
  const sources = [
    [P.castMember, 'cast'],
    [P.voiceActor, 'voice'],
  ] as const;

  for (const [property, kind] of sources) {
    for (const statement of statementsOf(claims, property)) {
      /* No performer, no row: a `somevalue` voice ("unknown") names nobody,
         and a character with nobody beside it is not a cast credit. */
      const performer = resolve(entityIdOf(statement.mainsnak), refs);
      if (!performer) continue;

      const dub = dubOf(statement, refs);
      const key = `${performer.id}|${dub ?? ''}`;
      let member = members.get(key);
      if (!member) {
        member = {
          id: performer.id,
          name: performer.label,
          characters: [],
          cast: false,
          voice: false,
          dub,
        };
        members.set(key, member);
      }

      member[kind] = true;
      for (const character of charactersOf(statement, refs)) {
        if (!member.characters.includes(character)) member.characters.push(character);
      }
    }
  }

  const all = [...members.values()];
  return [
    ...all.filter((member) => member.dub === null),
    ...all.filter((member) => member.dub !== null),
  ];
}

/**
 * The characters on one cast statement: P453's items by label, else P4633's
 * strings — the name Wikidata records when no item for the role exists
 * ("Female V", "Panam Palmer"). Empty when neither is there, and the performer
 * is still listed.
 */
function charactersOf(statement: Statement, refs: EntityRefs): string[] {
  const named = qualifierEntityIds(statement, P.characterRole)
    .map((id) => resolve(id, refs)?.label ?? null)
    .filter((label): label is string => label !== null);
  if (named.length > 0) return unique(named);
  return qualifierStrings(statement, P.characterName);
}

/**
 * The dub a voice statement belongs to, from its P407 qualifiers — null when
 * there are none or English is among them, which is the game's own cast.
 */
function dubOf(statement: Statement, refs: EntityRefs): string | null {
  const languages = qualifierEntityIds(statement, P.languageOfWork);
  if (languages.length === 0) return null;
  const isEnglish = (id: string) =>
    id === WikidataItem.english || refs.get(id)?.id === WikidataItem.english;
  if (languages.some(isEnglish)) return null;

  const names = languages
    .map((id) => resolve(id, refs)?.label ?? null)
    .filter((label): label is string => label !== null);
  return names.length > 0 ? listOf(unique(names)) : null;
}

// ---------------------------------------------------------------------------
// Budget
// ---------------------------------------------------------------------------

/**
 * P2130 (capital cost), at Wikidata's best rank: a revised figure marked
 * preferred replaces the one it revised. Several normal-rank figures are
 * several facts — Cyberpunk 2077 records its production and marketing costs
 * separately — so each is kept with what it covers.
 */
function budgetsFrom(claims: WikidataClaims, refs: EntityRefs): WikidataBudget[] {
  const budgets: WikidataBudget[] = [];
  const seen = new Set<string>();

  for (const statement of bestStatementsOf(claims, P.capitalCost)) {
    const quantity = quantityOf(statement.mainsnak);
    if (!quantity) continue;

    const currency = quantity.unit ? currencyFor(quantity.unit, refs) : null;
    const unitLabel =
      !currency && quantity.unit ? (resolve(quantity.unit, refs)?.label ?? null) : null;
    const formatted = formatBudgetAmount(quantity.amount, currency, unitLabel);
    const scope = scopeOf(statement, refs);
    const year = qualifierYear(statement, P.pointInTime);

    const key = `${formatted}|${scope ?? ''}|${year ?? ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    budgets.push({
      amount: quantity.amount,
      currency: currency?.code ?? null,
      formatted,
      scope,
      year,
    });
  }
  return budgets;
}

function currencyFor(unit: string, refs: EntityRefs): CurrencyFormat | null {
  return CURRENCIES[refs.get(unit)?.id ?? unit] ?? CURRENCIES[unit] ?? null;
}

/** What a budget covers, from P518: "Development and marketing". */
function scopeOf(statement: Statement, refs: EntityRefs): string | null {
  const parts = qualifierEntityIds(statement, P.appliesToPart)
    .map((id) => resolve(id, refs)?.label ?? null)
    .filter((label): label is string => label !== null);
  if (parts.length === 0) return null;
  const scope = listOf(unique(parts));
  return scope.charAt(0).toUpperCase() + scope.slice(1);
}

/**
 * A budget as a reader says it: "$40 million", "PLN 306 million".
 *
 * The four symbols English readers take at face value go before the figure;
 * any other known currency prints its ISO code, and an unknown unit prints its
 * own label after the figure ("20 million Deutsche Mark"). No unit at all —
 * or one that could not be resolved — prints the bare figure. Nothing is
 * converted: a budget in złoty is a budget in złoty.
 */
export function formatBudgetAmount(
  amount: number,
  currency: CurrencyFormat | null,
  unitLabel: string | null
): string {
  const sign = amount < 0 ? '−' : '';
  const magnitude = formatMagnitude(Math.abs(amount));
  if (currency?.symbol) return `${sign}${currency.symbol}${magnitude}`;
  if (currency) return `${sign}${currency.code} ${magnitude}`;
  if (unitLabel) return `${sign}${magnitude} ${unitLabel}`;
  return `${sign}${magnitude}`;
}

const SCALES = [
  [1e12, 'trillion'],
  [1e9, 'billion'],
  [1e6, 'million'],
] as const;

/**
 * 306000000 → "306 million"; 1500000 → "1.5 million"; 850000 → "850,000".
 *
 * Grouped by hand rather than through `toLocaleString`, so the output is the
 * same on Hermes, in a browser and under `npm test`.
 */
export function formatMagnitude(value: number): string {
  for (const [size, word] of SCALES) {
    const scaled = Math.round((value / size) * 100) / 100;
    if (scaled >= 1) return `${scaled} ${word}`;
  }

  const [whole, fraction] = String(Math.round(value * 100) / 100).split('.');
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return fraction ? `${grouped}.${fraction}` : grouped;
}

// ---------------------------------------------------------------------------
// Credits and people
// ---------------------------------------------------------------------------

/** Everyone credited under one property, once each, in Wikidata's order. */
function creditsFrom(claims: WikidataClaims, property: string, refs: EntityRefs): WikidataCredit[] {
  const credits = new Map<string, WikidataCredit>();
  for (const statement of statementsOf(claims, property)) {
    const entity = resolve(entityIdOf(statement.mainsnak), refs);
    if (entity && !credits.has(entity.id))
      credits.set(entity.id, { id: entity.id, name: entity.label });
  }
  return [...credits.values()];
}

/**
 * The people in a role, when the role names any; everyone in it otherwise.
 *
 * For P162 and P287, which hold a studio as often as a person. Where Wikidata
 * names people, a studio beside them is dropped; where it names only a studio —
 * The Witcher 3's producer is CD Projekt RED — the studio is what it said.
 */
function preferPeople(credits: WikidataCredit[], humans: ReadonlySet<string>): WikidataCredit[] {
  const people = credits.filter((credit) => humans.has(credit.id));
  return people.length > 0 ? people : credits;
}

/**
 * One row per person across every role in `CREDIT_ROLES`, keyed by item — so
 * Hideo Kojima, credited as director, writer, producer and designer of Death
 * Stranding, is one person with four roles and not four people. Two people
 * who share a name stay two: the key is the item, never the label.
 *
 * People only. A studio or a band credited in a role keeps its place in that
 * role's own section and is not listed here.
 */
function peopleFrom(
  claims: WikidataClaims,
  refs: EntityRefs,
  humans: ReadonlySet<string>
): WikidataPerson[] {
  const people = new Map<string, WikidataPerson>();
  for (const { property, role } of CREDIT_ROLES) {
    for (const credit of creditsFrom(claims, property, refs)) {
      if (!humans.has(credit.id)) continue;
      const person = people.get(credit.id) ?? { id: credit.id, name: credit.name, roles: [] };
      if (!person.roles.includes(role)) person.roles.push(role);
      people.set(credit.id, person);
    }
  }
  return [...people.values()];
}

/** "a", "a and b", "a, b and c". */
function listOf(items: readonly string[]): string {
  if (items.length <= 1) return items.join('');
  return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
}
