/**
 * Types mirroring supabase/migrations/*.sql.
 *
 * Hand-written on purpose: generating these needs the Supabase CLI pointed at a
 * live project, which does not exist until you run the migrations. Once it does,
 * you can replace this file wholesale with:
 *
 *   npx supabase gen types typescript --project-id <ref> > src/lib/database.types.ts
 *
 * If you edit the SQL, edit this too — nothing enforces that they agree.
 */

export type LogStatus = 'playing' | 'played' | 'backlog' | 'dropped';

export type Profile = {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bio: string | null;
  favorite_platform: string | null;
  location: string | null;
  /** SteamID64, set by the user to enable achievement sync. */
  steam_id: string | null;
  created_at: string;
};

export type CachedGame = {
  id: string;
  source: string;
  source_id: string;
  title: string;
  /** Portrait box art. */
  cover_url: string | null;
  /** Landscape key art. */
  hero_url: string | null;
  description: string | null;
  release_date: string | null;
  release_year: number | null;
  developer: string | null;
  publisher: string | null;
  genres: string[] | null;
  platforms: string[] | null;
  screenshots: string[] | null;
  score: number | null;
  store_url: string | null;
  cached_at: string;
};

export type GameLog = {
  id: string;
  user_id: string;
  game_id: string;
  status: LogStatus;
  /** 0-100 score, or null when unscored. See constants/score.ts for labels. */
  rating: number | null;
  /** Headline for a long-form review. Null for a score with no article. */
  review_title: string | null;
  review: string | null;
  /**
   * Per-category scores when the reviewer opted into advanced metrics; null when
   * they scored with the bar. When set, `rating` is their mean — the client
   * writes both together and `rating` stays the only score anything else reads.
   */
  review_metrics: ReviewMetrics | null;
  completion_percent: number | null;
  platinum: boolean;
  hours_played: number | null;
  played_on: string | null;
  created_at: string;
  updated_at: string;
};

export type Follow = {
  follower_id: string;
  following_id: string;
  created_at: string;
};

export type GameAchievementRow = {
  id: string;
  game_id: string;
  external_id: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  global_percent: number | null;
  hidden: boolean;
  cached_at: string;
};

export type UserAchievementRow = {
  user_id: string;
  achievement_id: string;
  unlocked_at: string;
  /** True when pulled from Steam rather than ticked by hand. */
  synced: boolean;
};

export type ProfileAchievementStats = {
  user_id: string;
  achievements_unlocked: number;
  platinums: number;
  completions: number;
  hours_played: number;
};

// --- 0003_social.sql --------------------------------------------------------

export type PostKind = 'post' | 'recommendation' | 'screenshot' | 'question' | 'article';
export type ListKind = 'list' | 'favorites' | 'tier' | 'wishlist';
export type NotificationKind =
  'like' | 'comment' | 'follow' | 'reply' | 'friend_request' | 'friend_accepted' | 'wall_post';

// --- 0005_friends_and_wall.sql ----------------------------------------------

export type FriendshipStatus = 'pending' | 'accepted';

/**
 * One row per pair, stored with `user_a < user_b`. Never construct these by
 * hand — use the helpers in lib/api/friends.ts, which handle the ordering.
 */
export type FriendshipRow = {
  user_a: string;
  user_b: string;
  requested_by: string;
  status: FriendshipStatus;
  created_at: string;
  responded_at: string | null;
};

export type WallPostRow = {
  id: string;
  wall_owner_id: string;
  author_id: string;
  body: string;
  created_at: string;
};

// --- 0007_events_and_articles.sql -------------------------------------------

export type AttendanceMode = 'livestream' | 'in_person';

/** Closed vocabulary — see the CHECK constraint on posts.tags. */
export type ArticleTag =
  | 'guide'
  | 'discussion'
  | 'game-theory'
  | 'retrospective'
  | 'why-you-should-play'
  | 'review'
  | 'news'
  | 'opinion'
  | 'tier-list';

export type EventRow = {
  id: string;
  source: string;
  source_id: string;
  name: string;
  description: string | null;
  starts_at: string | null;
  live_stream_url: string | null;
  has_venue: boolean;
  cached_at: string;
};

export type EventAttendanceRow = {
  event_id: string;
  user_id: string;
  mode: AttendanceMode;
  /** Set when a local reminder is scheduled on the user's device. */
  reminder_at: string | null;
  created_at: string;
};
// --- 0008_review_metrics.sql ------------------------------------------------

/** Closed vocabulary — see the CHECK constraint on logs.review_metrics. */
export type ReviewMetricKey =
  | 'personal-enjoyment'
  | 'genre-execution'
  | 'innovation'
  | 'gameplay'
  | 'content'
  | 'replayability'
  | 'narrative'
  | 'difficulty'
  | 'art-direction'
  | 'cinematography'
  | 'soundtrack'
  | 'level-design'
  | 'audio-design'
  | 'voice-acting';

/** Scores 0-100 by metric. An absent key means that metric was not scored. */
export type ReviewMetrics = Partial<Record<ReviewMetricKey, number>>;

/**
 * What a like or a comment points at.
 *
 * `list` is likes-only — collections are likeable but not commentable, and the
 * CHECK on `comments.target_type` still allows only the first two. Keeping one
 * union means a comment call with a list id is a *runtime* rejection rather
 * than a compile error; `LIKE_ONLY_TARGETS` below is the reminder.
 */
export type TargetType = 'post' | 'log' | 'list';

/** Target types that accept likes but not comments. */
export const LIKE_ONLY_TARGETS: readonly TargetType[] = ['list'];

export type PostRow = {
  id: string;
  user_id: string;
  body: string;
  kind: PostKind;
  game_id: string | null;
  /** Required for articles, null for short posts. */
  title: string | null;
  tags: ArticleTag[] | null;
  /** Blurs the body in previews until the reader opts in. */
  has_spoilers: boolean;
  created_at: string;
  updated_at: string;
};

export type PostMediaRow = {
  id: string;
  post_id: string;
  url: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  position: number;
};

export type LikeRow = {
  user_id: string;
  target_type: TargetType;
  target_id: string;
  created_at: string;
};

export type CommentRow = {
  id: string;
  user_id: string;
  target_type: TargetType;
  target_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export type ListRow = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  kind: ListKind;
  is_ranked: boolean;
  /** Free-form author labels shown on the Collection header. Max 12. */
  tags: string[] | null;
  /**
   * Game whose cover represents the collection on a tile.
   *
   * Null means the owner has not chosen one, and the tile falls back to the
   * first item. A trigger (0014) nulls this when the game leaves the list, so
   * it can never point at something the collection no longer holds.
   */
  cover_game_id: string | null;
  created_at: string;
  updated_at: string;
};

export type ListItemRow = {
  list_id: string;
  game_id: string;
  position: number;
  tier: 'S' | 'A' | 'B' | 'C' | 'D' | 'F' | null;
  note: string | null;
  added_at: string;
};

export type NotificationRow = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_type: TargetType | null;
  target_id: string | null;
  read: boolean;
  created_at: string;
};

// --- 0011_diary.sql ---------------------------------------------------------

export type DiaryEntryRow = {
  id: string;
  user_id: string;
  game_id: string;
  body: string;
  /** The day the entry is about, which may predate created_at. */
  entry_date: string;
  created_at: string;
  updated_at: string;
};

// --- 0012_starred_song.sql --------------------------------------------------

/**
 * One pinned track per profile. `user_id` is the primary key, which is what
 * enforces the limit of one — see the migration.
 */
export type StarredSongRow = {
  user_id: string;
  /** iTunes track id. Not a foreign key: soundtracks are not in `games`. */
  track_id: string;
  title: string;
  artist: string;
  artwork_url: string | null;
  /** 30-second AAC clip; null when iTunes has no preview for the track. */
  preview_url: string | null;
  game_id: string | null;
  game_title: string | null;
  created_at: string;
  updated_at: string;
};

// --- 0009_gaming_accounts.sql -----------------------------------------------

/** Closed vocabulary — see gaming_providers() in migration 0009. */
export type GamingProvider =
  'steam' | 'xbox' | 'playstation' | 'epic' | 'gog' | 'battlenet' | 'riot' | 'ubisoft';

export type GamingVisibility = 'public' | 'friends' | 'private' | 'unknown';

export type GamingSyncSection =
  'profile' | 'library' | 'achievements' | 'inventory' | 'badges' | 'friends';

export type GamingSyncStatus = 'idle' | 'syncing' | 'ok' | 'partial' | 'private' | 'error';

export type GamingAccountRow = {
  user_id: string;
  provider: GamingProvider;
  /** SteamID64 for Steam. Written only by the steam-auth Edge Function. */
  external_id: string;
  handle: string | null;
  display_name: string | null;
  avatar_url: string | null;
  profile_url: string | null;
  country: string | null;
  level: number | null;
  xp: number | null;
  visibility: GamingVisibility;
  status: string;
  current_game_app_id: string | null;
  current_game_name: string | null;
  linked_at: string;
  last_synced_at: string | null;
};

export type GamingOwnedGameRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  name: string;
  icon_url: string | null;
  playtime_minutes: number;
  playtime_recent_minutes: number;
  last_played_at: string | null;
  achievements_total: number | null;
  achievements_unlocked: number | null;
  achievements_synced_at: string | null;
  /** Null for Steam — its Web API exposes no purchase date. */
  acquired_at: string | null;
  game_id: string | null;
  synced_at: string;
};

export type GamingAchievementRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  achievement_key: string;
  name: string;
  description: string | null;
  icon_url: string | null;
  icon_gray_url: string | null;
  unlocked: boolean;
  unlocked_at: string | null;
  global_percent: number | null;
  synced_at: string;
};

export type GamingInventoryItemRow = {
  user_id: string;
  provider: GamingProvider;
  app_id: string;
  item_id: string;
  name: string;
  type: string | null;
  icon_url: string | null;
  rarity: string | null;
  /** Provider's own hex, without '#'. */
  rarity_color: string | null;
  amount: number;
  tradable: boolean;
  marketable: boolean;
  /** The single join key a future pricing integration would need. */
  market_hash_name: string | null;
  feature_rank: number | null;
  synced_at: string;
};

export type GamingBadgeRow = {
  user_id: string;
  provider: GamingProvider;
  badge_key: string;
  name: string | null;
  icon_url: string | null;
  level: number | null;
  xp: number | null;
  earned_at: string | null;
  is_years_of_service: boolean;
  synced_at: string;
};

export type GamingProviderFriendRow = {
  user_id: string;
  provider: GamingProvider;
  friend_external_id: string;
  friend_handle: string | null;
  friend_avatar_url: string | null;
  friends_since: string | null;
  /** Non-null when this provider friend also uses GameLog. */
  matched_user_id: string | null;
  synced_at: string;
};

export type GamingSyncStateRow = {
  user_id: string;
  provider: GamingProvider;
  section: GamingSyncSection;
  status: GamingSyncStatus;
  last_run_at: string | null;
  last_success_at: string | null;
  next_run_after: string | null;
  cursor: string | null;
  attempts: number;
  error: string | null;
};

/** Rollup view. Numeric aggregates arrive as strings over PostgREST. */
export type GamingProfileStatsRow = {
  user_id: string;
  provider: GamingProvider;
  games_owned: number;
  total_playtime_minutes: number;
  achievements_unlocked: number;
  achievements_total: number;
  perfect_games: number;
  avg_playtime_minutes: number;
};

type Insert<T, Optional extends keyof T> = Omit<T, Optional> & Partial<Pick<T, Optional>>;

/**
 * Shorthand for one foreign key in a table's `Relationships` tuple.
 *
 * supabase-js reads these to type embedded selects like
 * `select('*, profile:profiles(*)')`. An empty `Relationships: []` makes every
 * such embed resolve to `SelectQueryError` instead of the joined row, so each
 * FK that the app actually embeds across has to be declared here.
 */
type FK<
  Name extends string,
  Column extends string,
  Relation extends string,
  Referenced extends string,
> = {
  foreignKeyName: Name;
  columns: [Column];
  isOneToOne: false;
  referencedRelation: Relation;
  referencedColumns: [Referenced];
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: Insert<
          Profile,
          | 'created_at'
          | 'display_name'
          | 'avatar_url'
          | 'banner_url'
          | 'bio'
          | 'favorite_platform'
          | 'location'
          | 'steam_id'
        >;
        Update: Partial<Profile>;
        Relationships: [];
      };
      games: {
        Row: CachedGame;
        Insert: Insert<CachedGame, 'cached_at'>;
        Update: Partial<CachedGame>;
        Relationships: [];
      };
      logs: {
        Row: GameLog;
        Insert: Insert<
          GameLog,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'rating'
          | 'review'
          | 'review_title'
          | 'review_metrics'
          | 'completion_percent'
          | 'platinum'
          | 'hours_played'
          | 'played_on'
        >;
        Update: Partial<GameLog>;
        Relationships: [
          FK<'logs_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'logs_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      follows: {
        Row: Follow;
        Insert: Insert<Follow, 'created_at'>;
        Update: Partial<Follow>;
        Relationships: [
          FK<'follows_follower_id_fkey', 'follower_id', 'profiles', 'id'>,
          FK<'follows_following_id_fkey', 'following_id', 'profiles', 'id'>,
        ];
      };
      game_achievements: {
        Row: GameAchievementRow;
        Insert: Insert<
          GameAchievementRow,
          'cached_at' | 'description' | 'icon_url' | 'global_percent' | 'hidden'
        >;
        Update: Partial<GameAchievementRow>;
        Relationships: [];
      };
      user_achievements: {
        Row: UserAchievementRow;
        Insert: Insert<UserAchievementRow, 'unlocked_at' | 'synced'>;
        Update: Partial<UserAchievementRow>;
        Relationships: [];
      };
      posts: {
        Row: PostRow;
        Insert: Insert<
          PostRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'kind'
          | 'game_id'
          | 'title'
          | 'tags'
          | 'has_spoilers'
        >;
        Update: Partial<PostRow>;
        Relationships: [
          FK<'posts_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'posts_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      post_media: {
        Row: PostMediaRow;
        Insert: Insert<PostMediaRow, 'id' | 'kind' | 'width' | 'height' | 'position'>;
        Update: Partial<PostMediaRow>;
        Relationships: [FK<'post_media_post_id_fkey', 'post_id', 'posts', 'id'>];
      };
      likes: {
        Row: LikeRow;
        Insert: Insert<LikeRow, 'created_at'>;
        Update: Partial<LikeRow>;
        Relationships: [FK<'likes_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      comments: {
        Row: CommentRow;
        Insert: Insert<CommentRow, 'id' | 'created_at' | 'parent_id'>;
        Update: Partial<CommentRow>;
        Relationships: [FK<'comments_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      lists: {
        Row: ListRow;
        Insert: Insert<
          ListRow,
          | 'id'
          | 'created_at'
          | 'updated_at'
          | 'description'
          | 'kind'
          | 'is_ranked'
          | 'tags'
          | 'cover_game_id'
        >;
        Update: Partial<ListRow>;
        Relationships: [
          FK<'lists_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'lists_cover_game_id_fkey', 'cover_game_id', 'games', 'id'>,
        ];
      };
      list_items: {
        Row: ListItemRow;
        Insert: Insert<ListItemRow, 'added_at' | 'position' | 'tier' | 'note'>;
        Update: Partial<ListItemRow>;
        Relationships: [
          FK<'list_items_list_id_fkey', 'list_id', 'lists', 'id'>,
          FK<'list_items_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      friendships: {
        Row: FriendshipRow;
        Insert: Insert<FriendshipRow, 'created_at' | 'responded_at' | 'status'>;
        Update: Partial<FriendshipRow>;
        Relationships: [
          FK<'friendships_user_a_fkey', 'user_a', 'profiles', 'id'>,
          FK<'friendships_user_b_fkey', 'user_b', 'profiles', 'id'>,
          FK<'friendships_requested_by_fkey', 'requested_by', 'profiles', 'id'>,
        ];
      };
      events: {
        Row: EventRow;
        Insert: Insert<
          EventRow,
          'cached_at' | 'source' | 'description' | 'starts_at' | 'live_stream_url' | 'has_venue'
        >;
        Update: Partial<EventRow>;
        Relationships: [];
      };
      event_attendance: {
        Row: EventAttendanceRow;
        Insert: Insert<EventAttendanceRow, 'created_at' | 'mode' | 'reminder_at'>;
        Update: Partial<EventAttendanceRow>;
        Relationships: [
          FK<'event_attendance_event_id_fkey', 'event_id', 'events', 'id'>,
          FK<'event_attendance_user_id_fkey', 'user_id', 'profiles', 'id'>,
        ];
      };
      wall_posts: {
        Row: WallPostRow;
        Insert: Insert<WallPostRow, 'id' | 'created_at'>;
        Update: Partial<WallPostRow>;
        Relationships: [
          FK<'wall_posts_wall_owner_id_fkey', 'wall_owner_id', 'profiles', 'id'>,
          FK<'wall_posts_author_id_fkey', 'author_id', 'profiles', 'id'>,
        ];
      };
      notifications: {
        Row: NotificationRow;
        Insert: Insert<NotificationRow, 'id' | 'created_at' | 'read' | 'target_type' | 'target_id'>;
        Update: Partial<NotificationRow>;
        Relationships: [
          FK<'notifications_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'notifications_actor_id_fkey', 'actor_id', 'profiles', 'id'>,
        ];
      };
      diary_entries: {
        Row: DiaryEntryRow;
        Insert: Insert<DiaryEntryRow, 'id' | 'created_at' | 'updated_at' | 'entry_date'>;
        Update: Partial<DiaryEntryRow>;
        Relationships: [
          FK<'diary_entries_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'diary_entries_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      starred_songs: {
        Row: StarredSongRow;
        Insert: Insert<StarredSongRow, 'created_at' | 'updated_at'>;
        Update: Partial<StarredSongRow>;
        Relationships: [
          FK<'starred_songs_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'starred_songs_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      // --- 0009 linked gaming accounts ---------------------------------------
      // No Insert/Update reaches these from the client: they have no INSERT or
      // UPDATE policies, because `external_id` is only trustworthy when the
      // server verified it. Writes happen in the Edge Functions with the service
      // role. The types stay accurate so the *unlink* path still typechecks.
      gaming_accounts: {
        Row: GamingAccountRow;
        Insert: Insert<GamingAccountRow, 'linked_at' | 'last_synced_at'>;
        Update: Partial<GamingAccountRow>;
        Relationships: [FK<'gaming_accounts_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_owned_games: {
        Row: GamingOwnedGameRow;
        Insert: Insert<GamingOwnedGameRow, 'synced_at'>;
        Update: Partial<GamingOwnedGameRow>;
        Relationships: [
          FK<'gaming_owned_games_user_id_fkey', 'user_id', 'profiles', 'id'>,
          FK<'gaming_owned_games_game_id_fkey', 'game_id', 'games', 'id'>,
        ];
      };
      gaming_achievements: {
        Row: GamingAchievementRow;
        Insert: Insert<GamingAchievementRow, 'synced_at'>;
        Update: Partial<GamingAchievementRow>;
        Relationships: [FK<'gaming_achievements_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_inventory_items: {
        Row: GamingInventoryItemRow;
        Insert: Insert<GamingInventoryItemRow, 'synced_at'>;
        Update: Partial<GamingInventoryItemRow>;
        Relationships: [FK<'gaming_inventory_items_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_badges: {
        Row: GamingBadgeRow;
        Insert: Insert<GamingBadgeRow, 'synced_at'>;
        Update: Partial<GamingBadgeRow>;
        Relationships: [FK<'gaming_badges_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
      gaming_provider_friends: {
        Row: GamingProviderFriendRow;
        Insert: Insert<GamingProviderFriendRow, 'synced_at'>;
        Update: Partial<GamingProviderFriendRow>;
        Relationships: [
          FK<'gaming_provider_friends_user_id_fkey', 'user_id', 'profiles', 'id'>,
          // The embed the "friends already on GameLog" list depends on.
          FK<'gaming_provider_friends_matched_user_id_fkey', 'matched_user_id', 'profiles', 'id'>,
        ];
      };
      gaming_sync_state: {
        Row: GamingSyncStateRow;
        Insert: Insert<GamingSyncStateRow, 'attempts'>;
        Update: Partial<GamingSyncStateRow>;
        Relationships: [FK<'gaming_sync_state_user_id_fkey', 'user_id', 'profiles', 'id'>];
      };
    };
    Views: {
      profile_achievement_stats: {
        Row: ProfileAchievementStats;
        Relationships: [];
      };
      gaming_profile_stats: {
        Row: GamingProfileStatsRow;
        Relationships: [];
      };
    };
    /*
     * The discovery functions from 0013. PostgREST cannot order a resource by
     * an aggregate over an embedded one, so "most-liked collections" has to be
     * a function; each returns ids plus a ranking number and the client
     * re-selects the rows it already knows how to select.
     */
    Functions: {
      popular_reviews: {
        Args: { p_limit?: number };
        Returns: { log_id: string; like_count: number }[];
      };
      popular_collections: {
        Args: { p_limit?: number };
        Returns: { list_id: string; like_count: number; item_count: number }[];
      };
      top_reviewers: {
        Args: { p_limit?: number };
        Returns: { user_id: string; review_count: number }[];
      };
      popular_users: {
        Args: { p_limit?: number };
        Returns: { user_id: string; like_count: number }[];
      };
      recommended_users: {
        Args: { p_viewer: string; p_limit?: number };
        Returns: { user_id: string; shared_games: number; affinity: number }[];
      };
    };
    Enums: { log_status: LogStatus };
    CompositeTypes: Record<never, never>;
  };
};

/** A log joined with its game and author — what the feed and profile render. */
export type LogWithRelations = GameLog & {
  game: CachedGame | null;
  profile: Profile | null;
};

/** An achievement definition joined with whether the viewed user has it. */
export type AchievementWithUnlock = GameAchievementRow & {
  unlocked_at: string | null;
};
