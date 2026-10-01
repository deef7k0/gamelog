import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Keyboard, StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { ProgressSheet } from '@/components/progress-sheet';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { SlideUpSheet } from '@/components/ui/slide-up-sheet';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { getMyLog, getUserLogs } from '@/lib/api';
import { getGameById, type GameSearchResult } from '@/lib/games';
import { useAuth } from '@/store/auth';

/** What the profile's + asked to do with the game picked here. */
export type QuickLogMode = 'log' | 'review';

/**
 * Log or review a game without going through its page: the profile's +.
 *
 * Search, tap, and the game goes straight to the thing you came to do:
 *
 * - **Review** replaces this screen with the log form (`log/[id]`), where the
 *   score and the writing are — not the game page, which would put a masthead
 *   and a dozen sections between you and the text box.
 * - **Log** raises the game page's own progress sheet over this screen, with
 *   its seven choices. Choosing one saves it and closes the whole flow, back to
 *   wherever the + was; putting the sheet away without choosing leaves you on
 *   the search to pick another game.
 *
 * The sheet needs the full catalogue record and your current log, as it does on
 * the game page, so both are fetched under the game page's own keys
 * (`['game', id]`, `['my-log', userId, id]`) — opening the game later is free,
 * and the progress sheet's own invalidation reaches this flow too.
 */
export default function QuickLogScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: QuickLogMode }>();
  const reviewing = mode === 'review';
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());
  const [picked, setPicked] = useState<GameSearchResult | null>(null);

  /* Already in the cache on any account that has opened Home or its profile. */
  const logs = useQuery({
    queryKey: ['user-logs', userId],
    queryFn: () => getUserLogs(userId!),
    enabled: !!userId,
  });
  const logged = useMemo(() => new Set((logs.data ?? []).map((log) => log.game_id)), [logs.data]);

  const game = useQuery({
    queryKey: ['game', picked?.id],
    queryFn: ({ signal }) => getGameById(picked!.id, signal),
    enabled: !!picked,
    staleTime: 30 * 60_000,
  });
  const myLog = useQuery({
    queryKey: ['my-log', userId, picked?.id],
    queryFn: () => getMyLog(userId!, picked!.id),
    enabled: !!picked && !!userId,
  });

  function choose(result: GameSearchResult) {
    if (reviewing) {
      router.replace({ pathname: '/log/[id]', params: { id: result.id } });
      return;
    }
    /* The search field is still focused, and on Android its keyboard shrinks
       the window the sheet is sized from. */
    Keyboard.dismiss();
    setPicked(result);
  }

  const failure = game.error ?? myLog.error;

  return (
    /* A modal, like every picker: `dismiss` closes it, and `modal` stops the
       bar insetting itself under an iOS sheet's own top edge. */
    <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
      <View style={styles.header}>
        {/* There is no header anywhere in this app, so a screen opening on a
            list says what it is in its own content. */}
        <View style={styles.heading}>
          <Text variant="h1" accessibilityRole="header">
            {reviewing ? 'Review a game' : 'Log a game'}
          </Text>
          <Text variant="body" color="textSecondary">
            {reviewing
              ? 'Find it, then write about it and give it a score.'
              : 'Find it, then say where you are with it.'}
          </Text>
        </View>

        <TextField
          value={input}
          onChangeText={setInput}
          icon="search"
          variant="search"
          placeholder="Search games…"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>

      <GameSearchResults
        query={query}
        onSelect={choose}
        badgeFor={(result) => (logged.has(result.id) ? 'In your log' : null)}
        prompt={{
          title: reviewing ? 'Which game?' : 'What are you playing?',
          message: 'Search IGDB, then tap the game.',
        }}
      />

      <SlideUpSheet
        visible={!!picked}
        onClose={() => setPicked(null)}
        title={picked?.title ?? 'Your progress'}
        maxHeightRatio={0.85}>
        {failure ? (
          <ErrorState error={failure} />
        ) : game.data && myLog.isSuccess ? (
          <ProgressSheet
            game={game.data}
            log={myLog.data ?? null}
            /* A choice is saved: the flow is done. */
            onClose={() => router.back()}
            onOpenPlaythroughs={() =>
              router.replace({ pathname: '/playthroughs/[game]', params: { game: game.data!.id } })
            }
          />
        ) : game.isSuccess && !game.data ? (
          <ErrorState error={new Error(`Could not load “${picked?.title}” from IGDB.`)} />
        ) : (
          <LoadingState />
        )}
      </SlideUpSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.x16, gap: Spacing.x16 },
  heading: { gap: Spacing.x4 },
});
