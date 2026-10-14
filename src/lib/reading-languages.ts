import AsyncStorage from '@react-native-async-storage/async-storage';

import { DEFAULT_READING_CHOICE, coerceReadingChoice, type ReadingChoice } from './language';

/**
 * Which languages somebody chose to be shown reviews in, on the device.
 *
 * On the device for the reason `surprise-prefs.ts` gives — there is no
 * settings table in this app and three small choices do not start one — and
 * for one of its own: `profiles` is readable by everyone, and which languages
 * a person reads is theirs to say, not a column strangers can select.
 *
 * It is also genuinely the phone's. `auto`, the default, starts from the
 * language this handset is set to; the same account on another one would be
 * right to start from that one's.
 *
 * Keyed by user id, as every store here is, so two accounts on one phone do
 * not inherit each other's.
 *
 * What a choice *means* — what `auto` comes to, what counts as readable — is
 * `lib/language.ts`, which is pure and tested. This file only keeps it.
 */

const PREFIX = 'gamelog:reading-languages';

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** The stored choice — `auto` when there is none, or it does not parse. */
export async function loadReadingChoice(userId: string): Promise<ReadingChoice> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    return raw ? coerceReadingChoice(JSON.parse(raw)) : DEFAULT_READING_CHOICE;
  } catch {
    return DEFAULT_READING_CHOICE;
  }
}

/**
 * Keep a choice, and answer with what was kept — checked the way a read would
 * check it, so the caller can put it straight in the query cache.
 */
export async function saveReadingChoice(
  userId: string,
  choice: ReadingChoice
): Promise<ReadingChoice> {
  const kept = coerceReadingChoice(choice);
  try {
    /* `auto` is the absence of a choice; storing nothing is how it stays the
       default if the default ever changes. */
    if (kept.mode === 'auto') await AsyncStorage.removeItem(keyFor(userId));
    else await AsyncStorage.setItem(keyFor(userId), JSON.stringify(kept));
  } catch {
    /* Ignored — worst case the next session opens on automatic. */
  }
  return kept;
}
