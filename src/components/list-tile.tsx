import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { Elevation, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { Engagement, ListSummary } from '@/lib/api';

/**
 * Edge length of the mosaic, and therefore the minimum height of the row.
 *
 * Fixed dp like every other artwork size in the app, so retuning the spacing
 * ladder moves the interface and leaves the art alone. 96 is measured against
 * the text beside it rather than chosen for the art: a two-line title, a byline
 * and two lines of description come to about 94, so the artwork and the caption
 * finish together instead of one hanging off the other. Each quarter is 48 —
 * small, but a mosaic is read as a *pattern of four covers* rather than as four
 * covers, and that survives further down than a single cover does.
 */
const MOSAIC = 96;

/** Stat glyphs. Small and muted; the number is the message. */
const STAT_GLYPH = 11;

export type ListTileProps = {
  list: ListSummary;
  /**
   * Likes and comments for this collection.
   *
   * Optional because it is a second query: `lists` has no foreign key to
   * `likes` or `comments` — they are polymorphic over `(target_type,
   * target_id)`, which PostgREST cannot embed or aggregate across — so the
   * counts cannot ride along with the summary and have to be batched by the
   * screen. Absent, the row shows the game count alone rather than a pair of
   * zeroes it has not actually checked.
   */
  engagement?: Engagement;
};

/**
 * A collection as a row: its four covers, then everything it has to say.
 *
 * ## Why this went back to a row
 *
 * It was a square grid tile — artwork with a two-line caption, two across. That
 * shape was right for what it then had to show, which was a name and a byline,
 * and it replaced an earlier full-width row whose extra width went into a
 * chevron panel restating what the row already did.
 *
 * What changed is the amount there is to say. A collection now carries a written
 * About (with the owner's own emphasis in it — see `<RichText>`) and a
 * conversation, and neither fits under a 164dp square. A grid tile could show
 * that a collection existed; it could not show what it was *for*, which is the
 * whole thing that separates one person's shelf of horror games from another's.
 *
 * So the width comes back, and this time it is spent on content: two lines of
 * the owner's argument, and the three numbers that say whether anyone else
 * agreed. That is the difference from the row this replaced — the old one had
 * the space and put chrome in it.
 *
 * **The title never runs past two lines and the description never past two.**
 * Rows in a list have to stay comparable, and a collection with a five-paragraph
 * About cannot be allowed to occupy a screen on its own.
 */
export const ListTile = memo(function ListTile({ list, engagement }: ListTileProps) {
  const theme = useTheme();

  const owner = displayNameFor(list.owner);
  const games = `${list.itemCount} ${list.itemCount === 1 ? 'game' : 'games'}`;

  /* The three shapes that are not a plain collection. A glyph on the title line
     rather than a word in the byline: which of these you are looking at changes
     what the rows below mean, and the byline is already carrying five things. */
  const kindGlyph =
    list.kind === 'awards'
      ? 'trophy'
      : list.kind === 'tier'
        ? 'layers'
        : list.kind === 'captioned'
          ? 'grid'
          : list.is_ranked
            ? 'list'
            : null;

  const label = [
    list.title,
    `by ${owner}`,
    games,
    engagement ? `${engagement.likes} likes` : null,
    engagement ? `${engagement.comments} comments` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={label}
        scaleTo={0.98}
        style={StyleSheet.flatten(styles.row)}>
        {/* The shadow sits on a wrapper because the mosaic clips its corners,
            and Android's elevation does not survive `overflow: 'hidden'`. */}
        <View style={[styles.artwork, Elevation.card, { backgroundColor: theme.surface }]}>
          <CollectionMosaic
            covers={list.mosaic}
            size={MOSAIC}
            title={list.title}
            award={list.kind === 'awards'}
          />
        </View>

        <View style={styles.column}>
          <View style={styles.titleRow}>
            {kindGlyph && (
              <Ionicons
                name={kindGlyph}
                size={STAT_GLYPH}
                color={list.kind === 'awards' ? theme.identityGold : theme.textMuted}
                style={styles.kindGlyph}
              />
            )}
            <Text variant="h5" numberOfLines={2} style={styles.title}>
              {list.title}
            </Text>
          </View>

          {/*
            Who made it, then how it has landed — one line, and the separators
            are the glyphs themselves.

            A middle dot between five values would be four more marks than the
            row can carry, and it makes every number mean the same thing. A
            controller, a heart and a speech bubble say *which* number each one
            is without spending a word on it, which is the only way three counts
            fit beside a name on a 250dp column.
          */}
          <View style={styles.byline}>
            <Avatar uri={list.owner?.avatar_url} name={owner} size={16} />
            <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.owner}>
              {owner}
            </Text>

            <Stat icon="game-controller" value={list.itemCount} />
            {engagement && <Stat icon="heart" value={engagement.likes} />}
            {engagement && <Stat icon="chatbubble" value={engagement.comments} />}
          </View>

          {/* Two lines of the owner's argument, with their emphasis intact. */}
          {!!list.description?.trim() && (
            <RichText variant="bodySmall" color="textSecondary" numberOfLines={2}>
              {list.description}
            </RichText>
          )}
        </View>
      </PressableScale>
    </Link>
  );
});

/** One glyph and its number. Never a word — the glyph is the word. */
function Stat({ icon, value }: { icon: keyof typeof Ionicons.glyphMap; value: number }) {
  const theme = useTheme();

  return (
    <View style={styles.stat}>
      <Ionicons name={icon} size={STAT_GLYPH} color={theme.textMuted} />
      <Text variant="bodySmall" color="textMuted">
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  artwork: { borderRadius: Radius.image },
  column: { flex: 1, gap: Spacing.x4 },

  /* `baseline` would drop the glyph onto the title's baseline and leave it
     hanging under a two-line title; `center` on a row whose text may wrap is
     wrong for the same reason. First line, top aligned, nudged down by the
     difference between the glyph's box and the title's cap height. */
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x4 },
  kindGlyph: { marginTop: 4 },
  title: { flex: 1 },

  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Shrinks before the counts do: a long display name should truncate rather
     than push the numbers off the row, which is the part that cannot be
     inferred from anywhere else on the tile. */
  owner: { flexShrink: 1 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 3 },
});
