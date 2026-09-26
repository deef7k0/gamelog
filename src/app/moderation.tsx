import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { ChoiceChips } from '@/components/choice-chips';
import { Button } from '@/components/ui/button';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { Poster } from '@/components/ui/poster';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { TabBar } from '@/components/ui/tab-bar';
import { Text } from '@/components/ui/text';
import { PHOTO_KIND_LABEL, releaseLine } from '@/constants/physical';
import { REPORT_REASON_LABEL } from '@/constants/similarity';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import {
  getPendingContributions,
  getSimilarityReports,
  isModerator,
  moderateContribution,
  moderateSimilarity,
  type ContributionWithRelations,
} from '@/lib/api';
import type { SimilarityReportQueueRow } from '@/lib/database.types';
import { displayBarcode } from '@/lib/barcode';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * Reasons a claim is turned down. Preset rather than typed: the contributor sees
 * the reason on their submissions screen, and a short, consistent one teaches
 * more than a moderator's shorthand.
 */
const REJECT_REASONS = [
  { value: 'wrong-game', label: 'Wrong game', note: 'The barcode belongs to a different game.' },
  {
    value: 'wrong-release',
    label: 'Wrong platform or region',
    note: 'The platform, region or edition does not match this barcode.',
  },
  {
    value: 'not-a-game',
    label: 'Not a game box',
    note: 'This barcode is not on a game’s packaging.',
  },
  { value: 'spam', label: 'Spam', note: 'Removed as spam.' },
] as const;

type RejectReason = (typeof REJECT_REASONS)[number]['value'];

const TABS = [
  { key: 'releases' as const, label: 'Releases' },
  { key: 'reports' as const, label: 'Reports' },
];

type ModerationTab = (typeof TABS)[number]['key'];

/**
 * The review queues for community data — barcode submissions and reported
 * recommendations. Moderators only.
 *
 * ## What a moderator is deciding
 *
 * Whether a barcode is what someone said it is. Most claims never reach this
 * screen's judgement at all: two independent people describing the same box the
 * same way approve it themselves (0024). The queue is what is left — claims no
 * one has seconded yet, and barcodes two people disagree about, which is why
 * every claim for the same barcode is shown together.
 *
 * The screen is a convenience, not the authority. `moderate_release_contribution`
 * checks `moderators` itself, so a non-moderator who found this route would be
 * refused by the database, not merely by the screen.
 *
 * Oldest first: first come, first judged.
 */
export default function ModerationScreen() {
  const userId = useAuth((state) => state.session?.user.id) ?? null;
  const [tab, setTab] = useState<ModerationTab>('releases');

  const moderator = useQuery({
    queryKey: ['is-moderator', userId],
    queryFn: isModerator,
    enabled: !!userId,
  });

  const queue = useQuery({
    queryKey: ['moderation-queue'],
    queryFn: () => getPendingContributions(50),
    enabled: moderator.data === true,
  });

  /* Only fetched once the tab is opened: most visits here are for the release
     queue, and reports are an RPC that aggregates across the whole table. */
  const reports = useQuery({
    queryKey: ['similarity-reports'],
    queryFn: getSimilarityReports,
    enabled: moderator.data === true && tab === 'reports',
  });

  if (moderator.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <LoadingState />
      </Screen>
    );
  }

  if (!moderator.data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Moderators only" message="This queue is for Gamelog’s moderators." />
      </Screen>
    );
  }

  /* How many claims share each barcode, so a disagreement reads as one. */
  const perBarcode = new Map<string, number>();
  for (const entry of queue.data ?? []) {
    perBarcode.set(entry.barcode, (perBarcode.get(entry.barcode) ?? 0) + 1);
  }

  const header = (
    <View style={styles.head}>
      <Text variant="h1">Moderation</Text>
      <TabBar tabs={TABS} value={tab} onChange={setTab} label="What to review" />
      {tab === 'releases' && queue.data && (
        <Text variant="label" color="textMuted">
          {queue.data.length === 0
            ? 'NOTHING WAITING'
            : `${queue.data.length} WAITING · OLDEST FIRST`}
        </Text>
      )}
      {tab === 'reports' && reports.data && (
        <Text variant="label" color="textMuted">
          {reports.data.length === 0
            ? 'NO OPEN REPORTS'
            : `${reports.data.length} REPORTED · HIDDEN ONES FIRST`}
        </Text>
      )}
    </View>
  );

  return (
    <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
      {tab === 'releases' ? (
        <FlatList
          data={queue.data ?? []}
          keyExtractor={(entry) => entry.id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <ClaimCard entry={item} siblings={(perBarcode.get(item.barcode) ?? 1) - 1} />
          )}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            queue.isLoading ? (
              <LoadingState />
            ) : queue.isError ? (
              <ErrorState error={queue.error} onRetry={() => void queue.refetch()} />
            ) : (
              <EmptyState
                title="The queue is empty"
                message="Every submission has been decided — or seconded by someone else with the same box."
              />
            )
          }
        />
      ) : (
        <FlatList
          data={reports.data ?? []}
          keyExtractor={(entry) => entry.similarity_id}
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={header}
          renderItem={({ item }) => <ReportCard entry={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          ListEmptyComponent={
            reports.isLoading ? (
              <LoadingState />
            ) : reports.isError ? (
              <ErrorState error={reports.error} onRetry={() => void reports.refetch()} />
            ) : (
              <EmptyState
                title="No open reports"
                message="Nobody has reported a community recommendation."
              />
            )
          }
        />
      )}
    </Screen>
  );
}

/**
 * A reported recommendation: the two games, how many people reported it and why.
 *
 * Three reports hide a pair on their own (0025), so a hidden one here is
 * waiting for a verdict — *keep it hidden* or *put it back*. Either closes the
 * reports; it takes three new ones to hide it again.
 */
function ReportCard({ entry }: { entry: SimilarityReportQueueRow }) {
  const theme = useTheme();
  const queryClient = useQueryClient();

  const decide = useMutation({
    mutationFn: (action: 'hide' | 'restore') => moderateSimilarity(entry.similarity_id, action),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['similarity-reports'] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', entry.game_a] });
      queryClient.invalidateQueries({ queryKey: ['community-similar', entry.game_b] });
    },
  });

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHead}>
        <Text variant="label" color={entry.status === 'hidden' ? 'danger' : 'textMuted'}>
          {entry.status === 'hidden' ? 'HIDDEN BY REPORTS' : 'STILL SHOWN'}
        </Text>
        <Text variant="label" color="textMuted">
          {`${entry.report_count} ${entry.report_count === 1 ? 'REPORT' : 'REPORTS'}`}
        </Text>
      </View>
      <Text variant="h4">
        {entry.game_a_title} ↔ {entry.game_b_title}
      </Text>
      <Text variant="bodySmall" color="textSecondary">
        {entry.reasons.map((reason) => REPORT_REASON_LABEL[reason]).join(' · ')}
      </Text>
      {entry.latest_note && (
        <Text variant="bodySmall" color="textSecondary">
          “{entry.latest_note}”
        </Text>
      )}
      <Text variant="caption" color="textMuted">
        First reported {timeAgo(entry.first_reported)}
      </Text>

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      <View style={styles.actions}>
        <View style={styles.flex}>
          <Button
            title={entry.status === 'hidden' ? 'Keep hidden' : 'Hide'}
            variant="secondary"
            size="small"
            fullWidth
            loading={decide.isPending && decide.variables === 'hide'}
            disabled={decide.isPending}
            onPress={() => decide.mutate('hide')}
          />
        </View>
        <View style={styles.flex}>
          <Button
            title={entry.status === 'hidden' ? 'Put it back' : 'Dismiss reports'}
            size="small"
            fullWidth
            loading={decide.isPending && decide.variables === 'restore'}
            disabled={decide.isPending}
            onPress={() => decide.mutate('restore')}
          />
        </View>
      </View>
    </View>
  );
}

function ClaimCard({ entry, siblings }: { entry: ContributionWithRelations; siblings: number }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<RejectReason | null>(null);

  const decide = useMutation({
    mutationFn: ({ decision, note }: { decision: 'approve' | 'reject'; note?: string }) =>
      moderateContribution(entry.id, decision, note),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['moderation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['barcode', entry.barcode] });
      queryClient.invalidateQueries({ queryKey: ['game-releases', entry.game_id] });
    },
  });

  const facts = [
    entry.publisher,
    entry.release_date,
    entry.catalog_number ? `Cat. ${entry.catalog_number}` : null,
  ].filter(Boolean);

  return (
    <View style={[styles.card, { backgroundColor: theme.surface }]}>
      <View style={styles.cardHead}>
        <Text variant="label" color="textMuted">
          BARCODE {displayBarcode(entry.barcode)}
        </Text>
        {siblings > 0 && (
          <Text variant="label" color="danger">
            {`${siblings} OTHER ${siblings === 1 ? 'CLAIM' : 'CLAIMS'}`}
          </Text>
        )}
      </View>

      <View style={styles.game}>
        <Poster
          coverUrl={entry.game?.cover_url ?? null}
          heroUrl={entry.game?.hero_url ?? null}
          title={entry.game?.title ?? ''}
          width={56}
          rounded="image"
        />
        <View style={styles.flex}>
          <Text variant="h4" numberOfLines={2}>
            {entry.game?.title ?? 'Unknown game'}
          </Text>
          <Text variant="body" color="textSecondary">
            {releaseLine(entry)} · {entry.edition}
          </Text>
          {facts.length > 0 && (
            <Text variant="caption" color="textMuted">
              {facts.join(' · ')}
            </Text>
          )}
        </View>
      </View>

      {entry.notes && (
        <Text variant="bodySmall" color="textSecondary">
          “{entry.notes}”
        </Text>
      )}

      {entry.photos.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.photos}>
          {entry.photos.map((photo) => (
            <View key={photo.id} style={styles.photo}>
              <Image
                source={{ uri: photo.url }}
                style={[styles.thumb, { backgroundColor: theme.surfaceElevated }]}
                contentFit="cover"
                accessible
                accessibilityLabel={PHOTO_KIND_LABEL[photo.kind]}
                accessibilityIgnoresInvertColors
              />
              <Text variant="caption" color="textMuted" numberOfLines={1}>
                {PHOTO_KIND_LABEL[photo.kind]}
              </Text>
            </View>
          ))}
        </ScrollView>
      )}

      <Text variant="caption" color="textMuted">
        Submitted by {displayNameFor(entry.profile)} · {timeAgo(entry.created_at)}
      </Text>

      {decide.isError && (
        <Text variant="bodySmall" color="danger">
          {decide.error instanceof Error ? decide.error.message : 'Could not record that.'}
        </Text>
      )}

      {rejecting ? (
        <View style={styles.reject}>
          <ChoiceChips
            label="Why not"
            choices={REJECT_REASONS.map(({ value, label }) => ({ value, label }))}
            value={reason}
            onChange={setReason}
          />
          <View style={styles.actions}>
            <View style={styles.flex}>
              <Button
                title="Back"
                variant="ghost"
                size="small"
                fullWidth
                onPress={() => {
                  setRejecting(false);
                  setReason(null);
                }}
              />
            </View>
            <View style={styles.flex}>
              <Button
                title="Reject"
                variant="danger"
                size="small"
                fullWidth
                disabled={!reason}
                loading={decide.isPending}
                onPress={() =>
                  decide.mutate({
                    decision: 'reject',
                    note: REJECT_REASONS.find((entry) => entry.value === reason)?.note,
                  })
                }
              />
            </View>
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <View style={styles.flex}>
            <Button
              title="Reject"
              variant="secondary"
              size="small"
              fullWidth
              disabled={decide.isPending}
              onPress={() => setRejecting(true)}
            />
          </View>
          <View style={styles.flex}>
            <Button
              title="Approve"
              size="small"
              fullWidth
              loading={decide.isPending}
              onPress={() => decide.mutate({ decision: 'approve' })}
            />
          </View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { padding: Spacing.x16, paddingBottom: Spacing.x48 },
  head: { gap: Spacing.x12, marginBottom: Spacing.x16 },
  separator: { height: Spacing.x12 },
  card: { gap: Spacing.x12, padding: Spacing.x16, borderRadius: Radius.card },
  cardHead: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.x8 },
  game: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'flex-start' },
  photos: { gap: Spacing.x8 },
  photo: { width: 72, gap: 2 },
  thumb: { width: 72, height: 72, borderRadius: Radius.image },
  reject: { gap: Spacing.x12 },
  actions: { flexDirection: 'row', gap: Spacing.x8 },
});
