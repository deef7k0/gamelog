import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridItemWidth } from '@/components/gaming/game-tile';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ListItem } from '@/lib/api';
import type { ProfileAchievementStats } from '@/lib/database.types';

/** Four across, edge to edge — the same rule every poster grid in the app uses. */
const FAVORITE_COLUMNS = 4;
const FAVORITE_GAP = Spacing.two;

/**
 * Profile widgets.
 *
 * Neither sits in a card. They are sections of the profile, not objects
 * floating on it, so a hairline and their own space separate them — which also
 * hands the favourites row the full page width it needs.
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
  const { width } = useWindowDimensions();

  /*
   * Four covers spanning the page.
   *
   * They were a fixed 52dp, which left most of a phone's width empty and made
   * someone's top four look like a footnote. This is the one thing on a profile
   * people screenshot, so it takes the same width the collection and library
   * grids take — about 83dp a cover on a 390dp phone rather than 52.
   */
  const posterWidth = gridItemWidth(
    Math.min(width, MaxContentWidth),
    FAVORITE_COLUMNS,
    Spacing.four,
    FAVORITE_GAP
  );

  return (
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
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
          {items.slice(0, FAVORITE_COLUMNS).map((item) => (
            <Link
              key={item.game_id}
              href={{ pathname: '/game/[id]', params: { id: item.game_id } }}
              asChild>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={item.game?.title ?? 'Favourite game'}
                scaleTo={0.94}>
                <Poster
                  coverUrl={item.game?.cover_url}
                  heroUrl={item.game?.hero_url}
                  title={item.game?.title}
                  width={posterWidth}
                  rounded="small"
                />
              </PressableScale>
            </Link>
          ))}

          {/* Empty slots so the row keeps its shape below four picks. */}
          {Array.from({ length: Math.max(0, FAVORITE_COLUMNS - items.length) }).map((_, index) => (
            <View
              key={`slot-${index}`}
              style={[
                styles.emptySlot,
                {
                  width: posterWidth,
                  height: posterWidth / (2 / 3),
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
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
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
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
          tint={theme.text}
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
  widget: {
    flex: 1,
    gap: Spacing.three,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  widgetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  widgetTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  posters: { flexDirection: 'row', gap: FAVORITE_GAP },
  emptySlot: {
    borderRadius: Radius.small,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  statRow: { flexDirection: 'row', justifyContent: 'space-between' },
  stat: { alignItems: 'center', gap: 1, flex: 1 },
});
