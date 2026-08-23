import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type TabItem<T extends string> = {
  key: T;
  label: string;
  /** Optional leading glyph. */
  icon?: keyof typeof Ionicons.glyphMap;
  /**
   * Optional trailing count, set inline after the label.
   *
   * Neutral, not a badge: "ALL GAMES 135" is a *size*, and the overwhelming
   * majority of counts on a tab are. A red badge means "there is something here
   * you have not seen", which is a different claim — pass `alert` for that.
   */
  count?: number | null;
  /**
   * Render the count as an unread badge instead of an inline number.
   *
   * For genuinely new things — pending friend requests, unread replies. Rare
   * enough to be opt-in, because a library that says 135 in red is shouting at
   * someone about their own shelf.
   */
  alert?: boolean;
};

export type TabBarProps<T extends string> = {
  tabs: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
};

/**
 * Horizontal pill tabs, shared by every screen that switches between views.
 *
 * The selected tab is a soft light pill; everything else is bare muted type on
 * the page. Labels are uppercase and tracked out, which is what makes a row of
 * them read as a *control strip* rather than as a sentence — at sentence case
 * and no tracking the row looked like a line of links.
 *
 * ## Why the pill replaced the underline
 *
 * The old bar marked selection with a 2px rule under the active label. Two
 * problems, both structural. An underline needs a container edge to sit on, so
 * the bar carried a hairline across the full width and read as a divider
 * wherever it sat over artwork. And the fill it needed to survive that artwork
 * did not exist — an underline is one or two pixels, so a busy screenshot
 * behind it swallowed the only thing saying where you were.
 *
 * The pill is a shape, not a line. It holds at any size, over any background,
 * and it puts this control back on the app's ordinary selection rule —
 * `surfaceElevated` → `surfaceSelected`, brightness rather than hue — which
 * `<SortBar>`, the search mode switch and the tag pickers already follow. The
 * tab bar used to be an explicit exception to that rule; it no longer needs to
 * be, which is one fewer thing to remember.
 *
 * ## Why the pill is a light wash rather than a solid
 *
 * A solid near-white pill is what the same control looks like on a light
 * background. Translated to a dark room it is the brightest object on any
 * screen it appears on, competing with the box art the whole app is built
 * around. 14% white reads unmistakably as "this one" while staying quieter than
 * a cover — the same reasoning that keeps `<Chip>` fills grey.
 *
 * Scrollable rather than evenly divided: label widths vary a lot ("OVERVIEW"
 * vs "SOUNDTRACK") and five in a fixed grid truncate on a narrow phone.
 */
export function TabBar<T extends string>({ tabs, value, onChange }: TabBarProps<T>) {
  const theme = useTheme();

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}>
      {tabs.map((tab) => {
        const active = tab.key === value;
        const showCount = tab.count != null && tab.count > 0;

        return (
          <PressableScale
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            accessibilityLabel={showCount ? `${tab.label}, ${tab.count}` : tab.label}
            onPress={() => onChange(tab.key)}
            scaleTo={0.95}
            style={StyleSheet.flatten([
              styles.tab,
              /* The pill is drawn only when selected. An inactive tab has no
                 fill and no outline at all — a row of empty outlines would read
                 as five buttons, and only one of these is a destination. */
              active ? { backgroundColor: withAlpha(theme.text, 0.14) } : null,
            ])}>
            {tab.icon && (
              <Ionicons name={tab.icon} size={15} color={active ? theme.text : theme.textMuted} />
            )}

            <Text
              variant="h5"
              style={[styles.label, { color: active ? theme.text : theme.textMuted }]}>
              {tab.label}
            </Text>

            {showCount &&
              (tab.alert ? (
                <View style={[styles.badge, { backgroundColor: theme.danger }]}>
                  {/* Always white: the badge is a fixed red, so a theme
                      foreground would go black-on-red in a light scheme. */}
                  <Text variant="caption" color="onPrimary">
                    {tab.count! > 99 ? '99+' : tab.count}
                  </Text>
                </View>
              ) : (
                /* One step quieter than its own label in both states, so the
                   number never competes with the word it belongs to. */
                <Text
                  variant="caption"
                  style={[
                    styles.count,
                    { color: active ? withAlpha(theme.text, 0.6) : theme.textMuted },
                  ]}>
                  {tab.count}
                </Text>
              ))}
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* No wrapper and no hairline. The bar sits directly on whatever is behind it
     — page, artwork, a blurred header — and the pill is what carries selection,
     so the divider the underline needed is gone with it. */
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    minHeight: 40,
    /* `pill`, not `control`. A tab is not a button — it is a position in a set,
       and the fully-round end is what distinguishes "where you are" from "what
       you can press". Same reasoning that keeps `<Chip>` a pill. */
    borderRadius: Radius.pill,
  },
  /* Uppercase and tracked: the row has to read as chrome at a glance, and caps
     at this size are what separate a control strip from a line of prose. */
  label: { textTransform: 'uppercase', letterSpacing: 0.6 },
  count: { letterSpacing: 0.3 },
  badge: {
    minWidth: 18,
    paddingHorizontal: Spacing.x4,
    paddingVertical: 1,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
