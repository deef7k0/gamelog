import { QueryClient } from '@tanstack/react-query';

/**
 * How long a query nobody is looking at stays in memory.
 *
 * TanStack's default is five minutes, which is short enough to be felt: open a
 * game, read a review, spend six minutes in a collection, come back — and the
 * game page is a spinner again over a record that changes about once a year.
 *
 * SimpMusic's answer to the same question is structural: its screens hold
 * nothing, and a view model that outlives them holds the loaded page, so
 * returning to Home is a re-draw, never a request. A long `gcTime` is that
 * here. Half an hour covers a sitting; the cost is JSON a few kilobytes a page.
 * Whether a kept query is *refetched* is still `staleTime`'s decision.
 */
const KEEP_IN_MEMORY_MS = 30 * 60_000;

/**
 * The app's one query client.
 *
 * A module rather than a value built in the root layout, because two things
 * outside React need it: the auth store empties it when the account changes,
 * and `lib/query-persist` reads and fills it around a launch.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Steam's store API is rate limited and game metadata barely changes, so
      // lean on the cache rather than refetching aggressively.
      staleTime: 60_000,
      gcTime: KEEP_IN_MEMORY_MS,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
