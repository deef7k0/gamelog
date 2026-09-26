import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useRouter } from 'expo-router';
import { memo, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { IconButton } from '@/components/ui/icon-button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { REPORT_REASON_LABEL, SIMILARITY_REASON_LABEL, topReasons } from '@/constants/similarity';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  castSimilarityVote,
  getCommunitySimilar,
  removeSimilarityVote,
  reportSimilarity,
} from '@/lib/api';
import type { EditionKind } from '@/constants/game-editions';
import type { CommunitySimilarGame, SimilarityReportReason } from '@/lib/database.types';
import { useAuth } from '@/store/auth';

/**
 * What players here say this game is like — and why.
 *
 * ## Two lists on one tab, and they stay two
 *
 * IGDB's similar games are an algorithm's answer: no reasons, no way to
 * disagree, the same for everyone. This is the other answer — people naming a
 * game, saying *what* makes it alike (combat, progression, tone…), and everyone
 * else agreeing or not (0025). They are different claims, so they are headed and
 * shown apart, and this one comes first because it is the one only this app has.
 *
 * ## The numbers that are shown
 *
 * "12 players" — how many recommend it, which is the useful figure when deciding
 * how much weight a pick deserves. The ranking score and the downvote count are
 * not printed: the order already says which picks the community agrees on, and a
 * visible "−3" invites a pile-on more than it informs.
 */
export function CommunitySimilar({ gameId, gameTitle }: { gameId: string; gameTitle: string }) {
  const router = useRouter();
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  const picks = useQuery({
    queryKey: ['community-similar', gameId],
    queryFn: () => getCommunitySimilar(gameId),
    staleTime: 60_000,
  });

  const suggest = () => router.push({ pathname: '/suggest-similar/[id]', params: { id: gameId } });

  return (
    <View style={styles.section}>
      <View style={styles.head}>
        <Text variant="h3" accessibilityRole="header">
          From the community
        </Text>
        <Text variant="caption" color="textMuted">
          What players here say is like {gameTitle}, and why.
        </Text>
      </View>

      {picks.isLoading ? (
        <LoadingState />
      ) : picks.isError ? (
        <ErrorState error={picks.error} onRetry={() => void picks.refetch()} />
      ) : (picks.data ?? []).length === 0 ? (
        <Text variant="body" color="textSecondary">
          No community recommendations yet.
        </Text>
      ) : (
        <View style={styles.rows}>
          {picks.data!.map((pick) => (
            <PickRow key={pick.similarity_id} pick={pick} gameId={gameId} userId={userId} />
          ))}
        </View>
      )}

      {userId && (
        <Button
          title="Suggest a similar game"
          icon="add"
          variant="secondary"
          fullWidth
          onPress={suggest}
        />
      )}
    </View>
  );
}

const PickRow = memo(function PickRow({
  pick,
  gameId,
  userId,
}: {
  pick: CommunitySimilarGame;
  gameId: string;
  userId: string | null;
}) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [reported, setReported] = useState(false);

  const reasons = topReasons(pick.reasons).map((reason) => SIMILARITY_REASON_LABEL[reason]);
  const players = `${pick.up} ${pick.up === 1 ? 'player' : 'players'}`;

  const vote = useMutation({
    mutationFn: async (next: -1 | 1) => {
      if (!userId) throw new Error('Sign in to vote.');
      /* Pressing the vote you already cast takes it back — a toggle, the way
         every other on/off control on the game page works. */
      if (pick.viewer_vote === next) await removeSimilarityVote(userId, pick.similarity_id);
      else await castSimilarityVote(userId, pick.similarity_id, next);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['community-similar', gameId] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', pick.game_id] });
    },
  });

  const report = useMutation({
    mutationFn: (reason: SimilarityReportReason) =>
      reportSimilarity(userId!, pick.similarity_id, reason),
    onSuccess: () => setReported(true),
  });

  function askReport() {
    Alert.alert(
      'Report this recommendation?',
      `Only moderators see reports. Three reports take “${pick.title}” off this list until one of them looks.`,
      [
        ...(['incorrect', 'spam', 'inappropriate'] as const).map((reason) => ({
          text: REPORT_REASON_LABEL[reason],
          onPress: () => report.mutate(reason),
        })),
        { text: 'Cancel', style: 'cancel' as const },
      ]
    );
  }

  const label = [
    pick.title,
    `recommended by ${players}`,
    reasons.length > 0 ? `for ${reasons.join(', ').toLowerCase()}` : null,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <View style={[styles.row, { backgroundColor: theme.surface }]}>
      <Link href={{ pathname: '/game/[id]', params: { id: pick.game_id } }} asChild>
        <PressableScale
          accessibilityRole="link"
          accessibilityLabel={label}
          scaleTo={0.98}
          style={styles.main}>
          <Poster
            coverUrl={pick.cover_url}
            heroUrl={pick.hero_url}
            title={pick.title}
            edition={(pick.edition_kind as EditionKind | null) ?? null}
            width={56}
            rounded="image"
          />
          <View style={styles.text}>
            <Text variant="h5" numberOfLines={2}>
              {pick.title}
              {pick.release_year ? (
                <Text variant="bodySmall" color="textMuted">{`  ${pick.release_year}`}</Text>
              ) : null}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {[players, ...reasons].join(' · ')}
            </Text>
            {pick.comment && (
              <Text variant="bodySmall" color="textSecondary" numberOfLines={3}>
                “{pick.comment}”{pick.comment_author ? ` — ${pick.comment_author}` : ''}
              </Text>
            )}
          </View>
        </PressableScale>
      </Link>

      {userId && (
        <View style={styles.controls}>
          <IconButton
            icon={pick.viewer_vote === 1 ? 'thumbs-up' : 'thumbs-up-outline'}
            accessibilityLabel={
              pick.viewer_vote === 1
                ? 'Take back your agreement'
                : `Agree that ${pick.title} is similar`
            }
            size="small"
            tone="plain"
            disabled={vote.isPending}
            onPress={() => vote.mutate(1)}
          />
          <IconButton
            icon={pick.viewer_vote === -1 ? 'thumbs-down' : 'thumbs-down-outline'}
            accessibilityLabel={
              pick.viewer_vote === -1
                ? 'Take back your disagreement'
                : `Disagree that ${pick.title} is similar`
            }
            size="small"
            tone="plain"
            disabled={vote.isPending}
            onPress={() => vote.mutate(-1)}
          />
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`Say why ${pick.title} is similar`}
            onPress={() =>
              router.push({
                pathname: '/suggest-similar/[id]',
                params: { id: gameId, other: pick.game_id },
              })
            }
            hitSlop={Spacing.x8}
            scaleTo={0.96}
            style={styles.why}>
            <Text variant="bodySmall" color="primaryText">
              {pick.viewer_vote === 1 ? 'Your reasons' : 'Add your reasons'}
            </Text>
          </PressableScale>
          <View style={styles.flex} />
          {reported ? (
            <Text variant="caption" color="textMuted">
              Reported
            </Text>
          ) : (
            <IconButton
              icon="flag-outline"
              accessibilityLabel={`Report the recommendation of ${pick.title}`}
              size="small"
              tone="plain"
              disabled={report.isPending}
              onPress={askReport}
            />
          )}
        </View>
      )}

      {(vote.isError || report.isError) && (
        <Text variant="caption" color="danger">
          {((vote.error ?? report.error) as Error).message}
        </Text>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  section: { gap: Spacing.x12 },
  head: { gap: 2 },
  rows: { gap: Spacing.x8 },
  row: { padding: Spacing.x12, gap: Spacing.x8, borderRadius: Radius.card },
  main: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'flex-start' },
  text: { flex: 1, gap: Spacing.x4 },
  controls: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  why: { paddingHorizontal: Spacing.x8 },
});
