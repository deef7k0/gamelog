import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import {
  FlatList,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  addDiaryEntry,
  deleteDiaryEntry,
  diaryDateParts,
  getDiary,
  getMyLog,
  getOwnedGames,
  getProfile,
  MAX_DIARY_LENGTH,
  type DiaryEntry,
} from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { formatPlaytime } from '@/lib/gaming';
import { getGameById } from '@/lib/games';
import { useAuth } from '@/store/auth';

type Tab = 'diary' | 'stats';

const TABS = [
  { key: 'diary' as const, label: 'Diary' },
  { key: 'stats' as const, label: 'Stats' },
];

/**
 * One person's diary and stats for one game.
 *
 * Keyed by (user, game) rather than by log id, because a diary can exist for a
 * game that was never formally logged — jotting "tried the demo" should not
 * require setting a status and a score first.
 *
 * Reached three ways: the Diary button on a game page, a library cover, and a
 * diary row on someone's wall. The `tab` param decides which side opens, so the
 * library lands on Stats and the wall lands on Diary.
 */
export default function DiaryScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const params = useLocalSearchParams<{ user: string; game: string; tab?: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const userId = params.user;
  const gameId = params.game;
  const isSelf = viewerId === userId;

  const [tab, setTab] = useState<Tab>(params.tab === 'stats' ? 'stats' : 'diary');
  const [draft, setDraft] = useState('');

  const owner = useQuery({
    queryKey: ['profile', userId],
    queryFn: () => getProfile(userId),
    enabled: !!userId,
  });

  const game = useQuery({
    queryKey: ['game', gameId],
    queryFn: ({ signal }) => getGameById(gameId, signal),
    enabled: !!gameId,
    staleTime: 30 * 60_000,
  });

  const diary = useQuery({
    queryKey: ['diary', userId, gameId],
    queryFn: () => getDiary(userId, gameId),
    enabled: !!userId && !!gameId,
  });

  const log = useQuery({
    queryKey: ['my-log', userId, gameId],
    queryFn: () => getMyLog(userId, gameId),
    enabled: !!userId && !!gameId,
  });

  /** Steam playtime and achievements for this title, when the account is linked. */
  const owned = useQuery({
    queryKey: ['gaming-owned-one', userId, gameId],
    queryFn: async () => {
      const games = await getOwnedGames(userId, { sort: 'most-played' });
      return games.find((entry) => entry.gameId === gameId) ?? null;
    },
    enabled: !!userId && !!gameId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['diary', userId, gameId] });
    queryClient.invalidateQueries({ queryKey: ['diary-count', userId, gameId] });
    // The wall derives its activity at read time, so it has to be refetched.
    queryClient.invalidateQueries({ queryKey: ['wall', userId] });
  }

  const add = useMutation({
    mutationFn: async () => {
      if (!viewerId) throw new Error('You must be signed in.');
      if (!game.data) throw new Error('Game details are still loading.');
      await addDiaryEntry({ userId: viewerId, game: game.data, body: draft });
    },
    onSuccess: () => {
      setDraft('');
      invalidate();
    },
  });

  const remove = useMutation({
    mutationFn: (entryId: string) => deleteDiaryEntry(entryId),
    onSuccess: invalidate,
  });

  if (!userId || !gameId) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <EmptyState title="Diary not found" />
      </Screen>
    );
  }

  const entries = diary.data ?? [];
  const ownerName = owner.data ? displayNameFor(owner.data) : 'This player';

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: game.data?.title ?? 'Diary' }} />

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        <TabBar tabs={TABS} value={tab} onChange={setTab} />

        {tab === 'diary' ? (
          <FlatList
            data={entries}
            keyExtractor={(entry) => entry.id}
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
            renderItem={({ item }) => (
              <EntryRow entry={item} canDelete={isSelf} onDelete={() => remove.mutate(item.id)} />
            )}
            ListHeaderComponent={
              entries.length > 0 ? (
                <Text variant="micro" color="textMuted" style={styles.count}>
                  {entries.length} {entries.length === 1 ? 'ENTRY' : 'ENTRIES'}
                </Text>
              ) : null
            }
            ListEmptyComponent={
              diary.isLoading ? (
                <LoadingState />
              ) : diary.isError ? (
                <ErrorState error={diary.error} />
              ) : (
                <EmptyState
                  title="No entries yet"
                  message={
                    isSelf
                      ? 'Write your first note about this game below.'
                      : `${ownerName} has not written about this game.`
                  }
                />
              )
            }
          />
        ) : (
          <StatsTab
            log={log.data ?? null}
            owned={owned.data ?? null}
            loading={log.isLoading}
            ownerName={ownerName}
          />
        )}

        {/* The composer is pinned to the bottom of the Diary tab, which is where
            the requirement puts it and where a chronological log wants it —
            writing appends to the end of a story you have just read. */}
        {tab === 'diary' && isSelf && (
          <View style={[styles.composer, { borderTopColor: theme.border }]}>
            <TextField
              value={draft}
              onChangeText={setDraft}
              placeholder="What happened today?"
              multiline
              maxLength={MAX_DIARY_LENGTH}
              style={styles.composerInput}
              error={add.error instanceof Error ? add.error.message : null}
            />
            <View style={styles.composerFoot}>
              <Text variant="micro" color="textMuted">
                {draft.trim().length}/{MAX_DIARY_LENGTH}
              </Text>
              <Button
                title="Add entry"
                size="small"
                onPress={() => add.mutate()}
                loading={add.isPending}
                disabled={!draft.trim() || !game.data}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * One entry: a date square, then the note.
 *
 * The square is the anchor — scanning a diary is scanning dates, so the numbers
 * get their own fixed-width block rather than being a prefix inside the text.
 */
function EntryRow({
  entry,
  canDelete,
  onDelete,
}: {
  entry: DiaryEntry;
  canDelete: boolean;
  onDelete: () => void;
}) {
  const theme = useTheme();
  const { day, month, year } = diaryDateParts(entry.entry_date);

  return (
    <View style={[styles.entry, { borderTopColor: theme.border }]}>
      <View style={[styles.dateSquare, { backgroundColor: theme.surfaceElevated }]}>
        <Text variant="bodyStrong">
          {day}/{month}
        </Text>
        <Text variant="micro" color="textMuted">
          {year}
        </Text>
      </View>

      <Text variant="body" color="textSecondary" style={styles.entryBody}>
        {entry.body}
      </Text>

      {canDelete && (
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Delete entry"
          onPress={onDelete}
          scaleTo={0.88}>
          <Ionicons name="close" size={16} color={theme.textMuted} />
        </PressableScale>
      )}
    </View>
  );
}

function StatsTab({
  log,
  owned,
  loading,
  ownerName,
}: {
  log: Awaited<ReturnType<typeof getMyLog>>;
  owned: Awaited<ReturnType<typeof getOwnedGames>>[number] | null;
  loading: boolean;
  ownerName: string;
}) {
  const theme = useTheme();

  if (loading) return <LoadingState />;

  if (!log && !owned) {
    return <EmptyState title="Nothing logged" message={`${ownerName} has not logged this game.`} />;
  }

  return (
    <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={styles.stats}>
        {log && (
          <View style={[styles.statCard, { borderTopColor: theme.border }]}>
            <View style={styles.statHead}>
              <Text variant="bodyStrong" style={{ color: statusColor(log.status, theme) }}>
                {STATUS_LABEL[log.status]}
              </Text>
              {log.platinum && <Ionicons name="trophy" size={16} color={theme.platinum} />}
            </View>

            {log.rating !== null && <ScorePill score={log.rating} size="large" showLabel />}

            <View style={styles.statGrid}>
              {log.hours_played !== null && <Stat label="Hours" value={`${log.hours_played}`} />}
              {log.completion_percent !== null && (
                <Stat label="Completion" value={`${log.completion_percent}%`} />
              )}
              {log.played_on && <Stat label="Played on" value={log.played_on} />}
            </View>

            {log.review_title && (
              <Text variant="bodyStrong" numberOfLines={2}>
                {log.review_title}
              </Text>
            )}
          </View>
        )}

        {/* Steam figures, when the account is linked. Shown separately from the
              hand-entered log so it is obvious which numbers are measured and
              which are self-reported. */}
        {owned && (
          <View style={[styles.statCard, { borderTopColor: theme.border }]}>
            <View style={styles.statHead}>
              <Ionicons name="logo-steam" size={15} color={theme.textSecondary} />
              <Text variant="micro" color="textSecondary">
                FROM STEAM
              </Text>
            </View>

            <View style={styles.statGrid}>
              <Stat label="Playtime" value={formatPlaytime(owned.playtimeMinutes)} />
              {owned.playtimeRecentMinutes > 0 && (
                <Stat label="Last 2 weeks" value={formatPlaytime(owned.playtimeRecentMinutes)} />
              )}
              {owned.achievementsTotal !== null && owned.achievementsTotal > 0 && (
                <Stat
                  label="Achievements"
                  value={`${owned.achievementsUnlocked ?? 0}/${owned.achievementsTotal}`}
                />
              )}
            </View>

            {owned.lastPlayedAt && (
              <Text variant="micro" color="textMuted">
                Last played {new Date(owned.lastPlayedAt).toLocaleDateString()}
              </Text>
            )}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text variant="bodyStrong">{value}</Text>
      <Text variant="micro" color="textMuted">
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.four, paddingBottom: Spacing.six },
  count: { paddingBottom: Spacing.three },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  dateSquare: {
    width: 58,
    height: 52,
    borderRadius: Radius.small,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 1,
  },
  entryBody: { flex: 1 },
  composer: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  composerInput: { minHeight: 64 },
  composerFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stats: { gap: Spacing.three },
  statCard: {
    paddingVertical: Spacing.four,
    gap: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  statHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.five },
  stat: { gap: 1 },
});
