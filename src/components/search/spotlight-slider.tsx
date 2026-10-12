import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  AppState,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from 'react-native';
import Animated, { css, useReducedMotion } from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { SLIDE, slideHeight, slideScrimStops } from '@/constants/search-spotlight';
import { MaxContentWidth, Palette, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { MONTH_COLUMNS, monthRows } from '@/lib/games/calendar';
import type { Spotlight, SpotlightGame } from '@/lib/games/igdb';
import { countdownLabel, countdownSpoken, monthLabel } from '@/lib/games/spotlight';

/** One slide, as the slider draws it: what it shows and where a tap goes. */
type Slide =
  | {
      kind: 'game';
      key: string;
      game: SpotlightGame;
      badge: string;
      /** The whole slide as a sentence, for a screen reader. */
      spoken: string;
    }
  | { kind: 'calendar'; key: string; badge: string; spoken: string };

export type SpotlightSliderProps = {
  /** Null while the games are on their way: the slider holds its shape. */
  spotlight: Spotlight | null;
  loading: boolean;
  /** Unix seconds: the "now" the spotlight was asked for, so a countdown and its game agree. */
  now: number;
  /** The slider has been scrolled out of view — it stops moving by itself. */
  away: boolean;
};

/**
 * The head of Search: up to four slides of landscape art, edge to edge.
 *
 * ```text
 *   ░░░░░░░░░░░░░░░░░░░░░░░ [New]
 *   ░░░░░░ landscape art ░░░░░░░
 *   Game name
 *   Developer
 *   ━━━━   ────   ────   ────
 * ```
 *
 * The two biggest games to come out this month, the most awaited game still to
 * come as a countdown, and a door to the release calendar — the owner's four,
 * in the shape of the hero on Letterboxd's home (`constants/search-spotlight`).
 * Which games they are is `getSpotlight`; this draws them.
 *
 * ## The calendar slide is always there
 *
 * It needs nothing from IGDB to exist, so the slider is never empty: a failed
 * request, or a month with no art worth a slide, leaves the calendar and the
 * slides that did arrive. The segments count what is there.
 *
 * ## It moves by itself, until it is touched
 *
 * The reference's four segments are a timer's, so the slider advances every
 * six seconds with the current segment filling as it waits. **One drag stops
 * it** for as long as the screen stays up — a carousel that takes a slide
 * away from somebody reading it is the complaint about carousels. It also
 * stands still under Reduce Motion and for a screen reader, and whenever
 * nobody can see it: another tab is in front, the app is in the background, or
 * the page has been scrolled past it (`away`).
 *
 * ## The badge is near-black, like the word on a cover
 *
 * The reference's is orange. Colour on artwork belongs to the game here, which
 * is why an edition badge is black at 82% with white type; this is that badge.
 */
export const SpotlightSlider = memo(function SpotlightSlider({
  spotlight,
  loading,
  now,
  away,
}: SpotlightSliderProps) {
  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MaxContentWidth);
  const height = slideHeight(windowWidth);
  const reduceMotion = useReducedMotion();
  const pager = useRef<ScrollView>(null);

  const slides = useMemo<Slide[]>(() => {
    const games: Slide[] = [];

    for (const game of spotlight?.fresh ?? []) {
      games.push({
        kind: 'game',
        key: game.game.id,
        game,
        badge: 'New',
        spoken: `New: ${game.game.title}${game.game.developer ? `, by ${game.game.developer}` : ''}`,
      });
    }

    const awaited = spotlight?.awaited;
    if (awaited) {
      games.push({
        kind: 'game',
        key: awaited.game.id,
        game: awaited,
        badge: countdownLabel(awaited.releasedAt, awaited.precision, now),
        spoken: `Coming soon: ${awaited.game.title}${
          awaited.game.developer ? `, by ${awaited.game.developer}` : ''
        }, ${countdownSpoken(awaited.releasedAt, awaited.precision, now)}`,
      });
    }

    return [
      ...games,
      {
        kind: 'calendar',
        key: 'calendar',
        badge: 'Calendar',
        spoken: `Release calendar, ${monthLabel(now)}`,
      },
    ];
  }, [spotlight, now]);

  const count = slides.length;
  const [index, setIndex] = useState(0);
  /** Off for good once somebody drags the slider themselves. */
  const [handsOff, setHandsOff] = useState(true);

  const [focused, setFocused] = useState(true);
  const [foreground, setForeground] = useState(AppState.currentState === 'active');
  const [screenReader, setScreenReader] = useState(false);

  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, [])
  );

  useEffect(() => {
    const appState = AppState.addEventListener('change', (state) =>
      setForeground(state === 'active')
    );
    let alive = true;
    void AccessibilityInfo.isScreenReaderEnabled().then((on) => {
      if (alive) setScreenReader(on);
    });
    const reader = AccessibilityInfo.addEventListener('screenReaderChanged', setScreenReader);
    return () => {
      alive = false;
      appState.remove();
      reader.remove();
    };
  }, []);

  /* The slides can arrive after the slider is already on its last one (the
     calendar alone, then four): the page it shows is the one that exists. */
  const current = Math.min(index, count - 1);

  const moving =
    handsOff &&
    count > 1 &&
    !loading &&
    !reduceMotion &&
    !screenReader &&
    focused &&
    foreground &&
    !away;

  useEffect(() => {
    if (!moving) return;
    const timer = setTimeout(() => {
      const next = (current + 1) % count;
      pager.current?.scrollTo({ x: next * width, animated: true });
      setIndex(next);
    }, SLIDE.interval);
    return () => clearTimeout(timer);
  }, [moving, current, count, width]);

  const settle = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      const page = Math.round(event.nativeEvent.contentOffset.x / Math.max(1, width));
      setIndex(Math.max(0, Math.min(count - 1, page)));
    },
    [width, count]
  );

  if (loading && !spotlight) {
    return (
      <View
        style={{ width: windowWidth, height }}
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants">
        <Skeleton width="100%" height={height} radius={Radius.none} />
      </View>
    );
  }

  return (
    <View style={[styles.frame, { height }]}>
      <ScrollView
        ref={pager}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        /* Its own gesture: a sideways drag pages, a vertical one is the page's. */
        nestedScrollEnabled
        decelerationRate="fast"
        scrollEventThrottle={32}
        onScrollBeginDrag={() => setHandsOff(false)}
        onMomentumScrollEnd={settle}>
        {slides.map((slide, position) =>
          slide.kind === 'game' ? (
            <GameSlide
              key={slide.key}
              slide={slide}
              width={width}
              height={height}
              position={position}
              count={count}
            />
          ) : (
            <CalendarSlide
              key={slide.key}
              slide={slide}
              width={width}
              height={height}
              position={position}
              count={count}
              now={now}
              releaseDays={spotlight?.releaseDays ?? EMPTY_DAYS}
            />
          )
        )}
      </ScrollView>

      {count > 1 && (
        <View style={styles.segments} pointerEvents="none">
          {slides.map((slide, position) => (
            <Segment
              key={slide.key}
              state={position < current ? 'done' : position === current ? 'now' : 'next'}
              filling={moving && position === current}
            />
          ))}
        </View>
      )}
    </View>
  );
});

const EMPTY_DAYS: readonly number[] = [];

/** The current segment filling as its slide waits: a timer you can see. */
const FILL = css.keyframes({
  from: { transform: [{ scaleX: 0 }] },
  to: { transform: [{ scaleX: 1 }] },
});

/**
 * One of the bars at the slider's foot.
 *
 * Lit when its slide is the one showing. While the slider is moving by itself
 * the lit bar fills from its leading edge over the slide's six seconds — a CSS
 * animation, so it runs on the UI thread and its resting state (a full bar) is
 * the plain style React holds.
 */
function Segment({ state, filling }: { state: 'done' | 'now' | 'next'; filling: boolean }) {
  const theme = useTheme();
  const lit = theme.text;

  return (
    <View style={[styles.segment, { backgroundColor: withAlpha(lit, SEGMENT_REST) }]}>
      {state === 'now' && (
        <Animated.View
          style={[
            styles.segmentFill,
            { backgroundColor: lit },
            filling && {
              animationName: FILL,
              animationDuration: SLIDE.interval,
              animationTimingFunction: 'linear',
            },
          ]}
        />
      )}
    </View>
  );
}

/** A bar that is not the current one: the ink at a third, as the reference's are. */
const SEGMENT_REST = 0.32;

type SlideFrameProps = {
  width: number;
  height: number;
  position: number;
  count: number;
};

/** The words set on a slide's art: a name in two lines and one quiet line under it. */
function SlideText({ title, line }: { title: string; line: string | null }) {
  const theme = useTheme();

  return (
    <View style={styles.text} pointerEvents="none">
      <Text variant="h2" numberOfLines={2} style={[styles.name, { textShadowColor: theme.scrim }]}>
        {title}
      </Text>
      {!!line && (
        /* The ink at 84%, not a grey: the scrim under it is the art's own
           darkened colour, and a neutral grey on that reads as a foreign
           object. 9:1 or better over the scrim's foot. */
        <Text variant="bodySmall" numberOfLines={1} style={{ color: withAlpha(theme.text, 0.84) }}>
          {line}
        </Text>
      )}
    </View>
  );
}

const SCRIM = slideScrimStops();
const SCRIM_LOCATIONS = SCRIM.map((stop) => stop.at) as unknown as readonly [
  number,
  number,
  ...number[],
];

/**
 * The darkening the words stand on: `color` from nothing at its top to 88% at
 * the foot of the slide (`slideScrimAt`, which says what it guarantees). Every
 * stop is the colour at an explicit alpha, never `'transparent'`, which
 * Android's gradient fades through black.
 */
function SlideScrim({ color, height }: { color: string; height: number }) {
  const colors = useMemo(
    () =>
      SCRIM.map((stop) => withAlpha(color, stop.alpha)) as unknown as readonly [
        string,
        string,
        ...string[],
      ],
    [color]
  );

  return (
    <LinearGradient
      colors={colors}
      locations={SCRIM_LOCATIONS}
      style={[styles.scrim, { height: Math.round(height * SLIDE.scrim) }]}
      pointerEvents="none"
    />
  );
}

function SlideBadge({ label }: { label: string }) {
  const theme = useTheme();

  return (
    <View
      style={[styles.badge, { backgroundColor: withAlpha(theme.shadowInk, 0.82) }]}
      pointerEvents="none">
      <Text variant="h6" style={{ color: theme.text }}>
        {label}
      </Text>
    </View>
  );
}

function GameSlide({
  slide,
  width,
  height,
  position,
  count,
}: SlideFrameProps & { slide: Extract<Slide, { kind: 'game' }> }) {
  const router = useRouter();
  const theme = useTheme();
  const { game, art } = slide.game;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${slide.spoken}. Slide ${position + 1} of ${count}. Opens the game.`}
      onPress={() => router.push({ pathname: '/game/[id]', params: { id: game.id } })}
      scaleTo={0.99}
      style={StyleSheet.flatten([{ width, height, backgroundColor: theme.surfaceElevated }])}>
      <Image
        source={{ uri: art }}
        style={styles.art}
        contentFit="cover"
        /* Key art is composed for its upper middle; the lower third is where
           the name is set and the scrim falls. */
        contentPosition={{ top: '30%', left: '50%' }}
        transition={220}
        cachePolicy="memory-disk"
        recyclingKey={art}
        accessibilityIgnoresInvertColors
      />
      <SlideScrim color={Palette.shadowInk} height={height} />
      <SlideBadge label={slide.badge} />
      <SlideText title={game.title} line={game.developer} />
    </PressableScale>
  );
}

/**
 * The fourth slide: the month, as the calendar screen draws one — five rows of
 * numbered days — with the days a notable game is out on lit, and today ringed.
 *
 * Drawn, not a picture: there is no artwork of "a calendar" that is true, and
 * this one is. The days it lights are the ones the spotlight's own request
 * found, so it costs nothing and never disagrees with the slides beside it.
 */
function CalendarSlide({
  slide,
  width,
  height,
  position,
  count,
  now,
  releaseDays,
}: SlideFrameProps & {
  slide: Extract<Slide, { kind: 'calendar' }>;
  now: number;
  releaseDays: readonly number[];
}) {
  const router = useRouter();
  const theme = useTheme();

  const today = new Date(now * 1000);
  const year = today.getUTCFullYear();
  const month = today.getUTCMonth();
  const date = today.getUTCDate();
  const rows = useMemo(() => monthRows(year, month), [year, month]);
  const lit = useMemo(() => new Set(releaseDays), [releaseDays]);

  const cell = (width - SLIDE.inset * 2 - DAY_GAP * (MONTH_COLUMNS - 1)) / MONTH_COLUMNS;
  const cellHeight = (height - DAY_TOP * 2 - DAY_GAP * (rows.length - 1)) / rows.length;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`${slide.spoken}${
        releaseDays.length > 0
          ? `, ${releaseDays.length} ${releaseDays.length === 1 ? 'day' : 'days'} with a notable release`
          : ''
      }. Slide ${position + 1} of ${count}. Opens the calendar.`}
      onPress={() => router.push('/calendar')}
      scaleTo={0.99}
      style={StyleSheet.flatten([{ width, height, backgroundColor: theme.surface }])}>
      <View style={styles.month} pointerEvents="none">
        {rows.map((row, rowIndex) => (
          <View key={rowIndex} style={styles.week}>
            {row.map((day, column) => {
              if (day === null) {
                return <View key={column} style={{ width: cell, height: cellHeight }} />;
              }
              const release = lit.has(day);
              return (
                <View
                  key={column}
                  style={[
                    styles.day,
                    {
                      width: cell,
                      height: cellHeight,
                      backgroundColor: withAlpha(theme.text, release ? DAY_LIT : DAY_REST),
                      borderColor: day === date ? theme.primaryText : withAlpha(theme.text, 0),
                    },
                  ]}>
                  <Text
                    variant="bodySmall"
                    style={[
                      styles.dayNumber,
                      { color: release || day === date ? theme.text : theme.textMuted },
                    ]}>
                    {day}
                  </Text>
                </View>
              );
            })}
          </View>
        ))}
      </View>

      <SlideScrim color={theme.surface} height={height} />
      <SlideBadge label={slide.badge} />
      <SlideText title="Release calendar" line={monthLabel(now)} />
    </PressableScale>
  );
}

/** Between two days, and from the slide's top and foot to the month. */
const DAY_GAP = 6;
const DAY_TOP = 12;
/** A day's square: the ink at 5%, and at 18% when a notable game is out on it. */
const DAY_REST = 0.05;
const DAY_LIT = 0.18;

const styles = StyleSheet.create({
  frame: { overflow: 'hidden' },
  art: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  badge: {
    position: 'absolute',
    top: SLIDE.badgeTop,
    end: SLIDE.inset,
    paddingHorizontal: Spacing.x8,
    paddingVertical: Spacing.x4,
    borderRadius: Radius.image,
  },
  /* Three quarters of the width: a name that ran under the badge's column
     would read as one line with it. */
  text: {
    position: 'absolute',
    start: SLIDE.inset,
    bottom: SLIDE.segment.bottom + SLIDE.segment.height + SLIDE.textBottom,
    width: '76%',
    gap: Spacing.x4,
  },
  /* A soft shadow under the name, down and blurred: the scrim does the work
     (`slideScrimAt`); this is for a bright patch of art exactly behind a word. */
  name: { textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6 },
  segments: {
    position: 'absolute',
    left: SLIDE.inset,
    right: SLIDE.inset,
    bottom: SLIDE.segment.bottom,
    flexDirection: 'row',
    gap: SLIDE.segment.gap,
  },
  segment: {
    flex: 1,
    height: SLIDE.segment.height,
    borderRadius: Radius.pill,
    overflow: 'hidden',
  },
  segmentFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: Radius.pill,
    transformOrigin: 'left',
  },
  month: {
    position: 'absolute',
    top: DAY_TOP,
    left: SLIDE.inset,
    right: SLIDE.inset,
    gap: DAY_GAP,
  },
  week: { flexDirection: 'row', gap: DAY_GAP },
  day: {
    borderRadius: Radius.image,
    borderWidth: 1.5,
    paddingTop: 3,
    paddingLeft: 5,
  },
  dayNumber: { fontVariant: ['tabular-nums'] },
});
