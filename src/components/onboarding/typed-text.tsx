import { useEffect, useRef, useState } from 'react';
import type { TextStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

import { usePoster } from '@/components/onboarding/poster-kit';
import { Text, type TextVariant } from '@/components/ui/text';
import { withAlpha } from '@/constants/theme';
import { lettersShown } from '@/lib/onboarding';

export type TypedTextProps = {
  text: string;
  variant?: TextVariant;
  style?: TextStyle | TextStyle[];
  /** Show the whole line now — the reader tapped to hurry it. */
  complete?: boolean;
  /** Called once, when the last letter is on screen. */
  onDone?: () => void;
  maxFontSizeMultiplier?: number;
};

/**
 * A line that types itself out, a letter at a time — the owner's reference,
 * and their correction of the first build (2026-10-15): "every letter must be
 * typed… letter per letter, make it fast too… remove the phone vibration".
 *
 * ## Smooth, because it is timed by the clock and not by a chain of timers
 *
 * Each frame asks how long it has been since the line began and shows that
 * many letters (`lettersShown`: one every `TYPE_MS`, no pauses, no jitter). A
 * frame that arrives late shows two letters instead of falling behind, so the
 * line always finishes on time and never stutters into word-sized jumps the
 * way a chain of `setTimeout`s does once the JS thread is busy.
 *
 * ## The line never reflows while it types
 *
 * The whole line is laid out from the first frame, and the part not yet typed
 * is drawn in a colour with no alpha. Every word is already where it will end;
 * the ink just arrives.
 *
 * **That colour is not `transparent`, and it must not be.** On Android the
 * renderer stores "no colour set" as `0` (`HostPlatformColor::UndefinedColor`),
 * and `transparent` is also `0` — so a nested span coloured `transparent` is
 * read as uncoloured, inherits the headline's ink, and the whole line shows at
 * once. That is exactly what the first build did on a phone. `withAlpha(ink,
 * 0)` is the same invisible colour with its RGB kept, which is never `0`.
 *
 * Under Reduce Motion the line is simply there. A screen reader is given the
 * whole line as the label from the start.
 */
export function TypedText({
  text,
  variant = 'posterHeadline',
  style,
  complete = false,
  onDone,
  maxFontSizeMultiplier,
}: TypedTextProps) {
  const { ink } = usePoster();
  const reduceMotion = useReducedMotion();
  const [typed, setTyped] = useState(() => (reduceMotion ? text.length : 0));
  const shown = complete || reduceMotion ? text.length : typed;
  const finished = shown >= text.length;

  /* The callback is read from a ref so a parent that passes a fresh arrow every
     render does not restart the typing. */
  const onDoneRef = useRef(onDone);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (finished) onDoneRef.current?.();
  }, [finished]);

  useEffect(() => {
    if (complete || reduceMotion) return;
    const started = Date.now();
    let frame = requestAnimationFrame(function tick() {
      const next = lettersShown(text, Date.now() - started);
      setTyped(next);
      if (next < text.length) frame = requestAnimationFrame(tick);
    });
    return () => cancelAnimationFrame(frame);
  }, [text, complete, reduceMotion]);

  return (
    <Text
      variant={variant}
      style={[{ color: ink }, style]}
      accessibilityRole="header"
      accessibilityLabel={text}
      maxFontSizeMultiplier={maxFontSizeMultiplier}>
      {text.slice(0, shown)}
      <Text variant={variant} style={{ color: withAlpha(ink, 0) }}>
        {text.slice(shown)}
      </Text>
    </Text>
  );
}
