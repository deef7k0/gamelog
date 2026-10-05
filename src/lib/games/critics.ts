import { supabase } from '../supabase';

/**
 * What the critics wrote and scored, from OpenCritic.
 *
 * ## Why this is not in `igdb.ts`
 *
 * Because IGDB does not have it. `aggregated_rating` is one averaged number and
 * a count; there is no field in the schema that says "IGN gave this 90", and
 * certainly none holding what IGN wrote. The game page's critic rail needs a
 * second provider, and this is it — the key lives in the `opencritic` Edge
 * Function for the same reason the Twitch secret lives in `igdb`.
 *
 * ## Everything here degrades to nothing
 *
 * The function may not be deployed, the key may not be set, the day's quota may
 * be spent, or OpenCritic may simply not know the game. Every one of those
 * returns `EMPTY` rather than throwing, and the page drops the section. The one
 * thing this must never do is guess — a wrong title match would print another
 * game's reviews under this game's name — so the matching lives server-side,
 * where it also checks the release year.
 */

export type CriticReview = {
  outlet: string;
  /** 0-100, or null for an outlet that publishes a verdict and no number. */
  score: number | null;
  url: string | null;
  /**
   * A sentence or two of the review itself.
   *
   * Absent — not null, *absent* — from a deployment of the function older than
   * the critic rail, which returned scores only. Read it as optional.
   */
  snippet?: string | null;
  author?: string | null;
  /** ISO timestamp. */
  date?: string | null;
};

export type CriticSummary = {
  /** OpenCritic's top-critic average, 0-100. */
  average: number | null;
  count: number;
  /** Share of critics who recommend it, 0-100. Null when OpenCritic has none. */
  recommended: number | null;
  /** OpenCritic's own band — "Mighty", "Strong", "Fair", "Weak". */
  tier?: string | null;
  /** The game's page on OpenCritic. */
  url?: string | null;
  reviews: CriticReview[];
};

const EMPTY: CriticSummary = { average: null, count: 0, recommended: null, reviews: [] };

/** What the function says, or why it said nothing. */
type Invoked<T> = { data: T } | { failed: 'unsupported' | 'error' };

async function invoke<T>(body: Record<string, unknown>): Promise<Invoked<T>> {
  const { data, error } = await supabase.functions.invoke('opencritic', { body });

  /*
   * Swallowed on purpose. The overwhelmingly common failure is "the function is
   * not deployed on this project", which is a deployment state rather than a
   * bug, and it must cost a section rather than a screen.
   *
   * One failure is told apart: a function deployed before the `summary` action
   * existed answers it with "Unknown action", and that build can still be asked
   * the old way. supabase-js hands a non-2xx body back on `error.context`.
   */
  if (error) {
    const context = (error as { context?: unknown }).context;
    if (context instanceof Response) {
      const text = await context.text().catch(() => '');
      if (text.includes('Unknown action')) return { failed: 'unsupported' };
    }
    return { failed: 'error' };
  }
  if (data && typeof data === 'object' && 'error' in data) {
    return String((data as { error: unknown }).error).includes('Unknown action')
      ? { failed: 'unsupported' }
      : { failed: 'error' };
  }
  return { data: data as T };
}

export type CriticLookup = {
  title: string;
  /** IGDB's release year, so a same-named game from another decade is refused. */
  year?: number | null;
  /** The app's game id — the key the shared answer cache is filed under. */
  gameId?: string | null;
};

/**
 * Critic reviews for a game.
 *
 * The title is the only join available — OpenCritic cross-references neither
 * IGDB nor Steam — which is why the matching threshold lives server-side and is
 * deliberately tight, and why the release year goes with it.
 *
 * One request against a current deployment. An older one is asked in the two
 * steps it understands and answers without snippets; the rail then has nothing
 * to quote and stays away, which is the right outcome until the function is
 * redeployed.
 */
export async function getCriticSummary({
  title,
  year,
  gameId,
}: CriticLookup): Promise<CriticSummary> {
  const trimmed = title.trim();
  if (!trimmed) return EMPTY;

  const answer = await invoke<(CriticSummary & { found?: boolean }) | { found: false }>({
    action: 'summary',
    title: trimmed,
    ...(year ? { year } : {}),
    ...(gameId ? { key: gameId } : {}),
  });

  if ('data' in answer) {
    const summary = answer.data;
    if (!summary || summary.found === false || !('reviews' in summary)) return EMPTY;
    return { ...summary, reviews: summary.reviews ?? [] };
  }
  if (answer.failed !== 'unsupported') return EMPTY;

  const found = await invoke<{ found?: boolean; id?: number }>({
    action: 'search',
    title: trimmed,
  });
  if (!('data' in found) || !found.data?.found || typeof found.data.id !== 'number') return EMPTY;

  const summary = await invoke<CriticSummary>({ action: 'reviews', id: found.data.id });
  return 'data' in summary && summary.data ? summary.data : EMPTY;
}

/** The reviews worth a card: the ones with something to quote. */
export function quotedReviews(summary: CriticSummary | null | undefined): CriticReview[] {
  return (summary?.reviews ?? []).filter((review) => !!review.snippet?.trim());
}
