import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { PressableScale } from '@/components/ui/pressable-scale';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { RICH_TEXT_HINT } from '@/components/ui/rich-text';
import { Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { TextField } from '@/components/ui/text-field';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { createAwardsList, createList, type ListKind } from '@/lib/api';
import { useAuth } from '@/store/auth';

type Shape = { kind: ListKind; label: string; hint: string; ranked: boolean };

/** Favourites and wishlist are singletons created on demand, so not offered here. */
const SHAPES: Shape[] = [
  { kind: 'list', label: 'Collection', hint: 'An unordered set of games', ranked: false },
  { kind: 'list', label: 'Ranked list', hint: 'Numbered, best to worst', ranked: true },
  { kind: 'tier', label: 'Tier list', hint: 'Sort games into S–F tiers', ranked: false },
  {
    kind: 'captioned',
    label: 'Captioned board',
    hint: 'A line of your own under each cover',
    ranked: false,
  },
  {
    kind: 'awards',
    label: 'Award show',
    hint: 'Categories with a winner and your reasons',
    ranked: false,
  },
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

      /* An award show is created by an RPC, not an insert: it arrives with its
         eight categories already in place, and a list that existed with half a
         ballot would be worse than one that failed. The function reads
         `auth.uid()` itself, which is why `userId` is only checked here. */
      if (shape.kind === 'awards') {
        return createAwardsList({ title, description });
      }

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
    /* `modal`: an iOS sheet already begins below the status bar, so the bar must
       not inset itself again — see `useTopBarInset`. `dismiss` for the same
       reason the chevron is wrong here: a sheet closes, it does not go back. */
    <Screen edges={['bottom']} padded insetHeader modal topBar={<FrostedTopBar dismiss />}>
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

          {/* Tall enough to write in. This is the collection's argument, not a
              caption, and a field one line deep tells you to write one line. */}
          <TextField
            label="About"
            value={description}
            onChangeText={setDescription}
            placeholder="What ties these together?"
            multiline
            maxLength={1000}
            hint={RICH_TEXT_HINT}
            style={styles.about}
          />

          <View style={styles.section}>
            <Text variant="bodySmall" color="textSecondary">
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
                    <Text variant="h5" color={selected ? 'text' : 'textSecondary'}>
                      {shape.label}
                    </Text>
                    <Text variant="caption" color="textMuted">
                      {shape.hint}
                    </Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {create.isError && (
            <Text variant="bodySmall" color="danger">
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
  about: { minHeight: 120, maxHeight: 260 },
  section: { gap: Spacing.x8 },
  shapes: { gap: Spacing.x8 },
  shape: {
    padding: Spacing.x16,
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    gap: 2,
  },
});
