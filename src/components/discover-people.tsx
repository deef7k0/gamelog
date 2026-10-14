import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { PersonRow } from '@/components/person-row';
import { ReadingNote } from '@/components/reading-note';
import { DropdownButton } from '@/components/ui/dropdown-button';
import { EmptyState, ErrorState, LoadingState } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useReadingLanguages } from '@/hooks/use-reading-languages';
import {
  getPopularMembers,
  getPopularPeople,
  getRecommendedPeople,
  getTopReviewers,
} from '@/lib/api';
import type { Profile } from '@/lib/database.types';
import {
  CHART_PERIODS,
  DEFAULT_CHART_PERIOD,
  PERIOD_WORDS,
  circleLine,
  popularityLine,
  readingKey,
  type ChartPeriod,
} from '@/lib/discovery';
import { useAuth } from '@/store/auth';

/** One person in a section, and the line that says why they are in it. */
type Listed = { profile: Profile; line: string };

/** The "Popular" section: its people, and whether it could be asked for a period. */
type PopularPeople = { people: Listed[]; windowed: boolean };

const likes = (count: number) => `${count} like${count === 1 ? '' : 's'}`;

/**
 * The People tab: four sections that deliberately rank differently.
 *
 * Each answers its own question, and somebody can top one and be absent from
 * the next — that difference is the information. A single merged "top users"
 * list would average them into a number that answers none.
 *
 *   Similar taste          the games you have both logged, scored alike  (0013)
 *   Popular with friends   who your circle follows, likes, replies to    (0038)
 *   Popular · a period     who drew the most likes, replies, followers   (0038)
 *   Most reviews           who writes the most                           (0013)
 *
 * **The two in the middle are Letterboxd's**, read from its API's documentation
 * (CLAUDE.md § Discovery): `MemberPopularity` over a week, a month, a year or
 * all time, and its `…WithFriends` twin, which is the same count taken among
 * the people you follow. "Popular" replaced "Most liked", which counted every
 * like since the first and so never changed hands.
 *
 * The first two are about the reader and lead. Both can be empty — taste needs
 * two games in common with somebody, and friends need somebody followed who
 * has followed or liked somebody else — and an empty section is absent, not a
 * heading over nothing.
 *
 * **Nobody is suggested for the language they write in unless the reader reads
 * it** (`useReadingLanguages`): somebody whose labelled reviews are all in
 * another language is left out of the two popularity sections, and the line
 * under the heading says which languages those are.
 *
 * On a database that has not run 0038 the screen is what it was: no friends
 * section, and "Most liked" with no period.
 */
export function DiscoverPeople() {
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const { reading, ready } = useReadingLanguages();
  const [period, setPeriod] = useState<ChartPeriod>(DEFAULT_CHART_PERIOD);

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

  /*
   * All time, and no control: this is not a chart to watch move, it is the
   * handful of people one step away. A follow your friend made last year is as
   * good a reason to look at somebody as one they made on Tuesday.
   */
  const friends = useQuery({
    queryKey: ['discover-people', 'friends', viewerId, readingKey(reading)],
    queryFn: async (): Promise<Listed[]> => {
      const members = await getPopularMembers({
        period: 'all',
        viewerId,
        circle: true,
        reading,
      });
      return (members ?? []).map((member) => ({ profile: member, line: circleLine(member) }));
    },
    enabled: !!viewerId && ready,
    staleTime: 10 * 60_000,
  });

  const popular = useQuery({
    queryKey: ['discover-people', 'popular', period, viewerId, readingKey(reading)],
    queryFn: async (): Promise<PopularPeople> => {
      const members = await getPopularMembers({ period, viewerId, reading });
      if (members) {
        return {
          windowed: true,
          people: members.map((member) => ({ profile: member, line: popularityLine(member) })),
        };
      }
      /* Before 0038: every like there has ever been, as this section was. */
      const liked = await getPopularPeople();
      return {
        windowed: false,
        people: liked.map((person) => ({ profile: person, line: likes(person.metric) })),
      };
    },
    enabled: ready,
    staleTime: 10 * 60_000,
    /* The last period's people stand while the chosen one arrives. */
    placeholderData: keepPreviousData,
  });

  /* `||`, not `&&`. With `&&` the page rendered as soon as *either* query
     resolved, so a slower section appeared as an absence rather than as
     something still arriving. `isPending` for the one that waits on the
     reader's languages: a query that has not started is not an empty one. */
  if (reviewers.isLoading || popular.isPending) return <LoadingState />;

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
  if (reviewers.isLoadingError || popular.isLoadingError) {
    return (
      <ErrorState
        error={reviewers.error ?? popular.error}
        onRetry={() => {
          recommended.refetch();
          friends.refetch();
          reviewers.refetch();
          popular.refetch();
        }}
      />
    );
  }

  const similar: Listed[] = (recommended.data ?? []).map((person) => ({
    profile: person,
    line:
      `${person.metric} game${person.metric === 1 ? '' : 's'} in common` +
      (person.affinity !== undefined ? ` · ${Math.round(person.affinity * 100)}% agreement` : ''),
  }));
  const writers: Listed[] = (reviewers.data ?? []).map((person) => ({
    profile: person,
    line: `${person.metric} review${person.metric === 1 ? '' : 's'}`,
  }));
  const popularPeople = popular.data?.people ?? [];
  const windowed = popular.data?.windowed ?? false;

  /* A period with nobody in it is not an empty app: the control that leaves it
     is in that section's heading, so the section — and the screen — stay. */
  const hasAnything =
    similar.length + (friends.data ?? []).length + writers.length + popularPeople.length > 0 ||
    (windowed && period !== 'all');

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
          /* Not while a period is being changed: that is the section's own
             business, and it says so by dimming. */
          refreshing={
            reviewers.isRefetching || (popular.isRefetching && !popular.isPlaceholderData)
          }
          onRefresh={() => {
            recommended.refetch();
            friends.refetch();
            reviewers.refetch();
            popular.refetch();
          }}
        />
      }>
      <Section
        title="Similar taste"
        hint="Based on games you have both logged, and how closely you scored them."
        people={similar}
      />

      <Section
        title="Popular with friends"
        hint="Followed, liked or replied to by people you follow — and not by you yet."
        people={friends.data ?? []}
        /* Narrowed by language as the section under it is, so it says so too:
           each statement is true where it stands. */
        note={reading ? <ReadingNote reading={reading} of="people" /> : null}
      />

      <Section
        title={windowed ? 'Popular' : 'Most liked'}
        /* "and posts" until now — posts were removed from the app, so the line
           described a feature that no longer exists. */
        hint={windowed ? 'Likes, replies and new followers.' : 'Total likes across their reviews.'}
        people={popularPeople}
        settling={popular.isPlaceholderData}
        /* Kept over an empty period: it is the way out of it. */
        keep={windowed}
        empty={`Nobody drew a like, a reply or a follower ${PERIOD_WORDS[period]}.`}
        trailing={
          windowed ? (
            <DropdownButton
              label="Period"
              size="small"
              value={period}
              options={CHART_PERIODS}
              onChange={setPeriod}
            />
          ) : null
        }
        note={windowed && reading ? <ReadingNote reading={reading} of="people" /> : null}
      />

      <Section title="Most reviews" hint="Who writes the most." people={writers} />
    </ScrollView>
  );
}

function Section({
  title,
  hint,
  people,
  trailing,
  note,
  keep = false,
  empty,
  settling = false,
}: {
  title: string;
  hint: string;
  people: Listed[];
  /** One small control at the far end of the title's line — the period. */
  trailing?: ReactNode;
  /** A line under the hint: which languages the section is in. */
  note?: ReactNode;
  /** Draw the heading even with nobody under it, and say `empty` there. */
  keep?: boolean;
  empty?: string;
  /** The rows are the last answer's, and the next is on its way. */
  settling?: boolean;
}) {
  if (people.length === 0 && !keep) return null;

  return (
    <View style={styles.section}>
      <View style={styles.sectionHead}>
        <View style={styles.sectionTitle}>
          {/* `h2` per DESIGN.md § 17. This was `h4` — 14px against the `h3` and
              `h5` two other Discover surfaces were using, which is how one screen
              ended up announcing its bands four different ways. */}
          <Text variant="h2" accessibilityRole="header" style={styles.sectionName}>
            {title}
          </Text>
          {trailing}
        </View>
        <Text variant="bodySmall" color="textMuted">
          {hint}
        </Text>
        {note}
      </View>

      {people.length === 0 && empty ? (
        <Text variant="body" color="textSecondary" style={styles.empty}>
          {empty}
        </Text>
      ) : null}

      {/* `<PersonRow>` rather than a fourth hand-written copy of it. The
          component was extracted *because* this file and the search tab had
          duplicated the row, and then neither caller was migrated — so the same
          list of people announced itself three different ways depending on which
          screen you reached it from. The line that says why somebody is here
          goes in `trailing`, which is what that slot is for. */}
      <View style={settling ? styles.settling : undefined}>
        {people.map(({ profile, line }, index) => (
          <PersonRow
            key={profile.id}
            profile={profile}
            divided={index > 0}
            trailing={
              <Text variant="bodySmall" color="textMuted" numberOfLines={2} style={styles.line}>
                {line}
              </Text>
            }
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48, gap: Spacing.x24 },
  section: { gap: Spacing.x4 },
  sectionHead: { gap: 2, paddingBottom: Spacing.x8 },
  sectionTitle: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  sectionName: { flex: 1 },
  empty: { paddingVertical: Spacing.x12 },
  settling: { opacity: 0.5 },
  /* The reason never crowds the name out of its own row: it gives way first. */
  line: { flexShrink: 1, maxWidth: '52%', textAlign: 'right' },
});
