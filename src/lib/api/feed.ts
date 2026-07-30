import type { CachedGame, GameLog, Profile } from '../database.types';
import { supabase } from '../supabase';
import type { FeedItem, PostWithRelations } from './types';

const POST_WITH_RELATIONS = '*, profile:profiles(*), game:games(*), media:post_media(*)';
const LOG_WITH_RELATIONS = '*, game:games(*), profile:profiles(*)';

type LogRow = GameLog & { game: CachedGame | null; profile: Profile | null };

/**
 * The home feed is a union of two record types, so it cannot be one query.
 *
 * Posts and logs are fetched separately, wrapped in a discriminated union and
 * merged newest-first. Each side is capped, so the merged list is at most
 * 2 x LIMIT before slicing — fine at this scale, but this is the piece that
 * would become a Postgres function (or a materialised `feed_items` view) if the
 * app ever needed real pagination.
 */
const LIMIT = 40;

async function fetchPosts(authorIds: string[] | null): Promise<PostWithRelations[]> {
  let query = supabase
    .from('posts')
    .select(POST_WITH_RELATIONS)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (authorIds) query = query.in('user_id', authorIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  const posts = (data ?? []) as PostWithRelations[];
  for (const post of posts) post.media?.sort((a, b) => a.position - b.position);
  return posts;
}

async function fetchLogs(authorIds: string[] | null): Promise<LogRow[]> {
  let query = supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .order('created_at', { ascending: false })
    .limit(LIMIT);

  if (authorIds) query = query.in('user_id', authorIds);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as LogRow[];
}

function merge(posts: PostWithRelations[], logs: LogRow[]): FeedItem[] {
  const items: FeedItem[] = [
    ...posts.map((post): FeedItem => ({
      type: 'post',
      id: `post:${post.id}`,
      createdAt: post.created_at,
      post,
    })),
    ...logs.map((log): FeedItem => ({
      type: 'log',
      id: `log:${log.id}`,
      createdAt: log.created_at,
      log,
    })),
  ];

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, LIMIT);
}

/** Posts and logs from everyone the user follows, plus their own. */
export async function getHomeFeed(userId: string): Promise<FeedItem[]> {
  const { data: follows, error } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (error) throw new Error(error.message);

  const authorIds = [userId, ...(follows ?? []).map((row) => row.following_id)];
  const [posts, logs] = await Promise.all([fetchPosts(authorIds), fetchLogs(authorIds)]);
  return merge(posts, logs);
}

/** Everything, from everyone — what a brand-new account sees. */
export async function getDiscoverFeed(): Promise<FeedItem[]> {
  const [posts, logs] = await Promise.all([fetchPosts(null), fetchLogs(null)]);
  return merge(posts, logs);
}
