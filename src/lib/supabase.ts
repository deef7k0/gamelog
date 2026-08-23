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
 * Can `AsyncStorage` be called at all in this environment?
 *
 * **Not the same question as `hasDOM`, and conflating the two broke every
 * signed-in write on iOS and Android.** React Native defines `global.window`
 * (`setUpGlobals.js` aliases it to `global`) and never defines `document`, so
 * `hasDOM` is *false on a phone* — the one platform where AsyncStorage is a
 * real native module and always safe to call.
 *
 * What that cost, when the storage adapter was gated on `hasDOM` alone: every
 * read and write became a no-op on device, so nothing was ever persisted. That
 * looks harmless — until you follow what auth-js does with it. `getSession()`
 * → `__loadSession()` reads the session **from storage and nowhere else**;
 * there is no in-memory fallback when `persistSession` is true (the
 * `inMemorySession` field is only consulted when it is false). So `getSession()`
 * returned null on every call, and PostgREST fell back to sending the anon key.
 *
 * The symptom is not "you are signed out" — it is worse than that. Sign-in
 * succeeds, `onAuthStateChange` fires with the session straight off the sign-in
 * *response*, the store fills in and `<Stack.Protected>` lets you through. The
 * app shows you as signed in while every database request arrives anonymous, so
 * `auth.uid()` is null and each write fails against its RLS policy:
 *
 *   new row violates row-level security policy for table "lists"
 *   new row violates row-level security policy for table "games"
 *
 * — and any SECURITY DEFINER function that checks `auth.uid()` itself raises
 * its own "must be signed in". Three unrelated-looking errors, one cause.
 *
 * So the guard has to ask what it actually needs to know: *is the storage
 * implementation Metro resolved for this platform safe to call right now.*
 * Native is always yes. Web is yes only with a real DOM, because Metro resolves
 * `AsyncStorage.ts` there — a bare `window.localStorage` wrapper with no guard
 * of its own, which throws `ReferenceError: window is not defined` under static
 * rendering (`app.json` sets `web.output: 'static'`, so expo-router prerenders
 * every route in Node using the web bundle). That read happens before any of
 * our code does: `GoTrueClient`'s constructor auto-calls `initialize()`, which
 * recovers a persisted session, which calls `storage.getItem()` — so the crash
 * lands at import time in a client nobody has touched yet.
 *
 * `Platform.OS` is `'web'` during that prerender too, which is exactly why the
 * native check is the *first* term and `hasDOM` only decides the web case.
 *
 * Supabase's own guards cannot help here. Every `isBrowser()` check in auth-js
 * protects auth-js's own DOM access; the one place it would have picked a
 * server-safe adapter is the `else` branch that runs when no `storage` is
 * supplied — and supplying one is exactly what we do.
 */
const canPersistSession = Platform.OS !== 'web' || hasDOM;

/** AsyncStorage, made safe to call during the Node prerender pass. */
const sessionStorage = {
  getItem: (key: string) => (canPersistSession ? AsyncStorage.getItem(key) : Promise.resolve(null)),
  setItem: (key: string, value: string) =>
    canPersistSession ? AsyncStorage.setItem(key, value) : Promise.resolve(),
  removeItem: (key: string) =>
    canPersistSession ? AsyncStorage.removeItem(key) : Promise.resolve(),
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
