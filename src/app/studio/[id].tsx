import { Link, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, StyleSheet, View, useWindowDimensions } from 'react-native';

import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { GameCoverRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { LOGO_WIDTH_RATIO, StudioIdentity } from '@/components/studio-identity';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { HeroArt } from '@/components/ui/hero-art';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { SmoothScrim } from '@/components/ui/smooth-scrim';
import { Skeleton } from '@/components/ui/surface';
import { SortBar } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Palette, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useImmersiveBackground } from '@/hooks/use-immersive-background';
import { useStudioBanner } from '@/hooks/use-studio-banner';
import { BANNER_MAX_ASPECT, useStudioCatalogue } from '@/hooks/use-studio-catalogue';
import { useStudioLogo } from '@/hooks/use-studio-logo';
import { useTheme } from '@/hooks/use-theme';
import { gameSortOptions, sortGames, type GameSearchResult, type GameSort } from '@/lib/games';

/** Three across, the app's portrait size (`PORTRAIT_COLUMNS`). */
const COLUMNS = PORTRAIT_COLUMNS;
const GAP = Spacing.x8;

/**
 * How much of the grid exists at once, in rows of three.
 *
 * The list defaults are built for text rows: ten rows up front and ten
 * screens either side after that, which on a 200-game catalogue is every
 * cover — two hundred downloads, most of them for games nobody scrolls to,
 * all racing the banner. The grid starts under a screenful of banner and
 * rails, so two rows are enough to be ready when it is reached, and one
 * screen either side keeps ahead of a scroll.
 */
const GRID_FIRST_ROWS = 2;

/**
 * Where a rail's first cover starts: the list's own padding plus the heading's,
 * which is where `<HomeSection>` sets its title. The rail itself is pulled out
 * to the screen's edges (`railBleed`), so it scrolls off both of them.
 */
const RAIL_INSET = Spacing.x16 * 2;
const GRID_BATCH_ROWS = 4;
const GRID_WINDOW = 3;

/**
 * How a catalogue can be ordered.
 *
 * No "Default": IGDB returns a studio's games newest-first and there is no
 * separate relevance ranking to preserve, so an extra pill would sit there
 * meaning the same thing as "Newest".
 */
const SORTS = gameSortOptions(['newest', 'oldest', 'rating', 'title']);

/**
 * The banner is square — SimpMusic's artist header on a phone (`aspectRatio(1f)`
 * in `ArtistScreen.kt`) — but never taller than half the display, which is what
 * stops a tablet or a landscape window drawing a screenful of it.
 */
const FRAME_MAX_RATIO = 0.5;

/** How much of the banner the scrim covers, from the bottom: the reference's `fillMaxHeight(0.7f)`. */
const SCRIM_RATIO = 0.7;

/** The reference's 5% black over the artwork, so a bright image sits back behind the name. */
const VEIL = 0.05;

/** The line under the name — "128 games · 1998–2024" — at the reference's 77% white. */
const META_ALPHA = 0.77;

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
 * covers in a row — the exact problem the catalogue query used to solve by never
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
       type explaining a picture the reader is about to see again.

       A list, in that order, of the games that have art at all — the screen
       takes the first whose art it can use (see `BANNER_MAX_ASPECT`). */
    bannerCandidates: [...new Set([...best, ...catalogue])].filter((game) => !!game.heroUrl),
    span: yearsOf(catalogue),
    /* Over the same rated originals and behind the same floor as the "Best"
       rail: an average of two scores is two games, not a studio's standing. */
    average:
      rated.length >= BEST_FLOOR
        ? Math.round(rated.reduce((sum, game) => sum + (game.score ?? 0), 0) / rated.length)
        : null,
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
 * ## The page takes the banner's colour; the controls do not
 *
 * The header is SimpMusic's artist page, read from `ArtistScreen.kt`: the
 * artwork square and full width, melting into a page filled with the
 * artwork's own darkened tone (`useImmersiveBackground`), and the studio's name
 * set over the bottom — as its logo, when Wikimedia Commons has a public-domain
 * one (`useStudioLogo`, `<StudioIdentity>`).
 *
 * The colour is the page's and nothing else's. There is still no
 * `<AccentProvider>`: this page shows a hundred games, and a sort pill or a link
 * in one title's hue would claim that game speaks for the catalogue. So the
 * chrome stays the app's — neutral controls, the house blue on what is selected
 * — and only the ground under it changes.
 *
 * ## What arrives, and when
 *
 * The name is on screen from the route. Everything else is two IGDB requests
 * away — the company, then its games (`useStudioCatalogue`) — and then the
 * banner and its colour, read from a 3 KB thumbnail of the banner art while the
 * art itself downloads, so the colour lands first and the art on it. The
 * banner downloads ahead of every cover (`priority`), and the grid exists only
 * a screen either side of the scroll, so two hundred covers do not race it.
 *
 * A studio opened before skips the wait for the two that matter most: its
 * banner is remembered (`useStudioBanner`), so the art comes from the disk
 * cache and the colour from the colour store before IGDB has answered. The
 * logo, when there is one, is a month-long answer on the device and costs no
 * IGDB request of its own (`useStudioLogo`).
 *
 * IGDB-only. Company ids come from `getGameExtras` and nothing else in the app
 * has an equivalent, so studio names are only tappable on IGDB titles.
 */
export default function StudioScreen() {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const companyId = Number(id);
  const [sort, setSort] = useState<GameSort>('newest');

  const games = useStudioCatalogue(companyId);

  /* Banner games whose art loaded as a strip the square cannot show. Set from
     the image's own load event, so it only ever grows by one per bad strip. */
  const [strips, setStrips] = useState<readonly string[]>([]);

  const { catalogue, repackaged, redone, best, bannerCandidates, span, average } = useMemo(
    () => shelves(games.data ?? []),
    [games.data]
  );

  const ordered = useMemo(() => sortGames(catalogue, sort), [catalogue, sort]);

  const banner = bannerCandidates.find((game) => !strips.includes(game.id)) ?? null;

  /* The art on screen: the catalogue's banner, and while the catalogue is
     still on its way, the one this device showed last time — so a studio
     opened before is never waiting on IGDB for its banner or its colour. */
  const bannerUrl = useStudioBanner(companyId, games.data ? (banner?.heroUrl ?? null) : undefined);

  /* The page's colour, from the banner it melts out of — null until there is
     a banner and its colour is read, when the page stays the app's own. */
  const pageColor = useImmersiveBackground(bannerUrl);
  const page = pageColor ?? theme.background;

  /* The logo, when Commons has a free one. The name is on screen from the
     route in the meantime, and stays whenever there is none. */
  const logo = useStudioLogo(companyId, name);

  const tileWidth = gridItemWidth(width, COLUMNS, Spacing.x16, GAP);
  const bannerHeight = Math.round(Math.min(width, height * FRAME_MAX_RATIO));

  if (!Number.isFinite(companyId)) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Studio not found" />
      </Screen>
    );
  }

  return (
    /* No `insetHeader`: the banner runs under the floating back disc, the way
       every screen that opens on artwork does. The disc carries its own scrim.
       `background` is the banner's immersive colour, or the app's page. */
    <Screen edges={['bottom']} background={pageColor ?? undefined} topBar={<FrostedTopBar back />}>
      <FlatList
        data={ordered}
        key={`grid-${COLUMNS}`}
        numColumns={COLUMNS}
        keyExtractor={(game) => game.id}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.grid}
        showsVerticalScrollIndicator={false}
        initialNumToRender={GRID_FIRST_ROWS}
        maxToRenderPerBatch={GRID_BATCH_ROWS}
        windowSize={GRID_WINDOW}
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
                  /* Behind the banner and the rails in the download queue:
                     the grid starts below the first screen. */
                  priority="low"
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
            <View style={[styles.banner, { height: bannerHeight }]}>
              {/* No fade of its own: the scrim below is the fade, into this
                  page's colour rather than the app's. `HeroArt` still dissolves
                  a blurred copy of the art into its lower half, the reference's
                  soft bottom.

                  No `steamAppId`: the studio catalogue does not ask IGDB for
                  store ids, so the banner is always the IGDB art its colour
                  was read from. The strip check is a backstop now — the
                  catalogue already passes over art it knows the size of — and
                  only judges the catalogue's own choice, never remembered art. */}
              <HeroArt
                uri={bannerUrl}
                height={bannerHeight}
                onLoad={({ width: artWidth, height: artHeight }) => {
                  if (
                    banner &&
                    banner.heroUrl === bannerUrl &&
                    artHeight > 0 &&
                    artWidth / artHeight > BANNER_MAX_ASPECT
                  ) {
                    setStrips((previous) => [...previous, banner.id]);
                  }
                }}
                scrim
                fade={false}
              />
              <View
                style={[styles.fill, { backgroundColor: withAlpha(Palette.shadowInk, VEIL) }]}
                pointerEvents="none"
              />
              <SmoothScrim
                color={page}
                style={[styles.scrim, { height: `${SCRIM_RATIO * 100}%` }]}
              />

              {/*
                The name over the bottom of the art, centred — as the studio's
                logo when Commons has a free one, as type when it has not — and
                under it one line of what the studio has made, where the
                reference prints subscribers and views.

                Absolutely positioned rather than pulled up with a negative
                margin: the name arrives from the route params a full round trip
                before the art does, and out of flow neither it nor a logo that
                replaces it can move anything below.
              */}
              <View style={styles.identity}>
                <StudioIdentity
                  name={name}
                  logo={logo.data}
                  pageColor={page}
                  maxWidth={Math.round(width * LOGO_WIDTH_RATIO)}
                />
                {games.data && (
                  <Text
                    variant="body"
                    style={[styles.meta, { color: withAlpha(theme.text, META_ALPHA) }]}>
                    {`${catalogue.length} ${catalogue.length === 1 ? 'game' : 'games'}`}
                    {span ? ` · ${span}` : ''}
                    {average !== null && (
                      <>
                        {' · Average rating '}
                        {/* The score's own ramp, never the accent: a blue 55
                            would read as endorsed (CLAUDE.md, "One score ramp"). */}
                        <Text variant="h5" style={{ color: scoreColor(average, theme) }}>
                          {average}
                        </Text>
                      </>
                    )}
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
            {/* The game page's franchise rail, as every row of games is: the
                rail runs edge to edge (`railBleed` cancels the list's padding)
                and its first cover starts in line with the heading above it. */}
            {best.length > 0 && (
              <HomeSection title="Best from the studio" subtitle="Their highest-rated originals.">
                <View style={styles.railBleed}>
                  <GameCoverRail games={best} inset={RAIL_INSET} />
                </View>
              </HomeSection>
            )}

            {redone.length >= RAIL_FLOOR && (
              <HomeSection
                title="Remakes & remasters"
                subtitle="Games they have gone back to — including ports.">
                <View style={styles.railBleed}>
                  <GameCoverRail games={redone} inset={RAIL_INSET} />
                </View>
              </HomeSection>
            )}

            {repackaged.length >= RAIL_FLOOR && (
              <HomeSection
                title="Special editions"
                subtitle="Definitive cuts, complete editions and bundles.">
                <View style={styles.railBleed}>
                  <GameCoverRail games={repackaged} inset={RAIL_INSET} />
                </View>
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
  /* `x32` between the bands — the reference's 32 between sections, Home's
     interval too — and tighter inside the header's own blocks: the rails are
     separate subjects and the identity block is one. */
  header: { gap: Spacing.x32, paddingBottom: Spacing.x16 },
  /* Cancels the grid's horizontal padding so the art reaches both edges. */
  banner: { marginHorizontal: -Spacing.x16, overflow: 'hidden' },
  fill: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* `height` is supplied inline — `SCRIM_RATIO` of the banner, from the bottom. */
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  /* The reference's name block: centred, 20 in from each side, 16 up from the
     edge (`x24`, the ladder's 15), and 4 between the name and the line under it. */
  identity: {
    position: 'absolute',
    left: Spacing.x32,
    right: Spacing.x32,
    bottom: Spacing.x24,
    alignItems: 'center',
    gap: Spacing.x4,
  },
  meta: { textAlign: 'center' },
  /* `<HomeSection>` insets its own heading but leaves its children to bleed, for
     the rails. The sort row is not a rail and needs the inset back. */
  sort: { paddingHorizontal: Spacing.x16 },
  /* Cancels the list's horizontal padding so a rail reaches both edges. */
  railBleed: { marginHorizontal: -Spacing.x16 },
  skeletonGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: GAP },
});
