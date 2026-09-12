import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { ProfileView } from '@/components/profile-view';
import { Button } from '@/components/ui/button';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';

export default function MyProfileScreen() {
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id);
  const signOut = useAuth((state) => state.signOut);

  const [signingOut, setSigningOut] = useState(false);

  function confirmSignOut() {
    Alert.alert('Sign out?', 'You will need your email and password to sign back in.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          setSigningOut(true);
          try {
            await signOut();
          } catch (error) {
            /* Reported rather than swallowed. The session survives a failed
               sign-out, so silence would leave someone believing they had
               signed out on a shared device. */
            Alert.alert(
              'Could not sign out',
              error instanceof Error ? error.message : 'Check your connection and try again.'
            );
          } finally {
            setSigningOut(false);
          }
        },
      },
    ]);
  }

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
     * No top bar, and this is the one screen where that needs no qualification.
     *
     * It is a root tab, so there is nothing to go back *to* — the bottom nav is
     * the way out and it is always on screen. It has no right-hand control
     * either: Edit profile and Sign out are buttons in the header below, where
     * the things they act on are. That left a bar whose entire remaining job was
     * to exist, over the top of somebody's banner art.
     */
    <Screen edges={[]}>
      <ProfileView
        profileId={userId}
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
              {/* Confirmed, and its failure caught.
                  `onPress={signOut}` handed a promise straight to a press
                  handler: `auth.ts` throws on failure, so a sign-out that did
                  not work surfaced as an unhandled rejection while the screen
                  sat there looking signed in. It is also the most consequential
                  control on the page, sitting a thumb's width from Edit
                  profile. */}
              <Button
                title="Sign out"
                variant="ghost"
                onPress={confirmSignOut}
                loading={signingOut}
                fullWidth
              />
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
