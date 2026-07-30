import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { useState } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { GameSearchResults, MIN_QUERY_LENGTH } from '@/components/game-search-results';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';
import { useTheme } from '@/hooks/use-theme';
import { searchProfiles } from '@/lib/api';
import { displayNameFor } from '@/lib/format';

type SearchMode = 'games' | 'people';

export default function SearchScreen() {
  const theme = useTheme();
  const [mode, setMode] = useState<SearchMode>('games');
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());
  const isQueryable = query.length >= MIN_QUERY_LENGTH;

  const people = useQuery({
    queryKey: ['search', 'people', query],
    queryFn: () => searchProfiles(query),
    enabled: mode === 'people' && isQueryable,
  });

  return (
    <Screen edges={[]}>
      {/* One text field for both modes, so switching from Games to People
          re-runs the term you already typed rather than clearing it. */}
      <View style={styles.header}>
        <TextField
          value={input}
          onChangeText={setInput}
          placeholder={mode === 'games' ? 'Search games…' : 'Search people…'}
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />

        <View style={styles.modes}>
          {(['games', 'people'] as const).map((option) => {
            const selected = mode === option;
            return (
              <PressableScale
                key={option}
                onPress={() => setMode(option)}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                scaleTo={0.95}
                style={StyleSheet.flatten([
                  styles.mode,
                  {
                    // Same selected-is-lighter rule as every other control.
                    backgroundColor: selected ? theme.surfaceSelected : theme.surfaceElevated,
                    borderColor: selected ? theme.borderStrong : theme.border,
                  },
                ])}>
                <Text variant="caption" color={selected ? 'text' : 'textMuted'}>
                  {option === 'games' ? 'Games' : 'People'}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      </View>

      {mode === 'games' ? (
        <GameSearchResults query={query} />
      ) : !isQueryable ? (
        <EmptyState
          title="Find people"
          message={`Search by username or display name. Type at least ${MIN_QUERY_LENGTH} characters.`}
        />
      ) : people.isLoading ? (
        <LoadingState />
      ) : people.isError ? (
        <ErrorState error={people.error} />
      ) : (
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
                style={StyleSheet.flatten([styles.personRow, { backgroundColor: theme.surface }])}>
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
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { padding: Spacing.four, gap: Spacing.three },
  modes: { flexDirection: 'row', gap: Spacing.two },
  mode: {
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.four,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  listContent: { padding: Spacing.four, gap: Spacing.two, paddingBottom: Spacing.seven },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.large,
  },
  personText: { flex: 1, gap: Spacing.half },
});
