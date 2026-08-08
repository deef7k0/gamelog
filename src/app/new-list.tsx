import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createList, type ListKind } from '@/lib/api';
import { useAuth } from '@/store/auth';

type Shape = { kind: ListKind; label: string; hint: string; ranked: boolean };

/** Favourites and wishlist are singletons created on demand, so not offered here. */
const SHAPES: Shape[] = [
  { kind: 'list', label: 'Collection', hint: 'An unordered set of games', ranked: false },
  { kind: 'list', label: 'Ranked list', hint: 'Numbered, best to worst', ranked: true },
  { kind: 'tier', label: 'Tier list', hint: 'Sort games into S–F tiers', ranked: false },
];

export default function NewListScreen() {
  const theme = useTheme();
  const router = useRouter();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [shapeIndex, setShapeIndex] = useState(0);

  const create = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      const shape = SHAPES[shapeIndex];
      return createList(userId, {
        title,
        description,
        kind: shape.kind,
        isRanked: shape.ranked,
      });
    },
    onSuccess: (listId) => {
      queryClient.invalidateQueries({ queryKey: ['lists'] });
      router.replace({ pathname: '/list/[id]', params: { id: listId } });
    },
  });

  return (
    <Screen edges={['bottom']} padded>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <TextField
            label="Title"
            value={title}
            onChangeText={setTitle}
            placeholder="Best horror games"
            maxLength={100}
            autoFocus
          />

          <TextField
            label="Description"
            value={description}
            onChangeText={setDescription}
            placeholder="What ties these together?"
            multiline
            maxLength={1000}
            hint="Optional"
          />

          <View style={styles.section}>
            <Text variant="caption" color="textSecondary">
              Type
            </Text>
            <View style={styles.shapes}>
              {SHAPES.map((shape, index) => {
                const selected = shapeIndex === index;
                return (
                  <PressableScale
                    key={shape.label}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => setShapeIndex(index)}
                    scaleTo={0.97}
                    style={StyleSheet.flatten([
                      styles.shape,
                      {
                        backgroundColor: selected ? theme.surfaceSelected : theme.surfaceElevated,
                        borderColor: selected ? theme.borderStrong : theme.border,
                      },
                    ])}>
                    <Text variant="bodyStrong" color={selected ? 'text' : 'textSecondary'}>
                      {shape.label}
                    </Text>
                    <Text variant="micro" color="textMuted">
                      {shape.hint}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {create.isError && (
            <Text variant="caption" color="danger">
              {create.error instanceof Error ? create.error.message : 'Could not create the list.'}
            </Text>
          )}

          <Button
            title="Create collection"
            onPress={() => create.mutate()}
            loading={create.isPending}
            disabled={!title.trim()}
            fullWidth
          />
        </ScrollView>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { gap: Spacing.x16, paddingVertical: Spacing.x24 },
  section: { gap: Spacing.x8 },
  shapes: { gap: Spacing.x8 },
  shape: {
    padding: Spacing.x16,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
