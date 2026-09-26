import { StyleSheet } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * The room changing colour, instead of being replaced.
 *
 * Every screen in this app that is about one game takes that game's colour. This
 * is the only one you *deal through*, so it is the only one where the colour has
 * to get from one game to the next — and it used to cut, hard, in a single frame.
 *
 * ## Why this is one colour and not twenty-three
 *
 * The obvious reading of "animate the palette" is to interpolate all of
 * `accentRoles` and thread the result through every consumer. That would be a
 * rewrite of the app's colour system to serve one screen, and it is unnecessary:
 * an audit of what is actually tinted here found that **`accent.page` is the only
 * role visible across a deal.** The facts pill, the round buttons, the credit
 * line and the two support cards all live inside `<SurpriseReveal>`, which is
 * keyed on the game — they remount and are already crossfaded by `useCrossfade`.
 * The swipe edges are at opacity 0 at the instant the game changes.
 *
 * So: one colour, two shared values and a progress. The rest was already right.
 *
 * ## Why it is the `backdrop` and not `background`
 *
 * `<Screen background>` is a plain prop on the `<BlurTargetView>` — animating it
 * would mean re-rendering the screen every frame. The `backdrop` slot renders
 * *inside* that same view and above the fill, which is exactly where an opaque
 * animated layer belongs: Android's blur samples that subtree, so the frosted top
 * bar picks the new colour up for free. The caveat in `background`'s own docblock
 * is about a *translucent* backdrop leaving the wrong colour underneath; this one
 * is opaque, and `background={accent.page}` stays as the floor for the first
 * frame.
 *
 * ## Why LAB
 *
 * Both endpoints are M3 neutral tone 10 at raised chroma, seeded from different
 * hues. RGB interpolation between two dark chromatic near-blacks routes through a
 * muddy mid; LAB does not. It is also the space the colour system already reasons
 * in — `dynamic-color.ts` exists because HCT is perceptually uniform and HSL is
 * not, and this is the same argument one layer up.
 */
export function SurprisePageWash({
  from,
  to,
  progress,
}: {
  /** The colour being left. */
  from: SharedValue<string>;
  /** The colour being arrived at. */
  to: SharedValue<string>;
  /** 0 at the old colour, 1 at the new one. */
  progress: SharedValue<number>;
}) {
  const style = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(progress.get(), RANGE, [from.get(), to.get()], 'LAB'),
  }));

  /* `StyleSheet.absoluteFill`, not `absoluteFillObject` — the latter is gone from
     the RN types on SDK 57. */
  return <Animated.View style={[StyleSheet.absoluteFill, style]} pointerEvents="none" />;
}

/** Module scope, so the worklet captures one stable array for the app's lifetime. */
const RANGE = [0, 1];
