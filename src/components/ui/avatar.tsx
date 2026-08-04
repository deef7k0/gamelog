import { Image } from 'expo-image';
import { StyleSheet, Text, View } from 'react-native';

import { FontFamily } from '@/constants/theme';
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

  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[styles.base, { width: size, height: size, borderRadius: size / 2 }]}
        contentFit="cover"
        transition={150}
        accessibilityIgnoresInvertColors
      />
    );
  }

  return (
    <View
      style={[
        styles.base,
        styles.fallback,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: `hsl(${hueFor(label)}, 45%, ${theme.background === '#FFFFFF' ? 82 : 28}%)`,
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
