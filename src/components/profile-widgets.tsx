import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ListItem } from '@/lib/api';
import type { ProfileAchievementStats } from '@/lib/database.types';

const FAVORITE_POSTER = 52;

/**
 * Compact profile widgets.
 *
 * Both sit between the profile header and the tab bar, so they have to earn
 * their vertical space — each is a single short row rather than a full section
 * with its own heading and horizontal rail.
 */

export function FavoritesWidget({
  items,
  listId,
  isSelf,
}: {
  items: ListItem[];
  listId?: string;
  isSelf: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={[styles.widget, { backgroundColor: theme.surface }]}>
      <View style={styles.widgetHead}>
        <View style={styles.widgetTitle}>
          <Ionicons name="star" size={13} color={theme.accent} />
          <Text variant="micro" color="textSecondary">
            FAVOURITES
          </Text>
        </View>

        {isSelf && listId && (
          <Link href={{ pathname: '/list/[id]', params: { id: listId } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.9}>
              <Text variant="micro" color="primary">
                Edit
              </Text>
            </PressableScale>
          </Link>
        )}
      </View>

      {items.length > 0 ? (
        <View style={styles.posters}>
          {items.slice(0, 4).map((item) => (
            <Link
              key={item.game_id}
              href={{ pathname: '/game/[id]', params: { id: item.game_id } }}
              asChild>
              <PressableScale accessibilityRole="button" scaleTo={0.94}>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={FAVORITE_POSTER}
                  rounded="small"
                />
              </PressableScale>
            </Link>
          ))}
          {/* Empty slots so the row keeps its shape below four picks. */}
          {Array.from({ length: Math.max(0, 4 - items.length) }).map((_, index) => (
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
          {isSelf ? 'Star up to four games to pin them here.' : 'No favourites yet.'}
        </Text>
      )}
    </View>
  );
}

/**
 * Achievements widget.
 *
 * Tapping through opens the per-game Steam achievement breakdown when a
 * `profileId` is supplied. The numbers shown here are the app's own logged
 * achievements; the screen behind it is the imported Steam picture, which is the
 * richer of the two and the one worth drilling into.
 */
export function AchievementsWidget({
  stats,
  profileId,
}: {
  stats?: ProfileAchievementStats;
  profileId?: string;
}) {
  const theme = useTheme();

  const body = (
    <View style={[styles.widget, { backgroundColor: theme.surface }]}>
      <View style={styles.widgetHead}>
        <View style={styles.widgetTitle}>
          <Ionicons name="trophy" size={13} color={theme.platinum} />
          <Text variant="micro" color="textSecondary">
            ACHIEVEMENTS
          </Text>
        </View>
        {profileId && <Ionicons name="chevron-forward" size={13} color={theme.textMuted} />}
      </View>

      <View style={styles.statRow}>
        <Stat value={stats?.platinums} label="Platinum" tint={theme.platinum} />
        <Stat value={stats?.completions} label="100%" tint={theme.success} />
        <Stat value={stats?.achievements_unlocked} label="Unlocked" tint={theme.accent} />
        <Stat
          value={stats ? Math.round(stats.hours_played) : undefined}
          label="Hours"
          tint={theme.primary}
        />
      </View>
    </View>
  );

  if (!profileId) return body;

  return (
    <Link href={{ pathname: '/gaming-achievements/[id]', params: { id: profileId } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Open achievements"
        scaleTo={0.98}
        style={styles.flex}>
        {body}
      </PressableScale>
    </Link>
  );
}

function Stat({ value, label, tint }: { value?: number; label: string; tint: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="bodyStrong" style={{ color: tint }}>
        {value ?? '—'}
      </Text>
      <Text variant="micro" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  widget: { borderRadius: Radius.medium, padding: Spacing.three, gap: Spacing.two, flex: 1 },
  widgetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  widgetTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  posters: { flexDirection: 'row', gap: Spacing.one + 2 },
  emptySlot: {
    width: FAVORITE_POSTER,
    height: FAVORITE_POSTER / (2 / 3),
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 1, flex: 1 },
});
