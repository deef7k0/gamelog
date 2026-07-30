import type { FriendshipRow, Profile } from '../database.types';
import { supabase } from '../supabase';

/**
 * Friendship — mutual and consented, unlike follows.
 *
 * A friendship is one row per pair, stored with `user_a < user_b` (the database
 * enforces it with a CHECK). That ordering is what makes duplicate reciprocal
 * rows impossible, but it means callers must never build a pair by hand — hence
 * `orderPair` and the helpers below.
 */

export type FriendState =
  | 'none'
  /** You sent a request that has not been answered. */
  | 'outgoing'
  /** They sent you a request awaiting your answer. */
  | 'incoming'
  | 'friends'
  /** Looking at your own profile. */
  | 'self';

function orderPair(one: string, two: string): { user_a: string; user_b: string } {
  return one < two ? { user_a: one, user_b: two } : { user_a: two, user_b: one };
}

async function getRow(one: string, two: string): Promise<FriendshipRow | null> {
  const pair = orderPair(one, two);
  const { data, error } = await supabase
    .from('friendships')
    .select('*')
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/** Where the viewer stands with this profile. */
export async function getFriendState(viewerId: string, profileId: string): Promise<FriendState> {
  if (viewerId === profileId) return 'self';

  const row = await getRow(viewerId, profileId);
  if (!row) return 'none';
  if (row.status === 'accepted') return 'friends';
  return row.requested_by === viewerId ? 'outgoing' : 'incoming';
}

export async function sendFriendRequest(viewerId: string, profileId: string): Promise<void> {
  if (viewerId === profileId) throw new Error('You cannot friend yourself.');

  const { error } = await supabase.from('friendships').insert({
    ...orderPair(viewerId, profileId),
    requested_by: viewerId,
    status: 'pending',
  });

  if (error) {
    // The pair already exists — a request crossed in flight, or they already
    // requested you. Either way the UI should just re-read the state.
    if (error.message.includes('duplicate')) return;
    throw new Error(error.message);
  }
}

/**
 * Accept a request.
 *
 * The RLS policy only lets the *other* party update the row, so a user cannot
 * accept their own request — this will fail rather than silently succeed if
 * called by the requester.
 */
export async function acceptFriendRequest(viewerId: string, profileId: string): Promise<void> {
  const pair = orderPair(viewerId, profileId);
  const { error } = await supabase
    .from('friendships')
    .update({ status: 'accepted', responded_at: new Date().toISOString() })
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b)
    .eq('status', 'pending');

  if (error) throw new Error(error.message);
}

/** Decline a pending request, or remove an existing friendship. */
export async function removeFriendship(viewerId: string, profileId: string): Promise<void> {
  const pair = orderPair(viewerId, profileId);
  const { error } = await supabase
    .from('friendships')
    .delete()
    .eq('user_a', pair.user_a)
    .eq('user_b', pair.user_b);

  if (error) throw new Error(error.message);
}

type FriendshipWithProfiles = FriendshipRow & {
  profile_a: Profile | null;
  profile_b: Profile | null;
};

const WITH_PROFILES =
  '*, profile_a:profiles!friendships_user_a_fkey(*), profile_b:profiles!friendships_user_b_fkey(*)';

/** The *other* person in a friendship row, from `viewerId`'s point of view. */
function otherParty(row: FriendshipWithProfiles, viewerId: string): Profile | null {
  return row.user_a === viewerId ? row.profile_b : row.profile_a;
}

export async function getFriends(userId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(WITH_PROFILES)
    .eq('status', 'accepted')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('responded_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as FriendshipWithProfiles[])
    .map((row) => otherParty(row, userId))
    .filter((profile): profile is Profile => profile !== null);
}

export type FriendRequest = { profile: Profile; requestedAt: string };

/** Requests waiting on this user's answer. */
export async function getIncomingRequests(userId: string): Promise<FriendRequest[]> {
  const { data, error } = await supabase
    .from('friendships')
    .select(WITH_PROFILES)
    .eq('status', 'pending')
    // Pending rows where someone else did the asking.
    .neq('requested_by', userId)
    .or(`user_a.eq.${userId},user_b.eq.${userId}`)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);

  return ((data ?? []) as FriendshipWithProfiles[])
    .map((row) => {
      const profile = otherParty(row, userId);
      return profile ? { profile, requestedAt: row.created_at } : null;
    })
    .filter((entry): entry is FriendRequest => entry !== null);
}

export async function getFriendCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('friendships')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'accepted')
    .or(`user_a.eq.${userId},user_b.eq.${userId}`);

  if (error) throw new Error(error.message);
  return count ?? 0;
}
