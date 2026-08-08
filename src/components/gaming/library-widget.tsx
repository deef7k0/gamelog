import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { steamCoverUrl, steamHeaderUrl } from '@/components/gaming/game-tile';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPlaytime } from '@/lib/gaming';
import type { GamingStats, OwnedGame } from '@/lib/gaming';

const WIDGET_POSTER = 52;

/**
 * Library widget for the profile header.
 *
 * Deliberately the same shape as `FavoritesWidget`: one short row of four
 * posters, a muted heading, and no section chrome. It sits in the same stack, so
 * anything taller would push the tab bar off the first screen.
 *
 * Tapping it opens the full library.
 */
export function LibraryWidget({
  profileId,
  games,
  stats,
  loading = false,
  isPrivate = false,
}: {
  profileId: string;
  games: OwnedGame[];
  stats?: GamingStats | null;
  loading?: boolean;
  /** Steam profile is private — say so rather than showing an empty shelf. */
  isPrivate?: boolean;
}) {
  const theme = useTheme();

  return (
    <Link href={{ pathname: '/library/[id]', params: { id: profileId } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Open Steam library"
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.widget, { borderTopColor: theme.border }])}>
        <View style={styles.head}>
          <View style={styles.title}>
            <Ionicons name="library" size={13} color={theme.primary} />
            <Text variant="micro" color="textSecondary">
              LIBRARY
            </Text>
          </View>

          {stats && (
            <Text variant="micro" color="textMuted">
              {stats.gamesOwned} · {formatPlaytime(stats.totalPlaytimeMinutes)}
            </Text>
          )}
        </View>

        {loading ? (
          <View style={styles.posters}>
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton
                key={index}
                width={WIDGET_POSTER}
                height={WIDGET_POSTER / (2 / 3)}
                radius={Radius.image}
              />
            ))}
          </View>
        ) : isPrivate ? (
          <Text variant="micro" color="textMuted">
            Steam library is private.
          </Text>
        ) : games.length > 0 ? (
          <View style={styles.posters}>
            {games.slice(0, 4).map((game) => (
              <Poster
                key={game.appId}
                coverUrl={steamCoverUrl(game.appId)}
                heroUrl={steamHeaderUrl(game.appId)}
                title={game.name}
                width={WIDGET_POSTER}
                rounded="image"
              />
            ))}
            {Array.from({ length: Math.max(0, 4 - games.length) }).map((_, index) => (
              <View
                key={`slot-${index}`}
                style={[
                  styles.emptySlot,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
              />
            ))}
          </View>
        ) : (
          <Text variant="micro" color="textMuted">
            No games synced yet.
          </Text>
        )}
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  /* Matches `FavoritesWidget` exactly — same rule, same top padding. The two sit
     in one stack, and a card next to a section would read as two systems. */
  widget: {
    flex: 1,
    gap: Spacing.x8,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  posters: { flexDirection: 'row', gap: Spacing.x4 + 2 },
  emptySlot: {
    width: WIDGET_POSTER,
    height: WIDGET_POSTER / (2 / 3),
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
});
