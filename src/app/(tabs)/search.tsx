import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { DiscoverFeed } from '@/components/discover-feed';
import { DiscoverCollections, DiscoverReviews } from '@/components/discover-lists';
import { DiscoverPeople } from '@/components/discover-people';
import { GameSearchResults, MIN_QUERY_LENGTH } from '@/components/game-search-results';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { searchProfiles } from '@/lib/api';
import { displayNameFor } from '@/lib/format';

type SearchTab = 'discover' | 'reviews' | 'collections' | 'people';

const TABS = [
  { key: 'discover' as const, label: 'Discover' },
  { key: 'reviews' as const, label: 'Reviews' },
  { key: 'collections' as const, label: 'Collections' },
  { key: 'people' as const, label: 'People' },
];

/**
 * Search, and the four things you might be looking for.
 *
 * One text field across all four tabs, because the term you typed is still the
 * term you meant when you switch — clearing it on every tab change would punish
 * exactly the person who is exploring.
 *
 * What the field searches depends on the tab, and only two of them search at
 * all: Discover searches the game catalogue, People searches profiles. Reviews
 * and Collections are ranked charts with nothing to filter — typing there does
 * nothing, so those tabs hide the field rather than showing a box that ignores
 * you.
 *
 * Every tab has content before you type. A search screen whose empty state is
 * "type at least two characters" is a screen that does nothing most of the time
 * it is open.
 */
export default function SearchScreen() {
  const theme = useTheme();
  const [tab, setTab] = useState<SearchTab>('discover');
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const searchable = tab === 'discover' || tab === 'people';

  const people = useQuery({
    queryKey: ['search', 'people', query],
    queryFn: () => searchProfiles(query),
    enabled: tab === 'people' && isQueryable,
  });

  function renderTab() {
    switch (tab) {
      case 'reviews':
        return <DiscoverReviews />;

      case 'collections':
        return <DiscoverCollections />;

      case 'people':
        /* Untyped, People is three ranked charts; typed, it is a name search.
           Same tab, because "find someone" is one intention with two routes. */
        if (!isQueryable) return <DiscoverPeople />;
        if (people.isLoading) return <LoadingState />;
        if (people.isError) return <ErrorState error={people.error} />;
        return (
          <FlatList
            data={people.data ?? []}
            keyExtractor={(profile) => profile.id}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Link href={{ pathname: '/profile/[id]', params: { id: item.id } }} asChild>
                <PressableScale
                  accessibilityRole="button"
                  // Flattened — see the note in game-list-item.tsx.
                  style={StyleSheet.flatten([styles.personRow, { borderTopColor: theme.border }])}>
                  <Avatar uri={item.avatar_url} name={displayNameFor(item)} size={44} />
                  <View style={styles.personText}>
                    <Text variant="bodyStrong" numberOfLines={1}>
                      {displayNameFor(item)}
                    </Text>
                    <Text variant="caption" color="textMuted" numberOfLines={1}>
                      @{item.username}
                    </Text>
                  </View>
                </PressableScale>
              </Link>
            )}
            ListEmptyComponent={
              <EmptyState title="No people found" message={`Nobody matching “${query}”.`} />
            }
          />
        );

      default:
        /* Discover *is* the empty state. Before you have typed anything, the
           most useful thing this screen can do is answer "what should I play
           next" rather than tell you to type at least two characters. */
        return isQueryable ? <GameSearchResults query={query} /> : <DiscoverFeed />;
    }
  }

  return (
    <Screen edges={[]}>
      <View style={styles.header}>
        {searchable && (
          <TextField
            value={input}
            onChangeText={setInput}
            placeholder={tab === 'discover' ? 'Search games…' : 'Search people…'}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
            clearButtonMode="while-editing"
          />
        )}
      </View>

      <TabBar tabs={TABS} value={tab} onChange={setTab} />

      {renderTab()}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: Spacing.four, paddingTop: Spacing.four, gap: Spacing.three },
  listContent: { padding: Spacing.four, paddingBottom: Spacing.seven },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingVertical: Spacing.three,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  personText: { flex: 1, gap: Spacing.half },
});
