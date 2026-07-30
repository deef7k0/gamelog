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
