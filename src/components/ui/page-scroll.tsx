import { useCallback, useEffect, type Component, type Ref } from 'react';
import {
  FlatList,
  ScrollView,
  SectionList,
  type DefaultSectionT,
  type FlatListProps,
  type ScrollViewProps,
  type SectionListProps,
} from 'react-native';
import { useAnimatedRef, useScrollOffset } from 'react-native-reanimated';

import { useScreenChrome } from '@/hooks/use-screen-chrome';

/**
 * A page's main scroller, which tells the page's top bar how far it has gone.
 *
 * `<FrostedTopBar>` is clear at the top of a page and frost once the page has
 * moved; over artwork its discs leave with the art and a bar comes in after
 * it. All of that hangs on one number — the scroll offset — and these are how
 * it gets from the list to the bar: drop-in `ScrollView`, `FlatList` and
 * `SectionList`, each of which writes its offset to the `scrollY` that
 * `<Screen>` publishes (`hooks/use-screen-chrome`).
 *
 * ```tsx
 * <Screen insetHeader topBar={<FrostedTopBar back title="Settings" />}>
 *   <PageScrollView>…</PageScrollView>
 * </Screen>
 * ```
 *
 * **A screen whose page scrolls must use one**, or its bar never learns the
 * page moved: it stays clear, and rows slide under a title with nothing
 * behind it. A screen that does not scroll needs none.
 *
 * ## They are still plain lists
 *
 * Not `Animated.FlatList`. That wraps every cell so cells can animate, which
 * no list here does, and eleven screens were once `Animated` lists only to
 * carry a scroll handler. `useScrollOffset` needs a ref it can read on the UI
 * thread and nothing else: it registers for the native scroll event by the
 * scroller's tag, so the offset is written by a worklet, never crosses to the
 * JS thread, and a scrolling page still causes no renders.
 *
 * ## One per page, and it is the page's
 *
 * Every page scroller under a `<Screen>` writes the same value, so only the
 * scroller that *is* the page takes one of these — never a rail, a sheet's
 * list or a menu. A screen that swaps lists (tabs with a list each) is fine:
 * a list that mounts starts at its top and says so, so the bar is not left
 * frosted over a list that has not moved.
 */

type Scroller = Component | null;

function forward<T>(ref: Ref<T> | undefined, node: T | null) {
  if (typeof ref === 'function') ref(node);
  else if (ref) ref.current = node;
}

/**
 * The ref that makes a scroller the page's. For a scroller these components do
 * not cover; must be called under a `<Screen>`, which is why a route cannot
 * call it for the list it renders itself.
 *
 * @param forwarded the caller's own ref to the scroller, kept working.
 */
export function usePageScroll<T extends Scroller>(forwarded?: Ref<T>) {
  const offset = useScreenChrome()?.scrollY;
  const scroller = useAnimatedRef<Component>();
  useScrollOffset(scroller, offset);

  /* A list that has just mounted is at its top, and a native scroller says
     nothing until it moves — without this, the bar would keep the offset of
     whichever list was here before. */
  useEffect(() => {
    offset?.set(0);
  }, [offset]);

  return useCallback(
    (node: T | null) => {
      scroller(node);
      forward(forwarded, node);
    },
    [scroller, forwarded]
  );
}

/**
 * The page scroller's `onContentSizeChange`, which also tells the page its
 * content has moved (`ScreenChrome.layout`) — keeping the caller's own handler.
 */
function usePageContentSize(own?: (width: number, height: number) => void) {
  const layout = useScreenChrome()?.layout;
  return useCallback(
    (width: number, height: number) => {
      layout?.set(layout.get() + 1);
      own?.(width, height);
    },
    [layout, own]
  );
}

/*
 * `scrollEventThrottle` is 16 unless the caller says otherwise: one event a
 * frame. iOS sends a scroll event only when the gesture ends without it; it is
 * harmless on Android.
 */

export function PageScrollView({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  ...props
}: ScrollViewProps & { ref?: Ref<ScrollView> }) {
  const setRef = usePageScroll(ref);
  const sized = usePageContentSize(onContentSizeChange);
  return (
    <ScrollView
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...props}
    />
  );
}

export function PageFlatList<ItemT>({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  ...props
}: FlatListProps<ItemT> & { ref?: Ref<FlatList<ItemT>> }) {
  const setRef = usePageScroll(ref);
  const sized = usePageContentSize(onContentSizeChange);
  return (
    <FlatList
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...props}
    />
  );
}

export function PageSectionList<ItemT, SectionT = DefaultSectionT>({
  ref,
  scrollEventThrottle = 16,
  onContentSizeChange,
  ...props
}: SectionListProps<ItemT, SectionT> & { ref?: Ref<SectionList<ItemT, SectionT>> }) {
  const setRef = usePageScroll(ref);
  const sized = usePageContentSize(onContentSizeChange);
  return (
    <SectionList
      ref={setRef}
      scrollEventThrottle={scrollEventThrottle}
      onContentSizeChange={sized}
      {...props}
    />
  );
}
