import { memo } from 'react';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import {
  COMPACT_NUMBER_LINE,
  COMPACT_NUMBER_SIZE,
  ScoreReadout,
} from '@/components/ui/score-meter';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { labelFor } from '@/constants/score';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { FontFamily, PosterAspectRatio, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';

/**
 * Lines of review beside the art, and the pitch they are set on: 14 on 20,
 * measured from the card's design. `prose` is the 14; its own 22 is for a page
 * somebody reads, and five lines of it would not fit beside the art.
 */
const EXCERPT_LINES = 5;
const EXCERPT_LINE = 20;

/**
 * Inter Bold's vertical metrics, in ems, from the font file (its `hhea` and
 * OS/2 typo metrics agree, and the typo metrics are flagged for use).
 */
const INTER_ASCENDER = 1984 / 2048;
const INTER_DESCENDER = 494 / 2048;

/**
 * How far the score's line box runs below its baseline: the font's descent,
 * plus half the leading its line height adds — React Native splits it evenly,
 * as CSS does. About 4.9dp at 21 on 25. The score is pulled down by this much
 * so its *baseline*, not the bottom of its box, stands on the art's bottom edge.
 */
const SCORE_DESCENT =
  COMPACT_NUMBER_SIZE * INTER_DESCENDER +
  (COMPACT_NUMBER_LINE - COMPACT_NUMBER_SIZE * (INTER_ASCENDER + INTER_DESCENDER)) / 2;

/** Between the last line of the review and the score's figures. */
const SCORE_GAP = Spacing.x4;

/**
 * The box art, sized by what stands beside it: five lines of review, the gap,
 * and the score from its baseline up — so the score's baseline and the art's
 * bottom edge are one line, and the review can never run into the score.
 * 124dp tall and 83 wide at 2:3, the design's measure. Fixed dp, as all art is
 * (CLAUDE.md, "Artwork does not ride the ladder").
 */
const BOX_ART_HEIGHT =
  EXCERPT_LINES * EXCERPT_LINE + SCORE_GAP + (COMPACT_NUMBER_LINE - SCORE_DESCENT);
const BOX_ART_WIDTH = Math.round(BOX_ART_HEIGHT * PosterAspectRatio);

/** The author's avatar, at the right end of the top row. */
const AVATAR = 26;

/**
 * The author link is one line of small type beside a 26dp avatar, against a
 * 44 (iOS) / 48 (Android) floor. Slop rather than padding, so the row keeps
 * its height.
 */
const AUTHOR_SLOP = { top: 11, bottom: 11, left: 8, right: 0 };

export type LogCardProps = {
  log: LogWithRelations;
  /** Hide the author on a profile, where every card has the same author. */
  showAuthor?: boolean;
};

/**
 * A review, everywhere it appears in a list: the feed, Home, a profile, the
 * popular-reviews tab.
 *
 * ## The shape
 *
 * ```text
 *   Portal 2  2011                         user_05a7 (av)
 *   ┌──────┐  The morality of the show wasn't
 *   │      │  questioned until he caught someone
 *   │ art  │  who was rich and powerful. You see
 *   │      │  how this looks, right? And then the…
 *   │      │
 *   └──────┘┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄84 GREAT
 * ```
 *
 * The owner's design, after Letterboxd's review list: the game's title and
 * year on the left of the top row and the writer on the right — name, then
 * avatar; the box art under the title with the review beside it; and the
 * score at the bottom right, under the avatar, its baseline on the art's
 * bottom edge (the dotted line).
 *
 * **The review never runs into the score.** It is five lines at most and ends
 * in "…" when there is more, always at the end of its fifth line; the art is
 * exactly tall enough for those five lines, a small gap and the score's
 * figures (see `BOX_ART_HEIGHT`), so the score sits under the text, never
 * beside it. At a larger system font size the lines grow and the score moves
 * down with them rather than into them.
 *
 * Nothing else is on the card — no headline, no playthrough strip, no date, no
 * likes, no report flag. They are on the review's own page, which is where
 * every tap on the writing goes.
 *
 * ## Four targets
 *
 * The title and the writing open the review, the art opens the game, the name
 * and avatar open the person. A log with no writing has no review to open, so
 * its title and text open the game.
 */
/**
 * Memoised: it is always in a list, and `log` comes straight out of query data,
 * so its reference is stable until the query itself changes.
 */
export const LogCard = memo(function LogCard({ log, showAuthor = true }: LogCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { game, profile } = log;

  const title = game?.title ?? 'Unknown game';
  const year = game?.release_year ?? null;
  const review = log.review?.trim() || null;
  const headline = log.review_title?.trim() || null;
  const hasArticle = review !== null;
  const rating = log.rating === null ? null : Math.round(log.rating);
  const author = profile ? displayNameFor(profile) : null;

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };
  const openHref = hasArticle ? reviewHref : gameHref;

  /* A log with no writing still says something beside its art: its own
     headline when it has one, and otherwise where the writer is with the game,
     in that status's colour. */
  const blurb = review ?? headline;
  const scoreLabel = rating !== null ? `Rated ${rating} out of 100, ${labelFor(rating)}` : null;
  const readLabel = [
    hasArticle ? `Read ${author ? `${author}'s review` : 'the review'} of ${title}` : title,
    scoreLabel,
  ]
    .filter(Boolean)
    .join('. ');

  const score = rating !== null && (
    <View style={styles.score}>
      <ScoreReadout score={rating} size="compact" />
    </View>
  );

  return (
    <Card padded={false}>
      <View style={styles.root}>
        <View style={styles.top}>
          <Link href={openHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={[title, year].filter(Boolean).join(', ')}
              style={StyleSheet.flatten(styles.titleLink)}
              scaleTo={0.99}>
              <Text variant="h3" numberOfLines={1} style={styles.title}>
                {title}
              </Text>
              {year !== null && (
                <Text variant="bodySmall" color="textSecondary">
                  {year}
                </Text>
              )}
            </PressableScale>
          </Link>

          {showAuthor && profile && author && (
            <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={`${author}'s profile`}
                hitSlop={AUTHOR_SLOP}
                style={StyleSheet.flatten(styles.author)}
                scaleTo={0.97}>
                <Text
                  variant="caption"
                  color="textMuted"
                  numberOfLines={1}
                  style={styles.authorName}>
                  {author}
                </Text>
                <Avatar uri={profile.avatar_url} name={author} size={AVATAR} />
              </PressableScale>
            </Link>
          )}
        </View>

        <View style={styles.body}>
          <Link href={gameHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`Open ${title}`}
              style={StyleSheet.flatten(styles.art)}
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

          {review && log.spoilers ? (
            /* The notice takes the writing's place, as the reference's does.
               Not inside a link: it is its own button, and a button in a link
               would announce twice. */
            <View style={styles.column}>
              <SpoilerNotice
                onPress={() => router.push(reviewHref)}
                minHeight={EXCERPT_LINES * EXCERPT_LINE}
              />
              {score}
            </View>
          ) : (
            <Link href={openHref} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={readLabel}
                style={StyleSheet.flatten(styles.column)}
                scaleTo={0.99}>
                {blurb ? (
                  <Text
                    variant="prose"
                    color="textSecondary"
                    numberOfLines={EXCERPT_LINES}
                    ellipsizeMode="tail"
                    style={styles.excerpt}>
                    {blurb}
                  </Text>
                ) : (
                  <Text variant="h5" style={{ color: statusColor(log.status, theme) }}>
                    {STATUS_LABEL[log.status]}
                  </Text>
                )}
                {score}
              </PressableScale>
            </Link>
          )}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  /* The design's inset: 15 around, 10 between the top row and the art. */
  root: { padding: Spacing.x24, gap: Spacing.x16 },

  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* The title gives way before the year does, and the whole link before the
     author: `minWidth: 0` is what lets a long title shrink instead of pushing
     the avatar off the card. */
  titleLink: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.x8,
  },
  title: { flexShrink: 1 },
  author: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
    maxWidth: '50%',
  },
  /* Semibold at the floor — a name is a label here, not a heading. */
  authorName: { flexShrink: 1, fontFamily: FontFamily.semibold },

  /* The art and the writing side by side, stretched to the same height: the
     taller one — the art, at the default font size — sets it. */
  body: { flexDirection: 'row', gap: Spacing.x12 },
  /* Hung from the top, so its link is only ever as tall as the art. */
  art: { alignSelf: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  excerpt: { lineHeight: EXCERPT_LINE, fontSize: Type.prose.fontSize },
  /* At the foot of the column, right-aligned under the avatar, and pulled down
     by its own descent so its baseline is the art's bottom edge. */
  score: { marginTop: 'auto', alignSelf: 'flex-end', marginBottom: -SCORE_DESCENT },
});
