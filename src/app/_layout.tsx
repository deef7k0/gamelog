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

import { primeSteamArtwork } from '@/hooks/use-steam-artwork';
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

  /*
   * Pull the persisted Steam-artwork map into memory before the first grid
   * paints, so a game whose hashed capsule was resolved on an earlier run draws
   * the right image immediately instead of flashing a 404 and correcting.
   *
   * Not a network prefetch: the direct CDN URL is right for ~95% of appids and
   * costs nothing, so prefetching would spend a request per game to learn that
   * almost none of them needed one. See `hooks/use-steam-artwork`.
   */
  useEffect(() => {
    void primeSteamArtwork();
  }, []);

  useEffect(() => {
    if (fontError) {
      console.warn('[gamelog] Icon font failed to load; icons will render blank.', fontError);
    }
  }, [fontError]);

  if (!ready) return null;

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider value={DarkTheme}>
          <StatusBar style="light" />

          {/*
            No native header, anywhere.

            Every screen draws its own `<FrostedTopBar>` through `<Screen topBar>`
            instead. Three things the native header could not do, and all three
            are the point:

              - **Blur.** `headerBackground` renders inside the native bar, which
                is not a sibling of the page content and so cannot be given the
                Android `BlurTargetView` to sample. The frosted look was not
                available from there at all.
              - **Hide on scroll.** The native stack header is a platform view;
                Reanimated cannot translate it, and there is no `header` option
                on `@react-navigation/native-stack` to replace it with one that
                can.
              - **The back chevron.** `headerBackButtonDisplayMode: 'minimal'`
                got close on iOS and left Android on its own arrow.

            The trade is that a screen now states its own title rather than
            inheriting one from here. That is a small loss of central bookkeeping
            and a real gain in honesty: a dynamic title used to be declared in
            two places and only one of them was right.
          */}
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Protected guard={!!session}>
              <Stack.Screen name="(tabs)" />
              <Stack.Screen name="game/[id]" />
              <Stack.Screen name="profile/[id]" />
              <Stack.Screen name="achievements/[id]" />
              <Stack.Screen name="library/[id]" />
              <Stack.Screen name="diary/[user]/[game]" />
              <Stack.Screen name="studio/[id]" />
              <Stack.Screen name="top-games" />
              <Stack.Screen name="releases" />
              <Stack.Screen name="upcoming" />
              <Stack.Screen name="gaming-achievements/[id]" />
              <Stack.Screen name="gaming-inventory/[id]" />
              <Stack.Screen name="list/[id]" />
              <Stack.Screen name="review/[id]" />
              <Stack.Screen name="article/[id]" />
              <Stack.Screen name="soundtrack/[id]" />
              <Stack.Screen name="notifications/index" />
              <Stack.Screen name="comments/[type]/[id]" />
              <Stack.Screen name="log/[id]" options={{ presentation: 'modal' }} />
              {/* Both are edits to one award category, so both are sheets: you
                  are changing a thing and coming back, not going somewhere. */}
              <Stack.Screen name="award-game/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="award-edit/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="new-list" options={{ presentation: 'modal' }} />
              {/* A picker, so it presents as a modal: you are choosing one thing
                  and returning, not navigating somewhere. */}
              <Stack.Screen name="add-to-list/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="edit-profile" options={{ presentation: 'modal' }} />
            </Stack.Protected>

            <Stack.Protected guard={!session}>
              <Stack.Screen name="sign-in" />
              <Stack.Screen name="sign-up" />
            </Stack.Protected>
          </Stack>
        </ThemeProvider>
      </QueryClientProvider>
    </GestureHandlerRootView>
  );
}
