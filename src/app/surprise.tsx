import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Easing, useSharedValue, withTiming } from 'react-native-reanimated';

import { SurprisePageWash } from '@/components/surprise-page-wash';
import { useDealGesture } from '@/components/surprise-deal-gesture';
import { SurpriseSettings } from '@/components/surprise-settings';
import {
  revealLayout,
  SurpriseReveal,
  SurpriseRevealSkeleton,
  type DealDirection,
} from '@/components/surprise-reveal';
import { SurpriseSoundtrackPanel } from '@/components/surprise-soundtrack-panel';
import { TopReviewCard } from '@/components/top-review-card';
import { SwipeEdge } from '@/components/surprise-swipe-edge';
import { Button } from '@/components/ui/button';
import { FrostedTopBar, TopBarDisc } from '@/components/ui/frosted-top-bar';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Motion, Palette, Spacing } from '@/constants/theme';
import { useHeaderHeight, useTopBarInset } from '@/hooks/use-header-height';
import { useTheme } from '@/hooks/use-theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { extractSeedColor } from '@/hooks/use-album-art-color';
import { getTopGameReview, getUserLogs, setLiked, setProgress } from '@/lib/api';
import { getGameById } from '@/lib/games';
import {
  canUseForYou,
  getSurpriseBatch,
  playedGameIds,
  type ExclusionLog,
} from '@/lib/games/surprise';
import { hiddenGameIds, hideGame, loadHiddenGames, type HiddenGame } from '@/lib/surprise-hidden';
import {
  activeFilterCount,
  DEFAULT_SURPRISE_PREFS,
  loadSurprisePrefs,
  poolFiltersFor,
  saveSurprisePrefs,
  type SurprisePrefs,
} from '@/lib/surprise-prefs';
import type { GameSearchResult } from '@/lib/games/types';
import { useAuth } from '@/store/auth';

/**
 * What an empty batch means, which is not one thing.
 *
 * `excluded` is only used when the exclusion is on and could genuinely be the
 * cause — naming a setting that had nothing to do with it sends the reader to
 * change something that will not help.
 *
 * None of these name their own recovery. The two buttons underneath are the
 * recovery, and repeating "try again" in the sentence above a button that says
 * "Try again" is the same idea twice.
 */
const EMPTY_POOL = {
  title: 'No games matched',
  /** Each attempt samples a different slice, so an empty one is usually transient. */
  plain: 'Nothing came back this time. Every attempt looks at a different part of the catalogue.',
  excluded: 'Everything it found is a game you’ve already played.',
} as const;

const EMPTY_FORYOU = {
  title: 'Not enough to go on yet',
  message:
    'This looks for games like the ones you rated highest, and it hasn’t found any matches yet. Rate a few more games and it gets better.',
} as const;

/**
 * Said once, when the pool is narrowed rather than exhausted.
 *
 * A separate sentence from `EMPTY_POOL.plain` because it names a cause the
 * reader can act on: an empty batch with three genres and a 90 floor set is not
 * the transient offset problem the plain message describes, and "try again" will
 * keep returning nothing for as long as the filters stand.
 */
const EMPTY_FILTERED =
  'Nothing in the catalogue matched every filter you set. Loosening one usually does it.';

/**
 * How long the "you have hidden this game" panel stays over the artwork.
 *
 * Ten seconds, which is long by the standards of a toast and right for this one:
 * it is two sentences, the second names a screen the reader has to remember, and
 * nothing else on the page reports that the double tap did anything. Dismissal
 * is not required — dealing to another card takes it down early, and the card
 * underneath stays fully usable the whole time.
 */
const NOTICE_MS = 10_000;

/**
 * Stable empty array for a pending batch.
 *
 * A bare `?? []` mints a fresh reference on every render, which would re-run the
 * neighbour prefetch each time — on a screen that re-renders as each of its five
 * queries lands. Same reason `exclusionLogs` is memoised.
 */
const EMPTY_BATCH: readonly GameSearchResult[] = [];

/**
 * How long a settings change waits before it reaches the disk.
 *
 * Long enough that ticking a run of genres is one write rather than one per
 * chip, short enough that it has landed before anybody could kill the app —
 * and `flushPrefs` runs on unmount anyway, so the only way to lose a change is
 * to force-quit inside this window.
 */
const PREFS_WRITE_MS = 600;

/**
 * Surprise Me — one dealt game, and one song from it.
 *
 * ## What this screen costs
 *
 * One IGDB request per *batch of fifty*, not per deal. Swiping walks a cursor
 * through a batch already in memory; a new request happens only when the batch
 * runs out or the mode changes. The soundtrack is the only other external call:
 * one question to the `soundcloud` function per game, which remembers which
 * upload matched (as an id — migration 0036) and searches SoundCloud only for a
 * game nobody has dealt before. A song's stream is asked for when its play key
 * is pressed, never when the card lands.
 *
 * ## Why it does not scroll
 *
 * Because the action cannot afford to be below a fold. The reroll button used to
 * begin roughly 110dp past the bottom of a 390×844 display and the scroll offset
 * never reset, so every deal after the first happened off-screen: you scrolled
 * down, pressed, and the new game rendered above the viewport. The reveal is a
 * single image now, sized to the display it has, and the swipe replaces the trip.
 *
 * ## Why this screen may take a game's colour
 *
 * It shows exactly one game at a time, which is the condition CLAUDE.md sets for
 * `<AccentProvider>`. The rule against it exists because twenty games in a list
 * is twenty hues; one game filling the screen is the case the accent was built
 * for, and it is most of what separates this from a dice roll with a title on it.
 */
export default function SurpriseScreen() {
  const { width, height } = useWindowDimensions();
  const router = useRouter();
  const layout = revealLayout(width, height);

  /*
   * The swipe, owned here rather than by the reveal.
   *
   * Both the card and the two edge lights read it, and the card is keyed on the
   * game — so a value living inside it would be destroyed by the very deal it is
   * animating, and the lights would have nothing to read. `deal()` resets it.
   */
  const dealX = useSharedValue(0);
  const bloom = useSharedValue(0);

  /*
   * The page's colour, mid-change.
   *
   * Shared values rather than React state, because the whole transition runs on
   * the UI thread and never re-renders the screen — see `<SurprisePageWash>` for
   * why `accent.page` is the only role that needs this at all.
   */
  const washFrom = useSharedValue<string>(Palette.background);
  const washTo = useSharedValue<string>(Palette.background);
  const wash = useSharedValue(1);

  const userId = useAuth((state) => state.session?.user.id);
  const queryClient = useQueryClient();

  /*
   * Preferences through the query cache rather than component state, so a change
   * survives leaving the screen and coming back without an effect to rehydrate
   * it. `staleTime: Infinity` because AsyncStorage is the only writer and every
   * write invalidates.
   */
  const prefsQuery = useQuery({
    queryKey: ['surprise-prefs', userId],
    queryFn: () => loadSurprisePrefs(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
  const prefs = prefsQuery.data ?? DEFAULT_SURPRISE_PREFS;

  /*
   * The pending disk write, and why the cache update is not part of it.
   *
   * This was a mutation whose `onMutate` filled the cache and whose `mutationFn`
   * wrote AsyncStorage — so every chip tap was a full JSON serialise and a disk
   * write, and ticking six genres was six of them. The two halves want different
   * timing: the cache has to update on the same frame as the press or the chip
   * does not appear to toggle, and the disk only has to be right by the time the
   * screen goes away.
   *
   * So the cache write stays synchronous in `updatePrefs` and only the disk write
   * is held. Refs rather than state, deliberately — nothing here renders, and the
   * React Compiler rules forbid the effect that syncing it into state would need.
   */
  const writeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingPrefs = useRef<SurprisePrefs | null>(null);

  const flushPrefs = useCallback(() => {
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = null;
    const next = pendingPrefs.current;
    pendingPrefs.current = null;
    if (next && userId) void saveSurprisePrefs(userId, next);
  }, [userId]);

  /* Flush on unmount, which is the case a plain debounce loses: change a filter
     and leave inside the window and the write never happens, so the screen comes
     back on the previous settings. Cleanup only — no state is synced here. */
  useEffect(() => flushPrefs, [flushPrefs]);

  /*
   * The viewer's logs, for the exclusion and for whether "Based on my games" is
   * offered. `['user-logs', userId]` is the key the profile and the recommender
   * already use, so this is usually served from cache rather than fetched.
   */
  const logs = useQuery({
    queryKey: ['user-logs', userId],
    queryFn: () => getUserLogs(userId!),
    enabled: !!userId,
    staleTime: 5 * 60_000,
  });
  /*
   * `LogWithRelations` satisfies `ExclusionLog` structurally — the narrower type
   * is declared so `lib/games/surprise.ts` never imports the API's row shapes.
   *
   * Memoised on `logs.data`, not left as a bare `?? []`: that expression mints a
   * fresh array on every render while the query is pending, which would re-run
   * the played-set memo below on every render and defeat the thing it exists
   * for. `top-games.tsx` carries the same note about the same trap.
   */
  const exclusionLogs = useMemo<ExclusionLog[]>(() => logs.data ?? [], [logs.data]);

  /*
   * The games this viewer has banished, by double-tapping their cover.
   *
   * Its own query rather than a field on the prefs: it is an unbounded list with
   * two writers on two screens, and `app/settings.tsx` reads the same key so
   * unhiding there is reflected here without either screen knowing about the
   * other. See `lib/surprise-hidden.ts`.
   */
  const hiddenQuery = useQuery({
    queryKey: ['surprise-hidden', userId],
    queryFn: () => loadHiddenGames(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });
  const hidden = useMemo(() => hiddenGameIds(hiddenQuery.data ?? []), [hiddenQuery.data]);

  /*
   * `round` is what forces a new batch. It is in the query key and nothing else
   * reads it — incrementing it is the only way to spend another IGDB request,
   * which keeps that decision in one place rather than scattered across handlers.
   */
  const [round, setRound] = useState(0);
  const [cursor, setCursor] = useState(0);
  /** Which way the deck last moved, so the incoming card enters from that side. */
  const [from, setFrom] = useState<DealDirection>(1);
  /** False until the first deal, which is what separates the form from the reveal. */
  const [dealt, setDealt] = useState(false);
  /**
   * Whether the "you have hidden this game" panel is over the artwork.
   *
   * A boolean rather than the hidden game's id: it only ever describes the card
   * currently on screen, and `deal()` clears it, so there is no second card it
   * could belong to.
   */
  const [notice, setNotice] = useState(false);
  const noticeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* The timer outlives the screen if nobody clears it, and its callback would
     then set state on an unmounted tree. Cleanup only — nothing is synced into
     state here, so the React Compiler's no-setState-in-effects rule is intact. */
  useEffect(
    () => () => {
      if (noticeTimer.current) clearTimeout(noticeTimer.current);
    },
    []
  );

  /*
   * The filters are in the key; the hidden list deliberately is not.
   *
   * A filter changes *which query IGDB runs*, so a batch fetched under different
   * filters is a different answer and must not be reused. Hiding a game changes
   * nothing about the query — the game is simply removed from the answer — so
   * putting the hidden list in the key would spend a fresh IGDB request every
   * time somebody double-tapped a cover. `excludeHidden` runs twice instead:
   * once inside the fetch, and once over `batch.data` below, which is what makes
   * a hide take effect on the card in front of you without a round trip.
   */
  const batch = useQuery({
    queryKey: [
      'surprise-batch',
      prefs.gameMode,
      prefs.excludePlayed,
      prefs.genreIds,
      prefs.perspectiveIds,
      prefs.minRating,
      round,
      userId,
    ],
    queryFn: ({ signal }) =>
      getSurpriseBatch({
        mode: prefs.gameMode,
        logs: exclusionLogs,
        excludePlayed: prefs.excludePlayed,
        hidden,
        filters: poolFiltersFor(prefs),
        signal,
      }),
    enabled: dealt && !!userId && !logs.isPending && !hiddenQuery.isPending,
    staleTime: Infinity,
    retry: 1,
  });

  /*
   * The batch as it arrived, hidden games and all.
   *
   * It used to be re-filtered here, which meant hiding the card in front of you
   * *removed* it — the deck shortened under the cursor and the next game slid
   * into the slot. That is the wrong reading of the gesture. Hiding says
   * "not in future", not "next please": the card you just hid is still the card
   * you are looking at, you can still open it, log it or play its soundtrack,
   * and moving on stays a thing you choose to do. `excludeHidden` still runs
   * inside the fetch, so the promise is kept where it is actually made — on the
   * *next* batch, and every one after it.
   *
   * Memoised on the query's own data rather than written as a bare `?? []`, for
   * the reason `exclusionLogs` above records: the fallback mints a fresh array on
   * every render while the query is pending, which would make the neighbour
   * prefetch below re-run on every render of a screen that re-renders as each of
   * its queries lands.
   */
  const games = useMemo(() => batch.data ?? EMPTY_BATCH, [batch.data]);
  const game = games[cursor] ?? null;

  /*
   * Whether this exact card is one the viewer has already finished with.
   *
   * `excludeLogged` abandons the filter rather than returning nothing when it
   * would empty the batch, which is the right call — a completed library is a
   * good problem and "no games" is a worse answer than a repeat. But it did that
   * silently, so "Exclude games I've played" quietly stopped being true with no
   * indication anywhere. Marking the individual card is the honest version: it
   * tells you the truth about the game in front of you rather than announcing a
   * policy, and it is useful with the exclusion *off* too, where a played game
   * legitimately appears and you would rather know.
   *
   * It can also fire with the exclusion on for a second reason: `getUserLogs`
   * caps at 100 rows, so a large library is only excluded down to its hundred
   * most recent.
   */
  const played = useMemo(() => playedGameIds(exclusionLogs), [exclusionLogs]);
  const alreadyPlayed = !!game && played.has(game.id);

  const theme = useTheme();
  /* This component renders the provider, so it cannot consume it — `useGameAccent`
     is the hook for exactly that position. Resolves to the house blue until the
     cover's hue is extracted. */
  const accent = useGameAccent(game?.coverUrl ?? game?.heroUrl, game?.genres);

  /*
   * The room changes colour instead of being replaced.
   *
   * One effect, no branches, and it covers both cases that used to cut:
   *
   *  - **The deal.** A new game changes `accent.page`, and the page settles into
   *    it over `Motion.slow` — between the card's 200ms flight and its ~450ms
   *    landing spring, so the room relights while the new card is still settling.
   *  - **The late hue.** `useAlbumArtColor` hands back the genre fallback first
   *    and the real extraction a beat later, for the *same* game. `use-accent`
   *    already claims that change "lands as a settle rather than a flash"; this is
   *    what makes the sentence true.
   *
   * Writing a shared value in an effect is not the pattern CLAUDE.md forbids —
   * that rule is about `setState`, and `useCrossfade`, `<HiddenNotice>` and
   * `<MarqueeText>` all already do exactly this. Nothing here re-renders.
   *
   * **This runs under Reduce Motion**, for the reason `useCrossfade` records: with
   * every spring flattened, a cut is not a transition. A 300ms colour settle is
   * the crossfade both platform references prescribe in precisely this case.
   */
  useEffect(() => {
    /* Two games in a batch frequently share a genre fallback, so most deals do
       not change this at all. Without the guard each one would schedule a no-op
       timing. */
    if (washTo.get() === accent.page) return;

    washFrom.set(washTo.get());
    washTo.set(accent.page);
    wash.set(0);
    wash.set(withTiming(1, { duration: Motion.slow, easing: Easing.inOut(Easing.quad) }));
  }, [accent.page, wash, washFrom, washTo]);

  /*
   * Warm the next card's colour — and its cover — while you are looking at this one.
   *
   * `useAlbumArtColor` is a query keyed on the artwork URL with an infinite
   * stale time, so a hue resolved here is simply *already there* when the deal
   * lands, and the page washes straight to the real colour instead of settling
   * twice (once to the genre fallback, once to the extraction).
   *
   * **Plus and minus one only.** The batch is fifty deep and prefetching all of
   * it would be fifty extractions for a session that averages a handful of
   * deals; the two neighbours cover both swipe directions and bound the cost at
   * two. On a dev build the extractor is native and spends no network at all; in
   * Expo Go it is a 3 KB `t_thumb`.
   *
   * It runs when a card *settles* rather than at gesture start, which is far too
   * late for a first-sight round trip.
   */
  useEffect(() => {
    for (const neighbour of [games[cursor + 1], games[cursor - 1]]) {
      const uri = neighbour?.coverUrl ?? neighbour?.heroUrl;
      if (!uri) continue;

      void queryClient.prefetchQuery({
        queryKey: ['album-art-color', uri],
        queryFn: () => extractSeedColor(uri),
        staleTime: Infinity,
      });
      void Image.prefetch(uri);
    }
  }, [games, cursor, queryClient]);

  /*
   * The review worth showing for this card.
   *
   * Its own query, keyed on the game and never stale, so dealing back to a card
   * you have already seen costs nothing. It is the app's own database rather
   * than IGDB, and it only runs once a card is actually on screen — the batch of
   * fifty does not pre-fetch fifty reviews.
   */
  const review = useQuery({
    queryKey: ['surprise-review', game?.id, userId],
    queryFn: () => getTopGameReview(game!.id, userId ?? null),
    enabled: !!game && !!userId,
    staleTime: Infinity,
    retry: false,
  });

  /*
   * Optimistic, because a like is small, reversible and its own confirmation.
   * Waiting for a round trip to fill a heart makes the tap feel broken; rolling
   * back on failure costs nothing because the previous value is right there.
   */
  const like = useMutation({
    mutationFn: (next: boolean) => setLiked(userId!, 'log', review.data!.log.id, next),
    onMutate: async (next) => {
      const key = ['surprise-review', game?.id, userId];
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData(key);
      queryClient.setQueryData(key, (old: typeof review.data) =>
        old ? { ...old, likedByViewer: next, likes: old.likes + (next ? 1 : -1) } : old
      );
      return { previous, key };
    },
    onError: (_error, _next, context) => {
      if (context) queryClient.setQueryData(context.key, context.previous);
    },
  });

  /**
   * "Yes, this one."
   *
   * `backlog`, not wishlist: `STATUS_VERB.backlog` is "wants to play", which is
   * the exact question this feature asked. It is also the status `excludeLogged`
   * deliberately leaves eligible, so accepting a game does not hide it from a
   * later deal — a game you meant to play is a fine thing to be reminded of.
   *
   * ## Why it fetches the game first
   *
   * `setProgress` takes a full `Game` and calls `cacheGame` on it, and a dealt card
   * only carries a `GameSearchResult` — no description, publisher, screenshots or
   * store URL. Filling those with null to satisfy the type would upsert a
   * *poorer* row over whatever the shared `games` cache already held for that
   * title, degrading the catalogue for every other reader to save one request.
   * So the request is spent, once, at the moment somebody actually accepts.
   */
  const backlog = useMutation({
    mutationFn: async () => {
      const full = await getGameById(game!.id);
      if (!full) throw new Error('Could not load that game.');
      /* `setProgress`, not `saveLog`. The latter restates the whole row, so on a
         game you had already reviewed this wrote `rating: null, review: ''` and
         deleted the review to add it to the backlog. `setProgress` writes the
         status and nothing else; a score, a review or a playthrough survive. */
      await setProgress(userId!, full, { status: 'backlog' });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
      queryClient.invalidateQueries({ queryKey: ['my-log', userId, game?.id] });
      AccessibilityInfo.announceForAccessibility(`${game?.title} added to your backlog`);
    },
    /* A silent failed write is what the critique caught on the star. The label
       carries the failure and stays pressable, so the recovery is the same
       button rather than a dialog. */
    onError: () => {
      AccessibilityInfo.announceForAccessibility(
        'Could not add to your backlog. Tap to try again.'
      );
    },
  });

  function updatePrefs(next: SurprisePrefs) {
    /* Cache now, disk shortly. See `writeTimer`. */
    queryClient.setQueryData(['surprise-prefs', userId], next);
    pendingPrefs.current = next;
    if (writeTimer.current) clearTimeout(writeTimer.current);
    writeTimer.current = setTimeout(flushPrefs, PREFS_WRITE_MS);

    /* A different pool — or a different narrowing of one — is a different
       question, so the current batch no longer answers it. Start a fresh one
       rather than carrying the cursor across.

       The comparison is on the *stringified* filter lists rather than on
       identity: `onChange` builds a new array on every toggle, so a reference
       check would fire on every press including the ones that changed nothing. */
    const changed =
      next.gameMode !== prefs.gameMode ||
      next.excludePlayed !== prefs.excludePlayed ||
      next.minRating !== prefs.minRating ||
      String(next.genreIds) !== String(prefs.genreIds) ||
      String(next.perspectiveIds) !== String(prefs.perspectiveIds);

    if (changed) {
      setCursor(0);
      setRound((value) => value + 1);
    }
  }

  /**
   * "Never show me this one again."
   *
   * Written to the device and pushed straight into the cache. The write is a
   * read-modify-write of one AsyncStorage value, so the returned list is
   * authoritative and there is nothing to invalidate.
   *
   * **It does not remove the card in front of you**, and this docblock used to
   * claim the opposite — see the note on `games`, which is where that behaviour
   * was deliberately taken out. Hiding says "not in future", not "next please":
   * the card stays, fully usable, and moving on stays something you choose. The
   * promise is kept on the *next* batch, inside the fetch.
   *
   * Announced, because the gesture now has no visual result at all beyond the
   * panel that says so — which is exactly the point of the panel.
   */
  const hide = useMutation({
    mutationFn: (target: { id: string; title: string; coverUrl: string | null }) =>
      hideGame(userId!, target),
    onSuccess: (next: HiddenGame[], target) => {
      queryClient.setQueryData(['surprise-hidden', userId], next);
      showNotice();
      AccessibilityInfo.announceForAccessibility(`${target.title} hidden. It won’t come up again.`);
    },
  });

  /**
   * Raise the "you have hidden this" panel over the artwork, and drop it again.
   *
   * The card does not change, so this is the *only* thing that tells anybody the
   * double tap landed — which is why it is a panel over the cover for ten
   * seconds rather than a toast at the edge of the screen. A re-hide while it is
   * already up restarts the ten rather than stacking a second timer, and
   * `deal()` takes it down early: the panel is about the card behind it, so it
   * must not outlive that card.
   */
  function showNotice() {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    setNotice(true);
    noticeTimer.current = setTimeout(() => setNotice(false), NOTICE_MS);
  }

  function clearNotice() {
    if (noticeTimer.current) clearTimeout(noticeTimer.current);
    noticeTimer.current = null;
    setNotice(false);
  }

  /**
   * Move the deck. The whole point of the batch: fifty deals before a request.
   *
   * Only running off the end spends anything, and it spends it by bumping
   * `round`, which changes the query key. Everything before that is one state
   * update, which is why the swipe can be as cheap as it feels.
   */
  function deal(direction: DealDirection) {
    /* The outgoing card has already flown; the incoming one must start centred.
       Hoisting `dealX` to the screen is what makes this line necessary — and it
       is cheaper than the alternative, which was the lights losing their driver
       every time a card changed. */
    dealX.set(0);
    bloom.set(0);
    setFrom(direction);
    backlog.reset();
    /* The panel names the card behind it, so it does not survive that card. */
    clearNotice();

    if (direction === -1) {
      setCursor((value) => Math.max(0, value - 1));
      return;
    }

    if (cursor + 1 < games.length) {
      setCursor((value) => value + 1);
      return;
    }

    setCursor(0);
    setRound((value) => value + 1);
  }

  /*
   * Two gestures, raced, and they must be two *objects*.
   *
   * An RNGH gesture carries recogniser state, so one instance cannot be two
   * recognisers. Each accepts only its own direction — a drag to the left deals
   * forward, a drag to the right goes back — which is what lets them share the
   * whole screen without contending: a given drag can only ever satisfy one of
   * them, and `Race` settles it on the first frame either way.
   */
  const dealNext = useDealGesture({
    direction: 1,
    dealX,
    bloom,
    commitAt: layout.commitAt,
    exitDistance: layout.exitDistance,
    canGoBack: cursor > 0,
    onDeal: deal,
  });
  const dealPrevious = useDealGesture({
    direction: -1,
    dealX,
    bloom,
    commitAt: layout.commitAt,
    exitDistance: layout.exitDistance,
    canGoBack: cursor > 0,
    onDeal: deal,
  });

  /*
   * Reviews written while you were away.
   *
   * The review query is `staleTime: Infinity`, which is right — a review does
   * not change while you look at it, and dealing back through a batch should
   * cost nothing. But it also meant the one case that matters most never
   * updated: you find an unreviewed game, write the first review, come back, and
   * the block still says nobody has. Returning to this screen is the only signal
   * that could have happened, so returning is what clears it.
   *
   * The whole prefix, not one key: the game you reviewed may not be the card on
   * screen by the time you are back. Only mounted queries refetch immediately;
   * the rest are simply marked stale and re-run when their card is next dealt.
   *
   * The first focus is skipped — it is the mount, and nothing has changed yet.
   */
  const settled = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (!settled.current) {
        settled.current = true;
        return;
      }
      queryClient.invalidateQueries({ queryKey: ['surprise-review'] });
      queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
    }, [queryClient, userId])
  );

  /* The band the floating discs occupy, reserved in content. See the masthead. */
  const headerHeight = useHeaderHeight();
  const barInset = useTopBarInset();

  /* One recogniser for the whole screen. See the note at `<GestureDetector>`. */
  const swipe = useMemo(() => Gesture.Race(dealNext, dealPrevious), [dealNext, dealPrevious]);

  /* A deck already dealt under exactly these settings. See the CTA below. */
  const resumable = games.length > 0 && cursor > 0;

  const settings = (
    <SurpriseSettings
      prefs={prefs}
      onChange={updatePrefs}
      canUseForYou={canUseForYou(exclusionLogs)}
    />
  );

  // --- Before the first deal: the form, and the settings home ---------------
  if (!dealt) {
    return (
      <Screen
        edges={['bottom']}
        insetHeader
        padded
        miniPlayer={false}
        topBar={<FrostedTopBar back />}>
        {/* `flex: 1` is load-bearing now that this has a sibling. Yoga defaults
            `flexShrink` to 0 — unlike the web — so a `ScrollView` with no flex
            style sizes to its content and pushes anything after it off the
            display rather than scrolling. The scroll indicator comes back for
            the same reason it was turned off: with the button pinned below,
            the bar is now reporting the *settings*, which genuinely continue
            past the fold and have no other cue that they do. */}
        <ScrollView style={styles.scroll} contentContainerStyle={styles.form}>
          {/* There is no header anywhere in this app, so a screen opening on a
              form states what it is in its own content. */}
          <View style={styles.intro}>
            <Text variant="display" accessibilityRole="header">
              Surprise me
            </Text>
            <Text variant="body" color="textSecondary">
              One game, one song, no browsing.
            </Text>
          </View>

          {settings}
        </ScrollView>

        {/*
          The deal, pinned out of the scroll.

          It was the last child of the `ScrollView` above, which put its top edge
          at y≈673 of a 707dp viewport on a 390×844 display — 34 of its 60dp on
          screen — and entirely below the fold on a 375×667 one. The thing
          clipping at the fold was a *wrapping chip row*, which is the least
          legible object to cut there: half a row of chips reads as "the row
          wrapped", never as "there is a button underneath".

          Raising the chips and pills to the tap floor added roughly 120dp above
          it, so leaving it in the scroll would have taken the last 34dp too.
          Pinning is not a workaround for that — it is what the control wanted
          anyway. A commit action on a form whose whole body is optional
          refinement should not be reachable only by exhausting the refinement,
          and this screen's own docblock already records the same bug being found
          and fixed on the dealt screen.

          A flex sibling rather than an absolute overlay, so it *takes* its space
          instead of covering the last row of chips, and nothing needs a blur or
          a scrim to stay legible over moving content.
        */}
        <View style={styles.footer}>
          {/*
            Two labels, because this button does two things.

            It used to call `setCursor(0)` unconditionally, which meant checking a
            setting cost you your place: twelve swipes deep, tap the gear, change
            nothing, come back — and the deck restarted at the first card, with
            the *same* cached batch behind it. Nothing warned, and the label was
            identical either way, so there was no way to tell "start" from
            "throw away twelve cards and start".

            The reset is gone from here entirely. `updatePrefs` already does it,
            and only when something actually changed — which is the correct and
            only condition for it. A settings visit that changes nothing is now
            free.

            `resumable` reads the cache rather than a flag: the batch key holds
            every pref, so data under the *current* key means the deck you left is
            still the deck these settings describe. Change anything and the key
            moves, `batch.data` is undefined, and the button says "Surprise me"
            again — exactly when it should.
          */}
          <Button
            title={resumable ? 'Back to my card' : 'Surprise me'}
            size="large"
            fullWidth
            icon={resumable ? 'arrow-back' : 'shuffle'}
            onPress={() => setDealt(true)}
          />
        </View>
      </Screen>
    );
  }

  if (batch.isLoadingError) {
    return (
      <Screen edges={['top', 'bottom']} padded miniPlayer={false} topBar={<FrostedTopBar back />}>
        <ErrorState error={batch.error} onRetry={() => batch.refetch()} />
      </Screen>
    );
  }

  /*
   * An empty pool is not a server fault, so it is not an error state.
   * `<ErrorState>` discards `error.message` by design — `readableError()` exists
   * precisely so a PostgREST string never reaches a reader — which meant the
   * authored sentence here was never shown and the page claimed a backend
   * failure for a filter that simply matched nothing.
   */
  if (!batch.isPending && games.length === 0) {
    /*
     * Three different facts, three different sentences.
     *
     * One hardcoded message here said "every game it returned is one you have
     * already played", which is true for exactly one of the ways this state is
     * reached. "Based on my games" comes back empty when IGDB has no similarity
     * edges for the viewer's library, and a pool query comes back empty when the
     * random offset lands past the end of a narrow filter — neither has anything
     * to do with the exclusion, and telling somebody to turn a setting off that
     * was not the cause is worse than saying nothing.
     */
    const forYou = prefs.gameMode === 'foryou';
    /* Checked before the exclusion, because it is the more specific claim: with
       filters set *and* the exclusion on, the filters are far likelier to be
       what emptied the batch, and they are the thing the reader just changed. */
    const narrowed = !forYou && activeFilterCount(prefs) > 0;

    return (
      <Screen edges={['top', 'bottom']} padded miniPlayer={false} topBar={<FrostedTopBar back />}>
        <EmptyState
          title={forYou ? EMPTY_FORYOU.title : EMPTY_POOL.title}
          message={
            forYou
              ? EMPTY_FORYOU.message
              : narrowed
                ? EMPTY_FILTERED
                : prefs.excludePlayed
                  ? EMPTY_POOL.excluded
                  : EMPTY_POOL.plain
          }
          action={
            <View style={styles.emptyActions}>
              {/* Re-rolls the same pool at a fresh random offset. A narrow filter
                  landing on an empty page is transient, so the first thing on
                  offer is the cheap thing that usually fixes it. */}
              <Button
                title="Try again"
                onPress={() => {
                  setCursor(0);
                  setRound((value) => value + 1);
                }}
              />
              <Button title="Change settings" variant="secondary" onPress={() => setDealt(false)} />
            </View>
          }
        />
      </Screen>
    );
  }

  const gear = (
    <TopBarDisc icon="options-outline" label="Surprise settings" onPress={() => setDealt(false)} />
  );

  return (
    <AccentProvider artwork={game?.coverUrl ?? game?.heroUrl} genres={game?.genres}>
      <Screen
        edges={['bottom']}
        miniPlayer={false}
        /* The same flat fill the game page took, for the same reasons — see the
           note on `background` there. This screen never scrolled, so the
           "scroll-driven" gradient was pinned at rest anyway: all it ever did
           was put the game's brightest colour behind the one card on screen. */
        background={accent.page}
        /*
          The animated page, over the flat one.
          
          `background` stays as the floor — it is what the first frame paints and
          what Android's blur target falls back to — and this rides above it,
          inside the same view, so the frosted discs sample the colour the page is
          actually showing rather than the one it was on when the deal started.
        */
        backdrop={<SurprisePageWash from={washFrom} to={washTo} progress={wash} />}
        topBar={<FrostedTopBar back right={gear} />}>
        {/*
          One detector around the whole screen, replacing two overlay strips.

          The strips were absolutely positioned rectangles laid *over* the
          content, and every complaint about the gesture came from that shape:
          they started 28dp in from the bezel, they stopped where the cover
          began, and they were floored above the controls — so the swipe existed
          in two narrow columns in the upper middle of the display and nowhere
          else. You had to find it.

          A pan on the container has no geometry to get wrong. It starts at the
          literal edge of the display, at any height, over the artwork, over the
          cards, anywhere. It does not eat taps either: both gestures wait for
          `ACTIVATE_AT` of horizontal travel before activating, so a press that
          does not move still reaches the button under it, and one that does move
          cancels that press the way any scroll view would.

          `Race`, not `Simultaneous`: the two are one-sided and opposite, so at
          most one can ever claim a drag — and racing them makes that explicit
          rather than relying on it.
        */}
        <GestureDetector gesture={swipe}>
          <View style={styles.stage}>
            {/*
              No hero. The page is a flat fill in the game's own darkest tone and
              nothing else.

              A band of landscape key art used to run across the top with the
              cover rising into it, borrowed from the game page's masthead. That
              composition needs two things this screen no longer has: a portrait
              cover narrow enough to sit *in front of* the art with the art
              visible either side of it, and a reason to show two pieces of
              artwork for one game. The square cover is 84% of the width, so the
              hero was a strip of a second image peeking out above it — and
              `heroUrl` is frequently the same picture as the cover, cropped. One
              game, one image.
            */}
            {/*
              The screen's own heading, in the band the floating discs occupy.

              `<FrostedTopBar>` is two 44dp discs pinned to the corners and
              nothing between them — it has no `title` prop and must not grow one
              (CLAUDE.md). A screen that needs a heading states it in content,
              which is what this is: a row exactly `useHeaderHeight()` tall, with
              the status-bar inset as its top padding, so the word centres in the
              same 56dp band the discs centre in and the three read as one row.

              It is also the fix for the artwork. The square is 84% of the width
              and the content started at the top of the display, so the two discs
              sat *on* the cover. This row reserves their band as solid
              background, which is where they belong.
            */}
            <View style={[styles.masthead, { height: headerHeight, paddingTop: barInset }]}>
              <Text variant="h4" accessibilityRole="header">
                Surprise Me
              </Text>
            </View>

            <View style={styles.body}>
              {game ? (
                /* Keyed on the game: a new card is a new mount, so its arrival
                 springs run and the soundtrack lookup, the chosen track and the
                 audio player all reset without an effect watching for it. */
                <SurpriseReveal
                  key={game.id}
                  game={game}
                  from={from}
                  canGoBack={cursor > 0}
                  onDeal={deal}
                  onOpenGame={() =>
                    router.push({ pathname: '/game/[id]', params: { id: game.id } })
                  }
                  /* Double-tapping the cover. The card it removes is the card the
                   finger is on, which is why the id and the title are read here
                   rather than inside the mutation. */
                  onHide={() =>
                    hide.mutate({ id: game.id, title: game.title, coverUrl: game.coverUrl })
                  }
                  hidden={notice}
                  alreadyPlayed={alreadyPlayed}
                  dealX={dealX}
                  bloom={bloom}
                  onBacklog={() => backlog.mutate()}
                  backlog={{
                    done: backlog.isSuccess,
                    busy: backlog.isPending,
                    failed: backlog.isError,
                  }}
                  review={
                    <TopReviewCard
                      review={review.data ?? null}
                      loading={review.isPending}
                      liked={review.data?.likedByViewer ?? false}
                      onToggleLike={() => {
                        if (review.data && userId) like.mutate(!review.data.likedByViewer);
                      }}
                      onWriteReview={() =>
                        router.push({ pathname: '/log/[id]', params: { id: game.id } })
                      }
                      onOpenReview={() => {
                        if (review.data) {
                          router.push({
                            pathname: '/review/[id]',
                            params: { id: review.data.log.id },
                          });
                        }
                      }}
                    />
                  }
                  layout={layout}
                  soundtrack={
                    <SurpriseSoundtrackPanel
                      key={game.id}
                      game={game}
                      trackMode={prefs.trackMode}
                    />
                  }
                />
              ) : (
                <SurpriseRevealSkeleton layout={layout} />
              )}
            </View>
            {/*
              The swipe lights, and they are the **last** thing in the stage.

              They belong to the *display*, not to the artwork: the gesture starts
              at the bezel, so the light does too, and each one reaches exactly
              half the screen — see `<SwipeEdge>` for why that boundary is the
              radius rather than a container edge.

              They were mounted first, under the body, on the argument that the
              cover and the type should paint over them. That held while the cover
              was a 165dp poster with clear margin either side. It does not hold
              now: the square runs to 84% of the width, so the word telling you
              what releasing will do sat *behind the artwork* — the one moment the
              light exists for was the one moment you could not read it. Painting
              last fixes it and costs nothing, because the layer is
              `pointerEvents="none"` and fully transparent at rest.
            */}
            {game && (
              <>
                <SwipeEdge
                  side="left"
                  dealX={dealX}
                  bloom={bloom}
                  commitAt={layout.commitAt}
                  screenWidth={width}
                  screenHeight={height}
                  color={accent.color}
                  background={theme.background}
                />
                <SwipeEdge
                  side="right"
                  dealX={dealX}
                  bloom={bloom}
                  commitAt={layout.commitAt}
                  blocked={cursor === 0}
                  screenWidth={width}
                  screenHeight={height}
                  color={accent.color}
                  background={theme.background}
                />
              </>
            )}
          </View>
        </GestureDetector>
      </Screen>
    </AccentProvider>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  /* `paddingBottom` is `x24`, not the `x48` a scroll container normally ends on:
     the 48 existed to keep the last control off the bottom bezel, and the footer
     below is now what does that. Keeping both would read as a gap someone
     forgot to fill. */
  form: { gap: Spacing.x32, paddingTop: Spacing.x24, paddingBottom: Spacing.x24 },
  intro: { gap: Spacing.x8 },
  /* Enough to separate the button from the last row of chips without drawing a
     rule to do it — the page's own fill is the divider, per DESIGN.md's
     preference for a tonal step over an edge. */
  footer: { paddingTop: Spacing.x16, paddingBottom: Spacing.x8 },
  stage: { flex: 1 },
  masthead: { alignItems: 'center', justifyContent: 'center' },
  /*
   * `zIndex`, explicitly. Paint order among siblings is document order on iOS,
   * but Android reorders by elevation — and the hero's artwork carries some — so
   * without this the key art can render *over* the title on one platform and
   * under it on the other.
   */
  body: { flex: 1, zIndex: 1 },
  emptyActions: {
    flexDirection: 'row',
    gap: Spacing.x8,
    flexWrap: 'wrap',
    justifyContent: 'center',
  },
});
