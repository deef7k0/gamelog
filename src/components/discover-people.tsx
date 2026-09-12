import { useQuery } from '@tanstack/react-query';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { getPopularPeople, getRecommendedPeople, getTopReviewers } from '@/lib/api';
import type { RankedProfile } from '@/lib/api';
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

  /* `||`, not `&&`. With `&&` the page rendered as soon as *either* query
     resolved, so a slower section appeared as an absence rather than as
     something still arriving. */
  if (reviewers.isLoading || popular.isLoading) return <LoadingState />;

  /*
   * The error branch has to come *before* the emptiness check, and this is the
   * whole reason it exists.
   *
   * Without it a failed RPC left both arrays empty, `hasAnything` false, and the
   * screen told the reader "Nobody here yet — once people start reviewing games,
   * they will show up in these lists." That is a claim about the product's user
   * base made on the strength of a dropped connection, to the one person who
   * cannot check it — and on a product that genuinely has no users yet, it is
   * indistinguishable from the truth, so the failure was invisible. The same
   * mistake was found and argued out in `lib/games/index.ts`; this is the other
   * place it was live.
   */
  if (reviewers.isError || popular.isError) {
    return (
      <ErrorState
        error={reviewers.error ?? popular.error}
        onRetry={() => {
          recommended.refetch();
          reviewers.refetch();
          popular.refetch();
        }}
      />
    );
  }

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
        /* "and posts" until now — posts were removed from the app, so the line
           described a feature that no longer exists. */
        hint="Total likes across their reviews."
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
  if (people.length === 0) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        {/* `h2` per DESIGN.md § 17. This was `h4` — 14px against the `h3` and
            `h5` two other Discover surfaces were using, which is how one screen
            ended up announcing its bands four different ways. */}
        <Text variant="h2" accessibilityRole="header">
          {title}
        </Text>
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
      </View>

      {/* `<PersonRow>` rather than a fourth hand-written copy of it. The
          component was extracted *because* this file and the search tab had
          duplicated the row, and then neither caller was migrated — so the same
          list of people announced itself three different ways depending on which
          screen you reached it from. The metric line goes in `trailing`, which
          is what that slot is for. */}
      {people.map((person, index) => (
        <PersonRow
          key={person.id}
          profile={person}
          divided={index > 0}
          trailing={
            <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
              {describe(person)}
            </Text>
          }
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x24 },
  section: { gap: Spacing.x4 },
  sectionHead: { gap: 2, paddingBottom: Spacing.x8 },
});
