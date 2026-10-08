import AsyncStorage from '@react-native-async-storage/async-storage';
import { setAudioModeAsync, type AudioPlayer, type AudioStatus } from 'expo-audio';
import { create } from 'zustand';

import {
  RESTART_AFTER_SECONDS,
  limitLiftsAt,
  nextPlayable,
  phaseOf,
  previousPlayable,
  type PlayerNotice,
  type PlayerPhase,
} from '@/lib/player-queue';
import { resolveStream } from '@/lib/soundcloud/api';
import type { SoundCloudTrack, StreamAnswer } from '@/lib/soundcloud/types';

/**
 * The app's one music player.
 *
 * There were three: the soundtrack screen, Surprise Me and the starred song on
 * a profile each made an audio object of their own, so two songs could play at
 * once and nothing could outlive the screen it started on. This is the only
 * one now. `<PlayerHost>` (in the root layout) owns the native audio object and
 * hands it here; everything that plays music asks this module to.
 *
 * ## What is state and what is not
 *
 * The store holds what a screen draws: the queue, which track, whether it is
 * loading or playing, how far in, and anything that went wrong. The commands
 * are plain functions on `player` — they are not in the store, because nothing
 * renders them and a component that only presses Play should not re-render
 * four times a second with the position.
 *
 * ## A stream is asked for when Play is pressed, and at no other time
 *
 * Each `resolveStream` spends one of the app's 15,000 daily plays on
 * SoundCloud. Nothing here preloads the next track, warms a stream on mount or
 * retries by itself. The address is handed to the audio object and forgotten.
 *
 * ## Nothing here is kept
 *
 * The queue holds SoundCloud's titles, names and artwork addresses, which the
 * API's terms forbid an app to store. It lives in memory, is emptied on stop
 * and on a change of account, and is never written anywhere. The one thing
 * saved to the device is the "Keep playing" switch, which is this app's own
 * preference and says nothing about any track.
 */

export type PlayerQueue = {
  /**
   * Who started it: `soundtrack:<gameId>`, `surprise:<gameId>` or
   * `starred:<profileId>`. A screen stops the music on its way out only while
   * the queue is still its own — see `player.release`.
   */
  owner: string;
  /** The game whose soundtrack screen the mini player opens, when there is one. */
  gameId: string | null;
  gameTitle: string | null;
  tracks: SoundCloudTrack[];
};

type PlayerState = {
  queue: PlayerQueue | null;
  index: number;
  phase: PlayerPhase;
  /** About the track at `index`. Cleared whenever another is loaded. */
  notice: PlayerNotice | null;
  /** SoundCloud allows only a snippet of the track now playing. */
  preview: boolean;
  /** Seconds. */
  position: number;
  /** Seconds. The stream's own once it reports one; the track's listed length until then. */
  duration: number;
  /**
   * The owner's switch: carry on when the soundtrack screen is left, with a
   * bar at the foot of the app. Off by default — leaving stops the music.
   */
  keepPlaying: boolean;
};

const IDLE = {
  queue: null,
  index: 0,
  phase: 'idle',
  notice: null,
  preview: false,
  position: 0,
  duration: 0,
} satisfies Partial<PlayerState>;

export type { PlayerNotice, PlayerPhase };

export const usePlayer = create<PlayerState>(() => ({ ...IDLE, keepPlaying: false }));

const KEEP_PLAYING_KEY = 'gamelog:player:keep-playing:v1';

void AsyncStorage.getItem(KEEP_PLAYING_KEY)
  .then((stored) => {
    if (stored === '1') usePlayer.setState({ keepPlaying: true });
  })
  .catch(() => {
    /* A preference that cannot be read is the default. */
  });

/* ---------------------------------------------------------------------------
 * The audio object, and what was last asked of it. Module state, not store
 * state: none of it is drawn.
 * ------------------------------------------------------------------------ */

/** The native player, while `<PlayerHost>` is mounted. */
let audio: AudioPlayer | null = null;
/** Bumped by every load and every stop. An answer for an older ticket is dropped. */
let ticket = 0;
/** The ticket whose stream is being asked for, so the status of the track before it is ignored. */
let resolvingTicket = -1;
/** What was last asked for: sound, or silence. See `phaseOf`. */
let wantsPlay = false;
/** The track the audio object is holding. */
let loadedUrn: string | null = null;
/** The loaded track has played to its end; playing it again starts from the top. */
let ended = false;
/** Until when a rate limit stands, and the moment SoundCloud named. */
let limitedUntil = 0;
let limitedReset: string | null = null;
let audioModeSet = false;
let watchdog: ReturnType<typeof setTimeout> | null = null;

/** How many tracks in a row an advance steps over when each turns out unplayable. */
const MAX_SKIPS = 3;
/** How long a stream may take to start before it is called a failure. */
const START_TIMEOUT_MS = 20_000;

/** The native object throws once released. Losing a pause is never worth losing the screen. */
function safely(run: () => void) {
  try {
    run();
  } catch {
    /* Released, or not ready. There is nothing playing to act on. */
  }
}

function clearWatchdog() {
  if (watchdog) clearTimeout(watchdog);
  watchdog = null;
}

/**
 * Music is what this player is for, so it sounds with the ring switch off —
 * iOS mutes an app's audio there unless told otherwise. It does not play with
 * the app in the background: the owner asked for "while in the app", and
 * expo-audio pauses a player itself when the app is left.
 */
function ensureAudioMode() {
  if (audioModeSet) return;
  audioModeSet = true;
  void setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: false,
    interruptionMode: 'doNotMix',
  }).catch(() => {
    audioModeSet = false;
  });
}

function seconds(durationMs: number | null | undefined): number {
  return typeof durationMs === 'number' && durationMs > 0 ? durationMs / 1000 : 0;
}

function fail(notice: PlayerNotice) {
  wantsPlay = false;
  clearWatchdog();
  usePlayer.setState({ phase: 'paused', notice });
}

/**
 * Load the track at `index` and play it.
 *
 * `auto` is an advance — the track before it ended, nobody chose this one. Only
 * an advance steps over a track that turns out unplayable; a track somebody
 * pressed stays where it is and says why.
 */
async function load(index: number, auto = false, skipped = 0): Promise<void> {
  const queue = usePlayer.getState().queue;
  const track = queue?.tracks[index];
  if (!queue || !track) return;

  const mine = ++ticket;
  wantsPlay = true;
  loadedUrn = null;
  ended = false;
  clearWatchdog();
  safely(() => audio?.pause());

  usePlayer.setState({
    index,
    phase: 'loading',
    notice: null,
    preview: false,
    position: 0,
    duration: seconds(track.durationMs),
  });

  if (track.access === 'blocked') return fail({ kind: 'blocked' });
  /* Inside a rate limit, say so without asking again: asking is what it limits. */
  if (Date.now() < limitedUntil) return fail({ kind: 'rate_limited', resetAt: limitedReset });
  if (!audio) return fail({ kind: 'failed' });

  let answer: StreamAnswer;
  resolvingTicket = mine;
  try {
    answer = await resolveStream(track.urn);
  } catch {
    if (mine === ticket) fail({ kind: 'failed' });
    return;
  }
  /* Another track was chosen, or the music stopped, while this was being asked. */
  if (mine !== ticket) return;
  resolvingTicket = -1;

  switch (answer.status) {
    case 'ok': {
      const target = audio;
      if (!target) return fail({ kind: 'failed' });
      ensureAudioMode();
      try {
        target.replace(
          answer.headers ? { uri: answer.url, headers: answer.headers } : { uri: answer.url }
        );
        target.play();
      } catch {
        return fail({ kind: 'failed' });
      }
      loadedUrn = track.urn;
      usePlayer.setState({ preview: answer.preview });
      /* A stream that never starts would otherwise spin for as long as the
         screen is open, and the native side does not always report why. */
      watchdog = setTimeout(() => {
        if (mine !== ticket || usePlayer.getState().phase !== 'loading') return;
        safely(() => audio?.pause());
        loadedUrn = null;
        fail({ kind: 'failed' });
      }, START_TIMEOUT_MS);
      return;
    }

    case 'blocked': {
      if (auto && skipped < MAX_SKIPS) {
        const next = nextPlayable(queue.tracks, index);
        if (next !== -1) return load(next, true, skipped + 1);
      }
      return fail({ kind: 'blocked' });
    }

    case 'rate_limited':
      limitedReset = answer.resetAt;
      limitedUntil = limitLiftsAt(answer.resetAt, Date.now());
      return fail({ kind: 'rate_limited', resetAt: answer.resetAt });

    case 'unconfigured':
      return fail({ kind: 'unconfigured' });
  }
}

/** The track ended: the next playable one, or the end of the soundtrack. */
function advance() {
  const { queue, index } = usePlayer.getState();
  const next = queue ? nextPlayable(queue.tracks, index) : -1;
  if (next === -1) {
    wantsPlay = false;
    ended = true;
    usePlayer.setState({ phase: 'paused', position: 0 });
    return;
  }
  void load(next, true);
}

/**
 * What the audio object reports, a few times a second.
 *
 * Read field by field: the native side sends partial reports. Android's
 * playback error is a status holding `error` and nothing else, and reading its
 * missing `currentTime` as a number would put `undefined` in the store.
 */
function onStatus(status: Partial<AudioStatus>) {
  const state = usePlayer.getState();
  if (!state.queue || !loadedUrn) return;
  /* Between tracks: these are the last words of the one before. */
  if (resolvingTicket === ticket) return;

  if (typeof status.error === 'string' && status.error) {
    safely(() => audio?.pause());
    loadedUrn = null;
    fail({ kind: 'failed' });
    return;
  }

  if (status.didJustFinish) {
    clearWatchdog();
    advance();
    return;
  }

  const phase = phaseOf({
    wantsPlay,
    playing: status.playing,
    isLoaded: status.isLoaded,
    isBuffering: status.isBuffering,
  });
  if (phase !== 'loading') clearWatchdog();

  const position =
    typeof status.currentTime === 'number' && Number.isFinite(status.currentTime)
      ? status.currentTime
      : state.position;
  /* An HLS stream reports no length until it has read its playlist, and may
     report zero; the track's listed length stands until a real one arrives. */
  const duration =
    typeof status.duration === 'number' && Number.isFinite(status.duration) && status.duration > 0
      ? status.duration
      : state.duration;

  if (phase !== state.phase || position !== state.position || duration !== state.duration) {
    usePlayer.setState({ phase, position, duration });
  }
}

/**
 * Hand the native player to this module. `<PlayerHost>` calls it and nothing
 * else may: there is one audio object in the app.
 *
 * The detach does not pause. `useAudioPlayer` releases its object in its own
 * cleanup, and a second cleanup calling `pause()` races that release and
 * throws from native — the crash the Surprise Me panel once had.
 */
export function attachAudio(target: AudioPlayer): () => void {
  audio = target;
  const subscription = target.addListener('playbackStatusUpdate', onStatus);

  return () => {
    /* The hook that made the object releases it first; a released object can throw here. */
    safely(() => subscription.remove());
    if (audio !== target) return;
    audio = null;
    loadedUrn = null;
    wantsPlay = false;
    ticket += 1;
    clearWatchdog();
    if (usePlayer.getState().queue) usePlayer.setState({ phase: 'paused' });
  };
}

function currentTrack(state: PlayerState): SoundCloudTrack | null {
  return state.queue?.tracks[state.index] ?? null;
}

export const player = {
  /**
   * Play one track of a queue — what a row, "Listen" and a play key all call.
   *
   * Pressing the track that is already loaded is a pause or a resume, whoever
   * started it: a song Surprise Me began is the same song on the soundtrack
   * screen's list, and loading it again from the top would spend a second play
   * on it. The queue is adopted either way, so "next" follows the list the
   * press was made on.
   */
  play(queue: PlayerQueue, index: number) {
    const track = queue.tracks[index];
    if (!track) return;

    const state = usePlayer.getState();
    if (currentTrack(state)?.urn === track.urn && loadedUrn === track.urn && !state.notice) {
      usePlayer.setState({ queue, index });
      player.toggle();
      return;
    }

    usePlayer.setState({ queue });
    void load(index);
  },

  /** Pause, resume, or try the current track again. */
  toggle() {
    const state = usePlayer.getState();
    const track = currentTrack(state);
    if (!track) return;

    if (state.phase === 'playing') {
      wantsPlay = false;
      safely(() => audio?.pause());
      usePlayer.setState({ phase: 'paused' });
      return;
    }

    if (state.phase === 'loading') {
      /* Pressed while the stream was on its way: call it off. An answer still
         in flight is dropped by the ticket, so the next press asks afresh. */
      ticket += 1;
      wantsPlay = false;
      loadedUrn = null;
      clearWatchdog();
      safely(() => audio?.pause());
      usePlayer.setState({ phase: 'paused' });
      return;
    }

    const target = audio;
    if (target && loadedUrn === track.urn && !state.notice) {
      wantsPlay = true;
      if (ended) {
        ended = false;
        /* A player that has reached the end ignores `play()` until it is wound back. */
        void target.seekTo(0).catch(() => {});
      }
      safely(() => target.play());
      return;
    }

    void load(state.index);
  },

  next() {
    const state = usePlayer.getState();
    if (!state.queue) return;
    const next = nextPlayable(state.queue.tracks, state.index);
    if (next !== -1) void load(next);
  },

  /** The track before — or this one from the top, once it is a few seconds in. */
  previous() {
    const state = usePlayer.getState();
    if (!state.queue) return;

    const before = previousPlayable(state.queue.tracks, state.index);
    if (state.position > RESTART_AFTER_SECONDS || before === -1) {
      player.seek(0);
      return;
    }
    void load(before);
  },

  /** Move to a fraction (0–1) of the loaded track. */
  seek(fraction: number) {
    const state = usePlayer.getState();
    const target = audio;
    if (!target || !loadedUrn || state.duration <= 0) return;

    const to = Math.min(1, Math.max(0, fraction)) * state.duration;
    ended = false;
    void target.seekTo(to).catch(() => {});
    usePlayer.setState({ position: to });
  },

  /** Silence, and nothing loaded: the queue and everything SoundCloud said about it are let go. */
  stop() {
    ticket += 1;
    wantsPlay = false;
    loadedUrn = null;
    ended = false;
    clearWatchdog();
    safely(() => audio?.pause());
    usePlayer.setState({ ...IDLE });
  },

  /**
   * A screen that plays music is leaving.
   *
   * It stops the music only if the queue is still its own — a song the
   * soundtrack screen has since taken over is not Surprise Me's to stop. With
   * `honourKeepPlaying`, the owner's switch decides: on, the music carries on
   * under the mini player. Only the soundtrack screen passes it; one dealt
   * song and a profile's starred song end with their screens.
   */
  release(owner: string, options: { honourKeepPlaying?: boolean } = {}) {
    const state = usePlayer.getState();
    if (state.queue?.owner !== owner) return;
    if (options.honourKeepPlaying && state.keepPlaying) return;
    player.stop();
  },

  setKeepPlaying(value: boolean) {
    usePlayer.setState({ keepPlaying: value });
    void AsyncStorage.setItem(KEEP_PLAYING_KEY, value ? '1' : '0').catch(() => {});
  },
};

/** The track at the head of the player, or null. */
export function useNowPlaying(): SoundCloudTrack | null {
  return usePlayer(currentTrack);
}

/**
 * Whether the mini player has something to show: the switch is on and a queue
 * is loaded. Where on screen it may be drawn is the route's business
 * (`hidesMiniPlayer`); this is whether there is one at all, and it is what
 * `<Screen>` and the tab bar's clearance make room on.
 */
export function useMiniPlayerActive(): boolean {
  return usePlayer((state) => state.keepPlaying && state.queue !== null);
}
