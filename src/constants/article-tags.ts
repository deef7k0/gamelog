import type { ArticleTag } from '@/lib/database.types';

/**
 * The closed tag vocabulary for articles.
 *
 * Deliberately fixed rather than free-form: open tagging fragments immediately
 * ("guide" / "Guide" / "guides") and makes filtering worthless. The same list is
 * enforced by a CHECK constraint in migration 0007 — keep the two in step.
 */
export const ARTICLE_TAGS: { key: ArticleTag; label: string }[] = [
  { key: 'guide', label: 'Guide' },
  { key: 'discussion', label: 'Discussion' },
  { key: 'game-theory', label: 'Game Theory' },
  { key: 'retrospective', label: 'Retrospective' },
  { key: 'why-you-should-play', label: 'Why You Should Play' },
  { key: 'review', label: 'Review' },
  { key: 'news', label: 'News' },
  { key: 'opinion', label: 'Opinion' },
  { key: 'tier-list', label: 'Tier List' },
];

const LABELS = new Map(ARTICLE_TAGS.map((tag) => [tag.key, tag.label]));

export function tagLabel(tag: string): string {
  return LABELS.get(tag as ArticleTag) ?? tag;
}

/** Rough reading time, at an unhurried 200 words per minute. */
export function readingMinutes(body: string): number {
  const words = body.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

export const MAX_POST_LENGTH = 5000;
export const MAX_ARTICLE_LENGTH = 40000;
