import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAuth } from '@/store/auth';

export default function SignInScreen() {
  const theme = useTheme();
  const signIn = useAuth((state) => state.signIn);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit() {
    setError(null);

    if (!email.trim() || !password) {
      setError('Enter your email and password.');
      return;
    }

    setBusy(true);
    try {
      await signIn(email, password);
      // No navigation needed: the root layout's guard swaps to the tabs as soon
      // as the session lands.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not sign in.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['top', 'bottom']} padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: theme.text }]}>GameLog</Text>
            <Text style={[styles.subtitle, { color: theme.textSecondary }]}>
              Track what you play. See what your friends are playing.
            </Text>
          </View>

          <View style={styles.form}>
            <TextField
              label="Email"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              placeholder="you@example.com"
              editable={!busy}
            />

            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="current-password"
              placeholder="••••••••"
              editable={!busy}
              error={error}
              onSubmitEditing={handleSubmit}
              returnKeyType="go"
            />

            <Button title="Sign in" onPress={handleSubmit} loading={busy} fullWidth />
          </View>

          <View style={styles.footer}>
            <Text style={{ color: theme.textSecondary }}>New here? </Text>
            <Link href="/sign-up" style={[styles.link, { color: theme.primary }]}>
              Create an account
            </Link>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    gap: Spacing.x24,
    paddingVertical: Spacing.x24,
  },
  header: { gap: Spacing.x8 },
  title: { ...Type.display },
  subtitle: { ...Type.body },
  form: { gap: Spacing.x12 },
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  link: { fontFamily: FontFamily.semibold },
});
