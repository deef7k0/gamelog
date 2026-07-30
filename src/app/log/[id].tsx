import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { GameCase } from '@/components/game-case';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ReviewMetricsEditor,
  draftFromMetrics,
  metricsFromDraft,
  type ReviewMetricsDraft,
} from '@/components/review-metrics';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { ScoreInput } from '@/components/ui/score-input';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { LOG_STATUSES, STATUS_LABEL, statusColor } from '@/constants/status';
import { caseKeysFor } from '@/constants/platform-cases';
import { averageMetrics, countMetrics, parseReviewMetrics } from '@/constants/review-metrics';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { deleteLog, getMyLog, saveLog } from '@/lib/api';
import type { GameLog, LogStatus } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { useAuth } from '@/store/auth';

export default function LogGameScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useAuth((state) => state.session?.user.id);

  const game = useQuery({
    queryKey: ['game', id],
    queryFn: ({ signal }) => getGameById(id!, signal),
    enabled: !!id,
    staleTime: 30 * 60_000,
  });

  const existing = useQuery({
    queryKey: ['my-log', userId, id],
    queryFn: () => getMyLog(userId!, id!),
    enabled: !!userId && !!id,
  });

  if (game.isLoading || existing.isLoading) {
    return (
      <Screen edges={['bottom']}>
        <LoadingState />
      </Screen>
    );
  }

  if (game.isError) {
    return (
      <Screen edges={['bottom']}>
        <ErrorState error={game.error} />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen edges={['bottom']}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  return (
    // Keying on the log id lets the form initialise its state from props on
    // mount, instead of syncing it in an effect after the query resolves.
    <LogForm
      key={existing.data?.id ?? 'new'}
      game={game.data}
      existing={existing.data ?? null}
      userId={userId}
    />
  );
}

type LogFormProps = {
  game: Game;
  existing: GameLog | null;
  userId: string | undefined;
};

function LogForm({ game, existing, userId }: LogFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();

  const savedMetrics = parseReviewMetrics(existing?.review_metrics ?? null);

  const [status, setStatus] = useState<LogStatus>(existing?.status ?? 'played');
  const [rating, setRating] = useState<number | null>(existing?.rating ?? null);
  const [advanced, setAdvanced] = useState(savedMetrics !== null);
  const [metricDraft, setMetricDraft] = useState<ReviewMetricsDraft>(() =>
    draftFromMetrics(savedMetrics)
  );
  const [reviewTitle, setReviewTitle] = useState(existing?.review_title ?? '');
  const [review, setReview] = useState(existing?.review ?? '');
  const [platinum, setPlatinum] = useState(existing?.platinum ?? false);
  const [completed, setCompleted] = useState(existing?.completion_percent === 100);
  const [hours, setHours] = useState(
    existing?.hours_played != null ? String(existing.hours_played) : ''
  );
  const [playedOn, setPlayedOn] = useState(existing?.played_on ?? '');

  /*
   * The score is derived during render, never synced into state by an effect
   * (which the React Compiler rules reject anyway). In advanced mode it is the
   * mean of the activated metrics; the bar's own value is left untouched
   * underneath, so unticking the box gives the user back the score they had.
   */
  const metrics = metricsFromDraft(metricDraft);
  const metricCount = countMetrics(metrics);
  const effectiveRating = advanced ? averageMetrics(metrics) : rating;

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['feed'] });
    queryClient.invalidateQueries({ queryKey: ['my-log', userId, game.id] });
    queryClient.invalidateQueries({ queryKey: ['game-reviews', game.id] });
    queryClient.invalidateQueries({ queryKey: ['user-logs', userId] });
    queryClient.invalidateQueries({ queryKey: ['profile-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['achievement-stats', userId] });
    queryClient.invalidateQueries({ queryKey: ['completions', userId] });
  }

  const save = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');

      const parsedHours = hours.trim() ? Number(hours.trim()) : null;
      if (parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)) {
        throw new Error('Hours played must be a positive number.');
      }

      if (reviewTitle.trim() && !review.trim()) {
        throw new Error('Your review has a headline but no body.');
      }

      await saveLog(userId, {
        game,
        status,
        rating: effectiveRating,
        reviewMetrics: advanced ? metrics : null,
        reviewTitle,
        review,
        platinum,
        // A platinum implies a full clear, so record 100% either way.
        completionPercent: completed || platinum ? 100 : null,
        hoursPlayed: parsedHours,
        playedOn: playedOn.trim() || null,
      });
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteLog(userId, game.id);
    },
    onSuccess: () => {
      invalidate();
      router.back();
    },
  });

  const mutationError = save.error ?? remove.error;

  return (
    <Screen edges={['bottom']} padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.gameHead}>
            <GameCase
              coverUrl={game.coverUrl}
              heroUrl={game.heroUrl}
              title={game.title}
              platform={caseKeysFor(game.platforms)[0]}
              size="small"
              tilt={4}
            />
            <View style={styles.gameHeadText}>
              <Text variant="heading" numberOfLines={2}>
                {game.title}
              </Text>
              <Text variant="caption" color="textMuted">
                {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Status
            </Text>
            <View style={styles.statuses}>
              {LOG_STATUSES.map((option) => {
                const selected = status === option;
                const tint = statusColor(option, theme);
                return (
                  <Pressable
                    key={option}
                    onPress={() => setStatus(option)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    style={[
                      styles.status,
                      {
                        backgroundColor: selected ? tint : theme.surface,
                        borderColor: selected ? tint : theme.border,
                      },
                    ]}>
                    <Text
                      variant="caption"
                      style={{ color: selected ? theme.background : theme.textSecondary }}>
                      {STATUS_LABEL[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Score
            </Text>

            <ScoreInput
              value={effectiveRating}
              onChange={setRating}
              disabled={advanced}
              hint={
                advanced
                  ? metricCount === 0
                    ? 'Score a metric below'
                    : `averaged from ${metricCount} ${metricCount === 1 ? 'metric' : 'metrics'}`
                  : undefined
              }
            />

            <View style={styles.metrics}>
              <ReviewMetricsEditor
                enabled={advanced}
                onToggleEnabled={setAdvanced}
                draft={metricDraft}
                onChangeDraft={setMetricDraft}
              />
            </View>
          </View>

          {/* Completion. `platinum` is self-reported for every platform — no
              console publishes a trophy API — but Steam sync can set the 100%. */}
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Completion
            </Text>
            <View style={styles.toggles}>
              <Toggle
                icon="checkmark-circle"
                label="Completed 100%"
                tint={theme.success}
                value={completed || platinum}
                onPress={() => setCompleted((current) => !current)}
                disabled={platinum}
              />
              <Toggle
                icon="trophy"
                label="Platinum"
                tint={theme.platinum}
                value={platinum}
                onPress={() => setPlatinum((current) => !current)}
              />
            </View>
          </View>

          <View style={styles.row}>
            <View style={styles.rowItem}>
              <TextField
                label="Hours played"
                value={hours}
                onChangeText={setHours}
                keyboardType="numeric"
                placeholder="0"
              />
            </View>
            <View style={styles.rowItem}>
              <TextField
                label="Played on"
                value={playedOn}
                onChangeText={setPlayedOn}
                placeholder="PS5"
                autoCapitalize="words"
              />
            </View>
          </View>

          {/* Long-form review. The headline is optional — a score with a short
              note is still a valid log — but a headline without a body is not,
              which `save` rejects. */}
          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Review
            </Text>

            <TextField
              value={reviewTitle}
              onChangeText={setReviewTitle}
              placeholder="Headline (optional)"
              maxLength={140}
              style={styles.reviewTitle}
            />

            <TextField
              value={review}
              onChangeText={setReview}
              placeholder="Write as much as you like — this can be a full article."
              multiline
              maxLength={40000}
              style={styles.reviewBody}
              hint={review.trim() ? `${review.trim().length} characters` : 'Optional'}
            />
          </View>

          {mutationError && (
            <Text variant="caption" color="danger">
              {mutationError instanceof Error ? mutationError.message : 'Could not save.'}
            </Text>
          )}

          <View style={styles.actions}>
            <Button
              title={existing ? 'Save changes' : 'Log game'}
              onPress={() => save.mutate()}
              loading={save.isPending}
              fullWidth
            />

            {existing && (
              <Button
                title="Remove log"
                variant="ghost"
                onPress={() => remove.mutate()}
                loading={remove.isPending}
                fullWidth
              />
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

function Toggle({
  icon,
  label,
  tint,
  value,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  tint: string;
  value: boolean;
  onPress: () => void;
  disabled?: boolean;
}) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="switch"
      accessibilityState={{ checked: value, disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      scaleTo={0.97}
      style={[
        styles.toggle,
        {
          backgroundColor: value ? `${tint}22` : theme.surface,
          borderColor: value ? tint : theme.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <Ionicons name={icon} size={18} color={value ? tint : theme.textMuted} />
      <Text variant="caption" style={{ color: value ? tint : theme.textSecondary }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.five, paddingVertical: Spacing.five },
  gameHead: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  gameHeadText: { flex: 1, gap: Spacing.half },
  section: { gap: Spacing.two },
  // A little air between the bar and the tick box so they read as two choices
  // rather than one control with a stray checkbox attached.
  metrics: { marginTop: Spacing.two },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  status: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewTitle: { fontSize: 17, fontWeight: '700' },
  // Tall by default: a short box invites a short review.
  reviewBody: { minHeight: 260 },
  toggles: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: Spacing.three },
  rowItem: { flex: 1 },
  actions: { gap: Spacing.two },
});
