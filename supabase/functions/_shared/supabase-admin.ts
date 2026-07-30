import { createClient, type SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

/**
 * Service-role Supabase client.
 *
 * The gaming tables have no INSERT/UPDATE policies for `authenticated` on
 * purpose — a SteamID64 is only trustworthy because the server verified an
 * OpenID assertion for it, so only these functions may write one. That makes the
 * service role a requirement, not a shortcut.
 *
 * SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are injected into every Edge
 * Function by the platform; they do not need to be set as secrets.
 */
export function adminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!url || !serviceKey) {
    throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are missing from the environment.');
  }

  return createClient(url, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/**
 * Resolve the calling user from their Authorization header.
 *
 * These functions run with `--no-verify-jwt` because the OpenID return leg is a
 * plain browser redirect with no token, so authentication is done explicitly
 * here for the legs that need it. Returning null rather than throwing lets the
 * caller decide whether anonymous access is acceptable for that route.
 */
export async function userFromRequest(request: Request): Promise<string | null> {
  const header = request.headers.get('Authorization');
  if (!header?.startsWith('Bearer ')) return null;

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  if (!url || !anonKey) return null;

  const client = createClient(url, anonKey, {
    global: { headers: { Authorization: header } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return null;
  return data.user.id;
}
