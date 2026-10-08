import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useState, useSyncExternalStore } from 'react';
import { ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameActions, formatReleaseDate } from '@/components/game-actions';
import { caseHeightFor } from '@/components/game-case';
import { GameCaseFlip } from '@/components/game-case-flip';
import { GameDetailsSheet } from '@/components/game-details-sheet';
import {
  CriticReviewsWidget,
  GameEventsWidget,
  MemberReviewsWidget,
  TimeToBeatWidget,
} from '@/components/game-insights';
import { GameEditions, OriginalGame } from '@/components/game-lineage';
import { GameListItem } from '@/components/game-list-item';
import { GameListsSheet } from '@/components/game-lists-sheet';
import { GameModeratorCard } from '@/components/game-moderation';
import { GamePlatforms } from '@/components/game-platforms';
import { GameCoverRail } from '@/components/game-rail';
import { CommunitySimilarCard, CommunitySimilarSheet } from '@/components/community-similar';
import { GameStatsStrip } from '@/components/game-stats-strip';
import { ProgressSheet } from '@/components/progress-sheet';
import { SoundtrackSummary } from '@/components/soundtrack-section';
import { StorePrices } from '@/components/store-prices';
import { GameReviewsSheet } from '@/components/game-reviews-sheet';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { HeroArt, heroHeightFor } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { ExpandableText } from '@/components/ui/expandable-text';
import { InfoCard, InfoCardButton } from '@/components/ui/info-card';
import { ArtRail, Section, SectionInsetProvider, useSectionMetrics } from '@/components/ui/section';
import { ScoreBadge } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { scoreColor } from '@/constants/score';
import { hasCase, platformKeysFor, type PlatformKey } from '@/constants/platform-cases';
import { platformKeyForStored } from '@/constants/platform-family';
import { Radius, Spacing } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getAchievementsForGame, getCopies, getMyLog } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import { getGameById, getSimilarTo, parseGameId, type Game } from '@/lib/games';
import { recallGame } from '@/lib/games/seen-games';
import { getCollectionGames, getFranchiseGames, getGameExtras } from '@/lib/games/igdb';
import { wikidataLookupFor } from '@/lib/wikidata';
import { useAuth } from '@/store/auth';

type GameTab = 'overview' | 'soundtrack' | 'similar';

/**
 * Three tabs, down from four.
 *
 * **Reviews left, and did not move to another tab — it became a sheet.** The
 * writing about a game was behind a control that also switched between a
 * synopsis and a rail of similar games, which put the one thing people come back
 * for at the same level as a marketing blurb. It opens over the page now, from
 * the card in Overview.
 */
const TABS = [
  { key: 'overview' as const, label: 'Overview' },
  { key: 'soundtrack' as const, label: 'Soundtrack' },
  { key: 'similar' as const, label: 'Similar' },
];

/**
 * The case, sized against the screen rather than a fixed width.
 *
 * 38% leaves the remaining ~55% of the column for the title and the billing
 * beside it. Everything on this page is a ratio of the window
 * for the same reason: the masthead is a *proportion* — art this wide, copy
 * that wide, this much overlap — and a fixed number would make the same
 * composition read as two different designs on a phone and a tablet.
 */
/**
 * Lines of synopsis before its More: the reference's description card shows
 * five (`limitLine = 5`). IGDB summaries run 500–2000 characters — twenty-odd
 * lines — and at the top of the tab the whole of one would push every other
 * section below a second screenful.
 */
const SYNOPSIS_LINES = 5;

/*
 * How much of the viewport the case takes, and the ceiling on a wide one.
 *
 * 0.33, down from 0.38. The case is the subject of this row and it stays the
 * subject — but at 38% it left a 390dp phone with a ~218dp column holding a
 * 26px title, two credit lines and a score row, and the title wrapped to three
 * lines on anything longer than "Red Dead Redemption 2". Four points of width
 * moved to the text is ~20dp of measure, which is most of a word per line.
 *
 * These are the *page's* choice of how wide to draw the case, not the case's own
 * geometry: `<GameCase>` takes a width and its internal proportions, materials,
 * type and shadow are untouched by this number.
 */
const CASE_WIDTH_RATIO = 0.33;
const CASE_MAX_WIDTH = 200;

/**
 * How far the case rises *into* the hero, as a fraction of its own height.
 *
 * Not "below the art, tucked under the fade" — the case genuinely overlaps it,
 * standing in front of the key art like a boxed copy propped against a poster.
 * Nearly half, so the overlap is unmistakably an overlap; at a third it read as
 * two stacked bands that happened to touch.
 */
const CASE_OVERLAP_RATIO = 0.46;

/**
 * Lifts "See your full review" to the platform floor.
 *
 * A 16px glyph beside one line of `bodySmall` is about 18dp, against 44 (iOS)
 * and 48 (Android). Slop rather than padding, so the sentence above it keeps
 * its spacing and the block does not grow a band of dead space.
 */
const REVIEW_LINK_SLOP = { top: 15, bottom: 15, left: 8, right: 8 };

/** Lifts a one-line studio row to the platform tap floor without padding it out. */
const STUDIO_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

/**
 * The case, memoised from the outside.
 *
 * `<GameCaseFlip>` is protected and is not edited; wrapping it here is the
 * page's business. Its props are the game's own fields and constants — all
 * stable references between renders — so a page update that changes none of
 * them (a query landing for another section, the synopsis opening) no longer
 * re-renders the cover and its animated transform.
 */
const CaseFlip = memo(GameCaseFlip);

/**
 * A platform with no case, so the masthead's `<GameCaseFlip>` draws the plain
 * cover — and, having no back to show, does not turn. See the masthead.
 */
const PLAIN_COVER: PlatformKey = 'other';

/** The four sheets this page raises. */
type SheetName = 'reviews' | 'similar' | 'lists' | 'progress';

/**
 * Which sheet is open, held outside React state so that opening one re-renders
 * the sheets and not the page they rise over. `<GameSheets>` subscribes; the page
 * only ever calls `set`.
 */
type SheetStore = {
  get: () => SheetName | null;
  set: (sheet: SheetName | null) => void;
  subscribe: (listener: () => void) => () => void;
};

function createSheetStore(): SheetStore {
  let open: SheetName | null = null;
  const listeners = new Set<() => void>();
  return {
    get: () => open,
    set: (sheet) => {
      open = sheet;
      listeners.forEach((listener) => listener());
    },
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

/**
 * A game's dedicated page.
 *
 * The masthead — hero art, physical case, score, actions — stays fixed while
 * the tabs below swap content. Only the active tab's query runs, so opening the
 * page does not fetch reviews, soundtracks and recommendations it may never
 * show.
 */
export default function GameDetailScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { width, height: windowHeight } = useWindowDimensions();
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);
  const [tab, setTab] = useState<GameTab>('overview');
  /*
   * The sheets keep their own open / closed state, in `<GameSheets>`.
   *
   * It used to be five `useState`s on this component, so raising the reviews
   * sheet — or the progress sheet, or the platform picker it once had — re-rendered this
   * entire page, masthead and tab included, just to flip one flag; and it did it
   * again on the way down. Held in a small store the sheets subscribe to,
   * opening one renders the sheet and nothing else. The openers below are
   * stable, so the memoised children they are handed stay memoised.
   */
  const [sheets] = useState(createSheetStore);
  const openReviews = useCallback(() => sheets.set('reviews'), [sheets]);
  const openSimilar = useCallback(() => sheets.set('similar'), [sheets]);
  const openLists = useCallback(() => sheets.set('lists'), [sheets]);
  const openProgress = useCallback(() => sheets.set('progress'), [sheets]);

  /*
   * One platform selection for the whole page.
   *
   * The Platforms section's box and its price are two views of the same
   * choice, so the choice lives here rather than inside either. `null` means
   * "not chosen yet" and defers to `defaultPlatform` below, which cannot be
   * computed until the detail query resolves.
   */
  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  /* The Overview's sections, sized as SimpMusic's artist page is on this
     display — see `useSectionMetrics`. */
  const sections = useSectionMetrics();

  const caseWidth = Math.min(CASE_MAX_WIDTH, Math.round(width * CASE_WIDTH_RATIO));
  // Also swallows the header's group gap, so the overlap is measured from the
  // hero's edge rather than from the gap below it.
  const caseOverlap = Math.round(caseHeightFor(caseWidth) * CASE_OVERLAP_RATIO) + Spacing.x24;
  const heroHeight = heroHeightFor(width, windowHeight);

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    // Store metadata is effectively static; do not refetch during a session.
    staleTime: 30 * 60_000,
    /*
     * Start from the record the list already downloaded.
     *
     * A game opened from search, a franchise rail, a platform's page or
     * Surprise Me was fetched in full to draw its cover (`seen-games.ts`), so
     * the page is on screen in the frame it opens instead of behind a spinner
     * for a second request for the same thing. The time it was seen rides
     * along: older than `staleTime`, it still paints at once and is refreshed
     * behind. Ignored when the cache already holds this game — an earlier
     * visit, or one restored from the last launch.
     */
    initialData: () => recallGame(id)?.value,
    initialDataUpdatedAt: () => recallGame(id)?.at,
  });

  const myLog = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  const similar = useQuery({
    queryKey: ['similar', id],
    queryFn: ({ signal }) => getSimilarTo(id!, signal),
    enabled: !!id && tab === 'similar',
    staleTime: 30 * 60_000,
  });

  const similarGames = similar.data ?? [];

  /*
   * The copies you own of this game (0024).
   *
   * Fetched with the page rather than on the Overview tab alone, because the
   * answer decides whether a card exists at all — and it is one indexed query
   * returning, for nearly everybody, nothing.
   */
  const myCopies = useQuery({
    queryKey: ['copies', userId, id],
    queryFn: () => getCopies(userId!, id!),
    enabled: !!userId && !!id,
  });

  const achievements = useQuery({
    queryKey: ['game-achievements', id, userId],
    queryFn: () => getAchievementsForGame(id!, userId ?? null),
    enabled: !!id && tab === 'overview',
  });

  /*
   * Franchise and studio are IGDB-only: they key on IGDB ids that Steam, RAWG
   * and itch.io have no equivalent for. Gating on the source rather than letting
   * the queries fail keeps guaranteed-empty requests off the wire every time a
   * Steam game is opened.
   */
  const parsedId = id ? parseGameId(id) : null;
  const igdbSourceId = parsedId?.source === 'igdb' ? parsedId.sourceId : null;

  const extras = useQuery({
    queryKey: ['game-extras', id],
    queryFn: ({ signal }) => getGameExtras(igdbSourceId!, signal),
    enabled: !!igdbSourceId && tab === 'overview',
    staleTime: 30 * 60_000,
  });

  const collectionId = extras.data?.collection?.id ?? null;
  const franchiseId = extras.data?.franchises[0]?.id ?? null;

  const franchiseGames = useQuery({
    queryKey: ['franchise-games', collectionId, franchiseId],
    queryFn: ({ signal }) =>
      collectionId
        ? getCollectionGames(collectionId, signal)
        : getFranchiseGames(franchiseId!, signal),
    /* Not fetched at all on a remake or an edition: that page shows its
       original instead of the series, so the rail would be a request whose
       result never renders. */
    enabled: !game.data?.edition && (collectionId !== null || franchiseId !== null),
    staleTime: 30 * 60_000,
  });

  /*
   * The game's own hue, for the parts of this screen the screen itself draws.
   *
   * Read directly rather than through `useAccent()` because the provider that
   * carries it to the children below is rendered *by* this component, and a
   * component cannot consume a context it is itself the parent of. Everything
   * inside `<AccentProvider>` — the tab bar, the buttons, the chips, the
   * ambient wash — reads it the ordinary way.
   *
   * Resolves to the house blue while the query is in flight, which is what the
   * loading state should be: the app's colour until there is a game to take one
   * from.
   */
  const accent = useGameAccent(game.data?.coverUrl ?? game.data?.heroUrl, game.data?.genres);
  /* The same extraction the accent uses, returning its three-depth ramp rather
     than the single accent hue — one query, served from cache on both calls. */

  /*
   * Which platform's box the Platforms section shows, and prices.
   *
   * The artwork does **not** change with this selection. A SteamGridDB lookup
   * for per-platform box fronts lived here and has been removed: SteamGridDB's
   * `/grids/{platform}/{id}` slugs are *stores* — steam, gog, egs, eshop — not
   * console families, so `playstation` and `xbox` were never going to resolve
   * and the query spent a request per tap to fall back to the cover it already
   * had. The switcher re-draws the case and the price, which is what it was
   * always for.
   *
   * **It opens on a case, not on PC.** `platformKeysFor` returns the game's
   * platforms in `PLATFORM_PRIORITY` order, PC first — right for a list, wrong
   * for a default here: the section's box would be the same plain cover the
   * masthead already shows, and the one thing the section is for would be one
   * tap away. So: the platform you logged it on, else the first that comes in a
   * case (PS5, Xbox, Switch, PS4), else the first there is.
   */
  const availablePlatforms = platformKeysFor(game.data?.platforms);
  const playedOn = platformKeyForStored(myLog.data?.played_on);
  const defaultPlatform: PlatformKey | undefined =
    (playedOn && availablePlatforms.includes(playedOn) ? playedOn : undefined) ??
    availablePlatforms.find(hasCase) ??
    availablePlatforms[0];
  const activePlatform =
    platform && availablePlatforms.includes(platform) ? platform : defaultPlatform;

  if (game.isLoading) {
    return (
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back />}>
        <LoadingState />
      </Screen>
    );
  }

  if (game.isLoadingError) {
    return (
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back />}>
        <ErrorState
          error={game.error}
          action={<Button title="Retry" variant="secondary" onPress={() => game.refetch()} />}
        />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen
        /* `edges={[]}` belongs to the success branch, whose artwork bleeds under
           the bar on purpose. There is no artwork here — just a spinner or a
           sentence centred in the frame — so without the inset it centres
           itself in a rectangle that includes the status bar and the Dynamic
           Island. Nothing is drawn under the notch that wants to be there. */
        edges={['top', 'bottom']}
        topBar={<FrostedTopBar back />}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  const data = game.data;
  const logged = myLog.data;

  const unlockedCount = (achievements.data ?? []).filter((entry) => entry.unlocked_at).length;
  const achievementTotal = achievements.data?.length ?? 0;

  /* Ten at most, each announced as "Screenshot 3 of 8" rather than as eight
     unlabelled images in a row. */
  const screenshots = data.screenshots.slice(0, 10).map((url, index, shown) => ({
    url,
    label: `Screenshot ${index + 1} of ${shown.length} from ${data.title}`,
  }));

  /** The masthead, rendered above every tab. */
  const header = (
    <View style={styles.header}>
      <View style={styles.hero}>
        {/* `mask`, not a colour ramp: the backdrop behind this is a gradient
            that changes as you scroll, and a fade to a fixed dark would draw a
            band across it. Dissolving the art's own alpha lets whatever is
            behind show through, whatever colour it currently is. */}
        <HeroArt
          uri={data.heroUrl}
          steamAppId={data.steamAppId}
          height={heroHeight}
          scrim
          fade="mask"
        />
      </View>

      {/* Group 1 — identity, as one row: the boxed copy on the left standing in
          front of the key art, everything the game *is* set beside it. Stacked
          and centred, this block was two full screens before the first review;
          side by side it is one. */}
      <View style={[styles.identity, { marginTop: -caseOverlap }]}>
        {/*
          Always the plain cover, and still.

          The case moved to the Overview's Platforms section, with the platform
          button beside it and the turn-over that shows your record on its back
          — choosing a platform up here, by holding the box, was a gesture
          nobody could see. The masthead says *which game*; the section says
          *which box*. So this is the cover as the game is billed, landing on
          arrival as it always has, with nothing to press.

          `PLAIN_COVER` is a platform with no case, which is how the protected
          `<GameCaseFlip>` is asked for the bare cover — and it would announce
          that key by name. The label is the page's, set outside it, and the
          object inside is hidden from assistive tech so it is read once.

          The edition band ("Remake", "Definitive Edition") is printed by the
          case, so it is on the box in Platforms; a plain cover never carried it.
        */}
        <View
          accessible
          accessibilityRole="image"
          accessibilityLabel={[
            data.title,
            data.edition ? editionLabel(data.edition) : null,
            'cover art',
          ]
            .filter(Boolean)
            .join(', ')}>
          <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            <CaseFlip
              coverUrl={data.coverUrl}
              heroUrl={data.heroUrl}
              title={data.title}
              edition={data.edition ? editionLabel(data.edition) : null}
              platform={PLAIN_COVER}
              width={caseWidth}
              log={null}
            />
          </View>
        </View>

        {/*
          One step up the scale, all the way down this column.

          The case is fixed dp and deliberately does not ride the spacing ladder
          (DESIGN.md § 4.1), so when the chrome was compressed the artwork stayed
          put and the type beside it shrank away from it. On a 390dp phone that
          left a 148dp object next to a 23px title, a 12px date and a 10px
          studio credit — the studio line, which is a proper noun, sitting at the
          type scale's absolute floor.

          So: `display` for the name, and a step up again for everything under it —
          `h4` for the date, `body` for the two credits. The column is still the
          quiet half of the row — the case is the subject — but at `bodySmall` a
          studio credit was a 12px proper noun beside a 148dp object, which read
          as a caption rather than as the game's billing.
        */}
        <View style={styles.identityText}>
          <Text variant="display" numberOfLines={3}>
            {data.title}
          </Text>

          {/* `accent.quietInk`, not a grey token, for every quiet line in this
              block — on a tonal accent it resolves to M3's `onSurfaceVariant`,
              which carries a trace of the game's own hue rather than being a
              flat grey dropped onto a coloured page. */}
          {data.releaseDate ? (
            <Text variant="h4" style={{ color: accent.quietInk }}>
              {formatReleaseDate(data.releaseDate)}
            </Text>
          ) : data.releaseYear ? (
            <Text variant="h4" style={{ color: accent.quietInk }}>
              {data.releaseYear}
            </Text>
          ) : null}

          {/* Developer and publisher are different facts and are frequently
              different companies, so they get a line each rather than being
              joined by a dot that implies one relationship. */}
          {data.developer && (
            <Text variant="body" style={{ color: accent.quietInk }} numberOfLines={2}>
              {data.developer}
            </Text>
          )}
          {data.publisher && data.publisher !== data.developer && (
            <Text variant="body" style={{ color: accent.quietInk }} numberOfLines={2}>
              {data.publisher}
            </Text>
          )}

          {data.score !== null && (
            <View style={styles.scoreRow}>
              <ScoreBadge score={data.score} size="small" />
              {/* A quiet sentence-case label beside a bold figure — the owner's
                  reference sets numbers that way, and keeps caps for nothing. */}
              <Text variant="bodySmall" style={{ color: accent.quietInk }}>
                Community
              </Text>
            </View>
          )}
        </View>
      </View>

      {/*
        Group 3 — the numbers, between the identity block and the actions.

        Above the actions rather than below the whole masthead, which is where
        this sat when it replaced the platform buttons. The order is the order
        the questions get asked: *what is this* (the case and the billing),
        *should I bother* (four numbers), *then* the row of things to do about
        it. With the strip underneath, every reader met the primary button
        before the one piece of evidence that would tell them whether to press
        it.

        It is also what the Play Store does, for the same reason — rating,
        downloads and content rating sit directly above Install.
      */}
      <GameStatsStrip gameId={data.id} onOpenReviews={openReviews} onOpenLists={openLists} />

      {/* The actions, at the header's full width rather than squeezed into the
          right-hand column: they act on the game, not on its metadata.

          No wrapper any more. This and the log block below used to share a tight
          `record` group on the argument that "what you logged and how to change
          it are the same subject" — true, and no longer the arrangement: the
          strip is between them and the log has moved past the actions, so a
          two-child group with one child left in it was a `<View>` holding
          nothing but a gap it no longer spanned. */}
      <GameActions game={data} log={logged ?? null} onOpenProgress={openProgress} />

      {/*
        Group 4 — your own record, last in the masthead.

        It sat directly above the actions, where it was the third thing on the
        page claiming the same fact: the action row's Played key is lit, the back
        of the case prints the status and the score, and this said it again in a
        sentence. Below the actions it reads as what it actually is — the
        *consequence* of having used them, and the way back into what you wrote.

        Last also means it is the block that disappears cleanly. Nobody who has
        not logged this game sees anything here, and the tabs simply move up by
        its height rather than a gap opening mid-masthead.
      */}
      {/*
        Your own log, on a surface carrying this game's hue.

        It sat bare for a while, and the argument was good: a filled
        `tone="selected"` block made the one thing on this page that is
        *yours* look like a notice the app was showing you. That argument was
        made against a flat `#121212` page, and the ambient gradient invalidated
        it — the block now sits on the brightest part of a lit gradient, where
        `statusPlayed` measures **2.02:1**, `statusDropped` 2.07:1 and a low
        `ScoreBadge` 1.95:1.

        These are the one kind of colour that cannot be lifted to suit a
        backdrop: they are *data*, tuned as a ramp, and forcing `statusPlayed`
        to AA on the gradient moves it 165 RGB units to a pale #C0DFF8 that no
        longer belongs to the set. So the surface comes back — but tinted
        rather than grey. `accent.surface` mixes the game's own hue into
        `surface` and restores the original luminance, so every one of these
        tokens measures what it was chosen for (worst case 5.07:1) while the
        block reads as belonging to this game rather than to the app.
      */}
      {/*
        Rendered only when there is something in it to read.

        It used to be `logged &&` alone, which was safe while the status word
        was the fallback — every log has a status, so the block always had a
        line. With the word gone a log that is *only* a status (tap Played, do
        nothing else — by far the most common log there is) would leave an
        empty tinted rectangle above the actions.
      */}
      {logged && (logged.review?.trim() || logged.rating !== null || logged.platinum) && (
        <View style={[styles.myLog, { backgroundColor: accent.surface }]}>
          {logged.review?.trim() ? (
            /*
             * You wrote about this — so the block says so in a sentence and
             * then gets out of the way.
             *
             * It used to restate the log as three stacked facts: the status
             * word, a large score pill, and the review's headline. All three
             * are already on this page — the status and score are printed on
             * the back of the case a few hundred pixels above, and the
             * headline is the first thing on the review itself. Repeating
             * them here made the block a summary of a summary, and the one
             * thing it never did was offer a way to *read the thing*.
             *
             * The date is the fact that is genuinely only here: nothing else
             * on this page says when you wrote it.
             */
            <>
              <Text variant="body" color="textSecondary">
                {`You reviewed this game on ${formatReleaseDate(logged.created_at)}`}
                {logged.rating !== null ? ' and gave it a ' : '.'}
                {logged.rating !== null && (
                  <Text variant="h4" style={{ color: scoreColor(logged.rating, theme) }}>
                    {`${Math.round(logged.rating)}.`}
                  </Text>
                )}
              </Text>

              <Link href={{ pathname: '/review/[id]', params: { id: logged.id } }} asChild>
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel="See your full review"
                  hitSlop={REVIEW_LINK_SLOP}
                  style={styles.reviewLink}
                  scaleTo={0.98}>
                  <Ionicons name="eye-outline" size={16} color={theme.primaryText} />
                  <Text variant="bodySmall" style={{ color: theme.primaryText }}>
                    See your full review
                  </Text>
                </PressableScale>
              </Link>
            </>
          ) : (
            /*
             * No writing — so there is no review to link to, and the block
             * falls back to stating the record it does have.
             *
             * **Which no longer includes the status word.** "Played" with its
             * tick used to head this block, and it was the third place on one
             * screen saying the same thing: the action row's Played key is lit
             * and solid, and the back of the case prints the status too. A
             * label restating the state of a control 200dp above it is not a
             * fact the block contributes — the score and the platinum are.
             */
            <>
              {logged.platinum && (
                <View style={styles.myLogHead}>
                  <Ionicons name="trophy" size={16} color={theme.platinum} />
                </View>
              )}
              {logged.rating !== null && <ScorePill score={logged.rating} size="large" showLabel />}
            </>
          )}
        </View>
      )}
    </View>
  );

  function renderTab() {
    switch (tab) {
      case 'soundtrack':
        return (
          <View style={styles.tabBody}>
            <SoundtrackSummary gameId={data.id} title={data.title} developer={data.developer} />
          </View>
        );

      case 'similar':
        /*
          Two lists, and the community's leads.

          IGDB's similar games are an algorithm's answer, with no reasons and no
          way to disagree; the community's are players naming a game and saying
          *why* (0025). Different claims, so each has its own heading and its own
          loading, error and empty states — a failed IGDB request used to blank
          the whole tab, which would now also hide what players said. The
          community's comes first because it is the answer only this app has.
        */
        return (
          <View style={styles.tabBody}>
            <CommunitySimilarCard gameId={data.id} gameTitle={data.title} onOpen={openSimilar} />

            <View style={styles.similarSection}>
              <View style={styles.similarHead}>
                <Text variant="h3" accessibilityRole="header">
                  Similar, according to IGDB
                </Text>
                <Text variant="caption" color="textMuted">
                  The catalogue’s own list. No reasons given.
                </Text>
              </View>

              {similar.isLoading ? (
                <LoadingState />
              ) : similar.isLoadingError ? (
                /* `getSimilarTo` used to swallow every failure into an empty
                   array, so a dropped connection rendered as a statement about
                   IGDB's catalogue. It throws now; this tells the two apart. */
                <ErrorState
                  error={similar.error}
                  action={
                    <Button title="Retry" variant="secondary" onPress={() => similar.refetch()} />
                  }
                />
              ) : (similar.data ?? []).length === 0 ? (
                <Text variant="body" color="textSecondary">
                  {data.source === 'igdb'
                    ? 'IGDB has no similar games listed for this title.'
                    : 'IGDB’s list is only available for IGDB titles. Try opening this game from a search result instead.'}
                </Text>
              ) : (
                similarGames.map((entry) => (
                  <View key={entry.id} style={styles.reviewRow}>
                    <GameListItem game={entry} />
                  </View>
                ))
              )}
            </View>
          </View>
        );

      default:
        /*
          SimpMusic's artist page, section for section (see `<InfoCard>`): every
          heading stands on the page, a section that is pictures is a rail of
          them under its heading, and a section that is words sits in a card
          under its heading. Sizes are the reference's, as fractions of the
          display (`useSectionMetrics`), and nothing here pads itself sideways —
          the inset is handed down, so the rails can run edge to edge and still
          start in line with the headings.
        */
        return (
          <SectionInsetProvider inset={sections.inset}>
            <View style={[styles.overview, { gap: sections.sectionGap }]}>
              {/*
                Screenshots first: somebody arriving on a page they have not
                played is asking what it looks like before they ask what anybody
                thought. At the reference's video size, which is the size of the
                pictures on its artist page that are not album art.
              */}
              {screenshots.length > 0 && (
                <Section title="Screenshots">
                  <ArtRail
                    data={screenshots}
                    keyOf={(shot) => shot.url}
                    shape="wide"
                    renderArt={(shot, size) => (
                      <Image
                        source={{ uri: shot.url }}
                        style={[size, styles.shot, { backgroundColor: theme.surfaceElevated }]}
                        contentFit="cover"
                        transition={200}
                        accessible
                        accessibilityRole="image"
                        accessibilityLabel={shot.label}
                        accessibilityIgnoresInvertColors
                      />
                    )}
                  />
                </Section>
              )}

              {/*
                About: what the game is, before what anybody thought of it or
                what it costs. The reference's own description card — five lines,
                then More, and the card opens in place (`<ExpandableText>`). The
                full IGDB record is the heading's Details. With no synopsis the
                card says so, as the reference's does, and Details still opens
                the record.
              */}
              <InfoCard
                title="About"
                moreSlot={<GameDetailsSheet gameId={data.id} trigger="more" />}>
                {data.description ? (
                  <ExpandableText lines={SYNOPSIS_LINES} subject="the description">
                    {data.description}
                  </ExpandableText>
                ) : (
                  <Text variant="body" color="textSecondary">
                    No description
                  </Text>
                )}
              </InfoCard>

              {/*
                Platforms: which machines it is on, and the box on each — the
                case, its turn-over and its price, beside the platform button
                that changes all three. After About, because what the game is
                comes before which box to get; before Where to buy, because which
                box comes before which shop. On the page and not in a card: it
                is the one section here whose subject is an object.
              */}
              {activePlatform && (
                <GamePlatforms
                  game={data}
                  log={logged ?? null}
                  platforms={availablePlatforms}
                  selected={activePlatform}
                  onSelect={setPlatform}
                  artWidth={caseWidth}
                />
              )}

              {/* Below About, not above it: the price is the next question for
                  a reader who has decided, and the synopsis is how anyone else
                  decides. */}
              <StorePrices gameId={data.id} title={data.title} steamAppId={data.steamAppId} />

              {/*
                Your copy, directly under where to buy one — the two answers to
                "how do I get this" and "I already have it". Only when you own
                one; the way in otherwise is "I own a copy" on the Collect key.
              */}
              {(myCopies.data?.length ?? 0) > 0 && userId && (
                <InfoCardButton
                  title={myCopies.data!.length === 1 ? 'Your copy' : 'Your copies'}
                  accessibilityLabel={
                    myCopies.data!.length === 1
                      ? `Your copy: ${releaseLine(myCopies.data![0]) || 'release not recorded'}. Open it.`
                      : `You own ${myCopies.data!.length} copies. Open them.`
                  }
                  onPress={() =>
                    myCopies.data!.length === 1
                      ? router.push({
                          pathname: '/copy/[id]',
                          params: { id: myCopies.data![0].id },
                        })
                      : router.push({
                          pathname: '/copies/[user]',
                          params: { user: userId, game: data.id },
                        })
                  }>
                  <View style={styles.copyLines}>
                    <Text variant="h4">
                      {releaseLine(myCopies.data![0]) || 'Release not recorded'}
                    </Text>
                    {copyStateLine(myCopies.data![0]) && (
                      <Text variant="body" color="textSecondary">
                        {copyStateLine(myCopies.data![0])}
                      </Text>
                    )}
                    {myCopies.data!.length > 1 && (
                      <Text variant="caption" color="textMuted">
                        {`and ${myCopies.data!.length - 1} more`}
                      </Text>
                    )}
                  </View>
                </InfoCardButton>
              )}

              {/*
                What people here wrote, as a rail of cards, most liked first.
                The way to everything anybody wrote is the heading's More.

                Only when somebody has written one. An empty section asking for
                the first review repeated the masthead's review button, the one
                primary action on the page, and a section exists here only when
                it has something in it — as Where to buy and Developers do.
              */}
              <MemberReviewsWidget gameId={data.id} title={data.title} onSeeAll={openReviews} />

              {/*
                What the critics wrote, under what people here wrote: the two
                kinds of review in the same card, the app's own first. A rail of
                quotes at the size of "Featured in" below — absent, like that
                one, for the many games it has nothing for.
              */}
              <CriticReviewsWidget
                gameId={data.id}
                title={data.title}
                releaseYear={data.releaseYear}
              />

              <TimeToBeatWidget gameId={data.id} />
              <GameEventsWidget gameId={data.id} />

              {/*
                The companies, one name per line; tapping one opens their
                catalogue. Tappable only for IGDB titles — company ids come from
                IGDB, so a Steam-sourced game shows the names as plain text.
              */}
              {(extras.data?.companies.length ?? 0) > 0 && (
                <InfoCard title="Developers">
                  <View style={styles.studios}>
                    {extras.data!.companies.map((company) => (
                      <PressableScale
                        key={company.id}
                        accessibilityRole="button"
                        accessibilityLabel={`${company.name}, ${
                          company.role === 'developer' ? 'developer' : 'publisher'
                        }. See their games.`}
                        hitSlop={STUDIO_SLOP}
                        scaleTo={0.98}
                        onPress={() =>
                          router.push({
                            pathname: '/studio/[id]',
                            params: { id: String(company.id), name: company.name },
                          })
                        }
                        style={StyleSheet.flatten(styles.studioRow)}>
                        {/* The name at full width — IGDB's run long ("Kabushiki
                            Gaisha Nintendo Entaateinmento Puranningu &
                            Debelopumento") and a row can wrap where a chip could
                            only truncate. */}
                        <Text variant="body" style={styles.studioName}>
                          {company.name}
                        </Text>
                      </PressableScale>
                    ))}
                  </View>
                </InfoCard>
              )}

              {/*
                Additional information — awards, cast and the people who made the
                game, from Wikidata — under the companies: the companies, then the
                people. A door: a screen of its own, fetched only when opened, and
                offered only when the game carries an id Wikidata can be searched
                by (`wikidataLookupFor`).
              */}
              {wikidataLookupFor(data) && (
                <InfoCardButton
                  title="Additional information"
                  accessibilityLabel="View additional game information: awards, cast and credits"
                  onPress={() =>
                    router.push({ pathname: '/game-info/[id]', params: { id: data.id } })
                  }>
                  <Text variant="body" color="textSecondary">
                    Awards, cast and crew, from Wikidata.
                  </Text>
                </InfoCardButton>
              )}

              {/*
                Series and lineage, and which one you get depends on what this
                game *is*. A remake, remaster, DLC or edition shows the game it
                came from and no franchise rail; an original shows its series —
                originals only, see `ORIGINALS_ONLY` — and its own versions.
              */}
              {data.edition && data.parentId ? (
                <OriginalGame parentId={data.parentId} edition={data.edition} />
              ) : (
                <GameEditions gameId={data.id} />
              )}

              {/* Franchise. IGDB models a numbered series as `collection` and the
                  wider brand as `franchises`; the collection is the more useful
                  of the two, so it wins when both exist. Hidden on a derivative —
                  the section above already places it. */}
              {!data.edition && franchiseGames.data && franchiseGames.data.length > 1 && (
                <Section title={extras.data?.collection?.name ?? 'Franchise'}>
                  <GameCoverRail
                    games={franchiseGames.data.filter((entry) => entry.id !== data.id)}
                  />
                </Section>
              )}

              {/* A failed fetch used to leave `achievementTotal` at 0 and take the
                  whole section with it — silently, and identically to a game that
                  genuinely tracks none. The count is the section's own claim, so
                  it cannot be rendered from a number the app never received. */}
              {achievements.isLoadingError ? (
                <InfoCard title="Achievements">
                  <Text variant="body" color="textSecondary">
                    Could not load achievements. Pull to refresh, or try again later.
                  </Text>
                </InfoCard>
              ) : (
                achievementTotal > 0 && (
                  <InfoCardButton
                    title="Achievements"
                    accessibilityLabel={`All ${achievementTotal} achievements`}
                    onPress={() =>
                      router.push({ pathname: '/achievements/[id]', params: { id: data.id } })
                    }>
                    <Text variant="body" color="textSecondary">
                      <Text variant="h4">
                        {unlockedCount}/{achievementTotal}
                      </Text>
                      {' unlocked. Tap to see every one.'}
                    </Text>
                  </InfoCardButton>
                )
              )}

              {/* A moderator's controls — the Must Play label. Draws nothing
                  for anybody who is not one. */}
              <GameModeratorCard game={data} />

              {data.storeUrl && (
                <View style={{ paddingHorizontal: sections.inset }}>
                  <ExternalLink
                    href={data.storeUrl as Href & string}
                    label={`Open ${data.title} on ${data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}`}>
                    <Text variant="h5" style={{ color: accent.onSurface }}>
                      Open on {data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}
                    </Text>
                  </ExternalLink>
                </View>
              )}
            </View>
          </SectionInsetProvider>
        );
    }
  }

  return (
    /* Everything below here runs on this game's colour rather than the app's.
       The provider is what makes that a one-line change instead of a prop on
       every control: the tab bar, the log button, the chips and the ambient
       wash all read the accent from context. */
    <AccentProvider artwork={data.coverUrl ?? data.heroUrl} genres={data.genres}>
      <>
        <Screen
          edges={[]}
          /*
            A flat fill in the game's own darkest tone, where a scroll-driven
            gradient used to be.

            The gradient was the wrong instrument for what this page needs. It
            put the page's brightest colour at the top — directly behind the
            masthead — so the primary button, the active action keys and the lit
            platform key were all competing with a backdrop made of their own
            hue, and the answer had been to keep pushing the accent quieter. A
            fixed near-black page inverts that: `accent.page` sits three full
            tone steps below `accent.color`, so the loud things can be as loud as
            they are meant to be without anything having to be measured against a
            surface that moves as you scroll.

            It also removes a whole class of contrast problem. Every "this
            measures 2.02:1 on the brightest stop" note in this file and its
            neighbours existed because the backdrop was variable; a flat page is
            a known quantity.
          */
          background={accent.page}
          /* The title is the game's, and the bar gets out of the way as you read
           down the page — the masthead below it already says which game this is
           in art three hundred points tall. */
          topBar={<FrostedTopBar back />}>
          {/*
            A ScrollView, not a one-item FlatList.

            The page was a FlatList whose single cell was the whole active tab,
            so that the tab bar could scroll away with the masthead. It bought
            nothing a ScrollView does not — one cell is never windowed — and it
            cost: `renderItem` was a fresh function on every render, so the list
            re-rendered its page-sized cell every time anything on the page
            changed, and reported it ("a large list that is slow to update").
            Nothing inside the tabs is a vertical list; the rails are horizontal,
            which nests inside a ScrollView without complaint.
          */}
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
            {header}
            {/* `center`: three pills do not reach the edges of a phone, and
                left-aligned under a full-width masthead they read as a row
                that lost a tab — which is exactly what happened when Reviews
                became a sheet. See `TabBarProps.align`. */}
            <TabBar tabs={TABS} value={tab} onChange={setTab} align="center" />
            {renderTab()}
          </ScrollView>
        </Screen>

        {/* A sibling of `<Screen>`, not a child: the floating back disc is
            rendered by the screen *after* its content, so a sheet mounted inside
            would have the page's own back arrow floating over the top of it. */}
        <GameSheets store={sheets} game={data} log={logged ?? null} />
      </>
    </AccentProvider>
  );
}

/**
 * The sheets this page raises, and whether each is open.
 *
 * Subscribed to the page's sheet store, so that opening one re-renders this and
 * not the page under it. See the note where the page creates the store.
 */
function GameSheets({ store, game, log }: { store: SheetStore; game: Game; log: GameLog | null }) {
  const router = useRouter();
  const open = useSyncExternalStore(store.subscribe, store.get);
  const close = useCallback(() => store.set(null), [store]);

  return (
    <>
      <SlideUpSheet visible={open === 'reviews'} onClose={close} title={game.title}>
        <GameReviewsSheet gameId={game.id} gameTitle={game.title} criticScore={game.score} />
      </SlideUpSheet>

      {/* The community's similar games, from the Similar tab's card — the same
          sheet the reviews open in, full height, sortable. A pick opens its own
          screen on top and coming back lands here again. */}
      <SlideUpSheet visible={open === 'similar'} onClose={close} title={game.title}>
        <CommunitySimilarSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      {/* Which collections hold this game, from the strip's second cell. Full
          height: there is nothing behind it to watch while it is open, and a
          collection row is a 96dp mosaic plus four lines of text. */}
      <SlideUpSheet visible={open === 'lists'} onClose={close} title="In collections">
        <GameListsSheet gameId={game.id} gameTitle={game.title} />
      </SlideUpSheet>

      {/* Your progress, from the action row's progress key. Most of the display
          but not all of it — the key you pressed and the case's printed back
          both change when you choose, and are worth keeping in sight. */}
      <SlideUpSheet
        visible={open === 'progress'}
        onClose={close}
        title="Your progress"
        maxHeightRatio={0.85}>
        <ProgressSheet
          game={game}
          log={log}
          onClose={close}
          onOpenPlaythroughs={() => {
            close();
            router.push({ pathname: '/playthroughs/[game]', params: { game: game.id } });
          }}
        />
      </SlideUpSheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  /* A list inside one card, so the interval is a list's rather than a card's. */
  studios: { gap: Spacing.x4 },
  studioRow: { paddingVertical: Spacing.x4 },
  studioName: { flexShrink: 1 },
  /*
   * `five` between groups, not `four` between every child.
   *
   * The masthead used one 16dp gap for all seven siblings, which is the failure
   * where a single repeated interval gives hero, identity, status and actions
   * exactly equal weight. Three groups separated generously, tight
   * inside — the rhythm now says what belongs with what.
   */
  header: { gap: Spacing.x24, paddingHorizontal: Spacing.x16, marginBottom: Spacing.x24 },
  hero: { marginHorizontal: -Spacing.x16 },
  /* `marginTop` is supplied inline — it scales with the case.
     
     **`flex-start`, and the reason is the whole composition.** This was
     `flex-end`, to share a baseline at the bottom — but in a flex row that
     aligns the *shorter* child to the taller one's bottom, and the taller child
     here is the text. So as a game accumulated metadata the case was pushed
     *down*, out of the key art: measured at 390×844, a typical game (2-line
     title, developer, score, four platforms) already put the case 13dp **below**
     the hero, and a metadata-rich one 130dp below. The 46% overlap that makes
     this masthead a boxed copy propped against a poster rather than two stacked
     bands only survived on games with almost no metadata.
     
     The case is the fixed shape, so the case is the anchor. Top-aligned, the
     overlap holds at 86dp into the art for every game, and the text runs past
     the case's bottom edge when it needs to — which it may, because what
     follows is a gap and not more artwork.
     
     The old comment worried that top-aligning would leave a short title
     "floating against nothing". It is the other way round: `flex-end` was what
     put 160dp of void *above* the title on a sparse game. Top-aligned, the
     title meets the case's top edge and any slack falls below it, beside the
     lower half of the case, where it reads as ordinary margin. */
  identity: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  identityText: { flex: 1, gap: Spacing.x8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 + 2 },
  myLog: {
    gap: Spacing.x8,
    padding: Spacing.x16,
    borderRadius: Radius.card,
  },
  /* `flex-end`, not `space-between`. The row held the status word on the left
     and the platinum trophy on the right; with the word gone `space-between`
     would park a lone trophy at the left margin, which reads as a bullet. */
  myLogHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end' },
  /* `flex-start` so the target is the width of its label, not of the block —
     a full-width row here would read as a button, and this is a link. */
  reviewLink: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x8,
  },
  tabBody: { padding: Spacing.x16, gap: Spacing.x16 },
  /* No sideways padding: every section takes the inset it is handed, so a
     rail can run edge to edge. The gap between sections is set inline. */
  overview: { paddingTop: Spacing.x8, paddingBottom: Spacing.x16 },
  copyLines: { gap: 2 },
  /* A step more than the tab's own rhythm between the community's list and
     IGDB's, so they read as two sections rather than one list with a break. */
  similarSection: { gap: Spacing.x12, marginTop: Spacing.x24 },
  similarHead: { gap: 2 },
  reviewRow: { marginBottom: Spacing.x12 },
  /* The size comes from the rail; the corner is the app's box-art corner. */
  shot: { borderRadius: Radius.image },
});
