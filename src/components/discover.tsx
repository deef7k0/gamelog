import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { PlatformMarks } from '@/components/ui/platform-chip';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { RecommendationModule } from '@/lib/news/recommendations';

const RAIL_POSTER = 92;

/** Lifts the tappable seed heading from ~24dp to the platform floor. */
const SEED_SLOP = { top: 12, bottom: 12, left: 8, right: 8 };

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
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`${module.heading} — open the game this is based on`}
            /* The heading is the only way back to the rating that produced this
               rail, and as a bare line of type it was an ~18dp target. Slop
               rather than padding, so the row's height stays set by the icon
               beside it. See the same call in `home-section.tsx`. */
            hitSlop={SEED_SLOP}
            scaleTo={0.98}>
            {/* `h2` per DESIGN.md § 17 — this is a band heading and it was `h5`,
                13px, the same size as the game titles in the rail beneath it. */}
            <Text variant="h2" numberOfLines={1}>
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
                  edition={item.edition}
                  steamAppId={item.steamAppId}
                  width={RAIL_POSTER}
                  rounded="image"
                />
                <Text variant="caption" numberOfLines={2}>
                  {item.title}
                </Text>
                {/* The same fact the search results carry, at rail density.
                    A cover and a title alone made Discover look like a
                    different app from the list one tap away — and "can I play
                    this" is the question a recommendation most needs to answer,
                    since a rail of games for a console you do not own is worse
                    than no rail. */}
                <PlatformMarks families={platformFamilies(item.platforms)} />
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
