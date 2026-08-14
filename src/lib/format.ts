const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

/** Compact relative time for feed timestamps: "now", "4h", "3d", "12 Mar". */
export function timeAgo(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';

  const elapsed = now - then;
  if (elapsed < MINUTE) return 'now';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)}m`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)}h`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)}d`;

  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Heading for a chronological group: "Today", "Yesterday", "Last week"…
 *
 * Calendar-day based, not elapsed-time based. Something posted at 23:50 and read
 * at 00:10 is "Yesterday", even though only twenty minutes have passed — which is
 * how people actually read a timeline. `timeAgo` deliberately does the opposite,
 * because a per-row stamp wants precision, not a calendar.
 */
export function dateGroupLabel(iso: string, now: number = Date.now()): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return 'Earlier';

  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const todayMs = startOfToday.getTime();

  if (then >= todayMs) return 'Today';
  if (then >= todayMs - DAY) return 'Yesterday';
  if (then >= todayMs - 7 * DAY) return 'Last week';
  if (then >= todayMs - 30 * DAY) return 'This month';

  const date = new Date(then);
  const sameYear = date.getFullYear() === new Date(now).getFullYear();
  return date.toLocaleDateString(undefined, {
    month: 'long',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Insert group headers into a chronologically sorted list.
 *
 * Returns a flat array so it can feed a FlatList directly — a SectionList would
 * be the obvious choice, but the wall mixes two row shapes already and nesting
 * that inside sections costs more than it saves.
 *
 * Assumes `items` is already newest-first; it does not sort, because the caller's
 * ordering is deliberate.
 */
export function withDateGroups<T>(
  items: T[],
  timestampOf: (item: T) => string,
  now: number = Date.now()
): ({ type: 'header'; label: string } | { type: 'item'; item: T })[] {
  const rows: ({ type: 'header'; label: string } | { type: 'item'; item: T })[] = [];
  let currentLabel: string | null = null;

  for (const item of items) {
    const label = dateGroupLabel(timestampOf(item), now);
    if (label !== currentLabel) {
      rows.push({ type: 'header', label });
      currentLabel = label;
    }
    rows.push({ type: 'item', item });
  }

  return rows;
}

/** "@ada" — display name if set, username otherwise. */
export function displayNameFor(
  profile: {
    display_name?: string | null;
    username?: string | null;
  } | null
): string {
  if (!profile) return 'Someone';
  return profile.display_name?.trim() || profile.username || 'Someone';
}

/**
 * "Good morning" / "Good afternoon" / "Good evening" / "Good night".
 *
 * Four bands rather than the usual three. "Good evening" at 2am is the kind of
 * small wrongness that makes an app feel like it was not built for the person
 * using it — and a game-logging app is used at 2am more than most, because
 * finishing something at 2am is exactly when you go and log it.
 *
 * Takes the clock as an argument so it can be tested without mocking Date.
 */
export function greetingFor(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Good night';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  if (hour < 22) return 'Good evening';
  return 'Good night';
}
