import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/** The icon's disc — the size the history rows use for theirs. */
const ICON_DISC = 40;

/**
 * The door to the release calendar, at the top of Search's main page.
 *
 * The calendar is not a search — a year of releases has nothing to type into —
 * so it is not one of the tabs under the field. It was the eighth button on
 * the menu Search used to open on; the menu went and this row is what is left
 * of it, the first thing on Discover.
 *
 * A row that opens something, so it is the filled grey the app uses for those
 * (DESIGN.md § 9), with a chevron at the end: the row Settings is made of.
 * It brings the page margin itself, because Discover pads nothing sideways.
 */
export function CalendarButton() {
  const theme = useTheme();

  return (
    <Link href="/calendar" asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel="Open the release calendar. The year’s releases, month by month."
        scaleTo={0.98}
        pressedColor={theme.controlPressed}
        style={StyleSheet.flatten([styles.row, { backgroundColor: theme.controlFill }])}>
        <View style={[styles.disc, { backgroundColor: theme.surfaceSelected }]}>
          <Ionicons name="calendar-outline" size={20} color={theme.text} />
        </View>

        <View style={styles.text}>
          <Text variant="itemTitle">Calendar</Text>
          <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
            The year’s releases, month by month
          </Text>
        </View>

        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
}

const styles = StyleSheet.create({
  /* A card's corner and the action grey. Tall enough for two lines and past the
     tap floor. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    minHeight: TapTarget + Spacing.x16,
    marginHorizontal: Spacing.x16,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x8,
    borderRadius: Radius.card,
  },
  disc: {
    width: ICON_DISC,
    height: ICON_DISC,
    borderRadius: ICON_DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: { flex: 1, minWidth: 0, gap: 1 },
});
