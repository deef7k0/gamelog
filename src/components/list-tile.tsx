import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Poster } from '@/components/ui/poster';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ListSummary } from '@/lib/api';

/** Width of the box art. 2:3 makes the tile 87 tall. */
const COVER = 58;

/**
 * A collection rendered as one piece of box art, its metadata, and a chevron.
 *
 * It used to be a 2x2 collage of the first four covers. Four covers at 46px
 * each is four illegible thumbnails — you could tell a collection had games in
 * it but not which ones — and it made every collection look the same shape
 * regardless of what was in it. One cover at full size is recognisable at a
 * glance, and the owner picks which one (`cover_game_id`, migration 0014), so
 * the tile can lead with the game that actually represents the collection.
 *
 * The chevron sits in its own panel against the right edge rather than floating
 * beside the text: it is the affordance for the whole row, and giving it a
 * surface makes the row read as a thing you open rather than a line of text
 * with an arrow after it.
 */
export function ListTile({ list }: { list: ListSummary }) {
  const theme = useTheme();

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${list.title}, ${list.itemCount} ${
          list.itemCount === 1 ? 'game' : 'games'
        }`}
        scaleTo={0.98}
        style={StyleSheet.flatten([
          styles.row,
          Elevation.card,
          { backgroundColor: theme.surface },
        ])}>
        <Poster
          coverUrl={list.preview?.cover_url ?? null}
          heroUrl={list.preview?.hero_url ?? null}
          title={list.title}
          width={COVER}
        />

        <View style={styles.body}>
          <Text variant="h5" numberOfLines={2}>
            {list.title}
          </Text>

          {list.description && (
            <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
              {list.description}
            </Text>
          )}

          <View style={styles.meta}>
            <Text variant="caption" color="textMuted">
              {list.itemCount} {list.itemCount === 1 ? 'game' : 'games'}
            </Text>
            {list.is_ranked && (
              <View style={styles.metaItem}>
                <Ionicons name="list" size={11} color={theme.textMuted} />
                <Text variant="caption" color="textMuted">
                  Ranked
                </Text>
              </View>
            )}
            {list.kind === 'tier' && (
              <View style={styles.metaItem}>
                <Ionicons name="layers" size={11} color={theme.primaryText} />
                <Text variant="caption" style={{ color: theme.accent }}>
                  Tier list
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Decorative: the row already carries the accessible label. */}
        <View
          style={[styles.arrow, { backgroundColor: theme.surfaceElevated }]}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants">
          <Ionicons name="chevron-forward" size={20} color={theme.textSecondary} />
        </View>
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x8,
    paddingRight: Spacing.x4,
    borderRadius: Radius.card,
  },
  body: { flex: 1, gap: Spacing.x4 },
  meta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12, marginTop: 2 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* Full-height panel pinned to the right edge, matching the cover's height so
     the row reads as two blocks with content between them. */
  arrow: {
    alignSelf: 'stretch',
    width: 34,
    borderRadius: Radius.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
