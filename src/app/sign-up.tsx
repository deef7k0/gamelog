import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Screen } from '@/components/ui/screen';
import { Button } from '@/components/ui/button';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/store/auth';

/** Mirrors the CHECK constraint on profiles.username in 0001_init.sql. */
const USERNAME_PATTERN = /^[a-zA-Z0-9_]{3,24}$/;
const MIN_PASSWORD_LENGTH = 6;

export default function SignUpScreen() {
  const router = useRouter();
  const signUp = useAuth((state) => state.signUp);

  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  function validate(): boolean {
    const next: Record<string, string> = {};

    if (!email.trim()) next.email = 'Email is required.';
    else if (!email.includes('@')) next.email = 'That does not look like an email.';

    if (!USERNAME_PATTERN.test(username.trim())) {
      next.username = '3-24 characters, letters, numbers and underscores only.';
    }

    if (password.length < MIN_PASSWORD_LENGTH) {
      next.password = `At least ${MIN_PASSWORD_LENGTH} characters.`;
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  }

  async function handleSubmit() {
    if (!validate()) return;

    setBusy(true);
    try {
      const { needsEmailConfirm } = await signUp(email, password, username);

      if (needsEmailConfirm) {
        // Supabase confirms email by default, so there is no session yet — say
        // so rather than dropping the user on a screen that looks broken.
        Alert.alert(
          'Check your email',
          'We sent you a confirmation link. Open it, then come back and sign in.',
          [{ text: 'OK', onPress: () => router.replace('/sign-in') }]
        );
      }
      // Otherwise the session arrives and the root guard swaps to the tabs.
    } catch (caught) {
      setErrors({ form: caught instanceof Error ? caught.message : 'Could not sign up.' });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen edges={['bottom']} padded insetHeader>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
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
              error={errors.email}
            />

            <TextField
              label="Username"
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="nomico"
              editable={!busy}
              error={errors.username}
              hint="This is how others will find you."
            />

            <TextField
              label="Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete="new-password"
              placeholder="••••••••"
              editable={!busy}
              error={errors.password ?? errors.form}
            />

            <Button title="Create account" onPress={handleSubmit} loading={busy} fullWidth />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, justifyContent: 'center', paddingVertical: Spacing.five },
  form: { gap: Spacing.three },
});
