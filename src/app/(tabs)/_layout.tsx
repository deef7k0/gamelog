import Ionicons from '@expo/vector-icons/Ionicons';
import { Tabs } from 'expo-router';

import { AppTabBar, TabBarClearanceProvider } from '@/components/app-tab-bar';

/**
 * Bottom navigation. Four tabs, icons above labels — drawn by `<AppTabBar>`,
 * SimpMusic's floating capsule, over the page. Every tab screen pads its
 * scroll content by `useTabBarClearance()` so it ends above the capsule.
 *
 * Labels are shown, not hidden. An icon-only bar asks every new user to guess
 * what a newspaper glyph leads to; a word under each glyph removes the
 * guessing. Five is the ceiling — a sixth destination means something belongs
 * one level down, not that the bar should get denser.
 *
 * Selection is the house blue, on both the glyph and the label. That is
 * the single loudest use of colour in the chrome and it is deliberate: where
 * you are is the one thing the chrome should always be shouting.
 *
 * **The bar never takes a game's colour.** Everything else in the app can shift
 * to the identity hue of whatever you are looking at; this stays the house
 * blue on every screen, because it is the one fixed thing you navigate by.
 * A bottom bar that changed colour with the content above it would be the app
 * losing its own identity rather than expressing the game's.
 *
 * `primaryText`, not `primary`: the label is 11px, and the fill blue measures
 * 3.69:1 against the bar's surface where its type twin measures 5.69.
 *
 * Notifications used to live here; it now opens from an icon in Home's header
 * instead, freeing the slot for News.
 *
 * **There is no composer route any more.** `create` was registered here with
 * `href: null` — in the group, off the bar — and it composed user posts and
 * articles, which the app no longer has. Nothing pushed to it even before that,
 * so the screen and its registration went together.
 */
export default function TabsLayout() {
  return (
    <TabBarClearanceProvider>
      <Tabs
        /*
         * The bar draws itself: the colours, the sizes and the system inset are
         * all `<AppTabBar>`'s, so nothing here styles React Navigation's own.
         */
        tabBar={(props) => <AppTabBar {...props} />}
        screenOptions={{
          // Every tab draws its own `<FrostedTopBar>` — see the root layout for
          // why no screen in this app uses a native header any more. Set once
          // here rather than per screen, which is how `create` ended up with a
          // stock grey bar nobody had asked for.
          headerShown: false,
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
              <Ionicons
                name={focused ? 'newspaper' : 'newspaper-outline'}
                size={24}
                color={color}
              />
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
    </TabBarClearanceProvider>
  );
}
