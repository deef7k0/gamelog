import { DiscoverCollections } from '@/components/discover-lists';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Screen } from '@/components/ui/screen';

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
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Collections" />}>
      <DiscoverCollections />
    </Screen>
  );
}
