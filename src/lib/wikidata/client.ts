import { Platform } from 'react-native';

import { WikidataItem, WikidataProperty } from '../../constants/wikidata';
import { isItemId, isRecord, type WikidataClaims } from './claims';
import { itemMatchesGame, itemSearchesFor, type WikidataLookup } from './lookup';
import { creditCandidateIds, normalizeGameInfo, referencedEntityIds } from './normalize';
import type { WikidataEntityRef, WikidataGameInfo } from './types';

/**
 * Wikidata's Action API, for the additional-information screen.
 *
 * ## The requests, and why there are so few
 *
 *  1. **Find the item** — `list=search` with `haswbstatement:`, an exact match
 *     on the game's IGDB slug (then its Steam appid). A few hundred bytes.
 *  2. **Its claims** — one `wbgetentities`, `props=claims`. 40 KB compressed
 *     for a heavily documented game like The Witcher 3.
 *  3. **Labels** — one `wbgetentities` for every item the claims point at, 50
 *     ids a request (the API's limit for an anonymous caller), in series.
 *  4. **Who is a person** — one search, `haswbstatement:P31=Q5` restricted to
 *     the credited items' page ids. Skipped when nothing is credited.
 *
 * Nothing is requested per field or per person. Wikidata rate-limits
 * anonymous traffic by IP and means it — a burst answers `429` with a
 * `retry-after` — so the requests run one after another, the result is cached
 * for a day by the caller, and a 429 is reported rather than retried.
 *
 * Every read also sends `origin=*`, which is what lets the same requests run
 * from `npm run web`: the API answers anonymous CORS requests that carry it.
 */

const ENDPOINT = 'https://www.wikidata.org/w/api.php';

/**
 * Wikimedia asks every client to identify itself. Browsers will not let a page
 * set `User-Agent`, so the web build sends `Api-User-Agent`, which the API
 * reads in its place and allows through CORS; native builds send both.
 */
const USER_AGENT = 'GameLog/1.0 (com.nomicoprod.gamelog; game credits from Wikidata)';

/** Long enough for a slow mobile connection; short enough that a dead one ends in the error state. */
const REQUEST_TIMEOUT_MS = 15_000;

/** `wbgetentities` accepts 50 ids per request from an anonymous caller. */
const LABEL_BATCH = 50;

/**
 * Page ids per human check. The search box caps a query at 300 characters;
 * 25 nine-digit ids and their separators leave room for the rest of it.
 */
const PERSON_BATCH = 25;

export type WikidataErrorKind = 'network' | 'timeout' | 'rate-limited' | 'unavailable' | 'malformed';

/** A failure to *reach or read* Wikidata — never "Wikidata has nothing", which is `null`. */
export class WikidataError extends Error {
  readonly kind: WikidataErrorKind;

  constructor(kind: WikidataErrorKind, message: string) {
    super(message);
    this.name = 'WikidataError';
    this.kind = kind;
  }
}

/**
 * Everything Wikidata says about one game that the screen shows, or null when
 * no item could be matched to it with certainty.
 *
 * Throws `WikidataError` when a request fails, so that a failure is never
 * cached as "no information".
 */
export async function getWikidataGameInfo(
  lookup: WikidataLookup,
  signal?: AbortSignal
): Promise<WikidataGameInfo | null> {
  const item = await findGameItem(lookup, signal);
  if (!item) return null;

  const refs = await resolveWikidataLabels(referencedEntityIds(item.claims), signal);
  const humans = await findPeople(creditCandidateIds(item.claims), refs, signal);
  return normalizeGameInfo(item.qid, item.claims, refs, humans);
}

/**
 * The game's item and its claims.
 *
 * Each search either finds exactly one item or is passed over — none, and
 * several, both mean "not this route". Several is narrowed once by the IGDB
 * numeric id where there is one; it is never settled by picking the first.
 * A found item whose own IGDB record names another game is passed over too
 * (see `itemMatchesGame`), which is the whole defence against showing one
 * game's credits under another's name.
 */
async function findGameItem(
  lookup: WikidataLookup,
  signal?: AbortSignal
): Promise<{ qid: string; claims: WikidataClaims } | null> {
  /* An item rejected on one route is not fetched again when the next route
     lands on it too — its claims have not changed in between. */
  const tried = new Set<string>();

  for (const search of itemSearchesFor(lookup)) {
    let hits = await searchItems(search.statement, signal);
    if (hits.length > 1 && search.narrowed) hits = await searchItems(search.narrowed, signal);
    if (hits.length !== 1 || tried.has(hits[0])) continue;
    tried.add(hits[0]);

    const claims = await getItemClaims(hits[0], signal);
    if (claims && itemMatchesGame(claims, lookup)) return { qid: hits[0], claims };
  }
  return null;
}

/** Item ids holding one exact statement. Two at most: two already means "ambiguous". */
async function searchItems(statement: string, signal?: AbortSignal): Promise<string[]> {
  const body = await request(
    {
      action: 'query',
      list: 'search',
      srsearch: `haswbstatement:${statement}`,
      srnamespace: '0',
      srlimit: '2',
      srprop: '',
      srinfo: '',
    },
    signal
  );
  return searchHits(body).map((hit) => hit.title).filter(isItemId);
}

/** One item's claims; null when the item no longer exists. */
async function getItemClaims(qid: string, signal?: AbortSignal): Promise<WikidataClaims | null> {
  const body = await request(
    { action: 'wbgetentities', ids: qid, props: 'claims', languages: 'en' },
    signal
  );
  const entity = isRecord(body.entities) ? body.entities[qid] : undefined;
  if (!isRecord(entity)) throw new WikidataError('malformed', `No entity ${qid} in the response.`);
  if ('missing' in entity) return null;
  /* Anything but an object is read as no statements, rather than as a
     failure: an item that records nothing is an answer, not an error. */
  return isRecord(entity.claims) ? entity.claims : {};
}

/**
 * Labels for a set of items: deduplicated, invalid ids dropped, batched 50 at
 * a time and fetched in series.
 *
 * English first, then `mul` — the label Wikidata now keeps once for every
 * language when a name is spelled the same in all of them. That is not a
 * nicety: Doom and Overwatch have no `en` label at all any more, and many
 * people's items are going the same way, so an English-only request would
 * silently drop them. An item with neither is left without a label, and the
 * normaliser drops it rather than print its id.
 *
 * Returns more than a label, because the same request has it for free: the
 * id the item now lives at (a merged item answers under the id asked for) and
 * its page id, which is how `findPeople` addresses it.
 */
export async function resolveWikidataLabels(
  ids: readonly string[],
  signal?: AbortSignal
): Promise<Map<string, WikidataEntityRef>> {
  const wanted = [...new Set(ids.filter(isItemId))];
  const refs = new Map<string, WikidataEntityRef>();

  for (let start = 0; start < wanted.length; start += LABEL_BATCH) {
    const batch = wanted.slice(start, start + LABEL_BATCH);
    const body = await request(
      { action: 'wbgetentities', ids: batch.join('|'), props: 'labels|info', languages: 'en|mul' },
      signal
    );
    if (!isRecord(body.entities)) throw new WikidataError('malformed', 'No entities in the response.');

    for (const id of batch) {
      const entity = body.entities[id];
      if (!isRecord(entity) || 'missing' in entity) continue;
      refs.set(id, {
        id: isItemId(entity.id) ? entity.id : id,
        label: labelOf(entity.labels),
        pageId: typeof entity.pageid === 'number' && entity.pageid > 0 ? entity.pageid : null,
      });
    }
  }
  return refs;
}

function labelOf(labels: unknown): string | null {
  if (!isRecord(labels)) return null;
  for (const language of ['en', 'mul']) {
    const entry = labels[language];
    if (isRecord(entry) && typeof entry.value === 'string' && entry.value.trim()) {
      return entry.value.trim();
    }
  }
  return null;
}

/**
 * Which credited items are people, as their current ids.
 *
 * P162 and P287 hold a studio as often as a person, and the People section is
 * for people. Reading each item's P31 would mean fetching its every claim —
 * 43 KB for Nintendo — so the question goes to search instead, which answers
 * "which of these pages is an instance of human" in one small response.
 *
 * `pageid:` with nothing after it is ignored by the search, which would then
 * return every human on Wikidata — so an empty batch is never sent, and only
 * the pages that were asked about are read back from the answer.
 */
async function findPeople(
  ids: readonly string[],
  refs: ReadonlyMap<string, WikidataEntityRef>,
  signal?: AbortSignal
): Promise<Set<string>> {
  const byPage = new Map<number, string>();
  for (const id of ids) {
    const ref = refs.get(id);
    if (ref?.label && ref.pageId !== null) byPage.set(ref.pageId, ref.id);
  }

  const pages = [...byPage.keys()];
  const humans = new Set<string>();
  for (let start = 0; start < pages.length; start += PERSON_BATCH) {
    const batch = pages.slice(start, start + PERSON_BATCH);
    const body = await request(
      {
        action: 'query',
        list: 'search',
        srsearch: `haswbstatement:${WikidataProperty.instanceOf}=${WikidataItem.human} pageid:${batch.join('|')}`,
        srnamespace: '0',
        srlimit: String(batch.length),
        srprop: '',
        srinfo: '',
      },
      signal
    );
    for (const hit of searchHits(body)) {
      const id = byPage.get(hit.pageid);
      if (id) humans.add(id);
    }
  }
  return humans;
}

function searchHits(body: Record<string, unknown>): { title: string; pageid: number }[] {
  const hits = isRecord(body.query) ? body.query.search : undefined;
  if (!Array.isArray(hits)) throw new WikidataError('malformed', 'No search results in the response.');
  return hits.filter(
    (hit): hit is { title: string; pageid: number } =>
      isRecord(hit) && typeof hit.title === 'string' && typeof hit.pageid === 'number'
  );
}

/**
 * One GET to the Action API, with its failures sorted into the kinds the
 * screen can say something useful about.
 *
 * The API reports its own errors with a `200` and an `error` object, so a
 * response is not a success until the body has been read.
 */
async function request(
  params: Record<string, string>,
  signal?: AbortSignal
): Promise<Record<string, unknown>> {
  const query = Object.entries({ ...params, format: 'json', origin: '*' })
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&');

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'Api-User-Agent': USER_AGENT,
  };
  if (Platform.OS !== 'web') headers['User-Agent'] = USER_AGENT;

  /* The query's own signal cancels the request when the screen goes away; the
     timer ends one that never answers. Chained by hand rather than through
     `AbortSignal.any`, which Hermes does not promise. */
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const cancel = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', cancel);

  let status: number;
  let text: string;
  try {
    const response = await fetch(`${ENDPOINT}?${query}`, { headers, signal: controller.signal });
    status = response.status;
    text = await response.text();
  } catch (error) {
    if (signal?.aborted) throw error;
    if (controller.signal.aborted) throw new WikidataError('timeout', 'Wikidata did not answer in time.');
    throw new WikidataError('network', 'Could not reach Wikidata.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', cancel);
  }

  if (status === 429) throw new WikidataError('rate-limited', 'Wikidata is rate limiting requests.');
  if (status < 200 || status >= 300) throw new WikidataError('unavailable', `Wikidata returned ${status}.`);

  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    throw new WikidataError('malformed', 'Wikidata returned something that is not JSON.');
  }
  if (!isRecord(body)) throw new WikidataError('malformed', 'Wikidata returned an unexpected shape.');

  if (isRecord(body.error)) {
    const code = typeof body.error.code === 'string' ? body.error.code : 'unknown';
    if (code === 'ratelimited' || code === 'maxlag') {
      throw new WikidataError('rate-limited', `Wikidata is busy (${code}).`);
    }
    throw new WikidataError('unavailable', `Wikidata refused the request (${code}).`);
  }
  return body;
}
