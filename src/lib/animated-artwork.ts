import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether covers move by themselves where a game has an animated one — the
 * owner's onboarding question (2026-10-21): "show an example of 2-3 games that
 * are in SteamGridDB… and show it as a Surprise Me screen example", with a
 * switch that turns it on and off in real time. Settings → Animated artwork.
 *
 * On, Surprise Me's card and a review's hero play the game's animated cover
 * once it is found (`useAnimatedCover`). Off, both stay still and nothing is
 * looked up or downloaded for them. The game page's cover viewer is not
 * governed by it: its Animated button is somebody asking for one game's
 * animation by hand.
 *
 * Kept on the device, per account, as Game colours is (`lib/game-colours.ts`):
 * how somebody likes the app to look, which nobody else sees. On by default,
 * so only "off" is stored.
 */

const PREFIX = 'gamelog:animated-artwork';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account turned animated artwork off. */
export async function loadAnimatedArtwork(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'off';
  } catch {
    return true;
  }
}

export async function saveAnimatedArtwork(userId: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'off');
  } catch {
    /* Ignored — worst case the next cover moves once more. */
  }
}
