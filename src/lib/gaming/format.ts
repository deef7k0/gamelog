/**
 * Presentation helpers for gaming data.
 *
 * Providers report playtime in minutes; nothing in the UI should divide by 60
 * inline, because "1,247 hours" and "18 min" and "2.5h" all appear in different
 * places and they need to agree on rounding.
 */

/** Compact playtime for a poster caption: "18m", "4.5h", "1,247h". */
export function formatPlaytime(minutes: number): string {
  if (minutes <= 0) return '0h';
  if (minutes < 60) return `${minutes}m`;

  const hours = minutes / 60;
  // One decimal below 10 hours, where the difference is still meaningful.
  if (hours < 10) return `${Math.round(hours * 10) / 10}h`;
  return `${Math.round(hours).toLocaleString()}h`;
}

/** Long form for statistics rows: "1,247 hours". */
export function formatPlaytimeLong(minutes: number): string {
  const hours = Math.round(minutes / 60);
  if (hours === 0) return `${minutes} minutes`;
  return `${hours.toLocaleString()} ${hours === 1 ? 'hour' : 'hours'}`;
}

/** 0-100 from a total that may legitimately be zero. */
export function completionPercent(unlocked: number, total: number): number {
  if (total <= 0) return 0;
  return Math.round((unlocked / total) * 100);
}

/**
 * Steam persona states, as words.
 *
 * "Looking to trade" and "looking to play" are real Steam states that most
 * clients collapse into "Online"; keeping them is part of making this feel like
 * Steam rather than a generic linked account.
 */
const STATUS_LABELS: Record<string, string> = {
  offline: 'Offline',
  online: 'Online',
  busy: 'Busy',
  away: 'Away',
  snooze: 'Snooze',
  looking_to_trade: 'Looking to trade',
  looking_to_play: 'Looking to play',
  unknown: 'Unknown',
};

export function statusLabel(status: string): string {
  return STATUS_LABELS[status] ?? 'Unknown';
}

export function isOnline(status: string): boolean {
  return status !== 'offline' && status !== 'unknown';
}

/**
 * ISO 3166-1 alpha-2 to a flag emoji.
 *
 * Steam only gives a country code, and a flag reads faster than "PT" in a
 * profile header. Regional indicator symbols start at U+1F1E6 for 'A'.
 */
export function countryFlag(code: string | null): string | null {
  if (!code || code.length !== 2 || !/^[A-Za-z]{2}$/.test(code)) return null;
  const upper = code.toUpperCase();
  return String.fromCodePoint(
    0x1f1e6 + (upper.charCodeAt(0) - 65),
    0x1f1e6 + (upper.charCodeAt(1) - 65)
  );
}

/**
 * A rarity colour from Steam, made safe to render.
 *
 * Steam sends bare hex without a '#', and occasionally sends nothing or
 * something malformed. Falling back to null lets the caller use a theme colour
 * rather than painting an item transparent.
 */
export function rarityColor(raw: string | null): string | null {
  if (!raw) return null;
  const hex = raw.replace(/^#/, '');
  if (!/^[0-9a-fA-F]{6}$/.test(hex)) return null;
  return `#${hex}`;
}
