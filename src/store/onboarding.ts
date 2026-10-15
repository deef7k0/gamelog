import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Href } from 'expo-router';
import { create } from 'zustand';

import { hasFallbackUsername, type OnboardingAnswers } from '@/lib/onboarding';
import { fetchOwnProfile } from '@/lib/own-profile';

/**
 * Whether the signed-in account still has onboarding ahead of it.
 *
 * - `unknown` — not worked out yet for this account.
 * - `needed` — the root layout routes to `onboarding` and nowhere else.
 * - `done` — the app.
 *
 * ## Only a sign-up is asked the questions
 *
 * The owner's rule (2026-10-15): "for someone logging in, it shouldnt ask the
 * questions, only to people signing up". Three ways an account gets here, and
 * how each is told apart:
 *
 * 1. **Signing up with a password** — `signUp()` brackets its call with
 *    `beginSignUp` / `endSignUp`, and the session that arrives inside that
 *    window is a new account's: `needed`, decided on the spot, with no request.
 * 2. **Signing up with Google or Facebook**, or **logging in for the first time
 *    after confirming an email** — no bracket, so the database decides: the
 *    account still wears the name `handle_new_user()` gives a sign-up with no
 *    handle (`hasFallbackUsername`), so it has not finished signing up.
 * 3. **Logging in to an account that has a handle** — `done`. That is every
 *    account that finished onboarding, and every one made before it existed.
 *
 * ## How it is decided, and why it needs no migration
 *
 * The device is asked first: a record here says this account started (`started`)
 * or finished (`done`) on this phone, which is what lets a flow closed halfway
 * open where it was left — and what keeps it from ending early when the handle
 * is claimed one step before the last page. With no record, the database
 * decides: an account still wearing the name `handle_new_user()` gives a
 * nameless sign-up has not finished (`hasFallbackUsername`). Every account made
 * before this flow has a real name, and is `done` the first time it is asked.
 *
 * **It never holds anybody out of the app.** A profile that cannot be read
 * after `fetchOwnProfile`'s retries, a request that takes longer than
 * `TIMEOUT_MS`, a storage error: all `done`. (The retries are what stop a
 * passing "JWT issued at future" from deciding a new account is done.) The
 * worst case is a new account that skips onboarding and claims its handle in
 * Edit profile later; the alternative is a splash screen that never lifts.
 */
export type OnboardingStatus = 'unknown' | 'needed' | 'done';

/** Where the last page sent them, once the app has replaced onboarding. */
export type AfterOnboarding = Href | null;

type OnboardingState = {
  userId: string | null;
  status: OnboardingStatus;
  /**
   * True once the launch's account (or the lack of one) has been worked out.
   * The root layout holds the splash screen on it, so an existing account never
   * sees onboarding flash past on a cold start. Only ever goes true.
   */
  launchResolved: boolean;
  after: AfterOnboarding;
};

/** Longer than `fetchOwnProfile`'s retries take, so they get to finish. */
const TIMEOUT_MS = 9000;

function key(userId: string): string {
  return `gamelog.onboarding.v1.${userId}`;
}

export const useOnboarding = create<OnboardingState>(() => ({
  userId: null,
  status: 'unknown',
  launchResolved: false,
  after: null,
}));

async function readStatus(userId: string): Promise<'needed' | 'done'> {
  try {
    const stored = await AsyncStorage.getItem(key(userId));
    if (stored === 'done') return 'done';
    if (stored === 'started') return 'needed';
  } catch {
    // Unreadable storage: ask the database instead.
  }

  let profile;
  try {
    profile = await fetchOwnProfile(userId);
  } catch {
    return 'done';
  }
  if (!profile) return 'done';

  const status = hasFallbackUsername(profile.username) ? 'needed' : 'done';
  void AsyncStorage.setItem(key(userId), status === 'needed' ? 'started' : 'done').catch(
    () => undefined
  );
  return status;
}

/* A password sign-up in flight: see "Only a sign-up is asked the questions". */
let signUpInFlight = false;

export function beginSignUp(): void {
  signUpInFlight = true;
}

export function endSignUp(): void {
  signUpInFlight = false;
}

/**
 * Work out the status for the account that just signed in (or was restored).
 * Called by the auth store's listener; a late answer for an account that is no
 * longer signed in is dropped.
 */
export function resolveOnboarding(userId: string | null): void {
  if (!userId) {
    useOnboarding.setState({ userId: null, status: 'unknown', launchResolved: true });
    return;
  }

  /* A session that arrives during `signUp()` is the account it just made. */
  if (signUpInFlight) {
    void AsyncStorage.setItem(key(userId), 'started').catch(() => undefined);
    useOnboarding.setState({ userId, status: 'needed', launchResolved: true });
    return;
  }

  useOnboarding.setState({ userId, status: 'unknown' });

  const timeout = new Promise<'done'>((resolve) => setTimeout(() => resolve('done'), TIMEOUT_MS));
  void Promise.race([readStatus(userId).catch(() => 'done' as const), timeout]).then((status) => {
    if (useOnboarding.getState().userId !== userId) return;
    useOnboarding.setState({ status, launchResolved: true });
  });
}

/** The flow is over: never again for this account on this phone. */
export function finishOnboarding(after: AfterOnboarding = null): void {
  const { userId } = useOnboarding.getState();
  if (userId) void AsyncStorage.setItem(key(userId), 'done').catch(() => undefined);
  useOnboarding.setState({ status: 'done', after });
}

/** Read and clear where the last page sent them. */
export function takeAfterOnboarding(): AfterOnboarding {
  const { after } = useOnboarding.getState();
  if (after) useOnboarding.setState({ after: null });
  return after;
}

/* -------------------------------------------------------------------------
 * Where a halfway flow resumes
 * ---------------------------------------------------------------------- */

/** What a flow closed halfway needs to open where it was. */
export type OnboardingResume = {
  step: string;
  name: string;
  answers: OnboardingAnswers;
  favourites: { id: string; sourceId: string; title: string }[];
};

function resumeKey(userId: string): string {
  return `gamelog.onboarding.v1.${userId}.resume`;
}

/** The record this account left on this phone, or null. */
export async function readResume(userId: string): Promise<OnboardingResume | null> {
  try {
    const raw = await AsyncStorage.getItem(resumeKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<OnboardingResume>;
    if (typeof parsed.step !== 'string' || !parsed.answers) return null;
    return {
      step: parsed.step,
      name: typeof parsed.name === 'string' ? parsed.name : '',
      answers: parsed.answers,
      favourites: Array.isArray(parsed.favourites) ? parsed.favourites : [],
    };
  } catch {
    return null;
  }
}

export function saveResume(userId: string, resume: OnboardingResume): void {
  void AsyncStorage.setItem(resumeKey(userId), JSON.stringify(resume)).catch(() => undefined);
}

/** Forget the answers: they only ever chose six games. */
export function clearResume(userId: string): void {
  void AsyncStorage.removeItem(resumeKey(userId)).catch(() => undefined);
}
