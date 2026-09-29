import type { StatsCell } from '@/components/ui/stats-strip';
import { PLATFORMS } from '@/constants/platform-cases';
import { familyForStored, platformKeyForStored } from '@/constants/platform-family';
import { PROGRESS_META, progressChoiceFor, type ProgressChoice } from '@/constants/progress';
import { statusColor } from '@/constants/status';
import type { ThemePalette } from '@/constants/theme';
import type { LogWithRelations } from '@/lib/database.types';

/** The facts a playthrough can record, as `<StatsStrip>` cells. */
export type ReviewCellKey = 'platform' | 'progress' | 'hours' | 'percent' | 'coop';

/** Where, how far, how long, how much, with whom — the order the review page reads them in. */
const PAGE_ORDER: readonly ReviewCellKey[] = ['platform', 'progress', 'hours', 'percent', 'coop'];

/** The most figures the review page's strip carries; past four, a 300dp column truncates labels. */
const MAX_CELLS = 4;

/** What each progress choice is called in a strip label — one word, where it can be. */
const PROGRESS_CELL: Partial<Record<ProgressChoice, string>> = {
  playing: 'Playing',
  paused: 'Paused',
  completed: 'Completed',
  full: '100%',
  dropped: 'Dropped',
};

/**
 * A review's playthrough as strip cells: where, how far, how long, how much,
 * with whom.
 *
 * Shared by the review page and the review card, so the card's strip is the
 * page's strip at a smaller size — the same marks, the same words — rather
 * than a second description of the same run that could drift from the first.
 * The card asks for fewer cells, in its own order (`order`, `max`).
 *
 * **Only what the writer recorded.** The game page's strip keeps four cells
 * always and says "N/A" in the empty ones, because it compares games; this one
 * describes one person's run, and a blank they left is not a fact about the
 * game. "Played" is never a cell for the reason `reviewContext` gives — everyone
 * with a review played the game.
 *
 * Marks where the fact has one — the platform's own logo, the progress glyph in
 * its status colour, a trophy for a platinum, an hourglass over the hours — and
 * the label always says it in words, since colour and glyph are never the only
 * carriers.
 */
export function reviewCells(
  review: LogWithRelations,
  theme: ThemePalette,
  { order = PAGE_ORDER, max = MAX_CELLS }: { order?: readonly ReviewCellKey[]; max?: number } = {}
): StatsCell[] {
  const cells = new Map<ReviewCellKey, StatsCell>();

  if (review.played_on) {
    const family = familyForStored(review.played_on);
    const key = platformKeyForStored(review.played_on);
    cells.set(
      'platform',
      family
        ? {
            key: 'platform',
            value: review.played_on,
            /* The short form the pickers write ("PS5"), resolved from older
               free-text values too, so a label fits its cell. */
            label: key ? PLATFORMS[key].short : family.label,
            icon: { name: family.icon, color: family.accent },
            a11y: `Played on ${review.played_on}`,
          }
        : {
            /* A platform typed by hand that is not one we know: kept as the
               writer's own word rather than dropped. */
            key: 'platform',
            value: review.played_on,
            label: 'Platform',
            a11y: `Played on ${review.played_on}`,
          }
    );
  }

  /* A platinum reads as 100%, the same rule the review filters count by. */
  const progress = progressChoiceFor({
    status: review.status,
    completion: review.platinum ? 'full' : review.completion,
  });

  if (review.platinum) {
    cells.set('progress', {
      key: 'progress',
      value: 'Platinum',
      label: 'Platinum',
      icon: { name: 'trophy', color: theme.platinum },
      a11y: 'Earned the platinum trophy',
    });
  } else if (progress && PROGRESS_CELL[progress]) {
    const meta = PROGRESS_META[progress];
    cells.set('progress', {
      key: 'progress',
      value: meta.label,
      label: PROGRESS_CELL[progress]!,
      icon: { name: meta.icon, color: statusColor(meta.status, theme) },
      a11y: meta.label,
    });
  }

  /* A mark over the figure, as the platform is — "200h" under an hourglass
     rather than "200 h" over "Played". The hourglass, not the clock: `time` is
     already "Want to play" in the progress choices. Neutral ink, as the co-op
     mark is, since a playtime has no colour of its own. */
  if (review.hours_played != null) {
    const hours = `${review.hours_played}h`;
    cells.set('hours', {
      key: 'hours',
      value: hours,
      label: hours,
      icon: { name: 'hourglass', color: theme.text },
      a11y: `${review.hours_played} hours played`,
    });
  }

  /* "100%" already said by the progress cell is not said twice. */
  const percentSaid = review.completion_percent === 100 && (progress === 'full' || review.platinum);
  if (review.completion_percent != null && !percentSaid) {
    cells.set('percent', {
      key: 'percent',
      value: `${review.completion_percent}%`,
      label: 'Complete',
      a11y: `${review.completion_percent}% complete`,
    });
  }

  if (review.coop !== null) {
    const players = review.coop && review.player_count ? review.player_count : null;
    cells.set('coop', {
      key: 'coop',
      value: review.coop ? 'Co-op' : 'Solo',
      label: review.coop ? (players ? `${players} players` : 'Co-op') : 'Solo',
      icon: { name: review.coop ? 'people' : 'person', color: theme.text },
      a11y: review.coop
        ? players
          ? `Played co-op, ${players} players`
          : 'Played co-op'
        : 'Played solo',
    });
  }

  return order
    .map((key) => cells.get(key))
    .filter((cell): cell is StatsCell => cell !== undefined)
    .slice(0, max);
}
