import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, keepPreviousData, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  Platform,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { DiscoverFeed } from '@/components/discover-feed';
import { DiscoverPeople } from '@/components/discover-people';
import { GameSearchResults, MIN_QUERY_LENGTH } from '@/components/game-search-results';
import { PersonRow } from '@/components/person-row';
import { SearchHistory } from '@/components/search-history';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { searchProfiles } from '@/lib/api';
import {
  addSearchHistory,
  clearSearchHistory,
  loadSearchHistory,
  removeSearchHistory,
  type SearchScope,
} from '@/lib/search-history';
import { useAuth } from '@/store/auth';

/**
 * How long a query has to stand still before it counts as a search worth
 * remembering.
 *
 * Longer than the debounce on purpose. 350ms is "stop typing for a moment";
 * this is "stop and look at what came back". Recording on the debounce instead
 * would fill the history with the keystrokes on the way to a search rather than
 * the search — and while `addSearchHistory` collapses prefixes and would tidy
 * most of that up, a term abandoned halfway is not something anyone meant to ask.
 */
const HISTORY_RECORD_MS = 1400;

const SCOPES = [
  { key: 'games' as const, label: 'Games' },
  { key: 'people' as const, label: 'People' },
];

/**
 * Search: a field, and the two things it can look through.
 *
 * ## Why there are two of these and not four
 *
 * There were four tabs — Discover, Reviews, Collections, People — and only two
 * of them could be searched. Reviews and Collections were global popularity
 * charts with no relationship to the field at all, so the screen hid its own
 * primary control on half of its own tabs, and the code carried a `searchable`
 * flag and a long comment to explain the asymmetry away.
 *
 * A tab bar's contract is "same kind of thing, different slice". Two searches
 * and two leaderboards is not that. The charts are bands inside Discover now,
 * each with a page behind its "See all" (`/reviews`, `/collections`), which is
 * where Home was already sending people. What is left is a genuine pair of
 * scopes, and three separate defects went with the tabs:
 *
 *   - **The field no longer disappears.** It was conditionally rendered, so
 *     switching to a chart collapsed the header by a full tap target and the
 *     control row jumped ~48dp out from under the thumb that had just tapped it.
 *   - **A query can no longer strand itself.** Carrying the term across a tab
 *     that could not use it meant typing a game name, tabbing to People, and
 *     being shown "nobody matching Elden Ring" — a zero result the reader never
 *     asked for, in place of the charts the tab existed to show.
 *   - **The `?tab=` deep link is gone rather than broken.** It was read once in
 *     a `useState` initialiser, and Expo Router keeps a tab mounted, so it
 *     stopped working the moment anyone opened Search a second time. Reviews and
 *     Collections are real routes now, so linking to them is a link.
 *
 * Sharing one field between the two remaining scopes is still right, and now
 * unambiguous: both can use the term, and the placeholder names which one is
 * reading it.
 *
 * Every scope has content before you type. A search screen whose empty state is
 * "type at least two characters" is a screen that does nothing most of the time
 * it is open.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const [scope, setScope] = useState<SearchScope>('games');
  const [input, setInput] = useState('');
  /* Focus is the signal for "about to search", which is what the history
     answers. Tracked here rather than read off the input, because the panel it
     controls is a sibling of the field, not a child. */
  const [focused, setFocused] = useState(false);
  const query = useDebouncedValue(input.trim());
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const history = useQuery({
    queryKey: ['search-history', userId],
    queryFn: () => loadSearchHistory(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  /*
   * Remember a search once it has been left alone long enough to have been read.
   *
   * An effect rather than a call inside the results component: the two scopes
   * search through different code paths and both should be remembered, and
   * threading a callback down through `<GameSearchResults>` would give a shared
   * picker component a reason to know about the Search tab's history.
   */
  useEffect(() => {
    if (!userId || !isQueryable) return;

    const timer = setTimeout(() => {
      void addSearchHistory(userId, query, scope).then(() =>
        queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
      );
    }, HISTORY_RECORD_MS);

    return () => clearTimeout(timer);
  }, [userId, isQueryable, query, scope, queryClient]);

  function refreshHistory() {
    queryClient.invalidateQueries({ queryKey: ['search-history', userId] });
  }

  const entries = history.data ?? [];

  /* The panel takes over only when there is nothing to show results for and
     something to offer instead — an empty history would leave a focused field
     above a blank screen, which is worse than the browse content it replaced. */
  const showHistory = focused && !isQueryable && entries.length > 0;

  const people = useQuery({
    queryKey: ['search', 'people', query],
    queryFn: ({ signal }) => searchProfiles(query, signal),
    enabled: scope === 'people' && isQueryable,
    /* Results refine instead of vanishing. Every debounce tick is a new key, so
       without this each pause mid-word tore the list down to a spinner and built
       it again — search felt like it was losing your results rather than
       narrowing them. */
    placeholderData: keepPreviousData,
  });

  /*
   * Is the screen busy on the reader's behalf right now?
   *
   * `input !== query` is the debounce window, and it is the half that had no
   * feedback at all: for 350ms after a keystroke the screen sat completely inert
   * showing the previous answer, which reads as "it did not register that I
   * typed". The glyph in the field covers that gap and the fetch after it as one
   * continuous state, because to the reader it is one.
   */
  const searching = input.trim() !== query || (scope === 'people' && people.isFetching);

  function renderResults() {
    if (showHistory) {
      return (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.historyContent}>
          <SearchHistory
            entries={entries}
            onSelect={(entry) => {
              /* Restores the scope as well as the term — a search is both. */
              setScope(entry.scope);
              setInput(entry.term);
              Keyboard.dismiss();
              setFocused(false);
            }}
            onFill={(entry) => {
              setScope(entry.scope);
              setInput(entry.term);
            }}
            onRemove={(entry) => {
              if (!userId) return;
              void removeSearchHistory(userId, entry.term).then(refreshHistory);
            }}
            onClear={() => {
              if (!userId) return;
              void clearSearchHistory(userId).then(refreshHistory);
            }}
          />
        </ScrollView>
      );
    }

    if (scope === 'people') {
      /* Untyped, People is three ranked charts; typed, it is a name search.
         Same scope, because "find someone" is one intention with two routes. */
      if (!isQueryable) return <DiscoverPeople />;
      if (people.isLoading) return <LoadingState />;
      if (people.isError) {
        return <ErrorState error={people.error} onRetry={() => people.refetch()} />;
      }

      return (
        <FlatList
          data={people.data ?? []}
          keyExtractor={(profile) => profile.id}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          contentContainerStyle={styles.listContent}
          /* `<PersonRow>`, not a fourth hand-rolled copy — the component was
             extracted because this screen and `discover-people` had duplicated
             it, and then neither caller was migrated. */
          renderItem={({ item, index }) => <PersonRow profile={item} divided={index > 0} />}
          ListEmptyComponent={
            <EmptyState
              title="No people found"
              message={`Nobody matching “${query}”. Try their @handle, or search Games instead.`}
            />
          }
        />
      );
    }

    /* Discover *is* the empty state. Before you have typed anything, the most
       useful thing this screen can do is answer "what should I play next"
       rather than tell you to type at least two characters. */
    return isQueryable ? <GameSearchResults query={query} /> : <DiscoverFeed />;
  }

  return (
    /*
     * No `topBar` and no `insetHeader`.
     *
     * There was a `<FrostedTopBar />` here with no `back`, no `dismiss` and no
     * `right` — which returns `null` — while `insetHeader` went on reserving
     * `inset + 56`, about 103dp on iOS, for a component that drew nothing. Search
     * is a root tab with nothing to go back to, so it takes the top edge the way
     * Home does and spends the band on content.
     */
    <Screen edges={['top']}>
      <View style={styles.header}>
        <TextField
          value={input}
          onChangeText={setInput}
          icon="search"
          placeholder={scope === 'games' ? 'Search games…' : 'Search people…'}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          /* The Search key was inert — it dismissed the keyboard as a side
             effect of nothing being wired to it. Results are already live as
             you type, so committing *is* getting the keyboard out of the way;
             saying so explicitly makes the key's behaviour a decision. */
          onSubmitEditing={() => {
            /* Submitting is a definite search, so it is remembered immediately
               rather than waiting out `HISTORY_RECORD_MS`. */
            if (userId && isQueryable) {
              void addSearchHistory(userId, query, scope).then(refreshHistory);
            }
            Keyboard.dismiss();
            setFocused(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={scope === 'games' ? 'Search games' : 'Search people'}
          /* Two jobs, one slot, and they cannot both apply at once: progress
             while a search is in flight, otherwise a way to empty the field.
             `clearButtonMode` is **iOS-only** — on Android the only way out of a
             thirty-character query was holding backspace. */
          trailing={
            searching ? (
              <ActivityIndicator size="small" color={theme.textMuted} />
            ) : Platform.OS !== 'ios' && input.length > 0 ? (
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Clear the search"
                onPress={() => setInput('')}
                scaleTo={0.85}>
                <Ionicons name="close-circle" size={20} color={theme.textMuted} />
              </PressableScale>
            ) : undefined
          }
        />

        {/* Under the field, iOS scope-bar style: the placeholder already names
            the scope, so the two agree wherever the eye lands first. */}
        <TabBar tabs={SCOPES} value={scope} onChange={setScope} label="What to search" />
      </View>

      {renderResults()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x16, gap: Spacing.x8 },
  /* `flexGrow: 1` so the empty state can centre itself rather than pinning to
     the top of a content-sized container. */
  listContent: { padding: Spacing.x16, paddingBottom: Spacing.x48, flexGrow: 1 },
  historyContent: { paddingBottom: Spacing.x48 },
});
