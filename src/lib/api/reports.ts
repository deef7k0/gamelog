import type {
  ContentReportReason,
  ReviewReportQueueRow,
  SuggestionReportQueueRow,
} from '../database.types';
import { supabase } from '../supabase';

/**
 * Reports on what people write (0031): a suggestion on a community pick, and a
 * review. Reports on the picks themselves are 0025's and stay in
 * `similarity.ts` (`reportSimilarity`).
 *
 * Private — only the reporter and the moderators see one — and, unlike a pick,
 * never enough on their own to take anything down: somebody's writing waits for
 * a moderator. See the migration for why.
 */

/** One thing that can be reported, named the way its table keys it. */
export type ReportTarget =
  | { kind: 'pick'; pairId: string }
  | { kind: 'suggestion'; pairId: string; authorId: string }
  | { kind: 'review'; logId: string };

/** A report you have already filed — enough to say so instead of the form. */
export type MyReport = { status: 'open' | 'resolved'; created_at: string };

/**
 * Your report on this, if you have filed one. Every report table lets its
 * author read their own rows, which is all this needs.
 */
export async function getMyReport(userId: string, target: ReportTarget): Promise<MyReport | null> {
  const { data, error } =
    target.kind === 'pick'
      ? await supabase
          .from('game_similarity_reports')
          .select('status, created_at')
          .eq('similarity_id', target.pairId)
          .eq('user_id', userId)
          .maybeSingle()
      : target.kind === 'suggestion'
        ? await supabase
            .from('similarity_suggestion_reports')
            .select('status, created_at')
            .eq('similarity_id', target.pairId)
            .eq('author_id', target.authorId)
            .eq('user_id', userId)
            .maybeSingle()
        : await supabase
            .from('review_reports')
            .select('status, created_at')
            .eq('log_id', target.logId)
            .eq('user_id', userId)
            .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/**
 * Report someone's suggestion. Reporting twice is a no-op rather than an error,
 * as it is for a pick: you have already said so. Your own is refused by the
 * table's CHECK.
 */
export async function reportSuggestion(
  userId: string,
  pairId: string,
  authorId: string,
  reason: ContentReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase.from('similarity_suggestion_reports').upsert(
    {
      similarity_id: pairId,
      author_id: authorId,
      user_id: userId,
      reason,
      note: note?.trim() || null,
    },
    { onConflict: 'similarity_id,author_id,user_id', ignoreDuplicates: true }
  );

  if (error) {
    console.warn('[reports] suggestion report failed:', error.message);
    throw new Error(error.message);
  }
}

/**
 * Report a review. A no-op the second time; your own is refused by the insert
 * policy, which is the one place that can see who wrote the log.
 */
export async function reportReview(
  userId: string,
  logId: string,
  reason: ContentReportReason,
  note?: string | null
): Promise<void> {
  const { error } = await supabase
    .from('review_reports')
    .upsert(
      { log_id: logId, user_id: userId, reason, note: note?.trim() || null },
      { onConflict: 'log_id,user_id', ignoreDuplicates: true }
    );

  if (error) {
    console.warn('[reports] review report failed:', error.message);
    throw new Error(error.message);
  }
}

// ---------------------------------------------------------------------------
// Moderation
// ---------------------------------------------------------------------------

export async function getSuggestionReports(): Promise<SuggestionReportQueueRow[]> {
  const { data, error } = await supabase.rpc('suggestion_reports_queue');
  if (error) {
    console.warn('[moderation] could not load suggestion reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as SuggestionReportQueueRow[];
}

export async function getReviewReports(): Promise<ReviewReportQueueRow[]> {
  const { data, error } = await supabase.rpc('review_reports_queue');
  if (error) {
    console.warn('[moderation] could not load review reports:', error.message);
    throw new Error(error.message);
  }
  return (data ?? []) as ReviewReportQueueRow[];
}

/**
 * `remove` takes a suggestion's words down — its vote stays; `dismiss` keeps
 * it. Either closes its open reports.
 */
export async function moderateSuggestion(
  pairId: string,
  authorId: string,
  action: 'remove' | 'dismiss'
): Promise<void> {
  const { error } = await supabase.rpc('moderate_suggestion', {
    p_similarity: pairId,
    p_author: authorId,
    p_action: action,
  });

  if (error) {
    console.warn(`[moderation] suggestion ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}

/**
 * `remove` takes a review's headline and prose down — the log and its score
 * stay; `dismiss` keeps it. Either closes its open reports.
 */
export async function moderateReview(logId: string, action: 'remove' | 'dismiss'): Promise<void> {
  const { error } = await supabase.rpc('moderate_review', { p_log: logId, p_action: action });

  if (error) {
    console.warn(`[moderation] review ${action} failed:`, error.message);
    throw new Error(error.message);
  }
}
