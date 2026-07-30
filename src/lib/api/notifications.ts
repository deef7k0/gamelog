import { supabase } from '../supabase';
import type { AppNotification } from './types';

export async function getNotifications(userId: string): Promise<AppNotification[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*, actor:profiles!notifications_actor_id_fkey(*)')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  if (error) throw new Error(error.message);
  return (data ?? []) as AppNotification[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('read', false);

  if (error) throw new Error(error.message);
  return count ?? 0;
}

export async function markAllRead(userId: string): Promise<void> {
  const { error } = await supabase
    .from('notifications')
    .update({ read: true })
    .eq('user_id', userId)
    .eq('read', false);
  if (error) throw new Error(error.message);
}

export type NotificationGroup = { title: string; data: AppNotification[] };

/**
 * Bucket notifications into Today / Yesterday / Earlier for a SectionList.
 *
 * Compares calendar days in local time rather than elapsed hours, so something
 * from 11pm last night reads as "Yesterday", not "Today".
 */
export function groupNotifications(
  notifications: AppNotification[],
  now: Date = new Date()
): NotificationGroup[] {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startOfYesterday = startOfToday - 86_400_000;

  const today: AppNotification[] = [];
  const yesterday: AppNotification[] = [];
  const earlier: AppNotification[] = [];

  for (const notification of notifications) {
    const at = new Date(notification.created_at).getTime();
    if (at >= startOfToday) today.push(notification);
    else if (at >= startOfYesterday) yesterday.push(notification);
    else earlier.push(notification);
  }

  return [
    { title: 'Today', data: today },
    { title: 'Yesterday', data: yesterday },
    { title: 'Earlier', data: earlier },
  ].filter((group) => group.data.length > 0);
}
