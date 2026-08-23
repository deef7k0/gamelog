import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { StyleSheet, View, type ImageStyle, type ViewStyle } from 'react-native';

import { Text } from '@/components/ui/text';
import { Radius, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { ListCover } from '@/lib/api';

/**
 * How much of the artwork the award scrim takes.
 *
 * 0.55 is the point where the covers are still readable as *which* games — the
 * mosaic's whole job — while the trophy on top of them holds at AA against every
 * cover tried, including a white one. Below about 0.45 a pale cover swallows the
 * glyph; above 0.7 the tile stops being four games and becomes a badge.
 */
const AWARD_SCRIM = 0.55;

/** The trophy, as a fraction of the tile's edge. */
const AWARD_GLYPH = 0.34;

export type CollectionMosaicProps = {
  /** The first four covers, in list order. Fewer is fine; empty is fine. */
  covers: readonly ListCover[];
  /** Outer edge length in dp. The mosaic is always square. */
  size: number;
  /** Fallback letter when the collection has no artwork at all. */
  title?: string | null;
  /** Corner radius. `image` by default; the header passes `none` for a bleed. */
  rounded?: keyof typeof Radius;
  /**
   * Mark this as an award show: darken the artwork and lay a gold trophy on it.
   *
   * A treatment of the same mosaic rather than different artwork, because an
   * award show *is* a collection — the four games under the scrim are the same
   * four a plain collection would show, and losing them would lose the only
   * thing that says which show this is. The scrim exists so the trophy has
   * something to sit on: box art is the loudest thing on any screen here, and a
   * glyph laid straight onto it disappears into whichever cover it lands over.
   */
  award?: boolean;
  /**
   * Blur every tile by this radius.
   *
   * For the masthead's second, blurred copy of itself: `<HeroArt>` dissolves a
   * blurred `<Image>` into a sharp one through a gradient mask, and a mosaic
   * needs the same thing built from four images instead of one. Zero — the
   * default — renders exactly as before.
   */
  blurRadius?: number;
  style?: ViewStyle;
};

/**
 * A collection's artwork: its first four covers in a 2×2 square.
 *
 * Replaces the single cover the tile used to show. The argument for one cover
 * was that four thumbnails are four things you cannot read — true when the tile
 * was 58dp wide and each quarter was 29. At the sizes this is used now (a 164dp
 * tile, a full-width header) each quarter is a legible piece of box art, and the
 * mosaic says something the single cover could not: *this is a collection*, and
 * roughly what kind of games are in it, before you have read the title.
 *
 * ## Laying out fewer than four
 *
 * A collection with one game shows that cover filling the square; with two, two
 * halves; with three, one half and two quarters. No placeholder tiles — a grey
 * square where art should be reads as a failed image load, and a collection with
 * three games is not broken.
 *
 * The covers are cropped square from portrait 2:3 art. That is a real crop and
 * it is the right one: a mosaic of correctly-proportioned posters would need
 * gaps or letterboxing, and the point of this shape is that it is one solid
 * block of artwork.
 */
export function CollectionMosaic({
  covers,
  size,
  title,
  rounded = 'image',
  award = false,
  blurRadius = 0,
  style,
}: CollectionMosaicProps) {
  const theme = useTheme();
  const radius = Radius[rounded];

  const art = covers.slice(0, 4).filter((cover) => cover.cover_url ?? cover.hero_url);

  if (art.length === 0) {
    return (
      <View
        style={[
          { width: size, height: size, borderRadius: radius },
          styles.empty,
          { backgroundColor: theme.surfaceElevated },
          style,
        ]}>
        {award ? (
          <Ionicons name="trophy" size={size * AWARD_GLYPH} color={theme.identityGold} />
        ) : (
          <Text variant="h1" color="textMuted">
            {(title ?? '?').trim().charAt(0).toUpperCase() || '?'}
          </Text>
        )}
      </View>
    );
  }

  /* One image fills the square; two split it vertically; three and four use the
     grid, with the first cover taking the whole left column when there are
     three so the odd one out is not a gap. */
  const layout = art.length === 1 ? 'single' : art.length === 2 ? 'halves' : 'grid';

  return (
    <View
      style={[
        { width: size, height: size, borderRadius: radius, backgroundColor: theme.surfaceElevated },
        styles.clip,
        style,
      ]}>
      {layout === 'single' && <Tile cover={art[0]} style={styles.fill} blurRadius={blurRadius} />}

      {layout === 'halves' && (
        <View style={styles.row}>
          <Tile cover={art[0]} style={styles.half} blurRadius={blurRadius} />
          <Tile cover={art[1]} style={styles.half} blurRadius={blurRadius} />
        </View>
      )}

      {layout === 'grid' && (
        <View style={styles.row}>
          {art.length === 3 ? (
            <>
              <Tile cover={art[0]} style={styles.half} blurRadius={blurRadius} />
              <View style={styles.half}>
                <Tile cover={art[1]} style={styles.half} blurRadius={blurRadius} />
                <Tile cover={art[2]} style={styles.half} blurRadius={blurRadius} />
              </View>
            </>
          ) : (
            <>
              <View style={styles.half}>
                <Tile cover={art[0]} style={styles.half} blurRadius={blurRadius} />
                <Tile cover={art[2]} style={styles.half} blurRadius={blurRadius} />
              </View>
              <View style={styles.half}>
                <Tile cover={art[1]} style={styles.half} blurRadius={blurRadius} />
                <Tile cover={art[3]} style={styles.half} blurRadius={blurRadius} />
              </View>
            </>
          )}
        </View>
      )}

      {/* Over the art, under nothing. `pointerEvents="none"` so the tile stays
          one tap target — the scrim is a finish on the artwork, not a layer you
          can interact with. */}
      {award && (
        <View style={styles.awardLayer} pointerEvents="none">
          <View
            style={[
              styles.fill,
              styles.absolute,
              { backgroundColor: withAlpha(theme.shadowInk, AWARD_SCRIM) },
            ]}
          />
          <Ionicons name="trophy" size={size * AWARD_GLYPH} color={theme.identityGold} />
        </View>
      )}
    </View>
  );
}

function Tile({
  cover,
  style,
  blurRadius = 0,
}: {
  cover: ListCover;
  style: ImageStyle;
  blurRadius?: number;
}) {
  return (
    <Image
      source={{ uri: cover.cover_url ?? cover.hero_url ?? '' }}
      style={style}
      contentFit="cover"
      /* No transition on the blurred copy: it is the same cached image as the
         sharp one under it, and fading it in separately animates the ramp
         across the artwork. Matches `<HeroArt>`. */
      transition={blurRadius > 0 ? 0 : 220}
      blurRadius={blurRadius}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  /* The clip lives here and any shadow belongs on the caller's wrapper —
     Android's elevation does not survive `overflow: 'hidden'`. */
  clip: { overflow: 'hidden' },
  empty: { alignItems: 'center', justifyContent: 'center' },
  fill: { width: '100%', height: '100%' },
  absolute: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  awardLayer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  row: { flex: 1, flexDirection: 'row' },
  /* Quarters and halves are both "half of my container on both axes"; nesting a
     row of halves inside a column of halves is what makes the 2x2. */
  half: { flex: 1 },
});
