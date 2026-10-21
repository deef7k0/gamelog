import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Whether a review's page wears its game's colours — the owner's switch
 * (2026-10-16): "This button activates/deactivates the colorized material 3
 * theme on the screen… This setting should be saved globally for the user. If
 * they turn it off on one review, it stays for the next review they open."
 *
 * Kept on the device, per account, as the reading languages are: it is how
 * somebody likes to read, not something anybody else sees. On by default — the
 * game's colours are how the page was designed — so only "off" is stored.
 */

const PREFIX = 'gamelog:review-colour';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** True unless this account turned the colours off. */
export async function loadReviewColour(userId: string): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(keyFor(userId))) !== 'off';
  } catch {
    return true;
  }
}

export async function saveReviewColour(userId: string, colourful: boolean): Promise<void> {
  try {
    if (colourful) await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), 'off');
  } catch {
    /* Ignored — worst case the next review opens in colour. */
  }
}
