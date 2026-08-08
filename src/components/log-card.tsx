import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { ReviewMeta } from '@/components/review-meta';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { STATUS_VERB } from '@/constants/status';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgo } from '@/lib/format';

/**
 * Box art, sized to be the tallest thing in the block.
 *
 * A real case is 2:3, and this is the one element in the card allowed to carry
 * colour, so it is the object that wins on size. 88 wide is 132 tall, which
 * comfortably clears the headline plus the meta surface beside it — the whole
 * left column has to finish *inside* the cover's height or the composition
 * reads as two things that failed to line up.
 */
const BOX_ART_WIDTH = 88;

export type LogCardProps = {
  log: LogWithRelations;
  /** Hide the author row on a profile, where every card has the same author. */
  showAuthor?: boolean;
  /** Omit to hide the like/comment row entirely (e.g. in a compact list). */
  engagement?: Engagement;
};

/**
 * A review, everywhere it appears: the feed, a profile, a game's review list,
 * the popular-reviews tab.
 *
 * Editorial rather than card-like. Four bands, top to bottom:
 *
 *   who wrote it        — avatar, name, timestamp
 *   what it is about    — headline or game title, with its year
 *   the verdict         — score badge + game + status, on their own surface,
 *                         with the box art set to the right of both
 *   what they said      — the prose, then likes and comments
 *
 * The hierarchy is deliberate and in this order: the score first, the artwork
 * second, the metadata third. Everything that is not a number or an image is
 * set quiet — muted greys, no borders, no shadows — so the only two things with
 * weight are the score and the cover.
 */
export function LogCard({ log, showAuthor = true, engagement }: LogCardProps) {
  const theme = useTheme();
  const { game, profile } = log;

  /*
   * The top line is the *review's* headline, never the game's name.
   *
   * The game is named in the meta block below it, beside its score and verdict,
   * where it belongs — printing it twice made the card look like it was about
   * two things. A review without a headline is not possible any more (the log
   * form requires one), so the only rows that reach the fallback are bare logs
   * and pre-existing rows, and those get no headline at all rather than a
   * borrowed one.
   */
  const headline = log.review_title?.trim() || null;

  return (
    <Card>
      <View style={styles.stack}>
        {showAuthor && profile && (
          <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
            <PressableScale accessibilityRole="button" style={styles.authorRow} scaleTo={0.99}>
              <Avatar uri={profile.avatar_url} name={displayNameFor(profile)} size={26} />
              <Text
                variant="bodyStrong"
                color="textSecondary"
                numberOfLines={1}
                style={styles.author}>
                {displayNameFor(profile)}
              </Text>
              <Text variant="micro" color="textMuted">
                {timeAgo(log.created_at)}
              </Text>
            </PressableScale>
          </Link>
        )}

        {/* A log with an article opens the full review; a bare log goes to the
            game, since there is nothing else to read. */}
        <Link
          href={
            log.review
              ? { pathname: '/review/[id]', params: { id: log.id } }
              : { pathname: '/game/[id]', params: { id: log.game_id } }
          }
          asChild>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={headline ?? game?.title ?? 'Game'}
            style={styles.body}
            scaleTo={0.99}>
            <View style={styles.left}>
              {headline && (
                <Text variant="heading" numberOfLines={2}>
                  {headline}
                </Text>
              )}

              <ReviewMeta
                score={log.rating}
                gameTitle={game?.title ?? 'Unknown game'}
                status={log.status}
              />

              {(log.platinum || log.completion_percent === 100) && (
                <View style={styles.badges}>
                  {log.platinum && (
                    <View style={styles.badge}>
                      <Ionicons name="trophy" size={13} color={theme.platinum} />
                      <Text variant="micro" style={{ color: theme.platinum }}>
                        Platinum
                      </Text>
                    </View>
                  )}
                  {log.completion_percent === 100 && (
                    <View style={styles.badge}>
                      <Ionicons name="checkmark-circle" size={13} color={theme.success} />
                      <Text variant="micro" style={{ color: theme.success }}>
                        100%
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {/* Only a very slight radius: this depicts a physical box, and a
                real case does not have 14px corners. */}
            <Poster
              coverUrl={game?.cover_url}
              heroUrl={game?.hero_url}
              title={game?.title}
              width={BOX_ART_WIDTH}
              rounded="image"
            />
          </PressableScale>
        </Link>

        {/* Full width, under both columns: the writing is the point of the
            card, and a column beside the art would set it in a narrow gutter. */}
        {log.review && (
          <Text variant="body" color="textSecondary" numberOfLines={4}>
            {log.review}
          </Text>
        )}

        {engagement && (
          <EngagementBar
            targetType="log"
            targetId={log.id}
            engagement={engagement}
            shareMessage={`${game?.title ?? 'This game'} — ${log.review ?? STATUS_VERB[log.status]}`}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.x12 },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  author: { flex: 1 },
  /* `flex-start` so the box art hangs from the top of the block rather than
     centring itself against however many lines the headline happens to run to. */
  body: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x16 },
  left: { flex: 1, gap: Spacing.x8 },
  badges: { flexDirection: 'row', gap: Spacing.x12, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
