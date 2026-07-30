import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useAccountLink } from '@/hooks/use-gaming';
import type { GamingProvider } from '@/lib/database.types';
import { requireProvider } from '@/lib/gaming';

/**
 * Connect / disconnect control for a gaming account.
 *
 * Provider-neutral: the label, icon and copy come from the provider, so adding
 * Xbox means registering it rather than editing this file.
 */

/** Icons per provider. Ionicons has no console-brand glyphs, so these are generic. */
const PROVIDER_ICONS: Record<GamingProvider, keyof typeof Ionicons.glyphMap> = {
  steam: 'logo-steam',
  xbox: 'logo-xbox',
  playstation: 'logo-playstation',
  epic: 'game-controller',
  gog: 'game-controller',
  battlenet: 'game-controller',
  riot: 'game-controller',
  ubisoft: 'game-controller',
};

export function ConnectAccountCard({
  userId,
  provider = 'steam',
  linked,
}: {
  userId: string;
  provider?: GamingProvider;
  /** Show the disconnect affordance instead of the connect one. */
  linked: boolean;
}) {
  const theme = useTheme();
  const { link, unlink } = useAccountLink(userId, provider);
  const instance = requireProvider(provider);

  const error = link.error ?? unlink.error;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.head}>
        <Ionicons name={PROVIDER_ICONS[provider]} size={22} color={theme.text} />
        <View style={styles.headText}>
          <Text variant="bodyStrong">{instance.label}</Text>
          <Text variant="micro" color="textMuted">
            {linked
              ? 'Library, achievements, inventory and badges sync automatically.'
              : 'Sign in with Steam to import your library, achievements and badges.'}
          </Text>
        </View>
      </View>

      {linked ? (
        <Button
          title="Disconnect"
          variant="ghost"
          size="small"
          loading={unlink.isPending}
          onPress={() => unlink.mutate()}
        />
      ) : (
        <Button
          title={`Connect ${instance.label}`}
          variant="secondary"
          size="small"
          loading={link.isPending}
          onPress={() => link.mutate()}
          fullWidth
        />
      )}

      {error && (
        <Text variant="micro" color="danger">
          {error instanceof Error ? error.message : 'Something went wrong.'}
        </Text>
      )}

      {!linked && (
        <Text variant="micro" color="textMuted">
          GameLog never sees your Steam password — Steam handles the sign-in and only tells us your
          account id.
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderRadius: Radius.large, padding: Spacing.four, gap: Spacing.three },
  head: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  headText: { flex: 1, gap: 2 },
});
