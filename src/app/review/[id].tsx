import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { GameCase } from '@/components/game-case';
import { ReviewMetricsBreakdown } from '@/components/review-metrics';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScorePill } from '@/components/ui/score';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Chip } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { caseKeysFor } from '@/constants/platform-cases';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
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
          {game?.hero_url && (
            <Image
              source={{ uri: game.hero_url }}
              style={styles.heroImage}
              contentFit="cover"
              transition={280}
              accessibilityIgnoresInvertColors
            />
          )}
          <LinearGradient
            colors={['transparent', theme.background]}
            style={styles.heroFade}
            pointerEvents="none"
          />
        </View>

        {/* Game identity + score. The score is the loudest thing here. */}
        <View style={styles.masthead}>
          {/* A review is a dedicated game presentation, so the case belongs
              here — unlike the review *cards* in feeds, which stay flat. */}
          <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.97}>
              <GameCase
                coverUrl={game?.cover_url}
                heroUrl={game?.hero_url}
                title={game?.title}
                platform={caseKeysFor(game?.platforms)[0]}
                size="medium"
              />
            </PressableScale>
          </Link>

          <View style={styles.mastheadText}>
            <Text variant="heading" numberOfLines={3}>
              {game?.title ?? 'Unknown game'}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={2}>
              {[game?.release_year, game?.developer].filter(Boolean).join(' · ')}
            </Text>

            <View style={styles.mastheadMeta}>
              <Text variant="micro" style={{ color: statusColor(review.status, theme) }}>
                {STATUS_LABEL[review.status].toUpperCase()}
              </Text>
              {review.platinum && (
                <View style={styles.badge}>
                  <Ionicons name="trophy" size={11} color={theme.platinum} />
                  <Text variant="micro" style={{ color: theme.platinum }}>
                    Platinum
                  </Text>
                </View>
              )}
              {review.hours_played != null && (
                <Text variant="micro" color="textMuted">
                  {review.hours_played}h played
                </Text>
              )}
            </View>
          </View>
        </View>

        {review.rating !== null && (
          <View style={[styles.scoreBlock, { backgroundColor: theme.surface }]}>
            <ScorePill score={review.rating} size="hero" showLabel />
          </View>
        )}

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
                  <Text variant="bodyStrong">{displayNameFor(author)}</Text>
                  <Text variant="micro" color="textMuted">
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
  content: { paddingBottom: Spacing.seven },
  hero: { width: '100%' },
  heroImage: { width: '100%', aspectRatio: HeroAspectRatio },
  heroFade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: '60%' },
  masthead: {
    flexDirection: 'row',
    gap: Spacing.four,
    paddingHorizontal: Spacing.four,
    marginTop: -Spacing.six,
  },
  mastheadText: { flex: 1, gap: Spacing.one, justifyContent: 'flex-end' },
  mastheadMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    flexWrap: 'wrap',
    marginTop: Spacing.one,
  },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.one },
  scoreBlock: {
    marginHorizontal: Spacing.four,
    marginTop: Spacing.four,
    padding: Spacing.four,
    borderRadius: Radius.large,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
    paddingHorizontal: Spacing.four,
    marginTop: Spacing.four,
  },
  article: { paddingHorizontal: Spacing.four, marginTop: Spacing.five, gap: Spacing.four },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bylineText: { flex: 1, gap: 1 },
  // Looser than default body copy — this is long-form reading, not UI text.
  body: { fontSize: 16, lineHeight: 26 },
  footer: {
    marginTop: Spacing.six,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.four,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
