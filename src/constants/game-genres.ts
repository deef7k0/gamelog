import type Ionicons from '@expo/vector-icons/Ionicons';

/**
 * The genres Search offers as a front door to the catalogue.
 *
 * ## Why a curated ten and not IGDB's whole vocabulary
 *
 * `getGenres()` returns twenty-three, unordered, and two of them — Indie and
 * Adventure — sit on roughly half the catalogue and describe almost nothing
 * about a game. A grid of twenty-three is a wall of near-synonyms, and it is
 * also a picker rather than an invitation: the point of this surface is to give
 * someone with no particular game in mind ten obvious doors, not to reproduce a
 * taxonomy.
 *
 * Ten is also exactly the size of the identity ramp, which is the second reason
 * for the number — see below.
 *
 * ## The colour is not decoration, and it is not chosen here
 *
 * Each tile takes its hue from `identityColorFor([genre])`, the *same* function
 * that decides what colour a game's own page lights up with. So the Shooter tile
 * is ember because Shooters are ember everywhere in this app, and tapping it
 * opens a page that is still ember. The grid is a legend for a colour system the
 * reader will keep meeting, rather than ten arbitrary swatches.
 *
 * That is also why the ten entries are chosen one per hue: `identity.ts`
 * deliberately gives families a shared colour (every strategy subgenre is
 * cobalt), so picking two members of one family would put two identical tiles in
 * the grid and waste a door.
 *
 * ## `match`, not an id
 *
 * IGDB's numeric genre ids are stable but opaque, and hard-coding them here
 * would put a second copy of IGDB's vocabulary in the repo to drift against the
 * first. The id is resolved at runtime from `getGenres()` by matching this
 * substring against the live name, the way `platform-cases.ts` matches platform
 * names — IGDB writes "Role-playing (RPG)" and "Card & Board Game", and a
 * substring is what survives that punctuation.
 *
 * A genre IGDB stops returning simply drops out of the grid rather than
 * rendering a tile that leads nowhere.
 */
export type GameGenre = {
  /** Lowercased substring matched against IGDB's own genre name. */
  match: string;
  /** What the tile says. Shorter than IGDB's name where IGDB is verbose. */
  label: string;
  /**
   * The glyph.
   *
   * Drawn from Ionicons like every other icon in the app — never an emoji, which
   * would render as a different picture on every platform and at a weight that
   * matches nothing else on the screen.
   */
  icon: keyof typeof Ionicons.glyphMap;
  /**
   * What `identityColorFor` is asked about.
   *
   * Usually the same as `match`, but it exists separately because the two
   * questions differ: `match` has to find IGDB's row, and this has to hit the
   * right entry in the identity ramp.
   */
  identity: string;
};

/**
 * Ten doors, ordered so no two neighbours share a hue.
 *
 * Reading order matters on a two-column grid: the eye compares horizontally
 * first and vertically second, so two tiles of the same colour side by side or
 * one above the other read as a mistake even when the colours are correct.
 */
export const GAME_GENRES: readonly GameGenre[] = [
  { match: 'shooter', label: 'Shooter', icon: 'flame', identity: 'shooter' },
  { match: 'role-playing', label: 'Role-playing', icon: 'shield', identity: 'role-playing' },
  { match: 'adventure', label: 'Adventure', icon: 'compass', identity: 'adventure' },
  { match: 'strategy', label: 'Strategy', icon: 'git-network', identity: 'strategy' },
  { match: 'puzzle', label: 'Puzzle', icon: 'extension-puzzle', identity: 'puzzle' },
  { match: 'racing', label: 'Racing', icon: 'car-sport', identity: 'racing' },
  { match: 'sport', label: 'Sport', icon: 'football', identity: 'sport' },
  { match: 'simulator', label: 'Simulation', icon: 'construct', identity: 'simulator' },
  { match: 'fighting', label: 'Fighting', icon: 'hand-left', identity: 'fighting' },
  { match: 'arcade', label: 'Arcade', icon: 'game-controller', identity: 'arcade' },
];

/**
 * All twenty-three genres, ordered by what a player reaches for.
 *
 * ## Why this exists next to the curated ten
 *
 * `GAME_GENRES` above answers "which doors does Search offer" and deliberately
 * shows ten. This answers a different question: when **every** genre has to be on
 * screen — Surprise Me's filter, which is a discovery tool where the long tail is
 * the point — in what order should they be?
 *
 * `getGenres()` returns `sort name asc`, so today the answer is "by spelling".
 * That buries Shooter, Strategy and Role-playing in the middle of six wrapped
 * rows behind Adventure, Arcade and Card & Board Game, and leaves somebody
 * reading all twenty-three to find the one they wanted. `getPlatforms()` in
 * `lib/games/igdb.ts` already solved the same problem the same way — it sorts by
 * generation "so the console someone is likely to mean is near the top" — and
 * this is that argument applied to the other fetched vocabulary.
 *
 * **Nothing is removed.** Every genre IGDB publishes still renders; this changes
 * only which ones are reached first.
 *
 * ## Two deliberate demotions
 *
 * `indie` and `quiz` sit near the bottom, and `indie` is the interesting one. The
 * note on `GAME_GENRES` above already records why: it sits on roughly half the
 * catalogue and describes almost nothing about a game. For a *filter* that is
 * worse than merely vague — ticking it barely narrows the pool, so it costs a
 * row near the top and returns nearly the whole catalogue. Adventure carries the
 * same breadth problem and is **not** demoted, because unlike Indie it is a word
 * players actually use to describe what they feel like playing. The asymmetry is
 * intentional.
 *
 * ## Longest match wins, so this list's order is free
 *
 * Matching takes the **longest** substring that fits, not the first. That is what
 * lets `'strategy'` sit at position 4 while `'real time strategy'` sits at 13
 * without the generic entry swallowing the specific one — the ordering trap
 * `platform-cases.ts` warns about, where a wrong order is silent because every
 * entry is individually valid. Order this list by reach and nothing else; the
 * matcher does not care.
 */
export const GENRE_REACH_ORDER: readonly string[] = [
  'shooter',
  'role-playing',
  'adventure',
  'strategy',
  'platform',
  'simulator',
  'racing',
  'sport',
  'fighting',
  'puzzle',
  'hack and slash',
  'arcade',
  'real time strategy',
  'turn-based strategy',
  'tactical',
  'point-and-click',
  'music',
  'visual novel',
  'card',
  'moba',
  'indie',
  'quiz',
  'pinball',
];

/**
 * Order IGDB's genres by reach, with anything unrecognised kept and alphabetical.
 *
 * Generic over `{ name: string }` rather than typed to `IgdbTag` so this file
 * stays dependency-free — `constants/` does not import from `lib/`.
 *
 * A genre IGDB adds later is **kept**, not dropped: it falls to the end of the
 * list in alphabetical order alongside anything else unmatched. Silently losing a
 * filter option because a constant went stale is the failure mode this guards
 * against, and it is the same call `surprise-prefs.ts` makes when it validates
 * stored genre ids for shape rather than against the live vocabulary.
 */
export function sortGenresByReach<T extends { name: string }>(genres: readonly T[]): T[] {
  const rank = (name: string) => {
    const lower = name.toLowerCase();
    let best = -1;
    let bestLength = 0;
    GENRE_REACH_ORDER.forEach((match, index) => {
      if (lower.includes(match) && match.length > bestLength) {
        best = index;
        bestLength = match.length;
      }
    });
    return best === -1 ? GENRE_REACH_ORDER.length : best;
  };

  return [...genres].sort((a, b) => {
    const difference = rank(a.name) - rank(b.name);
    return difference !== 0 ? difference : a.name.localeCompare(b.name);
  });
}
