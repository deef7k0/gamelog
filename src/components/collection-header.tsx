import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { Avatar } from '@/components/ui/avatar';
import { ExpandableText } from '@/components/ui/expandable-text';
import { PressableScale } from '@/components/ui/pressable-scale';
import { useSectionMetrics } from '@/components/ui/section';
import { SmoothScrim } from '@/components/ui/smooth-scrim';
import { Text } from '@/components/ui/text';
import { Palette, Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useSquareCover } from '@/hooks/use-square-cover';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { Engagement, ListCover, ListItem, ListWithItems } from '@/lib/api';
import type { ListCoverStyle, Profile } from '@/lib/database.types';

/**
 * How much of the display the artwork block occupies: half, SimpMusic's album
 * and playlist header (`screenInfo.hDP / 2`), full width and cropped.
 */
const COVER_RATIO = 0.5;

/**
 * How much of the artwork the scrim covers, from the bottom: 70%, the
 * reference's `hDP * 0.35` of an `hDP / 2` frame. Long on purpose — the shorter
 * the ramp, the steeper its alpha, and a steep ramp is what reads as an edge.
 * The title sits over its last third, where the page colour has taken over.
 */
const SCRIM_RATIO = 0.7;

/** The quiet line under the title — "Collection · 12 games" — at the reference's 77% white. */
const META_ALPHA = 0.77;

/**
 * Where a single *box* is anchored in the banner, top to bottom — the stand-in
 * for a game with no square art.
 *
 * A 2:3 cover in a banner this shape loses most of its height to the crop, and a
 * centred crop keeps the box's middle — usually a torso, or nothing. A cover's
 * subject and its logo sit high, so the crop is weighted a fifth of the way down.
 * Square art is composed for a square and is drawn from its centre.
 */
const SINGLE_ANCHOR = '22%';

/** The one filled action: the reference album's Play pill, 48. */
const PILL_HEIGHT = 48;
/** Every circular action beside it: the reference's 48 circles. */
const CIRCLE = 48;

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
  /**
   * The page colour the artwork melts into — the immersive colour of a single
   * cover (`useImmersiveBackground`), or null for the app's own page, which is
   * what a mosaic of several covers always uses. The screen fills with the same
   * value.
   */
  pageColor?: string | null;
  /** Like count and whether the viewer is one of them. */
  engagement?: Engagement;
  onEdit?: () => void;
  /** Rename the collection and rewrite its About. Owner-only. */
  onEditDetails?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  /** Enter the "tap a game to use its cover" mode. Owner-only. */
  onPickCover?: () => void;
  /** Switch between four covers and one. Owner-only. */
  onSetDisplay?: (display: ListCoverStyle) => void;
};

/**
 * Collection masthead — artwork, name, one row of actions, description.
 *
 * ## The shape, and what changed
 *
 * Half a screen of artwork — four covers, or the one the owner chose — melting
 * into the page through a smoothstep scrim over its bottom 70%; the name and the
 * byline set *over* the bottom of it; one row of actions below; then the
 * description, tight under the actions. Everything is centred on the artwork's
 * axis. The geometry is SimpMusic's album and playlist header, read from
 * `AlbumScreen.kt` / `PlaylistScreen.kt`.
 *
 * **The page takes a single cover's colour.** With one cover — the owner's
 * choice, or the only one a collection has (`collectionCover`) — the screen
 * fills with that cover's immersive colour (`useImmersiveBackground`) and the
 * scrim melts into it; with a mosaic of several it stays the app's own page,
 * since several covers have no one colour. The colour is the background's
 * alone — the actions below keep their neutral fills.
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
  pageColor = null,
  engagement,
  onEdit,
  onEditDetails,
  onDelete,
  onShare,
  onPickCover,
  onSetDisplay,
}: CollectionHeaderProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const sections = useSectionMetrics();
  const [menuOpen, setMenuOpen] = useState(false);

  const items = collection.items ?? [];
  const covers = coversFrom(items);
  const display = collection.cover_style ?? 'mosaic';
  const single = collectionCover(collection);
  /*
   * The single cover as square art, where SteamGridDB has any. This header is
   * the one place a collection is drawn square, by the owner's rule: its row
   * outside (`<ListTile>`) and the games under it are box art. Nothing is drawn
   * until the lookup has answered, so the box is never painted and then
   * swapped; a miss draws the box, anchored.
   */
  const square = useSquareCover({ gameId: single?.id, title: single?.title, enabled: !!single });
  const singleArt =
    single && square.resolved ? (square.uri ?? single.cover_url ?? single.hero_url) : null;
  const page = pageColor ?? theme.background;
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

  const ownerActions =
    isOwner && (onEditDetails || onEdit || onPickCover || onSetDisplay || onDelete);

  return (
    <View>
      <View style={[styles.cover, { height: coverHeight }]}>
        {/*
          The artwork, full width and cropped to the banner.

          One cover when the owner chose one or there is only one to show:
          drawn straight into the banner with `cover` fit rather than as a
          square mosaic of one, so the crop is the banner's shape — square art
          from its centre, a stand-in box anchored high (`SINGLE_ANCHOR`).
          Several otherwise: the square mosaic, sized to the block's longer
          axis and centred — a centre crop rather than a stretch.
        */}
        {single ? (
          singleArt && (
            <Image
              source={{ uri: singleArt }}
              style={styles.single}
              contentFit="cover"
              contentPosition={square.uri ? 'center' : { top: SINGLE_ANCHOR, left: '50%' }}
              transition={220}
              accessibilityIgnoresInvertColors
            />
          )
        ) : (
          <View style={[styles.coverArt, { left: offsetX, top: offsetY }]}>
            <CollectionMosaic
              covers={covers}
              size={mosaicSize}
              title={collection.title}
              rounded="none"
              squareArt
              award={isAwards}
            />
          </View>
        )}

        {/*
          The artwork melting into the page: SimpMusic's album header, which
          lays `artworkScrimBrush` over the bottom 70% of the art and nothing
          else — no tint over the whole image, so the top of the cover shows at
          full strength and only the bottom gives way.

          Into `page`: the cover's own immersive colour when there is a single
          cover, the app's page otherwise. A mosaic of several covers has no one
          colour to take, so it stays on the ordinary page.
        */}
        <SmoothScrim color={page} style={[styles.fade, { height: `${SCRIM_RATIO * 100}%` }]} />

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
        {/* The reference's title stack: the name, 4 below it the byline, 2 below
            that the kind and count at 77% white — "2007 • Album" in SimpMusic,
            "Collection · 12 games" here. */}
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

          <Text variant="body" style={[styles.meta, { color: withAlpha(theme.text, META_ALPHA) }]}>
            {collectionKindLabel(collection)} · {items.length}{' '}
            {items.length === 1 ? 'game' : 'games'}
          </Text>
        </View>
      </View>

      {/*
        SimpMusic's album and playlist body (`AlbumScreen.kt`): one column, 32
        in from each side to scale — the action row centred in it, then the
        description under it, start-aligned across the column's full width,
        each with the reference's 8 above and below. The description used to
        sit 15 in, tight under the buttons, while "No description" centred
        itself — two alignments for one slot.
      */}
      <View style={{ paddingHorizontal: sections.bodyInset, paddingTop: sections.cardGap }}>
        {/*
          Three objects, always. Never four, never a second line.

          The pill is the like because that is the one thing a *reader* came to
          do, and it is the only control here with a state to be in. Share sits
          to its left; everything an owner can do to the collection is behind the
          overflow to its right, which is what guarantees the row measures the
          same for a visitor and for the person who made it.
        */}
        <View style={[styles.actions, { paddingVertical: sections.cardGap }]}>
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
          The description: the reference's `DescriptionView`, three lines and
          then its More, opening in place (`<ExpandableText>`). With nothing
          written the same slot says so, in the same type and the same place,
          as the reference's does.
        */}
        <View style={[styles.about, { paddingVertical: sections.cardGap }]}>
          {description ? (
            <ExpandableText rich lines={DESCRIPTION_LINES} subject="the description">
              {description}
            </ExpandableText>
          ) : (
            <Text variant="body" color="textSecondary">
              No description
            </Text>
          )}
        </View>
      </View>

      {ownerActions && (
        <OwnerMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          display={display}
          canPickCover={!!onPickCover && display === 'single' && items.length > 1}
          onEditDetails={onEditDetails}
          onEdit={onEdit}
          onPickCover={onPickCover}
          onSetDisplay={items.length > 0 ? onSetDisplay : undefined}
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
  display,
  canPickCover,
  onEditDetails,
  onEdit,
  onPickCover,
  onSetDisplay,
  onDelete,
}: {
  open: boolean;
  onClose: () => void;
  display: ListCoverStyle;
  canPickCover: boolean;
  onEditDetails?: () => void;
  onEdit?: () => void;
  onPickCover?: () => void;
  onSetDisplay?: (display: ListCoverStyle) => void;
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
          style={[
            styles.sheet,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}
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
          {/* The artwork: four covers or one, and — with one — which. */}
          {onSetDisplay &&
            (display === 'single' ? (
              <MenuRow
                icon="grid-outline"
                label="Show the first four covers"
                onPress={() => run(() => onSetDisplay('mosaic'))}
              />
            ) : (
              <MenuRow
                icon="image-outline"
                label="Show one cover"
                onPress={() => run(() => onSetDisplay('single'))}
              />
            ))}
          {canPickCover && onPickCover && (
            <MenuRow
              icon="images-outline"
              label="Choose the cover"
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

  /* A menu row: flat until pressed, then a soft inset fill — the rounded ends
     show because the row sits inset from the sheet's edges. */
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      scaleTo={0.98}
      pressedColor={danger ? withAlpha(theme.danger, 0.12) : theme.pressed}
      style={StyleSheet.flatten([styles.menuRow, { backgroundColor: 'transparent' }])}>
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

/**
 * The one cover a collection shows, or null when it shows several. The screen
 * reads it too — the page colour comes from this game's box art — so the two
 * cannot disagree about which game it is.
 *
 * One cover either because the owner chose it (`cover_style`, 0033) or because
 * the mosaic has only one to draw: a collection of one game, which the mosaic
 * fills with that cover anyway. Both are drawn the same way and both colour the
 * page — what decides it is how many covers are on screen, not which setting
 * put them there. This used to ask only for the setting, so a one-game
 * collection drew a single cover over the app's own page, and on a database
 * without 0033, where nothing can be `single`, no collection ever took a colour.
 *
 * Not for an award show's mosaic: even with one winner it is a darkened cover
 * under a trophy — the mark that says it is a show — rather than plain art.
 */
export function collectionCover(collection: ListWithItems): ListCover | null {
  const items = collection.items ?? [];
  if ((collection.cover_style ?? 'mosaic') === 'single') {
    return singleCover(items, collection.cover_game_id);
  }
  if (collection.kind === 'awards') return null;

  /* The same art `<CollectionMosaic>` keeps — the first four, minus any with
     nothing to draw — so this is one exactly when the mosaic would be. */
  const art = coversFrom(items).filter((cover) => !!(cover.cover_url ?? cover.hero_url));
  return art.length === 1 ? art[0] : null;
}

/**
 * The one cover a single-cover collection shows: the owner's pick while it is
 * still in the list, otherwise the first item with art — `resolvePreview` in
 * `api/lists.ts`, over the full items the page has rather than the summary's.
 */
function singleCover(items: ListItem[], chosenId: string | null): ListCover | null {
  const games = items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is NonNullable<typeof game> => !!(game?.cover_url ?? game?.hero_url));
  const game = games.find((entry) => entry.id === chosenId) ?? games[0];
  return game
    ? { id: game.id, title: game.title, cover_url: game.cover_url, hero_url: game.hero_url }
    : null;
}

const styles = StyleSheet.create({
  cover: { position: 'relative', width: '100%', overflow: 'hidden' },
  coverArt: { position: 'absolute' },
  single: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  /* `height` is supplied inline — `SCRIM_RATIO` of the artwork, from the bottom. */
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },

  /* The reference's title block: 20 in from each side, 16 up from the edge
     (`x24`, the ladder's 15), and 4 then 2 between its lines. */
  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.x32,
    paddingBottom: Spacing.x24,
  },
  title: { textAlign: 'center' },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8, marginTop: 2 },
  meta: { textAlign: 'center' },

  /* Centred in the column, whatever the description beneath does. */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x12,
  },
  /* `AlbumScreen.kt`'s Play pill: 48 tall, at least 110 wide, 20 at the sides,
     12 from the circles either side of it. */
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    height: PILL_HEIGHT,
    minWidth: 110,
    paddingHorizontal: Spacing.x20,
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

  /* Start-aligned across the column: a paragraph, not a caption. */
  about: { alignSelf: 'stretch' },

  backdrop: { flex: 1, justifyContent: 'flex-end' },
  /* The menu surface: `Radius.sheet` and a hairline on the three sides that
     meet the scrim. */
  sheet: {
    borderTopLeftRadius: Radius.sheet,
    borderTopRightRadius: Radius.sheet,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    paddingVertical: Spacing.x16,
    paddingHorizontal: Spacing.x8,
  },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    minHeight: TapTarget + Spacing.x4,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
});
