/**
 * SoundCloud, for a game's soundtrack: find it, list it, and hand the app's own
 * player something it can play.
 *
 * SoundCloud's public API authenticates an *application* with a client id and
 * secret. Like the Twitch secret behind `igdb`, the secret must never reach the
 * app bundle — anyone can unzip an APK — so the app asks this function and this
 * function holds it.
 *
 * Deploy:
 *   supabase secrets set SOUNDCLOUD_CLIENT_ID=xxx SOUNDCLOUD_CLIENT_SECRET=yyy --project-ref <ref>
 *   supabase functions deploy soundcloud --project-ref <ref> --use-api
 * and run migration 0036, which creates the two tables this writes.
 *
 * **Until the secrets are set it answers `{ "status": "unconfigured" }`** with a
 * 200, and the app says soundtracks are not connected yet. That is a state the
 * project was built to sit in, not an error.
 *
 * The app sends `POST /functions/v1/soundcloud` with one of:
 *
 *   { "action": "soundtrack", "gameId": "igdb:113112", "title": "Hades",
 *     "developer": "Supergiant Games" }
 *     → { "status": "ok", "source": "playlist" | "tracks", "playlist": {…} | null,
 *         "tracks": [ { urn, title, uploader, durationMs, artworkUrl,
 *                       permalinkUrl, access, plays } ] }
 *     → { "status": "none" }
 *
 *   { "action": "stream", "urn": "soundcloud:tracks:123" }
 *     → { "status": "ok", "url": "https://…m3u8…", "format": "hls" | "mp3",
 *         "preview": false, "needsAuth": false }
 *     → { "status": "blocked" } | { "status": "rate_limited", "resetAt": "…" }
 *
 *   { "action": "track", "urn": "soundcloud:tracks:123" }
 *     → { "status": "ok", "track": {…} } | { "status": "gone" }
 *
 * and, when a stream's answer says `"needsAuth": true`, the phone's audio
 * player sends `GET /functions/v1/soundcloud/hls/<urn>.m3u8?t=<ticket>` for
 * the address it was given.
 *
 * ## Only for signed-in people
 *
 * The anon key is a valid JWT and ships in the bundle, so on its own it would
 * make this a free SoundCloud relay on your quota for anybody who unzipped the
 * app. The caller must resolve to a real user. Same rule as `scandex`.
 *
 * The one request that carries no session is the audio player's, above. It
 * carries a ticket instead — signed here, for one track, for five minutes, and
 * only ever handed to a signed-in caller of `stream`. A player sends its
 * headers to every host it fetches from, SoundCloud's included, so it is given
 * the project's public key and never a listener's session.
 *
 * ## What is stored, and what never is
 *
 * SoundCloud's API terms forbid an app to "cache, download or persistently
 * store any User Content" — audio, titles, names, artwork — beyond the session.
 * So `soundcloud_matches` keeps **which upload is the match and nothing about
 * it**: a playlist's URN, or a list of track URNs. Every title and name the app
 * shows is fetched from SoundCloud when it is asked for, which also means an
 * upload its owner removes disappears from the app the next time anyone looks.
 * A stream address is resolved per play and stored nowhere.
 *
 * ## Tokens
 *
 * A token lasts about an hour, and new ones are rationed: 50 per 12 hours for
 * the app, 30 per hour per IP. So the token is kept in `soundcloud_tokens` and
 * shared by every instance of this function, and when it is near expiry it is
 * renewed with its `refresh_token` — which is single-use, so the row is written
 * with a compare-and-swap and the loser of a race reads the winner's. One
 * renewal and one fresh exchange per request at most; never a loop.
 *
 * ## Plays are rationed too
 *
 * 15,000 play-stream requests per 24 hours for the whole app. `stream` is the
 * only action that spends one, the app calls it only when somebody presses
 * play, and a 429 there is never retried: it is the day's quota, and the
 * answer carries when it resets.
 */
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2.58.0';

import { CORS_HEADERS, jsonResponse, preflight } from '../_shared/http.ts';
import {
  MATCHER_VERSION,
  MAX_TRACKS,
  choosePlaylist,
  matchTracks,
  playlistTracks,
  searchQueries,
  toTrack,
  type MatchGame,
  type MatchedTrack,
  type ScPlaylist,
  type ScTrack,
} from '../_shared/soundcloud-match.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';

const API = 'https://api.soundcloud.com';
const TOKEN_URL = 'https://secure.soundcloud.com/oauth/token';

/** Somebody is looking at a screen; do not hang on a slow third party. */
const TIMEOUT_MS = 8000;
/** A token this close to expiry is renewed before it is used. */
const TOKEN_MARGIN_MS = 5 * 60_000;

/** How long "this playlist is the soundtrack" stands before the search is run again. */
const FOUND_TTL_DAYS = 14;
/** Shorter for "nothing found": soundtracks get uploaded. */
const NONE_TTL_DAYS = 7;
/** A forced re-search is honoured only this long after the last one, so a retry button is not a tap. */
const REFRESH_FLOOR_MS = 10 * 60_000;

/** What a search may return: everything that can be heard. */
const HEARABLE = 'playable,preview';
/** What a chosen playlist is listed with: blocked tracks too, shown as unavailable. */
const EVERYTHING = 'playable,preview,blocked';

const URN = /^soundcloud:tracks:[A-Za-z0-9_-]{1,40}$/;
const GAME_ID = /^[a-z0-9_]+:[A-Za-z0-9_.-]{1,180}$/;

type Credentials = { id: string; secret: string };

type Token = { access_token: string; refresh_token: string | null; expires_at: string };

type Context = { admin: SupabaseClient; credentials: Credentials; token: string };

type MatchRow = {
  game_id: string;
  found: boolean;
  source: 'playlist' | 'tracks' | null;
  playlist_urn: string | null;
  track_urns: string[] | null;
  matcher_version: number;
  fetched_at: string;
};

/** A failure worth telling the app about, with the status to send it with. */
class SoundCloudError extends Error {
  readonly status: number;
  /** When a rate limit lifts, if SoundCloud said. */
  readonly resetAt: string | null;

  constructor(message: string, status: number, resetAt: string | null = null) {
    super(message);
    this.status = status;
    this.resetAt = resetAt;
  }
}

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

/** The token this instance last used. A warm instance skips the table. */
let warm: Token | null = null;

function usable(token: Token | null): token is Token {
  return !!token && new Date(token.expires_at).getTime() - Date.now() > TOKEN_MARGIN_MS;
}

async function requestToken(body: URLSearchParams, basic?: string): Promise<Token> {
  let response: Response;
  try {
    response = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        accept: 'application/json; charset=utf-8',
        'Content-Type': 'application/x-www-form-urlencoded',
        ...(basic ? { Authorization: `Basic ${basic}` } : {}),
      },
      body,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new SoundCloudError('Could not reach SoundCloud to sign in.', 504);
  }

  if (response.status === 429) {
    throw new SoundCloudError('SoundCloud is rationing new sign-ins. Try again later.', 503);
  }
  if (!response.ok) {
    throw new SoundCloudError(
      `SoundCloud refused the sign-in (${response.status}). Check SOUNDCLOUD_CLIENT_ID and SOUNDCLOUD_CLIENT_SECRET.`,
      response.status === 400 || response.status === 401 ? 500 : 502
    );
  }

  const data = (await response.json().catch(() => null)) as {
    access_token?: unknown;
    refresh_token?: unknown;
    expires_in?: unknown;
  } | null;
  if (typeof data?.access_token !== 'string') {
    throw new SoundCloudError('SoundCloud answered the sign-in with no token.', 502);
  }

  const seconds = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  return {
    access_token: data.access_token,
    refresh_token: typeof data.refresh_token === 'string' ? data.refresh_token : null,
    expires_at: new Date(Date.now() + seconds * 1000).toISOString(),
  };
}

async function storedToken(admin: SupabaseClient): Promise<Token | null> {
  const { data, error } = await admin
    .from('soundcloud_tokens')
    .select('access_token, refresh_token, expires_at')
    .eq('id', true)
    .maybeSingle<Token>();
  if (error) console.warn('[soundcloud] token read failed:', error.message);
  return data ?? null;
}

/**
 * A token to call the API with.
 *
 * `rejected` is the token SoundCloud has just answered 401 to: it is treated as
 * expired whatever its clock says, so the caller's one retry gets a new one.
 */
async function accessToken(
  admin: SupabaseClient,
  credentials: Credentials,
  rejected?: string
): Promise<string> {
  /* A plain boolean, not a type guard: a guard's "no" would tell the compiler
     the token is null, and an expired token still carries the refresh token
     that renews it. */
  const good = (token: Token | null): boolean =>
    usable(token) && token.access_token !== rejected;

  if (warm && good(warm)) return warm.access_token;

  const stored = await storedToken(admin);
  if (stored && good(stored)) {
    warm = stored;
    return stored.access_token;
  }

  if (stored?.refresh_token) {
    try {
      const renewed = await requestToken(
        new URLSearchParams({
          grant_type: 'refresh_token',
          client_id: credentials.id,
          client_secret: credentials.secret,
          refresh_token: stored.refresh_token,
        })
      );
      /* Compare-and-swap on the refresh token that was spent: only the
         instance that really spent it writes the row. */
      const swapped = await admin
        .from('soundcloud_tokens')
        .update({ ...renewed, updated_at: new Date().toISOString() })
        .eq('id', true)
        .eq('refresh_token', stored.refresh_token)
        .select('id');
      if (swapped.error) console.warn('[soundcloud] token write failed:', swapped.error.message);
      warm = renewed;
      return renewed.access_token;
    } catch {
      /* A refresh token is single-use. If another instance spent it a moment
         ago, its token is in the row now, and that is the one to use. */
      const theirs = await storedToken(admin);
      if (theirs && good(theirs) && theirs.access_token !== stored.access_token) {
        warm = theirs;
        return theirs.access_token;
      }
    }
  }

  const fresh = await requestToken(
    new URLSearchParams({ grant_type: 'client_credentials' }),
    btoa(`${credentials.id}:${credentials.secret}`)
  );
  const written = await admin
    .from('soundcloud_tokens')
    .upsert({ id: true, ...fresh, updated_at: new Date().toISOString() });
  if (written.error) console.warn('[soundcloud] token write failed:', written.error.message);
  warm = fresh;
  return fresh.access_token;
}

// ---------------------------------------------------------------------------
// Calling the API
// ---------------------------------------------------------------------------

function resetTime(body: unknown): string | null {
  const raw = (
    body as { errors?: { meta?: { reset_time?: unknown } }[] } | null
  )?.errors?.[0]?.meta?.reset_time;
  if (typeof raw !== 'string') return null;
  /* "2015/06/01 09:49:40 +0000" */
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * One request to SoundCloud, with the app's token.
 *
 * A 401 means the token died early: it is replaced once and the request sent
 * again. A 429 on a search is waited out twice, half a second and then a
 * second; a 429 on a play (`patient: false`) is the day's quota and is
 * reported at once.
 */
async function call(
  context: Context,
  url: string,
  options: { patient?: boolean; redirect?: RequestRedirect } = {}
): Promise<Response> {
  const { patient = true, redirect = 'follow' } = options;

  const send = async () => {
    try {
      return await fetch(url, {
        headers: {
          accept: 'application/json; charset=utf-8',
          Authorization: `OAuth ${context.token}`,
        },
        redirect,
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch (error) {
      throw new SoundCloudError(
        error instanceof Error && error.name === 'TimeoutError'
          ? 'SoundCloud took too long to answer.'
          : 'Could not reach SoundCloud.',
        504
      );
    }
  };

  let response = await send();

  if (response.status === 401) {
    context.token = await accessToken(context.admin, context.credentials, context.token);
    response = await send();
  }

  for (const wait of patient ? [500, 1000] : []) {
    if (response.status !== 429) break;
    await new Promise((resolve) => setTimeout(resolve, wait));
    response = await send();
  }

  if (response.status === 429) {
    const body = await response.json().catch(() => null);
    throw new SoundCloudError('SoundCloud is limiting requests right now.', 429, resetTime(body));
  }
  return response;
}

function endpoint(path: string, params: Record<string, string> = {}): string {
  const query = new URLSearchParams(params).toString();
  return `${API}${path}${query ? `?${query}` : ''}`;
}

async function json<T>(context: Context, url: string): Promise<T | null> {
  const response = await call(context, url);
  if (response.status === 404) return null;
  if (!response.ok) throw new SoundCloudError(`SoundCloud answered ${response.status}.`, 502);
  return (await response.json().catch(() => null)) as T | null;
}

/** A list endpoint answers a bare array, or `{ collection, next_href }` when paginated. */
type Page<T> = T[] | { collection?: T[] | null; next_href?: string | null } | null;

function items<T>(page: Page<T>): T[] {
  if (Array.isArray(page)) return page;
  return page?.collection ?? [];
}

function nextOf<T>(page: Page<T>): string | null {
  if (!page || Array.isArray(page)) return null;
  const next = page.next_href;
  /* Only SoundCloud's own API: this address is followed with the app's token. */
  return typeof next === 'string' && next.startsWith(`${API}/`) ? next : null;
}

async function searchPlaylists(context: Context, q: string): Promise<ScPlaylist[]> {
  const page = await json<Page<ScPlaylist>>(
    context,
    endpoint('/playlists', {
      q,
      show_tracks: 'false',
      access: HEARABLE,
      limit: '50',
      linked_partitioning: 'true',
    })
  );
  return items(page);
}

async function searchTracks(context: Context, q: string, tag?: string): Promise<ScTrack[]> {
  const page = await json<Page<ScTrack>>(
    context,
    endpoint('/tracks', {
      q,
      ...(tag ? { tags: tag } : {}),
      access: HEARABLE,
      limit: '50',
      linked_partitioning: 'true',
    })
  );
  return items(page);
}

/** A playlist's tracks, following `next_href` until it is absent or there are enough. */
async function tracksOfPlaylist(context: Context, urn: string): Promise<ScTrack[] | null> {
  let url: string | null = endpoint(`/playlists/${encodeURIComponent(urn)}/tracks`, {
    access: EVERYTHING,
    limit: '200',
    linked_partitioning: 'true',
  });
  const tracks: ScTrack[] = [];

  while (url && tracks.length < MAX_TRACKS) {
    const response = await call(context, url);
    if (response.status === 404) return null;
    if (!response.ok) throw new SoundCloudError(`SoundCloud answered ${response.status}.`, 502);
    const page = (await response.json().catch(() => null)) as Page<ScTrack>;
    tracks.push(...items(page));
    url = nextOf(page);
  }
  return tracks;
}

async function tracksByUrn(context: Context, urns: string[]): Promise<ScTrack[]> {
  const found = new Map<string, ScTrack>();
  for (let start = 0; start < urns.length; start += 50) {
    const page = await json<Page<ScTrack>>(
      context,
      endpoint('/tracks', {
        urns: urns.slice(start, start + 50).join(','),
        access: EVERYTHING,
        limit: '200',
        linked_partitioning: 'true',
      })
    );
    for (const track of items(page)) if (track.urn) found.set(track.urn, track);
  }
  /* In the order they were matched, not the order SoundCloud returned them. */
  return urns.map((urn) => found.get(urn)).filter((track): track is ScTrack => !!track);
}

// ---------------------------------------------------------------------------
// A game's soundtrack
// ---------------------------------------------------------------------------

type PlaylistCredit = {
  urn: string;
  title: string;
  permalinkUrl: string | null;
  uploader: { name: string; permalinkUrl: string | null };
};

type Soundtrack =
  | { status: 'ok'; source: 'playlist'; playlist: PlaylistCredit; tracks: MatchedTrack[] }
  | { status: 'ok'; source: 'tracks'; playlist: null; tracks: MatchedTrack[] }
  | { status: 'none' };

function credit(playlist: ScPlaylist): PlaylistCredit {
  return {
    urn: playlist.urn ?? '',
    title: playlist.title?.trim() || 'Soundtrack',
    permalinkUrl: playlist.permalink_url ?? null,
    uploader: {
      name: playlist.user?.username?.trim() || 'Unknown uploader',
      permalinkUrl: playlist.user?.permalink_url ?? null,
    },
  };
}

function isFresh(row: MatchRow, refresh: boolean): boolean {
  const age = Date.now() - new Date(row.fetched_at).getTime();
  if (row.matcher_version !== MATCHER_VERSION) return false;
  if (refresh && age > REFRESH_FLOOR_MS) return false;
  return age < (row.found ? FOUND_TTL_DAYS : NONE_TTL_DAYS) * 24 * 60 * 60_000;
}

/** What a stored match is *now*: its tracks as SoundCloud has them today, or null if it is gone. */
async function fromStored(
  context: Context,
  row: MatchRow,
  game: MatchGame
): Promise<Soundtrack | null> {
  if (!row.found) return { status: 'none' };

  if (row.source === 'playlist' && row.playlist_urn) {
    const [playlist, tracks] = await Promise.all([
      json<ScPlaylist>(
        context,
        endpoint(`/playlists/${encodeURIComponent(row.playlist_urn)}`, { show_tracks: 'false' })
      ),
      tracksOfPlaylist(context, row.playlist_urn),
    ]);
    if (!playlist || !tracks) return null;
    const listed = playlistTracks(tracks, game);
    if (listed.length === 0) return null;
    return { status: 'ok', source: 'playlist', playlist: credit(playlist), tracks: listed };
  }

  if (row.source === 'tracks' && row.track_urns?.length) {
    const tracks = (await tracksByUrn(context, row.track_urns))
      .map(toTrack)
      .filter((track): track is MatchedTrack => track !== null && track.access !== 'blocked');
    /* Fewer than were matched is fine; too few to be a soundtrack is not. */
    if (tracks.length < 3) return null;
    return { status: 'ok', source: 'tracks', playlist: null, tracks };
  }

  return null;
}

/** Ask SoundCloud, judge what comes back, and remember which upload won. */
async function search(context: Context, gameId: string, game: MatchGame): Promise<Soundtrack> {
  const queries = searchQueries(game.title);

  const [playlistResults, trackResults] = await Promise.all([
    Promise.allSettled(queries.playlists.map((q) => searchPlaylists(context, q))),
    Promise.allSettled([
      ...queries.taggedTracks.map(({ q, tag }) => searchTracks(context, q, tag)),
      ...queries.tracks.map((q) => searchTracks(context, q)),
    ]),
  ]);

  const settled = [...playlistResults, ...trackResults];
  /* Every search failed: that is an outage, not "no soundtrack", and it must
     not be stored as one. */
  const failure = settled.find((result) => result.status === 'rejected');
  if (failure && settled.every((result) => result.status === 'rejected')) {
    throw (failure as PromiseRejectedResult).reason;
  }

  const fulfilled = <T>(results: PromiseSettledResult<T[]>[]) =>
    results.flatMap((result) => (result.status === 'fulfilled' ? result.value : []));

  let answer: Soundtrack = { status: 'none' };
  let stored: Pick<MatchRow, 'found' | 'source' | 'playlist_urn' | 'track_urns'> = {
    found: false,
    source: null,
    playlist_urn: null,
    track_urns: null,
  };

  const playlist = choosePlaylist(fulfilled(playlistResults), game);
  const inPlaylist = playlist?.urn ? await tracksOfPlaylist(context, playlist.urn) : null;
  const listed = inPlaylist ? playlistTracks(inPlaylist, game) : [];

  if (playlist?.urn && listed.length > 0) {
    answer = { status: 'ok', source: 'playlist', playlist: credit(playlist), tracks: listed };
    stored = { found: true, source: 'playlist', playlist_urn: playlist.urn, track_urns: null };
  } else {
    const matched = matchTracks(fulfilled(trackResults), game);
    if (matched.length > 0) {
      answer = { status: 'ok', source: 'tracks', playlist: null, tracks: matched };
      stored = {
        found: true,
        source: 'tracks',
        playlist_urn: null,
        track_urns: matched.map((track) => track.urn),
      };
    }
  }

  /* Identifiers only — see "What is stored" above. Best-effort: a cache that
     cannot be written is a slower feature, not a broken one. */
  const written = await context.admin.from('soundcloud_matches').upsert({
    game_id: gameId,
    ...stored,
    matcher_version: MATCHER_VERSION,
    fetched_at: new Date().toISOString(),
  });
  if (written.error) console.warn('[soundcloud] match write failed:', written.error.message);

  return answer;
}

async function soundtrack(context: Context, body: Record<string, unknown>): Promise<Response> {
  const gameId = typeof body.gameId === 'string' ? body.gameId.trim() : '';
  const title = typeof body.title === 'string' ? body.title.trim() : '';
  if (!GAME_ID.test(gameId)) return jsonResponse({ error: 'That is not a game id.' }, 400);
  if (title.length < 1 || title.length > 200) {
    return jsonResponse({ error: 'A game title is required.' }, 400);
  }
  const game: MatchGame = {
    title,
    developer: typeof body.developer === 'string' ? body.developer.slice(0, 200) : null,
  };

  const cached = await context.admin
    .from('soundcloud_matches')
    .select('game_id, found, source, playlist_urn, track_urns, matcher_version, fetched_at')
    .eq('game_id', gameId)
    .maybeSingle<MatchRow>();
  if (cached.error) console.warn('[soundcloud] match read failed:', cached.error.message);

  if (cached.data && isFresh(cached.data, body.refresh === true)) {
    const live = await fromStored(context, cached.data, game);
    /* Null: the upload that was the match has gone. Look again. */
    if (live) return jsonResponse(live);
  }

  return jsonResponse(await search(context, gameId, game));
}

// ---------------------------------------------------------------------------
// One track
// ---------------------------------------------------------------------------

async function oneTrack(context: Context, body: Record<string, unknown>): Promise<Response> {
  const urn = typeof body.urn === 'string' ? body.urn : '';
  if (!URN.test(urn)) return jsonResponse({ error: 'That is not a SoundCloud track.' }, 400);

  const raw = await json<ScTrack>(context, endpoint(`/tracks/${encodeURIComponent(urn)}`));
  const track = raw ? toTrack(raw) : null;
  return jsonResponse(track ? { status: 'ok', track } : { status: 'gone' });
}

// ---------------------------------------------------------------------------
// Playing
// ---------------------------------------------------------------------------

type Streams = {
  hls_aac_160_url?: string | null;
  hls_mp3_128_url?: string | null;
  preview_mp3_128_url?: string | null;
};

type Chosen = { url: string; format: 'hls' | 'mp3'; preview: boolean };

/** Which of a track's transcodings to play: the full one in AAC, else MP3, else its preview. */
async function chooseStream(context: Context, urn: string): Promise<Chosen | 'blocked'> {
  const response = await call(context, endpoint(`/tracks/${encodeURIComponent(urn)}/streams`), {
    patient: false,
  });
  /* A blocked track has no streams: SoundCloud answers with an error. */
  if (response.status === 403 || response.status === 404) return 'blocked';
  if (!response.ok) throw new SoundCloudError(`SoundCloud answered ${response.status}.`, 502);

  const streams = (await response.json().catch(() => null)) as Streams | null;
  if (streams?.hls_aac_160_url) return { url: streams.hls_aac_160_url, format: 'hls', preview: false };
  if (streams?.hls_mp3_128_url) return { url: streams.hls_mp3_128_url, format: 'hls', preview: false };
  if (streams?.preview_mp3_128_url) {
    return { url: streams.preview_mp3_128_url, format: 'mp3', preview: true };
  }
  return 'blocked';
}

/* ---------------------------------------------------------------------------
 * The relay's ticket
 *
 * The relay (below) is fetched by the phone's audio player, not by the app's
 * code, and whatever header the player is given it sends with *every* request
 * for that track — the playlist here, and then each media segment on
 * SoundCloud's own host. So the player must never be given the listener's
 * session: it would be handed to a third party a hundred times a song.
 *
 * Instead the address itself carries a ticket: when a signed-in listener asks
 * to play a track (`stream`), this function signs "this track, until this
 * minute" with a key only it holds, and the relay honours that signature and
 * nothing else. The only header the player sends is the project's public key,
 * which Supabase's gateway asks of every request and which is no secret.
 * ------------------------------------------------------------------------ */

/** How long a ticket stands. A player reads a track's playlist once, as it starts. */
const TICKET_TTL_MS = 5 * 60_000;

function base64url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function sign(secret: string, message: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  return base64url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(message))));
}

/** Compared in full whatever the first difference, so the time taken says nothing. */
function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let index = 0; index < a.length; index += 1) {
    difference |= a.charCodeAt(index) ^ b.charCodeAt(index);
  }
  return difference === 0;
}

async function ticketFor(secret: string, urn: string): Promise<string> {
  const expires = Date.now() + TICKET_TTL_MS;
  return `${expires}.${await sign(secret, `relay:${urn}:${expires}`)}`;
}

async function ticketStands(secret: string, urn: string, ticket: string | null): Promise<boolean> {
  const [expiresText, mac] = (ticket ?? '').split('.');
  const expires = Number(expiresText);
  if (!mac || !Number.isFinite(expires) || expires < Date.now()) return false;
  return sameText(await sign(secret, `relay:${urn}:${expires}`), mac);
}

function relayUrl(urn: string, ticket: string): string {
  const base = `${Deno.env.get('SUPABASE_URL')}/functions/v1/soundcloud/hls`;
  return `${base}/${encodeURIComponent(urn)}.m3u8?t=${encodeURIComponent(ticket)}`;
}

/**
 * A playlist `stream` has already fetched, held for the relay request that
 * follows it a moment later — so a relayed play asks SoundCloud once, not
 * twice. In this instance's memory, for the life of a ticket, and gone on a
 * cold start: a hand-off between two halves of one play, not a cache.
 */
const handoffs = new Map<string, { text: string; expires: number }>();
const MAX_HANDOFFS = 100;

function keepForRelay(ticket: string, text: string) {
  const now = Date.now();
  for (const [key, held] of handoffs) if (held.expires < now) handoffs.delete(key);
  if (handoffs.size >= MAX_HANDOFFS) {
    const oldest = handoffs.keys().next().value;
    if (oldest !== undefined) handoffs.delete(oldest);
  }
  handoffs.set(ticket, { text, expires: now + TICKET_TTL_MS });
}

function playlistResponse(text: string): Response {
  return new Response(text, {
    status: 200,
    headers: {
      ...CORS_HEADERS,
      'Content-Type': 'application/vnd.apple.mpegurl',
      'Cache-Control': 'no-store',
    },
  });
}

/** A playlist with every relative address made absolute: it is about to be served from here. */
function absolutePlaylist(text: string, base: string): string {
  const absolute = (value: string) => {
    try {
      return new URL(value, base).toString();
    } catch {
      return value;
    }
  };
  return text
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        return line.replace(/URI="([^"]+)"/g, (_match, uri: string) => `URI="${absolute(uri)}"`);
      }
      return absolute(trimmed);
    })
    .join('\n');
}

/** Android's player knows a stream is HLS by its address ending `.m3u8`, and by nothing else. */
function looksLikeHls(url: string): boolean {
  try {
    return new URL(url).pathname.toLowerCase().endsWith('.m3u8');
  } catch {
    return false;
  }
}

/**
 * Something the app's player can open.
 *
 * The addresses `/streams` returns need the app's token, which must not reach
 * a phone. Requested with it, SoundCloud is expected to redirect to a signed
 * address on its media host that needs no token — that address is what the
 * player is given.
 *
 * **Which of the two it does could not be checked when this was written — the
 * project had no credentials.** So the other case is handled too: if the
 * answer is the playlist itself — or a redirect to an address Android's player
 * would not recognise as HLS — the player is pointed at this function's own
 * `…/hls/<urn>.m3u8?t=<ticket>`, which serves that text (`relay`, below).
 * `needsAuth` tells the app to send the project's *public* key with the
 * request, never the listener's session; see the note on tickets above.
 */
async function stream(context: Context, body: Record<string, unknown>): Promise<Response> {
  const urn = typeof body.urn === 'string' ? body.urn : '';
  if (!URN.test(urn)) return jsonResponse({ error: 'That is not a SoundCloud track.' }, 400);

  const chosen = await chooseStream(context, urn);
  if (chosen === 'blocked') return jsonResponse({ status: 'blocked' });

  const response = await call(context, chosen.url, { patient: false, redirect: 'manual' });
  const location = response.headers.get('location');

  const viaRelay = async (text: string | null) => {
    const ticket = await ticketFor(context.credentials.secret, urn);
    if (text) keepForRelay(ticket, text);
    return jsonResponse({
      status: 'ok',
      url: relayUrl(urn, ticket),
      format: 'hls',
      preview: chosen.preview,
      needsAuth: true,
    });
  };

  if (response.status >= 300 && response.status < 400 && location) {
    const direct = new URL(location, chosen.url).toString();
    await response.body?.cancel();
    if (chosen.format === 'hls' && !looksLikeHls(direct)) return viaRelay(null);
    return jsonResponse({
      status: 'ok',
      url: direct,
      format: chosen.format,
      preview: chosen.preview,
      needsAuth: false,
    });
  }

  const type = response.headers.get('content-type') ?? '';
  if (response.ok && chosen.format === 'hls' && /mpegurl/i.test(type)) {
    return viaRelay(absolutePlaylist(await response.text(), response.url || chosen.url));
  }

  await response.body?.cancel();
  /* Audio served straight from the API under the app's token. Relaying that
     would put every byte of the track through this function; it is not done. */
  throw new SoundCloudError('SoundCloud did not offer a stream the app can open.', 502);
}

/**
 * An HLS playlist, passed through.
 *
 * Only the playlist — a few hundred bytes of text naming the media segments.
 * The audio itself is fetched by the player from SoundCloud's own host. Lines
 * that are relative addresses are made absolute, since they would otherwise
 * resolve against this function.
 *
 * Reached with a ticket and no session (see above), and only when this
 * instance no longer holds the playlist `stream` fetched — a cold start between
 * the two requests. Asking again spends a second play on the track, which is
 * why the hand-off exists.
 */
async function relay(context: Context, urn: string): Promise<Response> {
  const chosen = await chooseStream(context, urn);
  if (chosen === 'blocked' || chosen.format !== 'hls') {
    return new Response('Not available', { status: 404, headers: CORS_HEADERS });
  }

  const response = await call(context, chosen.url, { patient: false });
  if (!response.ok) return new Response('Not available', { status: 502, headers: CORS_HEADERS });

  return playlistResponse(absolutePlaylist(await response.text(), response.url || chosen.url));
}

// ---------------------------------------------------------------------------

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();

  const relayed = /\/hls\/([^/]+)\.m3u8$/.exec(new URL(request.url).pathname);
  if (request.method !== 'POST' && !(request.method === 'GET' && relayed)) {
    return jsonResponse({ error: 'Use POST.' }, 405);
  }

  const id = Deno.env.get('SOUNDCLOUD_CLIENT_ID')?.trim();
  const secret = Deno.env.get('SOUNDCLOUD_CLIENT_SECRET')?.trim();
  if (!id || !secret) {
    /* Not an error: the feature is built ahead of its credentials. */
    return relayed
      ? new Response('Not connected', { status: 503, headers: CORS_HEADERS })
      : jsonResponse({ status: 'unconfigured' });
  }

  /*
   * Who is asking. Everything the app's own code sends carries a session, and
   * the anon key — a valid JWT, and in every copy of the app — is refused, so
   * the app's quota is spent only by people who are signed in. The relay is
   * the exception: the audio player fetches it, with a ticket this function
   * signed for one track a few minutes ago, and no session at all.
   */
  const relayedUrn = relayed ? decodeURIComponent(relayed[1]) : null;
  const ticket = relayed ? new URL(request.url).searchParams.get('t') : null;

  if (relayedUrn !== null) {
    if (!URN.test(relayedUrn) || !(await ticketStands(secret, relayedUrn, ticket))) {
      return new Response('Not found', { status: 404, headers: CORS_HEADERS });
    }
    /* The usual case: `stream` fetched this playlist seconds ago and left it
       here. Served without a word to SoundCloud, or to the token table. */
    const held = handoffs.get(ticket ?? '');
    if (held && held.expires >= Date.now()) return playlistResponse(held.text);
  } else if (!(await userFromRequest(request))) {
    return jsonResponse({ error: 'Sign in to listen to soundtracks.' }, 401);
  }

  try {
    const admin = adminClient();
    const credentials = { id, secret };
    const context: Context = {
      admin,
      credentials,
      token: await accessToken(admin, credentials),
    };

    if (relayedUrn !== null) return await relay(context, relayedUrn);

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: 'Body must be JSON.' }, 400);
    }

    switch (body.action) {
      case 'soundtrack':
        return await soundtrack(context, body);
      case 'stream':
        return await stream(context, body);
      case 'track':
        return await oneTrack(context, body);
      default:
        return jsonResponse({ error: 'Unknown action.' }, 400);
    }
  } catch (error) {
    if (error instanceof SoundCloudError && error.status === 429) {
      /* A state the app shows calmly, with when it lifts — not a failure. */
      return jsonResponse({ status: 'rate_limited', resetAt: error.resetAt });
    }
    const status = error instanceof SoundCloudError ? error.status : 502;
    const message = error instanceof Error ? error.message : 'SoundCloud request failed.';
    // The token and the secret are never logged.
    console.warn('[soundcloud] failed:', message);
    return jsonResponse({ error: message }, status);
  }
});
