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
import { getEngagement } from './engagement';

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
      /* Carried into the cache so a remake stays badged on a collection tile
         and in a feed, where there is no IGDB response to read it from. */
      edition_kind: game.edition,
      parent_game_id: game.parentId,
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

/**
 * How this app's own users scored a game, as a 10-bucket histogram.
 *
 * ## Why a dedicated query and not a tally of `getGameReviews`
 *
 * That one is capped at 50 rows and joins the full profile and game on each,
 * because it renders cards. This needs every rating and nothing else, so it
 * selects one integer column — a game with four hundred ratings costs about
 * 1.6 KB here against several hundred KB there, and the number it prints is the
 * true total rather than "up to fifty".
 *
 * ## The buckets
 *
 * Ten of them, 1–10, 11–20 … 91–100, which maps the 0–100 scale onto the ten
 * bars the graph draws. **0 is folded into the first bucket**: `Math.ceil(0/10)`
 * is 0 and would fall outside the array, and a zero is a "1–10" opinion by any
 * reading.
 *
 * Returns `null` when nobody has rated it — distinct from an all-zero histogram,
 * which cannot happen, and which the widget would otherwise draw as ten empty
 * columns under a real heading.
 */
export type RatingBreakdown = {
  /** Ten counts, lowest band first. */
  buckets: number[];
  total: number;
  /** Mean of every rating, 0-100. */
  average: number;
};

export async function getRatingBreakdown(gameId: string): Promise<RatingBreakdown | null> {
  const { data, error } = await supabase
    .from('logs')
    .select('rating')
    .eq('game_id', gameId)
    .not('rating', 'is', null);

  if (error) throw new Error(error.message);

  const ratings = (data ?? [])
    .map((row) => row.rating)
    .filter((rating): rating is number => rating !== null);

  if (ratings.length === 0) return null;

  const buckets = new Array<number>(10).fill(0);
  let sum = 0;
  for (const rating of ratings) {
    const clamped = Math.max(0, Math.min(100, rating));
    // `ceil` puts 10 in the first band and 11 in the second; `- 1` makes it an
    // index. `max(0, …)` is what catches a literal 0.
    const index = Math.max(0, Math.ceil(clamped / 10) - 1);
    buckets[index] += 1;
    sum += clamped;
  }

  return { buckets, total: ratings.length, average: Math.round(sum / ratings.length) };
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

/** Longest query worth sending. A name is not a paragraph. */
const PROFILE_QUERY_MAX = 60;

/**
 * Make a user's text safe to use as an ILIKE pattern.
 *
 * Two separate hazards, both of which shipped. `%` and `_` are SQL wildcards, so
 * a bare `_` matched *every* profile in the table; and PostgREST rewrites `*`
 * into `%` on its way to `ILIKE`, so an asterisk did the same thing by a
 * different route. Backslash is Postgres's default LIKE escape, so it has to be
 * escaped first or it would escape whatever followed it.
 */
function likeLiteral(input: string): string {
  return input.replace(/\*/g, '').replace(/[\\%_]/g, (char) => `\\${char}`);
}

/**
 * Rank a name match the way a person searching for a person expects.
 *
 * Lower is better. Postgres has no opinion about which of 25 matching rows is
 * the one you meant, so this supplies it: the exact handle first, then anything
 * *starting* with the term, then anything merely containing it.
 */
function profileRank(profile: Profile, needle: string): number {
  const username = profile.username?.toLowerCase() ?? '';
  const name = profile.display_name?.toLowerCase() ?? '';

  if (username === needle) return 0;
  if (name === needle) return 1;
  if (username.startsWith(needle)) return 2;
  if (name.startsWith(needle)) return 3;
  return 4;
}

/**
 * Find people by handle or display name.
 *
 * **Two queries rather than one `.or()`, deliberately.** The `.or()` filter is a
 * *logic tree parsed from a string*, so a comma, `(` or `)` anywhere in the
 * user's text broke the tree and came back as a 400 — which the People tab then
 * rendered as a raw PostgREST parser message in place of the page. A single
 * `.ilike()` sends its pattern as one opaque value and has no such grammar, so
 * splitting the search into two filters removes that entire failure class
 * instead of trying to escape its way around it.
 *
 * The results are then merged, de-duplicated and ranked here. There is no
 * ordering the database can supply — relevance to a text query is not a column —
 * and without one Postgres returned an arbitrary 25 of the matching rows, so an
 * exact username match was not guaranteed to be among them and the same search
 * could answer differently twice in a row.
 */
export async function searchProfiles(query: string, signal?: AbortSignal): Promise<Profile[]> {
  const trimmed = query.trim().slice(0, PROFILE_QUERY_MAX);
  if (!trimmed) return [];

  const pattern = `%${likeLiteral(trimmed)}%`;

  /* Both filters are fetched wide and narrowed here, so the row that ranks
     first is chosen from the whole match set rather than from whichever half
     the database happened to return. */
  const byHandle = supabase.from('profiles').select('*').ilike('username', pattern).limit(50);
  const byDisplayName = supabase
    .from('profiles')
    .select('*')
    .ilike('display_name', pattern)
    .limit(50);

  const [byUsername, byName] = await Promise.all([
    signal ? byHandle.abortSignal(signal) : byHandle,
    signal ? byDisplayName.abortSignal(signal) : byDisplayName,
  ]);

  const rows = [...unwrap(byUsername.data, byUsername.error), ...unwrap(byName.data, byName.error)];

  const needle = trimmed.toLowerCase();
  const unique = new Map<string, Profile>();
  for (const profile of rows) {
    if (!unique.has(profile.id)) unique.set(profile.id, profile);
  }

  return [...unique.values()]
    .sort((a, b) => {
      const byRank = profileRank(a, needle) - profileRank(b, needle);
      /* Alphabetical inside a band, so the order is stable across identical
         searches rather than following whatever the two queries returned. */
      return byRank !== 0 ? byRank : (a.username ?? '').localeCompare(b.username ?? '');
    })
    .slice(0, 25);
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

/*
 * The people behind the counts.
 *
 * `getProfileStats` has counted followers and following since the profile
 * existed, but nothing could ever list them — the numbers were rendered in the
 * tappable-count idiom every social app uses and led nowhere, because there was
 * no screen and no query to open. These two are the missing half.
 *
 * The embed is what makes one round trip enough: `follows` holds only two ids,
 * so the profile is pulled through the foreign key rather than by a second
 * query over the returned list. Both `FK<>` entries are declared in
 * `database.types.ts`, which is what stops supabase-js resolving the embed to
 * `SelectQueryError` — see the note in CLAUDE.md.
 *
 * The direction of the join is the whole difference between them, and it is
 * easy to get backwards: a *follower* is someone whose `following_id` is this
 * profile, so the row we want the profile from is `follower_id`.
 */
type FollowWithProfile = { profile: Profile | null };

/** People who follow this profile, most recent first. */
export async function getFollowers(profileId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!follows_follower_id_fkey(*)')
    .eq('following_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FollowWithProfile[])
    .map((row) => row.profile)
    .filter((profile): profile is Profile => profile !== null);
}

/** People this profile follows, most recent first. */
export async function getFollowing(profileId: string): Promise<Profile[]> {
  const { data, error } = await supabase
    .from('follows')
    .select('profile:profiles!follows_following_id_fkey(*)')
    .eq('follower_id', profileId)
    .order('created_at', { ascending: false });

  if (error) throw new Error(error.message);
  return ((data ?? []) as FollowWithProfile[])
    .map((row) => row.profile)
    .filter((profile): profile is Profile => profile !== null);
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

/**
 * One review of this game, with its like count and whether you liked it.
 *
 * `likes` is what ranks it, `likedByViewer` is what the like button reads.
 */
export type TopReview = {
  log: LogWithRelations;
  likes: number;
  likedByViewer: boolean;
};

/**
 * How many written reviews to weigh before picking one.
 *
 * The rank is computed here rather than in Postgres, so this is the cost knob:
 * every row comes back over the wire and its id goes into the likes query. Ten
 * is enough that the genuinely popular review is almost always among them —
 * they arrive newest-first, and a review with real likes on a game with more
 * than ten reviews is not going to be the eleventh-newest.
 */
const RANKED_REVIEWS = 10;

/**
 * The review worth showing for a game.
 *
 * ## Why this is composed rather than an RPC
 *
 * 0013 ships `popular_reviews()`, which is exactly this ranking — but globally,
 * with no game filter, so it cannot answer "for *this* game". Adding a second
 * function would mean a migration for a read that two existing calls already
 * cover, and this feature has to work on a database nobody has re-run.
 *
 * So: the newest written reviews for the game, then `getEngagement` for their
 * like counts in one batched pair, then the same ordering `popular_reviews`
 * uses — most liked first, **recency breaking ties**. That tiebreak is not a
 * detail: without it a game whose reviews all have zero likes would have no
 * defined winner, and the block would flicker between them on every deal.
 *
 * Returns null when the game has no written review, which is the common case
 * and not an error.
 */
export async function getTopGameReview(
  gameId: string,
  viewerId: string | null
): Promise<TopReview | null> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('game_id', gameId)
    /* A star rating alone is not a review — this block prints prose, and an
       empty body under someone's name reads as a loading failure. */
    .not('review', 'is', null)
    .order('created_at', { ascending: false })
    .limit(RANKED_REVIEWS);

  if (error) throw new Error(error.message);

  const reviews = (data as LogWithRelations[] | null) ?? [];
  const written = reviews.filter((log) => (log.review ?? '').trim().length > 0);
  if (written.length === 0) return null;

  const engagement = await getEngagement(
    'log',
    written.map((log) => log.id),
    viewerId
  );

  const best = written.reduce((winner, log) => {
    const a = engagement[log.id]?.likes ?? 0;
    const b = engagement[winner.id]?.likes ?? 0;
    if (a !== b) return a > b ? log : winner;
    // Already newest-first, so the incumbent is the more recent of a tie.
    return winner;
  }, written[0]);

  return {
    log: best,
    likes: engagement[best.id]?.likes ?? 0,
    likedByViewer: engagement[best.id]?.likedByViewer ?? false,
  };
}

/* -------------------------------------------------------------------------
 * The reviews sheet
 * ---------------------------------------------------------------------- */

/** How the review list is ordered. Filters are separate; see `ReviewFilters`. */
export type ReviewSort = 'popular' | 'newest' | 'week' | 'month';

export type ReviewFilters = {
  /** `played_on` exactly as the reviewer recorded it. Null means every platform. */
  platform?: string | null;
  /** Lowest score to include, inclusive. 60 shows 60-100. */
  minScore?: number | null;
  /** Highest score to include, inclusive. Only used by the "below 60" band. */
  maxScore?: number | null;
  /** Only reviews of a game the writer platinumed. */
  platinumOnly?: boolean;
};

export type ReviewListItem = {
  log: LogWithRelations;
  likes: number;
  /**
   * How many replies the review has.
   *
   * `getEngagement` has always returned this in the same batch as the likes —
   * it is one more tally over rows already fetched, so carrying it costs
   * nothing. It was dropped on the floor here until the review rows grew a
   * comment button, which could not have shown a count without it.
   */
  comments: number;
  likedByViewer: boolean;
};

/**
 * The most rows the sheet will hold.
 *
 * Popularity is ranked in memory — Postgres cannot order these by a count over
 * `likes` without a function per sort — so this is the ceiling on both the
 * transfer and the ranking. A hundred reviews is more than any game in this app
 * has, and far more than anybody scrolls.
 */
const REVIEW_PAGE = 100;

/** Days in each windowed sort. `popular` and `newest` are unwindowed. */
const WINDOW_DAYS: Partial<Record<ReviewSort, number>> = { week: 7, month: 30 };

/**
 * Every review of a game, ordered and filtered for the reviews sheet.
 *
 * ## Why the ordering happens here and not in SQL
 *
 * Three of the four sorts rank by like count, and PostgREST cannot order a
 * resource by an aggregate over an embedded one — the same limitation 0013's
 * five functions exist to work around. Adding four more functions would mean a
 * migration for a read, on a schema whose owner has not run 0012 onwards yet. So
 * Postgres does what it is good at (filtering, windowing, limiting) and the
 * ranking happens over the hundred rows that come back.
 *
 * ## What "this week" means
 *
 * Reviews *written* in the last seven days, ordered by likes — not reviews that
 * collected likes this week. The second reading needs a date filter on the likes
 * themselves, which would rank a two-year-old review as this week's most popular
 * because it got three likes on Tuesday. What a reader wants from "this week" is
 * what is new and landing well.
 */
export async function getGameReviewList(
  gameId: string,
  sort: ReviewSort,
  filters: ReviewFilters,
  viewerId: string | null
): Promise<ReviewListItem[]> {
  let query = supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('game_id', gameId)
    .not('review', 'is', null);

  const days = WINDOW_DAYS[sort];
  if (days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    query = query.gte('created_at', since);
  }

  if (filters.platform) query = query.eq('played_on', filters.platform);
  if (filters.platinumOnly) query = query.eq('platinum', true);
  if (filters.minScore != null) query = query.gte('rating', filters.minScore);
  if (filters.maxScore != null) query = query.lte('rating', filters.maxScore);

  const { data, error } = await query.order('created_at', { ascending: false }).limit(REVIEW_PAGE);

  if (error) throw new Error(error.message);

  const written = ((data as LogWithRelations[] | null) ?? []).filter(
    (log) => (log.review ?? '').trim().length > 0
  );
  if (written.length === 0) return [];

  const engagement = await getEngagement(
    'log',
    written.map((log) => log.id),
    viewerId
  );

  const items: ReviewListItem[] = written.map((log) => ({
    log,
    likes: engagement[log.id]?.likes ?? 0,
    comments: engagement[log.id]?.comments ?? 0,
    likedByViewer: engagement[log.id]?.likedByViewer ?? false,
  }));

  /* `newest` is already in order from the query. The other three rank by likes,
     and the rows arrive newest-first, so a stable sort leaves recency as the
     tiebreak — the same rule `popular_reviews` uses in 0013. */
  if (sort === 'newest') return items;
  return items.sort((a, b) => b.likes - a.likes);
}

/**
 * The platforms this game has actually been reviewed on.
 *
 * Built from the reviews rather than from the game's platform list, because the
 * filter is only useful for values that will return something — offering "Xbox
 * Series X" on a game nobody reviewed there is a control that can only
 * disappoint. Null entries are dropped: plenty of logs record no platform.
 */
export async function getReviewPlatforms(gameId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('played_on')
    .eq('game_id', gameId)
    .not('review', 'is', null)
    .not('played_on', 'is', null);

  if (error) throw new Error(error.message);

  const seen = new Set<string>();
  for (const row of data ?? []) {
    const value = (row.played_on ?? '').trim();
    if (value) seen.add(value);
  }
  return [...seen].sort((a, b) => a.localeCompare(b));
}
