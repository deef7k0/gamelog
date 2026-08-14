import Ionicons from '@expo/vector-icons/Ionicons';
import { useRef } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, clampScore, scoreColor } from '@/constants/score';
import {
  REVIEW_METRICS,
  countMetrics,
  orderedMetrics,
  type ReviewMetricKey,
  type ReviewMetrics,
} from '@/constants/review-metrics';
import { FontFamily, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

/**
 * Advanced review metrics — the editor and its read-only counterpart.
 *
 * The editor holds *text*, not numbers, because a partially typed score is a
 * legitimate intermediate state ("8" on the way to "85") that a numeric model
 * cannot represent. `metricsFromDraft` is the single point where text becomes
 * scores, so the parsing rule lives in exactly one place.
 */

/** What the inputs hold while the user is typing. */
export type ReviewMetricsDraft = Partial<Record<ReviewMetricKey, string>>;

export function draftFromMetrics(metrics: ReviewMetrics | null): ReviewMetricsDraft {
  if (!metrics) return {};
  const draft: ReviewMetricsDraft = {};
  for (const [key, score] of Object.entries(metrics)) {
    if (score !== undefined) draft[key as ReviewMetricKey] = String(score);
  }
  return draft;
}

/** Text → scores. A blank or unparseable box is simply not an activated metric. */
export function metricsFromDraft(draft: ReviewMetricsDraft): ReviewMetrics {
  const metrics: ReviewMetrics = {};
  for (const [key, text] of Object.entries(draft)) {
    if (!text) continue;
    const score = Number(text);
    if (!Number.isFinite(score)) continue;
    metrics[key as ReviewMetricKey] = clampScore(score);
  }
  return metrics;
}

/**
 * Keep the box in a state that is always a valid score-in-progress: digits only,
 * never above 100. Clamping as they type beats validating on save, because the
 * running average updates on every keystroke and a transient 250 would make it
 * lurch.
 */
function sanitise(text: string): string | undefined {
  const digits = text.replace(/[^0-9]/g, '').slice(0, 3);
  if (digits === '') return undefined;
  return String(Math.min(MAX_SCORE, Number(digits)));
}

export type ReviewMetricsEditorProps = {
  enabled: boolean;
  onToggleEnabled: (enabled: boolean) => void;
  draft: ReviewMetricsDraft;
  onChangeDraft: (draft: ReviewMetricsDraft) => void;
};

export function ReviewMetricsEditor({
  enabled,
  onToggleEnabled,
  draft,
  onChangeDraft,
}: ReviewMetricsEditorProps) {
  const theme = useTheme();
  const scored = countMetrics(metricsFromDraft(draft));

  function setMetric(key: ReviewMetricKey, text: string) {
    const value = sanitise(text);
    const next = { ...draft };
    if (value === undefined) {
      delete next[key];
    } else {
      next[key] = value;
    }
    onChangeDraft(next);
  }

  return (
    <View style={styles.editor}>
      <Pressable
        accessibilityRole="checkbox"
        accessibilityState={{ checked: enabled }}
        accessibilityLabel="Advanced review metrics"
        onPress={() => onToggleEnabled(!enabled)}
        style={styles.tickRow}>
        <View
          style={[
            styles.tick,
            {
              backgroundColor: enabled ? theme.primary : 'transparent',
              borderColor: enabled ? theme.primary : theme.borderStrong,
            },
          ]}>
          {enabled && <Ionicons name="checkmark" size={15} color={theme.onPrimary} />}
        </View>

        <View style={styles.tickText}>
          <Text variant="body">Advanced review metrics</Text>
          <Text variant="caption" color="textMuted">
            Score categories instead of the bar. The overall score becomes their average.
          </Text>
        </View>
      </Pressable>

      {enabled && (
        <View style={[styles.panel, { borderTopColor: theme.border }]}>
          <View style={styles.panelHead}>
            <Text variant="caption" color="textMuted" style={styles.panelHint}>
              Score each out of 100 — how well the game does it, not how much of it there is. Leave
              a box blank to exclude it.
            </Text>

            {scored > 0 && (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear all metrics"
                onPress={() => onChangeDraft({})}
                scaleTo={0.94}>
                <Text variant="caption" color="primaryText">
                  Clear all
                </Text>
              </PressableScale>
            )}
          </View>

          <View>
            {REVIEW_METRICS.map((metric, index) => (
              <MetricRow
                key={metric.key}
                label={metric.label}
                value={draft[metric.key] ?? ''}
                onChangeText={(text) => setMetric(metric.key, text)}
                divider={index < REVIEW_METRICS.length - 1}
              />
            ))}
          </View>

          <Text variant="caption" color="textMuted">
            {scored === 0
              ? 'No metrics scored yet — the review has no score.'
              : `Averaging ${scored} of ${REVIEW_METRICS.length} metrics.`}
          </Text>
        </View>
      )}
    </View>
  );
}

function MetricRow({
  label,
  value,
  onChangeText,
  divider,
}: {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  divider: boolean;
}) {
  const theme = useTheme();
  const input = useRef<TextInput>(null);

  const filled = value !== '';
  const tint = filled ? scoreColor(Number(value), theme) : theme.textMuted;

  return (
    // Tapping the label focuses the box, so the whole row is the target rather
    // than a 62pt box the user has to hit precisely.
    <Pressable
      accessibilityRole="none"
      onPress={() => input.current?.focus()}
      style={[
        styles.row,
        divider && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.border },
      ]}>
      <Text variant="body" style={styles.rowLabel} numberOfLines={1}>
        {label}
      </Text>

      <TextInput
        ref={input}
        value={value}
        onChangeText={onChangeText}
        keyboardType="number-pad"
        returnKeyType="done"
        maxLength={3}
        placeholder="—"
        placeholderTextColor={theme.textMuted}
        selectTextOnFocus
        accessibilityLabel={`${label} score out of 100`}
        style={[
          styles.box,
          {
            backgroundColor: filled ? withAlpha(tint, 0.1) : theme.background,
            borderColor: filled ? tint : theme.border,
            color: tint,
          },
        ]}
      />
    </Pressable>
  );
}

/**
 * The scorecard as readers see it, on the review page.
 *
 * Bars are proportional to the score so the shape of an opinion is legible at a
 * glance — where a reviewer was generous and where they were not.
 */
export function ReviewMetricsBreakdown({ metrics }: { metrics: ReviewMetrics }) {
  const theme = useTheme();
  const rows = orderedMetrics(metrics);
  if (rows.length === 0) return null;

  return (
    <View style={[styles.breakdown, { borderTopColor: theme.border }]}>
      <Text variant="caption" color="textMuted">
        SCORE BREAKDOWN · {rows.length} {rows.length === 1 ? 'METRIC' : 'METRICS'}
      </Text>

      <View style={styles.breakdownRows}>
        {rows.map(({ metric, score }) => {
          const tint = scoreColor(score, theme);
          return (
            <View key={metric.key} style={styles.breakdownRow}>
              <Text variant="bodySmall" style={styles.breakdownLabel} numberOfLines={1}>
                {metric.label}
              </Text>

              <View style={[styles.breakdownTrack, { backgroundColor: theme.surfaceElevated }]}>
                <View
                  style={[styles.breakdownFill, { width: `${score}%`, backgroundColor: tint }]}
                />
              </View>

              <Text variant="h5" style={[styles.breakdownScore, { color: tint }]}>
                {score}
              </Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  editor: { gap: Spacing.x12 },
  tickRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  tick: {
    width: 22,
    height: 22,
    borderRadius: Radius.control,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
  },
  tickText: { flex: 1, gap: Spacing.x4 },

  panel: { paddingTop: Spacing.x16, gap: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth },
  panelHead: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  panelHint: { flex: 1 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x8,
  },
  rowLabel: { flex: 1 },
  box: {
    width: 62,
    height: 42,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    textAlign: 'center',
    fontSize: 17,
    fontFamily: FontFamily.semibold,
    // Android centres text differently in a fixed-height input.
    paddingVertical: 0,
  },

  breakdown: {
    marginHorizontal: Spacing.x16,
    marginTop: Spacing.x16,
    paddingTop: Spacing.x16,
    gap: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  breakdownRows: { gap: Spacing.x8 },
  breakdownRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  breakdownLabel: { width: 132 },
  breakdownTrack: { flex: 1, height: 6, borderRadius: Radius.pill, overflow: 'hidden' },
  breakdownFill: { height: '100%', borderRadius: Radius.pill },
  breakdownScore: { width: 30, textAlign: 'right' },
});
