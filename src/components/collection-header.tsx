import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { Text } from '@/components/ui/text';
import { Palette, Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { Engagement, ListCover, ListItem, ListWithItems } from '@/lib/api';
import type { Profile } from '@/lib/database.types';

/**
 * How much of the display the artwork block occupies.
 *
 * **Half, exactly.** The reference sets it there and the reason holds here: a
 * collection opens on a square of four covers, and half a phone is the point
 * where that square reads as the subject of the page rather than as a header
 * image above the real content. Below about 0.45 it becomes a banner; above 0.55
 * the title is pushed off the first screenful.
 */
const COVER_RATIO = 0.5;

/**
 * Where the black starts, as a fraction of the cover block's height.
 *
 * The title sits *inside* the artwork, a little above the point the fade has
 * finished — which is what makes the name read as printed on the cover rather
 * than captioned under it. So the ramp has to be well underway by the time it
 * reaches the text, and fully closed before the buttons.
 */
const FADE_START = 0.42;

/** The one filled action. */
const PILL_HEIGHT = 52;
/** Every circular action beside it. */
const CIRCLE = 52;

/**
 * Lines of description shown before "See more".
 *
 * Three, and it is the reference's number. One line is a caption and cannot
 * carry an argument; the whole thing unclamped pushes the list itself off the
 * screen on any collection whose owner actually wrote something.
 */
const DESCRIPTION_LINES = 3;

export type CollectionHeaderProps = {
  collection: ListWithItems;
  owner: Profile | null;
  isOwner: boolean;
  /** Like count and whether the viewer is one of them. */
  engagement?: Engagement;
  onEdit?: () => void;
  /** Rename the collection and rewrite its About. Owner-only. */
  onEditDetails?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  /** Enter the "tap a game to use its cover" mode. Owner-only. */
  onPickCover?: () => void;
};

/**
 * Collection masthead — artwork, name, one row of actions, description.
 *
 * ## The shape, and what changed
 *
 * Half a screen of artwork fading to black; the name and the byline set *over*
 * the bottom of it; one row of actions on the dark below; then the description,
 * tight under the actions. Everything is centred on the artwork's axis.
 *
 * Two things were wrong before and both were structural rather than cosmetic.
 *
 * **The fade was a blurred copy of the artwork revealed through a gradient
 * mask.** That is the game page's treatment and it belongs there, where the
 * subject is one photographic key art. A collection's artwork is a 2×2 grid of
 * covers, and blurring it produced four smeared rectangles whose seams were
 * still visible — the grid survived the blur, so the "dissolve" read as the
 * image going out of focus rather than as it ending. A plain black ramp is what
 * the reference uses and it is the honest one: the artwork does not dissolve,
 * the page gets dark underneath it.
 *
 * **The action row wrapped.** An owner saw six controls — share, edit details,
 * change preview, add games, delete, like — which is 356dp against a small
 * phone's ~324, so the last one dropped to a second line and the description
 * moved down with it. The fix is not smaller buttons: it is that four of those
 * six are *owner administration* and do not belong in the same row as the one
 * thing a reader came to do. They are behind the overflow now, so the row is
 * always exactly three objects wide — circle, pill, circle — on every phone and
 * for every viewer.
 */
export function CollectionHeader({
  collection,
  owner,
  isOwner,
  engagement,
  onEdit,
  onEditDetails,
  onDelete,
  onShare,
  onPickCover,
}: CollectionHeaderProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const items = collection.items ?? [];
  const covers = coversFrom(items);
  const isAwards = collection.kind === 'awards';
  const description = collection.description?.trim();

  const { liked, likeCount, toggle } = useLikeToggle('list', collection.id, engagement);

  /*
   * The mosaic is square and the block is not, so it is sized to cover the
   * block's longer axis and centred on both — a centre crop rather than a
   * stretch.
   */
  const coverHeight = Math.round(height * COVER_RATIO);
  const mosaicSize = Math.max(width, coverHeight);
  const offsetX = Math.round((width - mosaicSize) / 2);
  const offsetY = Math.round((coverHeight - mosaicSize) / 2);

  const ownerActions = isOwner && (onEditDetails || onEdit || onPickCover || onDelete);

  return (
    <View>
      <View style={[styles.cover, { height: coverHeight }]}>
        <View style={[styles.coverArt, { left: offsetX, top: offsetY }]}>
          <CollectionMosaic
            covers={covers}
            size={mosaicSize}
            title={collection.title}
            rounded="none"
            award={isAwards}
          />
        </View>

        {/*
          One black ramp, and no blur anywhere in it.

          Weighted rather than linear: a straight fade spends its first half
          barely tinting anything and then closes the whole distance at once,
          which on artwork reads as the image dropping off a shelf. Every stop
          ends on a colour at an explicit alpha and never the keyword
          `transparent` — expo-linear-gradient premultiplies on Android and
          would fade the keyword through black, leaving a grey bruise mid-ramp.
        */}
        <LinearGradient
          colors={[
            withAlpha(theme.background, 0),
            withAlpha(theme.background, 0.55),
            withAlpha(theme.background, 0.92),
            theme.background,
          ]}
          locations={[0, 0.45, 0.8, 1]}
          style={[styles.fade, { top: `${FADE_START * 100}%` }]}
          pointerEvents="none"
        />

        {/* Keeps the floating back disc legible over a bright cover. */}
        <LinearGradient
          colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
          style={styles.scrim}
          pointerEvents="none"
        />

        {/*
          The name and the byline, set over the artwork.

          Anchored to the bottom of the cover block rather than placed after it,
          so they sit on ground the fade has already darkened — printed on the
          cover rather than captioned beneath it. `paddingBottom` is what keeps
          them clear of the very bottom edge, where the ramp is fully black and
          the text would look like it had fallen out of the image.
        */}
        <View style={styles.titleBlock} pointerEvents="box-none">
          <Text variant="display" numberOfLines={2} style={styles.title}>
            {collection.title}
          </Text>

          {owner && (
            <Link href={{ pathname: '/profile/[id]', params: { id: owner.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${displayNameFor(owner)}'s profile`}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.byline)}>
                <Avatar uri={owner.avatar_url} name={displayNameFor(owner)} size={20} />
                <Text variant="h5" numberOfLines={1}>
                  {displayNameFor(owner)}
                </Text>
              </PressableScale>
            </Link>
          )}

          <Text variant="bodySmall" color="textMuted">
            {collectionKindLabel(collection)} · {items.length}{' '}
            {items.length === 1 ? 'game' : 'games'}
          </Text>
        </View>
      </View>

      <View style={styles.body}>
        {/*
          Three objects, always. Never four, never a second line.

          The pill is the like because that is the one thing a *reader* came to
          do, and it is the only control here with a state to be in. Share sits
          to its left; everything an owner can do to the collection is behind the
          overflow to its right, which is what guarantees the row measures the
          same for a visitor and for the person who made it.
        */}
        <View style={styles.actions}>
          {onShare ? (
            <CircleAction icon="share-outline" label="Share this collection" onPress={onShare} />
          ) : (
            <View style={styles.circleSpacer} />
          )}

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={liked ? 'Unlike this collection' : 'Like this collection'}
            accessibilityState={{ selected: liked }}
            onPress={toggle}
            scaleTo={0.95}
            style={StyleSheet.flatten([
              styles.pill,
              { backgroundColor: liked ? theme.danger : theme.text },
            ])}>
            {/* Near-black ink in both states, and it is the only arrangement
                that measures: white on `danger` is 3.09:1, near-black on it is
                5.57:1. The solid-vs-outline glyph is the second carrier, so
                "liked" never rests on hue alone. */}
            <Ionicons name={liked ? 'heart' : 'heart-outline'} size={22} color={theme.background} />
            <Text variant="button" style={{ color: theme.background }}>
              {likeCount > 0 ? `${likeCount}` : 'Like'}
            </Text>
          </PressableScale>

          {ownerActions ? (
            <CircleAction
              icon="ellipsis-horizontal"
              label="More actions for this collection"
              onPress={() => setMenuOpen(true)}
            />
          ) : (
            <View style={styles.circleSpacer} />
          )}
        </View>

        {/*
          The description, tight under the actions.

          `gap` on the body is deliberately small: the reference stacks these
          with almost nothing between them, and the compactness is what keeps the
          list itself on the first screenful.
        */}
        {description ? (
          <View style={styles.about}>
            <RichText
              variant="body"
              color="textSecondary"
              numberOfLines={expanded ? undefined : DESCRIPTION_LINES}>
              {description}
            </RichText>

            {/* Shown unconditionally rather than measured. `onTextLayout` would
                tell us whether the clamp actually bit, but it costs a render
                pass on every description and gets it wrong on the first frame;
                a "See more" that opens three lines you had already read is a far
                smaller cost than a truncated argument with no way in. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={expanded ? 'Show less' : 'Show the full description'}
              onPress={() => setExpanded((open) => !open)}
              hitSlop={Spacing.x8}
              scaleTo={0.98}>
              <Text variant="h5" color="textSecondary">
                {expanded ? 'Less' : 'More'}
              </Text>
            </PressableScale>
          </View>
        ) : (
          <Text variant="body" color="textMuted">
            No description
          </Text>
        )}
      </View>

      {ownerActions && (
        <OwnerMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          canPickCover={!!onPickCover && items.length > 1}
          onEditDetails={onEditDetails}
          onEdit={onEdit}
          onPickCover={onPickCover}
          onDelete={onDelete}
        />
      )}
    </View>
  );
}

/** What kind of thing this is, in the reference's "Playlist · 2026" slot. */
function collectionKindLabel(collection: ListWithItems): string {
  switch (collection.kind) {
    case 'awards':
      return 'Award show';
    case 'tier':
      return 'Tier list';
    case 'captioned':
      return 'Board';
    case 'favorites':
      return 'Favourites';
    case 'wishlist':
      return 'Wishlist';
    default:
      return collection.is_ranked ? 'Ranked list' : 'Collection';
  }
}

/**
 * One circular action.
 *
 * Outlined, never filled — the pill between them is the only filled object in
 * the row, which is what makes it read as the primary one. The ring is always
 * white, including on a destructive action: `danger` at 40% composites to
 * #6C2D2D, 1.83:1 on the page, against the 3:1 a control boundary owes. Meaning
 * rides on the glyph instead, which is the same rule `<Chip color>` follows.
 */
function CircleAction({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.92}
      style={StyleSheet.flatten([styles.circle, { borderColor: withAlpha(theme.text, 0.4) }])}>
      <Ionicons name={icon} size={22} color={theme.text} />
    </PressableScale>
  );
}

/**
 * Everything an owner can do, on a sheet.
 *
 * Off the action row on purpose. These are administration — rename it, add to
 * it, change its cover, delete it — and none of them is what a person opening a
 * collection came to do. Keeping them in the row cost a wrapped second line on
 * every phone and put a delete button a thumb's width from the like.
 */
function OwnerMenu({
  open,
  onClose,
  canPickCover,
  onEditDetails,
  onEdit,
  onPickCover,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  canPickCover: boolean;
  onEditDetails?: () => void;
  onEdit?: () => void;
  onPickCover?: () => void;
  onDelete?: () => void;
}) {
  const theme = useTheme();

  function run(action?: () => void) {
    onClose();
    action?.();
  }

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      {/* The scrim dismisses. A sheet with no way out but its own buttons is a
          trap on Android, where there is no swipe-down to close a transparent
          modal. */}
      <Pressable
        style={[styles.backdrop, { backgroundColor: withAlpha(Palette.shadowInk, 0.6) }]}
        accessibilityRole="button"
        accessibilityLabel="Close"
        onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: theme.surfaceElevated }]}
          /* Swallows the tap so pressing the sheet itself does not dismiss it. */
          onPress={() => {}}>
          {onEditDetails && (
            <MenuRow
              icon="create-outline"
              label="Edit name and description"
              onPress={() => run(onEditDetails)}
            />
          )}
          {onEdit && <MenuRow icon="add" label="Add games" onPress={() => run(onEdit)} />}
          {canPickCover && onPickCover && (
            <MenuRow
              icon="image-outline"
              label="Change preview cover"
              onPress={() => run(onPickCover)}
            />
          )}
          {onDelete && (
            <MenuRow
              icon="trash-outline"
              label="Delete collection"
              danger
              onPress={() => run(onDelete)}
            />
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  const theme = useTheme();
  const ink = danger ? theme.danger : theme.text;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      style={StyleSheet.flatten(styles.menuRow)}>
      <Ionicons name={icon} size={20} color={ink} />
      <Text variant="h5" style={{ color: ink }}>
        {label}
      </Text>
    </PressableScale>
  );
}

/**
 * The first four items' covers, in list order.
 *
 * Mirrors `resolveMosaic` in `api/lists.ts`. Two functions rather than one
 * because the shapes genuinely differ — this walks `ListItem[]` with a full
 * `CachedGame` attached, that walks the summary's lighter embed — but they must
 * stay in agreement, because the whole point is that the tile and the banner
 * show the same four covers.
 */
function coversFrom(items: ListItem[]): ListCover[] {
  return items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is NonNullable<typeof game> => game !== null)
    .map((game) => ({
      id: game.id,
      title: game.title,
      cover_url: game.cover_url,
      hero_url: game.hero_url,
    }))
    .slice(0, 4);
}

const styles = StyleSheet.create({
  cover: { position: 'relative', width: '100%', overflow: 'hidden' },
  coverArt: { position: 'absolute' },
  /* `top` is supplied inline — the ramp begins partway down the artwork. */
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },

  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x24,
    paddingBottom: Spacing.x16,
  },
  title: { textAlign: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },

  /* Tight. The reference leaves almost nothing between the buttons and the
     description, and that compactness is what keeps the list on screen. */
  body: { paddingHorizontal: Spacing.x24, alignItems: 'center', gap: Spacing.x12 },

  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x20,
    marginTop: Spacing.x12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    height: PILL_HEIGHT,
    minWidth: 132,
    paddingHorizontal: Spacing.x24,
    borderRadius: PILL_HEIGHT / 2,
  },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Holds the pill centred when one side has no control. Without it a visitor's
     row would be pill-plus-share, centred as a pair, and the like would sit off
     the page's axis. */
  circleSpacer: { width: CIRCLE, height: CIRCLE },

  about: { alignSelf: 'stretch', gap: Spacing.x4 },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: Radius.card,
    borderTopRightRadius: Radius.card,
    paddingVertical: Spacing.x12,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    minHeight: TapTarget,
    paddingHorizontal: Spacing.x24,
  },
});
