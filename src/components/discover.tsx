import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ChartEntry } from '@/lib/news';
import type { RecommendationModule } from '@/lib/news/recommendations';

const MINI_POSTER = 46;
const RAIL_POSTER = 92;

/**
 * The Top 10 widget that heads the Discover feed.
 *
 * Deliberately the loudest thing on the screen: hero art from the number-one
 * game, the headline over it, and the next few covers as a strip underneath so
 * the widget previews its own contents rather than being a bare button.
 *
 * Monthly to match the screen it opens — a widget that promised "this week" and
 * led to a page headed "this month" would be reporting two different charts.
 */
export function TopTenWidget({ entries, loading }: { entries: ChartEntry[]; loading: boolean }) {
  const theme = useTheme();

  if (loading) {
    return <Skeleton width="100%" height={188} radius={Radius.large} />;
  }
  if (entries.length === 0) return null;

  const lead = entries[0];
  const rest = entries.slice(1, 6);

  return (
    <Link href="/top-games" asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Top 10 most popular games this month"
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.widget, { backgroundColor: theme.surface }])}>
        <View style={styles.widgetHero}>
          {lead.heroUrl || lead.coverUrl ? (
            <Image
              source={{ uri: lead.heroUrl ?? lead.coverUrl! }}
              style={styles.widgetImage}
              contentFit="cover"
              transition={240}
              accessibilityIgnoresInvertColors
            />
          ) : (
            <View style={[styles.widgetImage, { backgroundColor: theme.surfaceElevated }]} />
          )}

          <LinearGradient
            colors={['transparent', 'rgba(0,0,0,0.85)']}
            style={styles.widgetFade}
            pointerEvents="none"
          />

          <View style={styles.widgetLabel}>
            <Text variant="micro" style={styles.onImage}>
              THIS MONTH
            </Text>
            <Text variant="heading" style={styles.onImage}>
              Top 10 Most Popular
            </Text>
          </View>
        </View>

        <View style={styles.widgetStrip}>
          {rest.map((entry) => (
            <View key={entry.gameId} style={styles.stripItem}>
              <Poster
                coverUrl={entry.coverUrl}
                heroUrl={entry.heroUrl}
                title={entry.title}
                width={MINI_POSTER}
                rounded="small"
              />
              <View style={[styles.stripRank, { backgroundColor: theme.scrim }]}>
                <Text variant="micro" style={styles.onImage}>
                  {entry.rank}
                </Text>
              </View>
            </View>
          ))}

          <View style={styles.stripMore}>
            <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
          </View>
        </View>
      </PressableScale>
    </Link>
  );
}

/**
 * "Because you loved Hades" — one personalised rail.
 *
 * The heading names its seed so the suggestion is arguable rather than opaque,
 * and the seed itself is tappable so a reader who disagrees can go and change
 * the rating that produced it.
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
                  rounded="small"
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
  widget: { borderRadius: Radius.large, overflow: 'hidden' },
  widgetHero: { width: '100%' },
  widgetImage: { width: '100%', aspectRatio: HeroAspectRatio },
  widgetFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '80%' },
  widgetLabel: { position: 'absolute', left: Spacing.four, bottom: Spacing.three, gap: 1 },
  onImage: { color: '#FFFFFF' },
  widgetStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.three,
  },
  stripItem: { position: 'relative' },
  stripRank: {
    position: 'absolute',
    top: 2,
    left: 2,
    minWidth: 15,
    alignItems: 'center',
    paddingHorizontal: 3,
    borderRadius: Radius.small,
  },
  stripMore: { flex: 1, alignItems: 'flex-end' },
  rail: { gap: Spacing.two },
  railHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  railBody: { gap: Spacing.three, paddingRight: Spacing.four },
  railItem: { width: RAIL_POSTER, gap: 2 },
});
