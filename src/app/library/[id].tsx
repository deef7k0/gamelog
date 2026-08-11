import { useQuery } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { GameTile, gridItemWidth } from '@/components/gaming/game-tile';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Skeleton } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import { getLibraryStatistics, getOwnedGames } from '@/lib/api';
import {
  availableSorts,
  formatPlaytime,
  formatPlaytimeLong,
  requireProvider,
  type LibrarySort,
} from '@/lib/gaming';
import { useAuth } from '@/store/auth';

/** Four across, matching the poster grids elsewhere in the app. */
const COLUMNS = 4;
const GAP = Spacing.x8;

type LibraryTab = 'games' | 'stats';

const TABS = [
  { key: 'games' as const, label: 'Games' },
  { key: 'stats' as const, label: 'Statistics' },
];

/**
 * A user's Steam library.
 *
 * Two tabs: the grid, and generated statistics. Sorting is done server-side
 * through the ordering in `getOwnedGames` rather than in JavaScript, because a
 * 900-game library sorted on the client would re-sort the whole array on every
 * keystroke of the search box.
 */
export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  const [tab, setTab] = useState<LibraryTab>('games');
  const [sort, setSort] = useState<LibrarySort>('most-played');
  const [search, setSearch] = useState('');

  const provider = requireProvider('steam');
  const account = useLinkedAccount(id ?? null);

  // Only the owner's own library syncs — visiting a profile must never trigger
  // API calls against someone else's Steam account.
  useGamingSync({ userId: id ?? null, enabled: isSelf, sections: ['library', 'achievements'] });

  const games = useQuery({
    queryKey: ['gaming-library', 'steam', id, sort, search.trim()],
    queryFn: () => getOwnedGames(id!, { sort, search: search.trim() || undefined }),
    enabled: !!id,
  });

  const stats = useQuery({
    queryKey: ['gaming-library-stats', 'steam', id],
    queryFn: () => getLibraryStatistics(id!),
    enabled: !!id && tab === 'stats',
  });

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  if (!id) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <EmptyState title="Library not found" />
      </Screen>
    );
  }

  if (!account.isLoading && !account.data) {
    return (
      <Screen edges={['bottom']} padded insetHeader>
        <Stack.Screen options={{ title: 'Library' }} />
        <EmptyState
          title="No Steam account linked"
          message={
            isSelf
              ? 'Connect Steam from your profile to import your library.'
              : 'This person has not linked a Steam account.'
          }
        />
      </Screen>
    );
  }

  const isPrivate = account.data?.visibility === 'private';

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: 'Library' }} />

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {tab === 'games' ? (
        <FlatList
          data={games.data ?? []}
          key={`grid-${COLUMNS}`}
          numColumns={COLUMNS}
          keyExtractor={(game) => game.appId}
          renderItem={({ item }) => <GameTile game={item} width={tileWidth} ownerId={id} />}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <View style={styles.controls}>
              <TextField
                value={search}
                onChangeText={setSearch}
                placeholder="Search your library"
                autoCapitalize="none"
                autoCorrect={false}
              />

              {/* "Recently purchased" is absent for Steam on purpose: its Web
                  API exposes no purchase date, and a sort that quietly fell
                  back to last-played would misrepresent what it shows. */}
              <SortBar
                options={availableSorts(provider)}
                value={sort}
                onChange={setSort}
                accessibilityLabel="Sort this library"
              />

              {games.data && games.data.length > 0 && (
                <Text variant="caption" color="textMuted">
                  {games.data.length} {games.data.length === 1 ? 'game' : 'games'}
                </Text>
              )}
            </View>
          }
          ListEmptyComponent={
            games.isLoading ? (
              <GridSkeleton width={tileWidth} />
            ) : games.isError ? (
              <ErrorState error={games.error} />
            ) : isPrivate ? (
              <EmptyState
                title="Profile is Private"
                message="Steam is not sharing this library. Game details must be public to import it."
              />
            ) : search.trim() ? (
              <EmptyState
                title="No matches"
                message={`Nothing in the library matches "${search}".`}
              />
            ) : (
              <EmptyState
                title="Nothing here yet"
                message={isSelf ? 'Your library is still syncing.' : 'No games synced.'}
              />
            )
          }
        />
      ) : (
        <StatisticsTab
          data={stats.data}
          loading={stats.isLoading}
          error={stats.error}
          tileWidth={tileWidth}
          ownerId={id}
        />
      )}
    </Screen>
  );
}

// ---------------------------------------------------------------------------
// Statistics
// ---------------------------------------------------------------------------

function StatisticsTab({
  data,
  loading,
  error,
  tileWidth,
  ownerId,
}: {
  data: Awaited<ReturnType<typeof getLibraryStatistics>> | undefined;
  loading: boolean;
  error: unknown;
  tileWidth: number;
  ownerId: string;
}) {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.statsBody}>
        {Array.from({ length: 4 }).map((_, index) => (
          <Skeleton key={index} width="100%" height={64} radius={Radius.image} />
        ))}
      </View>
    );
  }

  if (error) return <ErrorState error={error} />;
  if (!data) return <EmptyState title="No statistics yet" />;

  return (
    <ScrollView contentContainerStyle={styles.statsBody} showsVerticalScrollIndicator={false}>
      <View style={styles.statsStack}>
        <View style={[styles.statGrid, { borderTopColor: theme.border }]}>
          <StatCell label="Games owned" value={data.totalGames.toLocaleString()} />
          <StatCell label="Total playtime" value={formatPlaytime(data.totalPlaytimeMinutes)} />
          <StatCell
            label="Average per game"
            value={formatPlaytime(Math.round(data.avgPlaytimeMinutes))}
            hint="Across played games"
          />
          <StatCell label="Never played" value={data.neverPlayed.toLocaleString()} />
        </View>

        <Text variant="bodySmall" color="textMuted">
          {formatPlaytimeLong(data.totalPlaytimeMinutes)} across {data.playedGames} played{' '}
          {data.playedGames === 1 ? 'game' : 'games'}.
        </Text>

        {data.mostPlayed.length > 0 && (
          <Section title="Most played">
            <View style={styles.railRow}>
              {data.mostPlayed.slice(0, 4).map((game) => (
                <GameTile key={game.appId} game={game} width={tileWidth} ownerId={ownerId} />
              ))}
            </View>
          </Section>
        )}

        {data.recentlyPlayed.length > 0 && (
          <Section title="Recently played">
            <View style={styles.railRow}>
              {data.recentlyPlayed.slice(0, 4).map((game) => (
                <GameTile key={game.appId} game={game} width={tileWidth} ownerId={ownerId} />
              ))}
            </View>
          </Section>
        )}
      </View>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="label" color="textSecondary">
        {title.toUpperCase()}
      </Text>
      {children}
    </View>
  );
}

function StatCell({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <View style={styles.statCell}>
      <Text variant="h3">{value}</Text>
      <Text variant="caption" color="textMuted">
        {label}
      </Text>
      {hint && (
        <Text variant="caption" color="textMuted">
          {hint}
        </Text>
      )}
    </View>
  );
}

function GridSkeleton({ width }: { width: number }) {
  return (
    <View style={styles.skeletonGrid}>
      {Array.from({ length: 12 }).map((_, index) => (
        <Skeleton key={index} width={width} height={width / (2 / 3)} radius={Radius.image} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  controls: { gap: Spacing.x12, paddingTop: Spacing.x16, paddingBottom: Spacing.x12 },
  statsBody: { padding: Spacing.x16, gap: Spacing.x12, paddingBottom: Spacing.x48 },
  statsStack: { gap: Spacing.x24 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: { width: '50%', gap: 1, paddingVertical: Spacing.x8 },
  section: { gap: Spacing.x8 },
  railRow: { flexDirection: 'row', gap: GAP },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
