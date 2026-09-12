import AsyncStorage from '@react-native-async-storage/async-storage';

import type { GameSoundtrack } from './soundtracks';

/**
 * A soundtrack lookup, mirrored on the device.
 *
 * The authoritative cache is the `game_soundtracks` table — it is shared, so one
 * person's lookup spares everyone else's. This is the rung below it, and it buys
 * exactly one thing: a game you have already rolled still has its music on a
 * cold start with no network, or when Supabase is having a bad minute.
 *
 * Not keyed by user, unlike `search-history.ts` and `log-draft.ts`. Those hold a
 * record of what somebody did; this holds a fact about an album, which is the
 * same fact for whoever is signed in. Sharing it between two accounts on one
 * handset leaks nothing.
 *
 * Every function degrades to a miss and none of them throw. A cache that cannot
 * be read is a slower roll, never a failed one.
 */

const PREFIX = 'gamelog:soundtrack:v1';

/**
 * How long a mirrored entry stands.
 *
 * Shorter than the server's rules deliberately: this copy exists for offline
 * continuity, not for correctness, and letting it age out sends the next roll
 * back to the shared table where the real answer lives.
 */
const TTL_MS = 30 * 24 * 60 * 60_000;

type Entry = {
  /** Null records "looked, nothing there", the same distinction the table draws. */
  soundtrack: GameSoundtrack | null;
  at: number;
};

function keyFor(gameId: string) {
  return `${PREFIX}:${gameId}`;
}

/**
 * Read the mirror.
 *
 * `undefined` is a miss; `null` is a cached "no soundtrack for this game".
 * Collapsing the two would defeat the point — see `lib/api/soundtracks.ts`.
 */
export async function readLocalSoundtrack(
  gameId: string
): Promise<GameSoundtrack | null | undefined> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(gameId));
    if (!raw) return undefined;

    const entry = JSON.parse(raw) as Entry;
    if (typeof entry?.at !== 'number') return undefined;
    if (Date.now() - entry.at > TTL_MS) return undefined;

    return entry.soundtrack ?? null;
  } catch {
    return undefined;
  }
}

export async function writeLocalSoundtrack(
  gameId: string,
  soundtrack: GameSoundtrack | null
): Promise<void> {
  try {
    const entry: Entry = { soundtrack, at: Date.now() };
    await AsyncStorage.setItem(keyFor(gameId), JSON.stringify(entry));
  } catch {
    /* A mirror is a convenience. Losing one must never fail a roll. */
  }
}
