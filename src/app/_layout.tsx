import {
  Inter_300Light,
  Inter_400Regular,
  Inter_400Regular_Italic,
  Inter_500Medium,
  Inter_600SemiBold,
  Inter_600SemiBold_Italic,
  Inter_700Bold,
} from '@expo-google-fonts/inter';
import {
  SourceSerif4_400Regular,
  SourceSerif4_600SemiBold,
  SourceSerif4_700Bold,
} from '@expo-google-fonts/source-serif-4';
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
    /*
     * The two italics, for user-written emphasis only — `*italic*` in a
     * collection's description, through `<RichText>`. `fontStyle: 'italic'` is
     * the same silent no-op on Android that `fontWeight` is, for the same
     * reason: a custom family has no oblique to synthesise from.
     */
    Inter_400Regular_Italic,
    Inter_600SemiBold_Italic,
    /*
     * Inter Light, for exactly one thing: the release year beside a review's
     * game title. The brief calls for Graphik Light there, and a year sitting
     * next to a bold serif title has to recede without shrinking.
     */
    Inter_300Light,
    /*
     * Source Serif 4 — the **review** typeface, and nothing else in the app.
     *
     * The brief asks for Tiempos Text / Tiempos Headline, which is Klim's and
     * cannot ship in a bundle. Source Serif 4 is the closest thing with an open
     * licence: a Times-descended modern serif drawn for screen text, with the
     * same large x-height and low stroke contrast that make Tiempos hold at
     * body sizes. Three weights, because a magazine needs a headline, a body
     * and a byline weight and Android synthesises none of them.
     */
    SourceSerif4_400Regular,
    SourceSerif4_600SemiBold,
    SourceSerif4_700Bold,
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
              <Stack.Screen name="surprise" />
              <Stack.Screen name="gaming-achievements/[id]" />
              <Stack.Screen name="gaming-inventory/[id]" />
              <Stack.Screen name="list/[id]" />
              {/* The "See all" behind Discover's Reviews and Collections bands.
                  Both used to be tabs inside Search; a popularity chart is not
                  a search scope, so they are pages now. */}
              <Stack.Screen name="reviews" />
              <Stack.Screen name="collections" />
              {/* Where Search's genre grid leads — one genre, ranked. */}
              <Stack.Screen name="genre/[id]" />
              <Stack.Screen name="review/[id]" />
              <Stack.Screen name="soundtrack/[id]" />
              <Stack.Screen name="notifications/index" />
              <Stack.Screen name="settings" />
              <Stack.Screen name="comments/[type]/[id]" />
              <Stack.Screen name="log/[id]" options={{ presentation: 'modal' }} />
              {/* Both are edits to one award category, so both are sheets: you
                  are changing a thing and coming back, not going somewhere. */}
              <Stack.Screen name="award-game/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="award-edit/[id]" options={{ presentation: 'modal' }} />
              <Stack.Screen name="new-list" options={{ presentation: 'modal' }} />
              <Stack.Screen name="edit-list/[id]" options={{ presentation: 'modal' }} />
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
