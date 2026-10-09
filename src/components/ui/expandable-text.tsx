import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import {
  Platform,
  Pressable,
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type StyleProp,
  type TextLayoutEventData,
  type TextStyle,
} from 'react-native';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { useSectionMetrics } from '@/components/ui/section';
import { Text, type TextVariant } from '@/components/ui/text';
import { TapTarget, Type, withAlpha, type ThemeColor } from '@/constants/theme';

/**
 * The reference's timing, from `DescriptionView.kt`: 250ms on Compose's
 * `FastOutSlowInEasing` — quick to leave, slow to land.
 */
const TIMING = { duration: 250, easing: Easing.bezier(0.4, 0, 0.2, 1) };

/** The More / Less word is one short line; the finger gets the platform floor. */
const TOGGLE_SLOP = { top: 10, bottom: Math.max(10, TapTarget / 2), left: 8, right: 16 };

type Heights = { full: number; collapsed: number };

/**
 * The closed text dissolving into what is behind it, in place of a More.
 *
 * `to` is the colour behind the text and must be a hex — it is thinned with
 * `withAlpha`, which hands back anything else untouched, and an untouched colour
 * here is a solid bar over the last line. `lines` is how much of the foot of the
 * window the fade covers and `depth` how far it goes: under 1, the last line is
 * still words, which is what says there are more.
 */
export type ExpandableFade = { to: string; lines: number; depth: number };

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
  /**
   * Text standing on a page instead of in a card: no More / Less, the closed
   * text fading out over its last lines, and the text itself what you press.
   * See `ExpandableFade`, and "Two ways to say there is more" below.
   */
  fade?: ExpandableFade;
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
 * ## Two ways to say there is more
 *
 * **In a card, a word.** The More / Less shows until the text is measured, and
 * goes if it fits, as the reference's does: long text — the common case — never
 * jumps.
 *
 * **On a page, a fade** (`fade`). The game page's synopsis stands in its
 * masthead with no card round it, as a film's does in the owner's other
 * reference, Letterboxd: the last line and a quarter of the closed text
 * dissolve into the page, and tapping the text opens it. No word — the fade is
 * the sign, and a control under free-standing text would be the only button in
 * a block of facts. The veil is a child of the window and reads the window's own
 * height, so it lifts as the text opens and comes back as it closes with no
 * clock of its own: it has gone by the time a line and a quarter more is
 * showing. Text that fits has no veil and is not pressable.
 *
 * **The web build reports no text layout** (react-native-web has no
 * `onTextLayout`), so there is nothing to measure or animate there: the clamp
 * simply toggles, and the More — or the veil — is always offered.
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
  fade,
}: ExpandableTextProps) {
  const metrics = useSectionMetrics();
  const [own, setOwn] = useState(false);
  const expanded = controlled ?? own;
  const [heights, setHeights] = useState<Heights | null>(null);
  /* The line the text is really set on: a caller's own `lineHeight` before the
     step's — the window is this many of them tall until the text is measured,
     and a line off by a dp there is a jump on the first layout. Every step but
     one sets a line height; that one gets the usual 1.4. */
  const step: { fontSize: number; lineHeight?: number } = Type[variant];
  const lineHeight =
    StyleSheet.flatten(style)?.lineHeight ?? step.lineHeight ?? Math.round(step.fontSize * 1.4);
  const closed = lines * lineHeight;
  const height = useSharedValue(closed);

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

  const text = web ? (
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
      {fade && overflows && (
        <Veil
          height={height}
          closed={heights?.collapsed ?? closed}
          span={fade.lines * lineHeight}
          to={fade.to}
          depth={fade.depth}
        />
      )}
    </Animated.View>
  );

  if (fade) {
    /* The web has no window to hang the veil in, so it is laid over the foot
       of the clamped text while that is closed. */
    const body = web ? (
      <View>
        {text}
        {!expanded && (
          <View pointerEvents="none" style={[styles.veil, { height: fade.lines * lineHeight }]}>
            <LinearGradient
              colors={[withAlpha(fade.to, 0), withAlpha(fade.to, fade.depth)]}
              style={styles.fill}
            />
          </View>
        )}
      </View>
    ) : (
      text
    );

    if (!overflows || controlled !== undefined) return body;

    /* No label: the text is the label, and a screen reader is read all of it
       whether or not the window is open. The hint and the state say the rest.
       A plain `Pressable` — a paragraph that shrank under the finger would read
       as a card, and the answer to the press is the text opening. */
    return (
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded }}
        accessibilityHint={
          expanded
            ? `Shows less${subject ? ` of ${subject}` : ''}`
            : `Shows all${subject ? ` of ${subject}` : ''}`
        }
        onPress={() => setOwn((open) => !open)}>
        {body}
      </Pressable>
    );
  }

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
      {text}

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

/**
 * The fade over the foot of the window.
 *
 * Its own component so the animated style exists only where a fade was asked
 * for. It reads the window's height rather than keeping time itself: full while
 * the window is closed, gone once the window has opened by the fade's own
 * height, and the same on the way back.
 */
function Veil({
  height,
  closed,
  span,
  to,
  depth,
}: {
  height: SharedValue<number>;
  closed: number;
  span: number;
  to: string;
  depth: number;
}) {
  const lifted = useAnimatedStyle(() => ({
    opacity: interpolate(height.get(), [closed, closed + span], [1, 0], 'clamp'),
  }));

  return (
    <Animated.View pointerEvents="none" style={[styles.veil, { height: span }, lifted]}>
      {/* Ends on the colour at `depth`, starts on the same colour at nothing —
          never `transparent`, which Android fades through black. */}
      <LinearGradient colors={[withAlpha(to, 0), withAlpha(to, depth)]} style={styles.fill} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  window: { overflow: 'hidden' },
  toggle: { alignSelf: 'flex-start' },
  veil: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
});
