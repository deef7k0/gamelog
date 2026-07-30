import type {
  AchievementWithUnlock,
  LogStatus,
  LogWithRelations,
  Profile,
  ProfileAchievementStats,
  ReviewMetrics,
} from '../database.types';
import { fetchSteamUnlocks, getGameAchievements, parseGameId, type Game } from '../games';
import { supabase } from '../supabase';

/** Columns for a log plus the game and author it renders with. */
const LOG_WITH_RELATIONS = '*, game:games(*), profile:profiles(*)';

function unwrap<T>(data: T | null, error: { message: string } | null): T {
  if (error) throw new Error(error.message);
  if (data === null) throw new Error('No data returned');
  return data;
}

// ---------------------------------------------------------------------------
// Games cache
// ---------------------------------------------------------------------------

/**
 * Mirror a game from an external provider into our own `games` table.
 *
 * Called before writing a log so feeds can join against local rows instead of
 * making one external API call per feed item. Upsert rather than insert so
 * re-logging an existing game refreshes stale metadata.
 */
export async function cacheGame(game: Game): Promise<void> {
  const { error } = await supabase.from('games').upsert(
    {
      id: game.id,
      source: game.source,
      source_id: game.sourceId,
      title: game.title,
      cover_url: game.coverUrl,
      hero_url: game.heroUrl,
      description: game.description,
      release_date: game.releaseDate,
      release_year: game.releaseYear,
      developer: game.developer,
      publisher: game.publisher,
      genres: game.genres,
      platforms: game.platforms,
      screenshots: game.screenshots,
      score: game.score,
      store_url: game.storeUrl,
      cached_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Logs
// ---------------------------------------------------------------------------

export type SaveLogInput = {
  game: Game;
  status: LogStatus;
  /**
   * 0-100 score, or null to clear. When `reviewMetrics` is set this must be
   * their mean — the caller computes both so `rating` stays the single score
   * every other read path uses.
   */
  rating: number | null;
  /** Per-category scores, or null when the reviewer used the bar. */
  reviewMetrics?: ReviewMetrics | null;
  /** Headline for a long-form review. */
  reviewTitle?: string | null;
  review: string | null;
  completionPercent?: number | null;
  platinum?: boolean;
  hoursPlayed?: number | null;
  playedOn?: string | null;
};

/** Create or update the signed-in user's log for a game. */
export async function saveLog(userId: string, input: SaveLogInput): Promise<void> {
  // The log has a FK to games, so the cache row must exist first.
  await cacheGame(input.game);

  const { error } = await supabase.from('logs').upsert(
    {
      user_id: userId,
      game_id: input.game.id,
      status: input.status,
      rating: input.rating,
      // An empty object would claim "advanced metrics, none scored", which is
      // just an unscored review — store null so the two cannot diverge.
      review_metrics:
        input.reviewMetrics && Object.keys(input.reviewMetrics).length > 0
          ? input.reviewMetrics
          : null,
      review_title: input.reviewTitle?.trim() ? input.reviewTitle.trim() : null,
      review: input.review?.trim() ? input.review.trim() : null,
      completion_percent: input.completionPercent ?? null,
      platinum: input.platinum ?? false,
      hours_played: input.hoursPlayed ?? null,
      played_on: input.playedOn ?? null,
    },
    { onConflict: 'user_id,game_id' }
  );
  if (error) throw new Error(error.message);
}

export async function deleteLog(userId: string, gameId: string): Promise<void> {
  const { error } = await supabase
    .from('logs')
    .delete()
    .eq('user_id', userId)
    .eq('game_id', gameId);
  if (error) throw new Error(error.message);
}

/** The signed-in user's own log for one game, or null if they have not logged it. */
export async function getMyLog(userId: string, gameId: string) {
  const { data, error } = await supabase
    .from('logs')
    .select('*')
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

/** One log with its game and author — what the full review screen renders. */
export async function getLogById(logId: string): Promise<LogWithRelations | null> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('id', logId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LogWithRelations | null;
}

/** Every log for a game that carries a rating or review — the game's reviews. */
export async function getGameReviews(gameId: string): Promise<LogWithRelations[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('game_id', gameId)
    .or('review.not.is.null,rating.not.is.null')
    .order('created_at', { ascending: false })
    .limit(50);

  return unwrap(data as LogWithRelations[] | null, error);
}

export async function getUserLogs(userId: string): Promise<LogWithRelations[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return unwrap(data as LogWithRelations[] | null, error);
}

/** Games this user has platinumed or 100%'d — the achievements showcase. */
export async function getUserCompletions(userId: string): Promise<LogWithRelations[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('user_id', userId)
    .or('platinum.is.true,completion_percent.eq.100')
    .order('updated_at', { ascending: false })
    .limit(50);

  return unwrap(data as LogWithRelations[] | null, error);
}

/**
 * The home feed: logs from everyone the user follows, plus their own.
 *
 * PostgREST cannot express "user_id in (subquery)", so the follow list is
 * fetched first and passed as an explicit `in` filter. Fine at this scale; if
 * the following count ever grows large this should become a Postgres function.
 */
export async function getFeed(userId: string): Promise<LogWithRelations[]> {
  const { data: follows, error: followsError } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId);

  if (followsError) throw new Error(followsError.message);

  const authorIds = [userId, ...(follows ?? []).map((row) => row.following_id)];

  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .in('user_id', authorIds)
    .order('created_at', { ascending: false })
    .limit(50);

  return unwrap(data as LogWithRelations[] | null, error);
}

/**
 * Recent activity across every user — what a new account sees before it
 * follows anyone, so the feed is never just an empty box.
 */
export async function getGlobalFeed(): Promise<LogWithRelations[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .order('created_at', { ascending: false })
    .limit(50);

  return unwrap(data as LogWithRelations[] | null, error);
}

// ---------------------------------------------------------------------------
// Achievements
// ---------------------------------------------------------------------------

/**
 * Populate the shared achievement catalogue for a game from its provider.
 *
 * No-op when the provider has no achievement data (IGDB) or is unconfigured.
 * Returns how many definitions are now cached.
 */
export async function cacheGameAchievements(game: Game): Promise<number> {
  const achievements = await getGameAchievements(game.id);
  if (achievements.length === 0) return 0;

  // The catalogue has an FK to games.
  await cacheGame(game);

  const { error } = await supabase.from('game_achievements').upsert(
    achievements.map((achievement) => ({
      id: achievement.id,
      game_id: achievement.gameId,
      external_id: achievement.externalId,
      name: achievement.name,
      description: achievement.description,
      icon_url: achievement.iconUrl,
      global_percent: achievement.globalPercent,
      hidden: achievement.hidden,
      cached_at: new Date().toISOString(),
    })),
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);

  return achievements.length;
}

/**
 * A game's achievements, each flagged with whether `userId` has unlocked it.
 *
 * Two queries rather than a join: PostgREST cannot express a LEFT JOIN filtered
 * to one user without an embedded resource, and the unlock set is small.
 */
export async function getAchievementsForGame(
  gameId: string,
  userId: string | null
): Promise<AchievementWithUnlock[]> {
  const { data: definitions, error } = await supabase
    .from('game_achievements')
    .select('*')
    .eq('game_id', gameId)
    .order('global_percent', { ascending: false, nullsFirst: false });

  if (error) throw new Error(error.message);
  if (!definitions) return [];

  if (!userId) {
    return definitions.map((definition) => ({ ...definition, unlocked_at: null }));
  }

  const { data: unlocks, error: unlocksError } = await supabase
    .from('user_achievements')
    .select('achievement_id, unlocked_at')
    .eq('user_id', userId)
    .in(
      'achievement_id',
      definitions.map((definition) => definition.id)
    );

  if (unlocksError) throw new Error(unlocksError.message);

  const unlockedAt = new Map((unlocks ?? []).map((row) => [row.achievement_id, row.unlocked_at]));

  return definitions.map((definition) => ({
    ...definition,
    unlocked_at: unlockedAt.get(definition.id) ?? null,
  }));
}

/** Tick or untick one achievement by hand. */
export async function setAchievementUnlocked(
  userId: string,
  achievementId: string,
  unlocked: boolean
): Promise<void> {
  if (unlocked) {
    const { error } = await supabase
      .from('user_achievements')
      .upsert(
        { user_id: userId, achievement_id: achievementId, synced: false },
        { onConflict: 'user_id,achievement_id' }
      );
    if (error) throw new Error(error.message);
    return;
  }

  const { error } = await supabase
    .from('user_achievements')
    .delete()
    .eq('user_id', userId)
    .eq('achievement_id', achievementId);
  if (error) throw new Error(error.message);
}

export type SteamSyncResult = { unlocked: number; total: number };

/**
 * Pull real Steam achievement progress for one game.
 *
 * Only works for Steam-sourced games, and only when the user has linked a
 * SteamID64 whose profile is public — Steam returns an error otherwise, which
 * `fetchSteamUnlocks` surfaces so the UI can explain the failure.
 */
export async function syncSteamAchievements(
  userId: string,
  steamId: string,
  game: Game
): Promise<SteamSyncResult> {
  const parsed = parseGameId(game.id);
  if (parsed?.source !== 'steam') {
    throw new Error('Steam sync only works for games sourced from Steam.');
  }

  const total = await cacheGameAchievements(game);
  const unlocks = await fetchSteamUnlocks(steamId, parsed.sourceId);

  if (unlocks.length > 0) {
    const { error } = await supabase.from('user_achievements').upsert(
      unlocks.map((unlock) => ({
        user_id: userId,
        achievement_id: `${game.id}:${unlock.externalId}`,
        unlocked_at: unlock.unlockedAt,
        synced: true,
      })),
      { onConflict: 'user_id,achievement_id' }
    );
    if (error) throw new Error(error.message);
  }

  // A full clear is worth recording on the log itself so the profile can show
  // it without recounting achievements every time.
  if (total > 0 && unlocks.length >= total) {
    await supabase
      .from('logs')
      .update({ completion_percent: 100 })
      .eq('user_id', userId)
      .eq('game_id', game.id);
  }

  return { unlocked: unlocks.length, total };
}

// ---------------------------------------------------------------------------
// Profiles and follows
// ---------------------------------------------------------------------------

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data;
}

export async function updateProfile(
  userId: string,
  patch: Pick<
    Partial<Profile>,
    | 'display_name'
    | 'bio'
    | 'avatar_url'
    | 'banner_url'
    | 'favorite_platform'
    | 'location'
    | 'steam_id'
  >
): Promise<void> {
  const { error } = await supabase.from('profiles').update(patch).eq('id', userId);
  if (error) throw new Error(error.message);
}

export async function searchProfiles(query: string): Promise<Profile[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .or(`username.ilike.%${trimmed}%,display_name.ilike.%${trimmed}%`)
    .limit(25);

  return unwrap(data, error);
}

export async function followUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: followerId, following_id: followingId });
  if (error) throw new Error(error.message);
}

export async function unfollowUser(followerId: string, followingId: string): Promise<void> {
  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', followerId)
    .eq('following_id', followingId);
  if (error) throw new Error(error.message);
}

export type ProfileStats = {
  logged: number;
  followers: number;
  following: number;
  /** Whether the viewer follows this profile. Null when viewing your own. */
  isFollowing: boolean | null;
};

export async function getProfileStats(
  profileId: string,
  viewerId: string | null
): Promise<ProfileStats> {
  const [logged, followers, following, isFollowing] = await Promise.all([
    supabase.from('logs').select('*', { count: 'exact', head: true }).eq('user_id', profileId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profileId),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profileId),
    viewerId && viewerId !== profileId
      ? supabase
          .from('follows')
          .select('follower_id')
          .eq('follower_id', viewerId)
          .eq('following_id', profileId)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  return {
    logged: logged.count ?? 0,
    followers: followers.count ?? 0,
    following: following.count ?? 0,
    isFollowing: viewerId && viewerId !== profileId ? isFollowing.data !== null : null,
  };
}

/** Platinum / completion / achievement totals, read from the SQL view. */
export async function getAchievementStats(profileId: string): Promise<ProfileAchievementStats> {
  const { data, error } = await supabase
    .from('profile_achievement_stats')
    .select('*')
    .eq('user_id', profileId)
    .maybeSingle();

  if (error) throw new Error(error.message);

  return (
    data ?? {
      user_id: profileId,
      achievements_unlocked: 0,
      platinums: 0,
      completions: 0,
      hours_played: 0,
    }
  );
}
