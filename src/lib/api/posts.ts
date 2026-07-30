import { MAX_ARTICLE_LENGTH, MAX_POST_LENGTH } from '../../constants/article-tags';
import type { ArticleTag } from '../database.types';
import { supabase } from '../supabase';
import type {
  Comment,
  CommentWithAuthor,
  Engagement,
  PostKind,
  PostWithRelations,
  TargetType,
} from './types';

const POST_WITH_RELATIONS = '*, profile:profiles(*), game:games(*), media:post_media(*)';

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

/** post_media rows come back unordered; the carousel depends on `position`. */
function sortMedia(posts: PostWithRelations[]): PostWithRelations[] {
  for (const post of posts) {
    post.media?.sort((a, b) => a.position - b.position);
  }
  return posts;
}

export type CreatePostInput = {
  body: string;
  kind?: PostKind;
  /** Optional tagged game — must already exist in the `games` cache. */
  gameId?: string | null;
  /** Public URLs, already uploaded to storage. */
  mediaUrls?: string[];
  /** Required when `kind` is 'article'. */
  title?: string | null;
  tags?: ArticleTag[];
  /** Blurs the body in previews until the reader opts in. */
  hasSpoilers?: boolean;
};

export async function createPost(userId: string, input: CreatePostInput): Promise<string> {
  const body = input.body.trim();
  if (!body) throw new Error('Write something first.');

  const kind = input.kind ?? 'post';
  const title = input.title?.trim() || null;

  // Mirrors the CHECK constraints in 0006, so the user gets a readable message
  // instead of a raw Postgres violation.
  if (kind === 'article' && !title) {
    throw new Error('An article needs a headline.');
  }
  const limit = kind === 'article' ? MAX_ARTICLE_LENGTH : MAX_POST_LENGTH;
  if (body.length > limit) {
    throw new Error(
      kind === 'article'
        ? `Articles are limited to ${limit.toLocaleString()} characters.`
        : `Posts are limited to ${limit.toLocaleString()} characters. Try writing an article instead.`
    );
  }

  const { data, error } = await supabase
    .from('posts')
    .insert({
      user_id: userId,
      body,
      kind,
      game_id: input.gameId ?? null,
      title,
      tags: input.tags?.length ? input.tags : null,
      has_spoilers: input.hasSpoilers ?? false,
    })
    .select('id')
    .single();

  if (error) throw new Error(error.message);
  const postId = data.id;

  if (input.mediaUrls?.length) {
    const { error: mediaError } = await supabase.from('post_media').insert(
      input.mediaUrls.map((url, index) => ({
        post_id: postId,
        url,
        kind: 'image' as const,
        position: index,
      }))
    );
    // The post already exists; surface the failure rather than silently
    // dropping the images the user picked.
    if (mediaError) throw new Error(`Post saved but media failed: ${mediaError.message}`);
  }

  return postId;
}

export async function deletePost(userId: string, postId: string): Promise<void> {
  const { error } = await supabase.from('posts').delete().eq('id', postId).eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** Articles only, newest first — the Articles surface. */
export async function getArticles(limit = 40): Promise<PostWithRelations[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_WITH_RELATIONS)
    .eq('kind', 'article')
    .order('created_at', { ascending: false })
    .limit(limit);

  return sortMedia(unwrap(data as PostWithRelations[] | null, error));
}

export async function getUserPosts(userId: string): Promise<PostWithRelations[]> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_WITH_RELATIONS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(50);

  return sortMedia(unwrap(data as PostWithRelations[] | null, error));
}

export async function getPost(postId: string): Promise<PostWithRelations | null> {
  const { data, error } = await supabase
    .from('posts')
    .select(POST_WITH_RELATIONS)
    .eq('id', postId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data ? sortMedia([data as PostWithRelations])[0] : null;
}

// ---------------------------------------------------------------------------
// Likes
// ---------------------------------------------------------------------------

export async function setLiked(
  userId: string,
  targetType: TargetType,
  targetId: string,
  liked: boolean
): Promise<void> {
  if (liked) {
    const { error } = await supabase
      .from('likes')
      .insert({ user_id: userId, target_type: targetType, target_id: targetId });
    // Double-tap races can produce a duplicate; that is already the desired
    // state, so treat it as success rather than an error.
    if (error && !error.message.includes('duplicate')) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('likes')
    .delete()
    .eq('user_id', userId)
    .eq('target_type', targetType)
    .eq('target_id', targetId);
  if (error) throw new Error(error.message);
}

/**
 * Like/comment counts for many targets at once.
 *
 * The feed would otherwise fire two queries per row. Instead we fetch all
 * likes and comments for the visible ids in two queries total and tally in JS.
 */
export async function getEngagement(
  targetType: TargetType,
  targetIds: string[],
  viewerId: string | null
): Promise<Record<string, Engagement>> {
  const result: Record<string, Engagement> = {};
  for (const id of targetIds) {
    result[id] = { likes: 0, comments: 0, likedByViewer: false };
  }
  if (targetIds.length === 0) return result;

  const [likes, comments] = await Promise.all([
    supabase
      .from('likes')
      .select('target_id, user_id')
      .eq('target_type', targetType)
      .in('target_id', targetIds),
    supabase
      .from('comments')
      .select('target_id')
      .eq('target_type', targetType)
      .in('target_id', targetIds),
  ]);

  if (likes.error) throw new Error(likes.error.message);
  if (comments.error) throw new Error(comments.error.message);

  for (const row of likes.data ?? []) {
    const entry = result[row.target_id];
    if (!entry) continue;
    entry.likes += 1;
    if (viewerId && row.user_id === viewerId) entry.likedByViewer = true;
  }

  for (const row of comments.data ?? []) {
    const entry = result[row.target_id];
    if (entry) entry.comments += 1;
  }

  return result;
}

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export async function getComments(
  targetType: TargetType,
  targetId: string
): Promise<CommentWithAuthor[]> {
  const { data, error } = await supabase
    .from('comments')
    .select('*, profile:profiles(*)')
    .eq('target_type', targetType)
    .eq('target_id', targetId)
    .order('created_at', { ascending: true })
    .limit(200);

  return unwrap(data as CommentWithAuthor[] | null, error);
}

export async function addComment(
  userId: string,
  targetType: TargetType,
  targetId: string,
  body: string,
  parentId?: string | null
): Promise<Comment> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Write a comment first.');

  const { data, error } = await supabase
    .from('comments')
    .insert({
      user_id: userId,
      target_type: targetType,
      target_id: targetId,
      body: trimmed,
      parent_id: parentId ?? null,
    })
    .select('*')
    .single();

  if (error) throw new Error(error.message);
  return data as Comment;
}

export async function deleteComment(userId: string, commentId: string): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .delete()
    .eq('id', commentId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}
