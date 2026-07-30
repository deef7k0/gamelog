import type { LogStatus } from '@/lib/database.types';
import type { ThemePalette } from './theme';

/** Single source of truth for how each log status is worded and coloured. */
export const LOG_STATUSES: readonly LogStatus[] = ['playing', 'played', 'backlog', 'dropped'];

export const STATUS_LABEL: Record<LogStatus, string> = {
  playing: 'Playing',
  played: 'Played',
  backlog: 'Backlog',
  dropped: 'Dropped',
};

/** Past-tense phrasing for the feed: "Ada is playing Hollow Knight". */
export const STATUS_VERB: Record<LogStatus, string> = {
  playing: 'is playing',
  played: 'played',
  backlog: 'wants to play',
  dropped: 'dropped',
};

export function statusColor(status: LogStatus, theme: ThemePalette): string {
  switch (status) {
    case 'playing':
      return theme.success;
    case 'played':
      return theme.primary;
    case 'backlog':
      return theme.textSecondary;
    case 'dropped':
      return theme.danger;
  }
}
