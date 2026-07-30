import Ionicons from '@expo/vector-icons/Ionicons';
import { BlurView } from 'expo-blur';
import { Link } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card, Chip } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { readingMinutes, tagLabel } from '@/constants/article-tags';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { PostWithRelations } from '@/lib/api';
import { displayNameFor, timeAgo } from '@/lib/format';

const PREVIEW_LINES = 3;

/**
 * An article in a feed: headline, byline, tags, and a short excerpt.
 *
 * When the author flagged spoilers the excerpt is covered rather than simply
 * hidden — the reader can see there *is* text and choose to reveal it, which is
 * the whole point of a spoiler warning.
 */
export function ArticleCard({
  article,
  showAuthor = true,
}: {
  article: PostWithRelations;
  showAuthor?: boolean;
}) {
  const theme = useTheme();
  const [revealed, setRevealed] = useState(false);

  const hidden = article.has_spoilers && !revealed;
  const minutes = readingMinutes(article.body);

  return (
    <Card>
      <View style={styles.stack}>
        {showAuthor && article.profile && (
          <Link href={{ pathname: '/profile/[id]', params: { id: article.profile.id } }} asChild>
            <PressableScale accessibilityRole="button" scaleTo={0.99} style={styles.byline}>
              <Avatar
                uri={article.profile.avatar_url}
                name={displayNameFor(article.profile)}
                size={28}
              />
              <Text variant="micro" color="textMuted" numberOfLines={1} style={styles.bylineText}>
                {displayNameFor(article.profile)} · {timeAgo(article.created_at)} · {minutes} min
                read
              </Text>
            </PressableScale>
          </Link>
        )}

        <Link href={{ pathname: '/article/[id]', params: { id: article.id } }} asChild>
          <PressableScale accessibilityRole="button" scaleTo={0.99} style={styles.body}>
            <Text variant="heading" numberOfLines={3}>
              {article.title ?? 'Untitled'}
            </Text>

            <View style={styles.excerptWrap}>
              <Text variant="body" color="textSecondary" numberOfLines={PREVIEW_LINES}>
                {article.body}
              </Text>

              {hidden && (
                <>
                  {/* Blur strength varies by platform; the label below is what
                      actually guarantees the warning is understood. */}
                  <BlurView
                    intensity={28}
                    tint={theme.background === '#FFFFFF' ? 'light' : 'dark'}
                    style={StyleSheet.absoluteFill}
                  />
                  <View style={styles.spoilerOverlay}>
                    <PressableScale
                      accessibilityRole="button"
                      accessibilityLabel="Reveal spoilers"
                      onPress={() => setRevealed(true)}
                      scaleTo={0.94}
                      style={StyleSheet.flatten([
                        styles.revealPill,
                        { backgroundColor: theme.surfaceElevated },
                      ])}>
                      <Ionicons name="eye-off" size={13} color={theme.textSecondary} />
                      <Text variant="micro" color="textSecondary">
                        Spoilers — tap to reveal
                      </Text>
                    </PressableScale>
                  </View>
                </>
              )}
            </View>

            {(article.tags?.length || article.game) && (
              <View style={styles.tags}>
                {article.tags?.map((tag) => (
                  <Chip key={tag} label={tagLabel(tag)} tone="primary" />
                ))}
                {article.has_spoilers && <Chip label="Spoilers" tone="accent" />}
              </View>
            )}
          </PressableScale>
        </Link>

        {article.game && (
          <Link href={{ pathname: '/game/[id]', params: { id: article.game.id } }} asChild>
            <PressableScale
              accessibilityRole="button"
              scaleTo={0.98}
              style={StyleSheet.flatten([
                styles.gameTag,
                { backgroundColor: theme.surfaceElevated },
              ])}>
              <Poster
                coverUrl={article.game.cover_url}
                heroUrl={article.game.hero_url}
                title={article.game.title}
                width={32}
                rounded="small"
              />
              <Text variant="micro" color="textSecondary" numberOfLines={1}>
                {article.game.title}
              </Text>
            </PressableScale>
          </Link>
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.three },
  byline: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  bylineText: { flex: 1 },
  body: { gap: Spacing.two },
  excerptWrap: { position: 'relative', overflow: 'hidden', borderRadius: Radius.small },
  spoilerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  revealPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one + 2,
    paddingVertical: Spacing.two,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
  },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  gameTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    padding: Spacing.two,
    borderRadius: Radius.medium,
  },
});
