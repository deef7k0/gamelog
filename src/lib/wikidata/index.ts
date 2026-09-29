/**
 * Wikidata, for the additional-information screen: awards, nominations, cast,
 * budget and the people who made a game. See `client.ts` for the requests and
 * `normalize.ts` for what is read from them.
 */
export {
  getWikidataGameInfo,
  resolveWikidataLabels,
  WikidataError,
  type WikidataErrorKind,
} from './client';
export { wikidataLookupFor, type WikidataLookup } from './lookup';
export { hasGameInfo } from './normalize';
export type {
  WikidataAward,
  WikidataBudget,
  WikidataCastMember,
  WikidataCredit,
  WikidataGameInfo,
  WikidataPerson,
} from './types';
