import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { steamCoverUrl, steamHeaderUrl } from '@/components/gaming/game-tile';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import {
  getAchievementsForApp,
  getGameAchievementProgress,
  getGamingStats,
  getRarestUnlocks,
  getRecentUnlocks,
} from '@/lib/api';
import { completionPercent } from '@/lib/gaming';
import { timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';
import type { GameAchievementProgress, ProviderAchievement } from '@/lib/gaming';

const GAME_POSTER = 44;
const SHOWCASE_ICON = 56;

/**
 * Steam achievements across every game with at least one unlock.
 *
 * The showcase is ordered by *rarity*, not recency. A 0.4% unlock is the thing
 * worth showing off; the most recent unlock is usually a tutorial step. Recency
 * gets its own row underneath, where it belongs.
 */
export default function GamingAchievementsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  const account = useLinkedAccount(id ?? null);
  useGamingSync({ userId: id ?? null, enabled: isSelf, sections: ['achievements'] });

  const stats = useQuery({
    queryKey: ['gaming-stats', 'steam', id],
    queryFn: () => getGamingStats(id!),
    enabled: !!id,
  });

  const progress = useQuery({
    queryKey: ['gaming-achievement-progress', 'steam', id],
    queryFn: () => getGameAchievementProgress(id!),
    enabled: !!id,
  });

  const rarest = useQuery({
    queryKey: ['gaming-rarest-unlocks', 'steam', id],
    queryFn: () => getRarestUnlocks(id!, { limit: 8 }),
    enabled: !!id,
  });

  const recent = useQuery({
    queryKey: ['gaming-recent-unlocks', 'steam', id],
    queryFn: () => getRecentUnlocks(id!, { limit: 6 }),
    enabled: !!id,
  });

  if (!id) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <EmptyState title="Not found" />
      </Screen>
    );
  }

  if (!account.isLoading && !account.data) {
    return (
      <Screen edges={['bottom']} padded insetHeader>
        <Stack.Screen options={{ title: 'Achievements' }} />
        <EmptyState
          title="No Steam account linked"
          message={
            isSelf
              ? 'Connect Steam from your profile to import achievements.'
              : 'This person has not linked a Steam account.'
          }
        />
      </Screen>
    );
  }

  const isPrivate = account.data?.visibility === 'private';
  const games = progress.data ?? [];
  const overall = stats.data;

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: 'Steam Achievements' }} />

      <FlatList
        data={games}
        keyExtractor={(game) => game.appId}
        renderItem={({ item }) => <GameProgressRow game={item} userId={id} />}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.header}>
            {stats.isLoading ? (
              <Skeleton width="100%" height={96} radius={Radius.small} />
            ) : overall ? (
              <OverallCard stats={overall} />
            ) : null}

            {rarest.data && rarest.data.length > 0 && (
              <Showcase title="Achievement showcase" items={rarest.data} showRarity />
            )}

            {recent.data && recent.data.length > 0 && (
              <Showcase title="Recently unlocked" items={recent.data} />
            )}

            {games.length > 0 && (
              <Text variant="micro" color="textSecondary">
                {`BY GAME · ${games.length}`}
              </Text>
            )}
          </View>
        }
        ListEmptyComponent={
          progress.isLoading ? (
            <View style={styles.listSkeleton}>
              {Array.from({ length: 6 }).map((_, index) => (
                <Skeleton key={index} width="100%" height={64} radius={Radius.medium} />
              ))}
            </View>
          ) : progress.isError ? (
            <ErrorState error={progress.error} />
          ) : isPrivate ? (
            <EmptyState
              title="Profile is Private"
              message="Steam game details must be public for achievements to be imported."
            />
          ) : (
            <EmptyState
              title="No achievements yet"
              message={
                isSelf
                  ? 'Achievements sync a batch at a time and fill in your most-played games first.'
                  : 'Nothing unlocked yet.'
              }
            />
          )
        }
      />
    </Screen>
  );
}

function OverallCard({
  stats,
}: {
  stats: NonNullable<Awaited<ReturnType<typeof getGamingStats>>>;
}) {
  const theme = useTheme();
  const percent = completionPercent(stats.achievementsUnlocked, stats.achievementsTotal);

  return (
    <View style={[styles.overall, { borderTopColor: theme.border }]}>
      <View style={styles.overallRow}>
        <Metric value={stats.achievementsUnlocked.toLocaleString()} label="Unlocked" />
        <Metric value={`${percent}%`} label="Completion" tint={theme.success} />
        <Metric value={stats.perfectGames.toLocaleString()} label="Perfect" tint={theme.platinum} />
      </View>

      {/* A single bar for overall completion reads faster than the ratio alone. */}
      <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
        <View style={[styles.fill, { width: `${percent}%`, backgroundColor: theme.success }]} />
      </View>

      <Text variant="micro" color="textMuted">
        {stats.achievementsUnlocked.toLocaleString()} of {stats.achievementsTotal.toLocaleString()}{' '}
        across scanned games
      </Text>
    </View>
  );
}

function Metric({ value, label, tint }: { value: string; label: string; tint?: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="heading" style={tint ? { color: tint } : undefined}>
        {value}
      </Text>
      <Text variant="micro" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

/** Horizontal rail of achievement icons. */
function Showcase({
  title,
  items,
  showRarity = false,
}: {
  title: string;
  items: ProviderAchievement[];
  showRarity?: boolean;
}) {
  const theme = useTheme();

  return (
    <View style={styles.section}>
      <Text variant="micro" color="textSecondary">
        {title.toUpperCase()}
      </Text>

      <FlatList
        data={items}
        horizontal
        showsHorizontalScrollIndicator={false}
        keyExtractor={(item) => `${item.appId}:${item.key}`}
        contentContainerStyle={styles.rail}
        renderItem={({ item }) => (
          <View style={styles.showcaseItem}>
            <View
              style={[
                styles.showcaseIcon,
                { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
              ]}>
              {item.iconUrl ? (
                <Image
                  source={{ uri: item.iconUrl }}
                  style={styles.showcaseImage}
                  contentFit="cover"
                  transition={180}
                  accessibilityIgnoresInvertColors
                />
              ) : (
                <Ionicons name="trophy" size={22} color={theme.platinum} />
              )}
            </View>

            <Text variant="micro" numberOfLines={2} style={styles.showcaseName}>
              {item.name}
            </Text>

            {showRarity && item.globalPercent !== null ? (
              <Text variant="micro" style={{ color: theme.accent }}>
                {item.globalPercent < 1
                  ? `${item.globalPercent.toFixed(1)}%`
                  : `${Math.round(item.globalPercent)}%`}
              </Text>
            ) : item.unlockedAt ? (
              <Text variant="micro" color="textMuted">
                {timeAgo(item.unlockedAt)}
              </Text>
            ) : null}
          </View>
        )}
      />
    </View>
  );
}

/**
 * One game's progress, expanding in place to its individual achievements.
 *
 * An accordion rather than a pushed screen: the data is already synced, the list
 * is usually short, and expanding keeps the reader's place in a list they may be
 * scanning for perfect games. The detail query is lazy, so the timestamps for
 * forty games are not fetched to render forty collapsed rows.
 */
function GameProgressRow({ game, userId }: { game: GameAchievementProgress; userId: string }) {
  const theme = useTheme();
  const [expanded, setExpanded] = useState(false);

  const detail = useQuery({
    queryKey: ['gaming-achievements-app', 'steam', userId, game.appId],
    queryFn: () => getAchievementsForApp(userId, game.appId),
    enabled: expanded,
  });

  return (
    <View style={[styles.gameCard, { borderTopColor: theme.border }]}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${game.name}, ${game.unlocked} of ${game.total} unlocked`}
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((current) => !current)}
        scaleTo={0.99}
        style={styles.gameRow}>
        <Poster
          coverUrl={steamCoverUrl(game.appId)}
          heroUrl={steamHeaderUrl(game.appId)}
          title={game.name}
          width={GAME_POSTER}
          rounded="small"
        />

        <View style={styles.gameBody}>
          <View style={styles.gameTitleRow}>
            <Text variant="bodyStrong" numberOfLines={1} style={styles.gameName}>
              {game.name}
            </Text>
            {game.isPerfect && <Ionicons name="trophy" size={13} color={theme.platinum} />}
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={14}
              color={theme.textMuted}
            />
          </View>

          <View style={[styles.track, { backgroundColor: theme.surfaceElevated }]}>
            <View
              style={[
                styles.fill,
                {
                  width: `${game.percent}%`,
                  backgroundColor: game.isPerfect ? theme.platinum : theme.success,
                },
              ]}
            />
          </View>

          <Text variant="micro" color="textMuted" numberOfLines={1}>
            {game.unlocked}/{game.total} · {game.percent}%
            {game.lastUnlockedName ? ` · ${game.lastUnlockedName}` : ''}
          </Text>
        </View>
      </PressableScale>

      {expanded && (
        <View style={[styles.detail, { borderTopColor: theme.border }]}>
          {detail.isLoading ? (
            <Skeleton width="100%" height={40} radius={Radius.small} />
          ) : detail.data && detail.data.length > 0 ? (
            detail.data.map((achievement) => (
              <AchievementRow key={achievement.key} achievement={achievement} />
            ))
          ) : (
            <Text variant="micro" color="textMuted">
              No achievement detail synced for this game yet.
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

/**
 * One achievement inside an expanded game.
 *
 * Steam ships two icons per achievement — colour and greyscale — so a locked one
 * uses its own grey art where available rather than a dimmed colour icon.
 */
function AchievementRow({ achievement }: { achievement: ProviderAchievement }) {
  const theme = useTheme();
  const iconUri = achievement.unlocked ? achievement.iconUrl : achievement.iconGrayUrl;

  return (
    <View style={styles.achievementRow}>
      <View
        style={[
          styles.achievementIcon,
          {
            backgroundColor: theme.surfaceElevated,
            // Locked achievements are dimmed, not hidden, so the list reads as
            // "what is left" rather than only as a trophy case.
            opacity: achievement.unlocked ? 1 : 0.45,
          },
        ]}>
        {iconUri ? (
          <Image
            source={{ uri: iconUri }}
            style={styles.showcaseImage}
            contentFit="cover"
            transition={140}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <Ionicons
            name={achievement.unlocked ? 'trophy' : 'lock-closed-outline'}
            size={14}
            color={achievement.unlocked ? theme.platinum : theme.textMuted}
          />
        )}
      </View>

      <View style={styles.achievementBody}>
        <Text
          variant="caption"
          color={achievement.unlocked ? 'text' : 'textMuted'}
          numberOfLines={1}>
          {achievement.name}
        </Text>

        <Text variant="micro" color="textMuted" numberOfLines={1}>
          {achievement.unlockedAt
            ? new Date(achievement.unlockedAt).toLocaleDateString(undefined, {
                day: 'numeric',
                month: 'short',
                year: 'numeric',
              })
            : 'Locked'}
          {achievement.globalPercent !== null
            ? ` · ${
                achievement.globalPercent < 1
                  ? achievement.globalPercent.toFixed(1)
                  : Math.round(achievement.globalPercent)
              }% of players`
            : ''}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.seven },
  header: { gap: Spacing.five, paddingVertical: Spacing.four },
  listSkeleton: { gap: Spacing.three },
  overall: { paddingBottom: Spacing.four, gap: Spacing.three },
  overallRow: { flexDirection: 'row', justifyContent: 'space-between' },
  metric: { alignItems: 'center', gap: 1, flex: 1 },
  track: { height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: Radius.pill },
  section: { gap: Spacing.two },
  rail: { gap: Spacing.three, paddingRight: Spacing.four },
  showcaseItem: { width: SHOWCASE_ICON + 16, alignItems: 'center', gap: Spacing.one },
  showcaseIcon: {
    width: SHOWCASE_ICON,
    height: SHOWCASE_ICON,
    borderRadius: Radius.medium,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
  },
  showcaseImage: { width: '100%', height: '100%' },
  showcaseName: { textAlign: 'center' },
  gameCard: { borderTopWidth: StyleSheet.hairlineWidth },
  gameRow: {
    flexDirection: 'row',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    alignItems: 'center',
  },
  gameBody: { flex: 1, gap: Spacing.one + 2 },
  gameTitleRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  gameName: { flex: 1 },
  detail: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: Spacing.three,
    gap: Spacing.two + 2,
  },
  achievementRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  achievementIcon: {
    width: 28,
    height: 28,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  achievementBody: { flex: 1, gap: 1 },
});
