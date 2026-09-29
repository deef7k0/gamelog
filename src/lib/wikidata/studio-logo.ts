import { WikidataItem, WikidataProperty as P } from '../../constants/wikidata';
import { isItemId, isRecord, type WikidataClaims } from './claims';
import { COMMONS_API, searchHits, wikimediaRequest, WikidataError } from './client';
import {
  currentLogosFirst,
  EXTMETADATA_FIELDS,
  isStudioLogoFile,
  logoFileNames,
  namesMatch,
  pickVerifiedLogo,
  readCommonsFile,
  type CommonsFile,
  type StudioLogo,
} from './commons';

/**
 * A studio's logo from Wikimedia Commons — only ever a public-domain or CC0
 * one — or null, and the studio page prints the name.
 *
 * ## Which file is the studio's logo
 *
 * Asked of Wikidata first, because Wikidata says so outright: a studio's item
 * carries its logo as P154, a Commons file name. The item is found by an exact
 * identifier where there is one, and by name only under constraints:
 *
 *  1. **The IGDB slug** (P9650, "Internet Game Database company ID") — the same
 *     key the app already holds. Mojang Studios, Naughty Dog, FromSoftware and
 *     ConcernedApe resolve this way.
 *  2. **The name, among video game companies** — `inlabel:"<name>@en"` limited to
 *     items in the video game industry or typed as a developer or publisher,
 *     then kept only if a label or alias equals the name and exactly one item
 *     does. Valve (alias "Valve" on "Valve Corporation") and Supergiant Games
 *     resolve this way.
 *
 * Only when Wikidata names no logo does Commons get searched, and a searched
 * file must be titled *and* categorised as the studio's logo (see
 * `isStudioLogoFile`). An item whose P154 files all fail the licence check gets
 * no search at all: its own logo is not free, and another file is not its logo.
 * Commons' "depicts" data is deliberately not used — "depicts Valve" returns the
 * Steam logo, which is Valve's product and not Valve.
 *
 * ## Then the licence
 *
 * Every candidate goes through `verifyLicense` in `commons.ts`. Nothing here
 * decides what is free.
 *
 * Network failures throw `WikidataError`, so a caller never caches a failure as
 * "no logo".
 */
export type StudioRef = { name: string; slug: string | null };

/** An IGDB company slug: lower-case ASCII, digits and hyphens. Anything else is not searched. */
const SLUG = /^[a-z0-9][a-z0-9-]*$/;

/** Candidates for the name route. More than this and the name is too common to trust anyway. */
const NAME_CANDIDATES = 5;

/** Wide enough for a crisp logo at 70% of a phone's width, at 3× density. */
const LOGO_RENDER_WIDTH = 960;

export async function getStudioLogo(
  studio: StudioRef,
  signal?: AbortSignal
): Promise<StudioLogo | null> {
  const item = await findStudioItem(studio, signal);
  if (item) {
    const names = logoFileNames(await getItemClaims(item, P.logoImage, signal));
    if (names.length > 0) return pickVerifiedLogo(await getCommonsFiles(names, signal));
  }
  return searchCommonsLogo(studio.name, signal);
}

/** The studio's Wikidata item, or null when it cannot be told apart with certainty. */
async function findStudioItem(
  { name, slug }: StudioRef,
  signal?: AbortSignal
): Promise<string | null> {
  if (slug && SLUG.test(slug)) {
    const hits = await searchItems(`haswbstatement:${P.igdbCompanyId}=${slug}`, 2, signal);
    if (hits.length === 1) return hits[0];
    /* An exact identifier on two items is a data problem, not a hint. */
    if (hits.length > 1) return null;
  }

  const term = searchable(name);
  if (!term) return null;
  const hits = await searchItems(
    `inlabel:"${term}@en" haswbstatement:${P.industry}=${WikidataItem.videoGameIndustry}` +
      `|${P.instanceOf}=${WikidataItem.videoGameDeveloper}` +
      `|${P.instanceOf}=${WikidataItem.videoGamePublisher}`,
    NAME_CANDIDATES,
    signal
  );
  if (hits.length === 0) return null;

  const body = await wikimediaRequest(
    { action: 'wbgetentities', ids: hits.join('|'), props: 'labels|aliases', languages: 'en|mul' },
    signal
  );
  if (!isRecord(body.entities))
    throw new WikidataError('malformed', 'No entities in the response.');
  const entities = body.entities;
  const matching = hits.filter((id) =>
    namesOf(entities[id]).some((label) => namesMatch(label, name))
  );
  return matching.length === 1 ? matching[0] : null;
}

/** A name that is safe inside a quoted search phrase — or null when nothing is left. */
function searchable(name: string): string | null {
  const term = name.replace(/["\\]/g, ' ').replace(/\s+/g, ' ').trim();
  return term && term.length <= 120 ? term : null;
}

function namesOf(entity: unknown): string[] {
  if (!isRecord(entity)) return [];
  const names: string[] = [];
  if (isRecord(entity.labels)) {
    for (const label of Object.values(entity.labels)) {
      if (isRecord(label) && typeof label.value === 'string') names.push(label.value);
    }
  }
  if (isRecord(entity.aliases)) {
    for (const list of Object.values(entity.aliases)) {
      if (!Array.isArray(list)) continue;
      for (const alias of list) {
        if (isRecord(alias) && typeof alias.value === 'string') names.push(alias.value);
      }
    }
  }
  return names;
}

async function searchItems(query: string, limit: number, signal?: AbortSignal): Promise<string[]> {
  const body = await wikimediaRequest(
    {
      action: 'query',
      list: 'search',
      srsearch: query,
      srnamespace: '0',
      srlimit: String(limit),
      srprop: '',
      srinfo: '',
    },
    signal
  );
  return searchHits(body)
    .map((hit) => hit.title)
    .filter(isItemId);
}

/** One property's statements on an item — P154 is a few hundred bytes, the whole item can be 100 KB. */
async function getItemClaims(
  item: string,
  property: string,
  signal?: AbortSignal
): Promise<WikidataClaims> {
  const body = await wikimediaRequest({ action: 'wbgetclaims', entity: item, property }, signal);
  return isRecord(body.claims) ? body.claims : {};
}

const IMAGEINFO = {
  prop: 'imageinfo',
  iiprop: 'url|mime|size|extmetadata',
  iiurlwidth: String(LOGO_RENDER_WIDTH),
  iiextmetadatafilter: EXTMETADATA_FIELDS,
  iiextmetadatalanguage: 'en',
};

/** Named files' pages, in the order they were asked for. */
async function getCommonsFiles(names: string[], signal?: AbortSignal): Promise<CommonsFile[]> {
  const titles = names.slice(0, 50).map((name) => `File:${name}`);
  const body = await wikimediaRequest(
    { action: 'query', titles: titles.join('|'), ...IMAGEINFO },
    signal,
    COMMONS_API
  );
  const query = isRecord(body.query) ? body.query : null;
  if (!query) throw new WikidataError('malformed', 'No query in the Commons response.');

  /* The API answers under its normalised titles ("File:Valve_logo.svg" →
     "File:Valve logo.svg"); map the asked-for ones through it. */
  const renamed = new Map<string, string>();
  if (Array.isArray(query.normalized)) {
    for (const entry of query.normalized) {
      if (isRecord(entry) && typeof entry.from === 'string' && typeof entry.to === 'string') {
        renamed.set(entry.from, entry.to);
      }
    }
  }
  const byTitle = new Map<string, CommonsFile>();
  for (const page of isRecord(query.pages) ? Object.values(query.pages) : []) {
    const file = readCommonsFile(page);
    if (file) byTitle.set(file.title, file);
  }
  return titles
    .map((title) => byTitle.get(renamed.get(title) ?? title))
    .filter((file): file is CommonsFile => file !== undefined);
}

/**
 * Commons, searched by name, for a studio Wikidata names no logo for. Strict:
 * the file must be titled and categorised as this studio's logo, and pass the
 * licence check like any other.
 *
 * Exported so the fallback can be exercised on its own — it is where false
 * positives live ("Valve Index logo.svg" came from here before the title rule).
 */
export async function searchCommonsLogo(
  name: string,
  signal?: AbortSignal
): Promise<StudioLogo | null> {
  const term = searchable(name);
  if (!term) return null;

  const body = await wikimediaRequest(
    {
      action: 'query',
      generator: 'search',
      gsrsearch: `intitle:"${term}" intitle:logo`,
      gsrnamespace: '6',
      gsrlimit: '10',
      ...IMAGEINFO,
    },
    signal,
    COMMONS_API
  );

  /* A search with no results comes back with no `query` at all. */
  const pages = isRecord(body.query) && isRecord(body.query.pages) ? body.query.pages : {};
  const ranked = Object.values(pages)
    .filter(isRecord)
    .sort((a, b) => (Number(a.index) || 0) - (Number(b.index) || 0));

  const files = ranked
    .map(readCommonsFile)
    .filter((file): file is CommonsFile => file !== null && isStudioLogoFile(file, name));
  return pickVerifiedLogo(currentLogosFirst(files));
}
