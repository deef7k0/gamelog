import {
  Inter_400Regular,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import Ionicons from '@expo/vector-icons/Ionicons';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { HeaderBackdrop } from '@/components/ui/header-backdrop';
import { FontFamily, Palette, Type } from '@/constants/theme';
import { useAuth } from '@/store/auth';

SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Steam's store API is rate limited and game metadata barely changes, so
      // lean on the cache rather than refetching aggressively.
      staleTime: 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

export default function RootLayout() {
  // Dark, always — see `APP_SCHEME`.
  const palette = Palette;
  const session = useAuth((state) => state.session);
  const isRestoring = useAuth((state) => state.isRestoring);

  /*
   * Preload the icon font.
   *
   * Left alone, @expo/vector-icons calls Font.loadAsync lazily the first time an
   * icon renders, which means every icon on screen races to fetch the same 380KB
   * file at once and each failure surfaces as an unhandled rejection with no
   * recovery path. One awaited load before first paint replaces all of that, and
   * icons no longer flash in blank while the font arrives.
   */
  const [fontsLoaded, fontError] = useFonts({
    ...Ionicons.font,
    /*
     * Inter, in the four weights the type scale uses. Each weight is a separate
     * family on purpose — Android will not synthesise a bold from a custom
     * font, so `fontWeight` on Inter silently renders regular. See `FontFamily`.
     */
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });

  // Boot anyway if the font cannot be fetched — tofu glyphs beat a dead splash
  // screen, and in dev this usually just means the bundler is restarting.
  const ready = !isRestoring && (fontsLoaded || !!fontError);

  // Hold the splash screen until we know whether there is a session, otherwise
  // the sign-in screen flashes before the feed for an already-signed-in user.
  useEffect(() => {
    if (ready) {
      SplashScreen.hideAsync();
    }
  }, [ready]);

  useEffect(() => {
    if (fontError) {
      console.warn('[gamelog] Icon font failed to load; icons will render blank.', fontError);
    }
  }, [fontError]);

  /*
   * Modals opt back out of the floating header.
   *
   * Two reasons. They are forms — there is no artwork for a translucent bar to
   * reveal, so it would only cost legibility. And a sheet-presented modal on
   * iOS starts below the status bar, which the app-wide
   * `safe-area-top + bar-height` offset does not know: `<Screen insetHeader>`
   * would leave a status-bar-sized gap above the first field. An opaque header
   * lays the screen out itself and neither problem arises.
   */
  const modalHeader = {
    headerTransparent: false,
    headerBackground: undefined,
    headerStyle: { backgroundColor: palette.background },
  } as const;

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={DarkTheme}>
          <StatusBar style="light" />

          {/*
            The header floats over the page everywhere, not just on the game
            screen — see `HeaderBackdrop` for why it needs a drawn ramp and
            shadow rather than a background colour. Anything that is not leading
            with full-bleed artwork reserves the space back with
            `<Screen insetHeader>`.
          */}
          <Stack
            screenOptions={{
              headerBackButtonDisplayMode: 'minimal',
              headerTransparent: true,
              // The stock hairline would sit on top of the ramp and reinstate
              // exactly the hard edge the ramp exists to remove.
              headerShadowVisible: false,
              headerBackground: () => <HeaderBackdrop />,
              headerTintColor: palette.text,
              headerTitleStyle: {
                fontSize: Type.section.fontSize,
                fontFamily: FontFamily.semibold,
              },
            }}>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen name="game/[id]" options={{ title: '' }} />
              <Stack.Screen name="profile/[id]" options={{ title: '' }} />
              <Stack.Screen name="achievements/[id]" options={{ title: 'Achievements' }} />
              <Stack.Screen name="library/[id]" options={{ title: 'Library' }} />
              <Stack.Screen name="diary/[user]/[game]" options={{ title: '' }} />
              <Stack.Screen name="studio/[id]" options={{ title: '' }} />
              {/* Titled by its own hero headline, so the bar stays empty. */}
              <Stack.Screen name="top-games" options={{ title: '' }} />
              <Stack.Screen name="releases" options={{ title: 'Latest releases' }} />
              <Stack.Screen name="upcoming" options={{ title: 'Coming soon' }} />
              <Stack.Screen
                name="gaming-achievements/[id]"
                options={{ title: 'Steam Achievements' }}
              />
              <Stack.Screen name="gaming-inventory/[id]" options={{ title: 'Inventory' }} />
              <Stack.Screen name="list/[id]" options={{ title: '' }} />
              <Stack.Screen name="review/[id]" options={{ title: '' }} />
              <Stack.Screen name="article/[id]" options={{ title: '' }} />
              <Stack.Screen name="soundtrack/[id]" options={{ title: 'Soundtrack' }} />
              <Stack.Screen name="notifications/index" options={{ title: 'Notifications' }} />
              <Stack.Screen name="comments/[type]/[id]" options={{ title: 'Comments' }} />
              <Stack.Screen
                name="log/[id]"
                options={{ presentation: 'modal', title: 'Log game', ...modalHeader }}
              />
              <Stack.Screen
                name="new-list"
                options={{ presentation: 'modal', title: 'New collection', ...modalHeader }}
              />
              {/* A picker, so it presents as a modal: you are choosing one thing
                  and returning, not navigating somewhere. */}
              <Stack.Screen
                name="add-to-list/[id]"
                options={{ presentation: 'modal', title: 'Add games', ...modalHeader }}
              />
              <Stack.Screen
                name="edit-profile"
                options={{ presentation: 'modal', title: 'Edit profile', ...modalHeader }}
              />
            </Stack.Protected>

            <Stack.Protected guard={!session}>
              <Stack.Screen name="sign-in" options={{ headerShown: false }} />
              <Stack.Screen name="sign-up" options={{ title: 'Create account' }} />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
