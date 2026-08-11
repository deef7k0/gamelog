import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { Elevation, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Bottom navigation. Five tabs, icons above labels.
 *
 * Labels are shown, not hidden. An icon-only bar asks every new user to guess
 * what a newspaper glyph leads to; five words cost 14px of height and remove
 * the guessing entirely. Five is also the ceiling — a sixth destination means
 * something belongs one level down, not that the bar should get denser.
 *
 * Selection is the accent blue, on both the glyph and the label. That is the
 * single loudest use of colour in the app and it is deliberate: where you are
 * is the one thing the chrome should always be shouting.
 *
 * Notifications used to live here; it now opens from an icon in Home's header
 * instead, freeing the slot for News.
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

      <Tabs.Screen
        name="create"
        options={{
          title: 'New post',
          tabBarAccessibilityLabel: 'Create',
          tabBarIcon: ({ color, focused }) => (
            <Ionicons
              name={focused ? 'add-circle' : 'add-circle-outline'}
              size={26}
              color={color}
            />
          ),
        }}
      />

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
