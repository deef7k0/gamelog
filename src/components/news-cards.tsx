import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Linking, StyleSheet, View } from 'react-native';

import { EventRsvp } from '@/components/event-rsvp';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { HeroAspectRatio, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { timeAgo } from '@/lib/format';
import type { Article, GameEvent, Trailer } from '@/lib/news';

/**
 * Cards for the News tab: headlines, trailers and events.
 *
 * Nothing here renders a <GameCase /> — the News tab is a browsing surface, and
 * physical cases are reserved for dedicated game pages. Anything that shows a
 * game rather than a story about one belongs in <CoverTile> or <GameListItem>.
 */

function openExternal(url: string) {
  Linking.openURL(url).catch(() => {
    // Nothing sensible to do if the OS has no handler; failing silently beats
    // an alert the user cannot act on.
  });
}

/**
 * A news item, laid out as a microblog post rather than a card.
 *
 * The X/Twitter structure: a source badge in an avatar slot on the left, then a
 * byline row, the headline, the summary, and a thumbnail tucked to the right of
 * the text instead of spanning the full width above it. Rows are separated by
 * hairlines rather than gaps between floating cards.
 *
 * The practical gain is density — a full-bleed 16:9 image per story meant barely
 * two headlines per screen, and a news feed people scan wants far more than
 * that. The image earns a small slot, not the headline's space.
 */
export function ArticleCard({ article }: { article: Article }) {
  const theme = useTheme();
  const initial = article.source.trim().charAt(0).toUpperCase() || '?';

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={article.title}
      onPress={() => openExternal(article.url)}
      scaleTo={0.99}
      style={styles.feedRow}>
      <View style={[styles.sourceBadge, { backgroundColor: theme.surfaceElevated }]}>
        <Text variant="bodyStrong" style={{ color: theme.primary }}>
          {initial}
        </Text>
      </View>

      <View style={styles.feedBody}>
        <View style={styles.metaRow}>
          <Text variant="caption" numberOfLines={1}>
            {article.source}
          </Text>
          {article.publishedAt && (
            <Text variant="micro" color="textMuted">
              · {timeAgo(article.publishedAt)}
            </Text>
          )}
        </View>

        <View style={styles.feedContent}>
          <View style={styles.feedText}>
            <Text variant="bodyStrong" numberOfLines={3}>
              {article.title}
            </Text>

            {article.summary && (
              <Text variant="caption" color="textMuted" numberOfLines={2}>
                {article.summary}
              </Text>
            )}
          </View>

          {article.imageUrl && (
            <Image
              source={{ uri: article.imageUrl }}
              style={[styles.feedThumb, { backgroundColor: theme.surfaceElevated }]}
              contentFit="cover"
              transition={200}
              accessibilityIgnoresInvertColors
            />
          )}
        </View>
      </View>
    </PressableScale>
  );
}

export function TrailerCard({ trailer }: { trailer: Trailer }) {
  const theme = useTheme();

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${trailer.gameTitle} — ${trailer.name}`}
      onPress={() => openExternal(`https://www.youtube.com/watch?v=${trailer.videoId}`)}
      scaleTo={0.98}>
      <Card padded={false}>
        <View>
          <Image
            source={{ uri: trailer.thumbnailUrl }}
            style={[styles.articleImage, { backgroundColor: theme.surfaceElevated }]}
            contentFit="cover"
            transition={200}
            accessibilityIgnoresInvertColors
          />
          <View style={[styles.playBadge, { backgroundColor: theme.scrim }]}>
            <Ionicons name="play" size={22} color="#FFFFFF" />
          </View>
        </View>

        <View style={styles.articleBody}>
          <Text variant="bodyStrong" numberOfLines={2}>
            {trailer.gameTitle}
          </Text>
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {trailer.name}
          </Text>
        </View>
      </Card>
    </PressableScale>
  );
}

/*
 * There is deliberately no ChartRow here any more. The popularity chart is a
 * wall of covers built from <CoverTile>, on both the News tab and the Top 10
 * screen, so a second row-shaped rendering of the same data would put the two
 * surfaces back out of step the moment one of them changed.
 */

export function EventCard({ event }: { event: GameEvent }) {
  const theme = useTheme();
  const starts = event.startsAt ? new Date(event.startsAt) : null;

  return (
    <Card>
      <View style={styles.eventBody}>
        <View style={styles.metaRow}>
          <Ionicons name="calendar-outline" size={13} color={theme.textMuted} />
          <Text variant="micro" color="textMuted">
            {starts
              ? starts.toLocaleDateString(undefined, {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                })
              : 'Date to be announced'}
          </Text>
          {event.isUpcoming && (
            <View style={[styles.pill, { backgroundColor: `${theme.primary}22` }]}>
              <Text variant="micro" style={{ color: theme.primary }}>
                UPCOMING
              </Text>
            </View>
          )}
        </View>

        <Text variant="bodyStrong">{event.name}</Text>

        {event.description && (
          <Text variant="caption" color="textMuted" numberOfLines={3}>
            {event.description}
          </Text>
        )}

        {event.liveStreamUrl && (
          <Text
            variant="caption"
            color="primary"
            onPress={() => openExternal(event.liveStreamUrl!)}>
            Watch the stream
          </Text>
        )}

        {/* Only upcoming events can be attended or reminded about. */}
        {event.isUpcoming && <EventRsvp event={event} />}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  feedRow: { flexDirection: 'row', gap: Spacing.three, paddingVertical: Spacing.three },
  sourceBadge: {
    width: 38,
    height: 38,
    borderRadius: Radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedBody: { flex: 1, gap: Spacing.one },
  feedContent: { flexDirection: 'row', gap: Spacing.three, alignItems: 'flex-start' },
  feedText: { flex: 1, gap: Spacing.one },
  feedThumb: { width: 76, height: 76, borderRadius: Radius.medium },
  articleImage: { width: '100%', aspectRatio: HeroAspectRatio },
  articleBody: { padding: Spacing.four, gap: Spacing.two },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  playBadge: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 52,
    height: 52,
    marginTop: -26,
    marginLeft: -26,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
  },
  eventBody: { gap: Spacing.two },
  pill: {
    paddingHorizontal: Spacing.two,
    paddingVertical: 2,
    borderRadius: Radius.pill,
  },
});
