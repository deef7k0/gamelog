import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { COMPLETION_LABEL, formatPartialDate } from '@/constants/progress';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getMyLog, getPlaythroughs } from '@/lib/api';
import type { PlaythroughRow } from '@/lib/database.types';
import { getGameById } from '@/lib/games';
import { useAuth } from '@/store/auth';

/**
 * Every time you played one game.
 *
 * One log per game is the relationship — want to play it, finished it, dropped
 * it — and it stays one row however many times you come back. This screen is
 * what hangs underneath: the PS4 run in 2021, the PC run in 2026, each with its
 * own platform, dates and how far it got (0023). A run that got further than the
 * log says raises the log; nothing here lowers it.
 *
 * Reached from the progress sheet, which only offers it once there is a log —
 * a playthrough cannot exist without one.
 */
export default function PlaythroughsScreen() {
  const router = useRouter();
  const { game: gameId } = useLocalSearchParams<{ game: string }>();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId!, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  const log = useQuery({
    queryKey: ['my-log', userId, gameId],
    queryFn: () => getMyLog(userId!, gameId!),
    enabled: !!userId && !!gameId,
  });

  const runs = useQuery({
    queryKey: ['playthroughs', userId, gameId],
    queryFn: () => getPlaythroughs(userId!, gameId!),
    enabled: !!userId && !!gameId,
  });

  const open = (id: string) =>
    router.push({ pathname: '/playthrough/[id]', params: { id, game: gameId! } });

  if (!userId) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Sign in to log playthroughs" />
      </Screen>
    );
  }

  const loading = game.isLoading || log.isLoading || runs.isLoading;
  const error = game.error ?? log.error ?? runs.error;

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      <FlatList
        data={runs.data ?? []}
        keyExtractor={(run) => run.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            {/* No title bar exists to say which game this is (CLAUDE.md), so
                the page says it. */}
            <Text variant="h1" numberOfLines={2}>
              {game.data?.title ?? 'Playthroughs'}
            </Text>
            <Text variant="label" color="textMuted">
              YOUR PLAYTHROUGHS
            </Text>
          </View>
        }
        renderItem={({ item, index }) => (
          <RunCard run={item} number={index + 1} onPress={() => open(item.id)} />
        )}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          loading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState
              error={error}
              onRetry={() => {
                void game.refetch();
                void log.refetch();
                void runs.refetch();
              }}
            />
          ) : !log.data ? (
            <EmptyState
              title="Set your progress first"
              message="Playthroughs belong to your log of a game. Mark where you are with it on its page, then come back to add runs."
            />
          ) : (
            <EmptyState
              title="No playthroughs yet"
              message="Played it more than once, or want to remember the platform and dates? Add a run."
            />
          )
        }
        ListFooterComponent={
          log.data ? (
            <View style={styles.footer}>
              <Button
                title="Add a playthrough"
                icon="add"
                variant="secondary"
                fullWidth
                onPress={() => open('new')}
              />
            </View>
          ) : null
        }
      />
    </Screen>
  );
}

/**
 * One run: its number, the platform, how far it got, and when.
 *
 * Numbered by order of creation, oldest first — the first time you played it is
 * #1, whatever came after. Computed from position rather than stored, so
 * deleting the second of three does not leave a gap to renumber.
 */
function RunCard({
  run,
  number,
  onPress,
}: {
  run: PlaythroughRow;
  number: number;
  onPress: () => void;
}) {
  const theme = useTheme();

  const started = formatPartialDate(run.started_on);
  const finished = formatPartialDate(run.finished_on);
  const when =
    started && finished
      ? `${started} – ${finished}`
      : started
        ? `Started ${started}`
        : finished
          ? `Finished ${finished}`
          : null;

  const facts = [
    run.completion
      ? COMPLETION_LABEL[run.completion]
      : run.completion_percent !== null
        ? `${Math.round(Number(run.completion_percent))}%`
        : 'Not finished',
    run.hours !== null ? `${Number(run.hours)} h` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Playthrough ${number}${run.platform ? ` on ${run.platform}` : ''}. ${facts}. ${when ?? ''} Edit it.`}
      onPress={onPress}
      scaleTo={0.98}
      style={StyleSheet.flatten([
        styles.card,
        { backgroundColor: theme.surface, borderColor: theme.border },
      ])}>
      <View style={styles.cardHead}>
        <Text variant="h4">#{number}</Text>
        {run.platform && (
          <Text variant="label" color="textSecondary">
            {run.platform}
          </Text>
        )}
        <View style={styles.flex} />
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </View>
      <Text variant="body" color="textSecondary">
        {facts}
      </Text>
      {when && (
        <Text variant="caption" color="textMuted">
          {when}
        </Text>
      )}
      {run.notes && (
        <Text variant="bodySmall" color="textSecondary" numberOfLines={2}>
          {run.notes}
        </Text>
      )}
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x4, marginBottom: Spacing.x24 },
  separator: { height: Spacing.x12 },
  footer: { marginTop: Spacing.x24 },
  card: {
    gap: Spacing.x4,
    padding: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  flex: { flex: 1 },
});
