import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

type IconName = keyof typeof Ionicons.glyphMap;

export type ProfileWidgetProps = {
  title: string;
  /**
   * Words set after the title in the quieter ink: "Ada" + "’s games". The
   * name is what the eye lands on; the rest says what of theirs this is.
   */
  tail?: string;
  /** A small glyph before the title, in the accent's legible form. */
  icon?: IconName;
  /** At the far end of the title's line: "Edit", a credit mark. */
  action?: ReactNode;
  /**
   * Where the widget leads, when what it holds is a glimpse of something with
   * a screen of its own. The title's line becomes the way there and ends in
   * "View all", in place of an `action`.
   */
  href?: Href;
  /** What the title's link is called, when it is one. */
  accessibilityLabel?: string;
  children: ReactNode;
};

/**
 * A widget on the profile: a hairline, a small heading, and what it holds —
 * the favourites, the games, the pinned song.
 *
 * ```
 * ─────────────────────────────────────────
 * ★ Favourites                         Edit
 * [▮▮▮]  [▮▮▮]  [▮▮▮]  [▮▮▮]
 * ─────────────────────────────────────────
 * Ada’s games                     View all ›
 * [▮▮▮]  [▮▮▮]  [▮▮▮]  [▮▮▮]
 * ```
 *
 * ## Not a card
 *
 * These are sections of the profile, not objects floating on it, so a hairline
 * and their own space separate them — which also hands a row of covers the
 * full width of the page.
 *
 * For about a week each was a card instead: `<ProfileBox>`, the app's `<Card>`
 * with the title on its first line and a hairline under it, forty from the
 * next, after a Letterboxd-style reference. The owner used it and went back
 * (2026-10-12): "go back to the old profile page layout, remove the widgets
 * being inside cards". This is that old frame, and the three widgets share it
 * so they cannot drift apart again. **Do not box them.**
 */
export function ProfileWidget({
  title,
  tail,
  icon,
  action,
  href,
  accessibilityLabel,
  children,
}: ProfileWidgetProps) {
  const theme = useTheme();

  const heading = (
    <View style={styles.title}>
      {icon && <Ionicons name={icon} size={13} color={theme.primaryText} />}
      {/* `itemTitle`: a section title in sentence case, not a metadata tag. */}
      <Text variant="itemTitle" numberOfLines={1} accessibilityRole="header" style={styles.words}>
        {title}
        {tail && (
          <Text variant="itemTitle" color="textSecondary">
            {tail}
          </Text>
        )}
      </Text>
    </View>
  );

  return (
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
      {href ? (
        <Link href={href} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={accessibilityLabel ?? `${title}${tail ?? ''}. View all.`}
            hitSlop={HEAD_SLOP}
            scaleTo={0.98}
            style={StyleSheet.flatten(styles.head)}>
            {heading}
            <View style={styles.viewAll}>
              <Text variant="caption" color="primaryText">
                View all
              </Text>
              <Ionicons name="chevron-forward" size={13} color={theme.primaryText} />
            </View>
          </PressableScale>
        </Link>
      ) : (
        <View style={styles.head}>
          {heading}
          {action}
        </View>
      )}

      {children}
    </View>
  );
}

/** One line of `itemTitle`; the slop above and below it reaches the tap floor. */
const HEAD_SLOP = {
  top: Math.ceil(Math.max(0, TapTarget - Type.itemTitle.lineHeight) / 2),
  bottom: Math.ceil(Math.max(0, TapTarget - Type.itemTitle.lineHeight) / 2),
  left: 0,
  right: 0,
};

const styles = StyleSheet.create({
  /* Twelve under the hairline, eight from the heading to what it heads. */
  widget: {
    gap: Spacing.x8,
    paddingTop: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.x8,
  },
  /* Shrinks rather than pushing "View all" off the row on a long display name. */
  title: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  words: { flexShrink: 1 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
