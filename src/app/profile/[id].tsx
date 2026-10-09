import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileView } from '@/components/profile-view';
import { FrostedTopBar, TOP_BAR_DISC, TOP_BAR_EDGE } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing, TopBarHeight } from '@/constants/theme';
import { useTopBarInset } from '@/hooks/use-header-height';
import { getProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';

/**
 * Someone else's profile: the back disc, their handle beside it, then
 * `<ProfileView>`.
 *
 * ## The row the disc is in
 *
 * This screen was pushed, so it keeps the floating back disc where every pushed
 * screen has it. What is new is what stands beside it. The profile's tabs are at
 * the top of the screen now — the owner's reference puts them under a title bar
 * — and a row of tabs that started in the disc's own corner would have its
 * first one under the glass. So the disc's row is given to the person's handle,
 * centred, as your own profile's bar is given to yours, and the tabs start
 * under it: back, name, tabs, the reference's three lines in the app's own
 * pieces.
 *
 * It is the one pushed screen with a word in that row. The rule that screens
 * state their heading in their content still holds here — this *is* the
 * content's first line, drawn where the disc already reserves the height; it is
 * not a bar, has no fill and takes no touches.
 */
export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const inset = useTopBarInset();

  /* The same key `<ProfileView>` reads, so this is the cache, not a request. */
  const profile = useQuery({
    queryKey: ['profile', id],
    queryFn: () => getProfile(id!),
    enabled: !!id,
  });
  const handle = profile.data?.username || (profile.data ? displayNameFor(profile.data) : '');

  return (
    <Screen edges={[]} topBar={<FrostedTopBar back />}>
      <View
        style={[styles.band, { height: TopBarHeight + inset, paddingTop: inset }]}
        pointerEvents="none">
        <Text variant="h3" numberOfLines={1} style={styles.handle} accessibilityRole="header">
          {handle}
        </Text>
      </View>

      {id ? <ProfileView profileId={id} /> : <EmptyState title="Profile not found" />}
    </Screen>
  );
}

const styles = StyleSheet.create({
  /* As tall as the room the disc is given (`TopBarHeight`, plus the status
     bar's inset — both set inline), and inset at both ends by the disc and its
     distance from the corner: the handle is centred on the screen and a long
     one stops short of the glass. */
  band: {
    justifyContent: 'center',
    paddingHorizontal: TOP_BAR_EDGE + TOP_BAR_DISC + Spacing.x8,
  },
  handle: { textAlign: 'center' },
});
