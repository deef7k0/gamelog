/**
 * A game's soundtrack on SoundCloud, as the app holds it.
 *
 * These are the shapes the `soundcloud` Edge Function answers with. None of it
 * may be kept past the session — see `lib/soundcloud/api.ts`.
 */

/** How much of a track this app is allowed to play. */
export type TrackAccess = 'playable' | 'preview' | 'blocked';

/** Whoever uploaded a track or a playlist: the creator the app must credit. */
export type Uploader = {
  name: string;
  /** Their page on soundcloud.com. */
  permalinkUrl: string | null;
};

export type SoundCloudTrack = {
  /** `soundcloud:tracks:123` — the only thing about a track the app may store. */
  urn: string;
  title: string;
  uploader: Uploader;
  /** Milliseconds, or null when SoundCloud did not say. */
  durationMs: number | null;
  artworkUrl: string | null;
  /** The track's own page on soundcloud.com, which every row links back to. */
  permalinkUrl: string | null;
  access: TrackAccess;
  /** Play count, or null when the uploader hides it. Ranks Surprise Me's "popular". */
  plays: number | null;
};

/** The playlist a soundtrack was taken from, for its credit line. */
export type SoundtrackCredit = {
  urn: string;
  title: string;
  permalinkUrl: string | null;
  uploader: Uploader;
};

export type GameSoundtrack = {
  /**
   * `playlist`: one uploader's playlist, in their order. `tracks`: no playlist
   * was convincing, so these are matching uploads found by search, most played
   * first — possibly from several accounts.
   */
  source: 'playlist' | 'tracks';
  playlist: SoundtrackCredit | null;
  tracks: SoundCloudTrack[];
};

/**
 * What asking for a soundtrack can come back as.
 *
 * Four answers that are not errors. `unconfigured` is the one this feature was
 * built to sit in: the function is not deployed, or its SoundCloud keys are not
 * set yet. A thrown error is reserved for a request that genuinely failed and
 * is worth retrying.
 */
export type SoundtrackLookup =
  | { status: 'ok'; soundtrack: GameSoundtrack }
  | { status: 'none' }
  | { status: 'unconfigured' }
  | { status: 'rate_limited'; resetAt: string | null };

/** Something the player can open, or why there is nothing to open. */
export type StreamAnswer =
  | {
      status: 'ok';
      url: string;
      /**
       * Sent with the request when the address is this app's own relay: the
       * project's public key. Never a session — see `relayHeaders`.
       */
      headers?: Record<string, string>;
      /** True when SoundCloud allows only a snippet of this track. */
      preview: boolean;
    }
  | { status: 'blocked' }
  | { status: 'unconfigured' }
  | { status: 'rate_limited'; resetAt: string | null };

export type TrackLookup =
  { status: 'ok'; track: SoundCloudTrack } | { status: 'gone' } | { status: 'unconfigured' };
