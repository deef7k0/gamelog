import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { IconButton } from '@/components/ui/icon-button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
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
export type ToolbarSort = { value: GameSort; icon: keyof typeof Ionicons.glyphMap; label: string };

const SORTS: readonly ToolbarSort[] = [
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
  /**
   * The sorts on offer, when they are not a collection's — search results lead
   * with IGDB's relevance rather than a list's own order.
   */
  sorts?: readonly ToolbarSort[];
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
  sorts = SORTS,
}: CollectionToolbarProps) {
  const theme = useTheme();
  const accent = useAccent();
  const selectable = useSelectable();

  return (
    <View style={styles.bar}>
      {showSort && (
        <>
          <Text variant="label" color="textMuted">
            Sort
          </Text>

          <View style={styles.sorts}>
            {sorts.map((option) => {
              const active = option.value === sort;
              const look = selectable(active);
              return (
                <PressableScale
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: active }}
                  accessibilityLabel={option.label}
                  onPress={() => onSort(option.value)}
                  scaleTo={0.9}
                  hitSlop={KEY_SLOP}
                  pressedColor={look.pressedColor}
                  focusRing={look.focusRing}
                  style={StyleSheet.flatten([styles.key, look.style])}>
                  <Ionicons
                    name={option.icon}
                    size={16}
                    color={active ? accent.onSurface : theme.textSecondary}
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
      <IconButton
        icon={layout === 'grid' ? 'list' : 'grid'}
        accessibilityLabel={layout === 'grid' ? 'Show as a list' : 'Show as a grid'}
        size="small"
        onPress={() => onLayout(layout === 'grid' ? 'rows' : 'grid')}
      />
    </View>
  );
}

/** The sort keys' edge — `<IconButton size="small">`'s, so the row is one size. */
const KEY = 32;
/** Vertical only: the keys sit in a row, and sideways slop would overlap. */
const KEY_SLOP = { top: (TapTarget - KEY) / 2, bottom: (TapTarget - KEY) / 2 };

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    minHeight: TapTarget,
  },
  sorts: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  spacer: { flex: 1 },
  /* Round keys, `<IconButton>`'s small size: a glyph with no word is a
     transport key in this language. Radios rather than `<IconButton>`s because
     five of them choose one order between them. */
  key: {
    width: KEY,
    height: KEY,
    borderRadius: KEY / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
