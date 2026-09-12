import type {
  AwardRow,
  CachedGame,
  ListKind,
  ListRow,
  NotificationKind,
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
export type { ListKind, NotificationKind, TargetType };

export type Tier = 'S' | 'A' | 'B' | 'C' | 'D' | 'F';

export const TIERS: readonly Tier[] = ['S', 'A', 'B', 'C', 'D', 'F'];

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

/**
 * One category on an awards list, with whatever has won it.
 *
 * `game` is null in two different situations and the screen tells them apart by
 * `game_id`: a slot nobody has filled (`game_id` null) renders the empty
 * portrait well with its `+`, while a slot whose game is missing from the cache
 * (`game_id` set, `game` null) is a broken join and renders as a placeholder.
 */
export type AwardSlot = AwardRow & { game: CachedGame | null };

/** An awards list and its ballot, in ballot order. */
export type ListWithAwards = GameList & { awards: AwardSlot[] };

/** Artwork for one game, enough to render it as a cover. */
/**
 * Just enough of a game to draw one tile of a collection's artwork.
 *
 * `id` and `title` are carried for the mosaic's square-cover lookup, not for
 * display: `<CollectionMosaic>` asks SteamGridDB for a 1:1 grid per tile, and
 * the title is the only identity almost any game in this catalogue has (see
 * `lib/games/steamgriddb`). They cost two columns on an embed the summary
 * queries were already making.
 */
export type ListCover = {
  id: string;
  title: string;
  cover_url: string | null;
  hero_url: string | null;
};

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
  /**
   * The first four items' covers, in list order, for the tile's 2x2 mosaic.
   *
   * Shorter than four when the collection is, and empty when it has no games —
   * the tile handles all three rather than padding.
   */
  mosaic: ListCover[];
  /**
   * Who made it, embedded by the summary select.
   *
   * Null for a collection whose owner's profile row is missing — possible only
   * mid-deletion, and `displayNameFor` already renders that as "Someone" rather
   * than leaving a hole in the byline.
   */
  owner: {
    username: string | null;
    display_name: string | null;
    /** The tile puts a face on the byline, so the summary select fetches it. */
    avatar_url: string | null;
  } | null;
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
