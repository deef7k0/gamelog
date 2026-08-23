import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { ProfileView } from '@/components/profile-view';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useTopBarScroll } from '@/hooks/use-screen-chrome';
import { useAuth } from '@/store/auth';

export default function MyProfileScreen() {
  const router = useRouter();
  const { scrollY, onScroll } = useTopBarScroll();
  const userId = useAuth((state) => state.session?.user.id);
  const signOut = useAuth((state) => state.signOut);

  if (!userId) {
    // Should be unreachable behind the auth guard, but avoids rendering a
    // profile for `undefined` if the session ever drops mid-render.
    return (
      <Screen edges={[]}>
        <EmptyState title="Not signed in" />
      </Screen>
    );
  }

  return (
    /*
     * Titleless on purpose. The banner and the name are directly underneath and
     * the bottom tab already says where you are, so a word up here would be the
     * third answer to a question nobody asked. What the bar is doing is the
     * other half of its job: keeping the status bar legible over whatever
     * artwork someone has set as their banner.
     */
    <Screen edges={[]} topBar={<FrostedTopBar scrollY={scrollY} />}>
      <ProfileView
        profileId={userId}
        onScroll={onScroll}
        headerAction={
          <View style={styles.actions}>
            <View style={styles.action}>
              <Button
                title="Edit profile"
                variant="secondary"
                onPress={() => router.push('/edit-profile')}
                fullWidth
              />
            </View>
            <View style={styles.action}>
              <Button title="Sign out" variant="ghost" onPress={signOut} fullWidth />
            </View>
          </View>
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: Spacing.x12 },
  action: { flex: 1 },
});
