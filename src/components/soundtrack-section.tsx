import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { SectionHeader } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { findSoundtracks } from '@/lib/soundtracks';

const ALBUM_SIZE = 132;

export type SoundtrackAlbumsProps = {
  gameTitle: string;
  /**
   * `rail` is a horizontal strip for use inside another page; `grid` fills a
   * dedicated tab and shows loading and empty states, which the rail hides.
   */
  layout?: 'rail' | 'grid';
};

/**
 * Soundtrack albums for a game.
 *
 * In `rail` mode this renders nothing when no album is found — most games have
 * no released soundtrack, and an empty "Soundtrack" heading on every game page
 * would be noise. In `grid` mode the user has deliberately opened a Soundtrack
 * tab, so "nothing found" is information worth showing.
 */
export function SoundtrackAlbums({ gameTitle, layout = 'rail' }: SoundtrackAlbumsProps) {
  const theme = useTheme();
  const router = useRouter();

  const albums = useQuery({
    queryKey: ['soundtracks', gameTitle],
    queryFn: ({ signal }) => findSoundtracks(gameTitle, signal),
    // iTunes results for a fixed title never change within a session.
    staleTime: 24 * 60 * 60_000,
  });

  const results = albums.data ?? [];
  const isGrid = layout === 'grid';

  if (albums.isLoading) return isGrid ? <LoadingState /> : null;

  if (albums.isError) {
    return isGrid ? <ErrorState error={albums.error} /> : null;
  }

  if (results.length === 0) {
    if (!isGrid) return null;
    return (
      <EmptyState
        title="No soundtrack found"
        message={`Apple Music has no released soundtrack matching “${gameTitle}”.`}
      />
    );
  }

  function open(album: (typeof results)[number]) {
    router.push({
      pathname: '/soundtrack/[id]',
      params: {
        id: album.id,
        title: album.title,
        artist: album.artist,
        // Passed through so the album screen can render its header immediately,
        // without a second lookup.
        artwork: album.artworkUrl ?? '',
        url: album.externalUrl ?? '',
      },
    });
  }

  const cards = results.map((album) => (
    <PressableScale
      key={album.id}
      accessibilityRole="button"
      accessibilityLabel={`${album.title} by ${album.artist}`}
      scaleTo={0.96}
      style={styles.album}
      onPress={() => open(album)}>
      <Image
        source={album.artworkUrl ? { uri: album.artworkUrl } : undefined}
        style={[styles.artwork, { backgroundColor: theme.surfaceElevated }]}
        contentFit="cover"
        transition={200}
        accessibilityIgnoresInvertColors
      />
      <Text variant="caption" numberOfLines={2}>
        {album.title}
      </Text>
      <Text variant="micro" color="textMuted" numberOfLines={1}>
        {album.artist}
      </Text>
      {album.releaseYear && (
        <Text variant="micro" color="textMuted">
          {album.releaseYear} · {album.trackCount} tracks
        </Text>
      )}
    </PressableScale>
  ));

  if (isGrid) return <View style={styles.grid}>{cards}</View>;

  return (
    <View style={styles.section}>
      <SectionHeader title="Soundtrack" />
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.rail}>
        {cards}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: Spacing.x12 },
  rail: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x16 },
  album: { width: ALBUM_SIZE, gap: Spacing.x4 },
  artwork: { width: ALBUM_SIZE, height: ALBUM_SIZE, borderRadius: Radius.image },
});
