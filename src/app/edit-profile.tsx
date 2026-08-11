import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { updateProfile } from '@/lib/api';
import { useAuth } from '@/store/auth';

/** SteamID64 is exactly 17 digits — mirrors the CHECK constraint in 0002. */
const STEAM_ID_PATTERN = /^[0-9]{17}$/;

export default function EditProfileScreen() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const profile = useAuth((state) => state.profile);
  const refreshProfile = useAuth((state) => state.refreshProfile);

  const [displayName, setDisplayName] = useState(profile?.display_name ?? '');
  const [bio, setBio] = useState(profile?.bio ?? '');
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatar_url ?? '');
  const [bannerUrl, setBannerUrl] = useState(profile?.banner_url ?? '');
  const [favoritePlatform, setFavoritePlatform] = useState(profile?.favorite_platform ?? '');
  const [location, setLocation] = useState(profile?.location ?? '');
  const [steamId, setSteamId] = useState(profile?.steam_id ?? '');
  const [steamError, setSteamError] = useState<string | null>(null);

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');

      const trimmedSteamId = steamId.trim();
      if (trimmedSteamId && !STEAM_ID_PATTERN.test(trimmedSteamId)) {
        throw new Error('SteamID64 must be exactly 17 digits.');
      }

      await updateProfile(userId, {
        display_name: displayName.trim() || null,
        bio: bio.trim() || null,
        avatar_url: avatarUrl.trim() || null,
        banner_url: bannerUrl.trim() || null,
        favorite_platform: favoritePlatform.trim() || null,
        location: location.trim() || null,
        steam_id: trimmedSteamId || null,
      });
    },
    onSuccess: async () => {
      await refreshProfile();
      queryClient.invalidateQueries({ queryKey: ['profile', userId] });
      router.back();
    },
    onError: (error) => {
      setSteamError(error instanceof Error ? error.message : 'Could not save.');
    },
  });

  return (
    <Screen edges={['bottom']} padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="Display name"
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="How your name appears"
            maxLength={50}
          />

          <TextField
            label="Bio"
            value={bio}
            onChangeText={setBio}
            placeholder="Tell people what you play"
            multiline
            maxLength={300}
          />

          <TextField
            label="Avatar URL"
            value={avatarUrl}
            onChangeText={setAvatarUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
            hint="Image uploads are not built yet — paste a link for now."
          />

          <TextField
            label="Banner URL"
            value={bannerUrl}
            onChangeText={setBannerUrl}
            placeholder="https://…"
            autoCapitalize="none"
            keyboardType="url"
          />

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Favourite platform"
                value={favoritePlatform}
                onChangeText={setFavoritePlatform}
                placeholder="PS5"
                autoCapitalize="words"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Location"
                value={location}
                onChangeText={setLocation}
                placeholder="Optional"
              />
            </View>
          </View>

          <View style={styles.steamBlock}>
            <TextField
              label="SteamID64"
              value={steamId}
              onChangeText={(value) => {
                setSteamId(value);
                setSteamError(null);
              }}
              placeholder="76561197960287930"
              keyboardType="number-pad"
              autoCapitalize="none"
              error={steamError}
            />
            <Text variant="bodySmall" color="textMuted">
              Links your Steam account so achievement progress can be synced. Find yours at
              steamid.io. Your Steam profile and game details must be set to public, otherwise Steam
              returns nothing.
            </Text>
          </View>

          <Button
            title="Save profile"
            onPress={() => save.mutate()}
            loading={save.isPending}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x16, paddingVertical: Spacing.x24 },
  row: { flexDirection: 'row', gap: Spacing.x12 },
  rowItem: { flex: 1 },
  steamBlock: { gap: Spacing.x8 },
});
