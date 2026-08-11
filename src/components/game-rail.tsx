import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameCharacter } from '@/lib/games/igdb';
import type { GameSearchResult } from '@/lib/games';

const RAIL_POSTER = 92;
const CAST_AVATAR = 56;

/**
 * Horizontal rails shared by the game Overview tab, the studio catalogue and the
 * franchise section.
 *
 * These are browsing surfaces, so they use `<Poster />`. `<GameCase />` is
 * reserved for dedicated game pages — see the rule in CLAUDE.md.
 */

export function GamePosterRail({
  games,
  emptyLabel,
}: {
  games: GameSearchResult[];
  emptyLabel?: string;
}) {
  if (games.length === 0) {
    return emptyLabel ? (
      <Text variant="bodySmall" color="textMuted">
        {emptyLabel}
      </Text>
    ) : null;
  }

  return (
    <FlatList
      data={games}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(game) => game.id}
      contentContainerStyle={styles.rail}
      renderItem={({ item }) => (
        <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
          <PressableScale accessibilityRole="button" accessibilityLabel={item.title} scaleTo={0.95}>
            <View style={styles.railItem}>
              <Poster
                coverUrl={item.coverUrl}
                heroUrl={item.heroUrl}
                title={item.title}
                width={RAIL_POSTER}
                rounded="image"
              />
              <Text variant="caption" numberOfLines={2}>
                {item.title}
              </Text>
              {item.releaseYear !== null && (
                <Text variant="caption" color="textMuted">
                  {item.releaseYear}
                </Text>
              )}
            </View>
          </PressableScale>
        </Link>
      )}
    />
  );
}

/**
 * Cast rail — circular portraits with the character name underneath.
 *
 * `actor` is rendered when a provider supplies it and quietly omitted when not.
 * IGDB never does: its v4 API dropped the `credits` endpoint and exposes no
 * actor data, so on IGDB-sourced games this shows characters only. That is a
 * data limitation, not a layout decision, which is why the row is built to take
 * a second line rather than assuming one.
 */
export function CastRail({ cast }: { cast: GameCharacter[] }) {
  const theme = useTheme();
  if (cast.length === 0) return null;

  return (
    <FlatList
      data={cast}
      horizontal
      showsHorizontalScrollIndicator={false}
      keyExtractor={(person) => String(person.id)}
      contentContainerStyle={styles.rail}
      renderItem={({ item }) => (
        <View style={styles.castItem}>
          <View style={[styles.castAvatar, { backgroundColor: theme.surfaceElevated }]}>
            {item.portraitUrl ? (
              <Image
                source={{ uri: item.portraitUrl }}
                style={styles.fill}
                contentFit="cover"
                transition={180}
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Text variant="h3" color="textMuted">
                {item.name.trim().charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <Text variant="caption" numberOfLines={2} style={styles.castName}>
            {item.name}
          </Text>

          {item.actor && (
            <Text variant="caption" color="textMuted" numberOfLines={1} style={styles.castName}>
              {item.actor}
            </Text>
          )}
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  rail: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  railItem: { width: RAIL_POSTER, gap: 2 },
  castItem: { width: CAST_AVATAR + 12, alignItems: 'center', gap: Spacing.x4 },
  castAvatar: {
    width: CAST_AVATAR,
    height: CAST_AVATAR,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  fill: { width: '100%', height: '100%' },
  castName: { textAlign: 'center' },
});
