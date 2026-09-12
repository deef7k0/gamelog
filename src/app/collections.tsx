import { StyleSheet, View } from 'react-native';

import { DiscoverCollections } from '@/components/discover-lists';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

/**
 * The most-liked collections, in full.
 *
 * The sibling of `reviews.tsx`, and it exists for the same reason: a popularity
 * chart is not a search scope, so it stopped being a tab in Search and became a
 * band with a page behind it.
 *
 * Favourites and wishlists never appear here — they are per-user state the
 * profile renders itself, and charting them would publish everyone's wishlist.
 */
export default function CollectionsScreen() {
  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      <View style={styles.head}>
        <Text variant="h1" accessibilityRole="header">
          Collections
        </Text>
        <Text variant="bodySmall" color="textMuted">
          Lists people are building, ranked by likes.
        </Text>
      </View>

      <DiscoverCollections />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x12, gap: Spacing.x4 },
});
