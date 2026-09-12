import { StyleSheet, View } from 'react-native';

import { DiscoverReviews } from '@/components/discover-lists';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';

/**
 * The most-liked writing on GameLog, in full.
 *
 * Exists because Reviews stopped being a tab in Search. It was one of four
 * there, and it was the odd one out twice over: the search field could not
 * filter it, and it duplicated a band Home already had. As a route it is the
 * "See all" for both of those bands and nothing else, which is a page that can
 * be linked to and arrived at rather than a mode you have to know to switch on.
 *
 * States its own heading in content, because there is no header anywhere in this
 * app and a screen that opens on a list has nothing else to name it.
 */
export default function ReviewsScreen() {
  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      <View style={styles.head}>
        <Text variant="h1" accessibilityRole="header">
          Reviews
        </Text>
        <Text variant="bodySmall" color="textMuted">
          The most-liked writing on GameLog. Only logs with words in them are ranked.
        </Text>
      </View>

      <DiscoverReviews />
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { paddingHorizontal: Spacing.x16, paddingBottom: Spacing.x12, gap: Spacing.x4 },
});
