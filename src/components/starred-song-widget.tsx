import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStarredSong } from '@/lib/api';

/** Album art at the size the soundtrack screen's own rows use. */
const ARTWORK = 64;

/** Previews are always 30 seconds; used to draw the progress bar. */
const PREVIEW_SECONDS = 30;

/**
 * The one song pinned to a profile, with its preview.
 *
 * Modelled on the track pinned to an Instagram bio: a statement about taste
 * that the visitor can hear rather than only read. It renders nothing at all
 * when nobody has pinned one — an empty "no song" row on every profile would be
 * a permanent advert for a feature most people will not use.
 *
 * Laid out as a full-width row, the same shape as a row on the soundtrack
 * screen: art, then title, artist and the game it came from, then the control.
 * It is the profile's music player, and a player that occupies a third of the
 * width reads as a thumbnail of one.
 *
 * Playback is local to this widget and stops on unmount, matching the
 * soundtrack screen. A track with no preview still shows: iTunes omits clips
 * for some releases, and the pick is worth displaying even when it is silent.
 */
export function StarredSongWidget({ profileId }: { profileId: string }) {
  const theme = useTheme();
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const song = useQuery({
    queryKey: ['starred-song', profileId],
    queryFn: () => getStarredSong(profileId),
    enabled: !!profileId,
  });

  const track = song.data;
  if (!track) return null;

  const playable = !!track.preview_url;
  const progress = status.duration
    ? Math.min(1, status.currentTime / status.duration)
    : Math.min(1, status.currentTime / PREVIEW_SECONDS);

  function toggle() {
    if (!track?.preview_url) return;
    if (status.playing) {
      player.pause();
      return;
    }
    // `replace` is idempotent for the same URI and resets a finished clip.
    player.replace({ uri: track.preview_url });
    player.seekTo(0);
    player.play();
  }

  return (
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
      <View style={styles.head}>
        <Ionicons name="star" size={13} color={theme.primaryText} />
        <Text variant="caption" color="textSecondary">
          STARRED SONG
        </Text>
      </View>

      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={
          playable
            ? `${status.playing ? 'Pause' : 'Play'} ${track.title} by ${track.artist}`
            : `${track.title} by ${track.artist} — no preview available`
        }
        accessibilityState={{ disabled: !playable }}
        disabled={!playable}
        onPress={toggle}
        scaleTo={0.99}
        style={StyleSheet.flatten([styles.row, { opacity: playable ? 1 : 0.6 }])}>
        {track.artwork_url ? (
          <Image
            source={{ uri: track.artwork_url }}
            style={styles.artwork}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={[styles.artwork, { backgroundColor: theme.surfaceElevated }]}>
            <Ionicons name="musical-notes" size={22} color={theme.textMuted} />
          </View>
        )}

        <View style={styles.body}>
          <Text variant="h5" numberOfLines={1}>
            {track.title}
          </Text>
          <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
            {[track.artist, track.game_title].filter(Boolean).join(' · ')}
          </Text>

          {/* Progress only while it is actually playing — a full-width empty
              track under a song nobody has tapped is just a rule. */}
          {status.playing && (
            <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
              <View
                style={[
                  styles.fill,
                  { width: `${progress * 100}%`, backgroundColor: theme.primary },
                ]}
              />
            </View>
          )}
        </View>

        {playable && (
          <View style={[styles.play, { borderColor: theme.border }]}>
            <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color={theme.text} />
          </View>
        )}
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  /* `flex: 1` because the profile mounts every widget inside a row: without it
     the widget shrinks to the width of its own text and the artwork ends up
     sitting in the middle of the page. */
  widget: {
    flex: 1,
    gap: Spacing.x12,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  artwork: {
    width: ARTWORK,
    height: ARTWORK,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { flex: 1, gap: 2 },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.x4 },
  fill: { height: '100%', borderRadius: Radius.pill },
  play: {
    width: 44,
    height: 44,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
