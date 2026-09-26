import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCopyCount } from '@/lib/api';

/**
 * One line on a profile: "Physical collection · 42 copies", and the way into it.
 *
 * Renders nothing until the person owns a copy, the way the starred-song widget
 * renders nothing until a track is pinned — most people will never scan a box,
 * and a zero on their profile would be a feature asking to be used. A count and
 * a door rather than a row of box art: the games shelf directly above already
 * shows covers, and a second strip of them would be two shelves of the same
 * games.
 */
export function PhysicalShelfRow({ profileId, isSelf }: { profileId: string; isSelf: boolean }) {
  const theme = useTheme();

  const count = useQuery({
    queryKey: ['copy-count', profileId],
    queryFn: () => getCopyCount(profileId),
  });

  if (!count.data) return null;

  const copies = `${count.data} ${count.data === 1 ? 'copy' : 'copies'}`;

  return (
    <Link href={{ pathname: '/copies/[user]', params: { user: profileId } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${isSelf ? 'Your' : 'Their'} physical collection, ${copies}`}
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.row, { backgroundColor: theme.surface }])}>
        <Ionicons name="disc-outline" size={20} color={theme.textSecondary} />
        <View style={styles.text}>
          <Text variant="h5">Physical collection</Text>
          <Text variant="caption" color="textMuted">
            {copies}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.card,
  },
  text: { flex: 1, gap: 1 },
});
