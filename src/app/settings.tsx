import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, ScrollView, StyleSheet, View } from 'react-native';

import { SurpriseHiddenList } from '@/components/surprise-hidden-list';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { isModerator } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * Settings — one section, and it is a real one.
 *
 * This screen was deliberately empty for a long time, and the reason it gave is
 * still the rule: a settings screen listing Notifications, Privacy, Appearance
 * and Account with every one of them inert is worse than an honest blank,
 * because it invites someone to turn something off and then ignores them.
 * PRODUCT.md's second principle — never present a control for a thing the system
 * cannot actually do.
 *
 * What it holds now passes that test. The hidden-games list is the *only* undo
 * for a gesture that is otherwise permanent: double-tapping a cover in Surprise
 * Me removes that game from every future roll, and without a screen that can
 * show and reverse it, the app would have a one-way door in it. It is in
 * Settings rather than on the Surprise Me screen because it is an account-shaped
 * thing you visit occasionally, not part of a roll.
 *
 * The next real candidates are still the ones the product owes: account deletion
 * and a privacy policy, both of which PRODUCT.md records as store-release
 * requirements that do not exist yet. Neither is a row here until it works.
 *
 * **Moderation** passes the same test from the other side: it is a row only for
 * the people it works for. Everyone else never sees it — a link to a queue the
 * database would refuse them is exactly the inert control this screen avoids.
 *
 * **Sign out** is the last row. It was a button on the profile beside Edit
 * profile, a thumb's width from it; signing out is an account act you do rarely
 * and on purpose, which is what this screen is for.
 */
export default function SettingsScreen() {
  const userId = useAuth((state) => state.session?.user.id);
  const signOut = useAuth((state) => state.signOut);
  const theme = useTheme();
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

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  /* Everything here is per-account and keyed by user id. Signed out there is
     genuinely nothing to configure, which is the state this screen used to be
     in permanently. */
  if (!userId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Settings" message="Sign in to change how the app behaves." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader padded topBar={<FrostedTopBar back />}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {/* There is no header anywhere in this app, so a screen opening on a
            list states what it is in its own content. */}
        <Text variant="display" accessibilityRole="header">
          Settings
        </Text>

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            SURPRISE ME
          </Text>
          <SurpriseHiddenList userId={userId} />
        </View>

        {moderator.data === true && (
          <View style={styles.group}>
            <Text variant="label" color="textMuted">
              MODERATION
            </Text>
            <Link href="/moderation" asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel="Review community submissions"
                scaleTo={0.98}
                pressedColor={theme.controlPressed}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
                <Ionicons name="shield-checkmark-outline" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <Text variant="h5">Review queue</Text>
                  <Text variant="caption" color="textMuted">
                    Barcode submissions waiting for a decision
                  </Text>
                </View>
                <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
              </PressableScale>
            </Link>
          </View>
        )}

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            ACCOUNT
          </Text>
          {/* Confirmed first, and its failure reported — see `confirmSignOut`. */}
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Sign out"
            accessibilityState={{ busy: signingOut, disabled: signingOut }}
            disabled={signingOut}
            onPress={confirmSignOut}
            scaleTo={0.98}
            pressedColor={theme.controlPressed}
            style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
            <Ionicons name="log-out-outline" size={20} color={theme.danger} />
            <View style={styles.rowText}>
              <Text variant="h5" color="danger">
                Sign out
              </Text>
            </View>
            {signingOut && <ActivityIndicator size="small" color={theme.textMuted} />}
          </PressableScale>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.x32, paddingTop: Spacing.x24, paddingBottom: Spacing.x48 },
  group: { gap: Spacing.x8 },
  /* The same row as the hidden-games one above it: a card's corner and the
     action grey — it opens something, so it is filled, not outlined. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 1 },
});
