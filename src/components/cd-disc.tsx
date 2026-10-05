import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { discTemplateFor } from '@/constants/cd-template';
import type { PlatformKey } from '@/constants/platform-cases';
import { withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type CdDiscProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title: string;
  /**
   * The platform the copy is for. A PlayStation, PlayStation 2, Wii or Wii U
   * disc is drawn as that console's own (`discTemplateFor`); every other
   * platform, and a copy with none recorded, is the plain disc.
   */
  platform?: PlatformKey | null;
  /** Rendered diameter in dp — the outside of the rim. */
  size: number;
  /**
   * What shows through the clear hub and its hole: the surface the disc is lying
   * on. The sleeve in the binder, the page on the showcase. There is no cheap way
   * to punch a real hole in an image on every platform, and a disc with the art
   * running through its middle is the one thing that would read as fake.
   */
  holeColor: string;
  /** Casts when it is an object on its own; the binder's sleeves hold it flat. */
  cast?: boolean;
  style?: StyleProp<ViewStyle>;
};

/**
 * A game's disc: its box art printed on a CD.
 *
 * Four layers, bottom to top — the artwork, cropped to a circle; the clear hub,
 * in the colour behind; the disc PNG, whose transparent label window lets the art
 * through and whose hub and rim sit over it; and one faint diagonal sheen, the
 * polycarbonate catching light. Portrait art is centre-cropped rather than
 * stretched, the same rule as every other piece of box art in the app.
 *
 * Decorative on its own: the caller carries the label, because a disc is always
 * inside something that says which game it is.
 */
export const CdDisc = memo(function CdDisc({
  coverUrl,
  heroUrl,
  title,
  platform = null,
  size,
  holeColor,
  cast = false,
  style,
}: CdDiscProps) {
  const theme = useTheme();
  const template = discTemplateFor(platform);
  const scale = size / (template.outerRadius * 2);
  const art = template.artRadius * 2 * scale;
  const hub = template.hubRadius * 2 * scale;
  const source = coverUrl ?? heroUrl ?? null;

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: size / 2 },
        cast && [styles.cast, { shadowColor: theme.shadowInk }],
        style,
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants">
      <View
        style={[
          styles.centred,
          {
            width: art,
            height: art,
            borderRadius: art / 2,
            left: (size - art) / 2,
            top: (size - art) / 2,
            backgroundColor: theme.surfaceElevated,
          },
        ]}>
        {source ? (
          <Image
            source={{ uri: source }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            recyclingKey={source}
            accessibilityIgnoresInvertColors
          />
        ) : (
          <View style={styles.letter}>
            <Text variant="h2" color="textMuted">
              {title.trim().charAt(0).toUpperCase() || '?'}
            </Text>
          </View>
        )}
        {/* The sheen lives inside the art's circle so it cannot light the
            transparent corners of the square around the disc. Under the gloss
            ceiling the case sets (0.20) — the case stays the shinier object. */}
        <LinearGradient
          colors={[withAlpha('#FFFFFF', 0.16), withAlpha('#FFFFFF', 0), withAlpha('#FFFFFF', 0.08)]}
          locations={[0, 0.5, 1]}
          start={{ x: 0.15, y: 0 }}
          end={{ x: 0.85, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      <View
        style={[
          styles.centred,
          {
            width: hub,
            height: hub,
            borderRadius: hub / 2,
            left: (size - hub) / 2,
            top: (size - hub) / 2,
            backgroundColor: holeColor,
          },
        ]}
      />

      <Image
        source={template.template}
        style={{
          position: 'absolute',
          width: template.width * scale,
          height: template.height * scale,
          left: -(template.cx - template.outerRadius) * scale,
          top: -(template.cy - template.outerRadius) * scale,
        }}
        contentFit="fill"
        pointerEvents="none"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
});

const styles = StyleSheet.create({
  centred: { position: 'absolute', overflow: 'hidden' },
  letter: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  /* A disc is thin: a short, tight cast, well under the case's. */
  cast: {
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 2, height: 5 },
    elevation: 6,
  },
});
