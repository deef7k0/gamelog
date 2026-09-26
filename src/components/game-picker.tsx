import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameSearchResults } from '@/components/game-search-results';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Spacing } from '@/constants/theme';
import { useDebouncedValue } from '@/hooks/use-debounced-value';

export type GamePickerProps = {
  /** The screen's heading — there is no title bar to carry it (CLAUDE.md). */
  heading: string;
  /** What the prompt under the field asks for before anything is typed. */
  prompt: { title: string; message?: string };
  onPick: (gameId: string) => void;
};

/**
 * "Which game?" — a search field over `<GameSearchResults>`, returning an id.
 *
 * The picking half of a flow, never the browsing half: `onSelect` is set, so a
 * row returns its game instead of opening its page (CLAUDE.md, "Picking a game
 * is not browsing for one"). Returns the id rather than the result row because
 * the callers need a full `Game` — for `cacheGame`, and for the platform list a
 * search row does not carry — and fetch it themselves with `getGameById`.
 *
 * Shared by the add-a-copy and add-a-release flows, which both start with this
 * question when they were not opened from a game.
 */
export function GamePicker({ heading, prompt, onPick }: GamePickerProps) {
  const [input, setInput] = useState('');
  const query = useDebouncedValue(input.trim());

  return (
    <View style={styles.flex}>
      <View style={styles.head}>
        <Text variant="h1">{heading}</Text>
        <TextField
          value={input}
          onChangeText={setInput}
          placeholder="Search games…"
          autoCapitalize="none"
          autoCorrect={false}
          autoFocus
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
      </View>
      <GameSearchResults query={query} onSelect={(game) => onPick(game.id)} prompt={prompt} />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { padding: Spacing.x16, gap: Spacing.x12 },
});
