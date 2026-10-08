import { supabase } from '../supabase';
import type {
  GameSoundtrack,
  SoundCloudTrack,
  SoundtrackLookup,
  StreamAnswer,
  TrackLookup,
} from './types';

/**
 * SoundCloud, through the `soundcloud` Edge Function.
 *
 * The function holds the API secret and does the searching and judging
 * (`supabase/functions/_shared/soundcloud-match.ts`); this is the three
 * questions the app asks it.
 *
 * ## Nothing here may outlive the session
 *
 * SoundCloud's API terms forbid an app to "cache, download or persistently
 * store any User Content" — titles, names, artwork, audio. So:
 *
 *  - There is **no device mirror and no shared table of track lists**, both of
 *    which the Apple Music version had. The only thing kept anywhere is which
 *    upload matched, as an id, on the server.
 *  - Every query that holds an answer from here is in `NEVER_PERSIST`
 *    (`lib/query-persist-rules.ts`): the app saves its query cache to the
 *    device between launches, and these must not be in it. A new query key that
 *    holds SoundCloud data goes in that list.
 *  - A stream address is asked for when Play is pressed and handed straight to
 *    the player. It is never put in a query.
 *
 * ## "Not connected" is an answer, not an error
 *
 * The feature was built before the project had SoundCloud credentials. A
 * function that is not deployed (404) and one deployed without its secrets
 * (`{ status: 'unconfigured' }`) both come back as `unconfigured`, and the
 * screens say soundtracks are not connected yet. Only a request that really
 * failed throws.
 */

type Answer = Record<string, unknown> & { status?: string; error?: string };

async function ask(body: Record<string, unknown>, signal?: AbortSignal): Promise<Answer> {
  const { data, error } = await supabase.functions.invoke('soundcloud', { body, signal });

  if (error) {
    /* supabase-js hands a non-2xx response back on `error.context`. */
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      if (context.status === 404) return { status: 'unconfigured' };
      const answer = (await context.json().catch(() => null)) as Answer | null;
      throw new Error(answer?.error || 'SoundCloud could not be reached.');
    }
    throw new Error('SoundCloud could not be reached.');
  }

  const answer = (data ?? {}) as Answer;
  if (typeof answer.error === 'string') throw new Error(answer.error);
  return answer;
}

/**
 * Sample data, in development only, so the screens can be looked at before the
 * project has SoundCloud credentials.
 *
 * Off unless `EXPO_PUBLIC_SOUNDCLOUD_FIXTURE=true` **and** this is a dev build:
 * a release build can never show it. Every name says it is a sample, nothing in
 * it is a real upload, and it cannot be played — pressing play reports that
 * SoundCloud is not connected, which is true.
 */
const FIXTURE = __DEV__ && process.env.EXPO_PUBLIC_SOUNDCLOUD_FIXTURE === 'true';

function fixtureSoundtrack(title: string): GameSoundtrack {
  const uploader = { name: 'Sample uploader', permalinkUrl: null };
  const lengths = [184, 221, 95, 312, 148, 267, 203, 176, 240, 132];
  return {
    source: 'playlist',
    playlist: {
      urn: 'soundcloud:playlists:0',
      title: `${title} (sample soundtrack)`,
      permalinkUrl: null,
      uploader,
    },
    tracks: lengths.map((seconds, index) => ({
      urn: `soundcloud:tracks:${index + 1}`,
      title: `Sample track ${index + 1}`,
      uploader,
      durationMs: seconds * 1000,
      artworkUrl: null,
      permalinkUrl: null,
      access: index === 7 ? 'preview' : index === 9 ? 'blocked' : 'playable',
      plays: 1000 * (lengths.length - index),
    })),
  };
}

export type SoundtrackRequest = {
  /** The app-wide game id, which the server files the match under. */
  gameId: string;
  title: string;
  /** Whose uploads count as official. */
  developer?: string | null;
  /** Search again, past a stored "nothing found". Honoured at most every ten minutes. */
  refresh?: boolean;
  signal?: AbortSignal;
};

/** A game's soundtrack on SoundCloud: one uploader's playlist, or matching tracks. */
export async function getGameSoundtrack({
  gameId,
  title,
  developer,
  refresh,
  signal,
}: SoundtrackRequest): Promise<SoundtrackLookup> {
  if (FIXTURE) return { status: 'ok', soundtrack: fixtureSoundtrack(title) };

  const answer = await ask(
    { action: 'soundtrack', gameId, title, developer: developer ?? null, refresh: !!refresh },
    signal
  );

  switch (answer.status) {
    case 'ok':
      return {
        status: 'ok',
        soundtrack: {
          source: answer.source === 'tracks' ? 'tracks' : 'playlist',
          playlist: (answer.playlist as GameSoundtrack['playlist']) ?? null,
          tracks: (answer.tracks as SoundCloudTrack[]) ?? [],
        },
      };
    case 'none':
      return { status: 'none' };
    case 'rate_limited':
      return { status: 'rate_limited', resetAt: (answer.resetAt as string | null) ?? null };
    case 'unconfigured':
      return { status: 'unconfigured' };
    default:
      throw new Error('SoundCloud answered in a way this app does not understand.');
  }
}

/**
 * What the audio player sends when the address it was given is this app's own
 * relay rather than SoundCloud's media host.
 *
 * **The project's public key, and never the listener's session.** A native
 * player sends the headers it is given with every request for that track —
 * the playlist on our function, and then each segment of audio on SoundCloud's
 * host. A session there would be handed to a third party a hundred times a
 * song. The public key is what Supabase's gateway asks of any request and is in
 * every copy of the app already; who may play is settled by the ticket the
 * function signed into the address itself.
 */
function relayHeaders(): Record<string, string> | undefined {
  const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
  return key ? { apikey: key, Authorization: `Bearer ${key}` } : undefined;
}

/**
 * An address the player can open for one track, asked for when Play is pressed.
 *
 * Each call spends one of the app's 15,000 daily plays, so nothing may call
 * this to warm up, preload or peek. The address is short-lived and is never
 * stored.
 */
export async function resolveStream(urn: string): Promise<StreamAnswer> {
  if (FIXTURE) return { status: 'unconfigured' };

  const answer = await ask({ action: 'stream', urn });

  switch (answer.status) {
    case 'ok': {
      const url = typeof answer.url === 'string' ? answer.url : '';
      if (!url) throw new Error('SoundCloud did not return a stream.');
      return {
        status: 'ok',
        url,
        headers: answer.needsAuth === true ? relayHeaders() : undefined,
        preview: answer.preview === true,
      };
    }
    case 'blocked':
      return { status: 'blocked' };
    case 'rate_limited':
      return { status: 'rate_limited', resetAt: (answer.resetAt as string | null) ?? null };
    case 'unconfigured':
      return { status: 'unconfigured' };
    default:
      throw new Error('SoundCloud answered in a way this app does not understand.');
  }
}

/** One track as SoundCloud has it now — for a starred song, which stores only its id. */
export async function getSoundCloudTrack(urn: string, signal?: AbortSignal): Promise<TrackLookup> {
  if (FIXTURE) {
    const sample = fixtureSoundtrack('Sample game').tracks.find((track) => track.urn === urn);
    return sample ? { status: 'ok', track: sample } : { status: 'gone' };
  }

  const answer = await ask({ action: 'track', urn }, signal);
  if (answer.status === 'ok' && answer.track) {
    return { status: 'ok', track: answer.track as SoundCloudTrack };
  }
  if (answer.status === 'unconfigured') return { status: 'unconfigured' };
  return { status: 'gone' };
}

/** Whether an id is a SoundCloud track's. A starred song from before 0036 is not. */
export function isSoundCloudUrn(value: string | null | undefined): value is string {
  return typeof value === 'string' && /^soundcloud:tracks:[A-Za-z0-9_-]+$/.test(value);
}
