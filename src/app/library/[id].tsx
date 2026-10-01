import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated from 'react-native-reanimated';

import { CdBinder } from '@/components/cd-binder';
import {
  PORTRAIT_COLUMNS,
  gridItemWidth,
  steamCoverUrl,
  steamHeaderUrl,
} from '@/components/gaming/game-tile';
import { LibraryStats } from '@/components/library-stats';
import { Button } from '@/components/ui/button';
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
import {
  getCopies,
  getFavorites,
  getLibraryStatistics,
  getOwnedGames,
  getUserGameStats,
  getUserLogs,
} from '@/lib/api';
import type { CopyWithRelations, ListItem } from '@/lib/api';
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

/** Three across, the app's portrait size (`PORTRAIT_COLUMNS`). */
const COLUMNS = PORTRAIT_COLUMNS;
const GAP = Spacing.x8;

type LibraryTab = 'all' | 'physical' | 'logged' | 'favourites' | 'steam';

/**
 * Everything a person's games can be filtered down to.
 *
 * `all` leads because it is the honest default — this screen is about a
 * *person's games*, not about one storefront — and it opens on what they add up
 * to (`<LibraryStats>`) above the games themselves.
 *
 * `physical` is the binder: the boxes on the shelf, as discs in sleeves.
 * `steam` is the linked library, with Steam's own figures at its head — they
 * used to be a Statistics tab of their own, which made the one tab about
 * everything someone owns be about one storefront.
 */
const TAB_ORDER: LibraryTab[] = ['all', 'physical', 'logged', 'favourites', 'steam'];

const TAB_LABELS: Record<LibraryTab, string> = {
  all: 'All games',
  physical: 'Physical',
  logged: 'Logged',
  favourites: 'Favourites',
  steam: 'Steam',
};

function isLibraryTab(value: string | undefined): value is LibraryTab {
  return !!value && (TAB_ORDER as string[]).includes(value);
}

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
  const { onScroll } = useTopBarScroll();
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; tab?: string }>();
  const id = params.id;
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === id;

  /* The profile's "14 physical" opens straight onto the binder. */
  const [tab, setTab] = useState<LibraryTab>(isLibraryTab(params.tab) ? params.tab : 'all');
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

  const steamStats = useQuery({
    queryKey: ['gaming-library-stats', 'steam', id],
    queryFn: () => getLibraryStatistics(id!),
    enabled: !!id && tab === 'steam',
  });

  /* What the whole collection adds up to, for the head of All games — and the
     physical count on the Physical tab. One server-side aggregate (0028). */
  const collection = useQuery({
    queryKey: ['user-game-stats', id],
    queryFn: () => getUserGameStats(id!),
    enabled: !!id,
  });

  const copies = useQuery({
    queryKey: ['copies', id, 'all'],
    queryFn: () => getCopies(id!),
    enabled: !!id && tab === 'physical',
  });
  const physical = useMemo(
    () => (copies.data ?? []).filter((copy) => copy.ownership === 'physical'),
    [copies.data]
  );

  /* Games logged in this app. Fetched for every tab except Steam, because the
     merged list and the Logged list both need it and it is one indexed query
     capped at 100 rows. */
  const logs = useQuery({
    queryKey: ['user-logs', id],
    queryFn: () => getUserLogs(id!),
    enabled: !!id && tab !== 'steam',
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
      case 'physical':
        return [];
      case 'steam':
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
    all: tab === 'all' ? entries.length || undefined : undefined,
    physical: collection.data?.copies,
    favourites: favourites.data?.items?.length,
    steam: games.data?.length,
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
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
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
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      <TabBar tabs={tabs} value={tab} onChange={setTab} />

      {tab === 'physical' ? (
        <PhysicalTab
          copies={physical}
          loading={copies.isLoading}
          error={copies.error}
          onRetry={() => void copies.refetch()}
          isSelf={isSelf}
          ownerId={id}
          width={width - Spacing.x16 * 2}
          onOpenCopy={(copy) => router.push({ pathname: '/copy/[id]', params: { id: copy.id } })}
        />
      ) : (
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
            tab === 'all' ? (
              <LibraryStats
                stats={collection.data}
                loading={collection.isLoading}
                failed={collection.isError}
                onRetry={() => void collection.refetch()}
              />
            ) : /* Search and sort are Steam's, so they appear on Steam's tab. The
               merged and logged lists are short enough to scan, and a sort row
               that silently applied to only part of what was on screen would be
               worse than no sort row. */
            tab === 'steam' ? (
              <View style={styles.controls}>
                <SteamFigures data={steamStats.data} />
                <TextField
                  value={search}
                  onChangeText={setSearch}
                  icon="search"
                  variant="search"
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

  /* Straight to the game page rather than to this person's record of it. The
     old Steam-only grid went to the per-user screen because every row *was*
     theirs; a merged list is mostly games, and a tile that behaved differently
     depending on which tab surfaced it would be the surprising kind of clever. */
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

  if (tab === 'steam') {
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
// Physical — the binder
// ---------------------------------------------------------------------------

/**
 * The Physical tab: the binder, and the ways to fill it.
 *
 * The binder is the whole view, not a header over a grid — it *is* the list of
 * physical games, just kept the way discs are kept. The plain list survives one
 * tap away for anyone who wants to scan titles rather than turn pages.
 */
function PhysicalTab({
  copies,
  loading,
  error,
  onRetry,
  isSelf,
  ownerId,
  width,
  onOpenCopy,
}: {
  copies: CopyWithRelations[];
  loading: boolean;
  error: unknown;
  onRetry: () => void;
  isSelf: boolean;
  ownerId: string;
  width: number;
  onOpenCopy: (copy: CopyWithRelations) => void;
}) {
  const router = useRouter();

  if (loading) {
    return (
      <View style={styles.physical}>
        <Skeleton width={Math.floor(width / 2)} height={Math.floor(width * 1.05)} />
      </View>
    );
  }
  if (error) return <ErrorState error={error} onRetry={onRetry} />;

  return (
    <ScrollView contentContainerStyle={styles.physical} showsVerticalScrollIndicator={false}>
      <CdBinder copies={copies} width={width} onOpenCopy={onOpenCopy} />

      {copies.length === 0 && (
        <View style={styles.physicalEmpty}>
          <Text variant="h3">No physical games yet</Text>
          <Text variant="bodySmall" color="textMuted" style={styles.centred}>
            {isSelf
              ? 'Scan the barcode on a box, or add one by hand, and its disc goes in here.'
              : 'Nothing on this shelf yet.'}
          </Text>
        </View>
      )}

      {isSelf && (
        <View style={styles.physicalActions}>
          <Button title="Scan a game" icon="scan-outline" onPress={() => router.push('/scan')} />
          <Button
            title="Add by hand"
            variant="secondary"
            onPress={() => router.push('/add-copy')}
          />
        </View>
      )}

      {copies.length > 0 && (
        <Link href={{ pathname: '/copies/[user]', params: { user: ownerId } }} asChild>
          <PressableScale accessibilityRole="link" scaleTo={0.96} hitSlop={12}>
            <Text variant="caption" color="primaryText">
              See them as a list
            </Text>
          </PressableScale>
        </Link>
      )}
    </ScrollView>
  );
}

// ---------------------------------------------------------------------------
// Steam
// ---------------------------------------------------------------------------

/**
 * Steam's own figures, at the head of the Steam tab. They were a Statistics tab
 * of their own; they are about this library and nothing else, so they sit on it.
 */
function SteamFigures({
  data,
}: {
  data: Awaited<ReturnType<typeof getLibraryStatistics>> | undefined;
}) {
  const theme = useTheme();
  if (!data || data.totalGames === 0) return null;

  return (
    <View style={styles.steamFigures}>
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
  steamFigures: { gap: Spacing.x8 },
  statGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statCell: { width: '50%', gap: 1, paddingVertical: Spacing.x8 },
  physical: {
    alignItems: 'center',
    gap: Spacing.x24,
    padding: Spacing.x16,
    paddingTop: Spacing.x24,
    paddingBottom: Spacing.x48,
  },
  physicalEmpty: { alignItems: 'center', gap: Spacing.x4 },
  centred: { textAlign: 'center' },
  physicalActions: { flexDirection: 'row', gap: Spacing.x8 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
