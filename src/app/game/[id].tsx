import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Link, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { memo, useCallback, useMemo, useState, useSyncExternalStore } from 'react';
import { Platform, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { runOnJS } from 'react-native-reanimated';

import { ExternalLink } from '@/components/external-link';
import { GameActions, formatReleaseDate } from '@/components/game-actions';
import { GamePrice, PlatformPicker } from '@/components/game-availability';
import { caseHeightFor } from '@/components/game-case';
import { GameCaseFlip } from '@/components/game-case-flip';
import { GameDetailsSheet } from '@/components/game-details-sheet';
import { GameEventsWidget, TimeToBeatWidget } from '@/components/game-insights';
import { GameEditions, OriginalGame } from '@/components/game-lineage';
import { GameListItem } from '@/components/game-list-item';
import { GameListsSheet } from '@/components/game-lists-sheet';
import { GamePosterRail } from '@/components/game-rail';
import { CommunitySimilarCard, CommunitySimilarSheet } from '@/components/community-similar';
import { GameStatsStrip } from '@/components/game-stats-strip';
import { ProgressSheet } from '@/components/progress-sheet';
import { SoundtrackAlbums } from '@/components/soundtrack-section';
import { StorePrices } from '@/components/store-prices';
import { TopReviewCard } from '@/components/top-review-card';
import { GameReviewsSheet } from '@/components/game-reviews-sheet';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { HeroArt, heroHeightFor } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { InfoCard, InfoCardButton } from '@/components/ui/info-card';
import { ScoreBadge } from '@/components/ui/surface';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { editionLabel } from '@/constants/game-editions';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { scoreColor } from '@/constants/score';
import { platformKeysFor, type PlatformKey } from '@/constants/platform-cases';
import { HeroAspectRatio, Radius, Spacing, TapTarget } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getAchievementsForGame, getCopies, getMyLog, getTopGameReview, setLiked } from '@/lib/api';
import type { GameLog } from '@/lib/database.types';
import { getGameById, getSimilarTo, parseGameId, type Game } from '@/lib/games';
import { getCollectionGames, getFranchiseGames, getGameExtras } from '@/lib/games/igdb';
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
 * 38% leaves the remaining ~55% of the column for the title, the price and the
 * platform buttons beside it. Everything on this page is a ratio of the window
 * for the same reason: the masthead is a *proportion* — art this wide, copy
 * that wide, this much overlap — and a fixed number would make the same
 * composition read as two different designs on a phone and a tablet.
 */
/**
 * Lines of synopsis shown before "Read more".
 *
 * Six is where an IGDB summary stops being a paragraph and starts being the
 * page. The character threshold below is deliberately generous — it only has to
 * separate "there is more" from "there is not".
 */
const SYNOPSIS_LINES = 6;
const SYNOPSIS_CLAMP_ABOVE = 320;

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
 * page's business. Its props are the game's own fields, the chosen platform and
 * the log — all stable references between renders — so a page update that
 * changes none of them (a query landing for another section, the synopsis
 * opening) no longer re-renders the case and its animated transform.
 */
const CaseFlip = memo(GameCaseFlip);

/** The five sheets this page raises. */
type SheetName = 'reviews' | 'similar' | 'lists' | 'progress' | 'platforms';

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
   * sheet — or the progress sheet, or the platform picker — re-rendered this
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

  /** Raised by the hold on the case. Separate so the worklet has a plain
      function to `runOnJS` rather than a closure rebuilt every render. */
  const openPlatforms = useCallback(() => {
    sheets.set('platforms');
    if (Platform.OS !== 'web') {
      void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    }
  }, [sheets]);
  const queryClient = useQueryClient();

  /*
   * One platform selection for the whole page.
   *
   * The artwork, the price and the store link are three views of the same
   * choice, so the choice lives here rather than inside any of them. `null`
   * means "not chosen yet" and defers to the game's own priority order, which
   * cannot be computed until the detail query resolves.
   */
  const [platform, setPlatform] = useState<PlatformKey | null>(null);

  /*
   * The synopsis is collapsed until asked for.
   *
   * IGDB summaries run 500–2000 characters; at 13/19 in a 366dp column that is
   * roughly 27 lines — about 513dp of unbroken body text, which now sits at the
   * *top* of the tab and would push the storefronts, the reviews, Studios,
   * Franchise, Screenshots and Achievements below a second screenful.
   * Six lines is enough to know whether you want the rest.
   */
  const [synopsisOpen, setSynopsisOpen] = useState(false);

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
  });

  const myLog = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  /*
   * One review for the Overview card, not the list.
   *
   * The list lives in the sheet and is only fetched when it opens, so a visit
   * that never taps through costs a single row rather than fifty.
   */
  const topReview = useQuery({
    queryKey: ['top-review', id, userId],
    queryFn: () => getTopGameReview(id!, userId ?? null),
    enabled: !!id,
    staleTime: 60_000,
  });

  const likeReview = useMutation({
    mutationFn: (next: boolean) => setLiked(userId!, 'log', topReview.data!.log.id, next),
    onMutate: async (next) => {
      const key = ['top-review', id, userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: typeof topReview.data) =>
        old ? { ...old, likedByViewer: next, likes: old.likes + (next ? 1 : -1) } : old
      );
      return { previous, key };
    },
    onError: (_error, _next, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
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
   * Which platform's edition is on screen.
   *
   * Resolved from the game's platform list, which `platformKeysFor` returns in
   * `PLATFORM_PRIORITY` order — PC first, so a multiplatform release opens on
   * the bare portrait cover rather than inside a console case.
   *
   * The artwork does **not** change with this selection. A SteamGridDB lookup
   * for per-platform box fronts lived here and has been removed: SteamGridDB's
   * `/grids/{platform}/{id}` slugs are *stores* — steam, gog, egs, eshop — not
   * console families, so `playstation` and `xbox` were never going to resolve
   * and the query spent a request per tap to fall back to the cover it already
   * had. The switcher still re-draws the case's spine, the price and the store
   * link, which is what it was always for.
   */
  const availablePlatforms = platformKeysFor(game.data?.platforms);
  const activePlatform =
    platform && availablePlatforms.includes(platform) ? platform : availablePlatforms[0];

  /*
   * Hold the case to open the platform picker.
   *
   * `enabled` on the count rather than skipping the detector: a `<GestureDetector>`
   * whose gesture is disabled is inert and still lets every touch through, so the
   * flip and the tap behave identically on a single-platform game. Mounting it
   * conditionally would instead swap the view tree under the case and cost it its
   * arrival animation on any game that gains a platform mid-session.
   *
   * The haptic fires from the worklet thread via `runOnJS` — `Gesture` callbacks
   * are worklets, and calling into Expo's native module directly from one is the
   * crash this indirection exists to prevent. Fire-and-forget, because a missing
   * Taptic engine must never take the gesture down with it.
   */
  const caseHold = useMemo(
    () =>
      Gesture.LongPress()
        .enabled(availablePlatforms.length > 1)
        .minDuration(400)
        .onStart(() => {
          'worklet';
          runOnJS(openPlatforms)();
        }),
    [availablePlatforms.length, openPlatforms]
  );

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

  if (game.isError) {
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
        {/* The badge the case was missing on its own page.

            Every 92dp poster in a franchise rail is stamped "Remake" by
            `<Poster edition>`, and the 148dp case on that remake's own page —
            the largest, most deliberate rendering of the same fact — was the
            one place the app knew and did not say. `GameCaseDisplay` has taken
            the prop since it was written; nothing was passing it.

            Wrapped rather than replaced: `<GameCaseFlip>` lands the case on
            arrival and turns it over to the record on a drag or a tap. The front
            is still exactly this component, drawn by the same protected
            `<GameCase>`; the wrapper contributes only the rotation the `tilt`
            prop was written to receive. */}
        {/*
          Hold the case to change which edition it is.

          The picker used to be a row of up to seven buttons under the masthead,
          which spent two lines of the page's most valuable space on a control
          most readers set once or never. It is a sheet now, and the case itself
          is the affordance — you press the object you want to re-draw.

          ## Why the gesture is here and not inside `<GameCaseFlip>`

          That component owns the drag-to-turn, and it wraps the protected
          `<GameCase>`. Composing a long press *around* it keeps both untouched
          and lets RNGH arbitrate naturally: a hold that does not move raises the
          sheet, and any real horizontal travel is a flip, because movement
          cancels a long press before it fires. The two never both win.

          Guarded on there being a choice to make — one platform means the hold
          does nothing, which is better than a sheet with a single row in it.
        */}
        <GestureDetector gesture={caseHold}>
          <View accessible={false}>
            <CaseFlip
              coverUrl={data.coverUrl}
              heroUrl={data.heroUrl}
              title={data.title}
              edition={data.edition ? editionLabel(data.edition) : null}
              platform={activePlatform}
              width={caseWidth}
              log={logged ?? null}
            />
          </View>
        </GestureDetector>

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
              <Text variant="h6" style={{ color: accent.quietInk }}>
                COMMUNITY
              </Text>
            </View>
          )}

          {/* The price sits with the game's other facts, directly under what
              everyone else thinks of it — "what is this and what does it cost"
              read as one column beside the object itself.

              It ran full width below the case for a while, grouped with the
              platform buttons on the argument that the two are one control. The
              argument still holds for the *buttons*, which stay below: they
              re-draw the case, the price and the store link together, and seven
              of them need the full width to wrap in two rows instead of three.
              The price itself is a fact, not a control, so it belongs up here —
              at the cost of a narrower column, which is why the store link
              under it truncates rather than wraps. */}
          <GamePrice
            gameId={data.id}
            selected={activePlatform}
            title={data.title}
            steamAppId={data.steamAppId}
          />
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
            <SoundtrackAlbums gameTitle={data.title} layout="grid" />
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
              ) : similar.isError ? (
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
        return (
          <View style={styles.tabBody}>
            {/*
              Screenshots, first, and with no heading at all.

              They were the seventh thing on this tab, below About, Studios,
              Reviews, the insight widgets and the franchise rail — which put the
              only *moving pictures of the game* below five blocks of type about
              it. Somebody arriving on a page they have not played is asking what
              it looks like before they ask what anybody thought, and a
              horizontally scrolling strip answers that in one glance without
              costing the tab a screenful.

              The double exception to the `<InfoCard>` rule (CLAUDE.md): the art
              is the content, so there is no frame around it — and now no title
              above it either. A row of screenshots of a game, on that game's own
              page, under its own key art, does not need a word telling you what
              it is; every other section on this tab states its subject because
              its subject is not visible from its contents. This one's is.
            */}
            {data.screenshots.length > 0 && (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.shots}>
                {data.screenshots.slice(0, 10).map((url, index) => (
                  <Image
                    key={url}
                    source={{ uri: url }}
                    style={[styles.shot, { backgroundColor: theme.surfaceElevated }]}
                    contentFit="cover"
                    transition={200}
                    /* Announced as "Screenshot 3 of 8" rather than as eight
                       unlabelled images in a row. */
                    accessible
                    accessibilityRole="image"
                    accessibilityLabel={`Screenshot ${index + 1} of ${Math.min(data.screenshots.length, 10)} from ${data.title}`}
                    accessibilityIgnoresInvertColors
                  />
                ))}
              </ScrollView>
            )}

            {/*
              About leads the tab.

              It used to sit seventh, under the storefronts, the reviews and
              two insight widgets — so the first thing a reader met
              on a page about a game was a row of prices, and the sentence saying
              what the game *is* was below the fold on every phone. What a thing
              is comes before what anyone thought of it and before what it costs;
              everything below this card answers a question you can only have
              once you know that.

              "More information" is its footer rather than the card that used to
              follow it. The synopsis and the full IGDB record are one subject at
              two depths, and as separate panels they were two boxes in a row
              both offering to tell you about this game. Shaped exactly like "See
              all reviews" below, which is the same move out of a summary.
            */}
            {data.description ? (
              <InfoCard title="About">
                <Text
                  variant="body"
                  color="textSecondary"
                  numberOfLines={synopsisOpen ? undefined : SYNOPSIS_LINES}>
                  {data.description}
                </Text>
                {/* Only offered when there is plausibly something behind the
                    clamp — a two-line summary with a "Read more" under it is a
                    control that does nothing. Measured in characters rather
                    than lines because the line count is not knowable until
                    layout, and `onTextLayout` would put a setState on the
                    render path of the longest block on the page. */}
                {data.description.length > SYNOPSIS_CLAMP_ABOVE && (
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityState={{ expanded: synopsisOpen }}
                    accessibilityLabel={
                      synopsisOpen ? 'Collapse the description' : 'Read the full description'
                    }
                    onPress={() => setSynopsisOpen((open) => !open)}
                    scaleTo={0.98}
                    style={styles.synopsisToggle}>
                    <Text variant="h5" style={{ color: accent.onSurface }}>
                      {synopsisOpen ? 'Show less' : 'Read more'}
                    </Text>
                    <Ionicons
                      name={synopsisOpen ? 'chevron-up' : 'chevron-down'}
                      size={16}
                      color={accent.onSurface}
                    />
                  </PressableScale>
                )}

                <GameDetailsSheet gameId={data.id} trigger="row" />
              </InfoCard>
            ) : (
              /* No synopsis to host the footer, so the record keeps its own
                 panel. Renders nothing at all on a non-IGDB row. */
              <GameDetailsSheet gameId={data.id} />
            )}

            {/*
              The platform and genre chip rows are gone.
              
              Both restated something the page already said louder. The platform
              switcher directly above the tabs *is* the platform list, and it is
              a control rather than a caption. Genres are printed in full inside
              "More information" — now the footer of the About card above —
              alongside themes, modes and perspectives, which is where somebody
              looking for that kind of fact goes, and it is the only place the
              four appear together.

              What the two rows cost was the top of the Overview tab: two
              wrapping rows of grey capsules above the first real section, on
              the screen's most valuable strip.
            */}

            {/* Below About, not above it. This sat first for a while on the
                argument that "where do I get this" comes before the synopsis —
                which is true only of a reader who has already decided, and the
                synopsis is how anyone else decides. A page about a game opens on
                what the game is; the price is the next question, not the first. */}
            <StorePrices gameId={data.id} title={data.title} steamAppId={data.steamAppId} />

            {/*
              Your copy, directly under where to buy one — the two answers to
              "how do I get this" and "I already have it".

              Only when you own one. For anybody who does not collect boxes a
              card inviting them to add a copy would be a permanent fixture asking
              for something they never do; the way in is "I own a copy" on the
              Collect key, where the intent to *have* a game already lives. The
              card is the quick view only — the release and the copy's state, one
              line each — and the detail is behind it.
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
                    ? router.push({ pathname: '/copy/[id]', params: { id: myCopies.data![0].id } })
                    : router.push({
                        pathname: '/copies/[user]',
                        params: { user: userId, game: data.id },
                      })
                }
                action={<Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}>
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
              Three widgets, in the order the questions get asked.

              **What did people here think** first, because it is the only score
              on the page that belongs to this app — the masthead's `COMMUNITY`
              is IGDB's, and a distribution says something a mean cannot: whether
              a 74 is agreement or an argument.

              **How long is it** second: the question between deciding you are
              interested and deciding to start.

              **Where has it been** last, because most games have no events at
              all and the widget renders nothing when so.

              All three sit below About now. They used to argue their way above
              it — an appearance at The Game Awards is a fact where a synopsis is
              a marketing summary — and that argument lost to a simpler one: the
              synopsis is the only thing on this tab that says what the game *is*,
              and none of these three mean anything to a reader who does not yet
              know that.
            */}
            {/*
              What one person wrote, then the way to everything anybody wrote.
              Directly under the distribution, because the graph says *how the
              room voted* and this says *what somebody actually thought* — the
              second question, in the order it gets asked.
            */}
            <InfoCard title="Reviews">
              <TopReviewCard
                /* `bare`: the card is already here. */
                bare
                /* Five, against the default three. This tab scrolls and this is
                   the only review on it, so the clamp can afford to be a real
                   sample rather than a taste — the three exists for Surprise Me,
                   where the same card sits on a screen that must not scroll. */
                lines={5}
                review={topReview.data ?? null}
                loading={topReview.isPending}
                liked={topReview.data?.likedByViewer ?? false}
                onToggleLike={() => {
                  if (topReview.data && userId) likeReview.mutate(!topReview.data.likedByViewer);
                }}
                onOpenReview={() => {
                  if (topReview.data) {
                    router.push({
                      pathname: '/review/[id]',
                      params: { id: topReview.data.log.id },
                    });
                  }
                }}
                onWriteReview={() =>
                  router.push({ pathname: '/log/[id]', params: { id: data.id } })
                }
                /*
                  Inside the review, not in a panel below it.

                  This was its own `<InfoCard>`-sized row under the reviews card —
                  two stacked boxes about one subject, the lower one holding a
                  single line of text. As a footer it reads as what it is: the way
                  out of the excerpt you have just read.
                */
                footer={
                  <PressableScale
                    accessibilityRole="button"
                    accessibilityLabel={`See all reviews of ${data.title}`}
                    onPress={openReviews}
                    scaleTo={0.98}
                    style={StyleSheet.flatten([
                      styles.seeAll,
                      { backgroundColor: accent.m3.surfaceContainerHigh },
                    ])}>
                    <Text variant="body">See all reviews</Text>
                    <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
                  </PressableScale>
                }
              />
            </InfoCard>

            <TimeToBeatWidget gameId={data.id} />
            <GameEventsWidget gameId={data.id} />

            {/*
              Studios. **One card, one name per line, and nothing else.**

              This was a card *per* company, each with a role line and a "see
              everything they have made" subtitle — five panels to carry five
              proper nouns, and the subtitle told you what tapping a name does,
              which a name in a list already implies. The card's own title says
              what these are; the names say who they are; tapping one opens their
              catalogue.

              Tappable only for IGDB titles — company ids come from IGDB and
              Steam/RAWG/itch have no equivalent, so a Steam-sourced game shows
              the name as plain text rather than a dead link.
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
              Series and lineage, and which one you get depends on what this
              game *is*.

              A remake, remaster, DLC or edition shows the game it came from and
              no franchise rail: on Mafia: Definitive Edition the useful question
              is "what is this a version of", and a rail of six Mafia games
              answers a question nobody asked while burying the one that matters.
              An original shows the series it belongs to — filtered to originals,
              see `ORIGINALS_ONLY` — and then its own versions underneath.
            */}
            {data.edition && data.parentId ? (
              <OriginalGame parentId={data.parentId} edition={data.edition} />
            ) : (
              <GameEditions gameId={data.id} />
            )}

            {/* Franchise. IGDB models a numbered series as `collection` and the
                wider brand as `franchises`; the collection is the more useful of
                the two, so it wins when both exist. Hidden on a derivative —
                the row above already places it. */}
            {!data.edition && franchiseGames.data && franchiseGames.data.length > 1 && (
              <InfoCard
                title={extras.data?.collection?.name ?? 'Franchise'}
                action={
                  <Text variant="bodySmall" color="textMuted">
                    {franchiseGames.data.length}
                  </Text>
                }>
                <GamePosterRail
                  games={franchiseGames.data.filter((entry) => entry.id !== data.id)}
                />
              </InfoCard>
            )}

            {/* A failed fetch used to leave `achievementTotal` at 0 and take the
                whole section with it — silently, and identically to a game that
                genuinely tracks none. The count is the section's own claim, so
                it cannot be rendered from a number the app never received. */}
            {achievements.isError ? (
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
                  }
                  action={<Ionicons name="chevron-forward" size={18} color={theme.textMuted} />}>
                  <Text variant="body" color="textSecondary">
                    <Text variant="h4">
                      {unlockedCount}/{achievementTotal}
                    </Text>
                    {' unlocked. Tap to see every one.'}
                  </Text>
                </InfoCardButton>
              )
            )}

            {data.storeUrl && (
              <ExternalLink
                href={data.storeUrl as Href & string}
                label={`Open ${data.title} on ${data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}`}>
                <Text variant="h5" style={{ color: accent.onSurface }}>
                  Open on {data.source === 'steam' ? 'Steam' : data.source.toUpperCase()}
                </Text>
              </ExternalLink>
            )}
          </View>
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
        <GameSheets
          store={sheets}
          game={data}
          log={logged ?? null}
          availablePlatforms={availablePlatforms}
          activePlatform={activePlatform}
          onSelectPlatform={setPlatform}
        />
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
function GameSheets({
  store,
  game,
  log,
  availablePlatforms,
  activePlatform,
  onSelectPlatform,
}: {
  store: SheetStore;
  game: Game;
  log: GameLog | null;
  availablePlatforms: PlatformKey[];
  activePlatform: PlatformKey;
  onSelectPlatform: (platform: PlatformKey) => void;
}) {
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

      {/* The platform picker, raised by holding the case. Half the display: it
          is a picker, and covering the page would hide the case it re-draws.
          Selecting closes it; the choice is visible behind the sheet's fall. */}
      <SlideUpSheet
        visible={open === 'platforms'}
        onClose={close}
        title="Platform"
        maxHeightRatio={0.5}>
        <View style={styles.platformSheet}>
          <Text variant="bodySmall" color="textMuted">
            Re-draws the case, the price and the store link.
          </Text>
          <PlatformPicker
            available={availablePlatforms}
            selected={activePlatform}
            onSelect={(next) => {
              onSelectPlatform(next);
              close();
            }}
          />
        </View>
      </SlideUpSheet>
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  /* The sheet's own inset. `<SlideUpSheet>` pads nothing — it owns the corner
     and the grabber and leaves the body to whatever fills it. */
  platformSheet: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8, gap: Spacing.x16 },
  /* A list inside one card, so the interval is a list's rather than a card's. */
  studios: { gap: Spacing.x4 },
  studioRow: { paddingVertical: Spacing.x4 },
  studioName: { flexShrink: 1 },
  synopsisToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
    minHeight: TapTarget,
  },
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
  copyLines: { gap: 2 },
  /* A step more than the tab's own rhythm between the community's list and
     IGDB's, so they read as two sections rather than one list with a break. */
  similarSection: { gap: Spacing.x12, marginTop: Spacing.x24 },
  similarHead: { gap: 2 },
  reviewRow: { marginBottom: Spacing.x12 },
  seeAll: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  shots: { gap: Spacing.x12, paddingRight: Spacing.x16 },
  shot: { width: 260, aspectRatio: HeroAspectRatio, borderRadius: Radius.image },
});
