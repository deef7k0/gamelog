import { memo, useState } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import {
  StyleSheet,
  View,
  type NativeSyntheticEvent,
  type TextLayoutEventData,
} from 'react-native';

import { EngagementBar } from '@/components/engagement-bar';
import { formatReleaseDate } from '@/components/game-actions';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreChip } from '@/components/ui/score-tile';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { platformFamilies } from '@/constants/platform-family';
import { labelFor } from '@/constants/score';
import { STATUS_ICON, STATUS_LABEL, STATUS_VERB, statusColor } from '@/constants/status';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';

/** Box art width. Its height is the 2:3 derivation, and nothing overrides it. */
const BOX_ART_WIDTH = 96;

/**
 * Lines of review shown before "Read more".
 *
 * **Five, down from ten**, and the number follows the column rather than the
 * other way round. Ten lines was right while the prose ran the card's full
 * width: a ~53-character measure, where ten lines is a readable paragraph. In
 * the artwork's column the measure is about 34 characters, and ten lines of that
 * is a narrow ribbon three hundred points tall — the card stops being a card.
 *
 * Five is enough to hear the writer's voice and short enough that the card stays
 * a row in a feed. The review's own page is where it is read; this is the
 * invitation.
 */
const REVIEW_LINES = 5;

/**
 * The author line is a 20dp avatar beside two lines of small type — about 32dp,
 * against a 44 (iOS) / 48 (Android) floor.
 *
 * Slop rather than padding, and weighted upward: padding would push the whole
 * text column down beside artwork that is not moving, and the space above the
 * line is the card's own padding, where nothing else is competing for a tap.
 */
const AUTHOR_SLOP = { top: 12, bottom: 4, left: 0, right: 0 };

/**
 * Lifts the inline "Read more" to the platform floor without moving the prose.
 *
 * 16 was the number to beat, not 22: `bodySmall` is a 16dp line box, so the old
 * `{ top: 11, bottom: 11 }` reached 38 — under both 44 and 48 — while the note
 * here claimed it cleared the floor. Measured, not assumed: 16 + 16 + 16 = 48.
 */
const READ_MORE_SLOP = { top: 16, bottom: 16, left: 8, right: 8 };

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
 * Four bands:
 *
 *   **The header.** Box art, and beside it everything about this log: who wrote
 *   it and about what, the review's own headline, the score, and how it was
 *   played. All of the metadata against the artwork, so the block below it is
 *   nothing but the writing.
 *
 *   **The review.** The writing, at full card width.
 *
 *   **Engagement.** Likes and comments.
 *
 * ## Why the prose is not beside the artwork
 *
 * It used to be, and the artwork took `fillHeight` so the two columns ended
 * level. That construction was genuinely elegant and it capped the card at
 * roughly four lines of text, because past that the poster stretched and
 * cropped: at 200% system text it showed about a third of the cover. The art is
 * the primary content on this screen, so it cannot be the thing that gives way.
 *
 * So the artwork is a fixed 2:3 block that nothing can stretch, and the writing
 * runs the full width underneath it, where it has the measure to be read rather
 * than sampled.
 *
 * ## Three targets, and each goes where it looks like it goes
 *
 * The card used to be one link. Tapping box art — in an app whose whole premise
 * is box art — opened an essay, and the game title, rendered in the brightest
 * ink on the row, opened the *author's profile*. Now: the artwork opens the
 * game, the headline and prose open the review, and the author line opens the
 * person, which is what its words are about.
 */
/**
 * Memoised: it is the tallest row in the app and it is always in a list.
 *
 * `log` and `engagement` come straight out of query data, so their references
 * are stable between renders until the query itself changes — which is exactly
 * the condition memo needs to be worth having.
 */
export const LogCard = memo(function LogCard({ log, showAuthor = true, engagement }: LogCardProps) {
  const theme = useTheme();
  const { game, profile } = log;

  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);

  const headline = log.review_title?.trim() || null;
  const review = log.review?.trim() || null;
  const title = game?.title ?? 'Unknown game';

  /*
   * A review page is worth opening only when there is prose on it.
   *
   * A headline with no body used to route to `/review/[id]` anyway, so the card
   * showed a review headline and opened a game page — content and destination
   * contradicting each other. A titled log with no writing is still just a log:
   * it keeps its headline as a one-line verdict and points at the game.
   */
  const hasArticle = review !== null;

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };

  /*
   * "reviewed" only when there is something to read.
   *
   * `STATUS_VERB` is already the app's vocabulary for the other cases and is
   * written as sentence fragments — "is playing", "wants to play" — precisely
   * so it can be dropped into a line like this one.
   */
  const verb = hasArticle ? 'reviewed' : STATUS_VERB[log.status];

  /*
   * The verb carries the colour, not a dot or a pill.
   *
   * A feed is read as sentences — "Ada is playing Hollow Knight" — and the two
   * words that say what happened are already the ones the eye lands on. Tinting
   * them makes the column scannable by state at a glance without adding a
   * single pixel of chrome to a row. "reviewed" is not a status, so it takes
   * the house colour: it is the app's own event rather than one of the four.
   */
  const statusTint = statusColor(log.status, theme);
  const verbTint = hasArticle ? theme.primaryText : statusTint;

  /*
   * The header column always has something under the headline.
   *
   * A log with no score and no writing would otherwise leave a column of pure
   * air beside a cover — which is exactly what the game page showed, since it
   * is the one query that admits rating-only logs.
   */
  const showStatusLine = log.rating === null;

  /*
   * Composed, not blanket.
   *
   * A single `accessibilityLabel` on the outer pressable used to override every
   * descendant — `Pressable` defaults to `accessible`, which collapses the
   * subtree — so the score and the entire review were silent, and
   * `ScoreNumber`'s own carefully-worded label was built and then discarded.
   * This says all of it, in reading order.
   */
  const verdictLabel =
    log.rating !== null
      ? `Rated ${Math.round(log.rating)} out of 100 — ${labelFor(log.rating)}`
      : STATUS_LABEL[log.status];
  const headerLabel = [headline, verdictLabel].filter(Boolean).join('. ');

  /*
   * The headline, never the essay.
   *
   * This used to interpolate the whole untruncated review body into the share
   * sheet, so a 2,000-word piece became a 2,000-word message; with no writing
   * at all it shared "Dispatch — wants to play", a fragment with no subject.
   * Each branch here is a complete thought on its own.
   */
  const shareMessage = `${title} — ${
    headline ?? (log.rating !== null ? `${Math.round(log.rating)}/100` : STATUS_LABEL[log.status])
  }`;

  /*
   * Only meaningful while collapsed: with `numberOfLines` set, the layout event
   * reports the clipped lines, so filling all ten means there is at least that
   * much. Guarded so it latches once rather than re-setting on every layout.
   */
  function handleTextLayout(event: NativeSyntheticEvent<TextLayoutEventData>) {
    if (!expanded && !overflows && event.nativeEvent.lines.length >= REVIEW_LINES) {
      setOverflows(true);
    }
  }

  return (
    <Card>
      {/*
        One column beside the artwork, and **nothing reaches past its left
        edge**.

        The card used to be two bands: a header row with the cover and a short
        metadata column, then the prose at the card's full width underneath. That
        gave the writing a proper measure, which was the whole argument for it —
        and it also meant the card had two left margins. The eye entered at the
        cover, moved right to the byline, then dropped back out to the card edge
        for the review, and every row of a feed did that twice.

        One column is the fix. The cover is the block on the left; everything
        that is *about* the review — who, what, the verdict, when, and the
        writing itself — starts at one x and stays there. The cost is a narrower
        measure for the excerpt, which is why it is an excerpt: `REVIEW_LINES` is
        four now rather than ten, and the review's own page is where it is read.
      */}
      <View style={styles.card}>
        {/* The artwork opens the game. In an app built on box art this is the
            one link that should never have needed arguing for. */}
        <Link href={gameHref} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`Open ${title}`}
            style={styles.art}
            scaleTo={0.97}>
            <Poster
              coverUrl={game?.cover_url}
              heroUrl={game?.hero_url}
              title={game?.title}
              width={BOX_ART_WIDTH}
              rounded="image"
            />
          </PressableScale>
        </Link>

        <View style={styles.column}>
          {/*
            Who, and what they did. The one sans line above the rule.

            The name carries the bright ink rather than the game: this line opens
            the person, and the title being the brightest thing on it was the
            reason people tapped a game and got a stranger's profile. The game's
            own emphasis is the serif title directly below.
          */}
          {showAuthor && profile ? (
            <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${displayNameFor(profile)} ${verb} ${title}`}
                hitSlop={AUTHOR_SLOP}
                style={styles.authorRow}
                scaleTo={0.99}>
                <Avatar uri={profile.avatar_url} name={displayNameFor(profile)} size={20} />
                <Text
                  variant="bodySmall"
                  color="textMuted"
                  numberOfLines={1}
                  style={styles.sentence}>
                  <Text variant="reviewByline">{displayNameFor(profile)}</Text>
                  <Text variant="bodySmall" style={{ color: verbTint }}>{` ${verb}`}</Text>
                </Text>
              </PressableScale>
            </Link>
          ) : (
            <Text variant="bodySmall" numberOfLines={1} style={{ color: verbTint }}>
              {verb.charAt(0).toUpperCase() + verb.slice(1)}
            </Text>
          )}

          {/* The rule under the byline. A hairline, not a gap: it is what
              separates *who is talking* from *what they are talking about*, and
              a column this tight has no room to say it with space alone. */}
          <View style={[styles.rule, { backgroundColor: theme.border }]} />

          <Link href={hasArticle ? reviewHref : gameHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={headerLabel || title}
              style={styles.verdict}
              scaleTo={0.99}>
              {/* Serif, because this is the subject of a piece of writing. See
                  `Type`'s review block — the split between the sans line above
                  and this one is what makes the card read as a review. */}
              <Text variant="reviewTitleSmall" numberOfLines={2}>
                {title}
              </Text>

              {/*
                The verdict line: the score as a filled rectangle, then the
                facts as marks.

                Icons without words here, deliberately, and it is the one place
                in the app that does it — the platform's own brand mark and a
                trophy, both conventions, sitting beside a score that *is*
                spelled out. The block is four items on one line in a ~200dp
                column; spelling each of them would wrap it to three rows and
                bury the excerpt. Every mark carries its label to a screen
                reader, so nothing is lost, only printed.
              */}
              <View style={styles.verdictRow}>
                {log.rating !== null && <ScoreChip score={log.rating} />}
                <LogMarks log={log} />
              </View>

              {showStatusLine && (
                <View style={styles.statusLine}>
                  <Ionicons name={STATUS_ICON[log.status]} size={13} color={statusTint} />
                  <Text variant="label" style={{ color: statusTint }}>
                    {STATUS_LABEL[log.status].toUpperCase()}
                  </Text>
                </View>
              )}

              <Text variant="caption" color="textMuted">
                {hasArticle ? 'Reviewed' : 'Logged'} {formatReleaseDate(log.created_at)}
              </Text>
            </PressableScale>
          </Link>

          {/* The excerpt, in the same column and in the review's own typeface.
              `proseInk` rather than `textSecondary`: a serif set at reading
              length wants to be quieter than the interface around it. */}
          {review && (
            <View style={styles.prose}>
              <Link href={reviewHref} asChild>
                <PressableScale accessibilityRole="link" style={styles.proseTap} scaleTo={0.995}>
                  <Text
                    variant="reviewExcerpt"
                    color="proseInk"
                    numberOfLines={expanded ? undefined : REVIEW_LINES}
                    onTextLayout={handleTextLayout}>
                    {review}
                  </Text>
                </PressableScale>
              </Link>

              {/*
               * Outside the link, deliberately.
               *
               * Expanding in place and navigating to the review are two
               * different intentions, and nesting one inside the other makes the
               * tap a coin toss. It also means the card stops ending on a bare
               * ellipsis — peak-end, and the end was a denial.
               */}
              {(overflows || expanded) && (
                <PressableScale
                  accessibilityRole="button"
                  accessibilityLabel={expanded ? 'Collapse this review' : 'Expand this review'}
                  accessibilityState={{ expanded }}
                  onPress={() => setExpanded((open) => !open)}
                  hitSlop={READ_MORE_SLOP}
                  style={styles.readMore}
                  scaleTo={0.97}>
                  <Text variant="bodySmall" style={{ color: theme.primaryText }}>
                    {expanded ? 'Read less' : 'Read more'}
                  </Text>
                </PressableScale>
              )}
            </View>
          )}

          {engagement && (
            <EngagementBar
              targetType="log"
              targetId={log.id}
              engagement={engagement}
              shareMessage={shareMessage}
            />
          )}
        </View>
      </View>
    </Card>
  );
});

/**
 * How this game was played, as **marks** — a platform, a playtime, a trophy.
 *
 * Icons without words, which is the one place in the app that does it, and it
 * needs the argument. The house rule is that colour is never the only carrier
 * and that every status ships its word beside its hue. That rule is about
 * *state* — a thing whose meaning a reader has to be told. These three are not:
 * a platform's own brand mark is the mark that platform puts on its own boxes, a
 * clock is a clock, and a trophy beside a score is the most conventional glyph
 * in this medium.
 *
 * What buys it is the row they sit in. `<ScoreChip>` beside them spells its
 * verdict out in full, so the line is never a run of unglossed symbols — and
 * this column is about 200dp, where four spelled-out facts wrap to three rows
 * and push the excerpt off the card.
 *
 * The playtime keeps its number, because a number is the fact; the icon is only
 * saying which number it is. Every mark carries an `accessibilityLabel`, so a
 * screen reader hears the words a sighted reader is being spared.
 */
function LogMarks({ log }: { log: LogWithRelations }) {
  const theme = useTheme();

  /* `played_on` is free text seeded from the game's own platform list, so it
     may be "PlayStation 5", "PS5" or something a user typed. Matching it to a
     family gives it a mark when it is recognisable; when it is not, the written
     value is kept as a word rather than dropped — the user chose to record it. */
  const family = log.played_on ? platformFamilies([log.played_on])[0] : undefined;

  return (
    <>
      {log.played_on &&
        (family ? (
          <Ionicons
            name={family.icon}
            size={14}
            color={family.accent}
            accessibilityLabel={`Played on ${family.label}`}
          />
        ) : (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {log.played_on}
          </Text>
        ))}

      {!!log.hours_played && (
        <View style={styles.mark} accessibilityLabel={`${log.hours_played} hours played`}>
          <Ionicons name="time-outline" size={13} color={theme.textMuted} />
          <Text variant="caption" color="textMuted">
            {log.hours_played}h
          </Text>
        </View>
      )}

      {log.platinum && (
        <Ionicons name="trophy" size={13} color={theme.platinum} accessibilityLabel="Platinum" />
      )}
    </>
  );
}

const styles = StyleSheet.create({
  /* The two columns. `flex-start` so the text column sizes to its content and
     the artwork's link keeps its own edges — left on the default `stretch`,
     whichever column is shorter grows an invisible tail of touch area. */
  card: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x12 },
  /* No `fillHeight` on the poster: the artwork's height is its own 2:3
     derivation and nothing in this row may change it. That is what makes the
     card safe at 200% system text. */
  art: { width: BOX_ART_WIDTH },
  /*
   * Everything that is not the cover, in one column with one left edge.
   *
   * `minWidth: 0` alongside `flex: 1`, and it is load-bearing: without it a long
   * unbroken game title measures at its natural width and pushes the column past
   * the card instead of wrapping inside it.
   */
  column: { flex: 1, minWidth: 0, gap: Spacing.x8 },

  authorRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Takes the slack so the sentence truncates rather than pushing the avatar. */
  sentence: { flex: 1 },
  /* A hairline, drawn as a filled view rather than a border: a 1dp `borderWidth`
     rounds up to a full pixel on some densities and reads as a rule rather than
     as a seam. */
  rule: { height: StyleSheet.hairlineWidth, alignSelf: 'stretch' },

  verdict: { gap: Spacing.x8 },
  /* The score rectangle and the marks on one line. `wrap` because a game on an
     unrecognised platform falls back to its written name, which is a word rather
     than a glyph and can need the second row. */
  verdictRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: Spacing.x8,
    rowGap: Spacing.x4,
  },
  mark: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
  statusLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },

  prose: { gap: Spacing.x8 },
  proseTap: { width: '100%' },
  readMore: { alignSelf: 'flex-start' },
});
