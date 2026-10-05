import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Keyboard, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { useTabBarClearance } from '@/components/app-tab-bar';
import { DiscoverFeed } from '@/components/discover-feed';
import { GameSearchResults, MIN_QUERY_LENGTH } from '@/components/game-search-results';
import { CollectionResults } from '@/components/search/collection-results';
import { EventResults } from '@/components/search/event-results';
import { PeopleResults } from '@/components/search/people-results';
import { PlatformDirectory } from '@/components/search/platform-directory';
import { ReviewResults } from '@/components/search/review-results';
import { SEARCH_SCOPE_INFO, scopeInfo } from '@/components/search/search-scopes';
import { StudioResults } from '@/components/search/studio-results';
import { SearchHistory } from '@/components/search-history';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
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

/** The scopes as the tab row draws them. */
const SCOPE_TABS = SEARCH_SCOPE_INFO.map((scope) => ({ key: scope.key, label: scope.label }));

/**
 * Search: a field, and the seven things it can look through as tabs under it.
 *
 * ## The tabs are always there
 *
 * Games, Reviews, People, Collections, Studios, Events, Platforms — a row of
 * pills under the field (`<TabBar>`), on from the moment the tab opens, with
 * Games chosen. Each is its own list (`*Results`), with content before a word
 * is typed or a sentence saying why it has none; Games untyped is Discover — a
 * door to the release calendar, a way in by genre, what is popular, what is
 * rated.
 *
 * For one pass the tab rested on a menu instead: eight large buttons, one per
 * scope and one for the calendar, with the pills arriving only after a choice.
 * The owner took it out. A menu in front of the search is a tap before
 * anything can be seen, and it hid Discover — the screen's best answer to
 * "what should I play" — behind the first of its buttons. The scopes are tabs
 * again, and the calendar is a button at the top of Discover.
 *
 * ## One field, shared
 *
 * Every scope reads the same words. Switching from Games to Studios with
 * "nintendo" typed runs "nintendo" against studios, and the placeholder names
 * whichever scope is reading — so the field never disappears, never clears
 * behind the reader's back, and never strands a term in a scope that cannot
 * use it: all seven can.
 *
 * ## Recent searches answer the field being touched
 *
 * Focus is the signal for "about to search", so that is when the history takes
 * the place of whatever the scope was showing — and only while there is
 * nothing typed to show results for. Blurring the field brings the scope back.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const clearance = useTabBarClearance();
  const router = useRouter();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const [scope, setScope] = useState<SearchScope>('games');
  const [input, setInput] = useState('');
  /* Tracked here rather than read off the input, because the panel it controls
     is a sibling of the field, not a child. */
  const [focused, setFocused] = useState(false);
  const query = useDebouncedValue(input.trim());
  const isQueryable = query.length >= MIN_QUERY_LENGTH;
  const info = scopeInfo(scope);

  /* Platforms filter a list already in memory; every other scope asks a
     server, and those are the searches worth a spinner and a history row. */
  const remote = scope !== 'platforms';

  const history = useQuery({
    queryKey: ['search-history', userId],
    queryFn: () => loadSearchHistory(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  /*
   * Remember a search once it has been left alone long enough to have been read.
   *
   * An effect rather than a call inside the results components: six scopes
   * search through six code paths and all of them should be remembered, and
   * threading a callback down through each would give shared components a
   * reason to know about the Search tab's history.
   */
  useEffect(() => {
    if (!userId || !remote || !isQueryable) return;

    const timer = setTimeout(() => {
      void addSearchHistory(userId, query, scope).then(() =>
        queryClient.invalidateQueries({ queryKey: ['search-history', userId] })
      );
    }, HISTORY_RECORD_MS);

    return () => clearTimeout(timer);
  }, [userId, remote, isQueryable, query, scope, queryClient]);

  function refreshHistory() {
    queryClient.invalidateQueries({ queryKey: ['search-history', userId] });
  }

  /*
   * Tapping the Search tab while it is already open returns it to where it
   * rests — Games, nothing typed — the platform convention for a tab's own
   * button, as Home's returns to its top. Only then: arriving from another tab
   * keeps whatever search was left here.
   */
  useEffect(() => {
    const unsubscribe = navigation.addListener(
      // @ts-expect-error — `tabPress` is contributed by the Tabs navigator and
      // is not in the generic navigation event map this hook is typed against.
      'tabPress',
      () => {
        if (!navigation.isFocused()) return;
        Keyboard.dismiss();
        setInput('');
        setScope('games');
      }
    );
    return unsubscribe;
  }, [navigation]);

  const entries = history.data ?? [];

  /* The panel takes over only when there is nothing to show results for and
     something to offer instead — an empty history would leave a focused field
     above a blank screen, which is worse than the browse content it replaced.
     Never over Platforms: nothing is recorded from that scope, and its field
     filters the directory on the first letter. */
  const showHistory = focused && remote && !isQueryable && entries.length > 0;

  /*
   * Is the screen busy on the reader's behalf right now?
   *
   * `input !== query` is the debounce window, and it is the half that had no
   * feedback at all: for 350ms after a keystroke the screen sat completely inert
   * showing the previous answer, which reads as "it did not register that I
   * typed". Each results list shows its own fetch; the glyph in the field covers
   * the wait before one starts.
   */
  const searching = remote && input.trim() !== query;

  function renderBody() {
    if (showHistory) {
      return (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          contentContainerStyle={{ paddingBottom: Spacing.x48 + clearance }}>
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

    switch (scope) {
      case 'reviews':
        return <ReviewResults query={query} />;
      case 'people':
        return <PeopleResults query={query} />;
      case 'collections':
        return <CollectionResults query={query} />;
      case 'studios':
        return <StudioResults query={query} />;
      case 'events':
        return <EventResults query={query} />;
      case 'platforms':
        /* The field as it stands, not the settled query: this one filters a
           list in memory, so it can answer on the keystroke. */
        return <PlatformDirectory filter={input} />;
      default:
        /* Games, before a title is typed, is Discover: the most useful thing
           this scope can do then is answer "what should I play next". */
        return isQueryable ? <GameSearchResults query={query} layoutToggle /> : <DiscoverFeed />;
    }
  }

  return (
    /*
     * No `topBar` and no `insetHeader`.
     *
     * Search is a root tab with nothing to go back to, so it takes the top edge
     * the way Home does and spends the band on content.
     */
    <Screen edges={['top']}>
      <View style={styles.header}>
        <TextField
          value={input}
          onChangeText={setInput}
          icon="search"
          /* The pill: here the field *is* the screen's primary control. */
          variant="search"
          placeholder={info.placeholder}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          /* Results are already live as you type, so committing *is* getting
             the keyboard out of the way; saying so explicitly makes the key's
             behaviour a decision. */
          onSubmitEditing={() => {
            /* Submitting is a definite search, so it is remembered immediately
               rather than waiting out `HISTORY_RECORD_MS`. */
            if (userId && remote && isQueryable) {
              void addSearchHistory(userId, query, scope).then(refreshHistory);
            }
            Keyboard.dismiss();
            setFocused(false);
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          accessibilityLabel={`Search ${info.label.toLowerCase()}`}
          /* Three jobs, one slot, and they cannot apply at once: progress
             while a search is settling, otherwise a way to empty the field,
             otherwise — in Games, with nothing typed — the barcode scanner.
             `clearButtonMode` is **iOS-only** — on Android the only way out of
             a thirty-character query was holding backspace. */
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
            ) : scope === 'games' && input.length === 0 ? (
              /* Search by the box in your hand. A barcode resolves to a
                 specific release rather than a title, so it is its own screen
                 (`/scan`) rather than a mode of this one — and a field with a
                 query in it has no use for the button. */
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel="Scan a game's barcode"
                onPress={() => router.push('/scan')}
                hitSlop={Spacing.x8}
                scaleTo={0.85}>
                <Ionicons name="barcode-outline" size={22} color={theme.textSecondary} />
              </PressableScale>
            ) : undefined
          }
        />
      </View>

      {/* Under the field, iOS scope-bar style: the placeholder already names
          the scope, so the two agree wherever the eye lands first. Outside the
          header's padding: the bar brings the page margin itself. */}
      <TabBar tabs={SCOPE_TABS} value={scope} onChange={setScope} label="What to search" />

      {renderBody()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.x16, paddingTop: Spacing.x8 },
});
