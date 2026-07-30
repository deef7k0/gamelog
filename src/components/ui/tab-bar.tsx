import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Optional leading glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Optional trailing count.
   *
   * Rendered in `danger`, unlike `<Button count>`'s recessed pill, because a
   * count on a tab is always "there is something here you have not seen" —
   * unread notifications, pending requests. A count you are already looking at
   * does not need a badge.
   */
  count?: number | null;
};

export type TabBarProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Horizontal underline tab bar, shared by the game page and the profile.
 *
 * Scrollable rather than evenly-divided: label widths vary a lot ("Overview"
 * vs "Soundtrack"), and squeezing five of them into a fixed grid truncates on
 * narrow phones.
 *
 * The selected tab is marked by a full-strength label over a bar in the same
 * near-white as `primary`. Everything else in the row drops to `textMuted`, so
 * the contrast between selected and not is a difference in *brightness* — which
 * survives sitting on top of artwork in a way a coloured underline does not.
 */
export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  const theme = useTheme();

  return (
    <View style={[styles.wrapper, { borderBottomColor: theme.border }]}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.content}>
        {tabs.map((tab) => {
          const active = tab.key === value;
          return (
            <PressableScale
              key={tab.key}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={tab.count ? `${tab.label}, ${tab.count}` : tab.label}
              onPress={() => onChange(tab.key)}
              scaleTo={0.94}
              style={StyleSheet.flatten([
                styles.tab,
                { borderBottomColor: active ? theme.primary : 'transparent' },
              ])}>
              {tab.icon && (
                <Ionicons name={tab.icon} size={15} color={active ? theme.text : theme.textMuted} />
              )}

              <Text variant="bodyStrong" color={active ? 'text' : 'textMuted'}>
                {tab.label}
              </Text>

              {tab.count != null && tab.count > 0 && (
                <View style={[styles.count, { backgroundColor: theme.danger }]}>
                  <Text variant="micro" style={styles.countLabel}>
                    {tab.count > 99 ? '99+' : tab.count}
                  </Text>
                </View>
              )}
            </PressableScale>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { borderBottomWidth: StyleSheet.hairlineWidth },
  content: { paddingHorizontal: Spacing.two },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderBottomWidth: 2,
  },
  count: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  /* Always white: the badge is a fixed red in both schemes, so a theme
     foreground would go black-on-red in light mode. */
  countLabel: { color: '#FFFFFF' },
});
