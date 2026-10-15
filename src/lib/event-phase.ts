/**
 * Where an event is in its life, and how its page says when — pure, so
 * `npm test` holds it. Times are IGDB's: seconds since the epoch.
 */

export type EventPhase = 'upcoming' | 'live' | 'over' | 'undated';

/**
 * How long a showcase is assumed to run when IGDB gives no end: three hours,
 * a long one. An event is "live" from its start until its end, or until this.
 */
export const ASSUMED_LENGTH_S = 3 * 60 * 60;

export function eventPhase(
  startTime: number | null,
  endTime: number | null,
  nowMs: number
): EventPhase {
  if (startTime === null) return 'undated';
  const now = nowMs / 1000;
  if (now < startTime) return 'upcoming';
  const end = endTime !== null && endTime > startTime ? endTime : startTime + ASSUMED_LENGTH_S;
  return now < end ? 'live' : 'over';
}

/**
 * The games IGDB lists for an event are what was *shown* at it — the owner's
 * direction: "the games that are shown whenever the event is over". Before
 * then they are an announcement at best, so the page prints none. An event
 * with no date at all is nearly always an old one whose date was never
 * entered, and keeps its games.
 */
export function showsGames(phase: EventPhase): boolean {
  return phase === 'over' || phase === 'undated';
}

/** "in 3 days", "in 5 hours", "in 20 minutes", "any minute now". */
export function countdown(startTime: number, nowMs: number): string {
  const seconds = startTime - nowMs / 1000;
  if (seconds <= 60) return 'any minute now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `in ${minutes} ${minutes === 1 ? 'minute' : 'minutes'}`;
  const hours = Math.round(seconds / 3600);
  if (hours < 36) return `in ${hours} ${hours === 1 ? 'hour' : 'hours'}`;
  const days = Math.round(seconds / 86400);
  return `in ${days} days`;
}

/** "2h 15m", "45m" — how long it ran, when IGDB knows both ends. */
export function runningTime(startTime: number, endTime: number | null): string | null {
  if (endTime === null || endTime <= startTime) return null;
  const minutes = Math.round((endTime - startTime) / 60);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}m`;
  return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
}

/**
 * The date and time cells, in the reader's own zone and language: "11 Dec" /
 * "Thursday", "20:30". `locale` is passed so a test can hold it; the screen
 * passes `undefined`, the phone's.
 */
export function startCells(
  startTime: number,
  locale?: string
): { date: string; weekday: string; time: string } {
  const at = new Date(startTime * 1000);
  return {
    date: at.toLocaleDateString(locale, { day: 'numeric', month: 'short' }),
    weekday: at.toLocaleDateString(locale, { weekday: 'long' }),
    time: at.toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' }),
  };
}
