import { Link, useRouter } from 'expo-router';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { MediaCarousel } from '@/components/media-carousel';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement, PostWithRelations } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';

const GAME_TAG_POSTER = 40;
/** Horizontal padding the feed list applies on each side. */
const LIST_INSET = Spacing.four * 2;

export type PostCardProps = {
  post: PostWithRelations;
  engagement?: Engagement;
  showAuthor?: boolean;
};

/**
 * A post, laid out the way Instagram does it: header, then edge-to-edge media,
 * then actions, like count and caption underneath.
 *
 * The media deliberately breaks out of the card's padding — hence
 * `<Card padded={false}>` with padding reapplied to the header and footer
 * blocks only. That is what lets the image dominate the card instead of sitting
 * inside a uniform inset like every other card in the app.
 */
export function PostCard({ post, engagement, showAuthor = true }: PostCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();

  const hasMedia = post.media.length > 0;
  const body = post.body.trim();

  // The image spans the full card, so only the list's own inset is subtracted.
  const contentWidth = Math.min(screenWidth, MaxContentWidth) - LIST_INSET;

  const commentCount = engagement?.comments ?? 0;

  function openComments() {
    router.push({
      pathname: '/comments/[type]/[id]',
      params: { type: 'post', id: post.id },
    });
  }

  return (
    <Card padded={false}>
      {showAuthor && post.profile && (
        <Link href={{ pathname: '/profile/[id]', params: { id: post.profile.id } }} asChild>
          <PressableScale
            accessibilityRole="button"
            scaleTo={0.99}
            style={StyleSheet.flatten([styles.header, hasMedia ? null : styles.headerNoMedia])}>
            <Avatar uri={post.profile.avatar_url} name={displayNameFor(post.profile)} size={36} />
            <View style={styles.headerText}>
              <Text variant="bodyStrong" numberOfLines={1}>
                {displayNameFor(post.profile)}
              </Text>
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                @{post.profile.username}
              </Text>
            </View>
            <Text variant="caption" color="textMuted">
              {timeAgo(post.created_at)}
            </Text>
          </PressableScale>
        </Link>
      )}

      {/* Text-only posts have no image to lead with, so the body becomes the
          primary content and sits above the actions instead of below them. */}
      {!hasMedia && body.length > 0 && (
        <View style={styles.textOnly}>
          <Text variant="body">{body}</Text>
        </View>
      )}

      {hasMedia && <MediaCarousel media={post.media} width={contentWidth} rounded={false} />}

      <View style={styles.footer}>
        <EngagementBar
          targetType="post"
          targetId={post.id}
          engagement={engagement}
          layout="stacked"
          shareMessage={
            post.game ? `${post.game.title} — ${body}`.slice(0, 200) : body.slice(0, 200)
          }
        />

        {/* With media above, the body reads as an Instagram caption: the
            author's name inline, then the text. */}
        {hasMedia && body.length > 0 && (
          <Text variant="body" numberOfLines={4}>
            {showAuthor && post.profile && (
              <Text variant="bodyStrong">{post.profile.username} </Text>
            )}
            {body}
          </Text>
        )}

        {commentCount > 0 && (
          <Text variant="caption" color="textMuted" onPress={openComments}>
            View {commentCount === 1 ? '1 comment' : `all ${commentCount} comments`}
          </Text>
        )}

        {post.game && (
          <Link href={{ pathname: '/game/[id]', params: { id: post.game.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={post.game.title}
              scaleTo={0.98}
              style={StyleSheet.flatten([
                styles.gameTag,
                { backgroundColor: theme.surfaceElevated },
              ])}>
              <Poster
                coverUrl={post.game.cover_url}
                heroUrl={post.game.hero_url}
                title={post.game.title}
                width={GAME_TAG_POSTER}
                rounded="small"
              />
              <View style={styles.gameTagText}>
                <Text variant="caption" numberOfLines={1} style={styles.strong}>
                  {post.game.title}
                </Text>
                <Text variant="micro" color="textMuted" numberOfLines={1}>
                  {[post.game.release_year, post.game.developer].filter(Boolean).join(' · ')}
                </Text>
              </View>
            </PressableScale>
          </Link>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    paddingHorizontal: Spacing.four,
    paddingVertical: Spacing.three,
  },
  // Without an image butting up against it, the header needs less bottom space.
  headerNoMedia: { paddingBottom: Spacing.one },
  headerText: { flex: 1, gap: 1 },
  textOnly: { paddingHorizontal: Spacing.four, paddingBottom: Spacing.three },
  footer: { paddingHorizontal: Spacing.four, paddingVertical: Spacing.three, gap: Spacing.two },
  gameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.two,
    borderRadius: Radius.medium,
    marginTop: Spacing.one,
  },
  gameTagText: { flex: 1, gap: 1 },
  strong: { fontWeight: '700' },
});
