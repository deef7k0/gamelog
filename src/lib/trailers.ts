import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether artwork plays its game's trailer — the owner's switch (2026-10-17),
 * the disc at the top right of the game page and the studio page, where
 * SimpMusic's artist page keeps its video ⇄ picture toggle. One switch for
 * both pages: turning it off on one turns it off on the other.
 *
 * SimpMusic's resets with every artist; this is kept, on the device and per
 * account, as the review page's colour switch is: somebody who turns the
 * video off — for their data, for their battery, because it moves — means
 * every page. On by default, as SimpMusic's is, so only "off" is stored.
 */

const PREFIX = 'gamelog:trailers';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account turned the trailers off. */
export async function loadTrailers(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'off';
  } catch {
    return true;
  }
}

export async function saveTrailers(userId: string, on: boolean): Promise<void> {
  try {
    if (on) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'off');
  } catch {
    /* Ignored — worst case the next page plays its trailer. */
  }
}
