import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Card, Skeleton } from '@/components/ui/surface';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import type { GameSoundtrack, SoundtrackPick } from '@/lib/soundtracks';

const ARTWORK = 44;

export type SurpriseSoundtrackProps = {
  soundtrack: GameSoundtrack | null;
  track: SoundtrackPick | null;
  loading: boolean;
  /** The lookup itself failed, as opposed to finding nothing. */
  failed: boolean;
  playing: boolean;
  /** 0–1 through the 30-second preview. */
  progress: number;
  /** False when the album holds a single track and shuffling cannot move. */
  canShuffle: boolean;
  onTogglePlay: () => void;
  onAnotherSong: () => void;
  /** Opens the full album screen — the track list, the star, Apple Music. */
  onOpenAlbum: () => void;
  onRetry: () => void;
};

/**
 * The soundtrack, as one row.
 *
 * ## Why a row and not the card it replaced
 *
 * The reveal fits one viewport now, and the card wanted 230dp of it for artwork
 * the game's own case is already providing at four times the size. A row states
 * the same three facts — what is playing, who by, from which album — in 64.
 *
 * ## What left, and where it went
 *
 * **The star is gone from this surface, deliberately.** It performed an upsert
 * that overwrites the profile's one pinned song, from a 32dp glyph, with no
 * confirmation and no undo, on a screen built for rapid mis-taps. That is the
 * most consequential action in the feature and it was also its smallest. Tapping
 * the row opens `/soundtrack/[id]`, which already holds the full track list, the
 * Apple Music link and the same star — one tap away, on a screen where you are
 * choosing a track deliberately rather than thumbing past a card.
 *
 * Purely presentational: playback, selection and caching all live above it.
 */
export function SurpriseSoundtrack({
  soundtrack,
  track,
  loading,
  failed,
  playing,
  progress,
  canShuffle,
  onTogglePlay,
  onAnotherSong,
  onOpenAlbum,
  onRetry,
}: SurpriseSoundtrackProps) {
  const theme = useTheme();
  const accent = useAccent();

  if (loading) {
    return (
      <Card tinted elevated panel padded={false} style={styles.pad}>
        <View style={styles.row}>
          <Skeleton width={ARTWORK} height={ARTWORK} />
          <View style={styles.meta}>
            <Skeleton width="64%" height={13} radius={Radius.sm} />
            <Skeleton width="40%" height={10} radius={Radius.sm} />
          </View>
        </View>
      </Card>
    );
  }

  /*
   * One row for all three ways there can be no track, with the message doing the
   * distinguishing — nothing released, an album with no listed tracks, and a
   * lookup that fell over. Only the third is worth retrying, so only the third
   * offers it: the button used to appear in all three and spent a real round
   * trip to return the same nothing in two of them.
   */
  if (!track) {
    const message = failed
      ? 'Couldn’t reach Apple Music.'
      : soundtrack
        ? `Apple Music lists no songs for ${soundtrack.albumTitle}.`
        : 'No soundtrack on Apple Music.';

    return (
      <Card tinted elevated panel padded={false} style={styles.pad}>
        <View style={styles.row}>
          <View style={[styles.blank, { backgroundColor: theme.surfaceElevated }]}>
            <Ionicons name="musical-notes-outline" size={19} color={theme.textMuted} />
          </View>
          <Text variant="bodySmall" color="textMuted" style={styles.meta} numberOfLines={2}>
            {message}
          </Text>
          {failed && (
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel="Look for the soundtrack again"
              onPress={onRetry}
              scaleTo={0.9}
              style={styles.disc}>
              <Ionicons name="refresh" size={19} color={theme.textSecondary} />
            </PressableScale>
          )}
        </View>
      </Card>
    );
  }

  const playable = !!track.previewUrl;

  return (
    <Card tinted elevated panel padded={false} style={styles.pad}>
      <View style={styles.row}>
        {/* The row's body opens the album. Everything the card used to carry —
            the full track list, Apple Music, the star — lives on that screen. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${track.title} by ${track.artist || soundtrack?.artist}. Open the soundtrack.`}
          onPress={onOpenAlbum}
          scaleTo={0.99}
          style={styles.body}>
          <Image
            source={soundtrack?.artworkUrl ? { uri: soundtrack.artworkUrl } : undefined}
            recyclingKey={soundtrack?.albumId}
            cachePolicy="memory-disk"
            style={[styles.artwork, { backgroundColor: theme.surfaceElevated }]}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <View style={styles.meta}>
            <Text variant="h5" numberOfLines={1}>
              {track.title}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {track.artist || soundtrack?.artist}
            </Text>
          </View>
        </PressableScale>

        {/* Disabled rather than hidden on a one-track album: a control that
            vanishes between games reads as a layout bug, and the state is the
            honest answer — there is nothing else on this record. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={canShuffle ? 'Another song' : 'This soundtrack has only one song'}
          accessibilityState={{ disabled: !canShuffle }}
          disabled={!canShuffle}
          onPress={onAnotherSong}
          scaleTo={0.9}
          style={StyleSheet.flatten([styles.disc, !canShuffle && styles.dimmed])}>
          <Ionicons name="shuffle" size={19} color={theme.textSecondary} />
        </PressableScale>

        <PressableScale
          accessibilityRole="button"
          accessibilityState={{ disabled: !playable, selected: playing }}
          accessibilityLabel={
            playable ? (playing ? `Pause ${track.title}` : `Play ${track.title}`) : 'No preview'
          }
          disabled={!playable}
          onPress={onTogglePlay}
          scaleTo={0.9}
          style={StyleSheet.flatten([
            styles.disc,
            { backgroundColor: playable ? accent.color : theme.surfaceElevated },
          ])}>
          <Ionicons
            name={playing ? 'pause' : 'play'}
            size={19}
            color={playable ? accent.ink : theme.textMuted}
            /* A play triangle is optically left-heavy inside a circle; the pause
               glyph is symmetrical and needs no correction. */
            style={playing ? undefined : styles.playNudge}
          />
        </PressableScale>
      </View>

      {/* The preview is always 30 seconds, so this is a countdown rather than a
          seek target — it is not interactive and does not pretend to be. */}
      <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: accent.color, width: `${Math.min(100, progress * 100)}%` },
          ]}
        />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  /* `Card` pads generously for a block of content; this is a row, and its own
     padding is what keeps the discs at `TapTarget` without a 76dp-tall row. */
  pad: { paddingHorizontal: Spacing.x12, paddingVertical: Spacing.x8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  body: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  artwork: { width: ARTWORK, height: ARTWORK, borderRadius: Radius.image },
  blank: {
    width: ARTWORK,
    height: ARTWORK,
    borderRadius: Radius.image,
    alignItems: 'center',
    justifyContent: 'center',
  },
  meta: { flex: 1, gap: 1 },
  /* `TapTarget`, not a literal 44 — it resolves to 48 on Android, and a
     hard-coded 44 here is the exact bug the token exists to prevent. */
  disc: {
    width: TapTarget,
    height: TapTarget,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dimmed: { opacity: 0.4 },
  playNudge: { marginLeft: 2 },
  track: { height: 3, borderRadius: Radius.pill, overflow: 'hidden', marginTop: Spacing.x8 },
  fill: { height: 3, borderRadius: Radius.pill },
});
