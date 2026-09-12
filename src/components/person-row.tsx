import { Link } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Profile } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';

const AVATAR = 44;

export type PersonRowProps = {
  profile: Profile;
  /** A control on the right — a Follow button, a request's Accept/Decline pair. */
  trailing?: ReactNode;
  /** Hairline above the row. Off for the first row in a group. */
  divided?: boolean;
};

/**
 * One person, as a tappable row that opens their profile.
 *
 * Extracted because this row existed **twice** in hand-written form — in the
 * search tab and in `discover-people` — with the same avatar size, the same two
 * lines of type and two different handle variants (`bodySmall` in one,
 * `caption` in the other). A third copy was about to be written for the
 * followers screen, which is the point at which a repeated shape stops being a
 * coincidence and starts being a component.
 *
 * `trailing` is the reason this is a slot rather than a fixed layout: a row in a
 * followers list is pure navigation, while the same row in a friend-requests
 * list has to carry Accept and Decline. Both are the same object with a
 * different thing attached to the right of it.
 */
export const PersonRow = memo(function PersonRow({
  profile,
  trailing,
  divided = true,
}: PersonRowProps) {
  const theme = useTheme();
  const name = displayNameFor(profile);

  return (
    <View
      style={[
        styles.wrap,
        divided && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.border },
      ]}>
      <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
        {/* Flattened — Expo Router clones this child and throws on an array
            style rather than guessing precedence. See the note in
            `game-list-item.tsx`. */}
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${name}, @${profile.username}`}
          style={StyleSheet.flatten([styles.row])}>
          <Avatar uri={profile.avatar_url} name={name} size={AVATAR} />
          <View style={styles.text}>
            <Text variant="h5" numberOfLines={1}>
              {name}
            </Text>
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              @{profile.username}
            </Text>
          </View>
        </PressableScale>
      </Link>

      {trailing}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* `flex: 1` so the name column takes the space a trailing control does not,
     and `minHeight` so the row clears the tap floor even before the avatar
     does — the avatar is 44, which is under Android's 48. */
  row: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget,
    paddingVertical: Spacing.x12,
  },
  /* `minWidth: 0` is what lets `numberOfLines` actually clip: without it a flex
     child refuses to shrink below its content and a long display name pushes
     the trailing control off the row instead of truncating. */
  text: { flex: 1, minWidth: 0, gap: 1 },
});
