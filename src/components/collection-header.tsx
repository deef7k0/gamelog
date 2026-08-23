import Ionicons from '@expo/vector-icons/Ionicons';
import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import { Link } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { CollectionMosaic } from '@/components/collection-mosaic';
import { Avatar } from '@/components/ui/avatar';
import { BLUR_RADIUS, FADE_HEIGHT, RAMP_COLORS, RAMP_STOPS } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Palette, Radius, Spacing, TapTarget, withAlpha } from '@/constants/theme';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { Engagement, ListItem, ListWithItems } from '@/lib/api';
import type { Profile } from '@/lib/database.types';

/**
 * How much of the display the artwork block occupies.
 *
 * A bit under half, which is the proportion the reference sets and a different
 * question from `HeroHeightRatio`'s 0.38 on the game page. The two screens open
 * differently on purpose: a game leads with landscape key art above a case and a
 * synopsis, so its art is a band. A collection leads with a *square* of four
 * covers and everything under it is centred on the axis that square establishes,
 * so the art has to be big enough to read as the subject rather than as a
 * header image.
 */
const COVER_RATIO = 0.46;

/**
 * The masthead title, in points.
 *
 * Larger than `Type.display`'s 26, and set here rather than added to the scale
 * because it is one screen's opening statement rather than a step anything else
 * should reach for. The name is the single most important thing on the page and
 * it is competing with a half-screen of box art directly above it; at 26 it read
 * as a caption under the artwork instead of as the page's subject.
 */
const TITLE_SIZE = 32;
const TITLE_LINE = 38;

/** The one filled action. Diameter in dp. */
const PRIMARY_BUTTON = 72;
/**
 * Every outlined action beside it.
 *
 * 48 rather than the 52 the reference measures at, because an owner sees five
 * of these and the reference's subject saw three. Four secondaries plus the
 * primary plus four gaps is 312dp, which clears a 360dp-wide Android phone's
 * 324dp of usable width; at 52 it came to 328 and overflowed by four. Still
 * comfortably past the 44dp tap-target floor.
 */
const SECONDARY_BUTTON = 48;

export type CollectionHeaderProps = {
  collection: ListWithItems;
  owner: Profile | null;
  isOwner: boolean;
  /** Like count and whether the viewer is one of them. */
  engagement?: Engagement;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
  /** Enter the "tap a game to use its cover" mode. Owner-only. */
  onPickCover?: () => void;
};

/**
 * Collection masthead — artwork, name, stats, description, actions.
 *
 * ## The shape
 *
 * A near-half-screen block of artwork that dissolves into the page, then
 * everything else centred on its axis: the name at display size, one line of
 * stats, the description, and a row of circular actions with the primary one
 * filled and twice the size of its neighbours. It is the artist-page
 * arrangement, and it suits a collection for the same reason it suits an artist:
 * the thing has a face, a name, two numbers worth knowing, and a small number of
 * things you can do with it. The previous version stacked a left-aligned title,
 * a byline, a metadata row, tags and a wrapping row of outlined buttons, which
 * is five left edges and no focal point.
 *
 * ## The fade is the game page's, not a copy of it
 *
 * `<HeroArt>` dissolves a blurred copy of the art into the sharp one through a
 * gradient mask, then ramps to the page colour. That component takes a single
 * `uri` and a collection's artwork is a 2×2 mosaic, so this cannot call it — but
 * it imports `BLUR_RADIUS`, `RAMP_STOPS`, `RAMP_COLORS` and `FADE_HEIGHT` from
 * it rather than restating them, so the two screens cannot drift apart on the
 * next retune. The blurred layer is a second `<CollectionMosaic blurRadius>`,
 * which is the whole reason that prop exists.
 *
 * The mosaic stays the artwork at both sizes — the tile you tapped and this
 * banner show the same four covers, in `position` order, which is the rule that
 * makes a tile read as a small version of the thing rather than an unrelated
 * preview of it.
 *
 * The caller owns the bleed: cancel any horizontal padding on the scroll
 * container around this.
 */
export function CollectionHeader({
  collection,
  owner,
  isOwner,
  engagement,
  onEdit,
  onDelete,
  onShare,
  onPickCover,
}: CollectionHeaderProps) {
  const theme = useTheme();
  const { width, height } = useWindowDimensions();

  const items = collection.items ?? [];
  const covers = coversFrom(items);
  const tags = collection.tags ?? [];
  const isAwards = collection.kind === 'awards';

  const { liked, likeCount, toggle } = useLikeToggle('list', collection.id, engagement);

  /*
   * The mosaic is square and the block is not, so it is sized to cover the
   * block's longer axis and centred on both — a centre crop rather than a
   * stretch. On a phone the block is very nearly square already and the offsets
   * come out at zero; on a tablet the square is far taller than the block and
   * the vertical offset is what keeps the crop centred instead of top-anchored.
   */
  const coverHeight = Math.round(height * COVER_RATIO);
  const mosaicSize = Math.max(width, coverHeight);
  const offsetX = Math.round((width - mosaicSize) / 2);
  const offsetY = Math.round((coverHeight - mosaicSize) / 2);

  const artwork = (blurRadius: number) => (
    <View style={[styles.coverArt, { left: offsetX, top: offsetY }]}>
      <CollectionMosaic
        covers={covers}
        size={mosaicSize}
        title={collection.title}
        rounded="none"
        award={isAwards}
        blurRadius={blurRadius}
      />
    </View>
  );

  return (
    <View>
      <View style={[styles.cover, { height: coverHeight }]}>
        {artwork(0)}

        {/* The blurred copy, revealed through the ramp's alpha. Only when there
            is real artwork: the empty-state mosaic is a flat fill behind a
            letter, and blurring that produces a slightly different flat fill
            with a seam where the mask ends. */}
        {covers.length > 0 && (
          <MaskedView
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
            maskElement={
              <LinearGradient colors={RAMP_COLORS} locations={RAMP_STOPS} style={styles.fill} />
            }>
            {artwork(BLUR_RADIUS)}
          </MaskedView>
        )}

        {/* Weighted dark in the middle rather than a straight ramp — a linear
            fade spends its first half barely tinting anything and then closes
            the whole distance at once, which on artwork reads as the art
            dropping off a shelf. Every stop ends on a colour at an explicit
            alpha, never the keyword `transparent`: expo-linear-gradient
            premultiplies on Android and would fade the keyword through black. */}
        <LinearGradient
          colors={[
            withAlpha(theme.background, 0),
            withAlpha(theme.background, 0.72),
            theme.background,
          ]}
          locations={[0, 0.55, 1]}
          style={[styles.fade, { height: `${FADE_HEIGHT * 100}%` }]}
          pointerEvents="none"
        />

        {/* Darkens the top so the floating back arrow stays legible over a
            bright cover. */}
        <LinearGradient
          colors={[withAlpha(Palette.shadowInk, 0.5), withAlpha(Palette.shadowInk, 0)]}
          style={styles.scrim}
          pointerEvents="none"
        />
      </View>

      <View style={styles.body}>
        <Text
          variant="display"
          numberOfLines={2}
          style={StyleSheet.flatten([styles.centred, styles.title])}>
          {collection.title}
        </Text>

        {/* The two numbers worth knowing, on one line, in the order the
            reference sets: what it holds, then how it has landed. */}
        <Text variant="body" color="textSecondary" style={styles.centred}>
          {items.length} {items.length === 1 ? 'game' : 'games'} · {likeCount}{' '}
          {likeCount === 1 ? 'like' : 'likes'}
        </Text>

        {/* Kind and ranking sit *under* the stats rather than above the title.
            A label over a heading is a kicker, and the heading here does not
            need help — but which of the three shapes this is genuinely changes
            what you are looking at, so it cannot simply be dropped. */}
        {(isAwards || collection.kind === 'tier' || collection.is_ranked) && (
          <View style={styles.kindRow}>
            {isAwards && <Ionicons name="trophy" size={11} color={theme.identityGold} />}
            <Text
              variant="label"
              color={isAwards ? undefined : 'textMuted'}
              style={isAwards ? { color: theme.identityGold } : undefined}>
              {isAwards ? 'AWARD SHOW' : collection.kind === 'tier' ? 'TIER LIST' : 'RANKED'}
            </Text>
          </View>
        )}

        {/* About: who made it, then what they said about it. */}
        {owner && (
          <Link href={{ pathname: '/profile/[id]', params: { id: owner.id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.98} style={styles.creator}>
              <Avatar uri={owner.avatar_url} name={displayNameFor(owner)} size={24} />
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {displayNameFor(owner)}
              </Text>
            </PressableScale>
          </Link>
        )}

        {collection.description && (
          <Text variant="body" color="textSecondary" style={styles.centred}>
            {collection.description}
          </Text>
        )}

        {tags.length > 0 && (
          <View style={styles.tags}>
            {tags.map((tag) => (
              <View key={tag} style={[styles.tag, { borderColor: theme.border }]}>
                <Text variant="caption" color="textSecondary">
                  {tag}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/*
          The action row. Liking is the filled one because it is the only
          control here with a state to be in, and because it is what a reader
          who is not the owner came to do — the owner's four are edits to
          something that already exists. An owner sees five and the like lands
          dead centre of them; a visitor sees two.
        */}
        <View style={styles.actions}>
          {onShare && (
            <CircleAction
              icon="share-outline"
              label={`Share ${collection.title}`}
              onPress={onShare}
            />
          )}

          {isOwner && onPickCover && items.length > 1 && (
            <CircleAction
              icon="image-outline"
              label="Change the preview cover"
              onPress={onPickCover}
            />
          )}

          <CircleAction
            primary
            active={liked}
            icon={liked ? 'heart' : 'heart-outline'}
            label={liked ? 'Unlike this collection' : 'Like this collection'}
            onPress={toggle}
          />

          {isOwner && onEdit && (
            <CircleAction icon="add" label="Add games to this collection" onPress={onEdit} />
          )}

          {isOwner && onDelete && (
            <CircleAction
              icon="trash-outline"
              label="Delete this collection"
              danger
              onPress={onDelete}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * One circular action.
 *
 * `primary` is the filled white disc from the reference, and `active` flips its
 * fill to `danger` while the glyph goes solid. **Two carriers, and neither of
 * them is the fill alone** — outline-vs-solid says "liked" to a viewer who
 * cannot separate the two hues. The glyph stays near-black in both states,
 * which is also the only arrangement that measures: white ink on `danger` is
 * 3.09:1 against a 4.5:1 requirement, while near-black on it is 5.57:1.
 *
 * **The ring is always white, including on the destructive one.** A ring of
 * `danger` at 40% composites to #6C2D2D, which is 1.83:1 on the page and fails
 * the 3:1 a control boundary owes; the white ring is 3.62:1. So the delete
 * button carries its meaning on the *glyph* (5.57:1) and shares everyone else's
 * edge — which is the same rule `<Chip color>` follows, tinting the label and
 * never the container.
 */
function CircleAction({
  icon,
  label,
  onPress,
  primary = false,
  active = false,
  danger = false,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  primary?: boolean;
  active?: boolean;
  danger?: boolean;
}) {
  const theme = useTheme();
  const size = primary ? PRIMARY_BUTTON : SECONDARY_BUTTON;

  const fill = primary ? (active ? theme.danger : theme.text) : 'transparent';
  const ink = primary ? theme.background : danger ? theme.danger : theme.text;

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={primary ? { selected: active } : undefined}
      onPress={onPress}
      scaleTo={0.92}
      style={StyleSheet.flatten([
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor: fill,
          /* The outlined ones carry their edge; the filled one would be a white
             disc with a white ring around it. */
          borderWidth: primary ? 0 : 1.5,
          borderColor: withAlpha(theme.text, 0.4),
        },
      ])}>
      <Ionicons name={icon} size={primary ? 30 : 22} color={ink} />
    </PressableScale>
  );
}

/**
 * The first four items' covers, in list order.
 *
 * Mirrors `resolveMosaic` in `api/lists.ts`, which does the same job on the
 * summary row the tile is built from. Two functions rather than one because the
 * shapes genuinely differ — this walks `ListItem[]` with a full `CachedGame`
 * attached, that walks the summary's lighter embed — but they must stay in
 * agreement, because the whole point is that the tile and the banner show the
 * same four covers.
 */
function coversFrom(items: ListItem[]): { cover_url: string | null; hero_url: string | null }[] {
  return items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item) => item.game)
    .filter((game): game is NonNullable<typeof game> => game !== null)
    .map((game) => ({ cover_url: game.cover_url, hero_url: game.hero_url }))
    .slice(0, 4);
}

const styles = StyleSheet.create({
  cover: { position: 'relative', width: '100%', overflow: 'hidden' },
  coverArt: { position: 'absolute' },
  fill: { flex: 1 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  scrim: { position: 'absolute', left: 0, right: 0, top: 0, height: '22%' },

  body: {
    paddingHorizontal: Spacing.x24,
    alignItems: 'center',
    gap: Spacing.x12,
    /* Pulled up into the artwork. The fade has already resolved to the page
       colour by the time the title arrives, so this sits on `background` rather
       than on covers — it just gets there without a band of empty page between
       the art and the name. */
    marginTop: -Spacing.x48,
  },
  centred: { textAlign: 'center' },
  title: { fontSize: TITLE_SIZE, lineHeight: TITLE_LINE },
  kindRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  creator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: Spacing.x8 },
  tag: {
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x4 + 1,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /* Centred rather than spread: an owner's five and a visitor's two have to
     read as the same row, and `space-between` would fling two buttons to
     opposite edges of the display. `wrap` is the safety net for a display
     narrower than anything shipping today, or a very large system font scale:
     the row drops one button to a second centred line instead of clipping it. */
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Spacing.x16,
    marginTop: Spacing.x8,
    minHeight: TapTarget,
  },
  circle: { alignItems: 'center', justifyContent: 'center' },
});
