import { supabase } from '../supabase';

/**
 * Per-outlet critic scores, from OpenCritic.
 *
 * ## Why this is not in `igdb.ts`
 *
 * Because IGDB does not have it. `aggregated_rating` is one averaged number and
 * a count; there is no field in the schema that says "IGN gave this 90". The
 * expandable list of named outlets needs a second provider, and this is it — the
 * key lives in the `opencritic` Edge Function for the same reason the Twitch
 * secret lives in `igdb`.
 *
 * ## Everything here degrades to nothing
 *
 * Two calls, either of which can fail: the function may not be deployed, the key
 * may not be set, or OpenCritic may simply not know the game. All three return
 * an empty result rather than throwing, and the widget drops the section. The
 * one thing this must never do is guess — a wrong title match would print
 * another game's reviews under this game's name.
 */

export type CriticReview = {
  outlet: string;
  /** 0-100. Outlets that publish no number are dropped upstream. */
  score: number;
  url: string | null;
};

export type CriticSummary = {
  /** OpenCritic's top-critic average, 0-100. */
  average: number | null;
  count: number;
  /** Share of critics who recommend it, 0-100. Null when OpenCritic has none. */
  recommended: number | null;
  reviews: CriticReview[];
};

const EMPTY: CriticSummary = { average: null, count: 0, recommended: null, reviews: [] };

async function invoke<T>(body: Record<string, unknown>): Promise<T | null> {
  const { data, error } = await supabase.functions.invoke('opencritic', { body });

  /* Swallowed on purpose. The overwhelmingly common failure is "the function is
     not deployed on this project", which is a deployment state rather than a
     bug, and it must cost a section rather than a screen. */
  if (error) return null;
  if (data && typeof data === 'object' && 'error' in data) return null;
  return data as T;
}

/**
 * Critic scores for a game, by title.
 *
 * The title is the only join available — OpenCritic cross-references neither
 * IGDB nor Steam — which is why the matching threshold lives server-side and is
 * deliberately tight. A near-miss is rejected rather than accepted.
 */
export async function getCriticReviews(title: string): Promise<CriticSummary> {
  if (!title.trim()) return EMPTY;

  const found = await invoke<{ found?: boolean; id?: number }>({
    action: 'search',
    title: title.trim(),
  });

  if (!found?.found || typeof found.id !== 'number') return EMPTY;

  const summary = await invoke<CriticSummary>({ action: 'reviews', id: found.id });
  return summary ?? EMPTY;
}
