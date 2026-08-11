import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { HeroArt } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { displayNameFor } from '@/lib/format';
import type { ListItem, ListWithItems } from '@/lib/api';
import type { Profile } from '@/lib/database.types';

/**
 * Collection header — hero, identity, tags, actions.
 *
 * The hero is borrowed from the first item's key art rather than being an
 * uploadable field. A collection is defined by what is in it, so its most
 * prominent game is a truer cover than anything the author would pick
 * separately — and it means every collection has one from the moment it has a
 * single game, with no extra upload step or storage cost.
 *
 * Presented exactly like the masthead on a game page: full-bleed 16:9 art
 * running under the floating header and off the top of the display, faded into
 * the page, with the identity block pulled up over the tail of the fade. A
 * collection is a destination in this app, not a row in a list of them, and it
 * should open the same way its games do. The caller is responsible for the
 * bleed — cancel any horizontal padding on the scroll container around this.
 */
export function CollectionHeader({
  collection,
  owner,
  isOwner,
  onEdit,
  onDelete,
  onShare,
}: {
  collection: ListWithItems;
  owner: Profile | null;
  isOwner: boolean;
  onEdit?: () => void;
  onDelete?: () => void;
  onShare?: () => void;
}) {
  const theme = useTheme();

  const items = collection.items ?? [];
  const banner = bannerFrom(items);
  const tags = collection.tags ?? [];

  return (
    <View>
      <HeroArt uri={banner} scrim />

      <View style={styles.body}>
        {owner && (
          <Link href={{ pathname: '/profile/[id]', params: { id: owner.id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.98} style={styles.creator}>
              <Avatar uri={owner.avatar_url} name={displayNameFor(owner)} size={28} />
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {displayNameFor(owner)}
              </Text>
            </PressableScale>
          </Link>
        )}

        <Text variant="h1">{collection.title}</Text>

        {collection.description && (
          <Text variant="body" color="textSecondary">
            {collection.description}
          </Text>
        )}

        <View style={styles.metaRow}>
          <Text variant="caption" color="textMuted">
            {items.length} {items.length === 1 ? 'GAME' : 'GAMES'}
          </Text>
          {collection.is_ranked && (
            <Text variant="caption" color="textMuted">
              RANKED
            </Text>
          )}
          {collection.kind !== 'list' && (
            <Text variant="label" color="textMuted">
              {collection.kind.toUpperCase()}
            </Text>
          )}
        </View>

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

        {/* A row of outlined buttons rather than bare icon-and-label pairs:
            these are the collection's controls, and they should look as
            tappable as the "Add games" button directly beneath them. */}
        <View style={styles.actions}>
          {onShare && (
            <Button
              title="Share"
              icon="share-outline"
              variant="secondary"
              size="small"
              onPress={onShare}
            />
          )}
          {isOwner && onEdit && (
            <Button
              title="Add games"
              icon="add"
              variant="secondary"
              size="small"
              onPress={onEdit}
            />
          )}
          {isOwner && onDelete && (
            <Button
              title="Delete"
              icon="trash-outline"
              variant="danger"
              size="small"
              onPress={onDelete}
            />
          )}
        </View>
      </View>
    </View>
  );
}

/**
 * First available key art, preferring landscape.
 *
 * Portrait box art stretched across a banner looks wrong, so a collection whose
 * games only have covers falls back to a flat surface rather than a distorted
 * crop.
 */
function bannerFrom(items: ListItem[]): string | null {
  for (const item of items) {
    if (item.game?.hero_url) return item.game.hero_url;
  }
  return null;
}

const styles = StyleSheet.create({
  body: {
    paddingHorizontal: Spacing.x16,
    gap: Spacing.x12,
    marginTop: -Spacing.x24,
  },
  creator: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  metaRow: { flexDirection: 'row', gap: Spacing.x16, flexWrap: 'wrap' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  tag: {
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x4 + 1,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
  },
  /* No top rule any more: each button carries its own outline, and a divider
     above a row of outlined boxes just adds a line nothing needed. */
  actions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.x8,
    marginTop: Spacing.x4,
  },
});
