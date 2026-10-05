import { Link, type Href } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { LogoMark } from '@/components/ui/logo-mark';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

export type LogoTileProps = {
  /** Where a tap goes. */
  href: Href;
  /** The logo, or null for a thing that has none. */
  logoUrl: string | null;
  /** The name under the tile, and the initial on it when there is no logo. */
  name: string;
  /** The quiet line under the name — a year, a count of games. */
  detail?: string | null;
  /** The column's width: the tile is this square. */
  width: number;
  /** What a screen reader says for the whole tile. */
  accessibilityLabel: string;
  /** Behind something else on the screen in the download queue. */
  low?: boolean;
};

/**
 * A platform or a studio as a tile: its logo on a square, its name under it,
 * and one quiet line — the owner's reference, SimpMusic's library grid, where
 * each mix is a square with its title and a line of small grey type.
 *
 * Read from `HomeItemContentPlaylist` (`AdapterItems.kt`) as `GridLibraryPlaylist`
 * lays it out: the art fills its cell and is square, 8 from it to the title,
 * the title `titleSmall` (this app's `itemTitle`) in up to two lines, then one
 * line of `bodySmall`. The title is not held open at two lines here, as it is
 * not there: a one-line name has its second line directly under it.
 *
 * The square is `<LogoMark tile>` — the logo measured and drawn so it reads on
 * a dark tile, see that component.
 */
export const LogoTile = memo(function LogoTile({
  href,
  logoUrl,
  name,
  detail,
  width,
  accessibilityLabel,
  low = false,
}: LogoTileProps) {
  return (
    <Link href={href} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={accessibilityLabel}
        scaleTo={0.96}
        style={{ width }}>
        <LogoMark
          uri={logoUrl}
          name={name}
          width={width}
          height={width}
          tile
          priority={low ? 'low' : undefined}
        />
        <View style={styles.caption}>
          <Text variant="itemTitle" numberOfLines={2}>
            {name}
          </Text>
          {!!detail && (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {detail}
            </Text>
          )}
        </View>
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  caption: { paddingTop: Spacing.x8, gap: 1 },
});
