import type { LogStatus } from '@/lib/database.types';
import type { ThemePalette } from './theme';

/** Single source of truth for how each log status is worded and coloured. */
export const LOG_STATUSES: readonly LogStatus[] = [
  'playing',
  'paused',
  'played',
  'backlog',
  'dropped',
];

/**
 * The word for each status.
 *
 * `paused` is five letters beside "Played" and "Playing", which matters more
 * than it sounds: the back of the game case prints this word, at a size fixed by
 * the case's own geometry, and a longer one ("On hold") would have been the
 * first status that could not fit there.
 */
export const STATUS_LABEL: Record<LogStatus, string> = {
  playing: 'Playing',
  played: 'Played',
  backlog: 'Backlog',
  dropped: 'Dropped',
  paused: 'Paused',
};

/** Past-tense phrasing for the feed: "Ada is playing Hollow Knight". */
export const STATUS_VERB: Record<LogStatus, string> = {
  playing: 'is playing',
  played: 'played',
  backlog: 'wants to play',
  dropped: 'dropped',
  paused: 'paused',
};

/**
 * Colour for a log status. Five states, five hues, all readable as small type.
 *
 * These stopped being borrowed tokens. `playing` was `success` and `dropped`
 * was `danger`, which framed a shelf of games as a set of pass/fail results —
 * dropping a game is a verdict a critic is entitled to, not an error state, so
 * it takes rust rather than the alarm red the app uses for destructive actions.
 * `backlog` was `textSecondary`: grey, and therefore indistinguishable from
 * having no status at all, for the one status a logging app is most about.
 *
 * `played` keeps the house blue (in its legible variant) because it is the
 * resting state — the thing most rows in most feeds are.
 */
export function statusColor(status: LogStatus, theme: ThemePalette): string {
  switch (status) {
    case 'playing':
      return theme.statusPlaying;
    case 'played':
      return theme.statusPlayed;
    case 'backlog':
      return theme.statusBacklog;
    case 'dropped':
      return theme.statusDropped;
    case 'paused':
      return theme.statusPaused;
  }
}

/**
 * The glyph for a status.
 *
 * Colour is never the only carrier. Every place that tints a status also shows
 * its word (`STATUS_LABEL`) or, where there is no room for one, this glyph —
 * so the four states stay distinguishable to a reader who cannot separate the
 * hues, which for a green/rust pair is roughly one man in twelve.
 */
export const STATUS_ICON: Record<
  LogStatus,
  'play' | 'checkmark-done' | 'bookmark' | 'close' | 'pause'
> = {
  playing: 'play',
  played: 'checkmark-done',
  backlog: 'bookmark',
  dropped: 'close',
  paused: 'pause',
};
