import { useQuery } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useRouter } from 'expo-router';
import { useState } from 'react';

import { SurpriseSoundtrack } from '@/components/surprise-soundtrack';
import { resolveSoundtrack } from '@/lib/games/surprise';
import type { GameSearchResult } from '@/lib/games/types';
import {
  pickTrack,
  type GameSoundtrack,
  type SoundtrackPick,
  type TrackPickMode,
} from '@/lib/soundtracks';

/** Previews are always 30 seconds; the denominator before `duration` reports. */
const PREVIEW_SECONDS = 30;

export type SurpriseSoundtrackPanelProps = {
  game: GameSearchResult;
  trackMode: TrackPickMode;
};

/**
 * The soundtrack for one dealt game: lookup, pick, playback.
 *
 * Mounted with `key={game.id}` by the screen, which is what makes dealing a new
 * card reset everything here — the query, the chosen track, the heard set and the
 * audio player — without a single effect watching for a change. The React
 * Compiler rules treat setState in an effect as an error, and this is the pattern
 * the repo already uses in `app/log/[id].tsx` to seed state from data.
 *
 * The one external call it can make is the iTunes lookup, and only when no user
 * has ever rolled this game. Everything after that is local.
 */
export function SurpriseSoundtrackPanel({ game, trackMode }: SurpriseSoundtrackPanelProps) {
  /*
   * Bumped by the retry control. It is part of the query key *and* what flips
   * `force`, so a retry both misses the React Query cache and skips the two
   * caches underneath it — otherwise the button would re-read the same stored
   * "no soundtrack" and appear to do nothing.
   */
  const [attempt, setAttempt] = useState(0);

  const soundtrack = useQuery({
    queryKey: ['surprise-soundtrack', game.id, attempt],
    queryFn: ({ signal }) => resolveSoundtrack(game.id, game.title, { force: attempt > 0, signal }),
    // A soundtrack does not change while you look at it, and dealing back to a
    // game you have already seen this session should cost nothing at all.
    staleTime: Infinity,
    retry: false,
  });

  const retry = () => setAttempt((value) => value + 1);

  if (soundtrack.isPending) {
    return <SurpriseSoundtrack {...IDLE} loading onRetry={retry} />;
  }

  const found = soundtrack.isSuccess ? soundtrack.data : null;

  if (!found || found.tracks.length === 0) {
    return (
      <SurpriseSoundtrack
        {...IDLE}
        soundtrack={found}
        failed={soundtrack.isError}
        onRetry={retry}
      />
    );
  }

  /*
   * Keyed on the album, so the first track is chosen the moment there is
   * something to choose from — a lazy `useState` initialiser in a component that
   * only mounts once the data exists, rather than an effect that fires after it
   * arrives.
   */
  return (
    <TrackStage
      key={`${found.albumId}:${attempt}`}
      game={game}
      soundtrack={found}
      trackMode={trackMode}
    />
  );
}

/** The props that mean "nothing to play yet", so the three call sites agree. */
const IDLE = {
  soundtrack: null,
  track: null,
  loading: false,
  failed: false,
  playing: false,
  progress: 0,
  canShuffle: false,
  onTogglePlay: NOOP,
  onAnotherSong: NOOP,
  onOpenAlbum: NOOP,
} as const;

function NOOP() {}

type TrackStageProps = {
  game: GameSearchResult;
  soundtrack: GameSoundtrack;
  trackMode: TrackPickMode;
};

/**
 * A chosen track, and the controls for it.
 *
 * Mounts only when there is a soundtrack in hand, which is what lets the initial
 * pick be a lazy initialiser instead of an effect.
 */
function TrackStage({ game, soundtrack, trackMode }: TrackStageProps) {
  const router = useRouter();

  /* The initialiser runs once, on mount. `trackMode` is read here rather than
     tracked: changing the mode should govern the *next* pick, not silently swap
     the song already playing. */
  const [track, setTrack] = useState<SoundtrackPick | null>(() =>
    pickTrack(soundtrack.tracks, trackMode)
  );

  /* Everything already served for this album, so shuffling walks the record
     instead of landing on the same track twice. `pickTrack` drops the exclusion
     once it has been through all of them. */
  const [heard, setHeard] = useState<ReadonlySet<string>>(() =>
    track ? new Set([track.id]) : new Set()
  );

  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);
  /* Whether *this* track is the one loaded into the player. A new pick clears it,
     so the transport shows "play" rather than inheriting the previous track's
     playing state. */
  const [loadedId, setLoadedId] = useState<string | null>(null);

  /*
   * There is deliberately no `pause()` on unmount, and removing one is what
   * fixed a hard crash.
   *
   * `useAudioPlayer` releases its native object in its own unmount cleanup.
   * Registering a second cleanup that calls `player.pause()` is a race with
   * that release, and losing it throws from native — leaving the settings gear,
   * which unmounts this whole subtree, crashing the app on tap. The album
   * screen has never had such a cleanup, which is the evidence: it relies on
   * the hook, and so does this.
   *
   * Explicit pauses still happen where the player is known to be alive — before
   * swapping a track, and before navigating away.
   */

  /**
   * Whether there is a second track to shuffle to.
   *
   * A one-track album made this control a trap: `pickTrack` correctly falls back
   * to the full list once the exclusion is exhausted, so it returned the same
   * track, and the handler then stopped playback and re-set it. The button's
   * whole observable effect was to stop your music.
   */
  const canShuffle = soundtrack.tracks.length > 1;

  /** `pause()` on a torn-down player throws from native. Never fatal here. */
  function safePause() {
    try {
      player.pause();
    } catch {
      /* Already released — there is nothing playing to stop. */
    }
  }

  function togglePlay() {
    if (!track?.previewUrl) return;

    if (loadedId === track.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }

    player.replace({ uri: track.previewUrl });
    player.seekTo(0);
    player.play();
    setLoadedId(track.id);
  }

  function anotherSong() {
    if (!canShuffle) return;

    const next = pickTrack(soundtrack.tracks, trackMode, heard);
    if (!next || next.id === track?.id) return;

    /* Stop first. Without this the previous preview keeps playing under a row
       that has already changed to a different song. Guarded because a released
       player throws from native, and losing the music is never worth losing the
       screen. */
    safePause();
    setLoadedId(null);
    setTrack(next);
    setHeard((previous) => {
      // Past every track: start the record again rather than pinning on the last.
      if (previous.size >= soundtrack.tracks.length) return new Set([next.id]);
      return new Set([...previous, next.id]);
    });
  }

  function openAlbum() {
    /* Stop before leaving: the album screen has its own player, and two of them
       playing different previews at once is the failure this guards. */
    safePause();
    router.push({
      pathname: '/soundtrack/[id]',
      params: {
        id: soundtrack.albumId,
        title: soundtrack.albumTitle,
        artist: soundtrack.artist,
        artwork: soundtrack.artworkUrl ?? '',
        url: soundtrack.externalUrl ?? '',
        /*
         * Which game's soundtrack this is.
         *
         * That screen's own comment records that it "never knows the game id it
         * was opened from", so every song starred there has written a null
         * `game_id` and lost the "from <game>" credit `starred_songs` was built
         * to carry. This is the one entry point that does know, and the album
         * screen falls back to its old behaviour when the pair is absent.
         */
        game: game.id,
        gameTitle: game.title,
      },
    });
  }

  const isCurrent = !!track && loadedId === track.id;
  const progress = !isCurrent
    ? 0
    : status.duration
      ? Math.min(1, status.currentTime / status.duration)
      : Math.min(1, status.currentTime / PREVIEW_SECONDS);

  return (
    <SurpriseSoundtrack
      soundtrack={soundtrack}
      track={track}
      loading={false}
      failed={false}
      playing={isCurrent && status.playing}
      progress={progress}
      canShuffle={canShuffle}
      onTogglePlay={togglePlay}
      onAnotherSong={anotherSong}
      onOpenAlbum={openAlbum}
      onRetry={NOOP}
    />
  );
}
