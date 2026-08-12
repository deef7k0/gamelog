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

/**
 * Is there a real DOM right now?
 *
 * **Not the same question as `Platform.OS === 'web'`.** `app.json` sets
 * `web.output: "static"`, so `expo-router-server` prerenders every route in
 * Node at build time using the *web* bundle — `Platform.OS` is `'web'` there
 * too, with no `window` anywhere. Anything that asks "am I on web?" to decide
 * whether it can touch the DOM gets the wrong answer during that pass.
 *
 * This is the same test `@supabase/auth-js` uses internally (`isBrowser()`),
 * deliberately: the two must agree about what counts as a browser.
 */
const hasDOM = typeof window !== 'undefined' && typeof document !== 'undefined';

/**
 * AsyncStorage, made safe to call when there is no DOM.
 *
 * `@react-native-async-storage/async-storage` ships two implementations, and
 * Metro picks by platform: `AsyncStorage.native.ts` for iOS/Android, and
 * `AsyncStorage.ts` for web — which is a bare `window.localStorage` wrapper
 * with **no guard of its own**. Under static rendering that file runs in Node
 * and throws `ReferenceError: window is not defined` on the first read.
 *
 * That read happens before any of our code does: `GoTrueClient`'s constructor
 * auto-calls `initialize()`, which recovers a persisted session, which calls
 * `storage.getItem()`. So the crash lands at import time, in a client nobody
 * has touched yet.
 *
 * Supabase's *own* guards cannot help here. Every `isBrowser()` check in
 * auth-js protects auth-js's own DOM access; the one place it would have picked
 * a server-safe adapter is the `else` branch that runs when no `storage` is
 * supplied — and supplying one is exactly what we do.
 *
 * Wrapping rather than dropping AsyncStorage on web is the conservative fix: a
 * browser still gets AsyncStorage, under the same keys, so existing sessions on
 * mobile *and* on web survive untouched. Only the prerender pass sees a store
 * that reads empty, which is correct — a build-time render cannot know who is
 * signed in, and the browser re-runs this module with a real DOM on hydration.
 */
const sessionStorage = {
  getItem: (key: string) => (hasDOM ? AsyncStorage.getItem(key) : Promise.resolve(null)),
  setItem: (key: string, value: string) =>
    hasDOM ? AsyncStorage.setItem(key, value) : Promise.resolve(),
  removeItem: (key: string) => (hasDOM ? AsyncStorage.removeItem(key) : Promise.resolve()),
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    // AsyncStorage is what Supabase documents for Expo. It also works on web,
    // which expo-secure-store does not. Tokens are not encrypted at rest — fine
    // for this app's threat model, worth revisiting if you ever store anything
    // more sensitive than a session.
    storage: sessionStorage,
    autoRefreshToken: true,
    persistSession: true,
    /*
     * Only meaningful for OAuth redirects in a browser; native has no URL to
     * read and a prerender has no URL bar. `hasDOM`, not `Platform.OS`, for the
     * reason above — auth-js happens to guard this one itself, but a flag that
     * claims a DOM exists when it does not is a trap waiting for the next
     * version to stop guarding.
     */
    detectSessionInUrl: hasDOM,
  },
});

/**
 * Supabase refreshes tokens on a timer, which the OS suspends in the
 * background. Without this, a session can be silently expired on resume.
 *
 * Native only — and that guard doubles as the prerender guard, since Node runs
 * the web bundle where `Platform.OS` is `'web'`.
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
