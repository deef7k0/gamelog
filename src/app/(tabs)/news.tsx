import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';

import { CoverTile } from '@/components/cover-tile';
import { RecommendationRail, TopTenWidget } from '@/components/discover';
import { gridItemWidth } from '@/components/gaming/game-tile';
import { GameListItem } from '@/components/game-list-item';
import { ArticleCard, EventCard, TrailerCard } from '@/components/news-cards';
import { Dock, DockItem, DockSeparator } from '@/components/ui/dock';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getDiscoverGames,
  getGameEvents,
  getGamingNews,
  getNewReleases,
  getPopularGames,
  getRecentTrailers,
  getUpcomingReleases,
} from '@/lib/news';
import { getRecommendations } from '@/lib/news/recommendations';
import { useAuth } from '@/store/auth';

type NewsTab = 'news' | 'trailers' | 'releases' | 'charts' | 'events' | 'discover';

const TABS: { key: NewsTab; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  // Discover leads: it is the only tab personalised to the reader, so it is what
  // the screen should open on. The rest are chronological firehoses that are
  // equally useful whenever you reach them — hence the separator after it.
  { key: 'discover', label: 'Discover', icon: 'sparkles' },
  { key: 'news', label: 'News', icon: 'newspaper' },
  { key: 'trailers', label: 'Trailers', icon: 'play-circle' },
  { key: 'releases', label: 'Releases', icon: 'calendar' },
  // Was "Steam Top". The chart is IGDB's cross-platform popularity now, so a
  // storefront's name on the tab would be describing the wrong thing.
  { key: 'charts', label: 'Popular', icon: 'trending-up' },
  { key: 'events', label: 'Events', icon: 'megaphone' },
];

/** Two across, matching the Top 10 screen the widget opens. */
const CHART_COLUMNS = 2;
const CHART_GAP = Spacing.three;

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
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<NewsTab>('discover');

  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  /*
   * The Top 10 widget shares its query key with the standalone Top 10 screen,
   * so tapping through to it is instant and neither can show a different ten
   * from the other.
   */
  const topTen = useQuery({
    queryKey: ['popular-games', 10],
    queryFn: ({ signal }) => getPopularGames(10, signal),
    enabled: tab === 'discover',
    staleTime: 30 * 60_000,
  });

  const recommendations = useQuery({
    queryKey: ['discover-recommendations', viewerId],
    queryFn: ({ signal }) => getRecommendations(viewerId!, signal),
    enabled: tab === 'discover' && !!viewerId,
    staleTime: 15 * 60_000,
  });

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

  const events = useQuery({
    queryKey: ['news', 'events'],
    queryFn: ({ signal }) => getGameEvents(signal),
    enabled: tab === 'events',
    staleTime: 60 * 60_000,
  });

  const discover = useQuery({
    queryKey: ['news', 'discover'],
    queryFn: ({ signal }) => getDiscoverGames(signal),
    enabled: tab === 'discover',
    staleTime: 60 * 60_000,
  });

  const active = {
    news,
    trailers,
    releases: newReleases,
    charts,
    events,
    discover,
  }[tab];

  function renderBody() {
    // Discover composes several independent queries and skeletons them
    // individually, so it must not be gated on one aggregate loading flag.
    if (tab !== 'discover') {
      if (active.isLoading) return <LoadingState />;
      if (active.isError) return <ErrorState error={active.error} />;
    }

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
            data={[
              ...(newReleases.data ?? []).map((g) => ({ ...g, _section: 'out' as const })),
              ...(upcoming.data ?? []).map((g) => ({ ...g, _section: 'soon' as const })),
            ]}
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
            data={charts.data?.entries ?? []}
            key={`chart-grid-${CHART_COLUMNS}`}
            numColumns={CHART_COLUMNS}
            keyExtractor={(entry) => entry.gameId}
            columnWrapperStyle={styles.chartColumn}
            contentContainerStyle={
              (charts.data?.entries ?? []).length === 0 ? styles.empty : styles.chartGrid
            }
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <CoverTile
                game={{
                  id: item.gameId,
                  title: item.title,
                  coverUrl: item.coverUrl,
                  heroUrl: item.heroUrl,
                  releaseYear: item.releaseYear,
                }}
                width={gridItemWidth(width, CHART_COLUMNS, Spacing.four, CHART_GAP)}
                rank={item.rank}
              />
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

      case 'discover':
        return (
          <ScrollView
            contentContainerStyle={styles.discover}
            showsVerticalScrollIndicator={false}
            refreshControl={
              <RefreshControl
                refreshing={discover.isRefetching || topTen.isRefetching}
                onRefresh={() => {
                  discover.refetch();
                  topTen.refetch();
                  recommendations.refetch();
                }}
                tintColor={theme.primary}
              />
            }>
            <TopTenWidget entries={topTen.data?.entries ?? []} loading={topTen.isLoading} />

            {(recommendations.data ?? []).map((module) => (
              <RecommendationRail key={module.id} module={module} />
            ))}

            {/* Falls back to critically-acclaimed titles for a reader with
                nothing logged yet, so Discover is never an empty screen. */}
            <View style={styles.discoverSection}>
              <Text variant="bodyStrong">
                {(recommendations.data ?? []).length > 0 ? 'Highly rated' : 'Start here'}
              </Text>
              {(discover.data ?? []).slice(0, 20).map((game) => (
                <GameListItem key={game.id} game={game} />
              ))}
            </View>
          </ScrollView>
        );
    }
  }

  return (
    <Screen edges={['top']}>
      {/* The section name lives in the app bar rather than on the dock. Six
          icons fit on the narrowest phone where six text tabs had to scroll,
          which meant "Events" was permanently off-screen — but an icon alone
          cannot tell Releases from Trailers, so the active one is spelled out
          here instead. */}
      <View style={styles.appBar}>
        <Text variant="title">{TABS.find((entry) => entry.key === tab)?.label ?? 'News'}</Text>
      </View>

      <View style={styles.dockRow}>
        <Dock>
          {TABS.map((entry, index) => (
            <Fragment key={entry.key}>
              {/* Discover is personalised; everything after it is a feed. */}
              {index === 1 && <DockSeparator />}
              <DockItem
                active={tab === entry.key}
                onPress={() => setTab(entry.key)}
                accessibilityLabel={entry.label}>
                <Ionicons
                  name={entry.icon}
                  size={19}
                  color={tab === entry.key ? theme.text : theme.textMuted}
                />
              </DockItem>
            </Fragment>
          ))}
        </Dock>
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
  gap = Spacing.three,
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

  return (
    <FlatList
      data={data}
      keyExtractor={keyOf}
      renderItem={({ item }) => render(item)}
      ItemSeparatorComponent={() => <View style={{ height: gap }} />}
      contentContainerStyle={data.length === 0 ? styles.empty : styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.primary} />
      }
      ListEmptyComponent={<EmptyState title="Nothing here" message={empty} />}
    />
  );
}

const styles = StyleSheet.create({
  discover: {
    padding: Spacing.four,
    paddingBottom: Spacing.seven,
    gap: Spacing.five,
  },
  discoverSection: { gap: Spacing.two },
  appBar: { paddingHorizontal: Spacing.four, paddingTop: Spacing.three },
  dockRow: { paddingVertical: Spacing.three },
  content: { padding: Spacing.four, paddingBottom: Spacing.seven },
  chartGrid: { padding: Spacing.four, paddingBottom: Spacing.seven, gap: CHART_GAP },
  chartColumn: { gap: CHART_GAP },
  empty: { flexGrow: 1 },
});
