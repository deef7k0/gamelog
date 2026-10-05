/**
 * A year of releases, as a calendar: which games fall on which day, which month
 * a game with no day belongs to, and how a month is laid out in rows.
 *
 * Pure — no React Native and no network — so `npm test` covers it. Every date
 * here is read in **UTC**: IGDB stores a release as midnight UTC of its day, and
 * reading that in the phone's own zone moves every game west of Greenwich back
 * a day.
 */

/** How exactly IGDB knows a release date. */
export type DatePrecision = 'day' | 'month' | 'year';

export type CalendarGame = {
  /** App-wide id, `igdb:1234`. */
  id: string;
  title: string;
  coverImageId: string | null;
  /** Unix seconds, midnight UTC. */
  releasedAt: number;
  precision: DatePrecision;
  /** IGDB's follows before release — the anticipation signal. */
  hypes: number;
  /** How many ratings IGDB holds — the "people played this" signal. */
  ratings: number;
  /** IGDB's 0-100 aggregate, or null before anybody has rated it. */
  score: number | null;
};

/**
 * IGDB's `release_dates.date_format`, the three that name a day or a month.
 * Everything else — a year, a quarter, "TBD" — is a release with no month.
 */
const FORMAT_DAY = 0;
const FORMAT_MONTH = 1;

/**
 * How precisely a game's first release is known.
 *
 * `first_release_date` is always a full timestamp, even for a game IGDB only
 * knows as "2026": that one is stored as 31 December, and a calendar that took
 * the timestamp at its word would release forty games on New Year's Eve. The
 * precision is on the release rows, so it is read from the row(s) that carry the
 * same timestamp — the most precise of them wins, since one region announcing a
 * day makes the day real.
 *
 * A game with no release rows at all is taken at its word: that is every older
 * game, whose dates are simply known.
 */
export function precisionOf(
  firstReleaseDate: number,
  releaseDates: readonly { date?: number; date_format?: number }[] | undefined
): DatePrecision {
  const matching = (releaseDates ?? []).filter((entry) => entry.date === firstReleaseDate);
  if (matching.length === 0) return 'day';
  if (matching.some((entry) => entry.date_format === FORMAT_DAY)) return 'day';
  if (matching.some((entry) => entry.date_format === FORMAT_MONTH)) return 'month';
  /* A row with no format at all predates the field; it is a known date. */
  if (matching.some((entry) => entry.date_format === undefined)) return 'day';
  return 'year';
}

/**
 * One number to rank a year's games by, whichever side of release they are on.
 *
 * Before release a game has follows and no ratings; afterwards it keeps its
 * follows and gathers ratings. Their sum therefore ranks an unreleased game by
 * how awaited it is and a released one by how awaited it was *and* how many
 * people then played it — the two halves of "the big games of the year".
 */
export function calendarWeight(game: Pick<CalendarGame, 'hypes' | 'ratings'>): number {
  return game.hypes + game.ratings;
}

const byWeight = (a: CalendarGame, b: CalendarGame) =>
  calendarWeight(b) - calendarWeight(a) || a.title.localeCompare(b.title);

/** Unix seconds for 00:00 UTC on the first of a month (`month` is 0-11). */
export function monthStart(year: number, month: number): number {
  return Math.floor(Date.UTC(year, month, 1) / 1000);
}

/**
 * The games of one month, biggest first.
 *
 * Day- and month-precise releases only. A game known as "2026" has no month to
 * be listed under; `undatedOf` is where those go.
 */
export function gamesOfMonth(
  games: readonly CalendarGame[],
  year: number,
  month: number
): CalendarGame[] {
  const from = monthStart(year, month);
  const to = monthStart(year, month + 1);
  return games
    .filter((game) => game.precision !== 'year' && game.releasedAt >= from && game.releasedAt < to)
    .sort(byWeight);
}

/** The year's games with no month: announced for the year and nothing closer. */
export function undatedOf(games: readonly CalendarGame[]): CalendarGame[] {
  return games.filter((game) => game.precision === 'year').sort(byWeight);
}

/**
 * A month's releases by day of the month, each day biggest first.
 *
 * Day-precise releases only: a game due "in November" is in the month's list
 * and on no particular square.
 */
export function gamesByDay(
  games: readonly CalendarGame[],
  year: number,
  month: number
): Map<number, CalendarGame[]> {
  const days = new Map<number, CalendarGame[]>();
  for (const game of gamesOfMonth(games, year, month)) {
    if (game.precision !== 'day') continue;
    const day = new Date(game.releasedAt * 1000).getUTCDate();
    const list = days.get(day);
    if (list) list.push(game);
    else days.set(day, [game]);
  }
  return days;
}

/** How many rows a month is drawn in, and how many days across each. */
export const MONTH_ROWS = 5;
export const MONTH_COLUMNS = 7;

/**
 * A month as five rows of seven: the days in order from the 1st, then null for
 * the squares past its last day.
 *
 * **Counted, not laid out by weekday.** The grid used to start on the weekday
 * the 1st fell on, under a row of S M T W T F S — a wall calendar's layout,
 * which spends up to six rows and a header on a fact nobody reads a release
 * calendar for. At the owner's direction it is the days of the month and
 * nothing else: 1–7, 8–14, 15–21, 22–28 and what is left, so every month is
 * the same five rows and the squares can be larger. A 28-day February fills
 * four and leaves the fifth empty, so the screen under it does not move.
 */
export function monthRows(year: number, month: number): (number | null)[][] {
  const length = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const rows: (number | null)[][] = [];
  for (let row = 0; row < MONTH_ROWS; row += 1) {
    rows.push(
      Array.from({ length: MONTH_COLUMNS }, (_, column) => {
        const day = row * MONTH_COLUMNS + column + 1;
        return day <= length ? day : null;
      })
    );
  }
  return rows;
}

/** Whether a month is behind today, ahead of it, or the one today is in. */
export function monthTense(year: number, month: number, now: Date): 'past' | 'current' | 'future' {
  const thisYear = now.getUTCFullYear();
  const thisMonth = now.getUTCMonth();
  if (year < thisYear || (year === thisYear && month < thisMonth)) return 'past';
  if (year === thisYear && month === thisMonth) return 'current';
  return 'future';
}
