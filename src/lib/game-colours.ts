import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether the screens about one game wear that game's colours — the owner's
 * switch (2026-10-20): "Add a setting to turn off the material expressive
 * colors in the app. Adapt the app to non-material colors."
 *
 * On, a game's page, its log form, its review, its achievements, its
 * soundtrack, a copy of it, a genre and Surprise Me are each built from a
 * Material 3 scheme seeded by the box art (`<AccentProvider>`). Off, every one
 * of them is the app's own room — the neutral page, `surface` cards, the
 * house white — exactly as every other screen is. Settings → Game colours.
 *
 * Kept on the device, per account, as the review page's own switch and the
 * trailers' are: it is how somebody likes to look at the app, not something
 * anybody else sees. On by default — the game's colours are how those screens
 * were designed — so only "off" is stored.
 */

const PREFIX = 'gamelog:game-colours';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account turned game colours off. */
export async function loadGameColours(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'off';
  } catch {
    return true;
  }
}

export async function saveGameColours(userId: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'off');
  } catch {
    /* Ignored — worst case the next game's page opens in its colours. */
  }
}
