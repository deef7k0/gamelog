import type { SimilarityReason, SimilarityReportReason } from '@/lib/database.types';

/**
 * Why two games are alike — the words for the keys 0025 stores.
 *
 * A fixed vocabulary rather than free text, because the point is to *count*
 * them: "32 players say the combat, 20 the progression" is only possible when
 * everyone picks from the same twelve. The free text is the one-line comment
 * beside them. This list and the CHECK on `game_similarity_votes` must match.
 */
export const SIMILARITY_REASONS: readonly SimilarityReason[] = [
  'combat',
  'progression',
  'exploration',
  'mechanics',
  'structure',
  'story',
  'characters',
  'atmosphere',
  'tone',
  'difficulty',
  'multiplayer',
  'genre',
];

export const SIMILARITY_REASON_LABEL: Record<SimilarityReason, string> = {
  combat: 'Combat',
  progression: 'Progression',
  exploration: 'Exploration',
  mechanics: 'Mechanics',
  structure: 'Structure',
  story: 'Story',
  characters: 'Characters',
  atmosphere: 'Atmosphere',
  tone: 'Tone',
  difficulty: 'Difficulty',
  multiplayer: 'Multiplayer',
  genre: 'Genre',
};

/** The most a vote can give — the database enforces the same four. */
export const MAX_SIMILARITY_REASONS = 4;

export const REPORT_REASON_LABEL: Record<SimilarityReportReason, string> = {
  incorrect: 'These games aren’t alike',
  spam: 'Spam',
  inappropriate: 'Inappropriate',
};

/**
 * The reasons for a pick, most-given first, as one line: "Combat · Progression".
 *
 * Three at most. A row carrying every reason anybody ticked would say that the
 * two games are alike in every way, which is the one thing a list of reasons
 * exists to avoid saying.
 */
export function topReasons(
  reasons: Partial<Record<SimilarityReason, number>>,
  limit = 3
): SimilarityReason[] {
  return (Object.entries(reasons) as [SimilarityReason, number][])
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([reason]) => reason);
}
