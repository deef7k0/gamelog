import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { ControlHeight, Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { signInWithProvider, type OAuthProvider } from '@/lib/oauth';

/**
 * How you want to sign in.
 *
 * ## Why these buttons are not `<Button>`
 *
 * `<Button>` is the app's control: one grey pill for every action. Every rule
 * behind that holds — and none of it applies to a row of *other companies'
 * identity marks*. Google publishes brand guidance that requires its own
 * colours on its own button; Facebook does the same. Painting both in the app's
 * grey would make them look like GameLog features rather than doorways out to
 * somebody else, which is the one thing a sign-in row has to be unambiguous
 * about.
 *
 * So this screen renders a local `<ProviderButton>` and does not reach for the
 * shared one. That keeps the exception where it is argued rather than adding a
 * brand variant to `<Button>` that every other screen would then be able to
 * use. The shape is shared — the same 52dp pill — and the email option, the one
 * choice here that is *ours*, is the app's own grey button.
 *
 * ## The providers are configuration, not code
 *
 * Google and Facebook each need a client id and secret set in the Supabase
 * dashboard with this app's redirect registered against them. Until that is
 * done the browser opens, the provider refuses, and `signInWithProvider` throws
 * with the provider's own message — which is shown here rather than swallowed.
 * Nothing on this screen can enable a provider.
 */
export default function SignInOptionsScreen() {
  const router = useRouter();
  const theme = useTheme();

  const [busy, setBusy] = useState<OAuthProvider | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleProvider(provider: OAuthProvider) {
    setError(null);
    setBusy(provider);
    try {
      /* `false` means the reader closed the browser, which is a decision rather
         than a failure — no banner, no message, just back to the choices. */
      await signInWithProvider(provider);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <Screen edges={['bottom']} insetHeader padded topBar={<FrostedTopBar back />}>
      <View style={styles.root}>
        <Text variant="h1" accessibilityRole="header">
          Log in with
        </Text>

        <View style={styles.options}>
          <ProviderButton
            icon="logo-google"
            label="Continue with Google"
            fill="#FFFFFF"
            ink="#1F1F1F"
            busy={busy === 'google'}
            disabled={busy !== null}
            onPress={() => handleProvider('google')}
          />

          <ProviderButton
            icon="logo-facebook"
            label="Continue with Facebook"
            fill="#1877F2"
            ink="#FFFFFF"
            busy={busy === 'facebook'}
            disabled={busy !== null}
            onPress={() => handleProvider('facebook')}
          />

          {/*
            Ours, so it is the app's own secondary control rather than a brand's
            slab — and it is a route rather than a provider call: email sign-in
            is a form, and the form already exists.
          */}
          <ProviderButton
            icon="mail-outline"
            label="Continue with email"
            fill={theme.controlFill}
            ink={theme.controlInk}
            disabled={busy !== null}
            onPress={() => router.push('/sign-in')}
          />
        </View>

        {!!error && (
          <Text variant="bodySmall" color="danger" style={styles.error}>
            {error}
          </Text>
        )}

        <View style={styles.footer}>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel="I don’t have an account. Create one."
            onPress={() => router.push('/sign-up')}
            hitSlop={FOOTER_SLOP}
            scaleTo={0.98}>
            <Text variant="body" style={{ color: theme.primaryText }}>
              I don’t have an account
            </Text>
          </PressableScale>
        </View>
      </View>
    </Screen>
  );
}

/** Lifts the one-line footer link to the platform floor without moving the words. */
const FOOTER_SLOP = { top: 16, bottom: 16, left: 24, right: 24 };

/**
 * One way in.
 *
 * A pill carrying somebody else's mark in that brand's own colours, or — for
 * the one option that is ours — the app's own grey button, carrying no brand at
 * all. All three take the button shape, so they read as one set; the brand
 * colours stay because a sign-in button is recognised by them. The glyph sits at the leading
 * edge and the label centres in the button, which is the shape every platform's
 * sign-in row uses and therefore the shape a reader recognises before reading it.
 *
 * `busy` replaces the glyph rather than the label, so the button does not change
 * width mid-press and the row does not reflow while a browser is opening.
 */
function ProviderButton({
  icon,
  label,
  fill,
  ink,
  busy = false,
  disabled = false,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  fill: string;
  ink: string;
  busy?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const accent = useAccent();

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled, busy }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.98}
      pressedColor={fill === theme.controlFill ? theme.controlPressed : undefined}
      focusRing={accent.ring}
      style={StyleSheet.flatten([
        styles.provider,
        { backgroundColor: fill },
        /* Dimmed as a set while any one of them is working, so it is visible
           that the screen is busy rather than that one button is broken. */
        disabled && !busy && styles.dimmed,
      ])}>
      <View style={styles.providerGlyph}>
        {busy ? (
          <ActivityIndicator size="small" color={ink} />
        ) : (
          <Ionicons name={icon} size={20} color={ink} />
        )}
      </View>
      <Text variant="h5" style={[styles.providerLabel, { color: ink }]} numberOfLines={1}>
        {label}
      </Text>
      {/* Balances the glyph so the label centres on the button rather than on
          the space left over beside it. */}
      <View style={styles.providerGlyph} />
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: Spacing.x24, gap: Spacing.x24 },
  options: { gap: Spacing.x12 },
  /* The app's button shape — a 52dp full pill — in each brand's own colours,
     and the app's own grey for the one option that is ours. */
  provider: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: ControlHeight.medium,
    paddingHorizontal: Spacing.x20,
    borderRadius: Radius.pill,
  },
  /* Fixed, and the same on both ends — see the spacer at the end of the row. */
  providerGlyph: { width: 24, alignItems: 'center', justifyContent: 'center' },
  providerLabel: { flex: 1, textAlign: 'center' },
  dimmed: { opacity: 0.45 },
  error: { textAlign: 'center' },
  /* Pushed to the bottom of the screen: the three ways in are the content, and
     "no account yet" is the way out of them. */
  footer: { marginTop: 'auto', alignItems: 'center', paddingBottom: Spacing.x16 },
});
