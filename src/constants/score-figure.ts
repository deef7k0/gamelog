import { clampScore } from './score';

/**
 * Whether the drawings are shown at all. **Off, for now** — the owner
 * (2026-10-16): "remove the ratings drawing for now. Don't remove it from the
 * code or app, just don't show it. I will replace the images later."
 *
 * Everything stays: the five drawings, the arithmetic below, `<ScoreFigure>`.
 * With this off, `<FiguredScore>` is its number alone, `<ScoreMeter>` is its
 * readout and bar, and `<ScoreSummary>`'s placeholder is the number's size —
 * so no gap is left where a drawing was. Set it back to `true` when the new
 * images are in `assets/images/scores/`.
 */
export const SHOW_SCORE_FIGURES = false;

/**
 * Which drawing stands for a score.
 *
 * A 0–100 score is also shown as one of five drawings of a little man and his
 * gaming chair — the owner's brief (2026-10-12), after the little man a
 * newspaper rates films with. Each drawing is anchored on one score:
 *
 * ```text
 *     0   gone       the chair, empty: he has left
 *    50   asleep     slumped in it, asleep
 *    70   seated     sitting up, playing
 *    80   forward    on the edge of the seat, leaning in
 *   100   standing   on his feet
 * ```
 *
 * The drawings are made by `scripts/score-figures.mjs` and drawn by
 * `<ScoreFigure>`. This is only the arithmetic between them, and it is pure.
 */
export type ScoreFigureKey = 'gone' | 'asleep' | 'seated' | 'forward' | 'standing';

export type ScoreFigureBand = {
  key: ScoreFigureKey;
  /** The score the owner named this drawing for. */
  anchor: number;
  /** The lowest score that shows it. */
  min: number;
  /** What it shows, for the one place a sentence is wanted. */
  shows: string;
};

/**
 * The five, ordered high → low, as `SCORE_BANDS` is.
 *
 * **A score shows the drawing whose anchor it is nearest to.** The owner named
 * five scores, not five ranges, and "nearest" is the reading that needs no
 * further ruling: the boundaries are the midpoints — 25, 60, 75, 90.
 *
 * They are also, all four, boundaries the verdict words already have ("Bad"
 * from 25, "Fair" from 60, "Good" from 75, "Excellent" from 90), so the
 * drawing never changes between two scores that share a word. That was not
 * arranged; the test holds it so that moving either scale says so.
 */
export const SCORE_FIGURES: readonly ScoreFigureBand[] = [
  { key: 'standing', anchor: 100, min: 90, shows: 'On his feet' },
  { key: 'forward', anchor: 80, min: 75, shows: 'On the edge of his seat' },
  { key: 'seated', anchor: 70, min: 60, shows: 'Sitting up' },
  { key: 'asleep', anchor: 50, min: 25, shows: 'Asleep in his chair' },
  { key: 'gone', anchor: 0, min: 0, shows: 'Gone — the chair is empty' },
];

/** The drawing for a score: `forward` for 82, `asleep` for 50. */
export function figureFor(score: number): ScoreFigureKey {
  const clamped = clampScore(score);
  const band = SCORE_FIGURES.find((figure) => clamped >= figure.min);
  return (band ?? SCORE_FIGURES[SCORE_FIGURES.length - 1]).key;
}

/**
 * Whether a drawing has a man in it. The empty chair is one layer; every other
 * is two — see `<ScoreFigure>`.
 */
export function figureHasMan(key: ScoreFigureKey): boolean {
  return key !== 'gone';
}
