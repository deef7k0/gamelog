/**
 * IGDB's player perspectives, as a fixed table.
 *
 * ## Why this is a literal and not a fetch
 *
 * `player_perspectives` is **not on the Edge Function's allowlist**, and adding
 * an endpoint there does nothing until the function is redeployed — so a picker
 * that fetched its own vocabulary would render empty for every user on the
 * currently deployed build, with no error and nothing to fix client-side. The
 * ids themselves need no allowlist: they are filtered inside a `where` clause on
 * `games`, which is allowed and is what every other filter in this app already
 * uses.
 *
 * That is affordable here and would not be for genres or platforms. This list
 * has seven entries and has not changed in the lifetime of the v4 API; IGDB adds
 * a platform every couple of years and a genre occasionally, which is why those
 * two are fetched.
 *
 * ## Why five of the seven are offered
 *
 * `Text` and `Auditory` are perspectives in IGDB's schema and not in a player's
 * head — a text adventure is a *genre* to the person choosing, and picking
 * "Auditory" as a way to find something to play tonight returns a few dozen
 * audio games in total. They stay in the table because the id map should be the
 * real one; `SELECTABLE_PERSPECTIVES` is what the picker shows.
 *
 * Verified against the live API: ids 1–7, in this order.
 */
export type PlayerPerspective = {
  id: number;
  /** IGDB's own name, kept so the two can be checked against each other. */
  name: string;
  /** What the picker prints. Shorter, and in the words a player would use. */
  label: string;
};

export const PLAYER_PERSPECTIVES: readonly PlayerPerspective[] = [
  { id: 1, name: 'First person', label: 'First person' },
  { id: 2, name: 'Third person', label: 'Third person' },
  /* IGDB calls this "Bird view / Isometric" — one id covering both top-down and
     isometric, which is why the label names the pair rather than picking one. */
  { id: 3, name: 'Bird view / Isometric', label: 'Top-down / isometric' },
  { id: 4, name: 'Side view', label: 'Side view' },
  { id: 5, name: 'Text', label: 'Text' },
  { id: 6, name: 'Auditory', label: 'Auditory' },
  { id: 7, name: 'Virtual Reality', label: 'VR' },
] as const;

/** The five worth putting in a picker. See the note above. */
export const SELECTABLE_PERSPECTIVES: readonly PlayerPerspective[] = PLAYER_PERSPECTIVES.filter(
  (perspective) => perspective.id !== 5 && perspective.id !== 6
);

const BY_ID = new Map(PLAYER_PERSPECTIVES.map((entry) => [entry.id, entry]));

/** Drops ids that are not perspectives, so a stale stored value cannot reach a query. */
export function validPerspectiveIds(ids: readonly unknown[]): number[] {
  return ids.filter((id): id is number => typeof id === 'number' && BY_ID.has(id));
}
