import type { GameList, ListSummary } from './types';
import type { LogWithRelations, Profile } from '../database.types';
import { supabase } from '../supabase';

/**
 * The Reviews / Collections / People tabs.
 *
 * Every function here is two round trips on purpose. The 0013 functions answer
 * only "which ids, in what order, with what number" — PostgREST cannot order a
 * resource by an aggregate over an embedded one, so the ranking has to happen
 * in SQL — and then the rows themselves come back through the same selects and
 * embeds the rest of the app uses. The alternative was composing
 * `LogWithRelations` inside a SQL function, which is a second definition of
 * what a review is, in a language where nothing would tell us when it drifted.
 *
 * Postgres does not promise to preserve the function's ordering through the
 * follow-up `in (…)` query, so every one of these re-sorts in memory against
 * the rank it asked for. Do not remove those sorts: they look redundant right
 * up until a query plan changes.
 */

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

const LOG_WITH_RELATIONS = '*, game:games(*), profile:profiles(*)';

/** A ranked row plus the number it was ranked by, so the UI can show its reason. */
export type Ranked<T, K extends string> = T & Record<K, number>;

export type PopularReview = Ranked<LogWithRelations, 'likeCount'>;
export type PopularCollection = Ranked<ListSummary, 'likeCount'>;
export type RankedProfile = Profile & {
  /** Whichever number this person was ranked by; the caller knows which. */
  metric: number;
  /** Only set by `getRecommendedPeople` — 0-1 agreement on shared games. */
  affinity?: number;
};

// ---------------------------------------------------------------------------
// Reviews
// ---------------------------------------------------------------------------

export async function getPopularReviews(limit = 20): Promise<PopularReview[]> {
  const ranking = await supabase.rpc('popular_reviews', { p_limit: limit });
  const ranked = unwrap(ranking.data, ranking.error);
  if (ranked.length === 0) return [];

  const likesById = new Map(ranked.map((row) => [row.log_id, Number(row.like_count)]));

  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .in(
      'id',
      ranked.map((row) => row.log_id)
    );

  return unwrap(data as LogWithRelations[] | null, error)
    .map((log) => ({ ...log, likeCount: likesById.get(log.id) ?? 0 }))
    .sort((a, b) => b.likeCount - a.likeCount);
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export async function getPopularCollections(limit = 20): Promise<PopularCollection[]> {
  const ranking = await supabase.rpc('popular_collections', { p_limit: limit });
  const ranked = unwrap(ranking.data, ranking.error);
  if (ranked.length === 0) return [];

  const likesById = new Map(ranked.map((row) => [row.list_id, Number(row.like_count)]));

  const { data, error } = await supabase
    .from('lists')
    .select('*, profile:profiles(*), items:list_items(position, game:games(cover_url, hero_url))')
    .in(
      'id',
      ranked.map((row) => row.list_id)
    );

  type Row = GameList & {
    items: {
      position: number;
      game: { cover_url: string | null; hero_url: string | null } | null;
    }[];
  };

  return unwrap(data as Row[] | null, error)
    .map((row) => ({
      ...row,
      itemCount: row.items?.length ?? 0,
      // Only the first four covers are needed for the collage tile.
      covers: (row.items ?? [])
        .sort((a, b) => a.position - b.position)
        .slice(0, 4)
        .map((item) => item.game)
        .filter((game): game is { cover_url: string | null; hero_url: string | null } => !!game),
      likeCount: likesById.get(row.id) ?? 0,
    }))
    .sort((a, b) => b.likeCount - a.likeCount);
}

// ---------------------------------------------------------------------------
// People
// ---------------------------------------------------------------------------

/** Shared tail: turn `(id, metric)` pairs into profiles in the same order. */
async function profilesFor(
  ranked: { user_id: string; metric: number; affinity?: number }[]
): Promise<RankedProfile[]> {
  if (ranked.length === 0) return [];

  const byId = new Map(ranked.map((row) => [row.user_id, row]));

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .in(
      'id',
      ranked.map((row) => row.user_id)
    );

  return unwrap(data as Profile[] | null, error)
    .map((profile) => ({
      ...profile,
      metric: byId.get(profile.id)?.metric ?? 0,
      affinity: byId.get(profile.id)?.affinity,
    }))
    .sort((a, b) => b.metric - a.metric);
}

/** Most reviews written. Volume. */
export async function getTopReviewers(limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('top_reviewers', { p_limit: limit });
  return profilesFor(
    unwrap(data, error).map((row) => ({ user_id: row.user_id, metric: Number(row.review_count) }))
  );
}

/** Most likes received across reviews and posts. Reception. */
export async function getPopularPeople(limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('popular_users', { p_limit: limit });
  return profilesFor(
    unwrap(data, error).map((row) => ({ user_id: row.user_id, metric: Number(row.like_count) }))
  );
}

/**
 * People with similar taste: the same games logged, scored the same way.
 *
 * Ranked by shared games — the headline number a reader can check — while the
 * SQL orders by overlap × agreement, so somebody who agrees strongly about ten
 * games can outrank somebody who merely played twelve of the same.
 */
export async function getRecommendedPeople(viewerId: string, limit = 20): Promise<RankedProfile[]> {
  const { data, error } = await supabase.rpc('recommended_users', {
    p_viewer: viewerId,
    p_limit: limit,
  });
  return profilesFor(
    unwrap(data, error).map((row) => ({
      user_id: row.user_id,
      metric: Number(row.shared_games),
      affinity: Number(row.affinity),
    }))
  );
}
