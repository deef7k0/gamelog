import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getPopularPeople, getRecommendedPeople, getTopReviewers } from '@/lib/api';
import type { RankedProfile } from '@/lib/api';
import { displayNameFor } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * The People tab: three sections that deliberately rank differently.
 *
 * "Most reviews" is volume and "Most liked" is reception — someone can top one
 * and be absent from the other, and that difference is the information. A
 * single merged "top users" list would average the two into a number that
 * answers neither question.
 *
 * Recommended leads, because it is the only section whose answer is about the
 * reader. It is also the only one that can be empty: it needs at least two
 * games in common with somebody, so a new account sees the other two until it
 * has logged enough for taste to mean anything.
 */
export function DiscoverPeople() {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const recommended = useQuery({
    queryKey: ['discover-people', 'recommended', viewerId],
    queryFn: () => getRecommendedPeople(viewerId!),
    enabled: !!viewerId,
    staleTime: 10 * 60_000,
  });

  const reviewers = useQuery({
    queryKey: ['discover-people', 'reviewers'],
    queryFn: () => getTopReviewers(),
    staleTime: 10 * 60_000,
  });

  const popular = useQuery({
    queryKey: ['discover-people', 'popular'],
    queryFn: () => getPopularPeople(),
    staleTime: 10 * 60_000,
  });

  const loading = reviewers.isLoading && popular.isLoading;
  if (loading) return <LoadingState />;

  const hasAnything =
    (recommended.data ?? []).length + (reviewers.data ?? []).length + (popular.data ?? []).length >
    0;

  if (!hasAnything) {
    return (
      <EmptyState
        title="Nobody here yet"
        message="Once people start reviewing games, they will show up in these lists."
      />
    );
  }

  return (
    <ScrollView
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        <RefreshControl
          refreshing={reviewers.isRefetching || popular.isRefetching}
          onRefresh={() => {
            recommended.refetch();
            reviewers.refetch();
            popular.refetch();
          }}
        />
      }>
      {(recommended.data ?? []).length > 0 && (
        <Section
          title="Similar taste"
          hint="Based on games you have both logged, and how closely you scored them."
          people={recommended.data ?? []}
          describe={(person) =>
            `${person.metric} game${person.metric === 1 ? '' : 's'} in common` +
            (person.affinity !== undefined
              ? ` · ${Math.round(person.affinity * 100)}% agreement`
              : '')
          }
        />
      )}

      <Section
        title="Most reviews"
        hint="Who writes the most."
        people={reviewers.data ?? []}
        describe={(person) => `${person.metric} review${person.metric === 1 ? '' : 's'}`}
      />

      <Section
        title="Most liked"
        hint="Total likes across their reviews and posts."
        people={popular.data ?? []}
        describe={(person) => `${person.metric} like${person.metric === 1 ? '' : 's'}`}
      />
    </ScrollView>
  );
}

function Section({
  title,
  hint,
  people,
  describe,
}: {
  title: string;
  hint: string;
  people: RankedProfile[];
  describe: (person: RankedProfile) => string;
}) {
  const theme = useTheme();
  if (people.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <Text variant="section">{title}</Text>
        <Text variant="micro" color="textMuted">
          {hint}
        </Text>
      </View>

      {people.map((person) => (
        <Link
          key={person.id}
          href={{ pathname: '/profile/[id]', params: { id: person.id } }}
          asChild>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${displayNameFor(person)}, ${describe(person)}`}
            scaleTo={0.99}
            style={StyleSheet.flatten([styles.row, { borderTopColor: theme.border }])}>
            <Avatar uri={person.avatar_url} name={displayNameFor(person)} size={44} />
            <View style={styles.rowText}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {displayNameFor(person)}
              </Text>
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                {describe(person)}
              </Text>
            </View>
          </PressableScale>
        </Link>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x24 },
  section: { gap: Spacing.x4 },
  sectionHead: { gap: 1, paddingBottom: Spacing.x8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  rowText: { flex: 1, gap: Spacing.x4 },
});
