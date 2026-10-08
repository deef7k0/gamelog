/**
 * The mini player's measurements.
 *
 * Fixed dp, as the tab bar's are: it is the same object on every screen. In a
 * file of its own because three things need them and none may import another —
 * the bar itself, the tab bar's clearance and `<Screen>`'s bottom padding.
 */

/** The capsule's height. */
export const MINI_PLAYER_HEIGHT = 56;
/** The space under it, and — where a page makes room for it — over it. */
export const MINI_PLAYER_GAP = 8;
/** Its margin from the sides of the display: the tab bar's. */
export const MINI_PLAYER_SIDE = 16;
/** A wide display never stretches it into a rail. */
export const MINI_PLAYER_MAX_WIDTH = 520;
/** How much a tab's scroll content grows to end above it. */
export const MINI_PLAYER_FOOTPRINT = MINI_PLAYER_HEIGHT + MINI_PLAYER_GAP;
/** How much of a stack screen's foot it takes: a gap, the capsule, a gap. */
export const MINI_PLAYER_BAND = MINI_PLAYER_GAP + MINI_PLAYER_HEIGHT + MINI_PLAYER_GAP;
/** How long it takes to move between its place over the tabs and its place on a page. */
export const MINI_PLAYER_MOVE_MS = 240;
