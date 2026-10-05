import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, type Href } from 'expo-router';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { ExternalLink } from '@/components/external-link';
import { GameInfoSections } from '@/components/game-info-sections';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useWikidataGameInfo } from '@/hooks/use-wikidata-game-info';
import { getGameById } from '@/lib/games';
import { hasGameInfo, WikidataError } from '@/lib/wikidata';

/**
 * A game's additional information: awards, nominations, cast, budget and the
 * people who made it, from Wikidata.
 *
 * Opened from the Overview tab, and lit like it — the game's own accent, its
 * page tone behind, `<InfoCard>` panels — because it is that tab continued:
 * the same game, the facts that did not fit there. The game comes from the
 * same `['game', id]` query the game page ran, so arriving from it costs no
 * request and the title is on screen at once.
 *
 * ## Four states, and what each one claims
 *
 * - **Loading** — only the spinner. No empty sections flashing in first.
 * - **Nothing** — "No additional information was found for the game." That
 *   sentence and nothing else, whether no Wikidata item matched this game or
 *   the one that did records none of these facts.
 * - **Failed** — Wikidata could not be reached or refused. Worded as *this
 *   screen's* failure, so it is never read as "the game has no information",
 *   and never the app's `ErrorState` copy, which blames GameLog's own server.
 * - **Found** — the sections that have something in them, and nothing else.
 */
export default function GameInfoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

  const info = useWikidataGameInfo(game.data);

  /* Read here because this component renders the provider and so cannot
     consume it — the same arrangement as the game page. */
  const accent = useGameAccent(game.data?.coverUrl ?? game.data?.heroUrl, game.data?.genres);

  let body: ReactNode;
  if (game.isLoadingError) {
    /* The game itself did not load — GameLog's own request, so the app's own
       error state is the honest one here. */
    body = <ErrorState error={game.error} onRetry={() => game.refetch()} />;
  } else if (game.isLoading) {
    body = <LoadingState label="Loading additional information…" />;
  } else if (!game.data) {
    body = <EmptyState title="Game not found" />;
  } else if (info.data !== undefined) {
    /* Data first, error second: a background refresh that fails keeps the
       answer already on screen rather than replacing it with a failure. */
    body = hasGameInfo(info.data) ? (
      <>
        <GameInfoSections info={info.data} />
        <ExternalLink
          href={info.data.sourceUrl as Href & string}
          label={`Open ${game.data.title} on Wikidata`}>
          <Text variant="h5" style={{ color: accent.onSurface }}>
            Open on Wikidata
          </Text>
        </ExternalLink>
      </>
    ) : (
      <EmptyState title="No additional information was found for the game." />
    );
  } else if (info.isLoadingError) {
    body = (
      <EmptyState
        title="Unable to load additional information"
        message={failureMessage(info.error)}
        action={<Button title="Try again" onPress={() => info.refetch()} />}
        footnote={__DEV__ && info.error instanceof Error ? info.error.message : undefined}
      />
    );
  } else {
    body = <LoadingState label="Loading additional information…" />;
  }

  return (
    <AccentProvider artwork={game.data?.coverUrl ?? game.data?.heroUrl} genres={game.data?.genres}>
      <Screen
        edges={['bottom']}
        insetHeader
        background={accent.page}
        topBar={<FrostedTopBar back />}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
          {/* The page states its own heading: the top bar is a back disc and
              nothing else, and this screen opens on text, not on art. */}
          <View style={styles.head}>
            <Text variant="h1" accessibilityRole="header">
              Additional information
            </Text>
            {game.data && (
              <Text variant="body" style={{ color: accent.quietInk }}>
                {game.data.title}
              </Text>
            )}
          </View>

          {body}
        </ScrollView>
      </Screen>
    </AccentProvider>
  );
}

/**
 * What to do about a failure, by what kind it was. The title already says the
 * information could not be *loaded*; this line says whether waiting will help.
 */
function failureMessage(error: unknown): string {
  if (error instanceof WikidataError) {
    if (error.kind === 'network' || error.kind === 'timeout') {
      return 'Check your connection and try again.';
    }
    if (error.kind === 'rate-limited') {
      return 'Wikidata is receiving too many requests right now. Please try again in a minute.';
    }
  }
  return 'Please try again.';
}

const styles = StyleSheet.create({
  /* `flexGrow` so a centred loading, empty or error state fills the space under
     the heading instead of collapsing to its own height at the top. The column
     and its gap are the Overview tab's. */
  content: { flexGrow: 1, padding: Spacing.x16, gap: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: 2, marginBottom: Spacing.x8 },
});
