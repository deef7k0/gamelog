import type { EditionKind } from '../../constants/game-editions';

/** A headline from one of the gaming outlets we aggregate. */
export type Article = {
  id: string;
  title: string;
  /** Plain text; RSS descriptions are HTML and get stripped before this. */
  summary: string | null;
  url: string;
  imageUrl: string | null;
  /** Outlet name — "IGN", "PC Gamer". */
  source: string;
  publishedAt: string | null;
};

/** A trailer or gameplay video attached to a game. */
export type Trailer = {
  id: string;
  gameId: string;
  gameTitle: string;
  /** YouTube video id; the app opens youtube.com/watch?v=… rather than embedding. */
  videoId: string;
  name: string;
  thumbnailUrl: string;
  coverUrl: string | null;
};

/**
 * One row of the monthly popularity chart. Always an IGDB game — the chart is
 * artwork-led, and a row with no cover is not worth showing.
 */
export type ChartEntry = {
  rank: number;
  /** Our app-wide game id, so a tap routes straight to the game page. */
  gameId: string;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
  releaseYear: number | null;
  /**
   * Release type, for the tile's badge.
   *
   * Charts are where this matters most: a remaster and its original are the
   * same title and often the same key art, and a Popular grid listing both with
   * nothing to tell them apart is the confusion the badge exists to remove.
   */
  edition: EditionKind | null;
  /** Steam appid, for official store artwork on the chart tiles. */
  steamAppId: string | null;
  /**
   * Raw provider platform names, for the marks under a chart tile.
   *
   * Carried rather than looked up because the chart is the one game list in the
   * app that does *not* go through `GameSearchResult` — without this the
   * carousel is the only surface where a game appears with no answer to "can I
   * play this", which is what made Discover read as a different app from the
   * search results beside it. Collapsed to families at render time by
   * `platformFamilies`, exactly as every other surface does.
   */
  platforms: string[];
};

/**
 * What the ranking actually measured.
 *
 * Carried with the data rather than hard-coded into the screen, because the
 * chart silently changes basis when IGDB's popularity feed is unavailable and
 * the footnote has to change with it instead of claiming a measure that was
 * never used.
 */
export type ChartBasis = 'igdb-popularity' | 'community-ratings';

export type PopularChart = {
  basis: ChartBasis;
  entries: ChartEntry[];
};

/** An industry event — a showcase, an awards show. */
export type GameEvent = {
  id: string;
  name: string;
  description: string | null;
  /** ISO. */
  startsAt: string | null;
  liveStreamUrl: string | null;
  /**
   * Resolved when the event is fetched, not when it renders.
   *
   * Reading the clock during render is impure and the React Compiler rules
   * reject it; doing it here also means every card in a list agrees on "now".
   */
  isUpcoming: boolean;
};
