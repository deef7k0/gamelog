import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';

import { ScreenshotViewer, type Screenshot } from '@/components/screenshot-viewer';
import { ArtRail, Section } from '@/components/ui/section';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { trailerThumbnail, trailerUrl, type GameTrailer } from '@/lib/games/trailer';

type Item =
  { kind: 'trailer'; trailer: GameTrailer } | { kind: 'shot'; shot: Screenshot; index: number };

/** Diameter of the play glyph's disc on the trailer's still. */
const PLAY = 48;

/**
 * The Overview's first section: the game's trailer, then its screenshots.
 *
 * The owner's direction (2026-10-15): "make game page screenshots expandable.
 * Also, add a trailer that links to youtube if it's available." So a
 * screenshot opens `<ScreenshotViewer>` — the shots full width, one at a time,
 * swiped through — and the trailer, when IGDB lists one (`pickTrailer`), leads
 * the row as YouTube's still with a play mark, and opens the video on YouTube.
 *
 * Its own component so opening the viewer re-renders this row and not the
 * whole game page (CLAUDE.md, performance traps).
 */
export function GameScreenshots({
  shots,
  trailer,
}: {
  shots: readonly Screenshot[];
  trailer: GameTrailer | null;
}) {
  const theme = useTheme();
  const [open, setOpen] = useState<number | null>(null);

  const items: Item[] = [
    ...(trailer ? [{ kind: 'trailer' as const, trailer }] : []),
    ...shots.map((shot, index) => ({ kind: 'shot' as const, shot, index })),
  ];
  if (items.length === 0) return null;

  return (
    <Section title={trailer ? 'Trailer and screenshots' : 'Screenshots'}>
      <ArtRail
        data={items}
        keyOf={(item) =>
          item.kind === 'trailer' ? `trailer-${item.trailer.videoId}` : item.shot.url
        }
        shape="wide"
        labelOf={(item) =>
          item.kind === 'trailer'
            ? `${item.trailer.name}. Opens YouTube.`
            : `${item.shot.label}. Opens it full screen.`
        }
        onPressItem={(item) => {
          if (item.kind === 'trailer') {
            Linking.openURL(trailerUrl(item.trailer)).catch(() => {
              // No browser or YouTube app to take it; nothing useful to say.
            });
          } else {
            setOpen(item.index);
          }
        }}
        renderArt={(item, size) =>
          item.kind === 'trailer' ? (
            <View style={[size, styles.shot, { backgroundColor: theme.surfaceElevated }]}>
              <Image
                source={{ uri: trailerThumbnail(item.trailer) }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                accessibilityIgnoresInvertColors
              />
              <View style={[styles.veil, { backgroundColor: theme.scrim }]} />
              <View style={styles.playRow}>
                <View style={[styles.play, { backgroundColor: theme.white }]}>
                  <Ionicons name="play" size={22} color={theme.shadowInk} style={styles.glyph} />
                </View>
                <Text variant="itemTitle" color="white" numberOfLines={1} style={styles.name}>
                  {item.trailer.name}
                </Text>
              </View>
            </View>
          ) : (
            <Image
              source={{ uri: item.shot.url }}
              style={[size, styles.shot, { backgroundColor: theme.surfaceElevated }]}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          )
        }
      />

      <ScreenshotViewer shots={shots} index={open} onClose={() => setOpen(null)} />
    </Section>
  );
}

const styles = StyleSheet.create({
  shot: { borderRadius: Radius.image, overflow: 'hidden' },
  veil: { ...StyleSheet.absoluteFill, opacity: 0.5 },
  playRow: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x12,
  },
  play: {
    width: PLAY,
    height: PLAY,
    borderRadius: PLAY / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* A play triangle's mass sits left of its box; nudge it to look centred. */
  glyph: { marginLeft: 3 },
  name: { maxWidth: '90%' },
});
