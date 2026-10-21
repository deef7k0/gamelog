import { useVideoPlayer, VideoView } from 'expo-video';
import { useEffect, useState } from 'react';
import { StyleSheet } from 'react-native';
import Animated from 'react-native-reanimated';

import type { AnimatedLayerProps } from '@/components/ui/animated-cover-image';

/**
 * An animated cover that is a video — SteamGridDB's WebM of an animated grid,
 * a tenth of the weight of the same animation as an image — looping, muted,
 * over the still cover until its first frame, then crossfading in.
 *
 * **Imported only through `React.lazy`** (`<AnimatedCoverImage>`), for the
 * reason `<TrailerVideo>` is: expo-video requires its native module the moment
 * it is imported, and a build without it must draw the still cover rather
 * than crash.
 *
 * The same economies as the trailer: no sound, never in the background, a
 * texture view (drawn inside the page, so it scrolls and clips with it), no
 * controls. It is mounted only while its cover is the one playing, so a
 * covered cover holds no decoder — and every mount fades in again from its
 * own first frame. A drag holds it (`playing` false) without unmounting it.
 */
export default function AnimatedCoverVideo({
  url,
  playing,
  backdrop,
  mediaOpacity,
  fadeMs,
  onFailed,
  onShown,
}: AnimatedLayerProps) {
  const [drawn, setDrawn] = useState(false);

  const player = useVideoPlayer({ uri: url, contentType: 'progressive' }, (created) => {
    created.muted = true;
    created.loop = true;
    created.audioMixingMode = 'mixWithOthers';
    created.staysActiveInBackground = false;
    created.showNowPlayingNotification = false;
    created.keepScreenOnWhilePlaying = false;
  });

  /* Commands to the native player, not React state. */
  useEffect(() => {
    if (playing) player.play();
    else player.pause();
  }, [player, playing]);

  useEffect(() => {
    const subscription = player.addListener('statusChange', ({ status, error }) => {
      if (status === 'error') onFailed(error);
    });
    return () => subscription.remove();
  }, [player, onFailed]);

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        {
          backgroundColor: backdrop,
          /* A CSS transition on a React prop: the crossfade cannot lose its
             end value (CLAUDE.md, the lost end value). */
          opacity: drawn ? 1 : 0,
          transitionProperty: 'opacity',
          transitionDuration: fadeMs,
        },
      ]}>
      <VideoView
        player={player}
        style={[StyleSheet.absoluteFill, { opacity: mediaOpacity }]}
        contentFit="cover"
        surfaceType="textureView"
        nativeControls={false}
        allowsPictureInPicture={false}
        allowsVideoFrameAnalysis={false}
        fullscreenOptions={{ enable: false }}
        onFirstFrameRender={() => {
          setDrawn(true);
          onShown?.();
        }}
        pointerEvents="none"
        accessible={false}
        importantForAccessibility="no-hide-descendants"
      />
    </Animated.View>
  );
}
