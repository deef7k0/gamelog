import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { Elevation, FontFamily } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type AvatarProps = {
  uri?: string | null;
  /** Used for the initial when there is no image. */
  name?: string | null;
  size?: number;
};

/** Deterministic hue per user so the fallback colour is stable across renders. */
function hueFor(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) % 360;
  }
  return hash;
}

export function Avatar({ uri, name, size = 40 }: AvatarProps) {
  const theme = useTheme();
  const label = (name ?? '?').trim();
  const initial = label.charAt(0).toUpperCase() || '?';

  /*
   * The shadow lives on an outer view because the circle is made by clipping,
   * and Android's elevation does not survive `overflow: 'hidden'`. The outer
   * view needs the radius and a fill too, or the shadow is cast as a square.
   * See DESIGN.md § 6.3.
   */
  const box = { width: size, height: size, borderRadius: size / 2 };

  if (uri) {
    return (
      <View style={[box, Elevation.card, { backgroundColor: theme.surfaceElevated }]}>
        <Image
          source={{ uri }}
          style={[styles.base, box]}
          contentFit="cover"
          transition={150}
          accessibilityIgnoresInvertColors
        />
      </View>
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        Elevation.card,
        box,
        {
          // 28% lightness sits between `surface` and `surfaceElevated`, so a generated
          // avatar reads as part of the same dark room as everything around it.
          backgroundColor: `hsl(${hueFor(label)}, 45%, 28%)`,
        },
      ]}>
      <Text style={[styles.initial, { fontSize: size * 0.42, color: theme.text }]}>{initial}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fallback: { alignItems: 'center', justifyContent: 'center' },
  initial: { fontFamily: FontFamily.semibold },
});
