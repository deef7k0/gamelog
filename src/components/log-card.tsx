import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreLabel, ScorePill } from '@/components/ui/score';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { STATUS_VERB, statusColor } from '@/constants/status';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgo } from '@/lib/format';

const POSTER_WIDTH = 64;

export type LogCardProps = {
  log: LogWithRelations;
  /** Hide the author row on a profile, where every card has the same author. */
  showAuthor?: boolean;
  /** Omit to hide the like/comment row entirely (e.g. in a compact list). */
  engagement?: Engagement;
};

/**
 * One activity item: who logged what, how they rated it, and what they said.
 * Used by the feed, profiles and a game's review list.
 */
export function LogCard({ log, showAuthor = true, engagement }: LogCardProps) {
  const theme = useTheme();
  const { game, profile } = log;

  return (
    <Card>
      <View style={styles.stack}>
        {showAuthor && profile && (
          <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
            <PressableScale accessibilityRole="button" style={styles.authorRow} scaleTo={0.99}>
              <Avatar uri={profile.avatar_url} name={displayNameFor(profile)} size={34} />

              <View style={styles.authorText}>
                <Text variant="bodyStrong" numberOfLines={1}>
                  {displayNameFor(profile)}{' '}
                  <Text variant="body" color="textSecondary">
                    {STATUS_VERB[log.status]}
                  </Text>
                </Text>
              </View>

              <Text variant="caption" color="textMuted">
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
            accessibilityLabel={game?.title ?? 'Game'}
            style={styles.gameRow}
            scaleTo={0.98}>
            <Poster
              coverUrl={game?.cover_url}
              heroUrl={game?.hero_url}
              title={game?.title}
              width={POSTER_WIDTH}
              rounded="small"
            />
            <View style={styles.gameBody}>
              {/* Review headline takes precedence over the game title when the
                  log is an actual article — that is what the reader is opening. */}
              {log.review_title ? (
                <>
                  <Text variant="bodyStrong" numberOfLines={2}>
                    {log.review_title}
                  </Text>
                  <Text variant="micro" color="textMuted" numberOfLines={1}>
                    {game?.title ?? 'Unknown game'}
                  </Text>
                </>
              ) : (
                <Text variant="bodyStrong" numberOfLines={2}>
                  {game?.title ?? 'Unknown game'}
                </Text>
              )}

              <View style={styles.metaRow}>
                <Text variant="micro" style={{ color: statusColor(log.status, theme) }}>
                  {STATUS_VERB[log.status].toUpperCase()}
                </Text>
                {log.rating !== null && <ScoreLabel score={log.rating} />}
                {!showAuthor && (
                  <Text variant="micro" color="textMuted">
                    {timeAgo(log.created_at)}
                  </Text>
                )}
              </View>

              {(log.platinum || log.completion_percent === 100) && (
                <View style={styles.badges}>
                  {log.platinum && (
                    <View style={[styles.badge, { backgroundColor: `${theme.platinum}22` }]}>
                      <Ionicons name="trophy" size={11} color={theme.platinum} />
                      <Text variant="micro" style={{ color: theme.platinum }}>
                        Platinum
                      </Text>
                    </View>
                  )}
                  {log.completion_percent === 100 && (
                    <View style={[styles.badge, { backgroundColor: `${theme.success}22` }]}>
                      <Ionicons name="checkmark-circle" size={11} color={theme.success} />
                      <Text variant="micro" style={{ color: theme.success }}>
                        100%
                      </Text>
                    </View>
                  )}
                </View>
              )}
            </View>

            {log.rating !== null && <ScorePill score={log.rating} size="medium" />}
          </PressableScale>
        </Link>

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
  stack: { gap: Spacing.four },
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  authorText: { flex: 1 },
  gameRow: { flexDirection: 'row', gap: Spacing.four, alignItems: 'center' },
  gameBody: { flex: 1, gap: Spacing.two },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, flexWrap: 'wrap' },
  badges: { flexDirection: 'row', gap: Spacing.two, flexWrap: 'wrap' },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: Spacing.two,
    paddingVertical: 3,
    borderRadius: Radius.pill,
  },
});
