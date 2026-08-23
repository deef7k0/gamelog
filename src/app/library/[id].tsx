import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  GameTile,
  gridItemWidth,
  steamCoverUrl,
  steamHeaderUrl,
} from '@/components/gaming/game-tile';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { SortBar } from '@/components/ui/sort-bar';
import { Skeleton } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { STATUS_LABEL } from '@/constants/status';
import { Radius, Spacing } from '@/constants/theme';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { useTheme } from '@/hooks/use-theme';
import { useGamingSync, useLinkedAccount } from '@/hooks/use-gaming';
import { getFavorites, getLibraryStatistics, getOwnedGames, getUserLogs } from '@/lib/api';
import type { ListItem } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import {
  availableSorts,
  formatPlaytime,
  formatPlaytimeLong,
  requireProvider,
  type LibrarySort,
  type OwnedGame,
} from '@/lib/gaming';
import { useAuth } from '@/store/auth';

/** Four across, matching the poster grids elsewhere in the app. */
const COLUMNS = 4;
const GAP = Spacing.x8;

type LibraryTab = 'all' | 'favourites' | 'owned' | 'logged' | 'stats';

/**
 * Everything a person's games can be filtered down to.
 *
 * `all` leads because it is the honest default — this screen is now about a
 * *person's games*, not about one storefront, and opening it on the Steam
 * subset would have kept the old framing with a new name.
 *
 * `owned` and `logged` answer questions the merged list cannot: "what do I
 * actually have on Steam" and "what have I written about". Keeping both is what
 * lets `all` be a merge rather than a compromise.
 */
const TAB_ORDER: LibraryTab[] = ['all', 'favourites', 'owned', 'logged', 'stats'];

const TAB_LABELS: Record<LibraryTab, string> = {
  all: 'All games',
  favourites: 'Favourites',
  owned: 'Owned',
  logged: 'Logged',
  stats: 'Statistics',
};

/**
 * A person's games.
 *
 * Was Steam-only, and gated behind a linked account — so for anyone who had
 * never connected Steam it was a screen that existed and always said "no
 * account linked". It now merges two sources: the Steam library, and everything
 * logged in this app. Only the Owned and Statistics tabs still need Steam, and
 * they say so individually instead of the whole screen refusing to open.
 *
 * Sorting and search stay server-side for `owned` through the ordering in
 * `getOwnedGames`, because a 900-game library re-sorted in JavaScript on every
 * keystroke is a dropped frame per character. The other tabs are short enough
 * to sort in memory.
 */
export default function LibraryScreen() {
  const { width } = useWindowDimensions();
  const { scrollY, onScroll } = useTopBarScroll();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  const [tab, setTab] = useState<LibraryTab>('all');
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

  /* Games logged in this app. Fetched for every tab except Owned, because the
     merged list and the Logged list both need it and it is one indexed query
     capped at 100 rows. */
  const logs = useQuery({
    queryKey: ['user-logs', id],
    queryFn: () => getUserLogs(id!),
    enabled: !!id && tab !== 'owned',
  });

  const favourites = useQuery({
    queryKey: ['favorites', id],
    queryFn: () => getFavorites(id!),
    enabled: !!id && (tab === 'favourites' || tab === 'all'),
  });

  /*
   * One list, whichever tab is showing.
   *
   * Built here rather than in four branches of the render so the grid below is
   * one `<FlatList>` with one key extractor — swapping tabs changes its data,
   * not its identity, which is what keeps the scroll position and the recycled
   * rows behaving.
   */
  const entries = useMemo<LibraryEntry[]>(() => {
    const owned = games.data ?? [];
    const logged = logs.data ?? [];

    switch (tab) {
      case 'owned':
        return owned.map(fromOwned);
      case 'logged':
        return logged.map(fromLog).filter((entry): entry is LibraryEntry => entry !== null);
      case 'favourites':
        return (favourites.data?.items ?? [])
          .map(fromFavourite)
          .filter((entry): entry is LibraryEntry => entry !== null);
      default:
        return mergeEntries(
          logged.map(fromLog).filter((entry): entry is LibraryEntry => entry !== null),
          owned.map(fromOwned)
        );
    }
  }, [tab, games.data, logs.data, favourites.data]);

  /* Counts sit inline on the tabs, the way a library reads them. Only the ones
     already fetched are shown — a number that appears a second after you tap is
     worse than no number. */
  const counts: Partial<Record<LibraryTab, number>> = {
    all: entries.length || undefined,
    favourites: favourites.data?.items?.length,
    owned: games.data?.length,
    logged: logs.data?.length,
  };

  const tabs = TAB_ORDER.map((key) => ({
    key,
    label: TAB_LABELS[key],
    count: counts[key] ?? null,
  }));

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);

  if (!id) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar title="Library" back />}>
        <EmptyState title="Library not found" />
      </Screen>
    );
  }

  const isPrivate = account.data?.visibility === 'private';
  const noSteam = !account.isLoading && !account.data;

  return (
    /* The tab bar under the header switches the whole page, so the bar it
       belongs to stays put — `scrollY` goes to the grid, which is the thing
       actually worth reclaiming height from. */
    <Screen
      edges={['bottom']}
      insetHeader
      topBar={<FrostedTopBar title="Library" back scrollY={scrollY} />}>
      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab !== 'stats' ? (
        <Animated.FlatList
          data={entries}
          onScroll={onScroll}
          scrollEventThrottle={16}
          key={`grid-${COLUMNS}`}
          numColumns={COLUMNS}
          keyExtractor={(entry) => entry.key}
          renderItem={({ item }) => <LibraryCard entry={item} width={tileWidth} />}
          columnWrapperStyle={styles.column}
          contentContainerStyle={styles.grid}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            /* Search and sort are Steam's, so they appear on Steam's tab. The
               merged and logged lists are short enough to scan, and a sort row
               that silently applied to only part of what was on screen would be
               worse than no sort row. */
            tab === 'owned' ? (
              <View style={styles.controls}>
                <TextField
                  value={search}
                  onChangeText={setSearch}
                  placeholder="Search this library"
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
              </View>
            ) : null
          }
          ListEmptyComponent={
            <LibraryEmpty
              tab={tab}
              isSelf={isSelf}
              isPrivate={isPrivate}
              noSteam={noSteam}
              search={search}
              loading={games.isLoading || logs.isLoading || favourites.isLoading}
              error={games.error ?? logs.error ?? favourites.error}
              tileWidth={tileWidth}
            />
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
// One row shape for four different sources
// ---------------------------------------------------------------------------

/**
 * A game on this screen, whichever tab it arrived on.
 *
 * The grid renders one of these regardless of whether it came from a Steam
 * library row, a log, or a favourites list. Without it the screen would need
 * four `renderItem`s and four `keyExtractor`s, and the tiles would drift apart
 * the way the profile's tab bar drifted from `<TabBar>`.
 */
type LibraryEntry = {
  /** Stable list key. An unmatched Steam title has no `gameId`, so not that. */
  key: string;
  /** App-wide id when the game has a page. Null makes the tile inert. */
  gameId: string | null;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  steamAppId: string | null;
  /** One line under the art — playtime, a score, a status. */
  caption: string | null;
};

function fromOwned(game: OwnedGame): LibraryEntry {
  return {
    key: `steam:${game.appId}`,
    gameId: game.gameId,
    title: game.name,
    coverUrl: steamCoverUrl(game.appId),
    heroUrl: steamHeaderUrl(game.appId),
    steamAppId: game.appId,
    caption: game.playtimeMinutes > 0 ? formatPlaytime(game.playtimeMinutes) : null,
  };
}

function fromLog(log: LogWithRelations): LibraryEntry | null {
  const game = log.game;
  if (!game) return null;

  return {
    key: `log:${game.id}`,
    gameId: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    heroUrl: game.hero_url,
    steamAppId: null,
    // The score if they gave one, the status otherwise — a logged game always
    // has the second and only sometimes the first.
    caption: log.rating != null ? String(log.rating) : (STATUS_LABEL[log.status] ?? null),
  };
}

function fromFavourite(item: ListItem): LibraryEntry | null {
  const game = item.game;
  if (!game) return null;

  return {
    key: `fav:${game.id}`,
    gameId: game.id,
    title: game.title,
    coverUrl: game.cover_url,
    heroUrl: game.hero_url,
    steamAppId: null,
    caption: null,
  };
}

/**
 * Merge logged and owned, logs first.
 *
 * Same precedence as the profile shelf and for the same reason: a log carries a
 * real catalogue id, so its art is IGDB's portrait box art rather than a Steam
 * capsule that may not exist for the title.
 */
function mergeEntries(logged: LibraryEntry[], owned: LibraryEntry[]): LibraryEntry[] {
  const seen = new Set(logged.map((entry) => entry.gameId).filter(Boolean) as string[]);
  return [...logged, ...owned.filter((entry) => !entry.gameId || !seen.has(entry.gameId))];
}

/** One tile: portrait art, title, and whatever the tab has to say about it. */
function LibraryCard({ entry, width }: { entry: LibraryEntry; width: number }) {
  const art = (
    <View style={{ width, gap: Spacing.x4 }}>
      <Poster
        coverUrl={entry.coverUrl}
        heroUrl={entry.heroUrl}
        title={entry.title}
        steamAppId={entry.steamAppId}
        width={width}
        rounded="image"
      />
      <Text variant="caption" numberOfLines={1}>
        {entry.title}
      </Text>
      {entry.caption && (
        <Text variant="caption" color="textMuted" numberOfLines={1}>
          {entry.caption}
        </Text>
      )}
    </View>
  );

  // A Steam title nobody has logged has no page to open. Shown, not tappable —
  // dropping it would hide most of a large library.
  if (!entry.gameId) return art;

  /* Straight to the game page rather than to this person's diary. The old
     Steam-only grid went to the diary because every row *was* theirs; a merged
     list is mostly games, and a tile that behaved differently depending on
     which tab surfaced it would be the surprising kind of clever. */
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: entry.gameId } }} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={entry.title} scaleTo={0.95}>
        {art}
      </PressableScale>
    </Link>
  );
}

/** What an empty grid says, which depends entirely on why it is empty. */
function LibraryEmpty({
  tab,
  isSelf,
  isPrivate,
  noSteam,
  search,
  loading,
  error,
  tileWidth,
}: {
  tab: LibraryTab;
  isSelf: boolean;
  isPrivate: boolean;
  noSteam: boolean;
  search: string;
  loading: boolean;
  error: unknown;
  tileWidth: number;
}) {
  if (loading) return <GridSkeleton width={tileWidth} />;
  if (error) return <ErrorState error={error} />;

  if (tab === 'owned') {
    if (noSteam) {
      return (
        <EmptyState
          title="No Steam account linked"
          message={
            isSelf
              ? 'Connect Steam from your profile to import your library.'
              : 'This person has not linked a Steam account.'
          }
        />
      );
    }
    if (isPrivate) {
      return (
        <EmptyState
          title="Profile is private"
          message="Steam is not sharing this library. Game details must be public to import it."
        />
      );
    }
    if (search.trim()) {
      return <EmptyState title="No matches" message={`Nothing here matches “${search.trim()}”.`} />;
    }
    return (
      <EmptyState
        title="Nothing here yet"
        message={isSelf ? 'Your library is still syncing.' : 'No games synced.'}
      />
    );
  }

  if (tab === 'favourites') {
    return (
      <EmptyState
        title="No favourites"
        message={isSelf ? 'Star a game to pin it here.' : 'Nothing pinned yet.'}
      />
    );
  }

  if (tab === 'logged') {
    return (
      <EmptyState
        title="Nothing logged"
        message={isSelf ? 'Log a game and it shows up here.' : 'No games logged yet.'}
      />
    );
  }

  return (
    <EmptyState
      title="No games yet"
      message={
        isSelf
          ? 'Log a game, or connect Steam from your profile to import your library.'
          : 'This shelf is empty.'
      }
    />
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
