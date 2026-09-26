import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Elevation, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom navigation. Four tabs, icons above labels.
 *
 * Labels are shown, not hidden. An icon-only bar asks every new user to guess
 * what a newspaper glyph leads to; four words cost 14px of height and remove
 * the guessing entirely. Five is the ceiling — a sixth destination means
 * something belongs one level down, not that the bar should get denser.
 *
 * Selection is the accent blue, on both the glyph and the label. That is the
 * single loudest use of colour in the app and it is deliberate: where you are
 * is the one thing the chrome should always be shouting.
 *
 * **The bar never takes a game's colour.** Everything else in the app can shift
 * to the identity hue of whatever you are looking at; this stays the house blue
 * on every screen, because it is the one fixed thing you navigate by. A bottom
 * bar that changed colour with the content above it would be the app losing its
 * own identity rather than expressing the game's.
 *
 * `primaryText`, not `primary`: the label is 10px and #0070CC measures 3.40:1
 * against the bar's surface, which is under AA for text at any size.
 *
 * Notifications used to live here; it now opens from an icon in Home's header
 * instead, freeing the slot for News.
 *
 * **There is no composer route any more.** `create` was registered here with
 * `href: null` — in the group, off the bar — and it composed user posts and
 * articles, which the app no longer has. Nothing pushed to it even before that,
 * so the screen and its registration went together.
 */
/** The bar's own height, before the system's navigation gesture area is added. */
const BAR_HEIGHT = 58;

export default function TabsLayout() {
  const theme = useTheme();
  /*
   * The navigation bar's inset, added to the tab bar rather than ignored.
   *
   * React Navigation adds this automatically — until you set `height`, which
   * this file does, and an explicit height replaces the computed one wholesale.
   * So on a real Android build, where SDK 57 targets Android 15 and edge-to-edge
   * is mandatory, the gesture bar drew straight over the tabs: 58dp of bar with
   * the bottom ~24-48 of it underneath the system's own control.
   *
   * `height` carries the inset and `paddingBottom` pushes the glyphs up out of
   * it, so the bar grows rather than the icons moving. Zero on a device with no
   * gesture area, which is why this is additive rather than a second constant.
   */
  const insets = useSafeAreaInsets();

  return (
    <Tabs
      screenOptions={{
        // Every tab draws its own `<FrostedTopBar>` — see the root layout for
        // why no screen in this app uses a native header any more. Set once
        // here rather than per screen, which is how `create` ended up with a
        // stock grey bar nobody had asked for.
        headerShown: false,
        tabBarActiveTintColor: theme.primaryText,
        tabBarInactiveTintColor: theme.textMuted,
        tabBarShowLabel: true,
        tabBarLabelStyle: { ...Type.caption, marginTop: 2 },
        tabBarItemStyle: { paddingVertical: Spacing.x4 },
        tabBarStyle: {
          // The bar is a *surface*, one step up from the page, rather than the
          // page colour with a line drawn on it — and it floats above the
          // content it scrolls over, so it takes the overlay tier.
          ...Elevation.overlay,
          backgroundColor: theme.surface,
          borderTopWidth: 0,
          // Down from 68 with the rest of the chrome. The glyph is still 24 and
          // the row still clears `TapTarget`; what went is the air around them.
          // Plus the navigation-bar inset — see `insets` above.
          height: BAR_HEIGHT + insets.bottom,
          paddingTop: Spacing.x8,
          paddingBottom: Spacing.x8 + insets.bottom,
        },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'GameLog',
          tabBarAccessibilityLabel: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'home' : 'home-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="search"
        options={{
          title: 'Search',
          tabBarAccessibilityLabel: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          tabBarAccessibilityLabel: 'News',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'newspaper' : 'newspaper-outline'} size={24} color={color} />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
