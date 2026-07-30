import type {
  CachedGame,
  GameLog,
  ListKind,
  NotificationKind,
  PostKind,
  PostRow,
  Profile,
} from '../database.types';

/** What likes and comments can attach to. */
export type TargetType = 'post' | 'log';

/*
 * These mirror database enums, so they are re-exported rather than restated.
 * Declaring them here as well shadowed the real definitions through the
 * `@/lib/api` barrel, which silently stripped the friend/wall notification
 * kinds added in 0005.
 */
export type { ListKind, NotificationKind, PostKind };

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C', 'D', 'F'];

export type PostMedia = {
  id: string;
  post_id: string;
  url: string;
  kind: 'image' | 'video';
  width: number | null;
  height: number | null;
  position: number;
};

/*
 * Aliased rather than restated. An earlier hand-written copy of this shape
 * silently dropped columns added by later migrations (title, tags,
 * has_spoilers) because it shadowed the real row type through the barrel.
 */
export type Post = PostRow;

export type PostWithRelations = Post & {
  profile: Profile | null;
  game: CachedGame | null;
  media: PostMedia[];
};

export type Comment = {
  id: string;
  user_id: string;
  target_type: TargetType;
  target_id: string;
  body: string;
  parent_id: string | null;
  created_at: string;
};

export type CommentWithAuthor = Comment & { profile: Profile | null };

/** Like count plus whether the viewer is one of them. */
export type Engagement = {
  likes: number;
  comments: number;
  likedByViewer: boolean;
};

export type GameList = {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  kind: ListKind;
  is_ranked: boolean;
  /** Free-form author labels shown on the Collection header. */
  tags: string[] | null;
  created_at: string;
  updated_at: string;
};

export type ListItem = {
  list_id: string;
  game_id: string;
  position: number;
  tier: Tier | null;
  note: string | null;
  added_at: string;
  game: CachedGame | null;
};

export type ListWithItems = GameList & { items: ListItem[] };

/** A list plus just enough covers to render a collage tile. */
export type ListSummary = GameList & {
  itemCount: number;
  covers: { cover_url: string | null; hero_url: string | null }[];
};

export type AppNotification = {
  id: string;
  user_id: string;
  actor_id: string;
  kind: NotificationKind;
  target_type: TargetType | null;
  target_id: string | null;
  read: boolean;
  created_at: string;
  actor: Profile | null;
};

/**
 * The home feed mixes two different things. A discriminated union keeps the
 * renderer honest about which fields exist.
 */
export type FeedItem =
  | { type: 'post'; id: string; createdAt: string; post: PostWithRelations }
  | {
      type: 'log';
      id: string;
      createdAt: string;
      log: GameLog & { game: CachedGame | null; profile: Profile | null };
    };
