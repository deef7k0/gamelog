import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Alert, StyleSheet, View } from 'react-native';

import { ReadingLanguages } from '@/components/reading-languages';
import { SurpriseHiddenList } from '@/components/surprise-hidden-list';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PageScrollView } from '@/components/ui/page-scroll';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, Screen } from '@/components/ui/screen';
import { SelectionCard } from '@/components/ui/selection-card';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useAnimatedArtwork } from '@/hooks/use-animated-artwork';
import { useGameColours } from '@/hooks/use-game-colours';
import { useTheme } from '@/hooks/use-theme';
import { isModerator } from '@/lib/api';
import { useAuth } from '@/store/auth';

/**
 * Settings — a few sections, and each is a real one.
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
 * **Review languages** passes it too, and is here for the same reason the
 * hidden list is: it is the control for something the app otherwise does by
 * itself. The popular reviews, the people suggested and the review a game's
 * page leads with are picked in the languages the reader reads (0038,
 * `lib/language`) — worked out from the phone and from what they write, which
 * is right nearly always and silently wrong for somebody who also reads
 * French. A filter nobody can see or change is the inert control's mirror
 * image: the system doing a thing with no control for it. Every chart links
 * here from the line that says which languages it is in.
 *
 * **How ratings work** passes it for the same reason as the languages: the
 * GameLog score weights ratings by itself (0041), and somebody whose ratings
 * count a little less is owed a place that says so, why, and by how much.
 * The row is the way to that page; nothing on it can be switched off, because
 * the score is the same for everybody.
 *
 * **Game colours** passes it because it is a real switch over something the
 * app does everywhere by itself: every screen about one game is built from a
 * Material 3 scheme read off its box art (`<AccentProvider>`). Off, each of
 * them is the app's own room. The owner's (2026-10-20): "Add a setting to
 * turn off the material expressive colors in the app." Two choices, as
 * selection cards — the app's one control for a choice with words to it.
 *
 * **Animated artwork** passes it the same way: Surprise Me's card and a
 * review's hero play a game's animated cover by themselves, which costs data
 * and moves on its own. Asked at sign-up over three real examples, the
 * owner's (2026-10-21); changed here. The game page's Animated button is not
 * governed by it — that is somebody asking for one game's animation by hand.
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
  const gameColours = useGameColours();
  const animatedArtwork = useAnimatedArtwork();
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
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back title="Settings" />}>
        <EmptyState title="Settings" message="Sign in to change how the app behaves." />
      </Screen>
    );
  }

  return (
    <Screen edges={['bottom']} insetHeader padded topBar={<FrostedTopBar back title="Settings" />}>
      <PageScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        <View style={styles.group}>
          <Text variant="label" color="textMuted" accessibilityRole="header">
            GAME COLOURS
          </Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            <SelectionCard
              title="The game’s colours"
              hint="A game’s page, its reviews, Surprise Me, collections and studios take their colours from their art."
              selected={gameColours.on}
              onPress={() => gameColours.setOn(true)}
            />
            <SelectionCard
              title="GameLog’s colours"
              hint="Every screen in the app’s own dark grey, with a light grey accent, whatever the art."
              selected={!gameColours.on}
              onPress={() => gameColours.setOn(false)}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="label" color="textMuted" accessibilityRole="header">
            ANIMATED ARTWORK
          </Text>
          <View style={styles.choices} accessibilityRole="radiogroup">
            <SelectionCard
              title="Animated"
              hint="Surprise Me and a review’s art play a game’s animated cover when it has one."
              selected={animatedArtwork.on}
              onPress={() => animatedArtwork.setOn(true)}
            />
            <SelectionCard
              title="Still"
              hint="Every cover stays still, and nothing is downloaded for it. A game’s cover can still be played from its page."
              selected={!animatedArtwork.on}
              onPress={() => animatedArtwork.setOn(false)}
            />
          </View>
        </View>

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            REVIEWS
          </Text>
          <ReadingLanguages userId={userId} />
        </View>

        <View style={styles.group}>
          <Text variant="label" color="textMuted">
            RATINGS
          </Text>
          <Link href="/how-ratings-work" asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel="How ratings work, and how much your own ratings count"
              scaleTo={0.98}
              pressedColor={theme.controlPressed}
              style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
              <Ionicons name="stats-chart-outline" size={20} color={theme.textSecondary} />
              <View style={styles.rowText}>
                <Text variant="h5">How ratings work</Text>
                <Text variant="caption" color="textMuted">
                  And how much your own ratings count
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
            </PressableScale>
          </Link>
        </View>

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

            {/* The list the Must Play badge leads to, which is also where a
                moderator adds to it and takes from it (0034). */}
            <Link href="/must-play" asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel="Manage the Must Play games"
                scaleTo={0.98}
                pressedColor={theme.controlPressed}
                style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
                <Ionicons name="thumbs-up-outline" size={20} color={theme.textSecondary} />
                <View style={styles.rowText}>
                  <Text variant="h5">Must Play games</Text>
                  <Text variant="caption" color="textMuted">
                    Label games, and take labels off
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
      </PageScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: Spacing.x32, paddingTop: Spacing.x24, paddingBottom: Spacing.x48 },
  group: { gap: Spacing.x8 },
  choices: { gap: Spacing.x8 },
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
