import { ProfileWidget } from '@/components/profile-section';
import {
  RatingDistributionGraph,
  RatingDistributionSkeleton,
  useRatingDistribution,
} from '@/components/rating-distribution';

/**
 * A person's ratings, as a graph — the owner's direction (2026-10-21): "Add
 * the user's rating graph to their profile, below the starred song, as the
 * last widget before the tabs." Every game they scored, a row for 100 and
 * one for each ten below it (`<RatingDistributionGraph>`), the same graph a
 * game's page draws for everybody's scores of it.
 *
 * A widget like the others — a hairline, a small heading, what it holds —
 * and, like the starred song, nothing at all until there is something to
 * draw: a profile with no scores has no graph to show.
 */
export function RatingsWidget({ profileId }: { profileId: string }) {
  const query = useRatingDistribution({ userId: profileId });

  if (query.isPending) {
    return (
      <ProfileWidget title="Ratings" icon="stats-chart">
        <RatingDistributionSkeleton />
      </ProfileWidget>
    );
  }

  const counts = query.data ?? [];
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (total === 0) return null;

  return (
    <ProfileWidget title="Ratings" tail={` · ${total.toLocaleString()}`} icon="stats-chart">
      <RatingDistributionGraph counts={counts} />
    </ProfileWidget>
  );
}
