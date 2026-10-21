import { progressChoiceFor } from '../constants/progress';
import type { CompletionLevel, LogStatus } from './database.types';

/**
 * A review's record of how it was played, as words.
 *
 * The owner's direction for the review page (2026-10-17): "when the review text
 * is finished, add the logging details of platform played, blah blah blah. But
 * do it in text form, similarly to the review text." It replaced the page's
 * strip of figures (`reviewCells`, which the review card still draws) with a
 * paragraph set as the review is, quieter:
 *
 * > Finished the story solo on PlayStation 5 in 42 hours. 73% complete.
 *
 * **Only what the writer recorded**, as the strip was: a blank they left is not
 * a fact, and "Played it." alone is not said — everyone with a review played
 * the game.
 *
 * Pure, so `npm test` loads it; the platform's name is resolved by the caller
 * (`constants/platform-cases` requires the case artwork).
 */

/** The columns of a log the paragraph reads. */
export type PlayedRecord = {
  status: LogStatus;
  completion: CompletionLevel | null;
  platinum: boolean;
  hours_played: number | null;
  completion_percent: number | null;
  coop: boolean | null;
  player_count: number | null;
};

/** One category of a scorecard, already in presentation order. */
export type CategoryScore = { label: string; score: number };

/**
 * The paragraph, or null when the log records nothing worth a sentence.
 *
 * Three sentences at most: what they did, on what, with whom and for how long;
 * how much of it they saw, when a percentage says more than the first; and the
 * scorecard, when they scored by category.
 */
export function playedDetails(
  record: PlayedRecord,
  platform: string | null,
  categories: readonly CategoryScore[] = []
): string | null {
  const choice = progressChoiceFor({
    status: record.status,
    completion: record.platinum ? 'full' : record.completion,
  });

  const verb = record.platinum
    ? 'Earned the platinum'
    : choice === 'full'
      ? 'Completed it 100%'
      : choice === 'completed'
        ? record.completion === 'main'
          ? 'Finished the story and its extras'
          : 'Finished the story'
        : choice === 'playing'
          ? 'Playing it'
          : choice === 'paused'
            ? 'Paused it'
            : choice === 'dropped'
              ? 'Dropped it'
              : choice === 'backlog'
                ? 'Wants to play it'
                : 'Played it';

  const company = companyOf(record);
  const hours = hoursOf(record.hours_played);
  const where = platform?.trim() ? ` on ${platform.trim()}` : '';

  /* "Played it." is every review; anything more is a fact. */
  const saysMore = choice !== 'played' || record.platinum || !!company || !!hours || !!where;

  const sentences: string[] = [];

  if (saysMore) {
    const howLong = !hours
      ? ''
      : choice === 'playing'
        ? `, ${hours} in`
        : choice === 'paused' || choice === 'dropped'
          ? ` after ${hours}`
          : record.platinum || choice === 'full' || choice === 'completed'
            ? ` in ${hours}`
            : ` for ${hours}`;
    sentences.push(`${verb}${company ? ` ${company}` : ''}${where}${howLong}.`);
  }

  /* "100% complete" is not said after "Completed it 100%" or a platinum. */
  const percent = record.completion_percent;
  const percentSaid = percent === 100 && (choice === 'full' || record.platinum);
  if (percent != null && !percentSaid) sentences.push(`${percent}% complete.`);

  if (categories.length > 0) {
    const list = categories.map(({ label, score }) => `${label} ${score}`).join(', ');
    sentences.push(`Scored by category: ${list}.`);
  }

  return sentences.length > 0 ? sentences.join(' ') : null;
}

/** "solo", "with 3 others", "in co-op" — or nothing, when it was not said. */
function companyOf({ coop, player_count }: PlayedRecord): string | null {
  if (coop === null) return null;
  if (!coop) return 'solo';
  /* The count is everyone who played, the writer included. */
  const others = player_count != null ? player_count - 1 : 0;
  if (others >= 2) return `with ${others} others`;
  if (others === 1) return 'with 1 other';
  return 'in co-op';
}

/** "42 hours", "1 hour", "12.5 hours" — or nothing for none recorded. */
function hoursOf(hours: number | null): string | null {
  if (hours == null || !Number.isFinite(hours) || hours <= 0) return null;
  const figure = Number.isInteger(hours) ? `${hours}` : `${Math.round(hours * 10) / 10}`;
  return `${figure} ${figure === '1' ? 'hour' : 'hours'}`;
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

/**
 * "16th October 2026" — the reference's own way of writing the date under a
 * review ("Listened on 16th October 2026"), in the reader's time zone.
 */
export function ordinalDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const day = date.getDate();
  return `${day}${ordinalSuffix(day)} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function ordinalSuffix(day: number): string {
  if (day % 100 >= 11 && day % 100 <= 13) return 'th';
  switch (day % 10) {
    case 1:
      return 'st';
    case 2:
      return 'nd';
    case 3:
      return 'rd';
    default:
      return 'th';
  }
}
