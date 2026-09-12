import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreTile } from '@/components/ui/score-tile';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';

/**
 * The artwork, square — and square art rather than a square crop.
 *
 * A portrait cover would set the row's height to 1.5× this and a column of them
 * reads as a stack of slivers, so this slot has always been 1:1. What changed is
 * where the pixels come from: IGDB publishes nothing square, so the row used to
 * centre-crop 2:3 box art, and box art is *composed* for 2:3 — the crop cut the
 * logo in half on a good share of the catalogue. SteamGridDB hosts community
 * grids at true 1:1 which are composed square, so nothing is cut.
 *
 * **80, up from 56.** 56 was sized for a cropped thumbnail — at that size the
 * crop was most of the problem and there was no reason to give more room to
 * artwork that was being cut in half anyway. Composed square art is worth
 * looking at, and this is an index *of games*: at 80 the cover is the thing the
 * eye lands on and the two lines of type beside it are the caption, which is the
 * right way round. It still clears `<ScoreTile size="small">` (44) at the other
 * end of the row by a comfortable margin, so the row's height is set by the art
 * and not by a control.
 *
 * The IGDB cover is still the fallback, still centre-cropped, and still what
 * most rows show on a build with no SteamGridDB key. `contentFit="cover"` is
 * right either way: it is a no-op on art that already matches the slot.
 */
const ART = 80;

export type ReviewListRowProps = {
  log: LogWithRelations;
};

/**
 * One of somebody's reviews, as a row.
 *
 * ## Why this is not `<LogCard>`
 *
 * `<LogCard>` is a *card*: the full review, the author, the engagement row. That
 * is right in a feed, where one review is the unit of content. A profile's
 * Reviews tab is an index — the question is "what has this person written
 * about", not "read this one" — and forty cards answer it by making the reader
 * scroll past thirty-nine reviews to find the fortieth.
 *
 * So the row carries the four things an index needs: which game, when it came
 * out, what they played it on, and what they gave it. The writing is one tap
 * away and the card is still what greets you there.
 */
export const ReviewListRow = memo(function ReviewListRow({ log }: ReviewListRowProps) {
  const theme = useTheme();
  const game = log.game;

  const cover = game?.cover_url ?? game?.hero_url ?? null;

  /*
   * Nothing is drawn until the square lookup has an answer.
   *
   * `resolved` rather than `square ?? cover`, and the difference is the whole
   * point of the hook: falling back to the IGDB cover while the answer is
   * unknown is what made every row paint a portrait and then swap it for a
   * square. The slot keeps its own `surfaceElevated` fill for that moment
   * instead, which reads as artwork arriving rather than as artwork changing its
   * mind. It happens once per game, ever — the answer is on disk after that.
   */
  const square = useSquareCover({ gameId: game?.id, title: game?.title });
  const art = square.resolved ? (square.uri ?? cover) : null;
  const year = game?.release_year ?? null;
  /* Release year and the platform they played on, in that order: the first is a
     fact about the game, the second about this person's run at it. */
  const meta = [year, log.played_on].filter(Boolean).join(' · ');

  return (
    <Link href={{ pathname: '/review/[id]', params: { id: log.id } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={
          log.rating !== null
            ? `${game?.title ?? 'Untitled'}, rated ${log.rating}. Read the review.`
            : `${game?.title ?? 'Untitled'}. Read the review.`
        }
        scaleTo={0.98}
        /* Flattened: `<Link asChild>` clones this child and throws rather than
           guess precedence when `style` is an array. */
        style={StyleSheet.flatten([styles.row, { borderTopColor: theme.border }])}>
        <Image
          source={art ? { uri: art } : undefined}
          recyclingKey={log.id}
          cachePolicy="memory-disk"
          style={[styles.art, { backgroundColor: theme.surfaceElevated }]}
          contentFit="cover"
          transition={200}
          accessibilityIgnoresInvertColors
        />

        <View style={styles.body}>
          {/* One line with an ellipsis, never two. The row's height is set by the
              artwork, and a wrapping title would be the only thing on the screen
              that changes it. */}
          <Text variant="h5" numberOfLines={1}>
            {game?.title ?? 'Untitled'}
          </Text>
          {meta.length > 0 && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {meta}
            </Text>
          )}
        </View>

        {log.rating !== null && <ScoreTile score={log.rating} size="small" />}
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  art: { width: ART, height: ART, borderRadius: Radius.image },
  body: { flex: 1, gap: 2 },
});
