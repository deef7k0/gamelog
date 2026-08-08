import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecommendationModule } from '@/lib/news/recommendations';

const RAIL_POSTER = 92;

/**
 * "Because you loved Hades" — one personalised rail.
 *
 * The heading names its seed so the suggestion is arguable rather than opaque,
 * and the seed itself is tappable so a reader who disagrees can go and change
 * the rating that produced it.
 *
 * The month's chart used to head this file as a hero-art widget; it is now
 * `DiscoverCarousel`, which shows ten games instead of one.
 */
export function RecommendationRail({ module }: { module: RecommendationModule }) {
  const theme = useTheme();

  return (
    <View style={styles.rail}>
      <View style={styles.railHead}>
        <Ionicons
          name={module.reason === 'loved' ? 'heart' : 'game-controller'}
          size={13}
          color={module.reason === 'loved' ? theme.danger : theme.textMuted}
        />
        <Link href={{ pathname: '/game/[id]', params: { id: module.seedGameId } }} asChild>
          <PressableScale accessibilityRole="button" scaleTo={0.98}>
            <Text variant="bodyStrong" numberOfLines={1}>
              {module.heading}
            </Text>
          </PressableScale>
        </Link>
      </View>

      <FlatList
        data={module.games}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(game) => game.id}
        contentContainerStyle={styles.railBody}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={item.title}
              scaleTo={0.95}>
              <View style={styles.railItem}>
                <Poster
                  coverUrl={item.coverUrl}
                  heroUrl={item.heroUrl}
                  title={item.title}
                  width={RAIL_POSTER}
                  rounded="image"
                />
                <Text variant="micro" numberOfLines={2}>
                  {item.title}
                </Text>
              </View>
            </PressableScale>
          </Link>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  rail: { gap: Spacing.x8 },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  railBody: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  railItem: { width: RAIL_POSTER, gap: 2 },
});
