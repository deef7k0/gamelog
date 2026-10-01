import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CoverTile } from '@/components/cover-tile';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { GameListItem } from '@/components/game-list-item';
import { ArticleCard, EventCard, TrailerCard } from '@/components/news-cards';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { useTabBarClearance } from '@/components/app-tab-bar';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getGameEvents,
  getGamingNews,
  getNewReleases,
  getPopularGames,
  getRecentTrailers,
  getUpcomingReleases,
} from '@/lib/news';

type NewsTab = 'news' | 'trailers' | 'releases' | 'charts' | 'events';

const TABS: { key: NewsTab; label: string }[] = [
  // Chronological firehoses, all equally useful whenever you reach them.
  // Discover moved to the Search tab: it answers "what should I play",
  // which is a search question, not a news one.
  { key: 'news', label: 'News' },
  { key: 'trailers', label: 'Trailers' },
  { key: 'releases', label: 'Releases' },
  // Was "Steam Top". The chart is IGDB's cross-platform popularity now, so a
  // storefront's name on the tab would be describing the wrong thing.
  { key: 'charts', label: 'Popular' },
  { key: 'events', label: 'Events' },
];

/** Two across, matching the Top 10 screen the widget opens. */
const CHART_COLUMNS = 2;
const CHART_GAP = Spacing.x12;

/**
 * News, aggregated from several sources.
 *
 * Each section is its own query, `enabled` only for the active tab, so opening
 * the screen fires one request rather than six. Sources are independent — RSS
 * outlets, the Steam charts API and IGDB — so one being down only empties its
 * own tab.
 */
export default function NewsScreen() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<NewsTab>('news');

  const news = useQuery({
    queryKey: ['news', 'articles'],
    queryFn: ({ signal }) => getGamingNews(signal),
    enabled: tab === 'news',
    staleTime: 10 * 60_000,
  });

  const trailers = useQuery({
    queryKey: ['news', 'trailers'],
    queryFn: ({ signal }) => getRecentTrailers(signal),
    enabled: tab === 'trailers',
    staleTime: 30 * 60_000,
  });

  const newReleases = useQuery({
    queryKey: ['news', 'new-releases'],
    queryFn: ({ signal }) => getNewReleases(signal),
    enabled: tab === 'releases',
    staleTime: 30 * 60_000,
  });

  const upcoming = useQuery({
    queryKey: ['news', 'upcoming'],
    queryFn: ({ signal }) => getUpcomingReleases(signal),
    enabled: tab === 'releases',
    staleTime: 30 * 60_000,
  });

  const charts = useQuery({
    queryKey: ['popular-games', 20],
    queryFn: ({ signal }) => getPopularGames(20, signal),
    enabled: tab === 'charts',
    staleTime: 60 * 60_000,
  });

  /* Both hoisted out of `renderItem`. The tile width was a function call per
     row per render; the game object was a fresh allocation per row per render,
     which is exactly what makes a memoised `<CoverTile>` do nothing. */
  const chartTileWidth = gridItemWidth(width, CHART_COLUMNS, Spacing.x16, CHART_GAP);
  const chartTiles = useMemo(
    () =>
      (charts.data?.entries ?? []).map((item) => ({
        rank: item.rank,
        game: {
          id: item.gameId,
          title: item.title,
          coverUrl: item.coverUrl,
          heroUrl: item.heroUrl,
          releaseYear: item.releaseYear,
          edition: item.edition,
          steamAppId: item.steamAppId,
        },
      })),
    [charts.data]
  );

  const events = useQuery({
    queryKey: ['news', 'events'],
    queryFn: ({ signal }) => getGameEvents(signal),
    enabled: tab === 'events',
    staleTime: 60 * 60_000,
  });

  const active = { news, trailers, releases: newReleases, charts, events }[tab];

  /* Out now, then coming soon, in one list the row can badge per section. */
  const releases = [
    ...(newReleases.data ?? []).map((g) => ({ ...g, _section: 'out' as const })),
    ...(upcoming.data ?? []).map((g) => ({ ...g, _section: 'soon' as const })),
  ];

  function renderBody() {
    if (active.isLoading) return <LoadingState />;
    if (active.isError) return <ErrorState error={active.error} />;

    switch (tab) {
      case 'news':
        return (
          <List
            data={news.data ?? []}
            keyOf={(a) => a.id}
            render={(a) => <ArticleCard article={a} />}
            refreshing={news.isRefetching}
            onRefresh={news.refetch}
            empty="No headlines right now"
          />
        );

      case 'trailers':
        return (
          <List
            data={trailers.data ?? []}
            keyOf={(t) => t.id}
            render={(t) => <TrailerCard trailer={t} />}
            refreshing={trailers.isRefetching}
            onRefresh={trailers.refetch}
            empty="No recent trailers"
          />
        );

      case 'releases':
        return (
          <List
            data={releases}
            keyOf={(g) => `${g._section}:${g.id}`}
            render={(g) => (
              <GameListItem game={g} badge={g._section === 'soon' ? 'Coming soon' : null} />
            )}
            refreshing={newReleases.isRefetching || upcoming.isRefetching}
            onRefresh={() => {
              newReleases.refetch();
              upcoming.refetch();
            }}
            empty="No releases found"
          />
        );

      case 'charts':
        return (
          /* Its own FlatList rather than the shared `List` shell: this is the
             only tab laid out in two columns, and `numColumns` is not something
             a single-column shell can take on without becoming a grid library. */
          <FlatList
            data={chartTiles}
            key={`chart-grid-${CHART_COLUMNS}`}
            numColumns={CHART_COLUMNS}
            keyExtractor={(tile) => tile.game.id}
            columnWrapperStyle={styles.chartColumn}
            contentContainerStyle={
              chartTiles.length === 0
                ? styles.empty
                : [styles.chartGrid, { paddingBottom: Spacing.x48 + clearance }]
            }
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CoverTile game={item.game} width={chartTileWidth} rank={item.rank} />
            )}
            refreshControl={
              <RefreshControl
                refreshing={charts.isRefetching}
                onRefresh={charts.refetch}
                tintColor={theme.primary}
              />
            }
            ListEmptyComponent={
              <EmptyState title="Nothing here" message="IGDB returned no chart right now." />
            }
          />
        );

      case 'events':
        return (
          <List
            data={events.data ?? []}
            keyOf={(e) => e.id}
            render={(e) => <EventCard event={e} />}
            refreshing={events.isRefetching}
            onRefresh={events.refetch}
            // Events come from an IGDB endpoint the Edge Function must allow;
            // until it is redeployed this list is simply empty rather than broken.
            empty="No events listed. If this stays empty, redeploy the igdb Edge Function so it permits the events endpoint."
          />
        );
    }
  }

  return (
    /*
     * The app's `<TabBar>`, as on Search, a library and a game's page.
     *
     * This was a `<Dock>` of five icons in a segmented capsule — a second tab
     * control that existed on this one screen, which an icon could not even
     * label (Releases and Trailers had to be spelled out by the top bar). The
     * words scroll if a narrow phone cannot fit all five; the row starts at
     * the page's edge, so the last one is seen to run off it.
     *
     * No `topBar` and no `insetHeader`, for Search's reason: the bar it had was
     * a `<FrostedTopBar />` with nothing to go back to, which draws nothing,
     * while `insetHeader` reserved the band it would have filled. A root tab
     * takes the top edge and spends it on content.
     */
    <Screen edges={['top']}>
      <View style={styles.tabs}>
        <TabBar tabs={TABS} value={tab} onChange={setTab} label="News sections" />
      </View>

      {renderBody()}
    </Screen>
  );
}

/** Shared list shell so each tab only supplies its data and renderer. */
function List<T>({
  data,
  keyOf,
  render,
  refreshing,
  onRefresh,
  empty,
  gap = Spacing.x12,
}: {
  data: T[];
  keyOf: (item: T) => string;
  render: (item: T) => React.ReactElement;
  refreshing: boolean;
  onRefresh: () => void;
  empty: string;
  gap?: number;
}) {
  const theme = useTheme();
  const clearance = useTabBarClearance();

  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      contentContainerStyle={
        data.length === 0
          ? styles.empty
          : [styles.content, { paddingBottom: Spacing.x48 + clearance }]
      }
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      ListEmptyComponent={<EmptyState title="Nothing here" message={empty} />}
    />
  );
}

const styles = StyleSheet.create({
  tabs: { paddingTop: Spacing.x8 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  chartGrid: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: CHART_GAP },
  chartColumn: { gap: CHART_GAP },
  empty: { flexGrow: 1 },
});
