import type { SearchScope } from '@/lib/search-history';

/** One thing the Search field can look through, and the words for it. */
export type ScopeInfo = {
  key: SearchScope;
  /** The name on the scope's tab. */
  label: string;
  /** What the field says while this scope is reading it. */
  placeholder: string;
};

/**
 * The seven kinds of thing Search finds, in the order the tabs list them.
 *
 * One statement of the vocabulary: the tabs under the field, the field's
 * placeholder and the history's "in Studios" all read it, so an eighth kind is
 * an entry here and a results component, and none of those drift.
 *
 * Games is first because it is where the tab rests: Discover until a title is
 * typed. The rest follow in the order they were asked for.
 */
export const SEARCH_SCOPE_INFO: readonly ScopeInfo[] = [
  { key: 'games', label: 'Games', placeholder: 'Search games…' },
  { key: 'reviews', label: 'Reviews', placeholder: 'Search reviews…' },
  { key: 'people', label: 'People', placeholder: 'Search people…' },
  { key: 'collections', label: 'Collections', placeholder: 'Search collections…' },
  { key: 'studios', label: 'Studios', placeholder: 'Search studios…' },
  { key: 'events', label: 'Events', placeholder: 'Search events…' },
  { key: 'platforms', label: 'Platforms', placeholder: 'Search platforms…' },
];

export function scopeInfo(scope: SearchScope): ScopeInfo {
  return SEARCH_SCOPE_INFO.find((entry) => entry.key === scope) ?? SEARCH_SCOPE_INFO[0];
}
