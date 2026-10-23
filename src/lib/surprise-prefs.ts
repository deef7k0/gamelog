import AsyncStorage from '@react-native-async-storage/async-storage';

import { validPerspectiveIds } from '../constants/player-perspectives';
import {
  GAME_MODES as MODE_VALUES,
  LANGUAGES,
  PLATFORM_GROUPS,
  THEMES,
  type MatchMode,
  type PlatformGroupKey,
} from './games/facets';
import type { SurprisePool, SurprisePoolFilters } from './games/igdb';
import type { TrackPickMode } from './soundtrack-pick';

/**
 * How somebody likes their surprises, on the device.
 *
 * ## Why AsyncStorage and not a table
 *
 * There is no user-settings system in this app, and that is deliberate rather
 * than missing: `app/settings.tsx` is an empty screen with a docblock explaining
 * why it would rather be honestly blank than list four inert rows, `store/` holds
 * only auth, and `profiles` has no preference columns. Adding a `user_settings`
 * table for three enums would be inventing that system on the way past.
 *
 * What does exist is a four-file convention for exactly this — `search-history`,
 * `log-draft`, `artwork-color`, `use-steam-artwork` — and these belong to it.
 * They are per-device view state of the same class as a search history: nothing
 * here is worth syncing, and nothing here is lost in a way that matters.
 *
 * Keyed by user id, the rule `search-history.ts` and `log-draft.ts` both follow,
 * so two accounts sharing a handset do not inherit each other's settings.
 */

const PREFIX = 'gamelog:surprise-prefs';

/**
 * The fourth game mode. Not a `SurprisePool` — it does not query the catalogue
 * at all, it re-reads the viewer's own logs through `recommendFromLogs`.
 */
export type SurpriseGameMode = SurprisePool | 'foryou';

/**
 * The rating floors the picker offers.
 *
 * Four steps, not a slider. A slider implies the difference between 71 and 73
 * means something, and IGDB's aggregate is a mean of however many outlets and
 * users happened to score a game — it does not. These are the four claims a
 * person actually wants to make: no opinion, decent, good, and the short list.
 *
 * 0 is "Any" and is stored as 0 rather than null so the picker has one type to
 * compare against; `getSurprisePool` treats it as no clause at all, which
 * matters — see the note there on why `>= 0` is not harmless.
 */
export const RATING_FLOORS = [0, 70, 80, 90] as const;
export type RatingFloor = (typeof RATING_FLOORS)[number];

/**
 * When it came out, as the eras a person reaches for rather than two year
 * pickers: "something from the 90s" is the request, not "1990 to 1999".
 * `recent` is the last two calendar years and this one.
 */
export const RELEASE_ERAS = ['any', 'recent', '2020s', '2010s', '2000s', '1990s', 'retro'] as const;
export type ReleaseEra = (typeof RELEASE_ERAS)[number];

/** An era's years, inclusive at both ends — null for no bound. */
export function eraYears(
  era: ReleaseEra,
  thisYear: number
): { fromYear: number | null; toYear: number | null } {
  switch (era) {
    case 'recent':
      return { fromYear: thisYear - 2, toYear: null };
    case '2020s':
      return { fromYear: 2020, toYear: 2029 };
    case '2010s':
      return { fromYear: 2010, toYear: 2019 };
    case '2000s':
      return { fromYear: 2000, toYear: 2009 };
    case '1990s':
      return { fromYear: 1990, toYear: 1999 };
    case 'retro':
      return { fromYear: null, toYear: 1989 };
    default:
      return { fromYear: null, toYear: null };
  }
}

export type SurprisePrefs = {
  gameMode: SurpriseGameMode;
  trackMode: TrackPickMode;
  /**
   * Skip games already marked played or dropped.
   *
   * On by default: the feature answers "what should I play", and a game you have
   * finished is not an answer to that. Note it is played *and dropped*, not
   * every game with a log — `backlog` and `playing` stay eligible on purpose,
   * because "that one you own and never started" is a good surprise.
   */
  excludePlayed: boolean;
  /**
   * IGDB genre ids, or empty for every genre. Matched as "any of" — see
   * `SurprisePoolFilters.genreIds`.
   *
   * Ids rather than names, because a name is not a query: IGDB filters on the id
   * and the label is a render-time lookup. It also means a genre IGDB renames
   * keeps working, and a stored id that stops existing narrows a pool to nothing
   * rather than matching the wrong one.
   */
  genreIds: number[];
  /** IGDB player-perspective ids, same rules. See `constants/player-perspectives.ts`. */
  perspectiveIds: number[];
  /** A floor on IGDB's own aggregate score. 0 is "any". */
  minRating: RatingFloor;
  /*
   * The rest of what a game's details card can send you to Search with
   * (`lib/games/facets.ts`), as filters on a roll — the owner's "add these
   * features for the Surprise Me page" (2026-10-16). Each is "any of", as
   * genres are, and empty means no narrowing.
   */
  /** IGDB theme ids (`THEMES`). */
  themeIds: number[];
  /** IGDB game-mode ids (`GAME_MODES` in facets). */
  modeIds: number[];
  /** Platform families (`PLATFORM_GROUPS`), not machines. */
  platforms: PlatformGroupKey[];
  /** IGDB language ids (`LANGUAGES`): games with any support in one of them. */
  languageIds: number[];
  /**
   * RAWG tag ids (2026-10-22): a roll drawn from RAWG's games with them, as
   * IGDB's games, narrowed by everything else here (`getTagSurprisePool`).
   * Ids, as genres are; the names are RAWG's vocabulary, read at render.
   */
  tagIds: number[];
  /** When it came out. */
  era: ReleaseEra;
  /**
   * How the picks combine — the owner's selection mode (2026-10-16). `any`:
   * a game with at least one of your picks in each list, as it always was.
   * `all`, "Combined": a game with every pick, so RPG + Comedy is a game that
   * is both.
   */
  match: MatchMode;
};

export const DEFAULT_SURPRISE_PREFS: SurprisePrefs = {
  gameMode: 'random',
  trackMode: 'popular',
  excludePlayed: true,
  genreIds: [],
  perspectiveIds: [],
  minRating: 0,
  themeIds: [],
  modeIds: [],
  platforms: [],
  languageIds: [],
  tagIds: [],
  era: 'any',
  match: 'any',
};

/**
 * The subset a catalogue query actually reads.
 *
 * Narrowing here rather than passing the whole prefs object down is what keeps
 * `lib/games/` from knowing that a soundtrack mode exists.
 */
export function poolFiltersFor(
  prefs: SurprisePrefs,
  thisYear = new Date().getFullYear()
): SurprisePoolFilters {
  return {
    genreIds: prefs.genreIds,
    perspectiveIds: prefs.perspectiveIds,
    minRating: prefs.minRating,
    themeIds: prefs.themeIds,
    modeIds: prefs.modeIds,
    platformGroups: PLATFORM_GROUPS.filter((group) => prefs.platforms.includes(group.key)).map(
      (group) => group.ids
    ),
    match: prefs.match,
    languageIds: prefs.languageIds,
    tagIds: prefs.tagIds,
    ...eraYears(prefs.era, thisYear),
  };
}

/** Whether anything is narrowing the pool. Drives the "Clear" control and the count. */
export function activeFilterCount(prefs: SurprisePrefs): number {
  return (
    prefs.genreIds.length +
    prefs.perspectiveIds.length +
    prefs.themeIds.length +
    prefs.modeIds.length +
    prefs.platforms.length +
    prefs.languageIds.length +
    prefs.tagIds.length +
    (prefs.minRating > 0 ? 1 : 0) +
    (prefs.era !== 'any' ? 1 : 0)
  );
}

/** The prefs with every narrowing taken off; the pool, the song and the exclusion kept. */
export function withoutFilters(prefs: SurprisePrefs): SurprisePrefs {
  return {
    ...prefs,
    genreIds: [],
    perspectiveIds: [],
    minRating: 0,
    themeIds: [],
    modeIds: [],
    platforms: [],
    languageIds: [],
    tagIds: [],
    era: 'any',
  };
}

/**
 * One string for everything that changes which games a roll is drawn from —
 * what a batch's query key and "did that change anything" compare, so a new
 * filter is added here once rather than in three lists.
 */
export function poolKey(prefs: SurprisePrefs): string {
  return JSON.stringify([
    prefs.gameMode,
    prefs.excludePlayed,
    prefs.genreIds,
    prefs.perspectiveIds,
    prefs.minRating,
    prefs.themeIds,
    prefs.modeIds,
    prefs.platforms,
    prefs.languageIds,
    prefs.tagIds,
    prefs.era,
    prefs.match,
  ]);
}

const GAME_MODES: readonly SurpriseGameMode[] = ['random', 'popular', 'hidden', 'foryou'];
const TRACK_MODES: readonly TrackPickMode[] = ['popular', 'random', 'surprise'];

/**
 * Genre ids are validated for *shape* only, not against IGDB's list.
 *
 * The vocabulary is fetched at runtime and may not be in hand when the prefs are
 * read — gating on it would mean a slow genres request silently wiped somebody's
 * saved filter. A number that is not a genre narrows the pool to nothing, which
 * is visible and recoverable; a filter that erases itself on a cold start is
 * neither. Perspectives are the opposite case and *are* checked against the
 * table, because that table is a local literal and always available.
 */
function validIds(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (id): id is number => typeof id === 'number' && Number.isInteger(id) && id > 0
  );
}

/** Ids that are in a fixed vocabulary — anything else is dropped. */
function knownIds(value: unknown, known: readonly { id: number }[]): number[] {
  return validIds(value).filter((id) => known.some((entry) => entry.id === id));
}

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/**
 * Read the stored preferences, falling back to the defaults.
 *
 * Each field is validated separately rather than trusting the parse. These are
 * closed vocabularies that feed straight into an IGDB `where` clause and a
 * switch, and a value written by an older build — or a mode that gets renamed
 * later — should degrade to the default rather than produce a query nobody
 * wrote.
 */
export async function loadSurprisePrefs(userId: string): Promise<SurprisePrefs> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return DEFAULT_SURPRISE_PREFS;

    const parsed = JSON.parse(raw) as Partial<SurprisePrefs>;
    return {
      gameMode: GAME_MODES.includes(parsed?.gameMode as SurpriseGameMode)
        ? (parsed.gameMode as SurpriseGameMode)
        : DEFAULT_SURPRISE_PREFS.gameMode,
      trackMode: TRACK_MODES.includes(parsed?.trackMode as TrackPickMode)
        ? (parsed.trackMode as TrackPickMode)
        : DEFAULT_SURPRISE_PREFS.trackMode,
      excludePlayed:
        typeof parsed?.excludePlayed === 'boolean'
          ? parsed.excludePlayed
          : DEFAULT_SURPRISE_PREFS.excludePlayed,
      genreIds: validIds(parsed?.genreIds),
      perspectiveIds: validPerspectiveIds(validIds(parsed?.perspectiveIds)),
      minRating: RATING_FLOORS.includes(parsed?.minRating as RatingFloor)
        ? (parsed.minRating as RatingFloor)
        : DEFAULT_SURPRISE_PREFS.minRating,
      /* Absent from anything saved before these existed: no narrowing. */
      themeIds: knownIds(parsed?.themeIds, THEMES),
      modeIds: knownIds(parsed?.modeIds, MODE_VALUES),
      platforms: Array.isArray(parsed?.platforms)
        ? PLATFORM_GROUPS.map((group) => group.key).filter((key) =>
            (parsed.platforms as unknown[]).includes(key)
          )
        : [],
      languageIds: knownIds(parsed?.languageIds, LANGUAGES),
      /* RAWG's vocabulary is fetched, so only the shape is checked, as genres. */
      tagIds: validIds(parsed?.tagIds),
      era: RELEASE_ERAS.includes(parsed?.era as ReleaseEra)
        ? (parsed.era as ReleaseEra)
        : DEFAULT_SURPRISE_PREFS.era,
      match: parsed?.match === 'all' ? 'all' : 'any',
    };
  } catch {
    return DEFAULT_SURPRISE_PREFS;
  }
}

export async function saveSurprisePrefs(userId: string, prefs: SurprisePrefs): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(prefs));
  } catch {
    /* Ignored — worst case the next session opens on the defaults. */
  }
}
