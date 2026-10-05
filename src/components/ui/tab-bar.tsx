import Ionicons from '@expo/vector-icons/Ionicons';
import { ScrollView, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlSlop,
  Spacing,
  TapTarget,
  withAlpha,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { readableInk } from '@/lib/color';

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
  /**
   * What this set of tabs is choosing between — "What to search", "Library view".
   *
   * Read out before the tabs themselves, so a screen-reader user is told what
   * the row decides rather than just hearing four words in a line.
   */
  label?: string;
  /**
   * Draw the glyph and drop the printed word.
   *
   * Every tab must still carry an `icon` and a `label`: the label becomes the
   * accessible name, so a screen reader hears "Collections, tab 2 of 4" exactly
   * as it did before. Only sighted readers lose the word.
   *
   * **That loss is real** — an icon strip is recognition rather than reading,
   * and it is only affordable where the glyphs are conventions the reader has
   * already met. Use it where the set is small, stable and iconic; a row of five
   * invented marks is a puzzle, not a control.
   *
   * The row also stops scrolling in this mode and divides the width evenly.
   * Glyphs are all the same size, so there is nothing to scroll for, and an
   * icon strip that ran off the edge would hide a destination behind a gesture
   * with nothing to suggest it.
   */
  iconOnly?: boolean;
  /**
   * Where a short row sits when it does not fill the width.
   *
   * `start` (the default) is right for a bar that is one of several things on a
   * line, and for any row long enough to scroll — a centred row that overflows
   * would start mid-label.
   *
   * `center` is for a bar that is *the* control on its own line and has too few
   * tabs to reach the edges. The game page is the worked example: it lost its
   * Reviews tab to a sheet and three pills left-aligned under a full-width
   * masthead read as a row that had lost something rather than as a complete
   * set. Centring costs nothing when the content overflows — `flexGrow` only has
   * slack to distribute when there is slack.
   */
  align?: 'start' | 'center';
};

/**
 * Horizontal pill tabs, shared by every screen that switches between views.
 *
 * The selected tab is a soft pill of the accent's wash with its label in the
 * accent; everything else is bare muted type on the page. Labels are uppercase
 * and tracked out, which is what makes a row of them read as a *control strip*
 * rather than as a sentence — at sentence case and no tracking the row looked
 * like a line of links.
 *
 * **The accent, because a tab says where you are.** The bottom navigation
 * marks the current destination in the house blue, and so does this — the
 * game's own colour on its page. The fill is a light wash, not a solid —
 * quieter than a cover, unmistakably "this one".
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
 * The pill is a shape, not a line. It holds at any size, over any background.
 *
 * ## Why the pill is a wash rather than a solid
 *
 * A solid pill is the brightest object on any screen it appears on, competing
 * with the box art the whole app is built around. A 14% wash reads
 * unmistakably as "this one" while staying quieter than a cover. It also keeps
 * a carrier that is not hue: the selected tab is the only one with a fill at
 * all, and its label is markedly brighter than the muted ones beside it.
 *
 * Scrollable rather than evenly divided: label widths vary a lot ("OVERVIEW"
 * vs "SOUNDTRACK") and five in a fixed grid truncate on a narrow phone.
 */
export function TabBar<T extends string>({
  tabs,
  value,
  onChange,
  label,
  iconOnly = false,
  align = 'start',
}: TabBarProps<T>) {
  const theme = useTheme();
  const accent = useAccent();

  const items = tabs.map((tab, index) => {
    const active = tab.key === value;
    const showCount = tab.count != null && tab.count > 0;
    const ink = active ? accent.onSurface : theme.textMuted;

    return (
      <PressableScale
        key={tab.key}
        accessibilityRole="tab"
        accessibilityState={{ selected: active }}
        accessibilityLabel={showCount ? `${tab.label}, ${tab.count}` : tab.label}
        /* Position has to be spoken explicitly: a horizontal `ScrollView`
           is not a list, so nothing derives "2 of 4" on its own. */
        accessibilityHint={`${index + 1} of ${tabs.length}`}
        onPress={() => onChange(tab.key)}
        /* Drawn at the reference's chip height, touched at the floor. */
        hitSlop={iconOnly ? undefined : SmallControlSlop}
        scaleTo={0.95}
        pressedColor={active ? accent.ring : theme.pressed}
        focusRing={accent.ring}
        style={StyleSheet.flatten([
          styles.tab,
          iconOnly && styles.tabIcon,
          /* The pill is drawn only when selected. An inactive tab has no
             fill and no outline at all — a row of empty outlines would read
             as five buttons, and only one of these is a destination. The
             explicit `transparent` is what the press fill eases in from. */
          { backgroundColor: active ? accent.wash : 'transparent' },
        ])}>
        {tab.icon && <Ionicons name={tab.icon} size={iconOnly ? 22 : 15} color={ink} />}

        {!iconOnly && (
          <Text variant="h5" style={[styles.label, { color: ink }]}>
            {tab.label}
          </Text>
        )}

        {!iconOnly &&
          showCount &&
          (tab.alert ? (
            <View style={[styles.badge, { backgroundColor: theme.danger }]}>
              {/* Ink measured against the red: dark, at 5.74:1. White on this
                  red is 3.36:1, under AA at the 10px a count is set in. */}
              <Text variant="caption" style={{ color: readableInk(theme.danger) }}>
                {tab.count! > 99 ? '99+' : tab.count}
              </Text>
            </View>
          ) : (
            /* One step quieter than its own label in both states, so the
               number never competes with the word it belongs to. */
            <Text
              variant="caption"
              style={[styles.count, { color: active ? withAlpha(ink, 0.7) : theme.textMuted }]}>
              {tab.count}
            </Text>
          ))}
      </PressableScale>
    );
  });

  /* A plain row, not a scroller. See the note on `iconOnly`. */
  if (iconOnly) {
    return (
      <View
        style={[styles.content, styles.contentSpread]}
        accessibilityRole="tablist"
        accessibilityLabel={label}>
        {items}
      </View>
    );
  }

  return (
    /*
     * `tablist` on the container, and it is not decoration.
     *
     * Every pill already carried `role="tab"` and its selected state, but with
     * no set around them VoiceOver and TalkBack cannot say "tab 2 of 4" — the
     * reader got four buttons, one of which claimed to be selected, with nothing
     * saying what it was selected *out of*. This is the app's only in-page tab
     * implementation, so the role belongs here rather than at each call site.
     */
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      /* A tab is tapped with a keyboard up on Search, where the row sits under
         a focused field. Without this the first tap only puts the keyboard
         away and the tab needs a second. */
      keyboardShouldPersistTaps="handled"
      accessibilityRole="tablist"
      accessibilityLabel={label}
      contentContainerStyle={[styles.content, align === 'center' && styles.contentCenter]}>
      {items}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  /* No wrapper and no hairline. The bar sits directly on whatever is behind it
     — page, artwork, a blurred header — and the pill is what carries selection,
     so the divider the underline needed is gone with it.

     SimpMusic's chip row (`LibraryScreen.kt`, `HomeScreen.kt`): 15 in from the
     edge, so the first pill lines up with the page's content, 8 above and
     below, 4 between. */
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    paddingVertical: Spacing.x8,
  },
  /* Evenly divided rather than scrolled, for `iconOnly`. */
  contentSpread: { alignSelf: 'stretch' },
  /* `flexGrow`, not `width: '100%'`. The content container of a horizontal
     ScrollView is sized by its children; growing it to the viewport gives
     `justifyContent` something to centre *within*, and when the pills are wider
     than the screen there is no slack and the row scrolls from its start exactly
     as it did before. */
  contentCenter: { flexGrow: 1, justifyContent: 'center' },
  /* The reference's chip: 32 drawn and 16 at the sides (Material's filter
     chip, which SimpMusic draws every row of choices with). It reaches the tap
     floor through `SmallControlSlop`, vertically — the row's own 8 above and
     below is room for it. */
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    minHeight: ControlHeight.small,
    /* `pill`, not `control`. A tab is not a button — it is a position in a set,
       and the fully-round end is what distinguishes "where you are" from "what
       you can press". Same reasoning that keeps `<Chip>` a pill. */
    borderRadius: Radius.pill,
  },
  /* Each glyph takes an equal share of the row and centres in it, so four
     destinations sit on a rhythm rather than at four label-driven widths. */
  tabIcon: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.x8,
    /* A glyph strip has no word to size it, so it stays at the floor. */
    minHeight: TapTarget,
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
