import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Radius, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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

/**
 * One cell of the strip.
 *
 * `onPress` is what makes a cell a door, and the *label* is where that shows —
 * see the note on `styles.cell`.
 */
type Cell = {
  key: string;
  value: string;
  label: string;
  /** Overrides the value's ink. Only the score cell uses it. */
  tint?: string;
  /**
   * The answer is not known. Drawn a size down and in the quiet ink, with a
   * sentence under it instead of a unit — see `StatCell`.
   *
   * Not set on a zero collections count: that is a number the app definitely
   * has, and it is drawn like any other number.
   */
  empty?: true;
  onPress?: () => void;
  /** The whole cell as one sentence; the two lines say nothing apart. */
  a11y: string;
};

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
export function GameStatsStrip({ gameId, onOpenReviews, onOpenLists }: GameStatsStripProps) {
  const theme = useTheme();
  const accent = useAccent();

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

  const cells: Cell[] = [
    ratings
      ? {
          key: 'score',
          value: String(ratings.average),
          label: ratings.total === 1 ? '1 RATING' : `${ratings.total} RATINGS`,
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
          label: listCount === 1 ? 'COLLECTION' : 'COLLECTIONS',
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
          label: 'COLLECTIONS',
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
   * one. Four bars in the real cell's exact box model hold the space from first
   * paint; the cells fill in underneath without anything shifting.
   *
   * `accent.m3.surfaceContainerHigh` rather than `theme.skeleton`: the fixed grey
   * ladder is not used on a game's own screens, which derive their surfaces from
   * the artwork.
   */
  if (loading) {
    return (
      <View
        style={styles.strip}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        {[0, 1, 2, 3].map((index) => (
          <View key={index} style={styles.cell}>
            <View
              style={[styles.ghostValue, { backgroundColor: accent.m3.surfaceContainerHigh }]}
            />
            <View
              style={[styles.ghostLabel, { backgroundColor: accent.m3.surfaceContainerHigh }]}
            />
          </View>
        ))}
      </View>
    );
  }

  return (
    <View style={styles.strip}>
      {cells.map((cell, index) => (
        <View key={cell.key} style={styles.slot}>
          {/* A rule *between* cells, not around the strip.

              The app reaches for a surface step before a border, and this is the
              one shape where that does not apply: four numbers in a row with no
              separator read as one sentence, and a filled panel behind them would
              make the masthead's quietest content its heaviest block. A divider
              between columns of a grid is the thing a rule is actually for — it
              has two edges to sit on rather than floating across artwork. */}
          {index > 0 && (
            <View style={[styles.divider, { backgroundColor: accent.m3.outlineVariant }]} />
          )}
          <StatCell cell={cell} />
        </View>
      ))}
    </View>
  );
}

/**
 * One cell, pressable or not.
 *
 * Two components rather than a conditional wrapper so the accessible role is
 * never computed: a cell either is a button or is a pair of static lines, and a
 * screen reader is told which without inspecting a prop.
 */
function StatCell({ cell }: { cell: Cell }) {
  const accent = useAccent();
  const labelColor = cell.onPress ? accent.onSurface : accent.quietInk;

  const body = (
    <>
      {/*
        The value sits in a row of fixed height, whatever size it is drawn at.

        That is what keeps every label in the strip on one line across all four
        cells: an "N/A" is drawn smaller than a number, and without the row it
        would be a shorter box, so its label would ride up above its neighbours'.
        `minHeight` rather than `height` so a number scaled up by the OS text
        setting grows the row instead of being clipped by it.
      */}
      <View style={styles.value}>
        {cell.empty ? (
          /*
           * A non-answer is quieter than an answer — `h4` in the quiet ink, where a
           * number is `h2` in full white. At the same size and weight, "N/A" was
           * the loudest thing in the strip on a game with no data, which is the
           * one game where the strip has the least to say.
           */
          <Text variant="h4" numberOfLines={1} style={{ color: accent.quietInk }}>
            {cell.value}
          </Text>
        ) : (
          /* `h2`, down from `h1`. Four 21px numbers under a 24px title made the
             strip compete with the game's own name; one step down keeps the
             numbers the loudest thing in their row and the title the loudest
             thing on the page. */
          <Text variant="h2" numberOfLines={1} style={cell.tint ? { color: cell.tint } : undefined}>
            {cell.value}
          </Text>
        )}
      </View>
      {/*
        The label is where tappability shows.

        Two of these four cells lead somewhere and two are facts, and a row where
        some cells respond to a press and nothing says which is a guessing game.
        Accent-coloured type is already this app's link — "Read more", "See your
        full review", every footer on the Overview tab — so a coloured label is
        the carrier the reader has already learned, and it costs the strip no
        chevrons or chrome. `accent.onSurface` is the legible twin of the accent,
        not the fill: this is a *word*, and `accent.color` on a dark page is a
        button colour that fails AA as type.
      */}
      {cell.empty ? (
        /*
         * A sentence, not a unit — so sentence case, regular weight, two lines.
         *
         * These were uppercase `h6` like the units above real numbers, and at 10px
         * bold with tracking "LENGTH UNAVAILABLE" is about 117dp against the
         * ~84dp a cell has on a 390dp phone, so every one of them truncated. The
         * type floor is 10px and this stays on it; what makes it read smaller is
         * the case. Lowercase sets on the x-height, roughly two thirds of a
         * capital, so the same 10px is visibly quieter — the right register for
         * an explanation sitting under an "N/A". Two lines because a sentence
         * wraps where a unit may not; the fixed value row above is what stops
         * the wrap from misaligning the strip.
         */
        <Text variant="caption" numberOfLines={2} style={[styles.sentence, { color: labelColor }]}>
          {cell.label}
        </Text>
      ) : (
        <Text variant="h6" numberOfLines={1} style={{ color: labelColor }}>
          {cell.label}
        </Text>
      )}
    </>
  );

  if (!cell.onPress) {
    return (
      <View style={styles.cell} accessible accessibilityLabel={cell.a11y}>
        {body}
      </View>
    );
  }

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={cell.a11y}
      onPress={cell.onPress}
      scaleTo={0.96}
      style={StyleSheet.flatten(styles.cell)}>
      {body}
    </PressableScale>
  );
}

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
): Cell | null {
  if (!times) return null;

  const pick =
    times.normally !== null
      ? { seconds: times.normally, label: 'TO BEAT', spoken: 'to beat' }
      : times.hastily !== null
        ? { seconds: times.hastily, label: 'RUSHED', spoken: 'rushing straight through' }
        : times.completely !== null
          ? { seconds: times.completely, label: 'TO 100%', spoken: 'to complete everything' }
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

const styles = StyleSheet.create({
  strip: { flexDirection: 'row', alignItems: 'stretch' },
  /* The slot holds the divider; the cell holds the content. Two views because
     the divider is positioned against the slot's full height and must not be
     scaled by the cell's press animation. */
  slot: { flex: 1, position: 'relative' },
  /* Centred across, **top-aligned** down. It was centred both ways, which held
     only while every cell was the same height — an empty cell's label may wrap
     to two lines, and centring would then lift its neighbours' values off the
     shared line. Top-aligned, the value rows line up and the labels start
     together; a two-line label simply runs further down. */
  cell: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: Spacing.x4,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x4,
  },
  /* Inset top and bottom so the rule stops short of the cell's own text rather
     than running the full height — a divider that touches both edges reads as a
     table border, which would need a matching one around the strip. */
  divider: {
    position: 'absolute',
    left: 0,
    top: Spacing.x12,
    bottom: Spacing.x12,
    width: StyleSheet.hairlineWidth,
  },
  /* The value row. Its height is the number's line box, so an "N/A" drawn a
     size down is centred in the same space a number occupies. */
  value: { minHeight: Type.h2.lineHeight, justifyContent: 'center' },
  sentence: { textAlign: 'center' },
  /* Exactly the two text boxes they stand in for, so nothing moves when the real
     values arrive. Read off `Type` rather than written as numbers: retuning the
     scale must move both together. */
  ghostValue: { width: 30, height: Type.h2.lineHeight, borderRadius: Radius.xs },
  ghostLabel: { width: 50, height: Type.h6.lineHeight, borderRadius: Radius.xs },
});
