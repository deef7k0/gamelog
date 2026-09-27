import type {
  CommunitySimilarGame,
  SimilarityReason,
  SimilarityReportReason,
} from '@/lib/database.types';

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

/**
 * Who stands behind a pick, in one sentence: "3 users suggested this game, with
 * 12 users agreeing." Suggesting (saying why) and agreeing (tapping Agree) are
 * counted apart and never overlap (0030).
 *
 * **Null when the counts are unknown** — the database predates 0030 — so the
 * caller falls back to a line it can stand behind (`agreementLine`) rather than
 * printing a number it does not have. Reading them as numbers regardless is what
 * crashed the community sheet on a database one migration behind.
 */
export function supportLine(
  pick: Pick<CommunitySimilarGame, 'suggesters' | 'agreers'>
): string | null {
  const { suggesters, agreers } = pick;
  if (typeof suggesters !== 'number' || typeof agreers !== 'number') return null;
  const people = (n: number) => `${n.toLocaleString()} ${n === 1 ? 'user' : 'users'}`;
  const agreeing = agreers > 0 ? `${people(agreers)} agreeing` : 'no one else agreeing yet';
  return `${people(suggesters)} suggested this game, with ${agreeing}.`;
}

/**
 * How much of the community agrees with a pick, in words: "12 of 15 agree".
 *
 * Downvotes were once left off the list entirely, on the argument that a visible
 * "−3" invites a pile-on. A list you can sort from worst rated up has to say what
 * "worst" means, so the disagreement is shown — as a share of the people who
 * weighed in, never as a negative number.
 */
export function agreementLine(pick: Pick<CommunitySimilarGame, 'up' | 'votes'>): string {
  if (pick.votes <= 1) return 'Only its suggester so far';
  return `${pick.up} of ${pick.votes} agree`;
}
