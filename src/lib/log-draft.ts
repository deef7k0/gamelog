import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Unsaved log/review drafts, on the device.
 *
 * Writing a review is the longest-lived task in the app and it happens on a
 * phone, one-handed, by someone who has just put a controller down — the
 * interruption is the normal case, not the edge one. Before this, a mistapped
 * close, an accidental swipe on the sheet, or a phone call during the third
 * paragraph discarded everything, silently and with no way back.
 *
 * Deliberately local and deliberately not a server draft. A draft is a private
 * half-thought: syncing it would mean writing an unfinished opinion into a table
 * the feed reads from, and `logs` has no "unpublished" state to hold it in.
 *
 * Keyed per user *and* per game so two people sharing a device never see each
 * other's writing, and so a draft cannot leak from one game onto another.
 */

const PREFIX = 'gamelog:log-draft';

/** Everything the form holds, as it holds it — strings stay strings. */
export type LogDraft = {
  /**
   * Which of the seven progress choices was picked (`constants/progress.ts`),
   * and for "Completed", how far. Optional because drafts written before the
   * progress sheet carry `status` and `completed` instead — see
   * `progressFromDraft`, which reads either shape.
   */
  progress?: string;
  level?: string;
  /** Pre-progress drafts only. */
  status?: string;
  rating: number | null;
  advanced: boolean;
  metricDraft: Record<string, string | undefined>;
  reviewTitle: string;
  review: string;
  platinum: boolean;
  /* Optional, unlike its siblings: drafts written before 0021 have no such key,
     and `loadDraft` casts the parsed JSON rather than validating it field by
     field. A required boolean here would type as `false` on every one of those
     and read as a decision the author never made. */
  spoilers?: boolean;
  /** Pre-progress drafts only: the old "Completed 100%" toggle. */
  completed?: boolean;
  hours: string;
  playedOn: string;
  /** Solo or co-op ('' for unsaid) and the player count. Absent before 0023. */
  play?: string;
  players?: string;
  /** Epoch ms. Shown to the user, so they can judge whether it is still theirs. */
  savedAt: number;
};

function keyFor(userId: string, gameId: string) {
  return `${PREFIX}:${userId}:${gameId}`;
}

/**
 * Read a draft back.
 *
 * Any failure resolves to `null` rather than throwing. A corrupt or
 * half-written record must never be the thing that stops the log screen from
 * opening — the saved log is the source of truth and is still there.
 */
export async function loadDraft(userId: string, gameId: string): Promise<LogDraft | null> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId, gameId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LogDraft;
    return typeof parsed?.savedAt === 'number' ? parsed : null;
  } catch {
    return null;
  }
}

/** Write a draft. Failures are swallowed: a draft is a courtesy, not a promise. */
export async function saveDraft(userId: string, gameId: string, draft: LogDraft): Promise<void> {
  try {
    await AsyncStorage.setItem(keyFor(userId, gameId), JSON.stringify(draft));
  } catch {
    /* Out of quota or storage unavailable — the form is unaffected. */
  }
}

/** Drop a draft. Called on a successful save and on an explicit discard. */
export async function clearDraft(userId: string, gameId: string): Promise<void> {
  try {
    await AsyncStorage.removeItem(keyFor(userId, gameId));
  } catch {
    /* Nothing to recover from: the worst case is a stale draft offered once more. */
  }
}
