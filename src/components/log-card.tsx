import { Link, useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { ScoreTile } from '@/components/ui/score-tile';
import { Text } from '@/components/ui/text';
import { labelFor } from '@/constants/score';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { Elevation, PosterAspectRatio, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';

/** The writer's picture, leading the top row. */
const AVATAR = 28;

/** The title may take two lines; the review gets three and ends in "…". */
const TITLE_LINES = 2;
const EXCERPT_LINES = 3;

/** Between the title and the developer line under it. */
const TITLE_GAP = 2;
/** Three lines of review: what a spoiler notice has to stand in for. */
const EXCERPT_HEIGHT = EXCERPT_LINES * Type.body.lineHeight;

/**
 * The box art, sized by what stands beside it.
 *
 * Exactly as tall as the fullest column the card can hold: a two-line title,
 * the developer line, the gap, and three lines of review. So the last line of
 * a full review ends on the art's bottom edge, and every card in the stack is
 * the same height whatever the title's length. 124dp tall and 83 wide at 2:3.
 * Fixed dp, as all art is
 * (CLAUDE.md, "Artwork does not ride the ladder") — a larger system font grows
 * the column past the art, never the art.
 */
const ART_HEIGHT =
  TITLE_LINES * Type.h4.lineHeight +
  TITLE_GAP +
  Type.bodySmall.lineHeight +
  Spacing.x8 +
  EXCERPT_HEIGHT;
const ART_WIDTH = Math.round(ART_HEIGHT * PosterAspectRatio);

/** The card's height at the default font size, for the skeleton that stands in for it. */
export const LOG_CARD_HEIGHT = 2 * Spacing.x16 + AVATAR + Spacing.x12 + ART_HEIGHT;

/**
 * The writer's link is a 28dp row against a 44 (iOS) / 48 (Android) floor.
 * Slop rather than padding, so the top row keeps its height; ten each way
 * stays clear of the art below it, which begins twelve under the row.
 */
const WRITER_SLOP = { top: 10, bottom: 10, left: 8, right: 8 };

export type LogCardProps = {
  log: LogWithRelations;
  /**
   * What goes between the writer's name and the time.
   *
   * **Nothing, today.** Badges are a feature for later; this is where they will
   * sit, in a row that already gives them the room.
   */
  badges?: ReactNode;
};

/**
 * A review, everywhere it appears in a list: Home, a profile's Reviews tab,
 * Search, the most-liked page.
 *
 * ## The shape
 *
 * ```text
 *   (av) @drgugglismitz  [badges]                    12h ago
 *   ┌──────┐  Hollow Knight                         ┌────┐
 *   │      │  Team Cherry · 2017                    │ 92 │
 *   │ art  │                                        └────┘
 *   │      │  Gorgeous and lonely, and far too long for
 *   │      │  what it has to say about either of them,
 *   └──────┘  which is most of what there is to say…
 * ```
 *
 * The owner's design, from a reference they supplied. Who and when across the
 * top; then the box art, with the game's title, its developer and year, and
 * the score beside it; then up to three lines of the review.
 *
 * ## One card for lists, one for a game's own screens
 *
 * This began on Home alone, as a look being tried; the owner then had it
 * replace "the rest of the review cards in the app". It took the place of the
 * Letterboxd-style card this file used to hold (title and year over the art,
 * five lines of review, the score on the art's baseline) and of the profile's
 * square-art review rows. **A game's own screens keep theirs**: the game page's
 * rail, the reviews sheet and a copy's screen draw `<ReviewQuote>` — text, a
 * name and a score — because there the game is already the subject and this
 * card would only say it again. Surprise Me keeps its own (`<ReviewCard>`) for
 * the same reason.
 *
 * ## A flat card, almost the colour of the page
 *
 * One solid fill (`reviewCard`) a shade under the page, corners just taken
 * off, and the card shadow. Nothing else is drawn on it.
 *
 * It got there in three steps, and the first two are not to be rebuilt. It
 * was a plate of *black chrome*: near-black metal with a spotlight at its top
 * centre, a sideways streak and a violet fringe, from the reference's silver
 * foil. The owner first had the metal brought up to nearly the page's colour,
 * then took the chrome off altogether — "make it only a solid background
 * color" — and with it the darker box the review sat in. So: no gradient, no
 * light, no rim, no recessed strip behind the words.
 *
 * ## What is on it, and what is not
 *
 * A time, in its corner, because the owner asked for it. No like, no headline,
 * no playthrough strip and no report flag — those are on the review's own
 * page, which is where every tap on the writing goes.
 *
 * ## Type
 *
 * One family. The title and the score are bold; everything else is regular.
 * `text` for the name, the title and the review; `textSecondary` for the
 * developer line and `textMuted` for the time, the quietest thing on the card,
 * as it is in the reference. Upright, with no quotation marks: the reference
 * sets a one-line quip in italics, and three lines of italic at 13 are harder
 * to read than the same three upright.
 *
 * ## Three targets
 *
 * The picture and name open the person, the art opens the game, and the title
 * and the writing open the review. A log with no writing has no review to
 * open, so its title and text open the game.
 *
 * Memoised: it is always in a list, and `log` comes straight out of query
 * data, so its reference is stable until the query itself changes.
 */
export const LogCard = memo(function LogCard({ log, badges }: LogCardProps) {
  const theme = useTheme();
  const router = useRouter();
  const { game, profile } = log;

  const title = game?.title ?? 'Unknown game';
  /* Either half can be missing — IGDB has games with no company and games with
     no date — and the line says whichever it has rather than a dangling dot. */
  const credit = [game?.developer, game?.release_year].filter(Boolean).join(' · ');
  const review = log.review?.trim() || null;
  const headline = log.review_title?.trim() || null;
  const blurb = review ?? headline;
  const rating = log.rating === null ? null : Math.round(log.rating);

  const name = profile ? displayNameFor(profile) : null;
  const handle = profile?.username ? `@${profile.username}` : name;
  const posted = timeAgoPosted(log.created_at);

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };
  const openHref = review !== null ? reviewHref : gameHref;

  const scoreLabel = rating !== null ? `Rated ${rating} out of 100, ${labelFor(rating)}` : null;
  const headerLabel = [title, credit, scoreLabel].filter(Boolean).join('. ');
  const readLabel =
    review !== null ? `Read ${handle ? `${handle}'s review` : 'the review'} of ${title}` : title;

  return (
    <View style={[styles.card, { backgroundColor: theme.reviewCard }]}>
      <View style={styles.top}>
        {profile && handle && (
          <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`${name ?? handle}'s profile`}
              hitSlop={WRITER_SLOP}
              style={StyleSheet.flatten(styles.writer)}
              scaleTo={0.97}>
              <Avatar uri={profile.avatar_url} name={name} size={AVATAR} />
              <Text variant="body" numberOfLines={1} style={styles.handle}>
                {handle}
              </Text>
            </PressableScale>
          </Link>
        )}

        <View style={styles.badges}>{badges}</View>

        {posted !== '' && (
          <Text variant="caption" color="textMuted">
            {posted}
          </Text>
        )}
      </View>

      <View style={styles.body}>
        <Link href={gameHref} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={`Open ${title}`}
            style={StyleSheet.flatten(styles.art)}
            scaleTo={0.97}>
            {/* No `gameId`: a review never wears the Must Play badge. */}
            <Poster
              coverUrl={game?.cover_url}
              heroUrl={game?.hero_url}
              title={game?.title}
              width={ART_WIDTH}
              rounded="image"
            />
          </PressableScale>
        </Link>

        <View style={styles.column}>
          <Link href={openHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={headerLabel}
              style={StyleSheet.flatten(styles.header)}
              scaleTo={0.99}>
              <View style={styles.titles}>
                <Text variant="h4" numberOfLines={TITLE_LINES}>
                  {title}
                </Text>
                {credit !== '' && (
                  <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                    {credit}
                  </Text>
                )}
              </View>
              {rating !== null && <ScoreTile score={rating} size="small" />}
            </PressableScale>
          </Link>

          {review !== null && log.spoilers ? (
            /* The notice takes the writing's place. Not inside a link: it is its
               own button, and a button in a link would announce twice. */
            <SpoilerNotice onPress={() => router.push(reviewHref)} minHeight={EXCERPT_HEIGHT} />
          ) : (
            <Link href={openHref} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={readLabel}
                style={StyleSheet.flatten(styles.words)}
                scaleTo={0.99}>
                {blurb ? (
                  <RichText variant="body" numberOfLines={EXCERPT_LINES} ellipsizeMode="tail">
                    {blurb}
                  </RichText>
                ) : (
                  <Text variant="h5" style={{ color: statusColor(log.status, theme) }}>
                    {STATUS_LABEL[log.status]}
                  </Text>
                )}
              </PressableScale>
            </Link>
          )}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  /* 15 in, a card's inset in the reference (`Spacing.x16`); 12 between the top
     row and the art. "Slightly rounded": half the app's card corner, the score
     tile's own. A flat fill and the card shadow — nothing drawn on it. */
  card: {
    padding: Spacing.x16,
    gap: Spacing.x12,
    borderRadius: Radius.lg,
    ...Elevation.card,
  },

  top: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* The name gives way before the time does: `minWidth: 0` is what lets a long
     handle shrink to "…" instead of pushing the time off the card. */
  writer: {
    flexShrink: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x8,
  },
  handle: { flexShrink: 1 },
  /* Everything left between the name and the time. Empty today, and drawn as
     nothing: the time is at the far right because this is what pushes it there. */
  badges: {
    flex: 1,
    minWidth: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
  },

  /* The art and the column side by side: the art sets the height at the
     default font size. */
  body: { flexDirection: 'row', gap: Spacing.x12 },
  /* Hung from the top, so its link is only ever as tall as the art. */
  art: { alignSelf: 'flex-start' },
  column: { flex: 1, minWidth: 0, gap: Spacing.x8 },

  /* The score at the far end of the title's row, level with its first line. */
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x8 },
  titles: { flex: 1, minWidth: 0, gap: TITLE_GAP },

  /* The review, straight on the card under the title. It takes the rest of the
     column so the whole space beside the art opens the review, not only the
     lines that happen to have words on them. */
  words: { flexGrow: 1 },
});
