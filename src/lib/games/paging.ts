/**
 * Pages of a catalogue too long to scroll: how many there are, which numbers
 * the pager shows, and how to count rows through an API that will not say.
 *
 * Pure — no React Native and no network — so `npm test` covers it.
 */

/** Games on one page of a platform's catalogue. */
export const PAGE_SIZE = 10;

/** IGDB's ceiling on `limit`, and so the most one request can count. */
export const COUNT_BATCH = 500;

/** At least one page, so an empty catalogue is "page 1 of 1" and not "of 0". */
export function pageCountFor(count: number, pageSize: number = PAGE_SIZE): number {
  return Math.max(1, Math.ceil(Math.max(0, count) / pageSize));
}

/** A page number inside the range, whatever was typed. */
export function clampPage(page: number, pageCount: number): number {
  if (!Number.isFinite(page)) return 1;
  return Math.min(Math.max(1, Math.trunc(page)), Math.max(1, pageCount));
}

/** One slot of a pager: a page to go to, or a run of pages left out. */
export type PagerSlot = { kind: 'page'; page: number } | { kind: 'gap'; key: string };

/**
 * The slots a pager draws: the first page, the last, the current one and
 * `siblings` either side of it, with a gap wherever pages were left out.
 *
 *   page 1 of 9    →  1 2 3 … 9
 *   page 5 of 9    →  1 … 4 5 6 … 9
 *   page 5 of 512  →  1 … 4 5 6 … 512
 *
 * A gap standing in for a single page is that page instead — "1 … 3" hides one
 * number behind three dots, which costs the same width and a tap.
 */
export function pagerSlots(page: number, pageCount: number, siblings = 1): PagerSlot[] {
  const total = Math.max(1, pageCount);
  const current = clampPage(page, total);

  const wanted = new Set<number>([1, total]);
  for (let offset = -siblings; offset <= siblings; offset++) {
    const candidate = current + offset;
    if (candidate >= 1 && candidate <= total) wanted.add(candidate);
  }
  /* At either end the window is one-sided, so it is widened to keep the row a
     steady width instead of shrinking on the first and last pages. */
  if (current <= 1 + siblings)
    for (let p = 1; p <= Math.min(total, 2 + siblings); p++) wanted.add(p);
  if (current >= total - siblings) {
    for (let p = Math.max(1, total - 1 - siblings); p <= total; p++) wanted.add(p);
  }

  const pages = [...wanted].sort((a, b) => a - b);
  const slots: PagerSlot[] = [];

  pages.forEach((value, index) => {
    const previous = pages[index - 1];
    if (previous !== undefined) {
      if (value - previous === 2) slots.push({ kind: 'page', page: previous + 1 });
      else if (value - previous > 2) slots.push({ kind: 'gap', key: `gap-${previous}` });
    }
    slots.push({ kind: 'page', page: value });
  });

  return slots;
}

/**
 * How many rows a query matches, asked of an API that only returns rows.
 *
 * `rows(limit, offset)` answers how many rows came back for that window. The
 * search is the classic one — double the offset until a window is empty, halve
 * the bracket until it fits in one request, then read that request's length —
 * so the answer is exact and costs about `2·log2(count / batch)` small requests:
 * one for anything under `batch`, a dozen for ten thousand, about twenty for a
 * quarter of a million.
 *
 * `ceiling` bounds the doubling, so a source that never runs dry (or a `rows`
 * that ignores its offset) ends at a number instead of never ending.
 */
export async function countByProbing(
  rows: (limit: number, offset: number) => Promise<number>,
  { batch = COUNT_BATCH, ceiling = 4_000_000 }: { batch?: number; ceiling?: number } = {}
): Promise<number> {
  const first = await rows(batch, 0);
  if (first < batch) return first;

  /* `known` is an index that holds a row; `empty` is one that does not. */
  let known = batch - 1;
  let empty = batch * 2;
  while ((await rows(1, empty)) > 0) {
    known = empty;
    if (empty >= ceiling) return empty + 1;
    empty *= 2;
  }

  while (empty - known > batch) {
    const middle = Math.floor((known + empty) / 2);
    if ((await rows(1, middle)) > 0) known = middle;
    else empty = middle;
  }

  /* Everything from the last index known to hold a row, to the end. */
  return known + (await rows(batch, known));
}
