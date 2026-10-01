import { createContext, useContext, useMemo, type ReactNode } from 'react';
import {
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import Animated, {
  useAnimatedScrollHandler,
  useReducedMotion,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, MaxContentWidth, Palette, TapTarget, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { mix } from '@/lib/color';

/**
 * The width SimpMusic's artist page was measured at: the owner's phone, 360dp
 * across, where its 180dp album art is exactly half the display.
 *
 * Every size below is one of SimpMusic's dp values over this — a *fraction of
 * the window* — so a wider phone draws the same composition larger, rather than
 * the same numbers with more air around them. Type is the exception and stays
 * on `Type`: text follows the reader's font size, never the width of the glass.
 * Read from `ArtistScreen.kt`, `AdapterItems.kt` and `DescriptionView.kt`.
 */
const REFERENCE_WIDTH = 360;

export type SectionMetrics = ReturnType<typeof metricsFor>;

function metricsFor(windowWidth: number) {
  const width = Math.min(windowWidth, MaxContentWidth);
  const at = (dp: number) => Math.round((dp / REFERENCE_WIDTH) * width);

  return {
    /** A heading, a card and a rail's first item all start this far in: the reference's 20. */
    inset: at(20),
    /**
     * The sides of an album or playlist's body — its actions and description,
     * under a centred header: the reference's 32 (`AlbumScreen.kt`).
     */
    bodyInset: at(32),
    /** A heading row, with or without its More: the height of the reference's `TextButton`. */
    headerHeight: at(40),
    /** The More's own padding, the `TextButton`'s 12, so its word sits in from the edge. */
    moreInset: at(12),
    /** Between two items in a rail — each carries 10 either side. */
    itemGap: at(20),
    /** From a heading down to the art under it: an item's 10 of top padding. */
    artTop: at(10),
    /** From the art down to its title. */
    titleTop: at(8),
    /** Under an item's last line. */
    itemBottom: at(6),
    /**
     * Box art, 2:3, at the height of the reference's 180dp album squares — the
     * reference's own rule for an item that is not square: its videos are sized
     * by height (160) too. Two and a half covers across a phone.
     */
    cover: { width: at(120), height: at(180) },
    /** 16:9 — screenshots, events — at the reference's video height. */
    wide: { width: at(284.5), height: at(160) },
    /** The description card: 8 of corner, 16 of padding. */
    cardRadius: at(8),
    cardPadding: at(16),
    /** Between the blocks inside a card, and from a card's text to its More. */
    cardGap: at(8),
    /** Between one section and the next heading. */
    sectionGap: at(10),
  };
}

/** SimpMusic's section geometry for this window. See `REFERENCE_WIDTH`. */
export function useSectionMetrics(): SectionMetrics {
  const { width } = useWindowDimensions();
  return useMemo(() => metricsFor(width), [width]);
}

/**
 * How far in a section's heading and card sit from the edges of whatever holds
 * them, and where a rail's first item starts.
 *
 * Zero unless a screen says otherwise: a container that pads itself — the
 * additional-information screen, the Similar tab — keeps its own margin. The
 * Overview tab sets the reference's inset and pads nothing, so its rails can
 * run the full width and still start in line with the headings above them.
 */
const SectionInsetContext = createContext(0);

export function SectionInsetProvider({ inset, children }: { inset: number; children: ReactNode }) {
  return <SectionInsetContext.Provider value={inset}>{children}</SectionInsetContext.Provider>;
}

export function useSectionInset(): number {
  return useContext(SectionInsetContext);
}

export type SectionMoreProps = {
  /** "More" unless the section's way onward has a name of its own. */
  label?: string;
  accessibilityLabel: string;
  onPress: () => void;
};

/**
 * The heading's way onward: the reference's `TextButton` — one small word in
 * the quiet ink, no fill, no edge — at the right end of the heading row.
 */
export function SectionMore({ label = 'More', accessibilityLabel, onPress }: SectionMoreProps) {
  const metrics = useSectionMetrics();
  /* The row is the reference's 40; a finger needs the platform floor. */
  const reach = Math.max(0, Math.ceil((TapTarget - metrics.headerHeight) / 2));

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      hitSlop={{ top: reach, bottom: reach, left: 0, right: 0 }}
      scaleTo={0.95}
      style={StyleSheet.flatten([
        styles.more,
        { minHeight: metrics.headerHeight, paddingHorizontal: metrics.moreInset },
      ])}>
      <Text variant="bodySmall" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * A section's heading: its name, bold and white, and at the far end a quiet
 * fact about it (`action`) or its way onward (`more`).
 *
 * `h2`, the app's band heading, for the reference's 16sp bold: Inter at 17 is
 * the size Poppins at 16 reads as.
 */
export function SectionHeader({
  title,
  action,
  more,
  moreSlot,
}: {
  title: string;
  action?: ReactNode;
  more?: SectionMoreProps;
  /**
   * A More that owns what it opens — a sheet's own trigger, drawn with
   * `<SectionMore>` — set where `more` would be and spaced the same.
   */
  moreSlot?: ReactNode;
}) {
  const metrics = useSectionMetrics();
  const inset = useSectionInset();
  const hasMore = !!more || !!moreSlot;

  return (
    <View
      style={[
        styles.header,
        {
          minHeight: metrics.headerHeight,
          paddingLeft: inset,
          /* The More brings its own padding, as the reference's button does. */
          paddingRight: hasMore ? Math.max(0, inset - metrics.moreInset) : inset,
        },
      ]}>
      <Text variant="h2" accessibilityRole="header" style={styles.title}>
        {title}
      </Text>
      {action}
      {more && <SectionMore {...more} />}
      {moreSlot}
    </View>
  );
}

/**
 * The reference's description card: an `ElevatedCard` 8 in the corner and 16
 * in, filled with the artwork's own dark vivid tone at half brightness.
 *
 * SimpMusic takes Palette's dark-vibrant swatch and halves its RGB
 * (`rgbFactor(0.5f)`); the game's dynamic scheme already holds that tone —
 * `primaryContainer`, the seed's hue at tone 32 — so this halves that. On a
 * game's page the card is that game's colour, dark; on the house accent it is
 * the house blue's. Every ink on it clears AA with room: `textSecondary` 6.4:1
 * and `controlInk` 10.5:1, measured across eight seeds.
 *
 * `onPress` makes the whole card the way onward, for a card that summarises
 * where its heading's More goes.
 */
export function SectionCard({
  children,
  padded = true,
  onPress,
  accessibilityLabel,
  style,
}: {
  children: ReactNode;
  /** Off for content that reaches the card's own edges. */
  padded?: boolean;
  onPress?: () => void;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const metrics = useSectionMetrics();
  const inset = useSectionInset();
  const fill = useMemo(() => mix(accent.m3.primaryContainer, Palette.shadowInk, 0.5), [accent]);

  const card = StyleSheet.flatten([
    Elevation.card,
    {
      marginHorizontal: inset,
      borderRadius: metrics.cardRadius,
      backgroundColor: fill,
      gap: metrics.cardGap,
    },
    padded && { padding: metrics.cardPadding },
    style,
  ]);

  if (!onPress) return <View style={card}>{children}</View>;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      onPress={onPress}
      scaleTo={0.98}
      style={card}>
      {children}
    </PressableScale>
  );
}

/**
 * A heading and what it heads — a card, a rail — as the reference stacks them.
 * The heading row is the only space between the two.
 */
export function Section({
  title,
  action,
  more,
  moreSlot,
  children,
}: {
  title: string;
  action?: ReactNode;
  more?: SectionMoreProps;
  moreSlot?: ReactNode;
  children: ReactNode;
}) {
  return (
    <View>
      <SectionHeader title={title} action={action} more={more} moreSlot={moreSlot} />
      {children}
    </View>
  );
}

export type ArtShape = 'cover' | 'wide';

/**
 * A row of artwork under a heading: the reference's `LazyRow` of
 * `HomeItemContentPlaylist` — the art, then its title (two lines, always
 * reserved, so a rail is one height whatever its titles) and one quiet line.
 *
 * Full width, starting at the section inset so the first piece of art is in
 * line with the heading above it, and running off both edges as it scrolls.
 * `renderArt` draws the art at the size it is handed; the shape sets that size
 * (see `useSectionMetrics`).
 *
 * Windowed like every rail in the app: a screenful and a little more up front,
 * one screen either side after that.
 */
/** What an item's art is drawn with, beyond its size. */
export type ArtRailContext = {
  index: number;
  /** The rail's scroll offset, when it runs the parallax; null when it does not. */
  scrollX: SharedValue<number> | null;
  /** Where the first item starts and how far apart items sit — for `useRailDrift`. */
  inset: number;
  itemGap: number;
};

export function ArtRail<T>({
  data,
  keyOf,
  shape,
  renderArt,
  titleOf,
  subtitleOf,
  onPressItem,
  labelOf,
  inset: insetProp,
  parallax = false,
}: {
  data: readonly T[];
  keyOf: (item: T) => string;
  shape: ArtShape;
  renderArt: (
    item: T,
    size: { width: number; height: number },
    context: ArtRailContext
  ) => ReactNode;
  titleOf?: (item: T) => string;
  subtitleOf?: (item: T) => string | null;
  onPressItem?: (item: T) => void;
  /** What a screen reader says for an item; defaults to its title. */
  labelOf?: (item: T) => string;
  /**
   * Where the first item starts, when the screen's margin is not the section
   * inset in force — Home and Search keep the app's 10.
   */
  inset?: number;
  /**
   * Let the art sit behind its frame and slide as the rail moves (`<Poster
   * parallax>`), as Home's rails always have. Off under a reduced-motion
   * preference.
   */
  parallax?: boolean;
}) {
  const metrics = useSectionMetrics();
  const contextInset = useSectionInset();
  const inset = insetProp ?? contextInset;
  const size = metrics[shape];
  const reduceMotion = useReducedMotion();

  /* Written and read on the UI thread, so a drag never enters JS. */
  const scrollX = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((event) => {
    scrollX.set(event.contentOffset.x);
  });
  const driver = parallax && !reduceMotion ? scrollX : null;

  return (
    <Animated.FlatList
      data={data}
      horizontal
      keyExtractor={keyOf}
      showsHorizontalScrollIndicator={false}
      initialNumToRender={4}
      windowSize={3}
      onScroll={driver ? onScroll : undefined}
      scrollEventThrottle={16}
      contentContainerStyle={{
        paddingHorizontal: inset,
        paddingTop: metrics.artTop,
        paddingBottom: metrics.itemBottom,
        gap: metrics.itemGap,
      }}
      renderItem={({ item, index }) => {
        const title = titleOf?.(item);
        const subtitle = subtitleOf?.(item);
        const body = (
          <View style={{ width: size.width }}>
            {renderArt(item, size, { index, scrollX: driver, inset, itemGap: metrics.itemGap })}
            {title !== undefined && (
              <View style={{ paddingTop: metrics.titleTop }}>
                <Text variant="itemTitle" numberOfLines={2} style={styles.itemTitle}>
                  {title}
                </Text>
                {!!subtitle && (
                  <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                    {subtitle}
                  </Text>
                )}
              </View>
            )}
          </View>
        );

        if (!onPressItem) return body;
        return (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={labelOf?.(item) ?? title}
            onPress={() => onPressItem(item)}
            scaleTo={0.96}>
            {body}
          </PressableScale>
        );
      }}
    />
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center' },
  title: { flex: 1 },
  more: { justifyContent: 'center' },
  /* Two lines held open, the reference's `heightIn(min = thumbSize + 70.dp)`:
     a one-line title does not make its item shorter than its neighbours. */
  itemTitle: { minHeight: Type.itemTitle.lineHeight * 2 },
});
