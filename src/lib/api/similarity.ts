import type {
  CommunitySimilarGame,
  GameSimilarityVoteRow,
  SimilarityReason,
  SimilarityReportQueueRow,
  SimilarityReportReason,
  SimilaritySort,
  SimilaritySuggestion,
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

/** Said once per session, not once per row or per render. */
let warnedBehind0030 = false;

/**
 * Rows from `community_similar_games`, with 0030's columns made explicit.
 *
 * Migrations are applied by hand, so the app can be a migration ahead of the
 * database it talks to. A function from before 0030 returns rows without the
 * suggester and agreer counts or the top suggestion; left `undefined`, those
 * reached `toLocaleString()` in the sheet and took the app down. They become
 * `null` here — which the type allows, and every reader handles — and the screen
 * shows what the older function does provide.
 */
function withSuggestionFields(rows: CommunitySimilarGame[]): CommunitySimilarGame[] {
  if (!warnedBehind0030 && rows.length > 0 && !('suggesters' in rows[0])) {
    warnedBehind0030 = true;
    console.warn(
      '[similarity] community_similar_games predates migration 0030 — run it for suggester counts and the top suggestion.'
    );
  }
  return rows.map((row) => ({
    ...row,
    suggesters: row.suggesters ?? null,
    agreers: row.agreers ?? null,
    top_author_id: row.top_author_id ?? null,
    top_author: row.top_author ?? null,
    top_author_avatar: row.top_author_avatar ?? null,
    top_comment: row.top_comment ?? null,
    top_reasons: row.top_reasons ?? null,
  }));
}

/**
 * The community's picks for a game, ordered in Postgres (0029): best rated,
 * lowest rated, most votes, newest, or only the ones nobody but their suggester
 * has weighed in on yet. Empty for most games, and that is fine.
 */
export async function getCommunitySimilar(
  gameId: string,
  { sort = 'top', limit = 50 }: { sort?: SimilaritySort; limit?: number } = {}
): Promise<CommunitySimilarGame[]> {
  const { data, error } = await supabase.rpc('community_similar_games', {
    p_game: gameId,
    p_limit: limit,
    p_sort: sort,
  });

  if (error) {
    console.warn('[similarity] could not load community picks:', error.message);
    throw new Error(error.message);
  }
  return withSuggestionFields((data ?? []) as CommunitySimilarGame[]);
}

/**
 * One pick, seen from `gameId` — the head of its suggestions screen. Null when
 * the pair is gone: withdrawn by everyone who voted for it, or hidden by reports.
 */
export async function getSimilarPair(
  gameId: string,
  similarityId: string
): Promise<CommunitySimilarGame | null> {
  const { data, error } = await supabase.rpc('community_similar_games', {
    p_game: gameId,
    p_limit: 1,
    p_pair: similarityId,
  });

  if (error) throw new Error(error.message);
  return withSuggestionFields((data ?? []) as CommunitySimilarGame[])[0] ?? null;
}

/** Everyone's reasons for one pair, with their upvotes (0029). */
export async function getSimilaritySuggestions(
  similarityId: string
): Promise<SimilaritySuggestion[]> {
  const { data, error } = await supabase.rpc('similarity_suggestions', {
    p_similarity: similarityId,
  });

  if (error) throw new Error(error.message);
  return (data ?? []) as SimilaritySuggestion[];
}

/**
 * Upvote someone's suggestion, or take the upvote back. Upvoting your own is
 * refused by the database — it would be a vote for yourself.
 */
export async function setSuggestionUpvote(
  userId: string,
  similarityId: string,
  authorId: string,
  upvoted: boolean
): Promise<void> {
  const { error } = upvoted
    ? await supabase
        .from('game_similarity_upvotes')
        .upsert(
          { similarity_id: similarityId, author_id: authorId, user_id: userId },
          { onConflict: 'similarity_id,author_id,user_id', ignoreDuplicates: true }
        )
    : await supabase
        .from('game_similarity_upvotes')
        .delete()
        .eq('similarity_id', similarityId)
        .eq('author_id', authorId)
        .eq('user_id', userId);

  if (error) throw new Error(error.message);
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
