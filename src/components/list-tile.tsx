import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { CoverStack, type StackCover } from '@/components/ui/cover-stack';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { Elevation, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { ListSummary } from '@/lib/api';

/** The kind's mark on the title line, and the owner's picture in the byline. */
const KIND_GLYPH = 12;
const AVATAR = 16;

/** The card's inset: the review card's (`<LogCard>`), which this card is. */
const INSET = Spacing.x16;

/** No covers yet: the summary a restored cache row may still be missing them from. */
const NO_COVERS: ListSummary['stack'] = [];

export type ListTileProps = {
  list: ListSummary;
  /**
   * How wide the card is drawn, when its caller knows: the stack is sized from
   * it, and a card told its width draws the right covers on its first frame.
   * Without it the card measures itself and starts from the display less the
   * app's margin, which is right everywhere but the profile.
   */
  width?: number;
};

/**
 * A collection, wherever collections are listed: a card with its name and its
 * size across the top, its covers as a stack in the middle, and under them what
 * its owner says about it and whose it is.
 *
 * ```
 * ┌────────────────────────────────────────┐
 * │ 🏆 Horror I finished at 3am   12 games │   the title, its kind's mark, the count
 * │                                        │
 * │       ▮▮▮▮▮[ ▮▮▮▮▮▮▮ ]▮▮▮▮▮            │   five covers, the first in front
 * │                                        │
 * │ Two lines of the owner's own argument, │   the description, if there is one
 * │ and no more…                           │
 * │ (◯) ada                                │   who made it
 * └────────────────────────────────────────┘
 * ```
 *
 * The owner's design, and the fifth shape this has had. It was a row with one
 * cover; a square tile, two across; a row again, with a mosaic of four covers;
 * then old Letterboxd's "New from friends" tile — five covers stacked at the
 * row's full width, the title and the byline under them on the page. The owner
 * then asked for that "inside a card", from a second reference (a list as a
 * panel: its name top left, "32 Films" top right, its posters under them), so
 * that "the widget itself can get smaller and you just put everything inside
 * the card". Three things follow from that reference:
 *
 * **The title is above the covers and the count is at the far end of its
 * line**, where the reference has them. The count was the end of the byline;
 * the byline is the owner alone now.
 *
 * **Five covers run from one side of the card's inside to the other**, on the
 * margins the title, the count and the words under them keep — the first
 * cover's left edge under the title's, the last one's right edge under the
 * count's. Fewer than five stand in the middle (`constants/cover-stack`). For
 * one pass the stack was seven-eighths of the inside and centred, so that it
 * lined up with nothing; the owner had it brought to the margins.
 *
 * **Cards stack twelve apart**, as review cards do. The tiles were thirty-two
 * apart on the bare page, where air was the only thing separating them.
 *
 * ## The card is the review card
 *
 * The owner's direction: "the same card as the review card in the home page".
 * So it is `<LogCard>`'s, restated: `reviewCard` — a shade *under* the page —
 * the corner just taken off (`Radius.lg`), fifteen in, twelve between its
 * parts, the card shadow. It was the app's `<Card>` for one pass (`surface`, a
 * step above the page, a 16 corner), and a review and a collection in one feed
 * were two different objects. Drawn on the pressable itself, so each row of a
 * list is one view. No border: an edge is what marks a control here.
 *
 * ## What is not on it
 *
 * **Likes and comments.** They cost a second request for every screenful
 * (neither can ride on a list row — both are polymorphic) and the owner chose
 * the game count alone. They are on the collection's own screen, one tap away.
 *
 * **The mosaic**, and with it the trophy laid over an award show's artwork.
 * What says "award show" here is the gold trophy beside the title; the artwork
 * is the show's games, like any other collection's.
 *
 * ## What the covers are
 *
 * `list.stack`: the cover that represents the collection first — the owner's
 * chosen one, else its first game — then the rest in order. That first cover is
 * the one drawn whole, and it is the game the collection's own screen opens on,
 * so the card and the page it leads to agree. None is a lettered placeholder.
 *
 * **The title never runs past two lines and the description never past two.**
 * Cards in a list have to stay comparable, and a collection with a
 * five-paragraph About cannot be allowed to occupy a screen on its own.
 */
export const ListTile = memo(function ListTile({ list, width }: ListTileProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  /*
   * The card's real width, when nobody said. `onLayout` is the only honest
   * source — the card is handed its width by whatever list it is in — and the
   * estimate is what the first frame draws with. The covers are absolutely
   * placed inside the stack, so this sets their size and the stack's height and
   * never the card's own width: there is no loop.
   */
  const [measured, setMeasured] = useState(0);
  const outer = width ?? (measured || Math.min(windowWidth, MaxContentWidth) - Spacing.x16 * 2);
  /* The row the stack stands in: the card, less its inset on both sides. */
  const row = Math.max(0, outer - INSET * 2);

  function onLayout(event: LayoutChangeEvent) {
    if (width != null) return;
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((previous) => (previous === next ? previous : next));
  }

  /*
   * A stable array, or `<CoverStack>`'s memo would never hold: the summary is
   * query data and keeps its identity between renders.
   *
   * `?? NO_COVERS` is for a summary written to the device before it had a
   * `stack` at all — it carried a `mosaic` then. Reading `.map` off that is
   * what closed the screen with "cannot read property 'map' of undefined" the
   * first time it was opened after the change. `CACHE_VERSION` drops those rows
   * now; this is what makes the next rename a card with no covers for a moment
   * instead of a screen that will not open.
   */
  const stack = list.stack ?? NO_COVERS;
  const covers = useMemo<StackCover[]>(
    () =>
      stack.map((cover) => ({
        id: cover.id,
        title: cover.title,
        coverUrl: cover.cover_url,
        heroUrl: cover.hero_url,
      })),
    [stack]
  );

  const owner = displayNameFor(list.owner);
  const games = `${list.itemCount} ${list.itemCount === 1 ? 'game' : 'games'}`;
  const description = list.description?.trim();

  /* The three shapes that are not a plain collection. A glyph on the title line
     rather than a word in the byline: which of these you are looking at changes
     what the games inside mean. */
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

  return (
    <Link href={{ pathname: '/list/[id]', params: { id: list.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[list.title, `by ${owner}`, games].join(', ')}
        scaleTo={0.98}
        onLayout={onLayout}
        style={StyleSheet.flatten([styles.card, { backgroundColor: theme.reviewCard }])}>
        {/* The reference's first line: the name at the left, how many are in it
            at the right. The name gives way before the count does — it wraps to
            a second line and then truncates; the count is the part that cannot
            be read off the covers. */}
        <View style={styles.head}>
          {kindGlyph && (
            <Ionicons
              name={kindGlyph}
              size={KIND_GLYPH}
              color={list.kind === 'awards' ? theme.identityGold : theme.textMuted}
              style={styles.kindGlyph}
            />
          )}
          <Text variant="h5" numberOfLines={2} style={styles.title}>
            {list.title}
          </Text>
          <Text variant="bodySmall" color="textMuted" numberOfLines={1} style={styles.count}>
            {games}
          </Text>
        </View>

        <CoverStack covers={covers} width={row} title={list.title} />

        <View style={styles.foot}>
          {/* Two lines of the owner's argument, with their emphasis intact. */}
          {!!description && (
            <RichText variant="body" color="textSecondary" numberOfLines={2}>
              {description}
            </RichText>
          )}

          {/* Whose it is. A long name truncates rather than wrapping. */}
          <View style={styles.byline}>
            <Avatar uri={list.owner?.avatar_url} name={owner} size={AVATAR} />
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1} style={styles.owner}>
              {owner}
            </Text>
          </View>
        </View>
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  /* `<LogCard>`'s card, to the token: its inset, its twelve between parts, its
     corner and its shadow, on the fill set inline. Change one and change the
     other. */
  card: {
    padding: INSET,
    gap: Spacing.x12,
    borderRadius: Radius.lg,
    ...Elevation.card,
  },

  /* `baseline` would drop the glyph and the count onto the title's baseline and
     leave them hanging under a two-line title; `center` on a row whose text may
     wrap is wrong for the same reason. First line, top aligned, each nudged
     down by the difference between its own box and the title's line. */
  head: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x4 },
  kindGlyph: { marginTop: 4 },
  title: { flex: 1 },
  /* An 11/15 line beside a 14/19 one: three down sets the two on one baseline.
     Eight clear of the title, so a long name stops short of it. */
  count: { marginTop: 3, marginStart: Spacing.x8 },

  foot: { gap: Spacing.x8 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  owner: { flexShrink: 1, marginStart: 2 },
});
