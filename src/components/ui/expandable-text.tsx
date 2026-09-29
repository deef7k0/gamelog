import { useEffect, useState } from 'react';
import {
  Platform,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextStyle,
} from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { useSectionMetrics } from '@/components/ui/section';
import { Text, type TextVariant } from '@/components/ui/text';
import { TapTarget, Type, type ThemeColor } from '@/constants/theme';

/**
 * The reference's timing, from `DescriptionView.kt`: 250ms on Compose's
 * `FastOutSlowInEasing` — quick to leave, slow to land.
 */
const TIMING = { duration: 250, easing: Easing.bezier(0.4, 0, 0.2, 1) };

/** The More / Less word is one short line; the finger gets the platform floor. */
const TOGGLE_SLOP = { top: 10, bottom: Math.max(10, TapTarget / 2), left: 8, right: 16 };

type Heights = { full: number; collapsed: number };

export type ExpandableTextProps = {
  children: string;
  /** Lines shown before it opens. */
  lines: number;
  variant?: TextVariant;
  color?: ThemeColor;
  style?: StyleProp<TextStyle>;
  /** `**bold**` and `*italic*`, through `<RichText>`, for text someone wrote. */
  rich?: boolean;
  /**
   * Controlled: a parent that is itself the thing you press — a whole card that
   * opens — decides. The More / Less is still drawn, as a word rather than a
   * button: with no ellipsis at the clip it is the only sign there is more.
   * Omit it for the reference's own control under the text.
   */
  expanded?: boolean;
  /** Whether there is more than `lines` of it — for a controlled parent's press. */
  onOverflowChange?: (overflows: boolean) => void;
  /** From the text down to its More / Less. The reference's 8, to scale, by default. */
  toggleGap?: number;
  /** What a screen reader says the text is, for the More / Less label. */
  subject?: string;
};

/**
 * Text that opens in place, the way SimpMusic's description card does.
 *
 * ## The height moves, the text does not
 *
 * The whole text is always laid out; what animates is the height of the window
 * onto it, from the bottom of line `lines` to the bottom of the last line, with
 * the rest clipped. It is the reference's own method, and the note in its source
 * is why: animating the line clamp instead steps a whole line per frame, and
 * swapping the clamp under a size animation cuts the text off before the box has
 * caught up. Both heights are read from the text's own layout, so they are
 * exact at whatever width it is given; until that first layout the window is
 * `lines` line-heights tall — the same thing, for text of more than `lines` —
 * so a long text never flashes open on its first frame.
 *
 * Whatever holds it grows with it, a frame at a time — that is the card
 * expanding. Under the system's reduce-motion setting it opens at once.
 *
 * The More / Less shows until the text is measured, and goes if it fits, as
 * the reference's does: long text — the common case — never jumps.
 *
 * **The web build reports no text layout** (react-native-web has no
 * `onTextLayout`), so there is nothing to measure or animate there: the clamp
 * simply toggles, and the More is always offered.
 */
export function ExpandableText({
  children,
  lines,
  variant = 'body',
  color = 'textSecondary',
  style,
  rich = false,
  expanded: controlled,
  onOverflowChange,
  toggleGap,
  subject,
}: ExpandableTextProps) {
  const metrics = useSectionMetrics();
  const [own, setOwn] = useState(false);
  const expanded = controlled ?? own;
  const [heights, setHeights] = useState<Heights | null>(null);
  /* Every step but one sets a line height; that one gets the usual 1.4. */
  const step: { fontSize: number; lineHeight?: number } = Type[variant];
  const height = useSharedValue(lines * (step.lineHeight ?? Math.round(step.fontSize * 1.4)));

  /* Every change after the first measurement animates: opening, closing, and
     the text itself changing. The first is set in `onTextLayout`, unanimated. */
  useEffect(() => {
    if (heights) height.set(withTiming(expanded ? heights.full : heights.collapsed, TIMING));
  }, [expanded, heights, height]);

  const windowStyle = useAnimatedStyle(() => ({ height: height.get() }));

  function onTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    const measured = event.nativeEvent.lines;
    if (measured.length === 0) return;
    const bottom = (index: number) => measured[index].y + measured[index].height;
    const next = {
      full: bottom(measured.length - 1),
      collapsed: bottom(Math.min(lines, measured.length) - 1),
    };
    if (heights && heights.full === next.full && heights.collapsed === next.collapsed) return;
    if (!heights) height.set(expanded ? next.full : next.collapsed);
    setHeights(next);
    onOverflowChange?.(next.full > next.collapsed);
  }

  const Body = rich ? RichText : Text;
  const web = Platform.OS === 'web';
  const overflows = web || !heights || heights.full > heights.collapsed;
  const gap = { marginTop: toggleGap ?? metrics.cardGap };
  /* The reference's `labelSmall` in light grey: `itemTitle`, 13 semibold, in
     `controlInk` — the soft white every action word in the app is set in. */
  const word = (
    <Text variant="itemTitle" color="controlInk">
      {expanded ? 'Less' : 'More'}
    </Text>
  );

  /* One block, so a card's own gap falls around it and never between the text
     and its More / Less, which the reference keeps at 8. */
  return (
    <View>
      {web ? (
        <Body
          variant={variant}
          color={color}
          style={style}
          numberOfLines={expanded ? undefined : lines}>
          {children}
        </Body>
      ) : (
        <Animated.View style={[styles.window, windowStyle]}>
          <Body variant={variant} color={color} style={style} onTextLayout={onTextLayout}>
            {children}
          </Body>
        </Animated.View>
      )}

      {overflows &&
        (controlled === undefined ? (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={
              expanded
                ? `Show less${subject ? ` of ${subject}` : ''}`
                : `Read all${subject ? ` of ${subject}` : ''}`
            }
            onPress={() => setOwn((open) => !open)}
            hitSlop={TOGGLE_SLOP}
            scaleTo={0.96}
            style={StyleSheet.flatten([styles.toggle, gap])}>
            {word}
          </PressableScale>
        ) : (
          /* The parent is the button and announces its own state. */
          <View
            style={[styles.toggle, gap]}
            accessibilityElementsHidden
            importantForAccessibility="no-hide-descendants">
            {word}
          </View>
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  toggle: { alignSelf: 'flex-start' },
});
