import { keepPreviousData, useQuery } from '@tanstack/react-query';

import { useReadingLanguages } from '@/hooks/use-reading-languages';
import { getReviewChart } from '@/lib/api';
import { readingKey, type ChartPeriod } from '@/lib/discovery';

/**
 * The Reviews chart for a period, in the languages the reader reads — the one
 * query Search's Reviews tab and the `/reviews` page share.
 *
 * It waits for the reader's languages (`ready`): asked a moment early it would
 * fetch for the wrong ones, draw, and swap its rows. The key carries the
 * period and the languages, so each combination is its own answer and the
 * last one's cards stand, dimmed, while the next arrive.
 *
 * `['review-chart']` is the prefix a saved review invalidates.
 */
export function useReviewChart(period: ChartPeriod, enabled = true) {
  const { reading, ready } = useReadingLanguages();

  const chart = useQuery({
    queryKey: ['review-chart', period, readingKey(reading)],
    queryFn: () => getReviewChart(period, reading),
    enabled: enabled && ready,
    staleTime: 5 * 60_000,
    placeholderData: keepPreviousData,
  });

  return { chart, reading };
}
