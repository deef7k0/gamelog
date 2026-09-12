import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameSort } from '@/lib/games';

/** How a collection's games are laid out. */
export type CollectionLayout = 'grid' | 'rows';

/**
 * The sorts a collection offers, each with the glyph that says what it does.
 *
 * A glyph rather than a word, and the row is the reason: five sort options as
 * text pills is most of a phone's width, so the row either wraps or scrolls and
 * the layout toggle gets pushed off the end. `text` / `swap-vertical` /
 * `star` are conventional enough to read at a glance, and every one of them
 * carries an `accessibilityLabel` with the full name — the glyph is a shorthand
 * for sighted users, never the only carrier.
 *
 * `default` leads because it is the collection's *own* order: the sequence the
 * owner arranged, or the ranking if it is a ranked list. Everything else is a
 * temporary way of reading the same shelf and none of it is written back.
 */
const SORTS: readonly { value: GameSort; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { value: 'default', icon: 'reorder-three', label: 'List order' },
  { value: 'title', icon: 'text', label: 'A to Z' },
  { value: 'newest', icon: 'arrow-down', label: 'Newest first' },
  { value: 'oldest', icon: 'arrow-up', label: 'Oldest first' },
  { value: 'rating', icon: 'star', label: 'Highest rated' },
];

export type CollectionToolbarProps = {
  sort: GameSort;
  onSort: (sort: GameSort) => void;
  layout: CollectionLayout;
  onLayout: (layout: CollectionLayout) => void;
  /** Hidden on the shapes where re-ordering would destroy the only structure. */
  showSort?: boolean;
};

/**
 * "Sort" and how to read it — the one row of controls above a collection's games.
 *
 * ## Why glyphs and not the old pills
 *
 * `<SortBar>` is a row of uppercase text pills that wraps. On a collection it
 * wrapped to two lines on most phones, and it had no room for the thing this row
 * also has to carry: a way to change the layout. Compressing the sorts to glyphs
 * buys that space back and puts the whole control on one line at any width.
 *
 * The layout toggle is pushed to the far edge rather than sitting at the end of
 * the sort run, because it is a different *kind* of choice — the sorts are five
 * views of one order, and this is two ways of drawing whatever order won. Same
 * reason it is a single button that shows the layout you would get, rather than
 * a second pair of radio pills.
 */
export function CollectionToolbar({
  sort,
  onSort,
  layout,
  onLayout,
  showSort = true,
}: CollectionToolbarProps) {
  const theme = useTheme();

  return (
    <View style={styles.bar}>
      {showSort && (
        <>
          <Text variant="label" color="textMuted">
            Sort
          </Text>

          <View style={styles.sorts}>
            {SORTS.map((option) => {
              const active = option.value === sort;
              return (
                <PressableScale
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                  onPress={() => onSort(option.value)}
                  scaleTo={0.9}
                  style={StyleSheet.flatten([
                    styles.chip,
                    {
                      backgroundColor: active ? theme.surfaceSelected : 'transparent',
                      borderColor: active ? theme.borderStrong : theme.border,
                    },
                  ])}>
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={active ? theme.text : theme.textMuted}
                  />
                </PressableScale>
              );
            })}
          </View>
        </>
      )}

      <View style={styles.spacer} />

      {/* Shows the layout you would *get*, not the one you are in. A toggle
          labelled with its current state reads as a status line and people tap
          it expecting nothing to happen. */}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={layout === 'grid' ? 'Show as a list' : 'Show as a grid'}
        onPress={() => onLayout(layout === 'grid' ? 'rows' : 'grid')}
        scaleTo={0.9}
        style={StyleSheet.flatten([styles.chip, { borderColor: theme.border }])}>
        <Ionicons
          name={layout === 'grid' ? 'list' : 'grid'}
          size={16}
          color={theme.textSecondary}
        />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
  },
  sorts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  spacer: { flex: 1 },
  /* Square rather than a pill: these hold a glyph, and a fully-round chip is the
     app's shape for *metadata*. Every control in the system is a 6px rounded
     rectangle, and these are controls. */
  chip: {
    width: 34,
    height: 34,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
