import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreNumber } from '@/components/ui/score';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { STATUS_VERB, statusColor } from '@/constants/status';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgo } from '@/lib/format';

/** Box art width. Its *height* comes from the text beside it — see `fillHeight`. */
const BOX_ART_WIDTH = 88;

/**
 * Floor for the text column, and therefore for the artwork.
 *
 * 132 is what 88 of box art comes to at 2:3, so a card with almost nothing in
 * it still shows a cover at its natural proportions. Above this the text drives
 * the height and the art crops to follow.
 */
const MIN_ART_HEIGHT = 132;

/** Lines of review shown on the card. */
const REVIEW_LINES = 4;

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
 * Three bands:
 *
 *   **The sentence.** `Deef reviewed Dispatch`, with the avatar and the
 *   timestamp. Naming the game here is what let the block below stop naming it
 *   — the card used to print the title in a verdict line *and* imply it in the
 *   headline, which made it look like it was about two things. The verb is not
 *   always "reviewed": a bare log says "played", "is playing", "wants to play",
 *   which is the honest reading of a row with no writing in it.
 *
 *   **The review.** Headline, then the writing, in the column the game title
 *   used to sit in. Box art holds the right edge.
 *
 *   **Engagement.** Likes and comments.
 *
 * The score sits **on the artwork**, top-left. It was a bare numeral leading a
 * text row; there it competed with the headline for the first thing you read,
 * and here it is unmistakably the verdict *on that game* because it is pinned
 * to the game's own cover.
 *
 * **The art and the text column are the same height by construction.** The
 * poster takes `fillHeight`, so the row's stretch gives it whatever the text
 * comes to — a fixed 2:3 box beside a variable column only ever lines up by
 * accident, and that mismatch was what made the old card look bottom-heavy.
 */
export function LogCard({ log, showAuthor = true, engagement }: LogCardProps) {
  const theme = useTheme();
  const { game, profile } = log;

  const headline = log.review_title?.trim() || null;
  const review = log.review?.trim() || null;
  const title = game?.title ?? 'Unknown game';

  /*
   * "reviewed" only when there is something to read.
   *
   * `STATUS_VERB` is already the app's vocabulary for the other cases and is
   * written as sentence fragments — "is playing", "wants to play" — precisely
   * so it can be dropped into a line like this one.
   */
  const verb = review ? 'reviewed' : STATUS_VERB[log.status];

  /*
   * The verb carries the colour, not a dot or a pill.
   *
   * A feed is read as sentences — "Ada is playing Hollow Knight" — and the two
   * words that say what happened are already the ones the eye lands on. Tinting
   * them makes the column scannable by state at a glance without adding a
   * single pixel of chrome to a row. "reviewed" is not a status, so it takes
   * the house colour: it is the app's own event rather than one of the four.
   */
  const verbTint = review ? theme.primaryText : statusColor(log.status, theme);

  return (
    <Card>
      <View style={styles.stack}>
        {/*
         * One Text, three spans — so a long title wraps as a sentence rather
         * than truncating or shoving the timestamp off the row. "Deef reviewed
         * Grand Theft Auto: San Andreas" simply runs to a second line with the
         * name and the game both still legible; three sibling Texts in a row
         * would have had to pick one to cut.
         */}
        {showAuthor && profile ? (
          <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
            <PressableScale accessibilityRole="button" style={styles.authorRow} scaleTo={0.99}>
              <Avatar uri={profile.avatar_url} name={displayNameFor(profile)} size={26} />

              <Text variant="bodySmall" color="textMuted" numberOfLines={2} style={styles.sentence}>
                <Text variant="h5" color="textSecondary">
                  {displayNameFor(profile)}
                </Text>
                <Text variant="bodySmall" style={{ color: verbTint }}>{` ${verb} `}</Text>
                <Text variant="h5">{title}</Text>
              </Text>

              <Text variant="caption" color="textMuted">
                {timeAgo(log.created_at)}
              </Text>
            </PressableScale>
          </Link>
        ) : (
          /*
           * Author hidden — but the game still has to be named.
           *
           * This row carries the title now, so dropping it wholesale on a
           * profile would leave a headline and a paragraph about a game the
           * card never identifies. The author's name is what goes; the sentence
           * loses its subject and keeps its object.
           */
          <View style={styles.authorRow}>
            <Text variant="h5" numberOfLines={2} style={styles.sentence}>
              {title}
            </Text>
            <Text variant="caption" color="textMuted">
              {timeAgo(log.created_at)}
            </Text>
          </View>
        )}

        {/* A log with an article opens the full review; a bare log goes to the
            game, since there is nothing else to read. */}
        <Link
          href={
            review
              ? { pathname: '/review/[id]', params: { id: log.id } }
              : { pathname: '/game/[id]', params: { id: log.game_id } }
          }
          asChild>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={headline ?? title}
            style={styles.body}
            scaleTo={0.99}>
            <View style={styles.left}>
              {/* The game title's old slot. */}
              {headline && (
                <Text variant="h3" numberOfLines={2}>
                  {headline}
                </Text>
              )}

              {(log.platinum || log.completion_percent === 100) && (
                <View style={styles.badges}>
                  {log.platinum && (
                    <View style={styles.badge}>
                      <Ionicons name="trophy" size={13} color={theme.platinum} />
                      <Text variant="caption" style={{ color: theme.platinum }}>
                        Platinum
                      </Text>
                    </View>
                  )}
                  {log.completion_percent === 100 && (
                    <View style={styles.badge}>
                      <Ionicons name="checkmark-circle" size={13} color={theme.success} />
                      <Text variant="caption" style={{ color: theme.success }}>
                        100%
                      </Text>
                    </View>
                  )}
                </View>
              )}

              {/* `textSecondary`, not `text`: the prose is the longest thing on
                  the card and the quietest, so the headline above it stays what
                  you land on first. */}
              {review && (
                <Text variant="body" color="textSecondary" numberOfLines={REVIEW_LINES}>
                  {review}
                </Text>
              )}
            </View>

            <View style={styles.art}>
              <Poster
                coverUrl={game?.cover_url}
                heroUrl={game?.hero_url}
                title={game?.title}
                width={BOX_ART_WIDTH}
                rounded="image"
                fillHeight
              />

              {/* Flush into the corner, and taking the artwork's own radius on
                  that side so it reads as part of the cover rather than as a
                  sticker on top of it. The scrim is what keeps a coloured
                  numeral legible over whatever the box art happens to be. */}
              {log.rating !== null && (
                <View style={[styles.scoreTag, { backgroundColor: theme.scrim }]}>
                  <ScoreNumber score={log.rating} size="inline" />
                </View>
              )}
            </View>
          </PressableScale>
        </Link>

        {engagement && (
          <EngagementBar
            targetType="log"
            targetId={log.id}
            engagement={engagement}
            shareMessage={`${title} — ${review ?? STATUS_VERB[log.status]}`}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  stack: { gap: Spacing.x12 },
  /* `flex-start` so the timestamp stays level with the first line when the
     sentence wraps to two. */
  authorRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x8 },
  /* Takes the slack, so the timestamp keeps the right edge and the sentence
     wraps instead of pushing it away. */
  sentence: { flex: 1 },

  /* No `alignItems`: the row's default `stretch` is what gives the artwork the
     text column's height. Setting `flex-start` here would collapse it. */
  body: { flexDirection: 'row', gap: Spacing.x12 },
  left: { flex: 1, gap: Spacing.x8, minHeight: MIN_ART_HEIGHT },
  art: { width: BOX_ART_WIDTH },
  scoreTag: {
    position: 'absolute',
    top: 0,
    left: 0,
    paddingHorizontal: Spacing.x4 + 2,
    paddingVertical: 1,
    borderTopLeftRadius: Radius.image,
    borderBottomRightRadius: Radius.image,
  },

  badges: { flexDirection: 'row', gap: Spacing.x12, flexWrap: 'wrap' },
  badge: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
