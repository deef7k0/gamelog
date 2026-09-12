import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import {
  Alert,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { Button } from '@/components/ui/button';
import { GameCaseDisplay } from '@/components/game-case-display';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  ReviewMetricsEditor,
  draftFromMetrics,
  metricsFromDraft,
  type ReviewMetricsDraft,
} from '@/components/review-metrics';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { EmptyState, ErrorState, Screen } from '@/components/ui/screen';
import { ScoreInput } from '@/components/ui/score-input';
import { SelectField, type SelectOption } from '@/components/ui/select-field';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { PLATFORMS, platformKeysFor } from '@/constants/platform-cases';
import { LOG_STATUSES, STATUS_ICON, STATUS_LABEL, statusColor } from '@/constants/status';
import { averageMetrics, countMetrics, parseReviewMetrics } from '@/constants/review-metrics';
import { Radius, Spacing, TapTarget, Type, readableInk, withAlpha } from '@/constants/theme';
import { AccentProvider } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { deleteLog, getMyLog, saveLog } from '@/lib/api';
import type { GameLog, LogStatus } from '@/lib/database.types';
import { getGameById, type Game } from '@/lib/games';
import { clearDraft, loadDraft, saveDraft, type LogDraft } from '@/lib/log-draft';
import { useAuth } from '@/store/auth';

/** How long the form waits after the last keystroke before writing a draft. */
const DRAFT_DEBOUNCE_MS = 800;

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

  /*
   * The unsaved draft, read *before* the form mounts.
   *
   * It is a query rather than an effect for the same reason `existing` is: the
   * form seeds its state from props on mount, so anything it initialises from
   * has to have resolved first. Invalidating this key is also how "Discard
   * draft" works — the key changes, the form remounts, and the saved log wins.
   */
  const draft = useQuery({
    queryKey: ['log-draft', userId, id],
    queryFn: () => loadDraft(userId!, id!),
    enabled: !!userId && !!id,
    staleTime: Infinity,
    gcTime: 0,
  });

  if (game.isLoading || existing.isLoading || draft.isLoading) {
    return (
      <Screen edges={['bottom']} padded insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <LogFormSkeleton />
      </Screen>
    );
  }

  if (game.isError) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <ErrorState error={game.error} />
      </Screen>
    );
  }

  if (!game.data) {
    return (
      <Screen edges={['bottom']} insetHeader modal topBar={<FrostedTopBar dismiss />}>
        <EmptyState title="Game not found" />
      </Screen>
    );
  }

  return (
    // The form runs on the game's colour — it is one of the four screens that
    // are about a single game, so the save button and the status picker take
    // that game's hue rather than the house blue.
    <AccentProvider artwork={game.data.coverUrl ?? game.data.heroUrl} genres={game.data.genres}>
      {/* Keying on the log id lets the form initialise its state from props on
          mount, instead of syncing it in an effect after the query resolves.
          The draft's timestamp joins the key so discarding one remounts the
          form against the saved log. */}
      <LogForm
        key={`${existing.data?.id ?? 'new'}:${draft.data?.savedAt ?? 0}`}
        game={game.data}
        existing={existing.data ?? null}
        draft={draft.data ?? null}
        userId={userId}
      />
    </AccentProvider>
  );
}

type LogFormProps = {
  game: Game;
  existing: GameLog | null;
  draft: LogDraft | null;
  userId: string | undefined;
};

/** Everything the dirty check and the draft both care about, as one comparable value. */
type FormValues = {
  status: LogStatus;
  rating: number | null;
  advanced: boolean;
  metricDraft: ReviewMetricsDraft;
  reviewTitle: string;
  review: string;
  platinum: boolean;
  completed: boolean;
  hours: string;
  playedOn: string;
};

/*
 * A stable string for a set of form values.
 *
 * Metric keys are sorted because the draft object's insertion order depends on
 * the order the user typed in, and comparing two objects whose keys arrived in
 * different orders would report every restored draft as dirty.
 */
function signature(values: FormValues): string {
  const metrics = Object.keys(values.metricDraft)
    .sort()
    .map((key) => `${key}=${values.metricDraft[key as keyof ReviewMetricsDraft]}`)
    .join(',');

  return [
    values.status,
    values.rating ?? '',
    values.advanced,
    metrics,
    values.reviewTitle.trim(),
    values.review.trim(),
    values.platinum,
    values.completed,
    values.hours.trim(),
    values.playedOn.trim(),
  ].join('|');
}

/** Fire and forget — a missing Taptic engine must never interrupt a save. */
function tap(run: () => Promise<void>) {
  if (Platform.OS === 'web') return;
  void run().catch(() => {});
}

function LogForm({ game, existing, draft, userId }: LogFormProps) {
  const theme = useTheme();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const savedMetrics = parseReviewMetrics(existing?.review_metrics ?? null);

  /* The draft wins on mount when there is one — it is by definition newer than
     the saved log, and it is the work the user has not been given back yet. */
  const [status, setStatus] = useState<LogStatus>(
    (draft?.status as LogStatus | undefined) ?? existing?.status ?? 'played'
  );
  const [rating, setRating] = useState<number | null>(draft?.rating ?? existing?.rating ?? null);
  const [advanced, setAdvanced] = useState(draft?.advanced ?? savedMetrics !== null);
  const [metricDraft, setMetricDraft] = useState<ReviewMetricsDraft>(
    () => draft?.metricDraft ?? draftFromMetrics(savedMetrics)
  );
  const [reviewTitle, setReviewTitle] = useState(
    draft?.reviewTitle ?? existing?.review_title ?? ''
  );
  const [review, setReview] = useState(draft?.review ?? existing?.review ?? '');
  const [platinum, setPlatinum] = useState(draft?.platinum ?? existing?.platinum ?? false);
  const [completed, setCompleted] = useState(
    draft?.completed ?? existing?.completion_percent === 100
  );
  const [hours, setHours] = useState(
    draft?.hours ?? (existing?.hours_played != null ? String(existing.hours_played) : '')
  );
  const [playedOn, setPlayedOn] = useState(draft?.playedOn ?? existing?.played_on ?? '');

  /*
   * What this game can honestly have been played on.
   *
   * Sourced from the game's own platform list, so the choices are the release's
   * and not a global menu. The stored value is the short form ("PS5") — it is
   * what the case's printed back and a feed row have room for — while the sheet
   * shows the full name, which is what a person picking one needs to read.
   *
   * A value saved before this field was constrained is kept and offered as-is.
   * Dropping it would rewrite someone's own record to make the new control look
   * tidy, which is the one outcome worse than the typo it was built to prevent.
   */
  const platformOptions = useMemo<SelectOption[]>(() => {
    const options: SelectOption[] = platformKeysFor(game.platforms).map((key) => ({
      value: PLATFORMS[key].short,
      label: PLATFORMS[key].label,
      icon: PLATFORMS[key].icon,
      tint: PLATFORMS[key].accent,
    }));

    const saved = existing?.played_on?.trim();
    if (saved && !options.some((option) => option.value === saved)) {
      options.push({
        value: saved,
        label: saved,
        icon: 'game-controller',
        tint: theme.textSecondary,
        foreign: true,
      });
    }

    return options;
  }, [game.platforms, existing?.played_on, theme.textSecondary]);

  /*
   * The score is derived during render, never synced into state by an effect
   * (which the React Compiler rules reject anyway). In advanced mode it is the
   * mean of the activated metrics; the bar's own value is left untouched
   * underneath, so unticking the box gives the user back the score they had.
   */
  const metrics = metricsFromDraft(metricDraft);
  const metricCount = countMetrics(metrics);
  const effectiveRating = advanced ? averageMetrics(metrics) : rating;

  /* Touching either review field commits you to both. Derived rather than a
     separate mode toggle: the intent is already legible from what was typed. */
  const writingReview = !!reviewTitle.trim() || !!review.trim();

  const values: FormValues = {
    status,
    rating,
    advanced,
    metricDraft,
    reviewTitle,
    review,
    platinum,
    completed,
    hours,
    playedOn,
  };

  /* Measured against the *saved log*, not against the draft: the question the
     discard prompt and the draft writer both ask is "is there work here that
     Postgres does not have", and a restored draft is exactly that. */
  const baseline: FormValues = {
    status: existing?.status ?? 'played',
    rating: existing?.rating ?? null,
    advanced: savedMetrics !== null,
    metricDraft: draftFromMetrics(savedMetrics),
    reviewTitle: existing?.review_title ?? '',
    review: existing?.review ?? '',
    platinum: existing?.platinum ?? false,
    completed: existing?.completion_percent === 100,
    hours: existing?.hours_played != null ? String(existing.hours_played) : '',
    playedOn: existing?.played_on ?? '',
  };

  const dirty = signature(values) !== signature(baseline);

  /*
   * Everything that would stop a save, resolved during render rather than
   * thrown from the mutation.
   *
   * The hours check used to live inside `mutationFn`, so its message arrived as
   * a red line above the buttons — roughly 600dp from the field that caused it,
   * with the field itself off-screen by then. Deriving it here lets the error
   * sit on the input and lets the button say up front that it will not go.
   */
  const parsedHours = hours.trim() ? Number(hours.trim()) : null;
  const hoursError =
    parsedHours !== null && (!Number.isFinite(parsedHours) || parsedHours < 0)
      ? 'Enter a number of hours — 40, or 12.5. Not a negative one.'
      : null;

  /*
   * Advanced metrics on, nothing scored, and a score already saved.
   *
   * `averageMetrics` returns null for an empty set, and `saveLog` writes that
   * straight over `logs.rating` — the one column feeds, game averages, profile
   * stats and share text all read. Ticking the box out of curiosity and saving
   * would silently delete the score, so this blocks instead.
   */
  const clearsRating = advanced && metricCount === 0 && existing?.rating != null;

  const blocked =
    hoursError ??
    (writingReview && !reviewTitle.trim() ? 'Your review needs a headline.' : null) ??
    (writingReview && !review.trim() ? 'Your review needs a body.' : null) ??
    (clearsRating ? 'Advanced metrics are on with nothing scored.' : null);

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

      /* The derived checks above already gate the button. These stay as the
         backstop for a save that arrives some other way. */
      if (hoursError) throw new Error(hoursError);
      if (reviewTitle.trim() && !review.trim()) {
        throw new Error('Your review has a headline but no body.');
      }
      if (review.trim() && !reviewTitle.trim()) {
        throw new Error('Your review needs a headline.');
      }
      if (clearsRating) {
        throw new Error('Score a metric, or untick advanced metrics to keep your score.');
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

      if (userId) await clearDraft(userId, game.id);
    },
    onSuccess: () => {
      tap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
      invalidate();
      queryClient.removeQueries({ queryKey: ['log-draft', userId, game.id] });
      router.back();
    },
  });

  const remove = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      await deleteLog(userId, game.id);
      await clearDraft(userId, game.id);
    },
    onSuccess: () => {
      tap(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning));
      invalidate();
      queryClient.removeQueries({ queryKey: ['log-draft', userId, game.id] });
      router.back();
    },
  });

  const mutationError = save.error ?? remove.error;

  /*
   * Write the draft behind the keystrokes.
   *
   * Debounced because this runs on every character of a piece of writing that
   * can reach 40,000 of them, and an AsyncStorage round trip per keypress would
   * be felt. Only while dirty: a form that matches the saved log has nothing
   * worth keeping, and writing one would resurrect a draft the user just
   * discarded.
   */
  useEffect(() => {
    if (!userId || !dirty || save.isPending || remove.isPending) return;

    const timer = setTimeout(() => {
      void saveDraft(userId, game.id, { ...values, savedAt: Date.now() });
    }, DRAFT_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, game.id, dirty, save.isPending, remove.isPending, signature(values)]);

  /*
   * Leaving with unsaved work.
   *
   * Three exits, three mechanisms, because no single public API covers all of
   * them: the close disc routes through `onBack` below, the iOS sheet's
   * swipe-down is disabled while dirty, and Android's hardware back is
   * intercepted here. Missing any one of them leaves a way to lose a review.
   */
  useEffect(() => {
    navigation.setOptions({ gestureEnabled: !dirty });
  }, [navigation, dirty]);

  function confirmDismiss() {
    if (!dirty) {
      router.back();
      return;
    }

    Alert.alert(
      'Leave without saving?',
      draft
        ? 'Your draft is kept on this device, so you can pick it up again.'
        : `Your unsaved changes to ${game.title} are kept as a draft on this device.`,
      [
        { text: 'Keep editing', style: 'cancel' },
        { text: 'Leave', onPress: () => router.back() },
      ]
    );
  }

  useEffect(() => {
    if (!dirty) return;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmDismiss();
      return true;
    });
    return () => subscription.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dirty]);

  function confirmRemove() {
    Alert.alert(
      'Remove your log?',
      `Your score and review for ${game.title} are deleted along with it. This cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: () => remove.mutate() },
      ]
    );
  }

  function discardDraft() {
    Alert.alert(
      'Discard this draft?',
      'The form goes back to what is saved. The draft cannot be recovered.',
      [
        { text: 'Keep draft', style: 'cancel' },
        {
          text: 'Discard',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            void clearDraft(userId, game.id).then(() =>
              queryClient.invalidateQueries({ queryKey: ['log-draft', userId, game.id] })
            );
          },
        },
      ]
    );
  }

  /* Words, not characters. "38,412 characters" tells a writer nothing about the
     length of what they have written; every writer counts in words. */
  const wordCount = review.trim() ? review.trim().split(/\s+/).length : 0;
  const titleLeft = REVIEW_TITLE_MAX - reviewTitle.length;
  const bodyLeft = REVIEW_BODY_MAX - review.length;

  /* The button names the work. Arriving from "Write a review" and leaving via
     "Log game" made the app rename the task between entering and exiting. */
  const saveLabel = writingReview
    ? existing
      ? 'Save review'
      : 'Publish review'
    : existing
      ? 'Save changes'
      : 'Log game';

  return (
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen
      edges={['bottom']}
      padded
      insetHeader
      modal
      topBar={<FrostedTopBar dismiss onBack={confirmDismiss} />}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 80 : 0}>
        {/* `flex: 1` is load-bearing now that the footer is a sibling: without it
            the scroll view sizes to its content and pushes the button off the
            bottom of the screen instead of scrolling underneath it. */}
        <ScrollView
          style={styles.flex}
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.gameHead}>
            <GameCaseDisplay
              coverUrl={game.coverUrl}
              heroUrl={game.heroUrl}
              title={game.title}
              platforms={game.platforms}
              size="small"
            />
            <View style={styles.gameHeadText}>
              <Text variant="h3" numberOfLines={2}>
                {game.title}
              </Text>
              <Text variant="bodySmall" color="textMuted">
                {[game.releaseYear, game.developer].filter(Boolean).join(' · ')}
              </Text>
            </View>
          </View>

          {/* Restored work is announced, never silently swapped in: a draft that
              quietly overrode a saved review would look like data loss. */}
          {draft && (
            <View style={[styles.draftNote, { borderColor: theme.borderStrong }]}>
              <Ionicons name="document-text-outline" size={16} color={theme.textSecondary} />
              <Text variant="bodySmall" color="textSecondary" style={styles.flex}>
                Picked up where you left off {relativeTime(draft.savedAt)}.
              </Text>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Discard this draft"
                onPress={discardDraft}
                /* 16 + 16 + a 16dp line clears Android's 48. */
                hitSlop={{ top: 16, bottom: 16, left: 10, right: 10 }}
                scaleTo={0.94}>
                <Text variant="bodySmall" color="primaryText">
                  Discard
                </Text>
              </PressableScale>
            </View>
          )}

          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
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
                        backgroundColor: selected ? tint : 'transparent',
                        borderColor: selected ? tint : theme.border,
                      },
                    ]}>
                    {/* Glyph as well as fill: four states told apart by colour
                        alone is exactly the case where a red/green confusion
                        costs someone the answer. */}
                    <Ionicons
                      name={STATUS_ICON[option]}
                      size={13}
                      color={selected ? readableInk(tint) : tint}
                    />
                    <Text
                      variant="bodySmall"
                      style={{ color: selected ? readableInk(tint) : theme.textSecondary }}>
                      {STATUS_LABEL[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
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

            {clearsRating && (
              <Text variant="bodySmall" color="danger">
                Saving now would clear your score of {existing?.rating}. Score a metric, or untick
                advanced metrics to keep it.
              </Text>
            )}
          </View>

          {/* Completion. `platinum` is self-reported for every platform — no
              console publishes a trophy API — but Steam sync can set the 100%. */}
          <View style={styles.section}>
            <Text variant="label" color="textMuted" accessibilityRole="header">
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
                error={hoursError}
              />
            </View>
            <View style={styles.rowItem}>
              {/* Chosen, never typed. This used to be a free `<TextField>`, so a
                  record could claim a platform the game never shipped on — or a
                  word that is not a platform at all — and that string is read
                  back on the case's printed back and in every feed row, where a
                  typo is indistinguishable from a fact. */}
              <SelectField
                label="Played on"
                sheetTitle="Played on"
                value={playedOn}
                options={platformOptions}
                onChange={setPlayedOn}
                placeholder="Not set"
              />
            </View>
          </View>

          {/* Long-form review — all or nothing.
              You can log a game without writing about it, but a *review* is a
              headline and a body together. Half a review has nowhere to render:
              the feed card leads with the headline and previews the body, so a
              body with no headline arrives as an untitled block and a headline
              with no body as a promise of writing that is not there.

              This is the only section announced as a *band* rather than as a
              group inside the form (DESIGN.md § 17). Everything above it is
              metadata about a playthrough; this is the thing the product is
              for, and it was previously introduced by the same grey word in the
              same size as "Completion". */}
          <View style={styles.reviewSection}>
            <Text variant="h2" accessibilityRole="header">
              Review
            </Text>
            <Text variant="bodySmall" color="textMuted">
              {writingReview
                ? 'A review needs both a headline and a body.'
                : 'Optional. The score summarises this — it does not replace it.'}
            </Text>

            <TextField
              value={reviewTitle}
              onChangeText={setReviewTitle}
              accessibilityLabel="Review headline"
              placeholder="Headline"
              maxLength={REVIEW_TITLE_MAX}
              style={styles.reviewTitle}
              hint={titleLeft <= 20 ? `${titleLeft} characters left` : undefined}
              error={writingReview && !reviewTitle.trim() ? 'Your review needs a headline.' : null}
            />

            <TextField
              value={review}
              onChangeText={setReview}
              accessibilityLabel="Review body"
              placeholder="Write as much as you like — this can be a full article."
              multiline
              maxLength={REVIEW_BODY_MAX}
              style={styles.reviewBody}
              hint={
                bodyLeft <= 1000
                  ? `${bodyLeft} characters left`
                  : wordCount > 0
                    ? `${wordCount} ${wordCount === 1 ? 'word' : 'words'}`
                    : undefined
              }
              error={writingReview && !review.trim() ? 'Your review needs a body.' : null}
            />
          </View>

          {existing && (
            <Button
              title="Remove log"
              variant="danger"
              onPress={confirmRemove}
              loading={remove.isPending}
              fullWidth
            />
          )}
        </ScrollView>

        {/*
          The primary action, pinned.

          It used to sit at the end of the scroll, which put it roughly 1400dp
          from the top with advanced metrics open — so the ten-second status
          change cost a full-screen scroll, and the only permanently reachable
          control was the one that discards. A shelf rather than a floating
          button: the form runs under it and the hairline is where it stops.
        */}
        {/* `borderStrong`, not `border`. The 5% hairline is for an edge inside a
            surface, where the surface step is already doing the separating; this
            rule sits on the page itself and at 5% it measured 1.12:1 — invisible,
            which left the form's last line dissolving at an arbitrary height. */}
        <View
          style={[
            styles.footer,
            { backgroundColor: theme.background, borderTopColor: theme.borderStrong },
          ]}>
          {mutationError && (
            <Text variant="bodySmall" color="danger">
              {mutationError instanceof Error ? mutationError.message : 'Could not save.'}
            </Text>
          )}

          <Button
            title={saveLabel}
            onPress={() => save.mutate()}
            loading={save.isPending}
            disabled={!!blocked}
            fullWidth
          />
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const REVIEW_TITLE_MAX = 140;
const REVIEW_BODY_MAX = 40000;

/** "a moment ago" / "2 hours ago" / "on 4 Aug" — enough to judge whose draft it is. */
function relativeTime(epochMs: number): string {
  const minutes = Math.round((Date.now() - epochMs) / 60_000);
  if (minutes < 2) return 'a moment ago';
  if (minutes < 60) return `${minutes} minutes ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;

  return `on ${new Date(epochMs).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`;
}

/**
 * The form's shape, before its data arrives.
 *
 * A spinner said "something is happening"; this says "a case, a title, four
 * pills and a score are coming", which is the whole argument for a skeleton
 * (DESIGN.md § 22). Static rather than shimmering on purpose — on a near-black
 * page a pulsing grey block draws more attention than the content it stands in
 * for.
 */
function LogFormSkeleton() {
  const theme = useTheme();
  const block = (width: number | `${number}%`, height: number, radius: number = Radius.control) => (
    <View style={{ width, height, borderRadius: radius, backgroundColor: theme.skeleton }} />
  );

  return (
    <View style={styles.content} accessibilityRole="progressbar" accessibilityLabel="Loading">
      <View style={styles.gameHead}>
        {block(108, 144, Radius.image)}
        <View style={styles.gameHeadText}>
          {block('80%', 18)}
          {block('50%', 12)}
        </View>
      </View>

      <View style={styles.section}>
        {block(52, 10)}
        <View style={styles.statuses}>
          {block(88, TapTarget, Radius.control)}
          {block(88, TapTarget, Radius.control)}
          {block(88, TapTarget, Radius.control)}
        </View>
      </View>

      <View style={styles.section}>
        {block(48, 10)}
        {block('100%', 44)}
        {block('100%', TapTarget, Radius.pill)}
      </View>

      <View style={styles.section}>
        {block(80, 10)}
        {block('100%', 40)}
      </View>
    </View>
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
          backgroundColor: value ? withAlpha(tint, 0.13) : 'transparent',
          borderColor: value ? tint : theme.border,
          opacity: disabled ? 0.6 : 1,
        },
      ]}>
      <Ionicons name={icon} size={18} color={value ? tint : theme.textMuted} />
      <Text variant="bodySmall" style={{ color: value ? tint : theme.textSecondary }}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  /* `x64` at the foot per DESIGN.md § 25. The pinned footer is a sibling of the
     scroll rather than part of it, so this is clearance for the last control,
     not for the button. */
  content: { gap: Spacing.x24, paddingTop: Spacing.x24, paddingBottom: Spacing.x64 },
  gameHead: { flexDirection: 'row', gap: Spacing.x16, alignItems: 'center' },
  gameHeadText: { flex: 1, gap: Spacing.x4 },
  draftNote: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  section: { gap: Spacing.x8 },
  /* Wider than `section`: an `h2` band heading needs the air a 10px group label
     does not, and the two fields under it are the tallest block on the screen. */
  reviewSection: { gap: Spacing.x12 },
  // A little air between the bar and the tick box so they read as two choices
  // rather than one control with a stray checkbox attached.
  metrics: { marginTop: Spacing.x8 },
  statuses: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x4 + 2,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    /* The pill stayed visually compact and grew to the floor — four 28dp
       targets 6dp apart was a row a thumb could not resolve. */
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  reviewTitle: { ...Type.h3 },
  // Tall by default: a short box invites a short review.
  reviewBody: { minHeight: 260 },
  toggles: { flexDirection: 'row', gap: Spacing.x8, flexWrap: 'wrap' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.x8,
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x16,
    minHeight: TapTarget,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  row: { flexDirection: 'row', gap: Spacing.x12 },
  rowItem: { flex: 1 },
  /* Bled back out to the display edge: `<Screen padded>` insets its children by
     `x16`, and a rule that stops 12dp short of both edges reads as a stray line
     rather than as the top of a shelf. */
  footer: {
    gap: Spacing.x8,
    paddingTop: Spacing.x16,
    paddingBottom: Spacing.x8,
    marginHorizontal: -Spacing.x16,
    paddingHorizontal: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
