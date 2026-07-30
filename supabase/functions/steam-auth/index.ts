/**
 * Steam OpenID 2.0 link flow.
 *
 * ## Why this cannot happen in the app
 *
 * Steam's OpenID response is only trustworthy if you send it *back* to Steam
 * with `openid.mode=check_authentication` and Steam confirms the signature. A
 * client that skipped that step could claim any SteamID64 it liked and inherit a
 * stranger's library, playtime and achievements. So verification happens here,
 * and `gaming_accounts.external_id` has no client write policy at all.
 *
 * ## The flow
 *
 *   1. App  ->  POST /steam-auth { action: 'start', redirectTo }   (Bearer JWT)
 *              A single-use `state` nonce is stored against the user id and the
 *              Steam login URL is returned.
 *   2. App  ->  opens that URL in a web-auth session.
 *   3. Steam -> GET /steam-auth?state=...&openid.*
 *              The assertion is verified with Steam, the state is redeemed, the
 *              account is written, and the browser is bounced to the app's deep
 *              link.
 *
 * The user's Supabase JWT never appears in a URL, which matters because
 * `return_to` is echoed by Steam and ends up in browser history.
 *
 * ## Deploy
 *
 *   supabase secrets set STEAM_API_KEY=xxxxxxxx
 *   supabase functions deploy steam-auth --no-verify-jwt
 *
 * `--no-verify-jwt` is required: step 3 is a browser redirect with no token.
 * Both legs authenticate themselves — step 1 by Bearer token, step 3 by the
 * single-use state nonce — so the function is not open.
 */

import { CORS_HEADERS, closingPage, jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';
import { SteamApi, statusFrom, visibilityFrom } from '../_shared/steam-api.ts';

const OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NS = 'http://specs.openid.net/auth/2.0';
const IDENTIFIER_SELECT = 'http://specs.openid.net/auth/2.0/identifier_select';

/** `https://steamcommunity.com/openid/id/76561198…` -> the id. */
const CLAIMED_ID_PATTERN = /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

/**
 * Deep links we are willing to bounce back to.
 *
 * An open redirect here would let someone craft a link that sends a verified
 * Steam identity to a scheme they control, so the app scheme is allow-listed and
 * Expo Go's `exp://` is permitted only for local development hosts.
 */
function isAllowedRedirect(target: string): boolean {
  if (target.startsWith('gamelog://')) return true;
  // Expo Go serves the app from a LAN address during development.
  if (/^exp:\/\/(\d{1,3}\.){3}\d{1,3}:\d+/.test(target)) return true;
  if (/^exp:\/\/localhost:\d+/.test(target)) return true;
  return false;
}

function randomState(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * The publicly reachable URL of this function.
 *
 * Deliberately derived from SUPABASE_URL rather than from `request.url`. Inside
 * the Edge runtime the incoming URL is the *internal* route (the platform strips
 * `/functions/v1`), so building `return_to` from it would hand Steam an address
 * it cannot redirect a browser back to — and the failure only shows up at the
 * very end of the OpenID round trip, which is a miserable thing to debug.
 */
function functionBaseUrl(): string {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  if (!supabaseUrl) throw new Error('SUPABASE_URL is missing from the environment.');
  return `${supabaseUrl.replace(/\/+$/, '')}/functions/v1/steam-auth`;
}

// ---------------------------------------------------------------------------
// Step 1: begin
// ---------------------------------------------------------------------------

async function begin(request: Request, redirectTo: string): Promise<Response> {
  const userId = await userFromRequest(request);
  if (!userId) {
    return jsonResponse({ error: 'Sign in before linking a Steam account.' }, 401);
  }

  if (!isAllowedRedirect(redirectTo)) {
    return jsonResponse({ error: 'Unsupported redirect target.' }, 400);
  }

  const admin = adminClient();
  const state = randomState();

  const { error } = await admin.from('gaming_link_requests').insert({
    state,
    user_id: userId,
    provider: 'steam',
    redirect_to: redirectTo,
  });
  if (error) return jsonResponse({ error: error.message }, 500);

  // Opportunistically drop expired nonces so the table cannot grow unbounded.
  await admin.from('gaming_link_requests').delete().lt('expires_at', new Date().toISOString());

  const base = functionBaseUrl();
  const params = new URLSearchParams({
    'openid.ns': OPENID_NS,
    'openid.mode': 'checkid_setup',
    // `realm` must be a prefix of `return_to` or Steam rejects the request.
    'openid.realm': base,
    'openid.return_to': `${base}?state=${state}`,
    'openid.identity': IDENTIFIER_SELECT,
    'openid.claimed_id': IDENTIFIER_SELECT,
  });

  return jsonResponse({ url: `${OPENID_ENDPOINT}?${params}` });
}

// ---------------------------------------------------------------------------
// Step 3: verify the assertion
// ---------------------------------------------------------------------------

/**
 * Ask Steam whether it really signed this response.
 *
 * Every `openid.*` parameter is passed back untouched except `openid.mode`; the
 * signature covers the fields listed in `openid.signed`, so altering any of them
 * invalidates it. The reply is `key:value` lines, NOT JSON — verified against the
 * live endpoint, which answers `ns:…\nis_valid:false` for a bogus assertion.
 */
async function verifyAssertion(params: URLSearchParams): Promise<boolean> {
  const body = new URLSearchParams();
  for (const [name, value] of params) {
    if (name.startsWith('openid.')) body.set(name, value);
  }
  body.set('openid.mode', 'check_authentication');

  const response = await fetch(OPENID_ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  if (!response.ok) return false;

  const text = await response.text();
  return text
    .split('\n')
    .map((line) => line.trim())
    .includes('is_valid:true');
}

async function complete(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const state = params.get('state');

  // Steam sends the user back here when they cancel, without an identity.
  if (params.get('openid.mode') === 'cancel') {
    const fallback = state ? await redirectForState(state) : null;
    return closingPage(
      appendResult(fallback ?? 'gamelog://steam-linked', 'cancelled'),
      'Steam sign-in was cancelled.'
    );
  }

  if (!state) return jsonResponse({ error: 'Missing state.' }, 400);

  const admin = adminClient();

  // Redeem the nonce first: single use, and expired nonces are refused.
  const { data: linkRequest } = await admin
    .from('gaming_link_requests')
    .select('state, user_id, redirect_to, expires_at')
    .eq('state', state)
    .maybeSingle();

  if (!linkRequest) {
    return closingPage(
      appendResult('gamelog://steam-linked', 'failed'),
      'This Steam link request has expired. Please try again.'
    );
  }

  await admin.from('gaming_link_requests').delete().eq('state', state);

  const redirectTo = isAllowedRedirect(linkRequest.redirect_to ?? '')
    ? (linkRequest.redirect_to as string)
    : 'gamelog://steam-linked';

  if (new Date(linkRequest.expires_at).getTime() < Date.now()) {
    return closingPage(appendResult(redirectTo, 'failed'), 'This request expired. Try again.');
  }

  const claimedId = params.get('openid.claimed_id') ?? '';
  const match = CLAIMED_ID_PATTERN.exec(claimedId);
  if (!match) {
    return closingPage(appendResult(redirectTo, 'failed'), 'Steam returned an unexpected identity.');
  }
  const steamId = match[1];

  if (!(await verifyAssertion(params))) {
    return closingPage(
      appendResult(redirectTo, 'failed'),
      'Steam could not verify that sign-in. Nothing was linked.'
    );
  }

  // Verified. Seed the account row with whatever the profile will tell us, so
  // the UI has something to render before the first full sync completes.
  const steamKey = Deno.env.get('STEAM_API_KEY');
  let seeded: Record<string, unknown> = {};

  if (steamKey) {
    try {
      const api = new SteamApi(steamKey);
      const [summary, level] = await Promise.all([
        api.getPlayerSummary(steamId),
        api.getSteamLevel(steamId).catch(() => null),
      ]);
      if (summary) {
        seeded = {
          handle: summary.personaname ?? null,
          display_name: summary.realname ?? summary.personaname ?? null,
          avatar_url: summary.avatarfull ?? summary.avatarmedium ?? summary.avatar ?? null,
          profile_url: summary.profileurl ?? `https://steamcommunity.com/profiles/${steamId}`,
          country: summary.loccountrycode ?? null,
          visibility: visibilityFrom(summary.communityvisibilitystate),
          status: statusFrom(summary.personastate),
          current_game_app_id: summary.gameid ?? null,
          current_game_name: summary.gameextrainfo ?? null,
          level,
        };
      }
    } catch {
      // A seeding failure must not fail the link — the sync service will fill
      // this in on its next run.
    }
  }

  const { error: upsertError } = await admin.from('gaming_accounts').upsert(
    {
      user_id: linkRequest.user_id,
      provider: 'steam',
      external_id: steamId,
      linked_at: new Date().toISOString(),
      ...seeded,
    },
    { onConflict: 'user_id,provider' }
  );

  if (upsertError) {
    // The unique (provider, external_id) constraint is the likely cause: this
    // Steam account already belongs to a different GameLog user.
    const alreadyLinked = upsertError.code === '23505' || /duplicate key/i.test(upsertError.message);
    return closingPage(
      appendResult(redirectTo, alreadyLinked ? 'already-linked' : 'failed'),
      alreadyLinked
        ? 'That Steam account is already linked to another GameLog profile.'
        : 'Could not save the Steam link. Please try again.'
    );
  }

  // `profiles.steam_id` predates this table and is what the existing achievement
  // sync reads, so keep it in step rather than leaving two sources of truth.
  await admin.from('profiles').update({ steam_id: steamId }).eq('id', linkRequest.user_id);

  // Queue every section for an immediate first sync.
  await admin.from('gaming_sync_state').upsert(
    ['profile', 'library', 'achievements', 'inventory', 'badges', 'friends'].map((section) => ({
      user_id: linkRequest.user_id,
      provider: 'steam',
      section,
      status: 'idle',
      next_run_after: null,
      attempts: 0,
      error: null,
      cursor: null,
    })),
    { onConflict: 'user_id,provider,section' }
  );

  return closingPage(appendResult(redirectTo, 'ok'), 'Steam account linked. Returning to GameLog…');
}

async function redirectForState(state: string): Promise<string | null> {
  const admin = adminClient();
  const { data } = await admin
    .from('gaming_link_requests')
    .select('redirect_to')
    .eq('state', state)
    .maybeSingle();
  const target = data?.redirect_to as string | undefined;
  return target && isAllowedRedirect(target) ? target : null;
}

function appendResult(deepLink: string, result: string): string {
  const separator = deepLink.includes('?') ? '&' : '?';
  return `${deepLink}${separator}result=${encodeURIComponent(result)}`;
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();

  try {
    // Steam's redirect is the only GET, and it always carries openid params.
    if (request.method === 'GET') {
      const params = new URL(request.url).searchParams;
      if (params.has('openid.mode') || params.has('state')) return complete(request);
      return jsonResponse({ error: 'Nothing to do.' }, 400);
    }

    if (request.method !== 'POST') {
      return jsonResponse({ error: 'Method not allowed.' }, 405);
    }

    let payload: { action?: string; redirectTo?: string };
    try {
      payload = await request.json();
    } catch {
      return jsonResponse({ error: 'Body must be JSON.' }, 400);
    }

    if (payload.action === 'start') {
      return begin(request, payload.redirectTo ?? 'gamelog://steam-linked');
    }

    if (payload.action === 'unlink') {
      const userId = await userFromRequest(request);
      if (!userId) return jsonResponse({ error: 'Not signed in.' }, 401);
      return unlink(userId);
    }

    return jsonResponse({ error: `Unknown action "${payload.action}".` }, 400);
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : 'Unknown error';
    return jsonResponse({ error: message }, 500);
  }
});

/**
 * Forget everything synced from the account.
 *
 * The client could delete these rows itself — DELETE policies exist so an unlink
 * still works if this function is unavailable — but doing it here keeps
 * `profiles.steam_id` in step and guarantees the order.
 */
async function unlink(userId: string): Promise<Response> {
  const admin = adminClient();
  const tables = [
    'gaming_owned_games',
    'gaming_achievements',
    'gaming_inventory_items',
    'gaming_badges',
    'gaming_provider_friends',
    'gaming_sync_state',
    'gaming_accounts',
  ];

  for (const table of tables) {
    const { error } = await admin
      .from(table)
      .delete()
      .eq('user_id', userId)
      .eq('provider', 'steam');
    if (error) return jsonResponse({ error: `Failed clearing ${table}: ${error.message}` }, 500);
  }

  await admin.from('profiles').update({ steam_id: null }).eq('id', userId);

  return new Response(JSON.stringify({ ok: true }), {
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
