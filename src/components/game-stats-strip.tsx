import { useQuery } from '@tanstack/react-query';
import { memo } from 'react';

import { StatsStrip, StatsStripSkeleton, type StatsCell } from '@/components/ui/stats-strip';
import { scoreColor } from '@/constants/score';
import { useTheme } from '@/hooks/use-theme';
import { getGameListCount, getRatingBreakdown } from '@/lib/api';
import { parseGameId } from '@/lib/games';
import { getGameDetails, getTimeToBeat } from '@/lib/games/igdb';

/**
 * What a cell prints when there is no answer.
 *
 * "N/A", not an em dash. A dash is a typographic shrug that could equally mean
 * zero, pending, or not applicable; three letters say which, and say it in the
 * same register as the label underneath. Kept out of the `Text` as a constant so
 * all four cells cannot drift into three different spellings of "nothing".
 */
const EMPTY = 'N/A';

/** IGDB returns lengths in seconds. Same constant as `<TimeToBeatWidget>`. */
const SECONDS_PER_HOUR = 3600;

/**
 * Which rating board wins when a game carries several.
 *
 * Most releases carry three or four — ESRB, PEGI, USK, CERO — and the strip has
 * room for one. There is no *correct* answer without knowing where the reader is,
 * which the app does not ask and should not guess from a locale string; ESRB
 * first is a pragmatic default rather than a claim, and every board a game
 * carries is printed in full under "More information", which is where somebody
 * looking for their own region's verdict goes.
 *
 * An organisation not on this list still shows — it just sorts last — because a
 * game rated only by GRAC should say so rather than show nothing.
 */
const BOARD_ORDER = ['ESRB', 'PEGI', 'USK', 'CERO', 'ACB', 'CLASS_IND', 'GRAC'];

export type GameStatsStripProps = {
  gameId: string;
  /** Raise the reviews sheet the page already owns. */
  onOpenReviews: () => void;
  /** Raise the collections sheet. */
  onOpenLists: () => void;
};

/**
 * Four facts about a game, as a row of numbers under the masthead.
 *
 * ## What it replaced, and why it belongs here
 *
 * The platform switcher — up to seven buttons across two wrapped rows — used to
 * occupy this strip of the page, which is the most valuable real estate the
 * screen has: directly under the primary action, directly above the tabs, the
 * last thing read before deciding whether to scroll. It spent that on a control
 * most readers set once or never, and it is a long-press on the case now.
 *
 * What goes there instead is the Play Store's answer to the same question: the
 * handful of numbers that decide whether you keep reading. Every one of them was
 * already somewhere on this page — the score inside a card two screens down, the
 * length in another, the age rating three taps deep in a sheet — and *none* of
 * them was in the one place a reader looks before committing.
 *
 * ## Why these four
 *
 * They are the four questions asked before "what is it about":
 *
 *   **Is it good** — this app's own ratings, not IGDB's. The masthead already
 *   carries IGDB's aggregate as `COMMUNITY`; this is the number the app exists to
 *   produce, and it taps through to the reviews behind it.
 *
 *   **Do people keep it** — how many authored collections hold it. A score says
 *   what a stranger thought once; a shelf is somebody still choosing it months
 *   later. Wishlists and favourites are excluded, which is most of what makes the
 *   figure mean anything — see `SHELF_KINDS`.
 *
 *   **How long is it** — the single most common reason a game is bounced off.
 *
 *   **Who is it for** — a board's verdict is frequently the only content warning
 *   a game page has.
 *
 * ## Four cells, always
 *
 * Coverage is uneven and always will be: an indie release has no age rating, a
 * game nobody here has logged has no score, and a game added this morning is in
 * no collections. Each of those says its own absence in its own words rather than
 * vanishing — see the comment above `cells`. The strip is therefore a fixed
 * width, which is most of what makes two games comparable at a glance.
 *
 * ## The cost, stated plainly
 *
 * The age rating comes from `getGameDetails`, which until now was fetched **only
 * when the "More information" sheet opened** — deliberately, because it is a
 * whole IGDB round trip for a panel most visits never expand. Putting one of its
 * fields in the masthead means that request now happens on every game page. The
 * consolation is that it is the *same* query key, so the sheet it was deferred
 * for now opens instantly with the answer already in cache; the trip was moved
 * rather than added.
 */
/* Memoised: the game page hands it a game id and two stable openers, so a page
   update elsewhere no longer re-renders the four cells and their queries. */
export const GameStatsStrip = memo(function GameStatsStrip({
  gameId,
  onOpenReviews,
  onOpenLists,
}: GameStatsStripProps) {
  const theme = useTheme();

  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  /* Every key here is shared with the component that already owned the data —
     `['rating-breakdown']` with the reviews sheet, `['time-to-beat']` with
     `<TimeToBeatWidget>`, `['game-details']` with `<GameDetailsSheet>`. Same key,
     same arguments, so TanStack serves all three from one request rather than the
     strip doubling the page's traffic. Diverge on any of them and it will. */
  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  const lists = useQuery({
    queryKey: ['game-list-count', gameId],
    queryFn: () => getGameListCount(gameId),
    enabled: !!gameId,
    staleTime: 5 * 60_000,
  });

  const times = useQuery({
    queryKey: ['time-to-beat', igdbId],
    queryFn: ({ signal }) => getTimeToBeat(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const details = useQuery({
    queryKey: ['game-details', igdbId],
    queryFn: ({ signal }) => getGameDetails(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  /*
   * `isLoading`, not `isPending`.
   *
   * A disabled query — which is all three IGDB ones on a legacy `steam:` row —
   * sits at `pending` for the life of the screen, so gating the skeleton on
   * `isPending` would leave every non-IGDB game showing placeholder bars
   * forever. `isLoading` is `isPending && isFetching`: a first fetch genuinely in
   * flight, and false for a query that was never going to run.
   */
  const loading = breakdown.isLoading || lists.isLoading || times.isLoading || details.isLoading;

  /*
   * Four cells, always, whether or not the answer is known.
   *
   * This used to drop a cell with nothing behind it, on the argument that "—"
   * claims the app looked and found nothing worth printing. The argument was
   * wrong about which statement is more honest. A strip that is four cells on one
   * game and two on the next teaches nobody anything about either game; it
   * teaches them that this row is unreliable, and it hides the useful fact —
   * *nobody here has rated this yet* — behind an absence indistinguishable from
   * a feature that has not loaded.
   *
   * So every cell states its own emptiness in its own words, and the label is
   * where it says so: "N/A" over "No ratings found" is a fact about the game,
   * where a missing column was a fact about the query. The strip's width is also now a
   * constant, which is what makes four numbers comparable across two games at a
   * glance — the thing a row of statistics is for.
   */
  const ratings = breakdown.data;
  const listCount = lists.data ?? 0;
  const length = lengthOf(times.data);
  const board = boardOf(details.data?.ageRatings);

  const cells: StatsCell[] = [
    ratings
      ? {
          key: 'score',
          value: String(ratings.average),
          label: ratings.total === 1 ? '1 rating' : `${ratings.total} ratings`,
          tint: scoreColor(ratings.average, theme),
          onPress: onOpenReviews,
          a11y: `Rated ${ratings.average} out of 100 from ${ratings.total} ${
            ratings.total === 1 ? 'rating' : 'ratings'
          }. Opens the reviews.`,
        }
      : {
          key: 'score',
          /* Still a door. There are no ratings to read, and the sheet it opens is
             where a reader writes the first one — which is the single most useful
             thing this cell can offer on a game nobody has scored. */
          value: EMPTY,
          label: 'No ratings found',
          empty: true,
          onPress: onOpenReviews,
          a11y: 'Not yet rated by anybody here. Opens the reviews.',
        },

    listCount > 0
      ? {
          key: 'lists',
          value: String(listCount),
          label: listCount === 1 ? 'Collection' : 'Collections',
          onPress: onOpenLists,
          a11y: `In ${listCount} ${listCount === 1 ? 'collection' : 'collections'}. Opens them.`,
        }
      : {
          key: 'lists',
          /* A real zero, not `EMPTY`. The count is a number the app definitely
             knows and the answer is genuinely none — unlike the three cells
             beside it, where an absence may be IGDB's silence rather than a fact.
             Inert, because the sheet behind it would open on an empty list. */
          value: '0',
          label: 'Collections',
          a11y: 'Not in any collections yet.',
        },

    /*
     * The two ways this can be blank are different facts, and the label says
     * which.
     *
     * "No times found" is IGDB answering "nobody has submitted one". "Times
     * unavailable" is the request having *failed*, and this is the label that
     * found the bug: the path was `game_time_to_beat`, which IGDB 404s, and
     * `retry: false` turned that into a cell indistinguishable from an
     * unmeasured game. It is `game_time_to_beats` now — see `getTimeToBeat`.
     * Keep the two apart; they are the difference between "this game has no
     * data" and "something between here and IGDB is broken".
     */
    length ??
      (times.isError
        ? {
            key: 'length',
            value: EMPTY,
            label: 'Times unavailable',
            empty: true,
            a11y: 'Completion times could not be loaded.',
          }
        : {
            key: 'length',
            value: EMPTY,
            label: 'No times found',
            empty: true,
            a11y: 'Nobody has submitted a completion time for this game.',
          }),

    board
      ? {
          key: 'board',
          value: board.rating,
          label: board.organization.toUpperCase(),
          a11y: `Rated ${board.rating} by ${board.organization}`,
        }
      : details.isError
        ? {
            /* Same distinction as the cell above: a failed request is not a game
               no board has looked at. */
            key: 'board',
            value: EMPTY,
            label: 'Age rating unavailable',
            empty: true,
            a11y: 'Age ratings could not be loaded.',
          }
        : {
            key: 'board',
            value: EMPTY,
            label: 'No age rating',
            empty: true,
            a11y: 'No rating board has classified this game.',
          },
  ];

  /*
   * The placeholder is not decoration — it is what stops the tab bar moving.
   *
   * This strip sits between the primary action and the tabs, so arriving late
   * pushes both down by its own height at the moment a reader is reaching for
   * one. The skeleton holds the space from first paint; see
   * `<StatsStripSkeleton>`.
   */
  if (loading) return <StatsStripSkeleton count={4} />;

  return <StatsStrip cells={cells} />;
});

/**
 * The one length worth printing, and what to call it.
 *
 * `normally` is the answer to "how long is this game" and is what IGDB has most
 * submissions behind. The two fallbacks are *different questions*, so each
 * renames the cell rather than quietly standing in for the middle figure — a game
 * with only a completionist time is not a 90-hour game, it is a game somebody
 * spent 90 hours finishing.
 */
function lengthOf(
  times:
    | { hastily: number | null; normally: number | null; completely: number | null }
    | null
    | undefined
): StatsCell | null {
  if (!times) return null;

  const pick =
    times.normally !== null
      ? { seconds: times.normally, label: 'To beat', spoken: 'to beat' }
      : times.hastily !== null
        ? { seconds: times.hastily, label: 'Rushed', spoken: 'rushing straight through' }
        : times.completely !== null
          ? { seconds: times.completely, label: 'To 100%', spoken: 'to complete everything' }
          : null;

  if (!pick) return null;

  const value = hoursFor(pick.seconds);
  return { key: 'length', value, label: pick.label, a11y: `${value} ${pick.spoken}` };
}

/**
 * Seconds → a readable length.
 *
 * Deliberately the same rounding as `<TimeToBeatWidget>`: whole hours above two,
 * one decimal below, because the difference between 1 h and 1.5 h is most of a
 * short game and the difference between 41 h and 41.3 h is an average of seven
 * submissions pretending to be precise. The two are duplicated rather than
 * shared — four lines with no state, and importing across two feature components
 * to save them would be the worse trade.
 */
function hoursFor(seconds: number): string {
  const hours = seconds / SECONDS_PER_HOUR;
  if (hours < 2) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours)} h`;
}

/** The highest-priority board a game carries. See `BOARD_ORDER`. */
function boardOf(
  ratings: { organization: string; rating: string }[] | undefined
): { organization: string; rating: string } | null {
  if (!ratings || ratings.length === 0) return null;

  const rank = (name: string) => {
    const index = BOARD_ORDER.indexOf(name.toUpperCase());
    return index === -1 ? BOARD_ORDER.length : index;
  };

  return ratings.reduce((best, entry) =>
    rank(entry.organization) < rank(best.organization) ? entry : best
  );
}
