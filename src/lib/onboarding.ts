/**
 * Onboarding's rules — the owner's reference (2026-10-15), as data.
 *
 * Pure, so `npm test` holds it: who still has to be onboarded, what a handle
 * may be, how fast the words type themselves, which steps a phone is shown,
 * and what IGDB is asked for the games at the end. The screens are
 * `app/welcome.tsx` (signed out) and `app/onboarding.tsx` (signed in).
 */

/* -------------------------------------------------------------------------
 * Who is onboarded
 * ---------------------------------------------------------------------- */

/**
 * The name the database gives an account that signed up without one.
 *
 * `handle_new_user()` (0001) falls back to `user_` and the first twelve hex
 * digits of the account's id. Onboarding no longer asks for a handle at sign-up
 * — it is claimed near the end (`handle`) — so an account still wearing this
 * name has not finished, and needs no column of its own to say so. Every
 * account made before this flow has a real name and is left alone.
 */
const FALLBACK_USERNAME = /^user_[0-9a-f]{12}$/;

export function hasFallbackUsername(username: string | null | undefined): boolean {
  return typeof username === 'string' && FALLBACK_USERNAME.test(username);
}

/* -------------------------------------------------------------------------
 * Handles
 * ---------------------------------------------------------------------- */

/** Mirrors the CHECK on `profiles.username` in 0001. */
export const HANDLE_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
export const HANDLE_MAX = 24;

/** What was typed, as a handle: no "@", no spaces. */
export function normaliseHandle(raw: string): string {
  return raw.replace(/^@+/, '').replace(/\s+/g, '');
}

/** Why this is not a handle yet, in words — or null when it is one. */
export function handleProblem(handle: string): string | null {
  if (handle.length === 0) return null;
  if (/[^a-zA-Z0-9_]/.test(handle)) return 'letters, numbers and _ only';
  if (handle.length < 3) return 'at least 3 characters';
  if (handle.length > HANDLE_MAX) return `at most ${HANDLE_MAX} characters`;
  if (hasFallbackUsername(handle)) return 'pick one of your own';
  return null;
}

/** The shortest password Supabase accepts by default. */
export const MIN_PASSWORD_LENGTH = 6;

/* -------------------------------------------------------------------------
 * The typing
 * ---------------------------------------------------------------------- */

/* The clock lives in `lib/typing.ts` now — a review's quote types too — and
   is re-exported here so onboarding keeps reading it from its own rules. */
export { TYPE_MS, lettersShown, typingDuration } from './typing';

/* -------------------------------------------------------------------------
 * The pitch, signed out
 * ---------------------------------------------------------------------- */

/**
 * What GameLog says before it asks for anything — the owner chose the
 * reference's register, flirty, over a cheeky or a deadpan one.
 *
 * Four lines, and each says something true: the app keeps track of what you
 * play and what you thought of it. None promises a feature.
 */
export const INTRO_LINES: readonly string[] = [
  'hello gorgeous.',
  'nice thumbs. been gaming?',
  "you've played hundreds of games and remember how four of them end.",
  "let's keep track of every one. we won't tell anyone about the 400 hours.",
];

/* -------------------------------------------------------------------------
 * The steps, signed in
 * ---------------------------------------------------------------------- */

export type OnboardingStep =
  | 'name'
  | 'welcome'
  | 'here'
  | 'platforms'
  | 'genres'
  | 'company'
  | 'favourites'
  | 'colours'
  | 'animated'
  | 'notify'
  | 'steam'
  | 'photo'
  | 'handle'
  | 'picks';

const ALL_STEPS: readonly OnboardingStep[] = [
  'name',
  'welcome',
  'here',
  'platforms',
  'genres',
  'company',
  'favourites',
  'colours',
  'animated',
  'notify',
  'steam',
  'photo',
  'handle',
  'picks',
];

/**
 * The steps this phone is shown, in order.
 *
 * Two depend on the phone and the project, and a page that could only fail is
 * not shown at all:
 * - `notify` — where reminders cannot be scheduled (Expo Go on Android) there
 *   is nothing to give permission for.
 * - `steam` — linking works, but until the project has a Steam Web API key
 *   nothing would be imported, and "bring your library" would bring nothing.
 */
export function onboardingSteps(available: {
  notifications: boolean;
  steam: boolean;
}): OnboardingStep[] {
  return ALL_STEPS.filter((step) => {
    if (step === 'notify') return available.notifications;
    if (step === 'steam') return available.steam;
    return true;
  });
}

/* -------------------------------------------------------------------------
 * The answers
 * ---------------------------------------------------------------------- */

export type HereFor = 'logging' | 'reviewing' | 'discovering' | 'everything';

/**
 * "what are you here for?" — and the answer is used: it decides what the last
 * page's button does (`afterPicks`).
 */
export const HERE_FOR_OPTIONS: readonly { key: HereFor; label: string }[] = [
  { key: 'logging', label: 'logging what I play' },
  { key: 'reviewing', label: 'writing reviews' },
  { key: 'discovering', label: 'finding my next game' },
  { key: 'everything', label: 'all of it' },
];

/** Platform families, by the IGDB ids that make each one — verified live. */
export const PLATFORM_OPTIONS: readonly { key: string; label: string; ids: readonly number[] }[] = [
  { key: 'ps5', label: 'PS5', ids: [167] },
  { key: 'ps4', label: 'PS4', ids: [48] },
  { key: 'switch2', label: 'Switch 2', ids: [508] },
  { key: 'switch', label: 'Switch', ids: [130] },
  { key: 'xbox-series', label: 'Xbox Series', ids: [169] },
  { key: 'xbox-one', label: 'Xbox One', ids: [49] },
  { key: 'pc', label: 'PC', ids: [6] },
  { key: 'mac', label: 'Mac', ids: [14] },
  { key: 'phone', label: 'my phone', ids: [39, 34] },
];

export type Company = 'solo' | 'friends' | 'both';

/**
 * "solo, or with friends?" — IGDB game modes: 1 single player; 2 multiplayer,
 * 3 co-operative, 4 split screen, 5 MMO (verified live). "both" asks nothing.
 */
export const COMPANY_OPTIONS: readonly { key: Company; label: string; modes: readonly number[] }[] =
  [
    { key: 'solo', label: 'solo', modes: [1] },
    { key: 'friends', label: 'with friends', modes: [2, 3, 4, 5] },
    { key: 'both', label: 'both', modes: [] },
  ];

export type OnboardingAnswers = {
  hereFor: HereFor | null;
  platforms: readonly string[];
  genres: readonly number[];
  company: Company | null;
};

export const EMPTY_ANSWERS: OnboardingAnswers = {
  hereFor: null,
  platforms: [],
  genres: [],
  company: null,
};

/** How many favourites a profile shows, and so how many the step takes. */
export const FAVOURITE_LIMIT = 4;

/** How many games the last page offers. */
export const PICKS_COUNT = 6;

/**
 * What every game the flow shows must be: a game (not an edition of one), with
 * a box, and rated by enough people to be a real release.
 */
const SHOWABLE = 'version_parent = null & cover != null & game_type = (0,8,9)';

/**
 * The favourites step's grid, before anything is typed: the most-rated games
 * there are. A favourite is more often famous than not, and the grid is a
 * shortcut, not a recommendation — search is under it.
 */
export function pickingGridClause(): string {
  return `${SHOWABLE} & total_rating_count > 400`;
}

/* -------------------------------------------------------------------------
 * How the app looks — two questions, with examples
 * ---------------------------------------------------------------------- */

/**
 * The games a new account is shown its two choices on — the owner's
 * (2026-10-21): "show examples of the game page and ask if they want the
 * expressive material color or no color, with a button to switch on/off in
 * real time. Same with animated artwork, show an example of 2-3 games that
 * are in SteamGridDB, preferably most known games, and show it as a Surprise
 * Me screen example."
 *
 * Colours: three of the best-known games there are, chosen for three covers
 * of three different colours — Hollow Knight's blue, Hades' red, Elden Ring's
 * gold — so the switch visibly changes something on each.
 *
 * Animation: three as well known whose animated covers on SteamGridDB are
 * full size and light, so a first run does not spend much data (checked live,
 * 2026-10-21, by the app's own rule): Hollow Knight's square (1.0 MB), Portal
 * 2's portrait (1.3 MB) and Cyberpunk 2077's (3.8 MB). Only the one in view
 * loads. IGDB ids, in the order shown.
 */
export const COLOUR_EXAMPLES: readonly number[] = [14593, 113112, 119133];
export const ANIMATED_EXAMPLES: readonly number[] = [14593, 72, 1877];

/** The `where` that fetches example games by IGDB id. */
export function examplesClause(ids: readonly number[]): string {
  return `id = (${ids.join(',')})`;
}

/** Put fetched games back in the order asked for; IGDB sorts as it likes. */
export function inExampleOrder<T extends { sourceId: string }>(
  ids: readonly number[],
  games: readonly T[]
): T[] {
  return ids.flatMap((id) => games.filter((game) => game.sourceId === String(id)));
}

/**
 * The `where` for the last page's games, from the answers.
 *
 * Every filter is "any of" (`(a,b)`, never `{a,b}`): ticking more boxes must
 * widen, the rule `getSurprisePool` learned. `exclude` is everything already
 * chosen or shown, so a favourite is never offered back. `similarTo`, when
 * given, narrows to those ids — the first pass, from the favourites.
 */
export function picksClause(
  answers: OnboardingAnswers,
  exclude: readonly number[],
  similarTo?: readonly number[]
): string {
  const parts = [SHOWABLE, 'total_rating_count > 40'];

  const platformIds = PLATFORM_OPTIONS.filter((option) =>
    answers.platforms.includes(option.key)
  ).flatMap((option) => option.ids);
  if (platformIds.length > 0) parts.push(`platforms = (${platformIds.join(',')})`);

  if (answers.genres.length > 0) parts.push(`genres = (${answers.genres.join(',')})`);

  const modes = COMPANY_OPTIONS.find((option) => option.key === answers.company)?.modes ?? [];
  if (modes.length > 0) parts.push(`game_modes = (${modes.join(',')})`);

  if (similarTo && similarTo.length > 0) parts.push(`id = (${similarTo.join(',')})`);
  if (exclude.length > 0) parts.push(`id != (${exclude.join(',')})`);

  return parts.join(' & ');
}

/**
 * Round-robin over several lists of ids, skipping `exclude` and repeats.
 *
 * Each favourite's similar games are a list; taking them in turn means the
 * first screenful spans all four favourites rather than being six games like
 * the first one (the reasoning `recommendFromLogs` gives).
 */
export function interleave(
  lists: readonly (readonly number[])[],
  exclude: ReadonlySet<number>,
  limit: number
): number[] {
  const out: number[] = [];
  const taken = new Set<number>();
  for (let rank = 0; out.length < limit; rank += 1) {
    let any = false;
    for (const list of lists) {
      const id = list[rank];
      if (id === undefined) continue;
      any = true;
      if (exclude.has(id) || taken.has(id)) continue;
      taken.add(id);
      out.push(id);
      if (out.length >= limit) break;
    }
    if (!any) break;
  }
  return out;
}

/** Where the last page's button goes, by what they said they were here for. */
export function afterPicks(hereFor: HereFor | null): 'home' | 'search' | 'review' {
  if (hereFor === 'reviewing') return 'review';
  if (hereFor === 'discovering') return 'search';
  return 'home';
}
