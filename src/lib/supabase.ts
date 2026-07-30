import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from './database.types';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/**
 * Env vars are inlined at build time, so a missing one is a setup mistake, not
 * a runtime condition. Surface it as a clear message instead of a confusing
 * "Invalid URL" from deep inside supabase-js.
 */
if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Supabase is not configured.\n\n' +
      'Copy .env.example to .env and fill in EXPO_PUBLIC_SUPABASE_URL and ' +
      'EXPO_PUBLIC_SUPABASE_ANON_KEY, then restart the dev server with ' +
      '`npx expo start --clear` (env vars are inlined at build time, so a plain ' +
      'reload will not pick them up).'
  );
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage is what Supabase documents for Expo. It also works on web,
    // which expo-secure-store does not. Tokens are not encrypted at rest — fine
    // for this app's threat model, worth revisiting if you ever store anything
    // more sensitive than a session.
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    // Only meaningful for OAuth redirects in a browser; native has no URL to read.
    detectSessionInUrl: Platform.OS === 'web',
  },
});

/**
 * Supabase refreshes tokens on a timer, which the OS suspends in the
 * background. Without this, a session can be silently expired on resume.
 */
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') {
      supabase.auth.startAutoRefresh();
    } else {
      supabase.auth.stopAutoRefresh();
    }
  });
}
