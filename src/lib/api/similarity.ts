import type {
  CommunitySimilarGame,
  GameSimilarityVoteRow,
  SimilarityReason,
  SimilarityReportQueueRow,
  SimilarityReportReason,
} from '../database.types';
import type { Game } from '../games';
import { supabase } from '../supabase';
import { cacheGame } from './core';

/**
 * Community-curated similar games (0025).
 *
 * The other half of the Similar tab: IGDB's `similar_games` is an algorithm's
 * list with no reasons; this is what the people here say, why, and how many of
 * them agree. The ranking happens in Postgres (`community_similar_games`) so a
 * page receives the dozen picks it shows, already ordered, rather than every vote
 * ever cast.
 */

/** The community's picks for a game, ranked. Empty for most games, and that is fine. */
export async function getCommunitySimilar(gameId: string): Promise<CommunitySimilarGame[]> {
  const { data, error } = await supabase.rpc('community_similar_games', {
    p_game: gameId,
    p_limit: 12,
  });

  if (error) {
    console.warn('[similarity] could not load community picks:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as CommunitySimilarGame[];
}

/**
 * Say two games are alike — or add your reasons to a pair someone already
 * suggested, which is the same call: suggesting *is* upvoting (0025).
 *
 * Both games are cached first, because the pair's foreign keys point at `games`
 * and a page can be open on a game nobody has logged yet.
 */
export async function suggestSimilarGame(
  game: Game,
  other: Game,
  reasons: SimilarityReason[],
  comment: string | null
): Promise<string> {
  await cacheGame(game);
  await cacheGame(other);

  const { data, error } = await supabase.rpc('suggest_similar_game', {
    p_game: game.id,
    p_other: other.id,
    p_reasons: reasons,
    p_comment: comment?.trim() || null,
  });

  if (error) {
    console.warn('[similarity] suggestion rejected:', error.message);
    throw new Error(error.message);
  }
  return data as string;
}

/**
 * The pair two games already form, if anyone has suggested it, with your vote on
 * it. The pair is stored in canonical order (`game_a < game_b`, 0025), so the
 * lookup orders the two ids the same way.
 */
export async function getPairWithMyVote(
  userId: string,
  gameId: string,
  otherId: string
): Promise<{ similarityId: string; vote: GameSimilarityVoteRow | null } | null> {
  const [a, b] = gameId < otherId ? [gameId, otherId] : [otherId, gameId];
  const { data, error } = await supabase
    .from('game_similarities')
    .select('id')
    .eq('game_a', a)
    .eq('game_b', b)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;
  return { similarityId: data.id, vote: await getMySimilarityVote(userId, data.id) };
}

/** Your vote on a pair, if you have cast one — to fill the form back in. */
export async function getMySimilarityVote(
  userId: string,
  similarityId: string
): Promise<GameSimilarityVoteRow | null> {
  const { data, error } = await supabase
    .from('game_similarity_votes')
    .select('*')
    .eq('similarity_id', similarityId)
    .eq('user_id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Up or down on an existing pair. Keeps any reasons and comment you gave before:
 * the upsert names only `value`, so the rest of your vote is left as it was.
 */
export async function castSimilarityVote(
  userId: string,
  similarityId: string,
  value: -1 | 1
): Promise<void> {
  const { error } = await supabase
    .from('game_similarity_votes')
    .upsert(
      { similarity_id: similarityId, user_id: userId, value },
      { onConflict: 'similarity_id,user_id' }
    );

  if (error) throw new Error(error.message);
}

export async function removeSimilarityVote(userId: string, similarityId: string): Promise<void> {
  const { error } = await supabase
    .from('game_similarity_votes')
    .delete()
    .eq('similarity_id', similarityId)
    .eq('user_id', userId);

  if (error) throw new Error(error.message);
}

/**
 * Report a pair. Private — only you and the moderators see it — and three
 * different people's reports take the pair down until a moderator looks.
 * Reporting twice is a no-op rather than an error: you have already said so.
 */
export async function reportSimilarity(
  userId: string,
  similarityId: string,
  reason: SimilarityReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('game_similarity_reports')
    .upsert(
      { similarity_id: similarityId, user_id: userId, reason, note: note?.trim() || null },
      { onConflict: 'similarity_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    console.warn('[similarity] report failed:', error.message);
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export async function getSimilarityReports(): Promise<SimilarityReportQueueRow[]> {
  const { data, error } = await supabase.rpc('similarity_reports_queue');
  if (error) {
    console.warn('[moderation] could not load reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as SimilarityReportQueueRow[];
}

export async function moderateSimilarity(
  similarityId: string,
  action: 'hide' | 'restore'
): Promise<void> {
  const { error } = await supabase.rpc('moderate_similarity', {
    p_id: similarityId,
    p_action: action,
  });

  if (error) {
    console.warn(`[moderation] ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}
