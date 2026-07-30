import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { BlurView } from 'expo-blur';
import { Link, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { MediaCarousel } from '@/components/media-carousel';
import { Avatar } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Chip } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { readingMinutes, tagLabel } from '@/constants/article-tags';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getEngagement, getPost } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';
import { useAuth } from '@/store/auth';

/**
 * The full article — a magazine page.
 *
 * Wide margins, a large headline, a byline rule, and body copy set looser than
 * anywhere else in the app. Spoilered articles open covered: the reader has to
 * opt in before the text is legible, which is the only honest way to honour the
 * warning on a page whose entire content is the spoiler.
 */
export default function ArticleScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const [revealed, setRevealed] = useState(false);

  const post = useQuery({
    queryKey: ['post', id],
    queryFn: () => getPost(id!),
    enabled: !!id,
  });

  const engagement = useQuery({
    queryKey: ['engagement', 'post', id, viewerId],
    queryFn: () => getEngagement('post', [id!], viewerId),
    enabled: !!id,
  });

  if (post.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <LoadingState />
      </Screen>
    );
  }

  if (post.isError) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <ErrorState error={post.error} />
      </Screen>
    );
  }

  if (!post.data) {
    return (
      <Screen edges={['bottom']} insetHeader>
        <EmptyState title="Article not found" />
      </Screen>
    );
  }

  const article = post.data;
  const author = article.profile;
  const hidden = article.has_spoilers && !revealed;
  const minutes = readingMinutes(article.body);

  return (
    <Screen edges={['bottom']} insetHeader>
      <Stack.Screen options={{ title: '' }} />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {article.tags && article.tags.length > 0 && (
          <View style={styles.tags}>
            {article.tags.map((tag) => (
              <Chip key={tag} label={tagLabel(tag)} tone="primary" />
            ))}
          </View>
        )}

        <Text variant="display">{article.title ?? 'Untitled'}</Text>

        {author && (
          <Link href={{ pathname: '/profile/[id]', params: { id: author.id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.99} style={styles.byline}>
              <Avatar uri={author.avatar_url} name={displayNameFor(author)} size={38} />
              <View style={styles.bylineText}>
                <Text variant="bodyStrong">{displayNameFor(author)}</Text>
                <Text variant="micro" color="textMuted">
                  {timeAgo(article.created_at)} · {minutes} min read
                </Text>
              </View>
            </PressableScale>
          </Link>
        )}

        <View style={[styles.rule, { backgroundColor: theme.border }]} />

        {article.media.length > 0 && (
          <MediaCarousel
            media={article.media}
            width={Math.min(MaxContentWidth, 640) - Spacing.five * 2}
          />
        )}

        {/* Body, covered when spoilered. */}
        <View style={styles.bodyWrap}>
          <Text variant="body" style={styles.body}>
            {article.body}
          </Text>

          {hidden && (
            <>
              <BlurView
                intensity={40}
                tint={theme.background === '#FFFFFF' ? 'light' : 'dark'}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.spoilerGate, { backgroundColor: `${theme.background}CC` }]}>
                <Ionicons name="eye-off-outline" size={26} color={theme.textSecondary} />
                <Text variant="bodyStrong">This article contains spoilers</Text>
                <Text variant="caption" color="textMuted" style={styles.centered}>
                  The author flagged it for major story details.
                </Text>
                <Button title="Show anyway" variant="secondary" onPress={() => setRevealed(true)} />
              </View>
            </>
          )}
        </View>

        {article.game && (
          <Link href={{ pathname: '/game/[id]', params: { id: article.game.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.98}
              style={StyleSheet.flatten([styles.gameTag, { backgroundColor: theme.surface }])}>
              <Poster
                coverUrl={article.game.cover_url}
                heroUrl={article.game.hero_url}
                title={article.game.title}
                width={44}
                rounded="small"
              />
              <View style={styles.gameTagText}>
                <Text variant="micro" color="textMuted">
                  ABOUT
                </Text>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {article.game.title}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={theme.textMuted} />
            </PressableScale>
          </Link>
        )}

        <View style={[styles.footer, { borderTopColor: theme.border }]}>
          <EngagementBar
            targetType="post"
            targetId={article.id}
            engagement={engagement.data?.[article.id]}
            layout="stacked"
            shareMessage={article.title ?? article.body.slice(0, 160)}
          />
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Generous side margins are what make it read as a page rather than a card.
  content: {
    paddingHorizontal: Spacing.five,
    paddingTop: Spacing.four,
    paddingBottom: Spacing.seven,
    gap: Spacing.four,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  bylineText: { flex: 1, gap: 1 },
  rule: { height: StyleSheet.hairlineWidth, width: '100%' },
  bodyWrap: {
    position: 'relative',
    minHeight: 220,
    overflow: 'hidden',
    borderRadius: Radius.small,
  },
  // Looser than app body copy — this is sustained reading.
  body: { fontSize: 17, lineHeight: 29 },
  spoilerGate: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
    padding: Spacing.five,
  },
  centered: { textAlign: 'center' },
  gameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.medium,
  },
  gameTagText: { flex: 1, gap: 1 },
  footer: { paddingTop: Spacing.four, borderTopWidth: StyleSheet.hairlineWidth },
});
