import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useRef, useState, type ReactElement } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { GameListItem } from '@/components/game-list-item';
import { DropdownButton, type DropdownOption } from '@/components/ui/dropdown-button';
import { IconButton } from '@/components/ui/icon-button';
import { PageFlatList } from '@/components/ui/page-scroll';
import { Pager } from '@/components/ui/pager';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { ArtRowWindow, CoverGridWindow } from '@/constants/list-window';
import { Spacing } from '@/constants/theme';
import type { GameSearchResult } from '@/lib/games';
import {
  catalogueCountKey,
  getCatalogueGameCount,
  getCatalogueGamesPage,
  type CatalogueSort,
} from '@/lib/games/browse';
import {
  PLATFORM_GROUPS,
  facetSubject,
  facetsSentence,
  isTagFacet,
  type Facet,
  type MatchMode,
  type PlatformGroupKey,
} from '@/lib/games/facets';
import { PAGE_SIZE, pageCountFor } from '@/lib/games/paging';
import { getTagGamesPage } from '@/lib/games/rawg-tags';

/**
 * The orders a slice of the catalogue can be read in — a platform's page and a
 * facet's games alike. "Most popular" opens it; every order but the four that
 * say which games they hold (top rated, newest, upcoming, oldest) is the whole
 * slice, down to the game IGDB filed a minute ago — which "Recently added"
 * puts first.
 */
export const CATALOGUE_SORT_OPTIONS: readonly DropdownOption<CatalogueSort>[] = [
  { value: 'popular', label: 'Most popular' },
  { value: 'rating', label: 'Rating, highest first', short: 'Top rated' },
  { value: 'newest', label: 'Release date, newest first', short: 'Newest' },
  { value: 'added', label: 'Recently added to IGDB', short: 'Recently added' },
  { value: 'upcoming', label: 'Not out yet, soonest first', short: 'Upcoming' },
  { value: 'oldest', label: 'Release date, oldest first', short: 'Oldest' },
  { value: 'title', label: 'Title, A to Z', short: 'A–Z' },
];

type PlatformChoice = 'all' | PlatformGroupKey;

const PLATFORM_OPTIONS: readonly DropdownOption<PlatformChoice>[] = [
  { value: 'all', label: 'All platforms', short: 'All' },
  ...PLATFORM_GROUPS.map((group) => ({ value: group.key, label: group.label })),
];

type Layout = 'rows' | 'grid';

/**
 * Every game a facet holds — a theme, an engine, a language — ten to a page,
 * with the platform page's pager over them.
 *
 * The owner's direction (2026-10-16): "I want the search options to search for
 * *all* games in that query. Not just the most rated ones, all, even the most
 * obscure games and a game released a minute ago… make sure to have search
 * options for how the games appear. You can use the same system for the
 * platform games." So this is that system — `getCatalogueGamesPage` and its
 * count, the same as `platform/[id]` — over the facet's clause, with nothing
 * dropped for want of a cover or a rating:
 *
 * - **How they are ordered**: popularity, rating, release (either way), not
 *   out yet, title, or when IGDB added them.
 * - **Which platforms**: one of `PLATFORM_GROUPS`, or all.
 * - **How they are drawn**: rows, or the grid of covers.
 * - **A word in the name**, from the Search field: searched within the facet.
 *
 * The count is exact (`games/count`), and the page does not wait for it.
 *
 * **A RAWG tag among the facets changes where the games come from**: RAWG's
 * games with that tag, a page at a time in RAWG's reading of the order, each
 * shown as the IGDB game of its name — narrowed on IGDB by everything else
 * chosen (`getTagGamesPage`). The count is then RAWG's, and a page can hold
 * fewer than ten, where a name is not IGDB's or the rest of the search rules
 * the game out.
 */
export function CatalogueResults({
  facets,
  match,
  term,
  header,
}: {
  /** One or several: combined, a game that is all of them; any of, at least one. */
  facets: readonly Facet[];
  match: MatchMode;
  /** What is typed in the field: the games whose names hold it. */
  term: string;
  header: ReactElement;
}) {
  const clearance = useTabBarClearance();
  const { width } = useWindowDimensions();
  const listRef = useRef<FlatList<GameSearchResult>>(null);

  const [sort, setSort] = useState<CatalogueSort>('popular');
  const [platform, setPlatform] = useState<PlatformChoice>('all');
  const [layout, setLayout] = useState<Layout>('rows');

  const subject = facetSubject(facets, match, {
    platforms: platform === 'all' ? [] : [platform],
    term,
  });

  /* The page belongs to the slice and the order it was turned under: a new
     word, platform or order opens on page 1 without an effect to reset it. */
  const [paging, setPaging] = useState({ key: '', page: 1 });
  const pageKey = `${subject}|${sort}`;
  const page = paging.key === pageKey ? paging.page : 1;

  const tagIds = facets.filter(isTagFacet).map((facet) => facet.id);
  const tagged = tagIds.length > 0;

  const igdbGames = useQuery({
    /* Under `search`: never kept on the device (`NEVER_PERSIST`). */
    queryKey: ['search', 'catalogue', subject, sort, page],
    queryFn: ({ signal }) => getCatalogueGamesPage(subject, sort, page, signal),
    enabled: !tagged,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });

  const count = useQuery({
    /* The clause, not the order: two orders of one set count once. */
    queryKey: ['search', 'catalogue-count', catalogueCountKey(subject, sort)],
    queryFn: ({ signal }) => getCatalogueGameCount(subject, sort, signal),
    enabled: !tagged,
    staleTime: 60 * 60_000,
    retry: false,
  });

  const tagPage = useQuery({
    queryKey: ['search', 'catalogue-tags', tagIds.join(','), match, subject, sort, page],
    queryFn: ({ signal }) => getTagGamesPage({ tagIds, match, where: subject, sort, page }, signal),
    enabled: tagged,
    placeholderData: keepPreviousData,
    staleTime: 10 * 60_000,
  });

  /* Whichever is asked: its loading, failure and placeholder are the page's. */
  const games = tagged ? tagPage : igdbGames;
  const total = tagged ? (tagPage.data?.count ?? null) : (count.data ?? null);
  const pageCount = total === null ? null : pageCountFor(total);
  const rows: readonly GameSearchResult[] = tagged
    ? (tagPage.data?.games ?? [])
    : (igdbGames.data ?? []);
  /* While the count is unknown, a full page is the evidence of another. A
     tag's page can be short without being the last. */
  const hasNext = tagged ? pageCount !== null && page < pageCount : rows.length === PAGE_SIZE;
  const grid = layout === 'grid';
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  function turnTo(next: number) {
    setPaging({ key: pageKey, page: next });
    listRef.current?.scrollToOffset({ offset: 0, animated: false });
  }

  const head = (
    <View style={styles.head}>
      {header}
      <View style={styles.toolbar}>
        <DropdownButton
          label="Sort by"
          value={sort}
          options={CATALOGUE_SORT_OPTIONS}
          onChange={setSort}
        />
        <DropdownButton
          label="Platform"
          value={platform}
          options={PLATFORM_OPTIONS}
          onChange={setPlatform}
        />
        <View style={styles.spacer} />
        {/* Shows the layout you would *get*, not the one you are in. */}
        <IconButton
          icon={grid ? 'list' : 'grid'}
          accessibilityLabel={grid ? 'Show as a list' : 'Show as a grid'}
          size="small"
          onPress={() => setLayout(grid ? 'rows' : 'grid')}
        />
      </View>
      <Pager
        page={page}
        pageCount={pageCount}
        hasNext={hasNext}
        onChange={turnTo}
        summary={
          total === null ? null : `${total.toLocaleString()} ${total === 1 ? 'game' : 'games'}`
        }
      />
    </View>
  );

  return (
    <PageFlatList
      ref={listRef}
      data={rows}
      /* `numColumns` cannot change on a mounted list, so each layout is its own. */
      key={grid ? 'catalogue-grid' : 'catalogue-rows'}
      numColumns={grid ? PORTRAIT_COLUMNS : 1}
      columnWrapperStyle={grid ? styles.gridRow : undefined}
      keyExtractor={(game) => game.id}
      {...(grid ? CoverGridWindow : ArtRowWindow)}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      /* The previous page, dimmed, while the next one is on its way. */
      style={games.isPlaceholderData ? styles.turning : undefined}
      contentContainerStyle={[
        styles.content,
        grid && styles.gridContent,
        { paddingBottom: Spacing.x48 + clearance },
      ]}
      ListHeaderComponent={head}
      renderItem={({ item }) =>
        grid ? (
          <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={item.title}
              scaleTo={0.95}>
              <Poster
                coverUrl={item.coverUrl}
                heroUrl={item.heroUrl}
                title={item.title}
                edition={item.edition}
                gameId={item.id}
                steamAppId={item.steamAppId}
                width={tileWidth}
                rounded="image"
              />
            </PressableScale>
          </Link>
        ) : (
          <GameListItem game={item} />
        )
      }
      ListEmptyComponent={
        games.isLoading ? (
          <LoadingState />
        ) : games.isLoadingError ? (
          <ErrorState error={games.error} onRetry={() => games.refetch()} />
        ) : (
          <EmptyState
            title={
              page > 1
                ? 'Nothing on this page'
                : facets.length > 1 && match === 'all'
                  ? 'No game is all of these'
                  : 'No games here'
            }
            message={
              page > 1
                ? 'This is past the last page. Go back a page, or to page 1.'
                : /* Said plainly when the combination is the reason — the
                     owner's "if a game doesn't exist, say it". */
                  facets.length > 1 && match === 'all'
                  ? `No game ${tagged ? 'here' : 'on IGDB'} is ${facetsSentence(facets, 'all')}${
                      term ? ` with “${term}” in its name` : ''
                    }${platform !== 'all' ? ' on this platform' : ''}. Take one away, or switch to Any of.`
                  : term
                    ? `No game on IGDB here has “${term}” in its name.`
                    : 'IGDB lists no games for this order and platform.'
            }
          />
        )
      }
      ListFooterComponent={
        rows.length > 0 ? (
          <View style={styles.foot}>
            <Pager
              page={page}
              pageCount={pageCount}
              hasNext={hasNext}
              onChange={turnTo}
              detail={false}
            />
          </View>
        ) : null
      }
    />
  );
}

/** Between covers in the grid, both ways — the Search tab's grid's. */
const GRID_GAP = Spacing.x12;

const styles = StyleSheet.create({
  content: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16, flexGrow: 1 },
  head: { gap: Spacing.x12, paddingBottom: Spacing.x8 },
  /* Wraps rather than squeezing: two menus and a key fit a 360dp phone. */
  toolbar: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: Spacing.x8 },
  spacer: { flex: 1 },
  gridContent: { gap: GRID_GAP },
  gridRow: { gap: GRID_GAP },
  foot: { paddingTop: Spacing.x16 },
  turning: { opacity: 0.45 },
});
