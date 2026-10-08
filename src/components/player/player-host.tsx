import { useAudioPlayer } from 'expo-audio';
import { useEffect } from 'react';

import { useAuth } from '@/store/auth';
import { attachAudio, player } from '@/store/player';

/** How often the audio object reports where it is, in milliseconds. */
const REPORT_MS = 250;

/**
 * The app's one audio object, mounted once in the root layout.
 *
 * It draws nothing. It exists so the native player has a React lifetime —
 * `useAudioPlayer` creates it and releases it — while everything that decides
 * what plays lives in `store/player.ts`, which this hands the object to.
 *
 * It is the only `useAudioPlayer` in the app, and a second one is a second
 * song. The soundtrack screen, Surprise Me and a profile's starred song each
 * had their own; two could play at once and none could outlive its screen.
 */
export function PlayerHost() {
  const audio = useAudioPlayer(null, { updateInterval: REPORT_MS });

  useEffect(() => attachAudio(audio), [audio]);

  /*
   * Whoever was listening is not whoever is here now. The queue holds
   * SoundCloud's own words about each track, in memory; a change of account
   * lets all of it go, as it does the query cache.
   */
  const userId = useAuth((state) => state.session?.user.id ?? null);
  useEffect(() => () => player.stop(), [userId]);

  return null;
}
