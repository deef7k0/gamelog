import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { memo } from 'react';
import { FlatList, StyleSheet, View } from 'react-native';

import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { copyStateLine, releaseLine } from '@/constants/physical';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getCopies, getProfile, type CopyWithRelations } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/** The box art on a row. Fixed dp, like all artwork (CLAUDE.md). */
const ROW_ART = 56;

/**
 * Someone's physical collection: every copy they own, newest first.
 *
 * `game` narrows it to one game's copies — "your copies of Resident Evil 2" —
 * which is where a game page's "Your copies" lands when there is more than one.
 *
 * Every row is the quick view, and only the quick view: the game, the release in
 * one line, the state in another. The detail — the barcode, the notes, what
 * "very good" means — is a tap away on the copy itself, so a shelf of two hundred
 * games stays a list you can scan.
 */
export default function CopiesScreen() {
  const theme = useTheme();
  const router = useRouter();
  const { user, game } = useLocalSearchParams<{ user: string; game?: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const isSelf = viewerId === user;

  const owner = useQuery({
    queryKey: ['profile', user],
    queryFn: () => getProfile(user!),
    enabled: !!user,
  });

  const copies = useQuery({
    queryKey: ['copies', user, game ?? 'all'],
    queryFn: () => getCopies(user!, game),
    enabled: !!user,
  });

  const count = copies.data?.length ?? 0;
  const gameTitle = game ? copies.data?.[0]?.game?.title : null;
  const ownerName = isSelf ? 'You' : displayNameFor(owner.data ?? null);

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      <FlatList
        data={copies.data ?? []}
        keyExtractor={(copy) => copy.id}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={
          <View style={styles.head}>
            <Text variant="h1" numberOfLines={2}>
              {gameTitle ? `Copies of ${gameTitle}` : 'Physical collection'}
            </Text>
            {copies.data && (
              <Text variant="label" color="textMuted">
                {`${ownerName === 'You' ? 'YOUR' : `${ownerName.toUpperCase()}’S`} ${count} ${
                  count === 1 ? 'COPY' : 'COPIES'
                }`}
              </Text>
            )}

            {isSelf && (
              <Link href="/submissions" asChild>
                <PressableScale
                  accessibilityRole="link"
                  accessibilityLabel="Your barcode submissions"
                  hitSlop={Spacing.x8}
                  scaleTo={0.98}
                  style={styles.submissions}>
                  <Ionicons name="barcode-outline" size={14} color={theme.textSecondary} />
                  <Text variant="bodySmall" color="textSecondary">
                    Your barcode submissions
                  </Text>
                </PressableScale>
              </Link>
            )}

            {isSelf && (
              <View style={styles.actions}>
                <View style={styles.flex}>
                  <Button
                    title="Scan a barcode"
                    icon="barcode-outline"
                    variant="secondary"
                    fullWidth
                    onPress={() => router.push('/scan')}
                  />
                </View>
                <View style={styles.flex}>
                  <Button
                    title="Add by hand"
                    icon="add"
                    variant="secondary"
                    fullWidth
                    onPress={() =>
                      router.push(game ? { pathname: '/add-copy', params: { game } } : '/add-copy')
                    }
                  />
                </View>
              </View>
            )}
          </View>
        }
        renderItem={({ item }) => <CopyRow copy={item} />}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        ListEmptyComponent={
          copies.isLoading ? (
            <LoadingState />
          ) : copies.isError ? (
            <ErrorState error={copies.error} onRetry={() => void copies.refetch()} />
          ) : (
            <EmptyState
              title={isSelf ? 'Nothing on your shelf yet' : 'No physical copies yet'}
              message={
                isSelf
                  ? 'Scan the barcode on a box, or add a copy by hand — the release, what came with it and its condition.'
                  : `${ownerName} has not added any physical copies.`
              }
            />
          )
        }
      />
    </Screen>
  );
}

/**
 * The quick view: "Resident Evil 2 / PS1 · PAL / CIB · Very good".
 *
 * Memoised: this renders once per row of a list that can be a whole shelf long,
 * and its props are one query-owned object.
 */
const CopyRow = memo(function CopyRow({ copy }: { copy: CopyWithRelations }) {
  const theme = useTheme();
  const release = releaseLine(copy);
  const state = copyStateLine(copy);
  const waiting = !copy.release_id && copy.contribution?.status === 'pending';

  return (
    <Link href={{ pathname: '/copy/[id]', params: { id: copy.id } }} asChild>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          copy.game?.title,
          release,
          state,
          waiting ? 'release pending review' : null,
        ]
          .filter(Boolean)
          .join(', ')}
        scaleTo={0.98}
        style={StyleSheet.flatten([styles.row, { backgroundColor: theme.surface }])}>
        <Poster
          coverUrl={copy.game?.cover_url ?? null}
          heroUrl={copy.game?.hero_url ?? null}
          title={copy.game?.title ?? ''}
          width={ROW_ART}
          rounded="image"
        />
        <View style={styles.rowText}>
          <Text variant="h5" numberOfLines={2}>
            {copy.game?.title ?? 'Unknown game'}
          </Text>
          {!!release && (
            <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
              {release}
            </Text>
          )}
          {state && (
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {state}
            </Text>
          )}
          {waiting && (
            <View style={styles.pending}>
              <Ionicons name="time-outline" size={12} color={theme.textMuted} />
              <Text variant="caption" color="textMuted">
                Release pending review
              </Text>
            </View>
          )}
        </View>
        <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
      </PressableScale>
    </Link>
  );
});

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x8, marginBottom: Spacing.x24 },
  actions: { flexDirection: 'row', gap: Spacing.x8, marginTop: Spacing.x8 },
  submissions: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: Spacing.x4,
  },
  separator: { height: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 2 },
  pending: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
