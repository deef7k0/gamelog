import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { gridItemWidth } from '@/components/gaming/game-tile';
import { GamePosterRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { HeroArt } from '@/components/ui/hero-art';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Skeleton } from '@/components/ui/surface';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
import { gameSortOptions, sortGames, type GameSearchResult, type GameSort } from '@/lib/games';
import { getCompanyGames } from '@/lib/games/igdb';

/** Four across, matching the library and collection grids. */
const COLUMNS = 4;
const GAP = Spacing.x8;

/**
 * How a catalogue can be ordered.
 *
 * No "Default": IGDB returns a studio's games newest-first and there is no
 * separate relevance ranking to preserve, so an extra pill would sit there
 * meaning the same thing as "Newest".
 */
const SORTS = gameSortOptions(['newest', 'oldest', 'rating', 'title']);

/**
 * How tall the banner is: 16:9 of the width, but never more than this much of
 * the display.
 *
 * Deliberately shorter than the game page's hero, which is `HeroHeightRatio`
 * (38%). That screen's art *is* its subject — the game is what the page is about,
 * and the case stands in front of it. Here the art is context: it says "this is
 * the kind of thing they make" and the studio's name is the subject. 16:9 lands
 * at about 26% of a phone, which is a band rather than a screenful, and the cap
 * is what stops a short wide tablet drawing a 576dp header.
 */
const BANNER_MAX_RATIO = 0.3;

/**
 * How many rated originals a studio needs before "Best from the studio" means
 * anything, and how many it then shows.
 *
 * Six, because a rail drawn from three games is not a selection — it is the
 * catalogue with two covers hidden, and the heading would be claiming a judgement
 * the data cannot support. Studios under the floor keep the grid, where every
 * game is visible and the sort row offers "Top rated" for anybody who wants the
 * same ordering honestly labelled.
 */
const BEST_FLOOR = 6;
const BEST_SHOWN = 10;

/**
 * A rail needs two posters.
 *
 * One remaster is a fact about a game, not a section about a studio, and a
 * horizontally scrolling strip holding a single item reads as a loading state
 * that never finished. Below the floor the game is still in the grid with its
 * "Remaster" badge on it, which is where a single one belongs.
 */
const RAIL_FLOOR = 2;

/** The three kinds that are another go at a game that already exists. */
const REDONE: readonly (GameSearchResult['edition'] & string)[] = ['remake', 'remaster', 'port'];

/** The two kinds that are the same game in a different box. */
const REPACKAGED: readonly (GameSearchResult['edition'] & string)[] = ['edition', 'bundle'];

/**
 * How a studio's catalogue divides.
 *
 * ## The one true partition, and two views
 *
 * `catalogue` and `repackaged` are a genuine split: a "Definitive Edition" is the
 * same game as its parent, so leaving it in the grid puts three near-identical
 * covers in a row — the exact problem `getCompanyGames` used to solve by never
 * fetching them. They come out of the grid and into their own rail.
 *
 * `best` and `redone` are *views* into the catalogue, not removals from it. A
 * studio's best game is still one of its games and still belongs in a complete
 * list; a remake is a release in its own right with its own page. Rails that
 * duplicate what the grid holds are how every browsing surface works — the rail
 * is an argument about where to start, the grid is the record.
 *
 * ## Why `best` is originals only
 *
 * A remaster inherits its parent's reception and frequently scores a point or two
 * higher for it. Left in, "Best from the studio" fills up with the same games'
 * remasters, and the rail stops answering "what should I play" and starts
 * answering "which re-release reviewed best".
 */
function shelves(games: readonly GameSearchResult[]) {
  const repackaged = games.filter((game) => game.edition && REPACKAGED.includes(game.edition));
  const catalogue = games.filter((game) => !game.edition || !REPACKAGED.includes(game.edition));

  const originals = catalogue.filter((game) => game.edition === null);
  const rated = originals.filter((game) => game.score !== null);
  const redone = catalogue.filter((game) => game.edition && REDONE.includes(game.edition));

  const best = sortGames(rated, 'rating');

  return {
    catalogue,
    repackaged,
    redone,
    /* Empty below the floor rather than short — the screen tests `length` and a
       partially-filled rail is the thing the floor exists to prevent. */
    best: rated.length >= BEST_FLOOR ? best.slice(0, BEST_SHOWN) : [],
    /* The banner is the studio's best-reviewed game, and it is deliberately
       uncredited: it is also the first poster in the rail directly below, so the
       association is made by adjacency. A caption naming it would be a line of
       type explaining a picture the reader is about to see again. */
    banner: best[0] ?? catalogue[0] ?? null,
    span: yearsOf(catalogue),
  };
}

/** The catalogue's first and last release years, when both are known. */
function yearsOf(games: readonly GameSearchResult[]): string | null {
  const years = games
    .map((game) => game.releaseYear)
    .filter((year): year is number => year !== null);

  if (years.length === 0) return null;

  const first = Math.min(...years);
  const last = Math.max(...years);
  // A studio with one release year says the year, not a range of it to itself.
  return first === last ? String(first) : `${first}–${last}`;
}

/**
 * A studio's catalogue.
 *
 * ## What this stopped being
 *
 * A count and a hundred-cover grid, which is the right page for a reader who
 * already knows the studio and is checking what they shipped last year, and the
 * wrong one for everybody else: a publisher's page opened from a game they liked
 * answered "here is everything, in release order" when the question was "what
 * else of theirs is good". Four hundred covers deep, release order is close to
 * random.
 *
 * So the grid stays — it is the record, and the sort row is what makes it usable
 * — and three bands go above it, each answering a question release order cannot:
 * what their best work is, what they have gone back and redone, and which of
 * their games exist in more than one box. Every one of the three comes out of the
 * list already fetched; see `shelves`.
 *
 * ## No accent provider
 *
 * This page shows a hundred games, so it stays on the house blue. `<AccentProvider>`
 * wraps the four screens that are about *one* game, for the reason CLAUDE.md
 * gives: a hue identifies a game only when you are looking at that game, and a
 * catalogue lit by its best-reviewed title's box art would just be tinted for
 * reasons nobody could read. The banner is artwork; the chrome is the app's.
 *
 * IGDB-only. Company ids come from `getGameExtras` and nothing else in the app
 * has an equivalent, so studio names are only tappable on IGDB titles.
 */
export default function StudioScreen() {
  const { width, height } = useWindowDimensions();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const [sort, setSort] = useState<GameSort>('newest');

  const games = useQuery({
    queryKey: ['studio-games', id],
    queryFn: ({ signal }) => getCompanyGames(companyId, signal),
    enabled: Number.isFinite(companyId),
    staleTime: 30 * 60_000,
  });

  const { catalogue, repackaged, redone, best, banner, span } = useMemo(
    () => shelves(games.data ?? []),
    [games.data]
  );

  const ordered = useMemo(() => sortGames(catalogue, sort), [catalogue, sort]);

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);
  const bannerHeight = Math.round(Math.min(width / HeroAspectRatio, height * BANNER_MAX_RATIO));

  if (!Number.isFinite(companyId)) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Studio not found" />
      </Screen>
    );
  }

  return (
    /* No `insetHeader`: the banner runs under the floating back disc, the way
       every screen that opens on artwork does. The disc carries its own scrim. */
    <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
      <FlatList
        data={ordered}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => (
          <Link href={{ pathname: '/game/[id]', params: { id: item.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={item.title}
              scaleTo={0.95}>
              <View style={{ width: tileWidth }}>
                <Poster
                  coverUrl={item.coverUrl}
                  heroUrl={item.heroUrl}
                  title={item.title}
                  edition={item.edition}
                  width={tileWidth}
                  rounded="image"
                />
              </View>
            </PressableScale>
          </Link>
        )}
        ListHeaderComponent={
          <View style={styles.header}>
            {/*
              The banner, bleeding past the grid's own padding.

              Drawn whether or not there is art yet — `<HeroArt>` falls back to a
              flat block of the same height — so the name below it does not jump
              down when the catalogue resolves. That matters more here than on a
              game page: the name is already known from the route params and is on
              screen a whole round trip before the art it sits on.
            */}
            <View style={styles.banner}>
              <HeroArt
                uri={banner?.heroUrl}
                steamAppId={banner?.steamAppId}
                height={bannerHeight}
                scrim
                fade="color"
              />

              {/* Over the bottom of the art, not under it — the same
                  arrangement as the Top 10's headline, down to the inset.
                  `HeroArt`'s fade has run the art to flat ink by its last third,
                  so the name sits on something it cannot lose against, and the
                  page gets the height of a title block back.

                  Absolutely positioned rather than pulled up with a negative
                  margin: the name arrives from the route params a full round trip
                  before the art does, and out of flow it cannot move anything
                  below it when a long one wraps to a second line. */}
              <View style={styles.identity}>
                {name && (
                  /* `h1`, not the game page's `display`. A studio is not the
                     subject of the app the way a game is, and IGDB's company
                     names run long enough that the larger step would truncate
                     them — "Kabushiki Gaisha Nintendo Entaateinmento Puranningu
                     & Debelopumento" is a real row. */
                  <Text variant="h1" numberOfLines={2}>
                    {name}
                  </Text>
                )}
                {games.data && (
                  <Text variant="h6" color="textMuted">
                    {`${catalogue.length} ${catalogue.length === 1 ? 'GAME' : 'GAMES'}`}
                    {span ? ` · ${span}` : ''}
                  </Text>
                )}
              </View>
            </View>

            {/*
              Three bands, in the order the questions get asked: what is worth
              playing, what has been redone, what exists twice. Each renders
              nothing at all below its floor — see `BEST_FLOOR` and `RAIL_FLOOR` —
              because a heading is a claim and a two-poster rail under "Best from
              the studio" is not one this data can make.
            */}
            {best.length > 0 && (
              <HomeSection title="Best from the studio" subtitle="Their highest-rated originals.">
                <GamePosterRail games={best} />
              </HomeSection>
            )}

            {redone.length >= RAIL_FLOOR && (
              <HomeSection
                title="Remakes & remasters"
                subtitle="Games they have gone back to — including ports.">
                <GamePosterRail games={redone} />
              </HomeSection>
            )}

            {repackaged.length >= RAIL_FLOOR && (
              <HomeSection
                title="Special editions"
                subtitle="Definitive cuts, complete editions and bundles.">
                <GamePosterRail games={repackaged} />
              </HomeSection>
            )}

            {/*
              The heading the grid needs now that it is no longer the whole page.

              It was three bare lines — a name, a count, a sort row — because
              there was nothing else on the screen for them to be distinguished
              from. With three rails above it, an unlabelled grid reads as a fourth
              rail that failed to lay out.
            */}
            {catalogue.length > 0 && (
              <HomeSection title="All games" subtitle="Everything in the catalogue, your order.">
                {/* Hidden until there is a catalogue to reorder — sorting one
                    game is theatre, and the pills would show during the
                    skeleton. */}
                {catalogue.length > 1 && (
                  <View style={styles.sort}>
                    <SortBar
                      options={SORTS}
                      value={sort}
                      onChange={setSort}
                      accessibilityLabel="Sort this studio's games"
                    />
                  </View>
                )}
              </HomeSection>
            )}
          </View>
        }
        ListEmptyComponent={
          games.isLoading ? (
            <View style={styles.skeletonGrid}>
              {Array.from({ length: 12 }).map((_, index) => (
                <Skeleton
                  key={index}
                  width={tileWidth}
                  height={tileWidth / (2 / 3)}
                  radius={Radius.image}
                />
              ))}
            </View>
          ) : games.isError ? (
            <ErrorState error={games.error} />
          ) : (
            <EmptyState title="No games found" message="IGDB has no catalogue for this studio." />
          )
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x48, gap: GAP },
  column: { gap: GAP },
  /* `x32` between the bands and `x16` inside the header's own blocks: the rails
     are separate subjects and the identity block is one. Not `x64` (Home's
     interval) — that page is a stack of unrelated things, and every band here is
     about the same studio. */
  header: { gap: Spacing.x32, paddingBottom: Spacing.x16 },
  /* Cancels the grid's horizontal padding so the art reaches both edges. */
  banner: { marginHorizontal: -Spacing.x16 },
  /* Puts the inset back for the text, since the container above cancelled it. */
  identity: {
    position: 'absolute',
    left: Spacing.x16,
    right: Spacing.x16,
    bottom: Spacing.x16,
    gap: Spacing.x4,
  },
  /* `<HomeSection>` insets its own heading but leaves its children to bleed, for
     the rails. The sort row is not a rail and needs the inset back. */
  sort: { paddingHorizontal: Spacing.x16 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
