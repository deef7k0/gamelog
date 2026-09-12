import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import type { ListItem } from '@/lib/api';

/**
 * Cover width in the row layout, in dp.
 *
 * Fixed, like every other artwork size in the app, so retuning the spacing
 * ladder moves the interface and leaves the art alone. 44 is the smallest a
 * cover can be and still be *recognised* — below that a reader is navigating by
 * the title, at which point the artwork is decoration and should be dropped
 * rather than shrunk.
 */
const COVER = 44;

/**
 * Width reserved for the rank, in dp.
 *
 * Fixed rather than hugging the number, so every title in a ranked list starts
 * at the same x. A column that grows from "9" to "10" shifts a hundred rows by
 * three points, which reads as the list flinching.
 */
const RANK_WIDTH = 26;

export type CollectionRowProps = {
  item: ListItem;
  /** 1-based position in the owner's stored order. Null on unranked collections. */
  rank: number | null;
  /** Right-hand controls — the owner's reorder arrows and remove. */
  trailing?: React.ReactNode;
};

/**
 * One game as a row: cover, title, and who made it and when.
 *
 * The alternative to the grid, and it exists because the two answer different
 * questions. A wall of covers is for *recognising* — you are looking for the box
 * you remember, and the artwork is the whole content. A list is for *reading* —
 * ninety games deep, a title and a studio scan far faster than ninety pieces of
 * box art, and the year is a fact the grid cannot show at all without a caption
 * under every tile.
 *
 * Two lines, not three. Title, then studio and year joined on one muted line —
 * they are one fact about provenance, and giving each its own line makes a row
 * of ninety twice as tall for no gain.
 */
export const CollectionRow = memo(function CollectionRow({
  item,
  rank,
  trailing,
}: CollectionRowProps) {
  const game = item.game;
  const title = game?.title ?? 'Unknown game';
  const meta = [game?.developer, game?.release_year].filter(Boolean).join(' · ');

  return (
    <View style={styles.row}>
      <Link href={{ pathname: '/game/[id]', params: { id: item.game_id } }} asChild>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={
            rank
              ? `${rank}. ${title}${meta ? `, ${meta}` : ''}`
              : `${title}${meta ? `, ${meta}` : ''}`
          }
          scaleTo={0.99}
          style={StyleSheet.flatten(styles.press)}>
          {/* The rank comes before the artwork, exactly as a track number does:
              it is the row's identity in the list, and putting it after the
              cover would make it a property of the game instead. */}
          {rank !== null && (
            <Text variant="h5" color="textMuted" style={styles.rank}>
              {rank}
            </Text>
          )}

          <Poster
            coverUrl={game?.cover_url}
            heroUrl={game?.hero_url}
            title={game?.title}
            width={COVER}
            rounded="image"
          />

          <View style={styles.text}>
            <Text variant="h5" numberOfLines={1}>
              {title}
            </Text>
            {!!meta && (
              <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
                {meta}
              </Text>
            )}
          </View>
        </PressableScale>
      </Link>

      {trailing}
    </View>
  );
});

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* The link takes the whole row's width so the tap target is the row rather
     than the cover — `flex: 1` here is what pushes the trailing controls right. */
  press: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x4,
  },
  rank: { width: RANK_WIDTH, textAlign: 'center' },
  /* Shrinks rather than pushing the row wide: a long title truncates instead of
     shoving the owner's controls off the right edge. */
  text: { flex: 1, gap: 1 },
});
