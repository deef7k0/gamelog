import type {
  CachedGame,
  GameLog,
  ListKind,
  ListRow,
  NotificationKind,
  PostKind,
  PostRow,
  Profile,
  TargetType,
} from '../database.types';

/*
 * These mirror database enums, so they are re-exported rather than restated.
 * Declaring them here as well shadowed the real definitions through the
 * `@/lib/api` barrel, which silently stripped the friend/wall notification
 * kinds added in 0005 — and did it again to `TargetType` when 0013 added
 * `list`, which is why that one is now imported above rather than written out.
 */
export type { ListKind, NotificationKind, PostKind, TargetType };

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

/**
 * A collection row.
 *
 * An alias of `ListRow` rather than a restatement of it. This was a
 * hand-maintained copy, and it had already drifted — the same failure mode as
 * the duplicated `TargetType` that silently kept `list` out of the barrel (see
 * CLAUDE.md). One declaration means a column added to the table cannot go
 * missing here.
 */
export type GameList = ListRow;

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

/** Artwork for one game, enough to render it as a cover. */
export type ListCover = { cover_url: string | null; hero_url: string | null };

/** A list plus just enough artwork to render its tile. */
export type ListSummary = GameList & {
  itemCount: number;
  /**
   * The single cover the tile shows.
   *
   * Resolved server-side-ish in `getLists`: the owner's `cover_game_id` if they
   * picked one and it is still in the list, otherwise the first item's art.
   * Null only when the collection is empty.
   */
  preview: ListCover | null;
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
