import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Checkbox } from '@/components/ui/selection-marks';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { sortGenresByReach } from '@/constants/game-genres';
import { SELECTABLE_PERSPECTIVES } from '@/constants/player-perspectives';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGenres, getSurprisePoolSize, type SurprisePoolSize } from '@/lib/games';
import type { TrackPickMode } from '@/lib/soundtracks';
import {
  activeFilterCount,
  poolFiltersFor,
  RATING_FLOORS,
  type RatingFloor,
  type SurpriseGameMode,
  type SurprisePrefs,
} from '@/lib/surprise-prefs';

const GAME_OPTIONS: readonly SortOption<SurpriseGameMode>[] = [
  { key: 'random', label: 'Completely random' },
  { key: 'popular', label: 'Popular' },
  { key: 'hidden', label: 'Hidden gems' },
];

/** Appended only when the viewer has enough logs to seed it. See `canUseForYou`. */
const FORYOU_OPTION: SortOption<SurpriseGameMode> = { key: 'foryou', label: 'Based on my games' };

const TRACK_OPTIONS: readonly SortOption<TrackPickMode>[] = [
  { key: 'popular', label: 'Popular' },
  { key: 'random', label: 'Random' },
  { key: 'surprise', label: 'Mixed' },
];

/**
 * The rating floors, as pills.
 *
 * `SortBar` is generic over a string key, so the number is carried as its own
 * decimal string and parsed back on change. A four-option enum encoded as
 * `'0' | '70' | '80' | '90'` is a smaller thing to keep honest than a second
 * single-choice control that exists only to hold numbers.
 */
const RATING_LABELS: Record<RatingFloor, string> = {
  0: 'Any',
  70: '70+',
  80: '80+',
  90: '90+',
};

const RATING_OPTIONS: readonly SortOption<string>[] = RATING_FLOORS.map((floor) => ({
  key: String(floor),
  label: RATING_LABELS[floor],
}));

export type SurpriseSettingsProps = {
  prefs: SurprisePrefs;
  onChange: (prefs: SurprisePrefs) => void;
  /**
   * Whether "Based on my games" is offered at all.
   *
   * Hidden rather than disabled when false. The mode reads the viewer's own
   * logs, and with too few of them it would return nothing — showing a control
   * that cannot do its job is the thing `app/settings.tsx` exists to argue
   * against.
   */
  canUseForYou: boolean;
};

/**
 * Everything behind a roll: which slice, narrowed how, and what it sounds like.
 *
 * `<SortBar>` rather than a bespoke radio row for the single-choice groups: it is
 * already the app's single-choice control, it already carries `role="radiogroup"`,
 * and it already follows the selection rule (one surface step lighter, one border
 * brighter, never a colour). A fourth pill style invented here would be the
 * second implementation of a thing that has one.
 *
 * ## Why the multi-select chips are a second control and not a third style
 *
 * Genres and perspectives are *many of*, and `<SortBar>` is a radiogroup — using
 * it for them would announce "selected" on several radios at once, which is a
 * lie to a screen reader rather than a styling shortcut. `<FilterChips>` below
 * is the same fill, the same border and the same two surface steps; the only
 * addition is a leading tick on the chosen ones, which is what says "you may
 * pick more than one" to somebody who cannot hear the role.
 *
 * ## Why the filters disappear under "Based on my games"
 *
 * That mode issues no catalogue query at all — it asks IGDB what the games you
 * rated highest are similar to, and takes the edges that exist. A genre clause
 * has nothing to attach to, and filtering the handful of results afterwards
 * would usually empty them. PRODUCT.md's second principle is the rule here:
 * never present a control for something the system cannot actually do. So the
 * group is replaced by one line saying why, rather than sitting there inert.
 */
export function SurpriseSettings({ prefs, onChange, canUseForYou }: SurpriseSettingsProps) {
  const theme = useTheme();
  const accent = useAccent();
  const excludeLook = useSelectable()(prefs.excludePlayed);

  const gameOptions = canUseForYou ? [...GAME_OPTIONS, FORYOU_OPTION] : GAME_OPTIONS;

  /*
   * IGDB owns the genre vocabulary, so it is fetched rather than written down —
   * the same call `<GenreGrid>` and `<GameFilterBar>` make, under the same key,
   * so opening this screen after either of those costs nothing. It changes about
   * once a year, which is what `staleTime: Infinity` is recording.
   */
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  /*
   * All twenty-three, ordered by what somebody actually reaches for.
   *
   * `getGenres()` sorts `name asc`, which put Adventure, Arcade and Card & Board
   * Game in the first row and buried Shooter, Strategy and Role-playing in the
   * middle of six. Nothing is removed — this is a discovery tool and the long
   * tail is the point — but the tail belongs at the end, which is exactly the
   * argument `getPlatforms()` already makes about consoles one file over.
   *
   * Sorted here rather than inside `getGenres()` on purpose: the query is shared
   * with `<GenreGrid>` and `<GameFilterBar>` under the same key, and reordering
   * it at the source would silently restyle two surfaces that were not reviewed.
   * Memoised because the sort allocates and `genres.data` is otherwise stable
   * for the life of the app (`staleTime: Infinity`).
   */
  const genreOptions = useMemo(
    () =>
      sortGenresByReach(genres.data ?? []).map((genre) => ({
        id: genre.id,
        label: genre.name,
      })),
    [genres.data]
  );

  const filtersApply = prefs.gameMode !== 'foryou';
  const activeFilters = activeFilterCount(prefs);

  /*
   * How many games the settings currently match.
   *
   * The screen used to commit blind: you tightened four filters, pressed the
   * button, and learned from `EMPTY_FILTERED` that the combination matched
   * nothing — one IGDB round trip and one failed roll to find out. For a tool
   * whose job is surfacing obscure games that is backwards, because the
   * interesting configurations are the narrow ones and narrow is exactly where a
   * pool silently hits zero.
   *
   * Only asked when something is actually narrowing. With no filters set there
   * is nothing to be warned about, and "500+ games match" under an untouched
   * form is noise pretending to be information.
   *
   * **No debounce, by design.** The key is the filter tuple, so TanStack aborts
   * the in-flight request the moment another chip is tapped — `getSurprisePoolSize`
   * takes the `signal` and `igdbQuery` forwards it — and a tuple already answered
   * is served from cache forever. Ticking through six genres is therefore about
   * one completed request, not six, without a timer or a second piece of state.
   *
   * `placeholderData` keeps the previous answer on screen while the next one
   * lands, so the line updates rather than blinking out and back.
   */
  const poolSize = useQuery({
    queryKey: [
      'surprise-pool-size',
      prefs.gameMode,
      prefs.genreIds,
      prefs.perspectiveIds,
      prefs.minRating,
    ],
    queryFn: ({ signal }) =>
      /* The cast is discharged by `enabled` directly below: `filtersApply` *is*
         `gameMode !== 'foryou'`, and `foryou` is the only member of
         `SurpriseGameMode` that is not a `SurprisePool`. The query cannot run in
         the one mode the narrower type excludes. */
      getSurprisePoolSize(
        prefs.gameMode as Exclude<SurpriseGameMode, 'foryou'>,
        poolFiltersFor(prefs),
        signal
      ),
    enabled: filtersApply && activeFilters > 0,
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
    placeholderData: (previous) => previous,
  });

  function toggleId(field: 'genreIds' | 'perspectiveIds', id: number) {
    const current = prefs[field];
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    onChange({ ...prefs, [field]: next });
  }

  return (
    <View style={styles.root}>
      <View style={styles.group}>
        {/* `header`, so the three bands are navigable by heading rather than by
            swiping through forty-odd controls to find where the next one starts.
            The label is spelled out in sentence case for the same reason the
            count below is: the visible string is uppercase in *source*, not by
            `textTransform`, and VoiceOver's acronym heuristic reads a run of
            capitals a letter at a time. */}
        <Text
          variant="label"
          color="textMuted"
          accessibilityRole="header"
          accessibilityLabel="Game">
          GAME
        </Text>
        <SortBar
          options={gameOptions}
          value={prefs.gameMode}
          onChange={(gameMode) => onChange({ ...prefs, gameMode })}
          accessibilityLabel="Which games to pick from"
        />
      </View>

      {filtersApply ? (
        <View style={styles.filterGroup}>
          {/* The heading carries the count rather than a badge: this group can
              be several screens' worth of chips once it is open, and "3" beside
              the word is the only way to know something is still set without
              reading all of them. Neutral and inline, per the `<TabBar>` rule —
              a set filter is not an alert. */}
          <View style={styles.groupHead}>
            {/* The count is a *visual* device and degrades to nonsense spoken:
                the two spaces collapse to one, so the string announces as
                "narrow it down 3" — an unlabelled integer glued to an
                imperative, with no unit and nothing saying it counts filters.
                The label carries the sentence; the child keeps the glyphs. */}
            <Text
              variant="label"
              color="textMuted"
              accessibilityRole="header"
              accessibilityLabel={
                activeFilters > 0
                  ? `Narrow it down. ${activeFilters} ${activeFilters === 1 ? 'filter' : 'filters'} set.`
                  : 'Narrow it down'
              }>
              {activeFilters > 0 ? `NARROW IT DOWN  ${activeFilters}` : 'NARROW IT DOWN'}
            </Text>
            {activeFilters > 0 && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear all filters"
                hitSlop={CLEAR_SLOP}
                scaleTo={0.94}
                onPress={() =>
                  onChange({ ...prefs, genreIds: [], perspectiveIds: [], minRating: 0 })
                }>
                {/* `bodySmall`, matching the "Retry" beside the genre error —
                    they are the same object (an inline text action in blue with
                    the same hitSlop) and shipped at two different sizes until
                    this pass. It also answers the note that this control, the
                    only destructive one on the screen, was set like metadata. */}
                <Text variant="bodySmall" style={{ color: accent.onSurface }}>
                  Clear
                </Text>
              </PressableScale>
            )}
          </View>

          {/*
            What the narrowing currently yields, in one line.

            Absent rather than wrong when the count cannot be had: a failed or
            still-pending first lookup renders nothing at all, the way a game ITAD
            does not track shows no "Where to buy" section. A number this screen
            cannot stand behind is worse than none, because the entire point of it
            is that somebody trusts it enough not to spend a roll finding out.

            **`isError` has to be checked even though `data` is truthy**, and that
            pairing is the whole reason this guard is two conditions. The query
            carries `placeholderData: (previous) => previous` so the line updates
            instead of blinking out between filter changes — but a placeholder is
            the *previous tuple's* answer, and TanStack keeps serving it when the
            new tuple errors, since `data` for the failed key is undefined. On
            `data` alone a failed lookup would leave the count for the filters you
            had a moment ago sitting under the filters you have now, reading as
            current. That is the one failure mode worse than no number.
          */}
          {poolSize.data && !poolSize.isError && <PoolSizeLine size={poolSize.data} />}

          <View style={styles.subgroup}>
            {/* `header`, and it is the fix for the chip group's missing context.
                A `<View>` carrying only an `accessibilityLabel` is not an
                accessibility element on iOS, so the row's label was never spoken
                and all 23 chips announced as unscoped checkboxes. Making the
                container `accessible` is the wrong repair — it would collapse
                the 23 into one element. A heading immediately before them is
                what RN actually supports, and it puts the operator sentence in
                the rotor where somebody can find it before ticking anything. */}
            {/*
              One line, split into the two jobs it was doing.

              It read "Genres — a game matching any of these": a heading and a
              sentence of help welded together, which made it the only subgroup
              name on the screen that was not a bare noun — "Perspective" and
              "Minimum rating" are — and made the `header` role announce a whole
              sentence where a screen reader expects a name. Split, the three
              headings are parallel and scannable, and the operator note joins
              the other two explanations as prose. Not a word has changed.
            */}
            <View style={styles.captioned}>
              <Text variant="h6" color="textMuted" accessibilityRole="header">
                Genres
              </Text>
              {/* States the operator, because the alternative reading is the one
                  that returns nothing. See `SurprisePoolFilters.genreIds`. */}
              <Text variant="bodySmall" color="textSecondary">
                A game matching any of these.
              </Text>
            </View>
            {genres.isPending ? (
              /* Same step as the error that replaces it in this slot — two
                 states of one message should not be two sizes. */
              <Text variant="bodySmall" color="textMuted">
                Loading genres…
              </Text>
            ) : genres.isError ? (
              /*
                An IGDB failure used to render as nothing at all — `FilterChips`
                returns null on an empty list, so the heading and its sentence sat
                over blank space with no message, no retry, and no way to tell
                "IGDB is down" from "this app has no genres". On a discovery tool
                the genre list is the primary instrument, so its absence is the
                one that most needs explaining.

                The second sentence is the load-bearing one: perspective and
                rating are unaffected, so this is a degraded screen rather than a
                broken one, and saying so is what keeps somebody from backing out
                of a form that still does most of its job.
              */
              <View style={styles.inlineError}>
                <Text variant="bodySmall" color="textSecondary" style={styles.noteText}>
                  Genres didn’t load. The other filters still work.
                </Text>
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel="Retry loading genres"
                  hitSlop={CLEAR_SLOP}
                  scaleTo={0.94}
                  onPress={() => genres.refetch()}>
                  <Text variant="bodySmall" style={{ color: accent.onSurface }}>
                    Retry
                  </Text>
                </PressableScale>
              </View>
            ) : (
              <FilterChips
                options={genreOptions}
                selected={prefs.genreIds}
                onToggle={(id) => toggleId('genreIds', id)}
                accessibilityLabel="Genres"
              />
            )}
          </View>

          <View style={styles.subgroup}>
            <Text variant="h6" color="textMuted" accessibilityRole="header">
              Perspective
            </Text>
            <FilterChips
              options={SELECTABLE_PERSPECTIVES.map((perspective) => ({
                id: perspective.id,
                label: perspective.label,
              }))}
              selected={prefs.perspectiveIds}
              onToggle={(id) => toggleId('perspectiveIds', id)}
              accessibilityLabel="Player perspective"
            />
          </View>

          <View style={styles.subgroup}>
            <Text variant="h6" color="textMuted" accessibilityRole="header">
              Minimum rating
            </Text>
            <SortBar
              options={RATING_OPTIONS}
              value={String(prefs.minRating)}
              onChange={(value) => onChange({ ...prefs, minRating: Number(value) as RatingFloor })}
              accessibilityLabel="Minimum rating"
            />
            {/* Whose number it is. The app's own scores cover the few hundred
                games somebody here has logged; a roll draws from all of IGDB. */}
            <Text variant="bodySmall" color="textSecondary">
              IGDB’s community score, out of 100. Unrated games are kept on “Any” and dropped by
              every other step.
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.note, { borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={17} color={theme.textMuted} />
          <Text variant="bodySmall" color="textSecondary" style={styles.noteText}>
            Genre, perspective and rating filters apply to the catalogue. “Based on my games” reads
            your own library instead, so it uses neither.
          </Text>
        </View>
      )}

      <View style={styles.group}>
        <Text
          variant="label"
          color="textMuted"
          accessibilityRole="header"
          accessibilityLabel="Soundtrack">
          SOUNDTRACK
        </Text>
        <SortBar
          options={TRACK_OPTIONS}
          value={prefs.trackMode}
          onChange={(trackMode) => onChange({ ...prefs, trackMode })}
          accessibilityLabel="How to pick a song"
        />
      </View>

      {/*
        A checkbox row, not a third SortBar: this is a toggle, and the on/off
        state is the app's one selected state (`useSelectable`) — plus the box
        itself, the carrier that is not a colour.
      */}
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: prefs.excludePlayed }}
        accessibilityLabel="Exclude games I’ve played"
        scaleTo={0.98}
        pressedColor={excludeLook.pressedColor}
        focusRing={excludeLook.focusRing}
        onPress={() => onChange({ ...prefs, excludePlayed: !prefs.excludePlayed })}
        style={StyleSheet.flatten([styles.toggle, excludeLook.style])}>
        <Checkbox checked={prefs.excludePlayed} />
        <View style={styles.toggleText}>
          <Text variant="body" color={excludeLook.label}>
            Exclude games I’ve played
          </Text>
          {/*
            The ink moves with the row, and that is a contrast fix rather than a
            flourish. `textMuted` measures 4.32:1 on the accent's wash — under
            AA — so when the row lights up the caption steps to `textSecondary`
            (6.9:1), keeping the pair's own hierarchy intact in both states, since
            the label above it moves `textSecondary` → `text` at the same moment.
          */}
          <Text variant="bodySmall" color={prefs.excludePlayed ? 'textSecondary' : 'textMuted'}>
            Skips anything you logged as played or dropped. Backlog stays in.
          </Text>
        </View>
      </PressableScale>
    </View>
  );
}

/**
 * Below this, the count stops being reassurance and becomes a warning.
 *
 * Twenty-five is roughly half a batch (`SURPRISE_BATCH` is 50), which is the
 * point at which a roll starts returning games you have already seen this
 * session rather than failing outright — the quiet failure, and the one worth
 * naming before somebody spends three rolls discovering it.
 */
const NARROW_POOL = 25;

/**
 * One line saying what the filters currently match.
 *
 * Four bands rather than a bare number, because the number means different
 * things along its range. Zero is a dead end and says so with the recovery
 * attached; a handful is usable but worth flagging; the ceiling is IGDB's
 * `limit`, not a measurement, so it is reported as "500+" rather than as 500.
 *
 * The count is never the only carrier — each band states its consequence in
 * words, so nothing here depends on reading the digits.
 */
function PoolSizeLine({ size }: { size: SurprisePoolSize }) {
  const { count, atLeast } = size;

  const message = atLeast
    ? `${count}+ games match. Plenty to draw from.`
    : count === 0
      ? 'Nothing matches these filters. Loosen one and this updates.'
      : count === 1
        ? 'Exactly one game matches — every roll will be that game.'
        : count <= NARROW_POOL
          ? `Only ${count} games match, so rolls will repeat.`
          : `About ${count} games match.`;

  return (
    /*
     * `polite`, not `assertive`: this changes on every chip tap, and an assertive
     * region would interrupt the announcement of the chip that caused it.
     *
     * **`accessibilityLiveRegion` is Android-only in React Native**, so TalkBack
     * hears the count update and VoiceOver does not — an iOS reader has to
     * navigate to the line to read it. The alternative is an
     * `announceForAccessibility` per change, and on a control somebody taps six
     * times in a row that is a worse experience than a line you can go and read:
     * it would talk over the chip's own "selected" every time. Left as the
     * platform provides, deliberately, rather than evened down to neither.
     */
    <Text
      variant="bodySmall"
      color="textSecondary"
      accessibilityLiveRegion="polite"
      accessibilityRole="text">
      {message}
    </Text>
  );
}

type FilterChipsProps = {
  options: readonly { id: number; label: string }[];
  selected: readonly number[];
  onToggle: (id: number) => void;
  accessibilityLabel: string;
};

/**
 * A wrapping row of many-of chips.
 *
 * The same two surface steps and the same two border tokens `<SortBar>` uses —
 * selection is one step lighter and never a colour — with a tick added on the
 * chosen ones. The tick is doing real work: without it this is pixel-identical
 * to a radiogroup, and the only thing telling a sighted reader that several may
 * be on at once would be the fact that several currently are.
 *
 * `accessibilityRole="checkbox"` for the same reason, on the other channel.
 *
 * ## What names the group, and what does not
 *
 * `accessibilityLabel` on this row is **not** what announces "Genres" — a
 * `<View>` with a label and no `accessible` flag is not an accessibility element
 * on iOS at all, so for a long time these chips announced as twenty-three
 * unscoped checkboxes with no indication of which question they answered. It is
 * kept because TalkBack does read it off the view group, so it is the Android
 * half of the answer and costs nothing.
 *
 * The iOS half — and the better half on both — is the `accessibilityRole="header"`
 * on the caption immediately above each row. Setting `accessible` here instead
 * would have collapsed all twenty-three chips into one element and made the
 * control unusable, which is the repair that looks right and is not.
 */
function FilterChips({ options, selected, onToggle, accessibilityLabel }: FilterChipsProps) {
  const accent = useAccent();
  const selectable = useSelectable();

  if (options.length === 0) return null;

  return (
    <View style={styles.chipRow} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = selected.includes(option.id);
        const look = selectable(active);
        return (
          <PressableScale
            key={option.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={option.label}
            onPress={() => onToggle(option.id)}
            scaleTo={0.94}
            hitSlop={SmallControlSlop}
            pressedColor={look.pressedColor}
            focusRing={look.focusRing}
            style={StyleSheet.flatten([styles.chip, look.style])}>
            {active && <Ionicons name="checkmark" size={13} color={accent.onSurface} />}
            <Text variant="bodySmall" color={look.label}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/**
 * Lifts a one-word inline control to the tap floor without moving the word.
 *
 * The numbers have to clear `TapTarget` on **both** platforms, and the previous
 * 12 did not: `Type.caption`'s line box is 13dp, so 13 + 12 + 12 = 37 — under
 * the iOS 44 by seven and under Android's 48 by eleven, while the comment above
 * claimed the opposite. 18 top and bottom gives 49, which clears both.
 *
 * Not read from `TapTarget` directly, because hitSlop is the *margin* around a
 * box and the constant is the box: deriving it would mean subtracting the line
 * height here and re-deriving it every time the type scale moves.
 */
const CLEAR_SLOP = { top: 18, bottom: 18, left: 16, right: 16 };

const styles = StyleSheet.create({
  root: { gap: Spacing.x20 },
  group: { gap: Spacing.x8 },
  /*
   * The filter block needs a third interval, and without it the cadence was flat.
   *
   * `group` (6) is right for a band that is one label over one control — GAME and
   * SOUNDTRACK. This band holds three labelled subgroups, and `subgroup` is also
   * 6, so every gap inside the block measured the same: the space *between*
   * Genres and Perspective was identical to the space between "Perspective" and
   * its own chips, and three groups read as one undifferentiated run.
   *
   * 10 between them, 6 inside them, against the root's 13 between bands. Four
   * intervals now — 13 / 10 / 6 / 2 — each one naming a different relationship.
   */
  filterGroup: { gap: Spacing.x16 },
  /* The filter block holds three of its own labelled groups, so its members sit
     closer to each other than the top-level groups do — otherwise "Perspective"
     reads as a peer of "SOUNDTRACK" rather than as part of the set above it. */
  subgroup: { gap: Spacing.x8 },
  /* A heading and the sentence explaining it are one object, so they sit closer
     to each other than the pair sits to the control below — `subgroup`'s 6
     separates the pair from the chips, and this 2 holds the pair together. Same
     interval `toggleText` uses for the same relationship. */
  captioned: { gap: 2 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /* Columns `x8` (8): the separation between two *different* filters, and
     Material puts the floor for that at 8dp. Rows `SmallControlRowGap`. */
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    /*
     * Drawn at 32 and touched at the floor, like every filter pill.
     *
     * This grid used to be the one place slop was refused: at a 6dp gap the
     * expanded rectangles of two chips in adjacent *rows* overlapped, and React
     * Native resolves an overlap by view order rather than by proximity — a tap
     * between two rows would land on whichever chip mounted later. The row gap
     * is now exactly the two slops that meet across it (`SmallControlRowGap`),
     * so the touch boxes tile and never overlap, and the pills can be drawn
     * light without trading a small target for an ambiguous one.
     */
    minHeight: ControlHeight.small,
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    /* A pill: these filter, and filters are the pill family. */
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1 },
  /* The message takes the row and the retry sits at its end, so a long sentence
     wraps rather than squeezing the one control that recovers from it. */
  inlineError: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.x12,
  },
  /* A selection card, like a report reason: `Radius.card`, a 1px edge, no
     shadow. */
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x20,
    borderRadius: Radius.card,
    borderWidth: 1,
  },
  toggleText: { flex: 1, gap: 2 },
});
