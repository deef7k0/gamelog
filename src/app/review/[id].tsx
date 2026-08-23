import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Link, useLocalSearchParams, useRouter } from 'expo-router';
import { Share, StyleSheet, View, useWindowDimensions, ScrollView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { EngagementBar } from '@/components/engagement-bar';
import { ReviewMetricsBreakdown } from '@/components/review-metrics';
import { Avatar } from '@/components/ui/avatar';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { labelFor, scoreColor } from '@/constants/score';
import { parseReviewMetrics } from '@/constants/review-metrics';
import { Radius, Spacing, Type, tint, withAlpha } from '@/constants/theme';
import { AccentProvider, useGameAccent } from '@/hooks/use-accent';
import { useArtworkPalette } from '@/hooks/use-artwork-palette';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getLogById } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * Full-screen Review presentation inspired by the "Now Playing" aesthetic.
 *
 * Top bar: Reviewer context ("Now viewing [User]'s review")
 * Center: Large game cover artwork with dynamic ambient backdrop gradient
 * Track info: Game title in bold + publisher / developer
 * Score: Standout centered score display ("89/100")
 * Review: Title + body prose
 * Bottom: Interactive like, comment, and share actions
 */
export default function ReviewScreen() {
  const window = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const theme = useTheme();
  const router = useRouter();
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

  const game = log.data?.game;
  const artworkUrl = game?.cover_url ?? game?.hero_url;
  const accent = useGameAccent(artworkUrl, game?.genres);
  const palette = useArtworkPalette(artworkUrl);

  if (log.isLoading) {
    return (
      <Screen edges={['top', 'bottom']}>
        <LoadingState />
      </Screen>
    );
  }

  if (log.isError) {
    return (
      <Screen edges={['top', 'bottom']}>
        <ErrorState
          error={log.error}
          action={
            <PressableScale onPress={() => router.back()}>
              <Text variant="h5" color="primaryText">
                Go back
              </Text>
            </PressableScale>
          }
        />
      </Screen>
    );
  }

  if (!log.data) {
    return (
      <Screen edges={['top', 'bottom']}>
        <EmptyState title="Review not found" />
      </Screen>
    );
  }

  const review = log.data;
  const author = review.profile;
  const metrics = parseReviewMetrics(review.review_metrics);
  const dominantColor = palette?.[0] ?? accent.color;
  const scoreTone = review.rating !== null ? scoreColor(review.rating, theme) : theme.textMuted;
  const publisherName = game?.publisher ?? game?.developer ?? '';

  // Artwork sizing — Spotify album art proportion
  const artWidth = Math.min(window.width - 64, 320);
  const artHeight = Math.round(artWidth * 1.28); // 2:3 box art proportion

  async function handleShare() {
    try {
      const shareText = review.review_title
        ? `${review.review_title} — ${game?.title ?? ''} review by ${displayNameFor(author)} on GameLog`
        : `${game?.title ?? 'Game'}: ${review.rating ?? ''}/100 review by ${displayNameFor(author)} on GameLog`;
      await Share.share({ message: shareText });
    } catch {
      // Dismissed
    }
  }

  return (
    <AccentProvider artwork={artworkUrl} genres={game?.genres}>
      <Screen
        edges={[]}
        backdrop={
          <LinearGradient
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            colors={[
              withAlpha(dominantColor, 0.75),
              tint(theme.background, dominantColor, 0.5),
              tint(theme.background, dominantColor, 0.15),
              theme.background,
            ]}
            locations={[0, 0.35, 0.65, 1]}
          />
        }>
        {/* Top Header Bar */}
        <View style={[styles.topBar, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Close review"
            scaleTo={0.92}
            onPress={() => router.back()}
            style={styles.headerButton}>
            <Ionicons name="chevron-down" size={26} color={theme.text} />
          </PressableScale>

          <View style={styles.topBarCenter}>
            <Text variant="caption" color="textMuted" style={styles.nowViewingBadge}>
              NOW VIEWING REVIEW
            </Text>
            {author && (
              <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
                <PressableScale
                  accessibilityRole="button"
                  scaleTo={0.97}
                  style={StyleSheet.flatten(styles.reviewerRow)}>
                  <Avatar uri={author.avatar_url} name={displayNameFor(author)} size={18} />
                  <Text variant="bodySmall" numberOfLines={1} style={styles.reviewerText}>
                    {displayNameFor(author)}
                  </Text>
                </PressableScale>
              </Link>
            )}
          </View>

          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Share review"
            scaleTo={0.92}
            onPress={handleShare}
            style={styles.headerButton}>
            <Ionicons name="share-outline" size={22} color={theme.text} />
          </PressableScale>
        </View>

        <ScrollView
          contentContainerStyle={[
            styles.scrollContent,
            { paddingBottom: Math.max(insets.bottom, 24) + 32 },
          ]}
          showsVerticalScrollIndicator={false}>
          {/* Centered Album-Style Game Cover */}
          <View style={styles.artSection}>
            <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={`View ${game?.title ?? 'game'}`}
                scaleTo={0.97}
                style={StyleSheet.flatten([
                  styles.coverCard,
                  {
                    width: artWidth,
                    height: artHeight,
                    borderColor: withAlpha('#FFFFFF', 0.12),
                  },
                ])}>
                <Image
                  source={artworkUrl}
                  style={StyleSheet.absoluteFill}
                  contentFit="cover"
                  transition={200}
                />
              </PressableScale>
            </Link>
          </View>

          {/* Game Title & Publisher Info */}
          <View style={styles.titleSection}>
            <View style={styles.titleTextColumn}>
              <Link href={{ pathname: '/game/[id]', params: { id: review.game_id } }} asChild>
                <PressableScale accessibilityRole="button" scaleTo={0.98}>
                  <Text variant="h1" style={styles.gameTitle} numberOfLines={2}>
                    {game?.title ?? 'Unknown Game'}
                  </Text>
                </PressableScale>
              </Link>
              {publisherName.length > 0 && (
                <Text
                  variant="body"
                  color="textSecondary"
                  numberOfLines={1}
                  style={styles.publisherName}>
                  {publisherName}
                </Text>
              )}
            </View>

            {review.platinum && (
              <View
                style={[styles.trophyPill, { backgroundColor: withAlpha(theme.platinum, 0.15) }]}>
                <Ionicons name="trophy" size={16} color={theme.platinum} />
              </View>
            )}
          </View>

          {/* Standout Centered Score Display */}
          {review.rating !== null && (
            <View style={styles.scoreContainer}>
              <View
                style={[
                  styles.scoreBox,
                  {
                    borderColor: withAlpha(scoreTone, 0.28),
                    backgroundColor: withAlpha(scoreTone, 0.08),
                  },
                ]}>
                <View style={styles.scoreRow}>
                  <Text style={[styles.scoreNumber, { color: scoreTone }]}>{review.rating}</Text>
                  <Text variant="h3" color="textMuted" style={styles.scoreDenominator}>
                    /100
                  </Text>
                </View>
                <Text variant="caption" style={[styles.verdictLabel, { color: scoreTone }]}>
                  {labelFor(review.rating)}
                </Text>
              </View>

              {review.hours_played != null && (
                <Text variant="caption" color="textMuted" style={styles.hoursPlayed}>
                  {review.hours_played} hours logged · {timeAgo(review.created_at)}
                </Text>
              )}
            </View>
          )}

          {/* Metrics breakdown (if reviewer scored by category) */}
          {metrics && (
            <View style={styles.metricsContainer}>
              <ReviewMetricsBreakdown metrics={metrics} />
            </View>
          )}

          {/* Review Article (Title and Body Content) */}
          <View style={styles.reviewArticle}>
            {review.review_title && (
              <Text variant="h2" style={styles.reviewTitle}>
                {review.review_title}
              </Text>
            )}

            {review.review ? (
              <Text variant="body" style={styles.reviewBody}>
                {review.review}
              </Text>
            ) : (
              <Text variant="body" color="textMuted" style={styles.emptyReviewNotice}>
                Scored without a written review.
              </Text>
            )}
          </View>

          {/* Engagement Buttons (Like, Comment, Share) */}
          <View style={[styles.footerBar, { borderTopColor: theme.border }]}>
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
    </AccentProvider>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x12,
  },
  topBarCenter: {
    alignItems: 'center',
    gap: 2,
    flex: 1,
    paddingHorizontal: Spacing.x8,
  },
  nowViewingBadge: {
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1,
  },
  reviewerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
  },
  reviewerText: {
    fontWeight: '600',
  },
  headerButton: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: Spacing.x24,
    paddingTop: Spacing.x8,
  },
  artSection: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: Spacing.x16,
  },
  coverCard: {
    borderRadius: Radius.card,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 20,
    elevation: 10,
  },
  titleSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: Spacing.x16,
    gap: Spacing.x12,
  },
  titleTextColumn: {
    flex: 1,
    gap: Spacing.x4,
  },
  gameTitle: {
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  publisherName: {
    fontWeight: '500',
  },
  trophyPill: {
    padding: Spacing.x8,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreContainer: {
    alignItems: 'center',
    marginTop: Spacing.x24,
    gap: Spacing.x8,
  },
  scoreBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.x12,
    paddingHorizontal: Spacing.x24,
    borderRadius: Radius.card,
    borderWidth: 1,
    gap: 2,
    minWidth: 140,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 2,
  },
  scoreNumber: {
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 44,
  },
  scoreDenominator: {
    fontWeight: '600',
  },
  verdictLabel: {
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
  },
  hoursPlayed: {
    textAlign: 'center',
  },
  metricsContainer: {
    marginTop: Spacing.x16,
  },
  reviewArticle: {
    marginTop: Spacing.x24,
    gap: Spacing.x12,
  },
  reviewTitle: {
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  reviewBody: {
    ...Type.prose,
    lineHeight: 24,
  },
  emptyReviewNotice: {
    fontStyle: 'italic',
  },
  footerBar: {
    marginTop: Spacing.x32,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
