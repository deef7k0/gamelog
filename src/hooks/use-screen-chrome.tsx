import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import type { View } from 'react-native';
import {
  useAnimatedScrollHandler,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * What a floating top bar needs to know about the page underneath it.
 *
 * Both fields are published by `<Screen>` and read by `<FrostedTopBar>`, which
 * is rendered through the `topBar` slot and therefore sits inside this provider
 * even though the *screen* creates the element.
 *
 *  - **`blurTarget`** — the view whose pixels the bar blurs. iOS and the web
 *    sample whatever is behind a translucent layer for free; Android does not,
 *    and `expo-blur` on SDK 57 makes that explicit: a `<BlurView>` with no
 *    `blurTarget` silently downgrades to `blurMethod: 'none'` and renders a flat
 *    translucent slab. So `<Screen>` wraps its content in `<BlurTargetView>` and
 *    hands the ref down here.
 *  - **`modal`** — whether this page is a sheet, which changes where the bar's
 *    content sits. See `useTopBarInset`.
 *
 * Scroll is deliberately *not* here: the offset is created by the screen with
 * `useTopBarScroll()` and passed to the bar as a prop, because the screen is
 * above `<Screen>` in the tree and could not read a context published below it.
 *
 * ## Why the target is state and not a `useRef`
 *
 * `BlurView` resolves the target in `componentDidMount` and again in
 * `componentDidUpdate`, comparing `prevProps.blurTarget?.current` against the
 * current one. A plain `useRef` is filled *after* the first render and never
 * triggers a second, so the comparison never runs and the blur stays
 * unconfigured for the life of the screen. Holding the native view in state
 * forces the one extra render that lets `componentDidUpdate` see it.
 */
export type ScreenChrome = {
  /** The view `<FrostedTopBar>` blurs. Android only; inert elsewhere. */
  blurTarget: { current: View | null };
  /** This page is presented as a modal. */
  modal: boolean;
};

const ScreenChromeContext = createContext<ScreenChrome | null>(null);

export type ScreenChromeProviderProps = {
  modal?: boolean;
  children: (chrome: ScreenChrome & { blurTargetRef: { current: View | null } }) => ReactNode;
};

/**
 * Owns the chrome state for one page.
 *
 * A render prop rather than the usual wrapper, because `<Screen>` needs the
 * setter for the blur target *and* has to render the provider above both the
 * target and the bar. Nothing else should mount this — it is `<Screen>`'s
 * internals, exposed only so that file stays readable.
 */
export function ScreenChromeProvider({ modal = false, children }: ScreenChromeProviderProps) {
  const [target, setTarget] = useState<View | null>(null);

  /*
   * A ref object that is also a subscription.
   *
   * `BlurTargetView` types its `ref` as a `RefObject`, not a callback, so the
   * usual "callback ref that calls setState" is not available. This is the same
   * thing wearing the right shape: React assigns `.current` during commit, the
   * setter turns that into a state update, and the re-render is what lets
   * `BlurView.componentDidUpdate` notice the target exists.
   *
   * Built once. A new object each render would be re-attached every render,
   * which would call `setTarget` in a loop.
   */
  const blurTargetRef = useMemo(() => {
    let current: View | null = null;
    return {
      get current() {
        return current;
      },
      set current(view: View | null) {
        current = view;
        setTarget(view);
      },
    };
  }, []);

  /* A fresh object each time the native view changes, so `BlurView`'s
     `prevProps.blurTarget?.current !== this.props.blurTarget?.current` check
     actually fires. Handing it `blurTargetRef` itself would make that
     comparison a tautology and the blur would never configure. */
  const chrome = useMemo<ScreenChrome>(
    () => ({ blurTarget: { current: target }, modal }),
    [target, modal]
  );

  return (
    <ScreenChromeContext.Provider value={chrome}>
      {children({ ...chrome, blurTargetRef })}
    </ScreenChromeContext.Provider>
  );
}

/**
 * The chrome for the enclosing `<Screen>`, or `null` outside one.
 *
 * Null is a supported answer: a bar rendered outside a `<Screen>` still draws,
 * it just falls back to a plain translucent tint on Android.
 */
export function useScreenChrome(): ScreenChrome | null {
  return useContext(ScreenChromeContext);
}

export type TopBarScroll = {
  /** Live offset in dp. Hand it to `<FrostedTopBar scrollY>`. */
  scrollY: SharedValue<number>;
  /** Attach to the page's main scroller. Needs `scrollEventThrottle={16}`. */
  onScroll: ReturnType<typeof useAnimatedScrollHandler>;
};

/**
 * The scroll offset a top bar hides against.
 *
 * Called by the *screen*, and wired to two places:
 *
 * ```tsx
 * const { scrollY, onScroll } = useTopBarScroll();
 *
 * <Screen insetHeader topBar={<FrostedTopBar title="Library" back scrollY={scrollY} />}>
 *   <Animated.FlatList onScroll={onScroll} scrollEventThrottle={16} … />
 * </Screen>
 * ```
 *
 * `scrollEventThrottle={16}` is required on iOS and harmless on Android; without
 * it iOS delivers scroll events only when the gesture ends and the bar appears
 * to lag by a whole flick.
 *
 * The handler is a worklet, so the offset never crosses to the JS thread and a
 * scrolling page causes exactly zero re-renders.
 *
 * One per screen — the bar follows the page's main scroller. A screen with a
 * horizontal rail inside it does not wire the rail up.
 */
export function useTopBarScroll(): TopBarScroll {
  const scrollY = useSharedValue(0);

  const onScroll = useAnimatedScrollHandler(
    {
      onScroll: (event) => {
        'worklet';
        scrollY.set(event.contentOffset.y);
      },
    },
    [scrollY]
  );

  return { scrollY, onScroll };
}
