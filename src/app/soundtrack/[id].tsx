import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, StyleSheet, View } from 'react-native';

import { GameDisc } from '@/components/game-disc';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getStarredSong, starSong, unstarSong } from '@/lib/api';
import { formatDuration, getAlbumTracks, type SoundtrackTrack } from '@/lib/soundtracks';
import { useAuth } from '@/store/auth';

/** Previews are always 30 seconds; used to draw the progress bar. */
const PREVIEW_SECONDS = 30;

/**
 * A game soundtrack as an album, with 30-second previews.
 *
 * One player instance is reused for every track rather than one per row —
 * `replace()` swaps the source, which also gives "playing a new track stops the
 * old one" for free.
 *
 * Playback is scoped to this screen: the player is released on unmount, so
 * navigating away stops the audio. A persistent mini-player would need global
 * state and is deliberately out of scope.
 */
export default function SoundtrackScreen() {
  const theme = useTheme();
  const params = useLocalSearchParams<{
    id: string;
    title?: string;
    artist?: string;
    artwork?: string;
    url?: string;
  }>();

  const [playingId, setPlayingId] = useState<string | null>(null);
  const player = useAudioPlayer();
  const status = useAudioPlayerStatus(player);

  const tracks = useQuery({
    queryKey: ['soundtrack', params.id],
    queryFn: ({ signal }) => getAlbumTracks(params.id!, signal),
    enabled: !!params.id,
    staleTime: 60 * 60_000,
  });

  const userId = useAuth((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  const starred = useQuery({
    queryKey: ['starred-song', userId],
    queryFn: () => getStarredSong(userId!),
    enabled: !!userId,
  });

  const starredId = starred.data?.track_id ?? null;

  /*
   * One mutation for both directions.
   *
   * Starring the track that is already starred clears it — with a limit of one
   * there has to be a way back to none, and a separate "unstar" control would
   * be a second button for the same star.
   */
  const star = useMutation({
    mutationFn: async (track: SoundtrackTrack) => {
      if (!userId) throw new Error('You must be signed in.');
      if (starredId === track.id) {
        await unstarSong(userId);
        return;
      }
      await starSong(userId, track, {
        artworkUrl: params.artwork ?? null,
        // The album is a game soundtrack, so the credit is the album's own
        // title — this screen never knows the game id it was opened from.
        gameTitle: params.title ?? null,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['starred-song', userId] });
    },
  });

  /*
   * No effect watching `didJustFinish` to clear the selection: setState in an
   * effect is a React Compiler violation, and it is not needed. When a preview
   * ends, `status.playing` flips false on its own, so the row's icon returns to
   * "play" while the track stays highlighted as the current one — which is what
   * a music player should do anyway.
   */
  function toggle(track: SoundtrackTrack) {
    if (!track.previewUrl) return;

    if (playingId === track.id) {
      if (status.playing) player.pause();
      else player.play();
      return;
    }

    player.replace({ uri: track.previewUrl });
    player.seekTo(0);
    player.play();
    setPlayingId(track.id);
  }

  if (tracks.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <LoadingState />
      </Screen>
    );
  }

  if (tracks.isError) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <ErrorState error={tracks.error} />
      </Screen>
    );
  }

  const list = tracks.data ?? [];
  const progress = status.duration
    ? Math.min(1, status.currentTime / status.duration)
    : status.currentTime / PREVIEW_SECONDS;

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: params.title ?? 'Soundtrack' }} />

      <FlatList
        data={list}
        keyExtractor={(track) => track.id}
        contentContainerStyle={list.length === 0 ? styles.empty : styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            <GameDisc
              coverUrl={params.artwork ?? null}
              size={196}
              spinning={status.playing}
              revolutionMs={9000}
            />

            <View style={styles.headerText}>
              <Text variant="heading" numberOfLines={2}>
                {params.title ?? 'Soundtrack'}
              </Text>
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {params.artist ?? ''}
              </Text>
              <Text variant="micro" color="textMuted">
                {list.length} {list.length === 1 ? 'track' : 'tracks'} · 30-second previews
              </Text>
            </View>

            {params.url && (
              <Text
                variant="caption"
                color="primary"
                onPress={() => Linking.openURL(params.url!).catch(() => {})}>
                Listen in full on Apple Music
              </Text>
            )}
          </View>
        }
        renderItem={({ item }) => {
          const isCurrent = playingId === item.id;
          const isPlaying = isCurrent && status.playing;
          const playable = !!item.previewUrl;

          return (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                playable ? `Preview ${item.title}` : `${item.title} — no preview available`
              }
              accessibilityState={{ disabled: !playable, selected: isCurrent }}
              disabled={!playable}
              onPress={() => toggle(item)}
              scaleTo={0.99}
              style={StyleSheet.flatten([
                styles.row,
                {
                  backgroundColor: isCurrent ? theme.primaryMuted : 'transparent',
                  borderTopColor: theme.border,
                  opacity: playable ? 1 : 0.45,
                },
              ])}>
              <View style={styles.trackNumber}>
                {isCurrent ? (
                  <Ionicons name={isPlaying ? 'pause' : 'play'} size={16} color={theme.primary} />
                ) : (
                  <Text variant="caption" color="textMuted">
                    {item.trackNumber ?? '–'}
                  </Text>
                )}
              </View>

              <View style={styles.trackBody}>
                <Text variant="bodyStrong" numberOfLines={1} color={isCurrent ? 'primary' : 'text'}>
                  {item.title}
                </Text>
                <Text variant="micro" color="textMuted" numberOfLines={1}>
                  {playable ? item.artist : 'Preview unavailable'}
                </Text>

                {/* Progress only under the track actually playing. */}
                {isCurrent && (
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

              <Text variant="micro" color="textMuted">
                {formatDuration(item.durationMs)}
              </Text>

              {/* Star. Only for signed-in viewers — there is no profile to pin
                  it to otherwise. Tapping the starred track again clears it,
                  because "one song" needs a way back to none. */}
              {userId && (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={
                    starredId === item.id
                      ? `Unstar ${item.title}`
                      : `Star ${item.title} on your profile`
                  }
                  accessibilityState={{ selected: starredId === item.id }}
                  onPress={() => star.mutate(item)}
                  disabled={star.isPending}
                  scaleTo={0.85}
                  style={styles.star}>
                  <Ionicons
                    name={starredId === item.id ? 'star' : 'star-outline'}
                    size={18}
                    color={starredId === item.id ? theme.accent : theme.textMuted}
                  />
                </PressableScale>
              )}
            </PressableScale>
          );
        }}
        ListEmptyComponent={
          <EmptyState
            title="No tracks"
            message="Apple Music did not return a track list for this album."
          />
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.seven },
  empty: { flexGrow: 1 },
  header: { alignItems: 'center', gap: Spacing.three, marginBottom: Spacing.four },
  headerText: { alignItems: 'center', gap: 2 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  star: { padding: Spacing.one },
  trackNumber: { width: 26, alignItems: 'center' },
  trackBody: { flex: 1, gap: 2 },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.one },
  fill: { height: '100%', borderRadius: Radius.pill },
});
