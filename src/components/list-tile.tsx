import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ListSummary } from '@/lib/api';

const COLLAGE = 92;

/**
 * A list rendered as a 2x2 cover collage plus metadata.
 *
 * Uses whatever art the first four games have — portrait cover preferred,
 * landscape hero as fallback — and fills empty quadrants with the surface
 * colour so a one-game list still reads as a tile rather than a broken grid.
 */
export function ListTile({ list }: { list: ListSummary }) {
  const theme = useTheme();
  const quadrants = Array.from({ length: 4 }, (_, index) => list.covers[index] ?? null);

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={list.title}
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.row, { backgroundColor: theme.surface }])}>
        <View style={[styles.collage, { backgroundColor: theme.surfaceElevated }]}>
          {quadrants.map((cover, index) => {
            const uri = cover?.cover_url ?? cover?.hero_url ?? null;
            return (
              <View key={index} style={styles.quadrant}>
                {uri && (
                  <Image
                    source={{ uri }}
                    style={styles.quadrantImage}
                    contentFit="cover"
                    transition={150}
                    accessibilityIgnoresInvertColors
                  />
                )}
              </View>
            );
          })}
        </View>

        <View style={styles.body}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {list.title}
          </Text>

          {list.description && (
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {list.description}
            </Text>
          )}

          <View style={styles.meta}>
            <Text variant="micro" color="textMuted">
              {list.itemCount} {list.itemCount === 1 ? 'game' : 'games'}
            </Text>
            {list.is_ranked && (
              <View style={styles.metaItem}>
                <Ionicons name="list" size={11} color={theme.textMuted} />
                <Text variant="micro" color="textMuted">
                  Ranked
                </Text>
              </View>
            )}
            {list.kind === 'tier' && (
              <View style={styles.metaItem}>
                <Ionicons name="layers" size={11} color={theme.accent} />
                <Text variant="micro" style={{ color: theme.accent }}>
                  Tier list
                </Text>
              </View>
            )}
          </View>
        </View>

        <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.four,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  collage: {
    width: COLLAGE,
    height: COLLAGE,
    borderRadius: Radius.medium,
    overflow: 'hidden',
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  quadrant: { width: '50%', height: '50%' },
  quadrantImage: { width: '100%', height: '100%' },
  body: { flex: 1, gap: Spacing.one },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
});
