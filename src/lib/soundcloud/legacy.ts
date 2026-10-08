import AsyncStorage from '@react-native-async-storage/async-storage';

/** Every key the Apple Music version's device cache wrote: one per game. */
const OLD_PREFIX = 'gamelog:soundtrack:v1';
/** Set once the sweep has run, so a launch after the first reads one key and stops. */
const DONE_KEY = 'gamelog:soundtrack:swept:v1';

/**
 * Delete the soundtracks earlier versions kept on the device.
 *
 * The Apple Music version mirrored every looked-up soundtrack into
 * AsyncStorage — titles, artists, artwork and preview addresses, a row per
 * game — so a cold start did not need the network. Soundtracks come from
 * SoundCloud now, whose API terms forbid storing any of that, and nothing
 * reads those rows any more. They are also dead weight in a database that is
 * 6 MB in all and shared with the saved query cache.
 *
 * Runs once per install. Quiet in every direction: storage that cannot be
 * read or written is left as it is, and the next launch tries again.
 */
export async function forgetAppleMusicCache(): Promise<void> {
  try {
    if ((await AsyncStorage.getItem(DONE_KEY)) === '1') return;

    const keys = await AsyncStorage.getAllKeys();
    const old = keys.filter((key) => key.startsWith(`${OLD_PREFIX}:`));
    if (old.length > 0) await AsyncStorage.multiRemove(old);

    await AsyncStorage.setItem(DONE_KEY, '1');
  } catch {
    /* Nothing depends on this having happened. */
  }
}
