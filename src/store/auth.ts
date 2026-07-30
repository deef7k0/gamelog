import type { Session } from '@supabase/supabase-js';
import { create } from 'zustand';

import type { Profile } from '@/lib/database.types';
import { supabase } from '@/lib/supabase';

type AuthState = {
  session: Session | null;
  profile: Profile | null;
  /** True until the persisted session has been restored from storage. */
  isRestoring: boolean;

  signIn: (email: string, password: string) => Promise<void>;
  signUp: (
    email: string,
    password: string,
    username: string
  ) => Promise<{ needsEmailConfirm: boolean }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) {
    console.warn('[auth] failed to load profile:', error.message);
    return null;
  }
  return data;
}

export const useAuth = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isRestoring: true,

  signIn: async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) throw new Error(error.message);
    // onAuthStateChange populates session and profile.
  },

  signUp: async (email, password, username) => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      // Read by the handle_new_user() trigger to seed public.profiles.
      options: { data: { username: username.trim() } },
    });
    if (error) throw new Error(error.message);

    // With email confirmation enabled (the Supabase default) signUp returns a
    // user but no session — the caller needs to tell the user to check email
    // rather than silently landing on a signed-out screen.
    return { needsEmailConfirm: data.session === null };
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
    set({ session: null, profile: null });
  },

  refreshProfile: async () => {
    const userId = get().session?.user.id;
    if (!userId) {
      set({ profile: null });
      return;
    }
    set({ profile: await fetchProfile(userId) });
  },
}));

/**
 * Wire the store to Supabase once, at module load.
 *
 * `onAuthStateChange` fires immediately with the restored session, so it covers
 * both startup and later sign-in/sign-out without a separate getSession() call.
 *
 * The callback must stay synchronous: supabase-js holds an internal lock while
 * it runs, and awaiting other Supabase calls inside it deadlocks. Profile
 * loading is therefore fired off separately rather than awaited here.
 */
supabase.auth.onAuthStateChange((_event, session) => {
  const previousUserId = useAuth.getState().session?.user.id;
  useAuth.setState({ session, isRestoring: false });

  if (!session) {
    useAuth.setState({ profile: null });
    return;
  }

  if (session.user.id !== previousUserId) {
    void fetchProfile(session.user.id).then((profile) => {
      // Ignore a late response for a user who has since signed out or changed.
      if (useAuth.getState().session?.user.id === session.user.id) {
        useAuth.setState({ profile });
      }
    });
  }
});
