import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';

import { supabase } from '@/lib/supabase';

/**
 * Signing in through somebody else's identity provider.
 *
 * ## Why this is not `supabase.auth.signInWithOAuth` on its own
 *
 * That call is written for a browser: it redirects the current page and lets
 * `detectSessionInUrl` pick the session back up on return. Native has no page to
 * redirect and `detectSessionInUrl` is off here (see `lib/supabase.ts` — it is
 * gated on `hasDOM`, which is false on a phone). So the flow is done by hand:
 * ask Supabase for the provider URL, open it in a system auth session, and read
 * the session out of the URL the provider sends back.
 *
 * `skipBrowserRedirect` is what makes that possible — without it the SDK tries
 * to navigate and returns nothing useful to open.
 *
 * ## Both callback shapes are handled, deliberately
 *
 * Supabase returns a PKCE `?code=` when the client is configured for it and an
 * implicit `#access_token=` otherwise, and that setting lives in
 * `lib/supabase.ts` rather than here. Handling only the shape this project
 * happens to use today would break silently the day somebody sets `flowType`,
 * with the browser closing on a successful login and no session appearing.
 * Reading whichever arrives costs a dozen lines and removes that trap.
 *
 * ## No provider is enabled by this file
 *
 * Google and Facebook each need a client id and secret in the Supabase
 * dashboard, and the redirect below registered against them. Until that is done
 * the provider page returns an error and this throws with the message Supabase
 * gave — which is the honest outcome. Nothing here can enable a provider, and a
 * button that pretends otherwise would be worse than one that fails clearly.
 */
export type OAuthProvider = 'google' | 'facebook';

/**
 * Where the provider sends the browser back to.
 *
 * `Linking.createURL` builds it from the `scheme` in `app.json` (`gamelog://`)
 * in a build, and from the dev-server URL under Expo Go — which is why this is
 * computed rather than written down. **The value it returns has to be on the
 * provider's allow-list and in Supabase's "Redirect URLs"**, and the Expo Go one
 * differs per machine, so testing OAuth in Expo Go means adding that URL too.
 */
function redirectUrl(): string {
  return Linking.createURL('auth/callback');
}

/** Pulls a session out of whichever callback shape the provider returned. */
async function completeSession(url: string): Promise<void> {
  const parsed = new URL(url);

  /* A provider that refused says so in the query string, and it is the one case
     where the browser closes "successfully" with no session. Surfaced rather
     than left to fall through to the generic message below. */
  const providerError =
    parsed.searchParams.get('error_description') ?? parsed.searchParams.get('error');
  if (providerError) throw new Error(providerError);

  const code = parsed.searchParams.get('code');
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) throw new Error(error.message);
    return;
  }

  /* Implicit flow puts the tokens in the fragment, which `URL` exposes as
     `hash` with the leading '#' still attached. */
  const fragment = new URLSearchParams(parsed.hash.replace(/^#/, ''));
  const access_token = fragment.get('access_token');
  const refresh_token = fragment.get('refresh_token');

  if (access_token && refresh_token) {
    const { error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) throw new Error(error.message);
    return;
  }

  throw new Error('That sign-in did not complete. Please try again.');
}

/**
 * Open a provider's sign-in page and settle the session it returns.
 *
 * Resolves `false` when the reader backed out — a dismissed browser is not an
 * error and must not raise one, or every cancelled tap would show a red banner
 * for a decision the user made on purpose. Resolves `true` once a session
 * exists; the root layout's guard does the navigating from there, exactly as it
 * does for an email sign-in.
 */
export async function signInWithProvider(provider: OAuthProvider): Promise<boolean> {
  const redirectTo = redirectUrl();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error) throw new Error(error.message);
  if (!data?.url) throw new Error('Could not reach that sign-in provider.');

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') return false;

  await completeSession(result.url);
  return true;
}
