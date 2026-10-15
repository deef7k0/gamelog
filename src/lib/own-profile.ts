import type { Profile } from './database.types';
import { supabase } from './supabase';

/**
 * How long to wait before each try. The first is at once; the rest give the
 * database's clock time to catch up with the token (see below).
 */
const RETRY_DELAYS_MS = [0, 800, 2000, 4000];

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * The signed-in account's own profile, read patiently — the one read the app
 * cannot do without right after a sign-in.
 *
 * ## Why it tries more than once
 *
 * A token is minted by Supabase's auth server and checked by the database's
 * API (PostgREST), which refuses one whose `iat` is later than its own clock:
 * "JWT issued at future". The two are different machines, so for the first
 * second or so after a sign-in the brand-new token can be "from the future" to
 * the database — seen on the owner's phone, on the first launch after clearing
 * the app's data. The read was made exactly once, inside the auth listener, so
 * the profile stayed `null` for the whole session: no "Welcome back" on Home,
 * and onboarding deciding without the one fact it reads. A second try a moment
 * later succeeds; this makes four, over about seven seconds.
 *
 * Resolves `null` when the account has no profile row, and throws only once
 * every try has failed.
 */
export async function fetchOwnProfile(userId: string): Promise<Profile | null> {
  let last: unknown = null;
  for (const delay of RETRY_DELAYS_MS) {
    if (delay > 0) await wait(delay);
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle();
    if (!error) return data;
    last = error;
  }
  throw new Error(last instanceof Object && 'message' in last ? String(last.message) : 'unknown');
}
