import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { GameCaseDisplay } from '@/components/game-case-display';
import { ReviewMeta } from '@/components/review-meta';
import { ReviewMetricsBreakdown } from '@/components/review-metrics';
import { Avatar } from '@/components/ui/avatar';
import { HeroArt } from '@/components/ui/hero-art';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Chip } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * The full review: landscape key art, the game's identity and score raised
 * above everything else, then the article itself.
 *
 * Deliberately a ScrollView rather than a FlatList — this is one continuous
 * document, not a list, and the body needs to flow as a single Text block for
 * paragraph spacing to work.
 */
export default function ReviewScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const log = useQuery({
    queryKey: ['log', id],
    queryFn: () => getLogById(id!),
    enabled: !!id,
  });

  const engagement = useQuery({
    queryKey: ['engagement', 'log', id, viewerId],
    queryFn: () => getEngagement('log', [id!], viewerId),
    enabled: !!id,
  });

  if (log.isLoading) {
    return (
      <Screen edges={[]}>
        <LoadingState />
      </Screen>
    );
  }

  if (log.isError) {
    return (
      <Screen edges={[]}>
        <ErrorState error={log.error} />
      </Screen>
    );
  }

  if (!log.data) {
    return (
      <Screen edges={[]}>
        <EmptyState title="Review not found" />
      </Screen>
    );
  }

  const review = log.data;
  const game = review.game;
  const author = review.profile;
  const metrics = parseReviewMetrics(review.review_metrics);

  return (
    <Screen edges={[]}>
      {/* Transparency is global — see the root layout. */}
      <Stack.Screen options={{ title: '' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Hero: landscape key art, faded into the page so the header floats. */}
        <View style={styles.hero}>
          <HeroArt uri={game?.hero_url} scrim />
        </View>

        {/* Game identity + score. The score is the loudest thing here. */}
        <View style={styles.masthead}>
          {/* A review is a dedicated game presentation, so the case belongs
              here — unlike the review *cards* in feeds, which stay flat. */}
          <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.97}>
              <GameCaseDisplay
                coverUrl={game?.cover_url}
                heroUrl={game?.hero_url}
                title={game?.title}
                platforms={game?.platforms}
                size="medium"
              />
            </PressableScale>
          </Link>

          <View style={styles.mastheadText}>
            <Text variant="h3" numberOfLines={3}>
              {game?.title ?? 'Unknown game'}
            </Text>
            <Text variant="bodySmall" color="textMuted" numberOfLines={2}>
              {[game?.release_year, game?.developer].filter(Boolean).join(' · ')}
            </Text>

            {/* No status here — `ReviewMeta` below states it beside the score,
                and saying it twice in adjacent blocks makes it look like two
                different facts. */}
            <View style={styles.mastheadMeta}>
              {review.platinum && (
                <View style={styles.badge}>
                  <Ionicons name="trophy" size={11} color={theme.platinum} />
                  <Text variant="caption" style={{ color: theme.platinum }}>
                    Platinum
                  </Text>
                </View>
              )}
              {review.hours_played != null && (
                <Text variant="caption" color="textMuted">
                  {review.hours_played}h played
                </Text>
              )}
            </View>
          </View>
        </View>

        {/* The same block the feed card leads with, so a review looks like
            itself whether you meet it in a list or open it. */}
        <View style={styles.scoreBlock}>
          <ReviewMeta
            score={review.rating}
            gameTitle={game?.title ?? 'Unknown game'}
            status={review.status}
          />
        </View>

        {/* Only present when the reviewer scored by category — the headline
            number above is the mean of exactly these. */}
        {metrics && <ReviewMetricsBreakdown metrics={metrics} />}

        {game?.platforms && game.platforms.length > 0 && (
          <View style={styles.chips}>
            {game.platforms.slice(0, 5).map((platform) => (
              <Chip key={platform} label={platform} />
            ))}
          </View>
        )}

        {/* The article. */}
        <View style={styles.article}>
          {review.review_title && <Text variant="display">{review.review_title}</Text>}

          {author && (
            <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
              <PressableScale accessibilityRole="button" scaleTo={0.99} style={styles.byline}>
                <Avatar uri={author.avatar_url} name={displayNameFor(author)} size={36} />
                <View style={styles.bylineText}>
                  <Text variant="h5">{displayNameFor(author)}</Text>
                  <Text variant="caption" color="textMuted">
                    @{author.username} · {timeAgo(review.created_at)}
                  </Text>
                </View>
              </PressableScale>
            </Link>
          )}

          {review.review ? (
            <Text variant="body" style={styles.body}>
              {review.review}
            </Text>
          ) : (
            <Text variant="body" color="textMuted">
              No written review — just a score.
            </Text>
          )}
        </View>

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <EngagementBar
            targetType="log"
            targetId={review.id}
            engagement={engagement.data?.[review.id]}
            layout="stacked"
            shareMessage={
              review.review_title
                ? `${review.review_title} — ${game?.title ?? ''}`
                : `${game?.title ?? 'This game'}: ${review.rating ?? ''}/100`
            }
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: Spacing.x48 },
  hero: { width: '100%' },
  masthead: {
    flexDirection: 'row',
    gap: Spacing.x16,
    paddingHorizontal: Spacing.x16,
    marginTop: -Spacing.x32,
  },
  mastheadText: { flex: 1, gap: Spacing.x4, justifyContent: 'flex-end' },
  mastheadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    flexWrap: 'wrap',
    marginTop: Spacing.x4,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  /* No container: the score pill is already a coloured block, and wrapping a
     block in a block was the clearest bubble on the page. */
  scoreBlock: { marginHorizontal: Spacing.x16, marginTop: Spacing.x16 },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.x8,
    paddingHorizontal: Spacing.x16,
    marginTop: Spacing.x16,
  },
  article: { paddingHorizontal: Spacing.x16, marginTop: Spacing.x24, gap: Spacing.x16 },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  bylineText: { flex: 1, gap: 1 },
  // Looser than default body copy — this is long-form reading, not UI text.
  body: { ...Type.prose },
  footer: {
    marginTop: Spacing.x32,
    paddingHorizontal: Spacing.x16,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
