import { Link, useRouter } from 'expo-router';
import { memo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { QuoteBlock } from '@/components/quote-block';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { RichText } from '@/components/ui/rich-text';
import { ScoreLine } from '@/components/ui/score';
import { Text } from '@/components/ui/text';
import { labelFor } from '@/constants/score';
import { STATUS_LABEL, statusColor } from '@/constants/status';
import { Elevation, PosterAspectRatio, Radius, Spacing, Type } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor, timeAgoPosted } from '@/lib/format';
import { cardShows, normaliseQuote } from '@/lib/review-quote';

/** The writer's picture, in the row under the writing. */
const AVATAR = 24;

/** The title may take two lines; the review gets three and ends in "…". */
const TITLE_LINES = 2;
const EXCERPT_LINES = 3;

/** Between the title, the credit line and the score under it. */
const TITLE_GAP = 2;
/** Three lines of review: what a spoiler notice has to stand in for. */
const EXCERPT_HEIGHT = EXCERPT_LINES * Type.body.lineHeight;

/**
 * The box art, and why it is this size.
 *
 * As tall as the billing beside it at its fullest — a two-line title, the
 * credit line and the score — so the row's height never changes with the
 * title's length and a stack of cards keeps one rhythm. 84dp tall and 56 wide
 * at 2:3, a touch taller than the billing as the reference's own art is.
 *
 * Fixed dp, as all art is (CLAUDE.md, "Artwork does not ride the ladder") — a
 * larger system font grows the billing past the art, never the art. It is not
 * `fillHeight`: that crops a 2:3 cover toward a square, and what it would crop
 * away is the top and foot of the box, which is where the box prints its name.
 */
const ART_HEIGHT =
  TITLE_LINES * Type.h4.lineHeight +
  TITLE_GAP +
  Type.bodySmall.lineHeight +
  TITLE_GAP +
  Type.body.lineHeight;
const ART_WIDTH = Math.round(ART_HEIGHT * PosterAspectRatio);

/**
 * The writer's link is a 24dp row against a 44 (iOS) / 48 (Android) floor.
 * Slop rather than padding, so the row keeps its height; twelve above it is
 * the card's own gap, which the slop sits inside.
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
 * A review, everywhere it appears in a list: Search's Reviews tab, a profile's
 * Reviews tab, the popular and latest pages. (Home had the first one; its band
 * of reviews is a row of covers now — `<ActivityRail>` — at the owner's
 * direction.)
 *
 * ## The shape
 *
 * ```text
 *   ┌──────┐  Hollow Knight
 *   │ art  │  Team Cherry · 2017
 *   └──────┘  92 OUTSTANDING
 *
 *   “Gorgeous and lonely, and far too long for what
 *   it has to say about either of them…”
 *
 *   (av) @drgugglismitz                        12h ago
 * ```
 *
 * **The owner's second reference for this card** (2026-10-20, a music app's
 * review cards): the art at the top left with the game, its credit and the
 * score stacked beside it; the writing under both, across the card's full
 * width; the writer at the foot. Their words: "look at the round corner ratio
 * of the card, the color, where the information is at, the stars are gamelog's
 * 71 + label score".
 *
 * Two things in it are deliberately not the reference's:
 *
 * - **The score is a number and its word** (`<ScoreLine>`, "92 OUTSTANDING"),
 *   where the reference has five stars — the owner's instruction. A 0–100
 *   scale has fifteen verdicts and the word is what stops 82 and 88 reading
 *   as the same opinion.
 * - **The card hugs the writing.** The reference's cards are a rail and stand
 *   equal-height, so a short quote leaves a hole above the name; here "when
 *   the review ends, immediately under is the username" (the owner's one
 *   correction). Nothing in the card grows to fill space.
 *
 * The time stayed, at the far end of the writer's row — the card has carried
 * one since the owner asked for it, and the reference has nowhere to put it.
 *
 * ## One card for lists, one for a game's own screens
 *
 * This began on Home alone, as a look being tried; the owner then had it
 * replace "the rest of the review cards in the app". **A game's own screens
 * keep theirs**: the game page and the reviews sheet draw
 * `<MemberReviewCard>` — the writing, then the writer under a rule — and a
 * copy's screen `<ReviewQuote>`, because there the game is already the
 * subject and this card would only say it again.
 *
 * ## The card itself
 *
 * One solid fill (`surface`, the owner's `#1B1F28`), the corner measured off
 * their reference (`Radius.review`), a hairline edge in `border` as the
 * reference draws one, and the card shadow. Nothing else on it: it was a plate
 * of black chrome with a spotlight and a violet fringe for one pass, and the
 * owner took first the metal and then the chrome off — "make it only a solid
 * background color". No gradient, no light, no recessed strip behind the
 * words. `<ListTile>` restates all four, so a collection card and this are one
 * object; change either and change both.
 *
 * ## The review, or its one sentence
 *
 * Its writer chooses, in the log form (0040's `review_display`): three lines
 * of the review, or the quote — the game in one word or sentence — between
 * large marks (`<QuoteBlock size="card">`), in the same place. A review with
 * only one of the two shows that one (`cardShows`). A spoiler flag covers
 * either.
 *
 * ## Type
 *
 * One family. The title and the score are bold; everything else is regular.
 * `text` for the name, the title and the review; `textSecondary` for the
 * credit line and `textMuted` for the time, the quietest thing on the card, as
 * it is in the reference. Upright, with no quotation marks of its own: the
 * quote brings its own drawn marks, and three lines of italic at 13 are harder
 * to read than the same three upright.
 *
 * ## Three targets
 *
 * The picture and name open the person, the art opens the game, and the
 * billing and the writing open the review. A log with no writing has no review
 * to open, so those open the game instead.
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
  /* The review's text or its one sentence — whichever its writer chose for
     its cards, or whichever it has (`cardShows`). */
  const shows = cardShows(log);
  const review = log.review?.trim() || null;
  const quote = normaliseQuote(log.review_title) || null;
  const rating = log.rating === null ? null : Math.round(log.rating);

  const name = profile ? displayNameFor(profile) : null;
  const handle = profile?.username ? `@${profile.username}` : name;
  const posted = timeAgoPosted(log.created_at);

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };
  const openHref = shows !== null ? reviewHref : gameHref;

  const scoreLabel = rating !== null ? `Rated ${rating} out of 100, ${labelFor(rating)}` : null;
  const headerLabel = [title, credit, scoreLabel].filter(Boolean).join('. ');
  const readLabel =
    shows === 'quote'
      ? `“${quote}” — read ${handle ? `${handle}'s review` : 'the review'} of ${title}`
      : shows === 'text'
        ? `Read ${handle ? `${handle}'s review` : 'the review'} of ${title}`
        : title;

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <View style={styles.top}>
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

        <Link href={openHref} asChild>
          <PressableScale
            accessibilityRole="link"
            accessibilityLabel={headerLabel}
            style={StyleSheet.flatten(styles.billing)}
            scaleTo={0.99}>
            <Text variant="h4" numberOfLines={TITLE_LINES}>
              {title}
            </Text>
            {credit !== '' && (
              <Text variant="bodySmall" color="textSecondary" numberOfLines={1}>
                {credit}
              </Text>
            )}
            {/* Where the reference sets its stars: the score and its verdict
                word, both in the score ramp's own colour. */}
            {rating !== null ? (
              <ScoreLine score={rating} />
            ) : (
              <Text variant="h5" style={{ color: statusColor(log.status, theme) }}>
                {STATUS_LABEL[log.status]}
              </Text>
            )}
          </PressableScale>
        </Link>
      </View>

      {shows !== null &&
        (log.spoilers ? (
          /* The notice takes the writing's place — the quote's as much as the
             text's: one sentence can give the ending away. Not inside a link:
             it is its own button, and a button in a link would announce twice. */
          <SpoilerNotice onPress={() => router.push(reviewHref)} minHeight={EXCERPT_HEIGHT} />
        ) : (
          <Link href={reviewHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={readLabel}
              style={StyleSheet.flatten(styles.words)}
              scaleTo={0.99}>
              {shows === 'quote' && quote ? (
                /* The writer's one sentence, between the marks — the reference's
                   own quotation marks, drawn (`<QuoteBlock>`). */
                <QuoteBlock text={quote} size="card" color={theme.text} accessible={false} />
              ) : (
                <RichText variant="body" numberOfLines={EXCERPT_LINES} ellipsizeMode="tail">
                  {review ?? ''}
                </RichText>
              )}
            </PressableScale>
          </Link>
        ))}

      <View style={styles.foot}>
        {profile && handle && (
          <Link href={{ pathname: '/profile/[id]', params: { id: profile.id } }} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`${name ?? handle}'s profile`}
              hitSlop={WRITER_SLOP}
              style={StyleSheet.flatten(styles.writer)}
              scaleTo={0.97}>
              <Avatar uri={profile.avatar_url} name={name} size={AVATAR} />
              <Text
                variant="bodySmall"
                color="textSecondary"
                numberOfLines={1}
                style={styles.handle}>
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
    </View>
  );
});

const styles = StyleSheet.create({
  /*
   * 15 in, a card's inset in the reference (`Spacing.x16`); 12 between the
   * three blocks, and nothing between the writing and the writer but that
   * twelve — the owner's one correction to the reference, whose cards stand
   * equal-height in a rail and leave a hole there.
   *
   * The corner is `Radius.review`, measured off both their references; the
   * edge is the hairline the references draw, and the fill a flat `surface`.
   */
  card: {
    padding: Spacing.x16,
    gap: Spacing.x12,
    borderRadius: Radius.review,
    borderWidth: 1,
    ...Elevation.card,
  },

  /* The art and the billing, top-aligned: the art is the taller of the two and
     sets the row's height. */
  top: { flexDirection: 'row', gap: Spacing.x12, alignItems: 'flex-start' },
  art: { alignSelf: 'flex-start' },
  /* Title, credit, score — stacked, and elastic so a long title wraps inside
     the card rather than pushing the art out of it. */
  billing: { flex: 1, minWidth: 0, gap: TITLE_GAP },

  /* The writing, straight on the card and across its full width. No `flexGrow`:
     the card is as tall as what is in it. */
  words: { width: '100%' },

  foot: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
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
});
