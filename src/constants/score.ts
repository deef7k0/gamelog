import type { ThemePalette } from './theme';

/**
 * The 0-100 review score and its verdict labels.
 *
 * Bands are 5 points wide across the top half, where readers care about small
 * differences, and widen toward the bottom, where "bad" is bad. `Mixed` is
 * centred on 50 so the midpoint of the scale reads as genuinely neutral.
 *
 * Bands must stay ordered high → low and cover 0-100 with no gaps; `labelFor`
 * walks them in order and returns the first whose `min` is met.
 */
export type ScoreBand = {
  min: number;
  label: string;
  /** Broad sentiment, used for colour and for grouping in the UI. */
  tone: 'positive' | 'neutral' | 'negative';
};

export const SCORE_BANDS: readonly ScoreBand[] = [
  { min: 100, label: 'Masterpiece', tone: 'positive' },
  { min: 95, label: 'Outstanding', tone: 'positive' },
  { min: 90, label: 'Excellent', tone: 'positive' },
  { min: 85, label: 'Great', tone: 'positive' },
  { min: 80, label: 'Very Good', tone: 'positive' },
  { min: 75, label: 'Good', tone: 'positive' },
  { min: 70, label: 'Solid', tone: 'positive' },
  { min: 65, label: 'Decent', tone: 'neutral' },
  { min: 60, label: 'Fair', tone: 'neutral' },
  { min: 55, label: 'Passable', tone: 'neutral' },
  { min: 45, label: 'Mixed', tone: 'neutral' },
  { min: 35, label: 'Weak', tone: 'negative' },
  { min: 25, label: 'Bad', tone: 'negative' },
  { min: 15, label: 'Terrible', tone: 'negative' },
  { min: 0, label: 'Awful', tone: 'negative' },
];

export const MIN_SCORE = 0;
export const MAX_SCORE = 100;

export function bandFor(score: number): ScoreBand {
  const clamped = clampScore(score);
  // Bands are ordered high → low, so the first match is the tightest one.
  return SCORE_BANDS.find((band) => clamped >= band.min) ?? SCORE_BANDS[SCORE_BANDS.length - 1];
}

/** "Excellent" for 92, "Mixed" for 50. */
export function labelFor(score: number): string {
  return bandFor(score).label;
}

export function clampScore(score: number): number {
  if (!Number.isFinite(score)) return MIN_SCORE;
  return Math.max(MIN_SCORE, Math.min(MAX_SCORE, Math.round(score)));
}

/**
 * Colour for a score.
 *
 * Deliberately a three-stop ramp rather than a per-band palette: fifteen
 * distinct colours would be noise, and the tone is what readers actually parse
 * at a glance.
 */
export function scoreColor(score: number, theme: ThemePalette): string {
  switch (bandFor(score).tone) {
    case 'positive':
      return theme.success;
    case 'neutral':
      return theme.accent;
    case 'negative':
      return theme.danger;
  }
}
