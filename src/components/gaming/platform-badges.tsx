import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getLinkedAccountHandles } from '@/lib/api';
import type { GamingProvider } from '@/lib/database.types';
import { getProvider } from '@/lib/gaming';

/** The services a badge can be drawn for, in the order they stand. */
const BADGED: readonly GamingProvider[] = ['steam', 'playstation', 'xbox', 'gog'];

const ICONS: Partial<Record<GamingProvider, keyof typeof Ionicons.glyphMap>> = {
  steam: 'logo-steam',
  playstation: 'logo-playstation',
  xbox: 'logo-xbox',
  gog: 'game-controller',
};

/** A badge's circle, and its glyph inside. */
const BADGE = 24;
const GLYPH = 14;
/** How long a bubble stays up by itself. */
const BUBBLE_MS = 4000;

/**
 * A badge beside a profile's name for each platform the person has linked —
 * the owner's (2026-10-22): "on tap it shows the user above". Tapping one
 * raises a bubble over it with the name that account is linked as; tapping it
 * again, or another, or waiting, puts it away.
 *
 * Nothing is drawn until the accounts are known, and nothing at all for a
 * person with none — the name stands alone, as before.
 */
export function PlatformBadges({ userId }: { userId: string }) {
  const accounts = useQuery({
    queryKey: ['gaming-accounts', userId],
    queryFn: () => getLinkedAccountHandles(userId),
    staleTime: 5 * 60_000,
  });
  const [open, setOpen] = useState<GamingProvider | null>(null);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => setOpen(null), BUBBLE_MS);
    return () => clearTimeout(timer);
  }, [open]);

  const linked = BADGED.flatMap((provider) => {
    const account = accounts.data?.find((entry) => entry.provider === provider);
    return account ? [account] : [];
  });
  if (linked.length === 0) return null;

  return (
    <View style={styles.row}>
      {linked.map((account) => (
        <Badge
          key={account.provider}
          provider={account.provider}
          handle={account.handle}
          open={open === account.provider}
          onPress={() =>
            setOpen((current) => (current === account.provider ? null : account.provider))
          }
        />
      ))}
    </View>
  );
}

function Badge({
  provider,
  handle,
  open,
  onPress,
}: {
  provider: GamingProvider;
  handle: string | null;
  open: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const label = getProvider(provider)?.label ?? provider;
  const name = handle ?? 'Linked';

  return (
    <View style={styles.badgeSlot}>
      {open && (
        <View
          pointerEvents="none"
          style={[
            styles.bubble,
            { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
          ]}>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {label}
          </Text>
          <Text variant="h5" numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.tail, { borderTopColor: theme.surfaceElevated }]} />
        </View>
      )}
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${name}`}
        accessibilityHint="Shows the name this account is linked as"
        hitSlop={8}
        scaleTo={0.9}
        onPress={onPress}
        style={StyleSheet.flatten([
          styles.badge,
          { backgroundColor: open ? theme.surfaceSelected : theme.controlFill },
        ])}>
        <Ionicons name={ICONS[provider] ?? 'game-controller'} size={GLYPH} color={theme.text} />
      </PressableScale>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  badgeSlot: { alignItems: 'center' },
  badge: {
    width: BADGE,
    height: BADGE,
    borderRadius: BADGE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Over the badge, centred on it, above everything round it. */
  bubble: {
    position: 'absolute',
    bottom: BADGE + Spacing.x8,
    minWidth: 96,
    maxWidth: 220,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x8,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    zIndex: 10,
    elevation: 6,
  },
  tail: {
    position: 'absolute',
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 6,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
  },
});
