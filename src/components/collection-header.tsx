import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
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

/**
 * The two actions under the art: the reference album's 48dp circles
 * (`Modifier.size(48.dp).clip(CircleShape)`), 12 apart, glyphs at 22.
 */
const ACTION = 48;
const ACTION_GLYPH = 22;
/**
 * What an action is filled with: white at 12%, the reference's
 * `Color.White.copy(alpha = 0.12f)`. A wash of the ink rather than a grey of
 * the app's, because the page under it is a different colour for every
 * collection with one cover — a translucent fill is a step up from whichever.
 */
const ACTION_FILL = 0.12;
/** The owner's picture in the byline. */
const AVATAR = 36;

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
  /**
   * The page colour the artwork melts into — the immersive colour of a single
   * cover (`useImmersiveBackground`), or null for the app's own page, which is
   * what a mosaic of several covers always uses. The screen fills with the same
   * value.
   */
  pageColor?: string | null;
  /** Like count and whether the viewer is one of them. */
  engagement?: Engagement;
  onShare?: () => void;
};

/**
 * Collection masthead — the owner's layout, top to bottom:
 *
 * ```
 * [               ART                ]   back at its top left, and — for
 * [        Collection title          ]   its owner — Edit at its top right
 *      Collection type · x games
 *
 * (picture) username        (share) (like)
 * About
 * ```
 *
 * Half a screen of artwork — four covers, or the one the owner chose — melting
 * into the page through a smoothstep scrim over its bottom 70%, with the name
 * and what it is set *over* the bottom of it, centred. That much is SimpMusic's
 * album header, read from `AlbumScreen.kt`. Under it, on the page's solid
 * colour, one row: who made it on the left, share and like on the right. Then
 * the description. The sort tools and the games are the screen's, below.
 *
 * ## What the owner changed, and it is three things
 *
 * **The byline came off the art.** It was the middle line of the title stack —
 * name, owner, kind — printed over the cover. It is under the art now, on solid
 * ground, at the left of a row of its own: a person is somebody to go and see,
 * and that is a control, not a caption.
 *
 * **Like is no longer the page's one big button.** The row was circle, white
 * pill, circle — share, a filled "Like" pill in the reference's Play slot, and
 * an overflow. The pill is gone: share and like are the reference's two quiet
 * 48dp circles at the right of the byline's row, and the like carries its count
 * beside its heart once it has one.
 *
 * **The owner's menu left the row for the top of the screen.** Rename, add
 * games, change the cover, delete: SimpMusic's album keeps "more" in a glass
 * control at the top right, opposite the back button, and that is where it is —
 * the screen's top bar, as a `<TopBarDisc>`. So this component no longer knows
 * whether the viewer owns the collection: the menu is `<CollectionOwnerMenu>`,
 * exported below, and the screen that owns the top bar opens it. The row here
 * measures the same for everybody.
 *
 * ## One left edge
 *
 * The byline, the description, the sort tools and the games all start on the
 * page's margin. The body used to be the reference's own column, 32 in, which
 * suited a row centred on the art's axis; a row with a name at one end and
 * buttons at the other belongs to the edges the list under it keeps.
 *
 * ## The page takes a single cover's colour
 *
 * With one cover — the owner's choice, or the only one a collection has
 * (`collectionCover`) — the screen fills with that cover's immersive colour
 * (`useImmersiveBackground`) and the scrim melts into it; with a mosaic of
 * several it stays the app's own page, since several covers have no one colour.
 * The colour is the background's alone — the actions keep a neutral wash.
 *
 * ## The fade is a ramp, not a blur
 *
 * A blurred copy of the artwork revealed through a mask is the game page's
 * treatment and belongs there, where the subject is one photographic key art.
 * A collection's artwork is a 2×2 grid of covers, and blurring it produced four
 * smeared rectangles whose seams were still visible. A plain ramp to the page
 * colour is what the reference uses and it is the honest one: the artwork does
 * not dissolve, the page takes over underneath it.
 */
export function CollectionHeader({
  collection,
  owner,
  pageColor = null,
  engagement,
  onShare,
}: CollectionHeaderProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();
  const sections = useSectionMetrics();

  const items = collection.items ?? [];
  const covers = coversFrom(items);
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

  const actionFill = withAlpha(theme.text, ACTION_FILL);
  const ownerName = owner ? displayNameFor(owner) : null;

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

        {/* Keeps the status bar and the glass discs legible over a bright cover. */}
        <LinearGradient
          colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
          style={styles.scrim}
          pointerEvents="none"
        />

        {/*
          The name and what it is, set over the artwork.

          Anchored to the bottom of the cover block rather than placed after it,
          so they sit on ground the fade has already darkened — printed on the
          cover rather than captioned beneath it. `paddingBottom` is what keeps
          them clear of the very bottom edge, where the ramp is fully the page
          and the text would look like it had fallen out of the image.

          Two lines of the reference's three: the name, then the kind and count
          at 77% white — "2007 • Album" in SimpMusic, "Collection · 12 games"
          here. Its middle line, the artist, is this collection's owner, and the
          owner asked for that under the art.
        */}
        <View style={styles.titleBlock} pointerEvents="none">
          <Text variant="display" numberOfLines={2} style={styles.title} accessibilityRole="header">
            {collection.title}
          </Text>

          <Text variant="body" style={[styles.meta, { color: withAlpha(theme.text, META_ALPHA) }]}>
            {collectionKindLabel(collection)} · {items.length}{' '}
            {items.length === 1 ? 'game' : 'games'}
          </Text>
        </View>
      </View>

      {/* Under the art, on the page's own colour, at the page's margin — the
          left edge the sort tools and the games below it keep. */}
      <View style={[styles.body, { paddingTop: sections.cardGap }]}>
        {/*
          Who made it, and the two things a reader can do about it.

          The byline is only as wide as its picture and its name, so a press in
          the empty middle of the row is a press on nothing. A long name gives
          way before the buttons do.
        */}
        <View style={styles.byRow}>
          {owner && ownerName ? (
            <Link href={{ pathname: '/profile/[id]', params: { id: owner.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${ownerName}'s profile`}
                scaleTo={0.98}
                style={StyleSheet.flatten(styles.byline)}>
                <Avatar uri={owner.avatar_url} name={ownerName} size={AVATAR} />
                <Text variant="itemTitle" numberOfLines={1} style={styles.bylineName}>
                  {ownerName}
                </Text>
              </PressableScale>
            </Link>
          ) : (
            /* Holds the row's height, and the actions at its right, while the
               owner is still being fetched. */
            <View style={styles.bylineSpacer} />
          )}

          <View style={styles.actions}>
            {onShare && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Share this collection"
                onPress={onShare}
                pressedColor={theme.pressed}
                scaleTo={0.92}
                style={StyleSheet.flatten([styles.action, { backgroundColor: actionFill }])}>
                <Ionicons name="share-outline" size={ACTION_GLYPH} color={theme.text} />
              </PressableScale>
            )}

            {/*
              The like: a circle while nobody has liked it, and the same circle
              drawn out to hold its count once somebody has.

              Liked is the app's amber and a solid heart — `liked`, never
              `danger`, which means "this destroys something". The solid-versus-
              outline glyph is the second carrier, so the state never rests on
              hue alone; the count stays in the ink, because it is everybody's
              number and not a statement about the reader.
            */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={
                likeCount > 0
                  ? `${liked ? 'Unlike' : 'Like'} this collection. ${likeCount} ${likeCount === 1 ? 'like' : 'likes'}.`
                  : `${liked ? 'Unlike' : 'Like'} this collection`
              }
              accessibilityState={{ selected: liked }}
              onPress={toggle}
              pressedColor={theme.pressed}
              scaleTo={0.92}
              style={StyleSheet.flatten([
                styles.action,
                likeCount > 0 && styles.actionCounted,
                { backgroundColor: actionFill },
              ])}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={ACTION_GLYPH}
                color={liked ? theme.liked : theme.text}
              />
              {likeCount > 0 && <Text variant="button">{likeCount}</Text>}
            </PressableScale>
          </View>
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

export type CollectionOwnerMenuProps = {
  open: boolean;
  onClose: () => void;
  collection: ListWithItems;
  /** Rename the collection and rewrite its About. */
  onEditDetails?: () => void;
  /** Add games. */
  onEdit?: () => void;
  /** Enter the "tap a game to use its cover" mode. */
  onPickCover?: () => void;
  /** Switch between four covers and one. */
  onSetDisplay?: (display: ListCoverStyle) => void;
  onDelete?: () => void;
};

/**
 * Everything an owner can do to a collection, on a sheet.
 *
 * Opened from the top right of the screen — a glass disc opposite the back
 * button, where SimpMusic's album keeps its "more" — and rendered by the screen
 * that owns that bar, which is why it is exported and why the masthead above
 * knows nothing about it.
 *
 * These are administration — rename it, add to it, change its cover, delete
 * it — and none of them is what a person opening a collection came to do. In
 * the masthead's own row they cost a wrapped second line on every phone and put
 * a delete button a thumb's width from the like.
 */
export function CollectionOwnerMenu({
  open,
  onClose,
  collection,
  onEditDetails,
  onEdit,
  onPickCover,
  onSetDisplay,
  onDelete,
}: CollectionOwnerMenuProps) {
  const theme = useTheme();

  const count = (collection.items ?? []).length;
  const display = collection.cover_style ?? 'mosaic';
  /* Which cover, only once there is one cover and more than one game to pick it from. */
  const canPickCover = !!onPickCover && display === 'single' && count > 1;
  /* Four covers or one, only once there is a game to draw. */
  const setDisplay = count > 0 ? onSetDisplay : undefined;

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
          {setDisplay &&
            (display === 'single' ? (
              <MenuRow
                icon="grid-outline"
                label="Show the first four covers"
                onPress={() => run(() => setDisplay('mosaic'))}
              />
            ) : (
              <MenuRow
                icon="image-outline"
                label="Show one cover"
                onPress={() => run(() => setDisplay('single'))}
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
     (`x24`, the ladder's 15), and 4 between its two lines. */
  titleBlock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x32,
    paddingBottom: Spacing.x24,
  },
  title: { textAlign: 'center' },
  meta: { textAlign: 'center' },

  /* The page's margin: one left edge for the byline, the description, the sort
     tools and the games. */
  body: { paddingHorizontal: Spacing.x16 },
  byRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x12,
    minHeight: ACTION,
  },
  /* Shrinks, so a long name is cut before the buttons are pushed off the row;
     never grows, so the link is no wider than what it shows. */
  byline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    flexShrink: 1,
    minHeight: ACTION,
  },
  bylineName: { flexShrink: 1 },
  bylineSpacer: { flex: 1 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* `AlbumScreen.kt`'s action circles: 48 across, fully round. */
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    minWidth: ACTION,
    height: ACTION,
    borderRadius: ACTION / 2,
  },
  /* With a count beside the heart the circle is a capsule, and the two need
     room at its ends that a lone glyph did not. */
  actionCounted: { paddingHorizontal: Spacing.x16 },

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
