import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';

import { SurpriseSoundtrack } from '@/components/surprise-soundtrack';
import { useGameSoundtrack } from '@/hooks/use-game-soundtrack';
import type { GameSearchResult } from '@/lib/games/types';
import { noticeText, progressOf } from '@/lib/player-queue';
import type { GameSoundtrack, SoundCloudTrack } from '@/lib/soundcloud/types';
import { pickTrack, type TrackPickMode } from '@/lib/soundtrack-pick';
import { player, usePlayer } from '@/store/player';

export type SurpriseSoundtrackPanelProps = {
  game: GameSearchResult;
  trackMode: TrackPickMode;
};

/**
 * The soundtrack for one dealt game: lookup, pick, playback.
 *
 * Mounted with `key={game.id}` by the screen, which is what makes dealing a new
 * card reset everything here — the chosen track, the heard set, and the song
 * itself, stopped on the way out — without a single effect watching for a
 * change. The React Compiler rules treat setState in an effect as an error, and
 * this is the pattern the repo already uses in `app/log/[id].tsx` to seed
 * state from data.
 *
 * ## What it asks for, and when
 *
 * One question to the `soundcloud` function when the card lands: which upload
 * is this game's soundtrack. That is the query the game page's Soundtrack tab
 * and the soundtrack screen share (`useGameSoundtrack`), so opening the
 * soundtrack from here is already loaded. **No stream is asked for until the
 * play key is pressed** — every one spends one of the app's daily plays, and a
 * card that is thumbed past must cost none.
 *
 * ## It does not own a player
 *
 * It had one, and so did two other screens. The song plays through the app's
 * one player (`store/player.ts`) under this card's name, and is stopped when
 * the card is dealt away or another screen opens over it — unless that screen
 * is its soundtrack, which takes the song over and is then the one to stop it.
 */
export function SurpriseSoundtrackPanel({ game, trackMode }: SurpriseSoundtrackPanelProps) {
  const { query } = useGameSoundtrack({
    gameId: game.id,
    title: game.title,
    developer: game.developer,
  });

  const retry = () => void query.refetch();

  if (query.isPending) return <SurpriseSoundtrack {...IDLE} loading />;

  if (query.isLoadingError) {
    return <SurpriseSoundtrack {...IDLE} message="Couldn’t reach SoundCloud." onRetry={retry} />;
  }

  const answer = query.data;

  /*
   * Three ways there can be no song, and the message does the distinguishing.
   * Only the one a second request could change offers one: "nothing found" is
   * the right answer most of the time, and "not connected" is not something a
   * press on a phone can fix.
   */
  if (answer?.status === 'rate_limited') {
    return (
      <SurpriseSoundtrack
        {...IDLE}
        message="SoundCloud is busy. Try again in a minute."
        onRetry={retry}
      />
    );
  }
  if (answer?.status === 'unconfigured') {
    return <SurpriseSoundtrack {...IDLE} message="Soundtracks are not connected yet." />;
  }
  if (answer?.status !== 'ok') {
    return <SurpriseSoundtrack {...IDLE} message="No soundtrack on SoundCloud." />;
  }

  /*
   * Mounts only once there is a soundtrack in hand, so the first track is
   * chosen by a lazy `useState` initialiser rather than an effect that fires
   * after the data arrives.
   */
  return <TrackStage game={game} soundtrack={answer.soundtrack} trackMode={trackMode} />;
}

/** The props that mean "nothing to play", so every such call site agrees. */
const IDLE = {
  track: null,
  loading: false,
  message: null,
  note: null,
  preview: false,
  playing: false,
  starting: false,
  progress: 0,
  canShuffle: false,
  onTogglePlay: NOOP,
  onAnotherSong: NOOP,
  onOpenSoundtrack: NOOP,
} as const;

function NOOP() {}

type TrackStageProps = {
  game: GameSearchResult;
  soundtrack: GameSoundtrack;
  trackMode: TrackPickMode;
};

/** A chosen track, and the controls for it. */
function TrackStage({ game, soundtrack, trackMode }: TrackStageProps) {
  const router = useRouter();

  /* The initialiser runs once, on mount. `trackMode` is read here rather than
     tracked: changing the mode should govern the *next* pick, not silently swap
     the song already playing. */
  const [track, setTrack] = useState<SoundCloudTrack | null>(() =>
    pickTrack(soundtrack.tracks, trackMode)
  );

  /* Everything already served for this game, so shuffling walks the soundtrack
     instead of landing on the same track twice. `pickTrack` drops the exclusion
     once it has been through all of them. */
  const [heard, setHeard] = useState<ReadonlySet<string>>(() =>
    track ? new Set([track.urn]) : new Set()
  );

  const owner = `surprise:${game.id}`;

  /* The card is leaving: its song goes with it, if it is still this card's. */
  useEffect(() => () => player.release(owner), [owner]);

  /*
   * So is the reader, when another screen opens over this one — the game's
   * page, the log form. The card stays mounted underneath, so an unmount
   * cleanup alone would leave its song playing behind a screen with nothing on
   * it to stop it.
   *
   * One screen is the exception: the song's own soundtrack, where it is shown
   * as playing and can be paused, scrubbed and followed by the next track.
   * `handingOver` is set by the one handler that opens it.
   */
  const handingOver = useRef(false);
  useFocusEffect(
    useCallback(() => {
      handingOver.current = false;
      return () => {
        if (!handingOver.current) player.release(owner);
      };
    }, [owner])
  );

  const urn = track?.urn ?? null;
  /* By id, not by owner: once the soundtrack screen adopts this song it is no
     longer this card's queue, and it is still the song on this row. */
  const isCurrent = usePlayer(
    (state) => urn !== null && state.queue?.tracks[state.index]?.urn === urn
  );
  const phase = usePlayer((state) => state.phase);
  const notice = usePlayer((state) => state.notice);
  const preview = usePlayer((state) => state.preview);
  const progress = usePlayer((state) =>
    urn !== null && state.queue?.tracks[state.index]?.urn === urn
      ? progressOf(state.position, state.duration)
      : 0
  );

  /**
   * Whether there is a second track to shuffle to.
   *
   * With one playable track this control was a trap: `pickTrack` correctly
   * falls back to the full list once the exclusion is exhausted, so it returned
   * the same track, and the handler then stopped playback and re-set it. The
   * button's whole observable effect was to stop your music.
   */
  const canShuffle = soundtrack.tracks.filter((item) => item.access !== 'blocked').length > 1;

  function togglePlay() {
    if (!track) return;
    /* One track, not the soundtrack: a dealt card plays its one song and ends.
       `player.play` pauses or resumes when this is already what is loaded. */
    player.play({ owner, gameId: game.id, gameTitle: game.title, tracks: [track] }, 0);
  }

  function anotherSong() {
    if (!canShuffle) return;

    const next = pickTrack(soundtrack.tracks, trackMode, heard);
    if (!next || next.urn === track?.urn) return;

    /* Stop first. Without this the previous song keeps playing under a row
       that has already changed to a different one. */
    player.release(owner);
    setTrack(next);
    setHeard((previous) => {
      // Past every track: start again rather than pinning on the last.
      if (previous.size >= soundtrack.tracks.length) return new Set([next.urn]);
      return new Set([...previous, next.urn]);
    });
  }

  function openSoundtrack() {
    /* Nothing is paused on the way: there is one player now, and the song this
       card started is still playing — and shown as playing — in its own
       soundtrack's list. */
    handingOver.current = true;
    router.push({ pathname: '/soundtrack/[id]', params: { id: game.id, title: game.title } });
  }

  if (!track) {
    /* A soundtrack with nothing this app may play. */
    return (
      <SurpriseSoundtrack {...IDLE} message="SoundCloud does not let this soundtrack play here." />
    );
  }

  return (
    <SurpriseSoundtrack
      track={track}
      loading={false}
      message={null}
      note={isCurrent && notice ? noticeText(notice) : null}
      /* What SoundCloud said when the list was fetched, or what the stream
         turned out to be once it was asked for. */
      preview={track.access === 'preview' || (isCurrent && preview)}
      playing={isCurrent && phase === 'playing'}
      starting={isCurrent && phase === 'loading'}
      progress={progress}
      canShuffle={canShuffle}
      onTogglePlay={togglePlay}
      onAnotherSong={anotherSong}
      onOpenSoundtrack={openSoundtrack}
    />
  );
}
