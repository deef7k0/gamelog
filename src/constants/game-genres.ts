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
