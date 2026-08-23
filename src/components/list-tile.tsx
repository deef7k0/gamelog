import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { ListSummary } from '@/lib/api';

/**
 * Edge length of the mosaic, and therefore of the whole tile.
 *
 * Fixed dp like every other artwork size in the app, so retuning the spacing
 * ladder moves the interface and leaves the art alone. 164 puts two tiles plus
 * the page margins across a 390pt phone with a real gap between them, and makes
 * each quarter of the mosaic 82 — comfortably large enough to recognise a cover.
 */
const TILE = 164;

/**
 * A collection as a compact block: its artwork, then its name and who made it.
 *
 * This was a full-width horizontal row — cover on the left, title and metadata
 * in the middle, a chevron panel pinned right. That shape had two problems. It
 * spent an entire screen width on one collection, so three of them filled the
 * viewport and browsing meant scrolling past things one at a time. And the
 * chevron panel was 34dp of chrome restating what the whole row already did.
 *
 * A square block of artwork with two lines under it is the shape every media
 * app converged on for this, and it converged there for a reason: the artwork is
 * the recognisable part, so it should be as large as the layout can afford, and
 * everything else is a caption. Two per row instead of one per screen.
 *
 * **The title never wraps to a third line and the byline never wraps at all.**
 * Tiles in a grid have to share a baseline, and a title that runs long is far
 * less noticeable truncated than it is shoving the row below it out of line.
 */
export function ListTile({ list }: { list: ListSummary }) {
  const theme = useTheme();

  const owner = displayNameFor(list.owner);
  const count = `${list.itemCount} ${list.itemCount === 1 ? 'game' : 'games'}`;

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${list.title}, by ${owner}, ${count}`}
        scaleTo={0.97}
        style={styles.tile}>
        {/* The shadow sits on a wrapper because the mosaic clips its corners,
            and Android's elevation does not survive `overflow: 'hidden'`. */}
        <View style={[styles.artwork, Elevation.card, { backgroundColor: theme.surface }]}>
          <CollectionMosaic
            covers={list.mosaic}
            size={TILE}
            title={list.title}
            award={list.kind === 'awards'}
          />
        </View>

        <View style={styles.caption}>
          <Text variant="h5" numberOfLines={2}>
            {list.title}
          </Text>

          {/* Owner and count on one line, separated by a dot — they are one
              fact about provenance, not two independent pieces of metadata. */}
          <View style={styles.byline}>
            {list.kind === 'tier' && <Ionicons name="layers" size={11} color={theme.textMuted} />}
            {list.is_ranked && list.kind !== 'tier' && (
              <Ionicons name="list" size={11} color={theme.textMuted} />
            )}
            <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.bylineText}>
              {owner} • {count}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  tile: { width: TILE, gap: Spacing.x8 },
  artwork: { borderRadius: Radius.image },
  /* 2px between the title and the byline: they are one caption block, and a
     real gap makes them read as two separate facts about the collection. */
  caption: { gap: 2 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  bylineText: { flex: 1 },
});
