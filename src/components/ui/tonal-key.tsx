import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { filledRoles } from '@/lib/filled';

/**
 * Where a key sits in its group, which is the only thing that decides its shape.
 *
 * `solo` exists because a group can be built from a list that shortens — if it
 * ever came down to one key, a lone half-round shape would look like a
 * rendering fault rather than a button.
 */
export type KeyPosition = 'start' | 'middle' | 'end' | 'solo';

/**
 * The corner where two keys meet, and the gap they meet across — Material 3's
 * connected button group: only the *outer* edges of the group are round,
 * because they are the edges of the object; every internal edge is nearly
 * square, so two keys across a 4dp gap read as a seam in one bar.
 */
const GROUP_END = Radius.pill;
const GROUP_SEAM = Radius.lg;
export const KEY_GROUP_GAP = Spacing.x4;

/** 52: past both tap floors with the glyph as the whole control. */
export const KEY_HEIGHT = 52;

export function keyCorners(position: KeyPosition) {
  const start = position === 'start' || position === 'solo';
  const end = position === 'end' || position === 'solo';
  return {
    borderTopLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderBottomLeftRadius: start ? GROUP_END : GROUP_SEAM,
    borderTopRightRadius: end ? GROUP_END : GROUP_SEAM,
    borderBottomRightRadius: end ? GROUP_END : GROUP_SEAM,
  };
}

/** A key's place in a group of `count`, by its index. */
export function keyPosition(index: number, count: number): KeyPosition {
  if (count === 1) return 'solo';
  if (index === 0) return 'start';
  if (index === count - 1) return 'end';
  return 'middle';
}

/**
 * One key of a game's own action group — the game page's Favourite /
 * Wishlist / Progress / Collect, and Surprise Me's Backlog / Next, which are
 * the same object by the owner's direction (2026-10-16).
 *
 * Off, it is the page's neutral `surfaceContainerHigh` with an outline glyph
 * in `onSurfaceVariant` — no colour until it has been used. On, it fills with
 * the game's colour, as the review button is, and its glyph turns solid in
 * the fill's own `onPrimary` (`filledRoles`) — SimpMusic's rule, the owner's
 * direction (2026-10-17). It was `primaryContainer`, a dark tone of the hue.
 * A key that is an act rather than a state carries no `active` and never
 * lights.
 */
export function TonalKey({
  icon,
  outline,
  active = false,
  busy = false,
  label,
  onPress,
  position,
  style,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  /** The glyph at rest; `icon` once lit. Defaults to `icon`. */
  outline?: keyof typeof Ionicons.glyphMap;
  active?: boolean;
  busy?: boolean;
  label: string;
  onPress: () => void;
  position: KeyPosition;
  style?: StyleProp<ViewStyle>;
}) {
  const accent = useAccent();
  const filled = filledRoles(accent);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, busy, disabled: busy }}
      disabled={busy}
      onPress={onPress}
      scaleTo={0.92}
      style={StyleSheet.flatten([
        styles.key,
        keyCorners(position),
        /* Raised when lit: a solid block of the accent where depth is the only
           edge it has. */
        active ? Elevation.raised : Elevation.none,
        {
          backgroundColor: active ? filled.fill : accent.m3.surfaceContainerHigh,
          borderColor: active ? filled.fill : accent.m3.surfaceContainerHigh,
        },
        busy && styles.busy,
        style,
      ])}>
      <Ionicons
        name={active ? icon : (outline ?? icon)}
        size={22}
        color={active ? filled.ink : accent.m3.onSurfaceVariant}
      />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  key: {
    minHeight: KEY_HEIGHT,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* A brief dim rather than a spinner: one round trip. */
  busy: { opacity: 0.5 },
});
