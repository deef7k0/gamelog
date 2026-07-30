import type { CachedGame, Profile, WallPostRow } from '../database.types';
import { supabase } from '../supabase';

/**
 * Profile walls: short written notes, interleaved with the owner's activity.
 *
 * Activity is **derived at read time** rather than written into an activity
 * table by triggers. That keeps it always accurate — editing a review or
 * removing a game from a list changes the wall automatically, with no rows to
 * backfill or clean up. The cost is several queries per load, which is fine at
 * one profile at a time.
 */

export type WallPost = WallPostRow & { author: Profile | null };

/** Auto-generated entries describing something the owner did. */
export type ActivityKind =
  | 'reviewed'
  | 'logged'
  | 'wishlisted'
  | 'listed'
  | 'friended'
  | 'platinum'
  | 'watching_event'
  | 'attending_event'
  | 'diary';

export type ActivityEntry = {
  id: string;
  kind: ActivityKind;
  createdAt: string;
  /** The game involved, when there is one. */
  game: Pick<CachedGame, 'id' | 'title' | 'cover_url' | 'hero_url'> | null;
  /** The other person, for friendship entries. */
  person: Profile | null;
  /** List name, for 'listed'. */
  listTitle: string | null;
  /** Event name, for the two event kinds. */
  eventName: string | null;
  /** Review score, for 'reviewed'. */
  score: number | null;
  /** Target for navigation — a log id for reviews, a game id for diary entries. */
  refId: string | null;
};

/** The wall is a merge of written notes and derived activity, newest first. */
export type WallItem =
  | { type: 'post'; id: string; createdAt: string; post: WallPost }
  | { type: 'activity'; id: string; createdAt: string; activity: ActivityEntry };

const GAME_FIELDS = 'id, title, cover_url, hero_url';

// ---------------------------------------------------------------------------
// Written notes
// ---------------------------------------------------------------------------

export async function postToWall(
  authorId: string,
  wallOwnerId: string,
  body: string
): Promise<void> {
  const trimmed = body.trim();
  if (!trimmed) throw new Error('Write something first.');
  if (trimmed.length > 500) throw new Error('Wall posts are limited to 500 characters.');

  const { error } = await supabase
    .from('wall_posts')
    .insert({ author_id: authorId, wall_owner_id: wallOwnerId, body: trimmed });

  if (error) {
    // The RLS policy rejects non-friends; translate that into something the UI
    // can actually show a user.
    if (error.message.toLowerCase().includes('row-level security')) {
      throw new Error('You need to be friends with this person to post on their wall.');
    }
    throw new Error(error.message);
  }
}

export async function deleteWallPost(postId: string): Promise<void> {
  const { error } = await supabase.from('wall_posts').delete().eq('id', postId);
  if (error) throw new Error(error.message);
}

async function getWallPosts(wallOwnerId: string): Promise<WallPost[]> {
  const { data, error } = await supabase
    .from('wall_posts')
    .select('*, author:profiles!wall_posts_author_id_fkey(*)')
    .eq('wall_owner_id', wallOwnerId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) throw new Error(error.message);
  return (data ?? []) as WallPost[];
}

// ---------------------------------------------------------------------------
// Derived activity
// ---------------------------------------------------------------------------

type LogRow = {
  id: string;
  game_id: string;
  rating: number | null;
  review: string | null;
  platinum: boolean;
  created_at: string;
  game: Pick<CachedGame, 'id' | 'title' | 'cover_url' | 'hero_url'> | null;
};

type ListItemRow = {
  game_id: string;
  added_at: string;
  game: Pick<CachedGame, 'id' | 'title' | 'cover_url' | 'hero_url'> | null;
  lists: { title: string; kind: string } | { title: string; kind: string }[] | null;
};

type AttendanceRow = {
  event_id: string;
  mode: 'livestream' | 'in_person';
  created_at: string;
  event: { name: string } | { name: string }[] | null;
};

type ActivityGame = Pick<CachedGame, 'id' | 'title' | 'cover_url' | 'hero_url'>;

type DiaryRow = {
  id: string;
  game_id: string;
  body: string;
  entry_date: string;
  created_at: string;
  game: ActivityGame | ActivityGame[] | null;
};

type FriendRow = {
  user_a: string;
  user_b: string;
  responded_at: string | null;
  created_at: string;
  profile_a: Profile | null;
  profile_b: Profile | null;
};

async function getActivity(userId: string): Promise<ActivityEntry[]> {
  const [logs, listItems, friends, attendance, diary] = await Promise.all([
    supabase
      .from('logs')
      .select(`id, game_id, rating, review, platinum, created_at, game:games(${GAME_FIELDS})`)
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('list_items')
      .select(`game_id, added_at, game:games(${GAME_FIELDS}), lists!inner(title, kind, user_id)`)
      .eq('lists.user_id', userId)
      .order('added_at', { ascending: false })
      .limit(30),

    supabase
      .from('friendships')
      .select(
        '*, profile_a:profiles!friendships_user_a_fkey(*), profile_b:profiles!friendships_user_b_fkey(*)'
      )
      .eq('status', 'accepted')
      .or(`user_a.eq.${userId},user_b.eq.${userId}`)
      .order('responded_at', { ascending: false })
      .limit(20),

    supabase
      .from('event_attendance')
      .select('event_id, mode, created_at, event:events(name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),

    supabase
      .from('diary_entries')
      .select(
        'id, game_id, body, entry_date, created_at, game:games(id, title, cover_url, hero_url)'
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20),
  ]);

  if (logs.error) throw new Error(logs.error.message);
  if (listItems.error) throw new Error(listItems.error.message);
  if (friends.error) throw new Error(friends.error.message);
  if (attendance.error) throw new Error(attendance.error.message);
  if (diary.error) throw new Error(diary.error.message);

  const entries: ActivityEntry[] = [];

  for (const log of (logs.data ?? []) as unknown as LogRow[]) {
    // A platinum is the more interesting fact than the log itself.
    const kind: ActivityKind = log.platinum ? 'platinum' : log.review ? 'reviewed' : 'logged';
    entries.push({
      id: `log:${log.id}`,
      kind,
      createdAt: log.created_at,
      game: log.game,
      person: null,
      listTitle: null,
      eventName: null,
      score: log.rating,
      refId: log.id,
    });
  }

  for (const item of (listItems.data ?? []) as unknown as ListItemRow[]) {
    const list = Array.isArray(item.lists) ? item.lists[0] : item.lists;
    if (!list) continue;
    // Favourites are already shown as their own profile widget; skip the noise.
    if (list.kind === 'favorites') continue;

    entries.push({
      id: `list:${item.game_id}:${item.added_at}`,
      kind: list.kind === 'wishlist' ? 'wishlisted' : 'listed',
      createdAt: item.added_at,
      game: item.game,
      person: null,
      listTitle: list.kind === 'wishlist' ? null : list.title,
      eventName: null,
      score: null,
      refId: null,
    });
  }

  for (const row of (friends.data ?? []) as unknown as FriendRow[]) {
    const other = row.user_a === userId ? row.profile_b : row.profile_a;
    if (!other) continue;

    entries.push({
      id: `friend:${row.user_a}:${row.user_b}`,
      kind: 'friended',
      createdAt: row.responded_at ?? row.created_at,
      game: null,
      person: other,
      listTitle: null,
      eventName: null,
      score: null,
      refId: other.id,
    });
  }

  for (const row of (attendance.data ?? []) as unknown as AttendanceRow[]) {
    const event = Array.isArray(row.event) ? row.event[0] : row.event;
    entries.push({
      id: `event:${row.event_id}`,
      kind: row.mode === 'in_person' ? 'attending_event' : 'watching_event',
      createdAt: row.created_at,
      game: null,
      person: null,
      listTitle: null,
      eventName: event?.name ?? 'an event',
      score: null,
      refId: row.event_id,
    });
  }

  for (const row of (diary.data ?? []) as unknown as DiaryRow[]) {
    const game = Array.isArray(row.game) ? row.game[0] : row.game;
    entries.push({
      id: `diary:${row.id}`,
      kind: 'diary',
      createdAt: row.created_at,
      game: game ?? null,
      person: null,
      listTitle: null,
      eventName: null,
      score: null,
      // The diary screen is keyed by (user, game), so the game id is what the
      // row needs to navigate — the entry's own id would not locate anything.
      refId: row.game_id,
    });
  }

  return entries;
}

/** Everything on a profile's wall, newest first. */
export async function getWall(wallOwnerId: string): Promise<WallItem[]> {
  const [posts, activity] = await Promise.all([
    getWallPosts(wallOwnerId),
    getActivity(wallOwnerId),
  ]);

  const items: WallItem[] = [
    ...posts.map((post): WallItem => ({
      type: 'post',
      id: `post:${post.id}`,
      createdAt: post.created_at,
      post,
    })),
    ...activity.map((entry): WallItem => ({
      type: 'activity',
      id: entry.id,
      createdAt: entry.createdAt,
      activity: entry,
    })),
  ];

  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, 60);
}
