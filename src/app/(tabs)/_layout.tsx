import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

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
 * Notifications used to live here; it now opens from an icon in Home's header
 * instead, freeing the slot for News.
 *
 * **Creating is no longer a tab.** The bar is destinations only — the four
 * things you can *be* looking at — and a composer is an action, not a place.
 * `create` keeps its route (`href: null` only removes the button) so anything
 * can push to it, but nothing currently does; see the note on the screen.
 */
export default function TabsLayout() {
  const theme = useTheme();

  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: theme.primary,
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
          height: 68,
          paddingTop: Spacing.x8,
          paddingBottom: Spacing.x8,
        },
        headerStyle: { backgroundColor: theme.background },
        headerTitleStyle: { color: theme.text, ...Type.h1 },
        headerShadowVisible: false,
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'GameLog',
          headerShown: false,
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
          headerShown: false,
          tabBarAccessibilityLabel: 'Search',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'search' : 'search-outline'} size={24} color={color} />
          ),
        }}
      />

      {/* Off the bar, still routable. `href: null` is Expo Router's way of
          saying "this screen belongs to the group but is not a destination" —
          the route file stays, so a push to `/create` still works. */}
      <Tabs.Screen name="create" options={{ href: null, title: 'New post' }} />

      <Tabs.Screen
        name="news"
        options={{
          title: 'News',
          headerShown: false,
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
          headerShown: false,
          tabBarAccessibilityLabel: 'Profile',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons name={focused ? 'person' : 'person-outline'} size={24} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}
