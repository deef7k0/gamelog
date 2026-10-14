import { canRead, isKnownLanguage, languageName } from './language';

/**
 * How a chart decides what to show — the parts of it that are arithmetic.
 *
 * The model is Letterboxd's, read from its API's documentation and its help
 * centre rather than guessed at (CLAUDE.md § Discovery has the sources). It is
 * not a recommender, and neither is this:
 *
 * - **Popularity is activity inside a period.** Its sort orders are
 *   `ReviewPopularity`, `…ThisWeek`, `…ThisMonth`, `…ThisYear` — "reviews with
 *   more activity (likes/comments) first" — and the same four for members.
 * - **The same count, among the people you follow** (`…WithFriends`).
 * - **One entry a member** (`NoDuplicateMembers`), so one prolific person is
 *   not the chart.
 *
 * The counting happens in Postgres (migration 0038: `review_popularity`,
 * `member_popularity`). This file is what the phone does with the answers:
 * which period, what a row says about why it is there, and which review to
 * lead with for somebody who cannot read all of them.
 *
 * Pure — `npm test` runs it, and reads 0038 to check the two agree.
 */

// ---------------------------------------------------------------------------
// Periods
// ---------------------------------------------------------------------------

/** The window a chart is read over. `all` is no window: everything, ever. */
export type ChartPeriod = 'week' | 'month' | 'year' | 'all';

const PERIOD_DAYS: Record<Exclude<ChartPeriod, 'all'>, number> = { week: 7, month: 30, year: 365 };

/**
 * The periods, as a `<DropdownButton>` lists them — the control "Beloved by
 * the community" has, with the one that chart has no use for: all time.
 */
export const CHART_PERIODS: readonly { value: ChartPeriod; label: string; short: string }[] = [
  { value: 'week', label: 'This week', short: 'Week' },
  { value: 'month', label: 'This month', short: 'Month' },
  { value: 'year', label: 'This year', short: 'Year' },
  { value: 'all', label: 'All time', short: 'All time' },
];

/**
 * Where a chart opens. A month, not Letterboxd's week: a week of an app this
 * size is a handful of likes, and a chart with three rows in it reads as
 * broken. It is the period Search's "Popular this month" already keeps.
 */
export const DEFAULT_CHART_PERIOD: ChartPeriod = 'month';

/** A period, in the middle of a sentence: "Nobody was liked this week." */
export const PERIOD_WORDS: Record<ChartPeriod, string> = {
  week: 'this week',
  month: 'this month',
  year: 'this year',
  all: 'yet',
};

/**
 * When a period began, as the timestamp Postgres is asked for — or `null` for
 * all time, which the functions read as "no lower bound".
 *
 * Thirty days, not "since the 1st": on the 2nd of a month a calendar month is
 * one day of activity.
 */
export function periodStart(period: ChartPeriod, now: number = Date.now()): string | null {
  if (period === 'all') return null;
  return new Date(now - PERIOD_DAYS[period] * 86_400_000).toISOString();
}

// ---------------------------------------------------------------------------
// Languages, as part of a request
// ---------------------------------------------------------------------------

/**
 * The reader's languages as one stable string, for a query key: the same
 * languages in another order are the same question.
 */
export function readingKey(reading: readonly string[] | null): string {
  return reading === null ? 'all' : [...reading].sort().join(',');
}

// ---------------------------------------------------------------------------
// Why a person is in a chart
// ---------------------------------------------------------------------------

/** What `member_popularity` counted for one person. */
export type MemberActivity = { likes: number; comments: number; followers: number };

function counted(count: number, one: string, many: string): string | null {
  return count > 0 ? `${count.toLocaleString('en-US')} ${count === 1 ? one : many}` : null;
}

/**
 * The line beside somebody in "Popular": what they drew in the period, said as
 * the things it was. Only the parts that are not zero — "0 comments" is not a
 * reason anybody is in a chart.
 */
export function popularityLine(activity: MemberActivity): string {
  const parts = [
    counted(activity.likes, 'like', 'likes'),
    /* People who commented, not comments: see 0038. */
    counted(activity.comments, 'reply', 'replies'),
    counted(activity.followers, 'new follower', 'new followers'),
  ].filter((part): part is string => part !== null);
  return parts.join(' · ');
}

/**
 * The line beside somebody in "Popular with friends": the strongest thing the
 * reader's circle did. A follow says more than a like, so it leads when there
 * is one; the count is of people the reader follows, never of strangers.
 */
export function circleLine(activity: MemberActivity): string {
  if (activity.followers > 0) {
    return activity.followers === 1
      ? 'Followed by 1 person you follow'
      : `Followed by ${activity.followers.toLocaleString('en-US')} people you follow`;
  }
  if (activity.likes > 0) return 'Liked by people you follow';
  return 'In conversation with people you follow';
}

// ---------------------------------------------------------------------------
// Which review to lead with
// ---------------------------------------------------------------------------

/**
 * The first of `ranked` this reader can read — or simply the first, when they
 * can read none of them.
 *
 * For a slot that shows **one** review of a game (the Overview's most liked):
 * the best review somebody cannot read is not the best one to show them, but
 * a game whose only reviews are in other languages still has a most liked
 * review, and an empty slot would say it had none.
 *
 * `ranked` is best first. Nothing is reordered and nothing is dropped.
 */
export function leadReview<T>(
  ranked: readonly T[],
  languageOf: (item: T) => string | null | undefined,
  reading: readonly string[] | null
): T | null {
  if (ranked.length === 0) return null;
  return ranked.find((item) => canRead(languageOf(item), reading)) ?? ranked[0];
}

// ---------------------------------------------------------------------------
// The reviews sheet's language filter
// ---------------------------------------------------------------------------

export type LanguageFacet = { code: string; label: string; count: number };

/**
 * The languages a game's reviews can be narrowed to: the ones somebody wrote
 * one in, most reviews first — and **none at all unless there are two**. A
 * filter with one choice filters nothing; it would be a control that can only
 * show the same list or an empty one.
 *
 * Unlabelled reviews are not a language and are not a choice.
 */
export function languageFacets(labels: readonly (string | null | undefined)[]): LanguageFacet[] {
  const counts = new Map<string, number>();
  for (const label of labels) {
    if (isKnownLanguage(label)) counts.set(label, (counts.get(label) ?? 0) + 1);
  }
  if (counts.size < 2) return [];

  return [...counts.entries()]
    .map(([code, count]) => ({ code, label: languageName(code), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}
