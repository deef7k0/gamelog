import { supabase } from '../supabase';
import type { Comment, CommentWithAuthor, Engagement, TargetType } from './types';

/**
 * Likes and comments — the engagement layer, shared by every likeable thing.
 *
 * Was `posts.ts`, which held the user-post and article API alongside these. That
 * feature is gone; likes and comments were never part of it. They are
 * polymorphic over `(target_type, target_id)` and always were: likes work on
 * logs and collections, comments on logs. Leaving them in a file named for a
 * deleted feature would have been the kind of drift that sends the next reader
 * looking for posts that no longer exist.
 */

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
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
