import type {
  AchievementWithUnlock,
  CachedGame,
  CompletionLevel,
  GameReviewStats,
  LogStatus,
  LogWithRelations,
  Profile,
  ProfileAchievementStats,
  ReviewMetrics,
  UserGameStats,
} from '../database.types';
import { isValidRating } from '../community-rating';
import { leadReview } from '../discovery';
import { fetchSteamUnlocks, getGameAchievements, parseGameId, type Game } from '../games';
import { reviewLanguage } from '../language';
import { inList } from '../postgrest';
import { reviewFilterClauses, type ReviewFilters } from '../review-facets';
import { hasWriting, normaliseQuote, type ReviewDisplay } from '../review-quote';
import { supabase } from '../supabase';
import { getEngagement } from './engagement';
import { rememberLogs } from './seen-logs';

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
/**
 * A game as its `games` row — what `cacheGame` writes, and what a card drawn
 * before anything is saved (the log form's preview) reads.
 */
export function cachedGameOf(game: Game, cachedAt: string): CachedGame {
  return {
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
    edition_kind: game.edition,
    parent_game_id: game.parentId,
    cached_at: cachedAt,
  };
}

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
  /** The review in one sentence — the quote (0040; it was a headline). */
  reviewTitle?: string | null;
  review: string | null;
  /**
   * What the review's cards show (0040). Left out when undefined, like
   * `completion`: a caller with no opinion keeps whatever the row says.
   */
  reviewDisplay?: ReviewDisplay;
  completionPercent?: number | null;
  platinum?: boolean;
  /** The author says this review gives something away. See `GameLog.spoilers`. */
  spoilers?: boolean;
  hoursPlayed?: number | null;
  playedOn?: string | null;
  /**
   * How far they got (0023). Left out entirely when undefined, not written as
   * null: this is an upsert, and the progress sheet and the playthrough trigger
   * both write this column too — a caller with no opinion must not erase theirs.
   */
  completion?: CompletionLevel | null;
  /**
   * Co-op or solo (0023), null for "didn't say", and how many played when it was
   * co-op. Left out when undefined, like `completion`. The database refuses a
   * player count on anything but a co-op log, so pass null with solo.
   */
  coop?: boolean | null;
  playerCount?: number | null;
};

/**
 * Whether `logs.review_lang` exists here (0038): unknown until a save has tried
 * it, and `false` from the first one a database without the column refuses.
 *
 * PostgREST refuses the *whole row* for one column it does not know — verified
 * against the live project: `PGRST204`, "Could not find the 'review_lang'
 * column of 'logs' in the schema cache". Sent unconditionally, the label would
 * mean no log could be saved until the migration ran, which is what 0023 did
 * to this form once. So the label is tried, and left off for the rest of the
 * session when it is not wanted. Restarting the app asks again.
 */
let languageColumn: boolean | null = null;

/**
 * Whether `logs.review_display` exists here (0040) — the same treatment as
 * `review_lang`, for the same reason: one unknown column and PostgREST refuses
 * the row. A database without it saves the review; its cards show the text,
 * which is what they always showed.
 */
let displayColumn: boolean | null = null;

/**
 * "Has something written": the review, or its one sentence (0040's quote). A
 * review can now be either, and a list of reviews holds both. An `or` of its
 * own, which PostgREST ANDs with any other on the same request — verified
 * against the live project.
 */
const HAS_WRITING = 'review.not.is.null,review_title.not.is.null';

function isMissingColumn(error: { code?: string; message: string }, column: string): boolean {
  return (error.code === 'PGRST204' || error.code === '42703') && error.message.includes(column);
}

/** Create or update the signed-in user's log for a game. */
export async function saveLog(userId: string, input: SaveLogInput): Promise<void> {
  /* The database refuses anything else (`logs_rating_check`, an int column);
     saying so before the game is cached keeps a bad value from costing a
     write. The form only produces whole numbers on the scale. */
  if (input.rating !== null && !isValidRating(input.rating)) {
    throw new Error('A score is a whole number from 0 to 100.');
  }

  // The log has a FK to games, so the cache row must exist first.
  await cacheGame(input.game);

  /* The quote is kept as one line with no quotation marks of its own: the app
     draws the marks (`normaliseQuote`). */
  const reviewTitle = normaliseQuote(input.reviewTitle) || null;
  const review = input.review?.trim() ? input.review.trim() : null;

  const row = {
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
    review_title: reviewTitle,
    review,
    completion_percent: input.completionPercent ?? null,
    platinum: input.platinum ?? false,
    /* `?? false` rather than omitted: this is an upsert, so leaving the key
       out on an edit would keep whatever the row already held — and clearing
       the flag is exactly as much a decision as setting it. */
    spoilers: input.spoilers ?? false,
    hours_played: input.hoursPlayed ?? null,
    played_on: input.playedOn ?? null,
    ...(input.completion !== undefined ? { completion: input.completion } : {}),
    ...(input.coop !== undefined ? { coop: input.coop } : {}),
    ...(input.playerCount !== undefined ? { player_count: input.playerCount } : {}),
  };

  /*
   * The language the words are in, worked out here because here is where the
   * words are: there is no detector in Postgres. Always written with the
   * review — null when there is none, or none could be told — so editing a
   * Spanish review into an English one does not leave it filed under Spanish.
   * The game's own title is read past: "The Last of Us" is four English words
   * in whatever language the sentence around them is.
   */
  const language = reviewLanguage(review, reviewTitle, { ignore: [input.game.title] });

  /* The two columns a database may not have yet, each sent until it is
     refused once. Each refusal names one column, so this asks at most three
     times, and only on the first save of a session. */
  const write = () =>
    supabase.from('logs').upsert(
      {
        ...row,
        ...(languageColumn !== false ? { review_lang: language } : {}),
        ...(displayColumn !== false && input.reviewDisplay !== undefined
          ? { review_display: input.reviewDisplay }
          : {}),
      },
      { onConflict: 'user_id,game_id' }
    );

  let { error } = await write();
  for (let retry = 0; error && retry < 2; retry++) {
    if (languageColumn !== false && isMissingColumn(error, 'review_lang')) {
      languageColumn = false;
    } else if (displayColumn !== false && isMissingColumn(error, 'review_display')) {
      displayColumn = false;
    } else {
      break;
    }
    ({ error } = await write());
  }
  if (error) throw new Error(error.message);

  if (languageColumn === null) languageColumn = true;
  if (displayColumn === null && input.reviewDisplay !== undefined) displayColumn = true;
}

/**
 * Whether the database has 0040's `review_display` — false once a save has
 * been refused for it this session, null while nobody has asked. The log form
 * says so under its choice, rather than offering one that is not kept.
 */
export function reviewDisplaySaved(): boolean | null {
  return displayColumn;
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

/**
 * One person's log of one game, with the game and the person — for a screen
 * that shows their review of it as a card (a copy's own screen).
 *
 * `getMyLog` is the bare row; this is the same lookup with what a card needs to
 * sign it. Null when they have not logged the game.
 */
export async function getLogOf(userId: string, gameId: string): Promise<LogWithRelations | null> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('user_id', userId)
    .eq('game_id', gameId)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data as LogWithRelations | null;
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
    .or(`${HAS_WRITING},rating.not.is.null`)
    .order('created_at', { ascending: false })
    .limit(50);

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
}

export async function getUserLogs(userId: string): Promise<LogWithRelations[]> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(100);

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
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

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
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

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
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

  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
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

/**
 * Whether nobody has this handle yet — onboarding's "claim your handle.".
 *
 * Case-insensitive, as the unique index on `lower(username)` (0001) is, and
 * through `likeLiteral` so an underscore is an underscore and not a wildcard
 * that matches every name of that length.
 */
export async function isUsernameFree(username: string, signal?: AbortSignal): Promise<boolean> {
  let request = supabase
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .ilike('username', likeLiteral(username));
  if (signal) request = request.abortSignal(signal);
  const { count, error } = await request;
  if (error) throw new Error(error.message);
  return (count ?? 0) === 0;
}

/**
 * Take a handle. `'taken'` when somebody got there first — the check above is
 * a courtesy; the unique index is the rule.
 */
export async function claimUsername(userId: string, username: string): Promise<'ok' | 'taken'> {
  const { error } = await supabase.from('profiles').update({ username }).eq('id', userId);
  if (!error) return 'ok';
  if (error.code === '23505') return 'taken';
  throw new Error(error.message);
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
export function likeLiteral(input: string): string {
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

/** How many of the newest reviews one page of "Latest reviews" holds. */
export const LATEST_PAGE = 20;

/**
 * The newest writing on GameLog, a page at a time — Search's "Latest reviews".
 *
 * Anything with writing in it (a review or its one sentence), newest first by
 * `created_at`, the time the review card prints: ordered by anything else, a
 * "3w" would sit at the top of a list called latest. `before` is the last
 * card's `created_at`, so a review written while somebody scrolls cannot push
 * one they have already seen down onto the next page twice.
 *
 * **In the languages the reader reads**, unlabelled reviews always kept — the
 * rule for every list the app picks for somebody, said under its heading by
 * `<ReadingNote>` (CLAUDE.md § Discovery). Two `.or()`s on one request are
 * ANDed, verified live. A database without 0038's `review_lang` answers 42703,
 * and the list is then every language, as it could only be.
 */
export async function getLatestReviews({
  before = null,
  limit = LATEST_PAGE,
  reading,
}: {
  before?: string | null;
  limit?: number;
  reading: readonly string[] | null;
}): Promise<LogWithRelations[]> {
  const ask = (languages: readonly string[] | null) => {
    let query = supabase
      .from('logs')
      .select(LOG_WITH_RELATIONS)
      .or(HAS_WRITING)
      .order('created_at', { ascending: false })
      .limit(limit);
    if (before) query = query.lt('created_at', before);
    if (languages) query = query.or(`review_lang.is.null,review_lang.in.${inList(languages)}`);
    return query;
  };

  let { data, error } = await ask(reading);
  if (error && reading && isUnknownColumn(error)) ({ data, error } = await ask(null));
  return rememberLogs(unwrap(data as LogWithRelations[] | null, error));
}

/** Longest review query worth sending. A search term is not a paragraph. */
const REVIEW_QUERY_MAX = 60;

/** How many rows each of the three filters may bring back, and how many are kept. */
const REVIEW_SEARCH_LIMIT = 40;

/**
 * Reviews by a typed word, for Search: the game a review is about, its
 * headline, or something it says.
 *
 * ## Three filters, three requests
 *
 * For the reason `searchProfiles` is two: PostgREST's `or=(…)` puts the user's
 * text inside its own filter grammar, where a comma or a parenthesis breaks the
 * tree and the search comes back as a 400. A single `.ilike()` sends its
 * pattern as one opaque value. The game's title is matched on the embedded row,
 * which only narrows the *logs* because the embed is `!inner` — without it the
 * filter empties the `game` field and returns every review regardless.
 *
 * ## Ranked here
 *
 * Relevance is not a column. A review *of* the game named leads, then one whose
 * headline holds the term, then one that merely says the word; newest first
 * inside each. Only logs with writing in them: a bare score is not a review.
 */
export async function searchReviews(
  query: string,
  signal?: AbortSignal
): Promise<LogWithRelations[]> {
  const trimmed = query.trim().slice(0, REVIEW_QUERY_MAX);
  if (!trimmed) return [];

  const pattern = `%${likeLiteral(trimmed)}%`;

  const byGame = supabase
    .from('logs')
    .select('*, game:games!inner(*), profile:profiles(*)')
    .or(HAS_WRITING)
    .ilike('game.title', pattern)
    .order('created_at', { ascending: false })
    .limit(REVIEW_SEARCH_LIMIT);
  const byHeadline = supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .ilike('review_title', pattern)
    .order('created_at', { ascending: false })
    .limit(REVIEW_SEARCH_LIMIT);
  const byWords = supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .ilike('review', pattern)
    .order('created_at', { ascending: false })
    .limit(REVIEW_SEARCH_LIMIT);

  const [game, headline, words] = await Promise.all([
    signal ? byGame.abortSignal(signal) : byGame,
    signal ? byHeadline.abortSignal(signal) : byHeadline,
    signal ? byWords.abortSignal(signal) : byWords,
  ]);

  /* In rank order, so the first sighting of a review is its best one. */
  const bands = [
    rememberLogs(unwrap(game.data as LogWithRelations[] | null, game.error)),
    rememberLogs(unwrap(headline.data as LogWithRelations[] | null, headline.error)),
    rememberLogs(unwrap(words.data as LogWithRelations[] | null, words.error)),
  ];

  const seen = new Set<string>();
  const found: LogWithRelations[] = [];
  for (const band of bands) {
    for (const log of band) {
      if (seen.has(log.id) || !(log.review ?? '').trim()) continue;
      seen.add(log.id);
      found.push(log);
    }
  }
  return found.slice(0, REVIEW_SEARCH_LIMIT);
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
 * `likes` is what ranks it, `likedByViewer` is what the like button reads, and
 * `comments` is what the game page's card prints beside the score — one more
 * tally from the batch that counts the likes.
 */
export type TopReview = {
  log: LogWithRelations;
  likes: number;
  comments: number;
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
 *
 * ## For a reader
 *
 * With `reading`, it is the most liked review **this reader can read** — and
 * the most liked outright when they can read none of them (`leadReview`): one
 * slot, one review, and the best one in Japanese is not the best one to show
 * somebody who reads English and Spanish. An unlabelled review counts as
 * readable. Nothing is hidden by this; the reviews sheet lists them all.
 */
export async function getTopGameReview(
  gameId: string,
  viewerId: string | null,
  reading: readonly string[] | null = null
): Promise<TopReview | null> {
  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .eq('game_id', gameId)
    /* A score alone is not a review — this block prints words, and an empty
       card under someone's name reads as a loading failure. The words may be
       the review's one sentence (0040). */
    .or(HAS_WRITING)
    .order('created_at', { ascending: false })
    .limit(RANKED_REVIEWS);

  if (error) throw new Error(error.message);

  const reviews = rememberLogs((data as LogWithRelations[] | null) ?? []);
  const written = reviews.filter(hasWriting);
  if (written.length === 0) return null;

  const engagement = await getEngagement(
    'log',
    written.map((log) => log.id),
    viewerId
  );

  /* Most liked first. The rows arrive newest-first and the sort is stable, so
     the more recent of a tie stays ahead. */
  const ranked = [...written].sort(
    (a, b) => (engagement[b.id]?.likes ?? 0) - (engagement[a.id]?.likes ?? 0)
  );
  const best = leadReview(ranked, (log) => log.review_lang, reading) ?? ranked[0];

  return {
    log: best,
    likes: engagement[best.id]?.likes ?? 0,
    comments: engagement[best.id]?.comments ?? 0,
    likedByViewer: engagement[best.id]?.likedByViewer ?? false,
  };
}

/* -------------------------------------------------------------------------
 * The reviews sheet
 * ---------------------------------------------------------------------- */

/** How the review list is ordered. Filters are separate; see `lib/review-facets`. */
export type ReviewSort = 'popular' | 'newest' | 'week' | 'month';

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

/** Reviews on one page of the reviews sheet — the owner's fifteen (2026-10-20). */
export const REVIEW_PAGE_SIZE = 15;

/**
 * The most reviews the sheet ranks: a thousand, which is sixty-seven pages.
 *
 * Popularity is ranked here — PostgREST cannot order a resource by a count
 * over `likes`, which has no foreign key to `logs` (it is polymorphic) — so
 * this is the ceiling on the ranking. It is a column of ids, ~40 KB at the
 * ceiling, and the live project has under fifty reviews in all.
 */
const REVIEW_RANKING_CEILING = 1000;

/** Ids a request asks `likes` about at once: a hundred UUIDs is a 4 KB URL. */
const LIKE_CHUNK = 100;

/** Days in each windowed sort. `popular` and `newest` are unwindowed. */
const WINDOW_DAYS: Partial<Record<ReviewSort, number>> = { week: 7, month: 30 };

/**
 * Every review of a game that the sheet's sort and filters admit, as ids, in
 * the order the sheet shows them. The pages are slices of this
 * (`getGameReviewPage`), so the count — "Page 3 of 8 · 112 reviews" — is
 * exact and turning a page is one small request.
 *
 * ## Why the ordering happens here and not in SQL
 *
 * Three of the four sorts rank by like count, and PostgREST cannot order a
 * resource by an aggregate over an embedded one — the same limitation 0013's
 * five functions exist to work around. So Postgres does what it is good at
 * (filtering, windowing, limiting) on a request for ids alone, and the
 * ranking happens over them: one more request for every hundred reviews, for
 * their likes. A like row is a target and a person, so a hundred reviews with
 * more than Supabase's 1,000-row response ceiling of likes between them would
 * be ranked on the first thousand; nothing here is near it.
 *
 * Most liked first, newest first among equals — the rule `popular_reviews`
 * uses in 0013. `newest` is the request's own order.
 *
 * ## What "this week" means
 *
 * Reviews *written* in the last seven days, ordered by likes — not reviews that
 * collected likes this week. The second reading needs a date filter on the likes
 * themselves, which would rank a two-year-old review as this week's most popular
 * because it got three likes on Tuesday. What a reader wants from "this week" is
 * what is new and landing well.
 *
 * ## Filters
 *
 * Every filter is a clause on this one request (`reviewFilterClauses`), so they
 * compose — PC + Finished + Co-op — and only matching rows come back. What each
 * one *means* lives in `lib/review-facets.ts`; this only spells it in PostgREST.
 */
export async function getGameReviewRanking(
  gameId: string,
  sort: ReviewSort,
  filters: ReviewFilters
): Promise<string[]> {
  let query = supabase.from('logs').select('id').eq('game_id', gameId).or(HAS_WRITING);

  const days = WINDOW_DAYS[sort];
  if (days) {
    const since = new Date(Date.now() - days * 24 * 60 * 60_000).toISOString();
    query = query.gte('created_at', since);
  }

  for (const clause of reviewFilterClauses(filters)) {
    switch (clause.kind) {
      case 'platform':
        // A family nobody has reviewed on has nothing to find.
        if (clause.values.length === 0) return [];
        // `inList`, not `.in()`: these are strings people typed. See `inList`.
        query = query.filter('played_on', 'in', inList(clause.values));
        break;
      case 'status':
        query = query.in('status', clause.values);
        break;
      case 'completion':
        query = query.or(`completion.in.(${clause.levels.join(',')}),platinum.is.true`);
        break;
      case 'flag':
        query = query.eq(clause.column, clause.value);
        break;
      case 'score':
        query =
          clause.bound === 'min'
            ? query.gte('rating', clause.value)
            : query.lte('rating', clause.value);
        break;
      case 'language':
        query = query.eq('review_lang', clause.value);
        break;
    }
  }

  const { data, error } = await query
    .order('created_at', { ascending: false })
    .order('id', { ascending: true })
    .limit(REVIEW_RANKING_CEILING);
  if (error) throw new Error(error.message);

  const ids = (data ?? []).map((row) => row.id);
  if (sort === 'newest' || ids.length === 0) return ids;

  const likes = await likeCounts(ids);
  /* A stable sort over rows that arrived newest first, so recency breaks ties. */
  return ids
    .map((id, index) => ({ id, index, likes: likes.get(id) ?? 0 }))
    .sort((a, b) => b.likes - a.likes || a.index - b.index)
    .map((entry) => entry.id);
}

/** How many likes each of these reviews has, a hundred ids a request. */
async function likeCounts(logIds: string[]): Promise<Map<string, number>> {
  const chunks: string[][] = [];
  for (let start = 0; start < logIds.length; start += LIKE_CHUNK) {
    chunks.push(logIds.slice(start, start + LIKE_CHUNK));
  }

  const answers = await Promise.all(
    chunks.map((chunk) =>
      supabase.from('likes').select('target_id').eq('target_type', 'log').in('target_id', chunk)
    )
  );

  const counts = new Map<string, number>();
  for (const { data, error } of answers) {
    if (error) throw new Error(error.message);
    for (const row of data ?? []) {
      counts.set(row.target_id, (counts.get(row.target_id) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * One page of the sheet: the reviews with these ids, whole, in this order,
 * with their likes and replies.
 *
 * The rows are the complete record (`LOG_WITH_RELATIONS`), so each is kept for
 * the review page it opens (`rememberLogs`). A review deleted between the
 * ranking and the page is simply not there; the page is one short until the
 * ranking is next asked for.
 */
export async function getGameReviewPage(
  ids: readonly string[],
  viewerId: string | null
): Promise<ReviewListItem[]> {
  if (ids.length === 0) return [];

  const { data, error } = await supabase
    .from('logs')
    .select(LOG_WITH_RELATIONS)
    .in('id', [...ids]);
  if (error) throw new Error(error.message);

  const byId = new Map(
    rememberLogs((data as LogWithRelations[] | null) ?? [])
      .filter(hasWriting)
      .map((log) => [log.id, log])
  );
  const written = ids.flatMap((id) => {
    const log = byId.get(id);
    return log ? [log] : [];
  });
  if (written.length === 0) return [];

  const engagement = await getEngagement(
    'log',
    written.map((log) => log.id),
    viewerId
  );

  return written.map((log) => ({
    log,
    likes: engagement[log.id]?.likes ?? 0,
    comments: engagement[log.id]?.comments ?? 0,
    likedByViewer: engagement[log.id]?.likedByViewer ?? false,
  }));
}

/** PostgREST's and Postgres's codes for a column the database does not have. */
function isUnknownColumn(error: { code?: string }): boolean {
  return error.code === '42703' || error.code === 'PGRST204';
}

/**
 * The language of every labelled review of a game (0038) — one code a review,
 * so the reviews sheet can offer the languages there are and say how many.
 *
 * A column of two-letter codes and nothing else; a game with a thousand
 * reviews is a few kilobytes. Empty on a database that has not run 0038, where
 * no review has a label to filter by.
 */
export async function getReviewLanguages(gameId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('review_lang')
    .eq('game_id', gameId)
    .not('review', 'is', null)
    .not('review_lang', 'is', null)
    .limit(1000);

  if (error) {
    if (isUnknownColumn(error)) return [];
    throw new Error(error.message);
  }
  return (data ?? []).flatMap((row) => (row.review_lang ? [row.review_lang] : []));
}

/**
 * The languages one person has written reviews in (0038), each once — what
 * they evidently read, whatever their phone is set to.
 *
 * Their newest two hundred labelled reviews: a language somebody last wrote in
 * two hundred reviews ago is one they can add by hand. Empty before 0038.
 */
export async function getWrittenLanguages(userId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('logs')
    .select('review_lang')
    .eq('user_id', userId)
    /* A label counts while the review it labels is there. */
    .not('review', 'is', null)
    .not('review_lang', 'is', null)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    if (isUnknownColumn(error)) return [];
    throw new Error(error.message);
  }
  return [...new Set((data ?? []).flatMap((row) => (row.review_lang ? [row.review_lang] : [])))];
}

/**
 * One game's ratings, tallied by how they were played — plus the platforms the
 * review list can be filtered to (0026).
 *
 * One aggregate on the server, so a game with thousands of ratings costs a few
 * hundred bytes. It replaced a read of every review's `played_on` just to find
 * the handful of distinct values the platform filter offers.
 */
export async function getReviewStats(gameId: string): Promise<GameReviewStats> {
  const { data, error } = await supabase.rpc('game_review_stats', { p_game: gameId });
  return unwrap(data, error);
}

/**
 * One person's collection, summarised on the server (0028): logs, reviews,
 * scores, the best and worst of them, and the physical / digital split. Exact
 * whatever the library's size — `getUserLogs` stops at a hundred rows.
 */
export async function getUserGameStats(userId: string): Promise<UserGameStats> {
  const { data, error } = await supabase.rpc('user_game_stats', { p_user: userId });
  return unwrap(data, error);
}
