import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { SortBar, type SortOption } from '@/components/ui/sort-bar';
import { Text } from '@/components/ui/text';
import { SELECTABLE_PERSPECTIVES } from '@/constants/player-perspectives';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGenres } from '@/lib/games';
import type { TrackPickMode } from '@/lib/soundtracks';
import {
  activeFilterCount,
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

  const filtersApply = prefs.gameMode !== 'foryou';
  const activeFilters = activeFilterCount(prefs);

  function toggleId(field: 'genreIds' | 'perspectiveIds', id: number) {
    const current = prefs[field];
    const next = current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id];
    onChange({ ...prefs, [field]: next });
  }

  return (
    <View style={styles.root}>
      <View style={styles.group}>
        <Text variant="label" color="textMuted">
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
        <View style={styles.group}>
          {/* The heading carries the count rather than a badge: this group can
              be several screens' worth of chips once it is open, and "3" beside
              the word is the only way to know something is still set without
              reading all of them. Neutral and inline, per the `<TabBar>` rule —
              a set filter is not an alert. */}
          <View style={styles.groupHead}>
            <Text variant="label" color="textMuted">
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
                <Text variant="caption" style={{ color: accent.onSurface }}>
                  Clear
                </Text>
              </PressableScale>
            )}
          </View>

          <View style={styles.subgroup}>
            <Text variant="caption" color="textMuted">
              {/* States the operator, because the alternative reading is the one
                  that returns nothing. See `SurprisePoolFilters.genreIds`. */}
              Genres — a game matching any of these
            </Text>
            {genres.isPending ? (
              <Text variant="caption" color="textMuted">
                Loading genres…
              </Text>
            ) : (
              <FilterChips
                options={(genres.data ?? []).map((genre) => ({
                  id: genre.id,
                  label: genre.name,
                }))}
                selected={prefs.genreIds}
                onToggle={(id) => toggleId('genreIds', id)}
                accessibilityLabel="Genres"
              />
            )}
          </View>

          <View style={styles.subgroup}>
            <Text variant="caption" color="textMuted">
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
            <Text variant="caption" color="textMuted">
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
            <Text variant="caption" color="textMuted">
              IGDB’s community score, out of 100. Unrated games are kept on “Any” and dropped by
              every other step.
            </Text>
          </View>
        </View>
      ) : (
        <View style={[styles.note, { borderColor: theme.border }]}>
          <Ionicons name="information-circle-outline" size={17} color={theme.textMuted} />
          <Text variant="caption" color="textMuted" style={styles.noteText}>
            Genre, perspective and rating filters apply to the catalogue. “Based on my games” reads
            your own library instead, so it uses neither.
          </Text>
        </View>
      )}

      <View style={styles.group}>
        <Text variant="label" color="textMuted">
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
        state rides the same surface step every other selected control in the
        app uses. The tick is the second carrier — colour is never the only one.
      */}
      <PressableScale
        accessibilityRole="checkbox"
        accessibilityState={{ checked: prefs.excludePlayed }}
        accessibilityLabel="Exclude games I’ve played"
        scaleTo={0.98}
        onPress={() => onChange({ ...prefs, excludePlayed: !prefs.excludePlayed })}
        style={StyleSheet.flatten([
          styles.toggle,
          {
            backgroundColor: prefs.excludePlayed ? theme.surfaceSelected : theme.surfaceElevated,
            borderColor: prefs.excludePlayed ? theme.borderStrong : theme.border,
          },
        ])}>
        <Ionicons
          name={prefs.excludePlayed ? 'checkbox' : 'square-outline'}
          size={19}
          color={prefs.excludePlayed ? accent.onSurface : theme.textMuted}
        />
        <View style={styles.toggleText}>
          <Text variant="body" color={prefs.excludePlayed ? 'text' : 'textSecondary'}>
            Exclude games I’ve played
          </Text>
          <Text variant="caption" color="textMuted">
            Skips anything you logged as played or dropped. Backlog stays in.
          </Text>
        </View>
      </PressableScale>
    </View>
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
 */
function FilterChips({ options, selected, onToggle, accessibilityLabel }: FilterChipsProps) {
  const theme = useTheme();

  if (options.length === 0) return null;

  return (
    <View style={styles.chipRow} accessibilityLabel={accessibilityLabel}>
      {options.map((option) => {
        const active = selected.includes(option.id);
        return (
          <PressableScale
            key={option.id}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: active }}
            accessibilityLabel={option.label}
            onPress={() => onToggle(option.id)}
            scaleTo={0.94}
            style={StyleSheet.flatten([
              styles.chip,
              {
                backgroundColor: active ? theme.surfaceSelected : theme.surfaceElevated,
                borderColor: active ? theme.borderStrong : theme.border,
              },
            ])}>
            {active && <Ionicons name="checkmark" size={13} color={theme.text} />}
            <Text variant="caption" color={active ? 'text' : 'textSecondary'}>
              {option.label}
            </Text>
          </PressableScale>
        );
      })}
    </View>
  );
}

/** Lifts a one-word inline control to the tap floor without moving the word. */
const CLEAR_SLOP = { top: 12, bottom: 12, left: 12, right: 12 };

const styles = StyleSheet.create({
  root: { gap: Spacing.x20 },
  group: { gap: Spacing.x8 },
  /* The filter block holds three of its own labelled groups, so its members sit
     closer to each other than the top-level groups do — otherwise "Perspective"
     reads as a peer of "SOUNDTRACK" rather than as part of the set above it. */
  subgroup: { gap: Spacing.x8 },
  groupHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  chip: {
    ...Elevation.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    /* `control`, not `pill`, and for the reason `<SortBar>` records: these are
       buttons, and every button in the app is the same rounded rectangle. The
       pill belongs to metadata chips, which these are not. */
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  note: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.x8,
    padding: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1 },
  toggle: {
    ...Elevation.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  toggleText: { flex: 1, gap: 2 },
});
