import type { ReviewMetricKey, ReviewMetrics } from '@/lib/database.types';

/**
 * Advanced review metrics.
 *
 * A reviewer can opt out of picking a single number and instead score whichever
 * of these categories they actually have an opinion on. The overall score is
 * then the mean of the ones they filled in — which is why the vocabulary is
 * closed and the order is fixed: a metric that means something slightly
 * different from one review to the next would make the averages incomparable.
 *
 * Only activated metrics are stored. A reviewer who scores four categories is
 * making a narrower claim than one who scores all fourteen, and flattening that
 * by defaulting the rest to 50 would invent opinions they never expressed.
 */

export type ReviewMetric = {
  key: ReviewMetricKey;
  label: string;
};

/**
 * Presentation order, which is also storage order. Kept exactly as specified:
 * broad impressions first, then design, then presentation.
 */
export const REVIEW_METRICS: readonly ReviewMetric[] = [
  { key: 'personal-enjoyment', label: 'Personal Enjoyment' },
  { key: 'genre-execution', label: 'Genre Execution' },
  { key: 'innovation', label: 'Innovation' },
  { key: 'gameplay', label: 'Gameplay' },
  { key: 'content', label: 'Content' },
  { key: 'replayability', label: 'Replayability' },
  { key: 'narrative', label: 'Narrative' },
  { key: 'difficulty', label: 'Difficulty' },
  { key: 'art-direction', label: 'Art Direction' },
  { key: 'cinematography', label: 'Cinematography' },
  { key: 'soundtrack', label: 'Soundtrack' },
  { key: 'level-design', label: 'Level Design' },
  { key: 'audio-design', label: 'Audio Design' },
  { key: 'voice-acting', label: 'Voice Acting / Acting' },
];

export const REVIEW_METRIC_KEYS: readonly ReviewMetricKey[] = REVIEW_METRICS.map(
  (metric) => metric.key
);

const LABELS = new Map<string, string>(REVIEW_METRICS.map((m) => [m.key, m.label]));

export type { ReviewMetricKey, ReviewMetrics };

export function isReviewMetricKey(key: string): key is ReviewMetricKey {
  return LABELS.has(key);
}

/** "Art Direction" for `art-direction`. Falls back to the raw key. */
export function metricLabel(key: string): string {
  return LABELS.get(key) ?? key;
}

/**
 * The overall score: the mean of every activated metric, or null when none are.
 *
 * A plain unweighted mean is deliberate. Weighting Gameplay above Soundtrack
 * would bake one theory of what matters in a game into everyone's reviews, and
 * the reviewer already expresses that by choosing which metrics to score.
 */
export function averageMetrics(metrics: ReviewMetrics): number | null {
  const scores = Object.values(metrics).filter((score): score is number => Number.isFinite(score));
  if (scores.length === 0) return null;

  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round(total / scores.length);
}

/** How many metrics the reviewer actually scored. */
export function countMetrics(metrics: ReviewMetrics): number {
  return Object.values(metrics).filter((score) => Number.isFinite(score)).length;
}

/**
 * Read metrics back out of jsonb.
 *
 * The column has a CHECK that enforces this shape, so this is belt and braces —
 * but jsonb is structurally `unknown` at the type level and rows written before
 * the constraint existed would not be caught by it.
 */
export function parseReviewMetrics(value: unknown): ReviewMetrics | null {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return null;

  const parsed: ReviewMetrics = {};
  for (const [key, score] of Object.entries(value as Record<string, unknown>)) {
    if (!isReviewMetricKey(key)) continue;
    if (typeof score !== 'number' || !Number.isFinite(score)) continue;
    parsed[key] = Math.round(Math.max(0, Math.min(100, score)));
  }

  return Object.keys(parsed).length > 0 ? parsed : null;
}

/** Metrics in presentation order, skipping the ones left blank. */
export function orderedMetrics(metrics: ReviewMetrics): { metric: ReviewMetric; score: number }[] {
  return REVIEW_METRICS.flatMap((metric) => {
    const score = metrics[metric.key];
    return score === undefined ? [] : [{ metric, score }];
  });
}
