import { memo } from 'react';
import Ionicons from '@expo/vector-icons/Ionicons';
import { Link, useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { formatReleaseDate } from '@/components/game-actions';
import { ReportFlag, useCanReport } from '@/components/report-flag';
import { reviewCells, type ReviewCellKey } from '@/components/review-cells';
import { SpoilerNotice } from '@/components/spoiler-notice';
import { Avatar } from '@/components/ui/avatar';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreReadout } from '@/components/ui/score-meter';
import { StatsStrip } from '@/components/ui/stats-strip';
import { Card } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { labelFor } from '@/constants/score';
import { STATUS_LABEL, STATUS_VERB, statusColor } from '@/constants/status';
import { FontFamily, Spacing, Type } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useLikeToggle } from '@/hooks/use-like-toggle';
import { useTheme } from '@/hooks/use-theme';
import type { Engagement } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';

/**
 * Box art width; its height is the 2:3 derivation — 99dp, the height the card's
 * design gives the cover in its top-right corner. Fixed dp: artwork does not
 * ride the spacing ladder (CLAUDE.md), so retuning `Spacing` never moves it.
 */
const BOX_ART_WIDTH = 66;

/**
 * Source Serif 4's vertical metrics, in ems, read from the font file: its
 * `hhea` ascender and descender, which its OS/2 typo metrics repeat and flag
 * for use, so both platforms lay the headline out from these two numbers.
 */
const SERIF_ASCENDER = 1.036;
const SERIF_DESCENDER = 0.335;

/**
 * How far the headline's line box runs below its baseline: the font's descent,
 * plus half of whatever leading the line height adds — React Native splits it
 * evenly above and below, as CSS does. About 3.6dp at 11 on 15, where the
 * leading is all but zero.
 *
 * The art stands this far above the head's bottom edge, which is what puts the
 * headline's *baseline* on the art's bottom edge rather than the bottom of its
 * line box, 3.6dp of air lower down.
 */
const HEADLINE = Type.reviewHeadlineSmall;
const HEADLINE_DESCENT =
  HEADLINE.fontSize * SERIF_DESCENDER +
  (HEADLINE.lineHeight - HEADLINE.fontSize * (SERIF_ASCENDER + SERIF_DESCENDER)) / 2;

/**
 * Lines of review printed under the header. There is no more, and no "Read
 * more" — the card is an index entry with a fixed height, and the review's own
 * page is what opens. Three, from the design: with the score, the playthrough
 * and the headline now in the header, the excerpt is a taste of the writing
 * rather than the card's only content.
 */
const REVIEW_LINES = 3;

/**
 * The excerpt's line: 10 on 15. The design sets it at ~10 on a 14.5 pitch —
 * a preview of the writing, dense enough for three lines to carry a real
 * sentence — and 10 is the type floor, so it goes no smaller. `caption`'s own
 * 13 line and 0.2 tracking are for single-line labels; running text at this
 * size needs the air between lines and no extra space between letters.
 */
const EXCERPT_LINE = 15;

/**
 * At most two playthrough facts beside the score, and platform then hours
 * first — the two the design shows. The rest stand in, in the review page's
 * order, when one of those was never recorded. The page itself shows up to four.
 */
const CARD_CELLS: readonly ReviewCellKey[] = ['platform', 'hours', 'progress', 'percent', 'coop'];
const MAX_CARD_CELLS = 2;

/**
 * The author line is a 20dp avatar beside one line of small type — about 20dp,
 * against a 44 (iOS) / 48 (Android) floor. Slop rather than padding, weighted
 * upward into the card's own padding, so the header does not move.
 */
const AUTHOR_SLOP = { top: 12, bottom: 4, left: 0, right: 0 };

/**
 * The like control is one 13dp line at the foot of the card. Its reach upward
 * stops short of the excerpt — whose link ends 8dp above it — and runs down
 * into the card's padding instead.
 */
const LIKE_SLOP = { top: 6, bottom: 14, left: 8, right: 8 };

/** Between the like count and the date on the foot's one quiet line. */
const META_SEPARATOR = ' · ';

export type LogCardProps = {
  log: LogWithRelations;
  /** Hide the author row on a profile, where every card has the same author. */
  showAuthor?: boolean;
  /** Omit to hide the like control entirely (e.g. in a compact list). */
  engagement?: Engagement;
};

/**
 * A review, everywhere it appears in a list: the feed, Home, a profile, the
 * popular-reviews tab.
 *
 * ## The shape
 *
 * ```text
 *   (av) name                                         ┌──────┐
 *   A Long Game Tit…  2018                            │      │
 *   95 OUTSTANDING  │ (ps) │  (⧗) │                   │ art  │
 *                   │ PS4  │ 570h │                   │      │
 *                                                     │      │
 *   The writer's headline                             │      │
 *   ┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄┄└──────┘
 *   … three lines of the review, across the whole card …
 *   ♥ LIKED   12,109 likes · Reviewed August 10, 2020        ⚑
 * ```
 *
 * **The top is a header**: who wrote it, what it is about, what they made of
 * it and how they played it — the author, the game and its release year on one
 * line, the score beside the playthrough strip, and the writer's headline —
 * with the box art in the top-right corner, level with it. Under the header the
 * writing runs the full width of the card, and under that the foot: the one
 * thing a reader can do to a review from a list — like it — with the like
 * count and the date on one quiet line beside it, and the report flag.
 *
 * **The headline stands on the art's bottom edge**, the dotted line above —
 * an alignment, not a drawn rule. Its baseline sits on the line the cover's
 * bottom makes across the card, however much or little the header holds above
 * it: the title, score and strip hang from the top, the headline stands on the
 * line, and the writing starts under it. When the header is taller than the
 * art — a two-line headline — the art moves down to meet the headline, never
 * the other way round.
 *
 * The score and the strip are the review page's own pieces at a card's size
 * (`<ScoreReadout size="compact">`, `<StatsStrip size="compact">`, and the same
 * `reviewCells`), so a card and the page it opens say the same thing the same
 * way. The type sits at the 10dp floor wherever the design went below it.
 *
 * ## Three targets, and each goes where it looks like it goes
 *
 * The artwork opens the game, the header's text and the excerpt open the
 * review, and the author line opens the person. A log with no writing has no
 * review to open, so its header opens the game.
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
  const accent = useAccent();
  const router = useRouter();
  const { game, profile } = log;

  /* The optimistic heart, from the shared hook rather than a second copy of the
     override rule. Only drawn when the caller supplied an `engagement`, which is
     how a compact list opts out of the control entirely. */
  const { liked, likeCount, toggle: toggleLike } = useLikeToggle('log', log.id, engagement);

  const headline = log.review_title?.trim() || null;
  const review = log.review?.trim() || null;
  const title = game?.title ?? 'Unknown game';
  const year = game?.release_year ?? null;

  /*
   * A review page is worth opening only when there is prose on it. A titled log
   * with no writing keeps its headline as a one-line verdict and points at the
   * game.
   */
  const hasArticle = review !== null;

  /* Only a review with writing on it can be reported, and never your own. */
  const canReport = useCanReport(log.user_id) && hasArticle;

  const gameHref = { pathname: '/game/[id]' as const, params: { id: log.game_id } };
  const reviewHref = { pathname: '/review/[id]' as const, params: { id: log.id } };

  const cells = reviewCells(log, theme, { order: CARD_CELLS, max: MAX_CARD_CELLS });
  const rating = log.rating === null ? null : Math.round(log.rating);
  const dated = `${hasArticle ? 'Reviewed' : 'Logged'} ${formatReleaseDate(log.created_at)}`;

  /*
   * The name alone on a review — the card is plainly one — and the status verb
   * after it on anything else, tinted: "Ada is playing" is the whole claim of a
   * log with no writing, and the verb is the word that makes it.
   */
  const verb = hasArticle ? 'reviewed' : STATUS_VERB[log.status];
  const statusTint = statusColor(log.status, theme);

  /*
   * The header is one link, so it says everything it shows, in reading order —
   * a `Pressable` collapses its subtree, and the score's own label would
   * otherwise be built and then discarded.
   */
  const headerLabel = [
    title,
    year,
    rating !== null ? `Rated ${rating} out of 100 — ${labelFor(rating)}` : STATUS_LABEL[log.status],
    ...cells.map((cell) => cell.a11y),
    headline,
  ]
    .filter(Boolean)
    .join('. ');

  /* The foot's quiet line: how many liked it, then when it was written. The
     count only where the like control is drawn — a compact list that opted out
     of it has no count to show either. */
  const likes =
    engagement && likeCount > 0
      ? `${likeCount.toLocaleString()} ${likeCount === 1 ? 'like' : 'likes'}`
      : null;
  const meta = [likes, dated].filter(Boolean);

  return (
    <Card>
      <View style={styles.root}>
        <View style={styles.head}>
          <View style={styles.headText}>
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
                    variant="caption"
                    color="textMuted"
                    numberOfLines={1}
                    style={styles.authorName}>
                    {displayNameFor(profile)}
                    {!hasArticle && (
                      <Text variant="caption" style={{ color: statusTint }}>{` ${verb}`}</Text>
                    )}
                  </Text>
                </PressableScale>
              </Link>
            ) : (
              !hasArticle && (
                <Text
                  variant="caption"
                  numberOfLines={1}
                  style={StyleSheet.flatten([styles.statusLine, { color: statusTint }])}>
                  {verb.charAt(0).toUpperCase() + verb.slice(1)}
                </Text>
              )
            )}

            {/* With a headline the link grows to the foot of the head, so the
                headline can stand there; the space it grows across is inside
                the header's own block, between the facts and the headline. */}
            <Link href={hasArticle ? reviewHref : gameHref} asChild>
              <PressableScale
                accessibilityRole="link"
                accessibilityLabel={headerLabel}
                style={StyleSheet.flatten([styles.header, headline ? styles.headerToLine : null])}
                scaleTo={0.99}>
                {/* The title and its release year, always on one line and one
                    baseline. The title gives way — it shrinks and ends in "…" —
                    and the year never does: four digits cost almost nothing, and
                    a year cut to "20…" says nothing at all. */}
                <View style={styles.titleRow}>
                  <Text variant="h4" numberOfLines={1} style={styles.title}>
                    {title}
                  </Text>
                  {year !== null && (
                    <Text variant="caption" style={{ color: accent.quietInk }}>
                      {year}
                    </Text>
                  )}
                </View>

                {/* The score and the playthrough on one line — the review page's
                    readout and strip at a card's size. When both do not fit the
                    strip wraps under the score rather than squeezing either. */}
                {(rating !== null || cells.length > 0) && (
                  <View style={styles.scoreRow}>
                    {rating !== null && (
                      <View style={styles.readout}>
                        <ScoreReadout score={rating} size="compact" />
                      </View>
                    )}
                    {cells.length > 0 && <StatsStrip cells={cells} size="compact" />}
                  </View>
                )}

                {headline && (
                  <Text variant="reviewHeadlineSmall" numberOfLines={2} style={styles.headline}>
                    {headline}
                  </Text>
                )}
              </PressableScale>
            </Link>
          </View>

          {/* The artwork opens the game. In an app built on box art this is the
              one link that should never have needed arguing for. */}
          <Link href={gameHref} asChild>
            <PressableScale
              accessibilityRole="link"
              accessibilityLabel={`Open ${title}`}
              style={StyleSheet.flatten([styles.art, headline ? styles.artOnLine : null])}
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
        </View>

        {/*
          The excerpt, under the header and across the whole card, clamped: a
          wall rather than a fold, so a row never changes height under the thumb.
          `proseInk`, the review's own quieter ink, in the interface's face at
          this size — see `reviewHeadlineSmall` for why the serif is the
          headline's here and not the excerpt's.
        */}
        {review &&
          (log.spoilers ? (
            /* The notice takes the excerpt's slot rather than sitting above it,
               so a flagged card is the same object with its content covered.
               `router.push` rather than a `<Link>`: the notice owns its own
               button role and nesting it in a link would announce twice. */
            <SpoilerNotice
              onPress={() => router.push(reviewHref)}
              minHeight={REVIEW_LINES * EXCERPT_LINE}
            />
          ) : (
            <Link href={reviewHref} asChild>
              <PressableScale accessibilityRole="link" style={styles.proseTap} scaleTo={0.995}>
                <Text
                  variant="caption"
                  color="proseInk"
                  numberOfLines={REVIEW_LINES}
                  style={styles.excerpt}>
                  {review}
                </Text>
              </PressableScale>
            </Link>
          ))}

        {/* The foot: the like, then its count and the date as one quiet line,
            and at the far end the report flag — the two things a reader can do
            *to* a review from a list, with when it was written between them.
            Always drawn, since there is always a date. */}
        <View style={styles.footer}>
          {engagement && (
            <PressableScale
              accessibilityRole="button"
              accessibilityState={{ selected: liked }}
              accessibilityLabel={liked ? 'Unlike this review' : 'Like this review'}
              onPress={toggleLike}
              hitSlop={LIKE_SLOP}
              scaleTo={0.94}
              style={StyleSheet.flatten(styles.like)}>
              <Ionicons
                name={liked ? 'heart' : 'heart-outline'}
                size={12}
                /* `liked`, not `danger`: a like is an endorsement, and
                   `danger` means something is about to be destroyed. */
                color={liked ? theme.liked : theme.textMuted}
              />
              <Text variant="label" color={liked ? 'textSecondary' : 'textMuted'}>
                {liked ? 'Liked' : 'Like'}
              </Text>
            </PressableScale>
          )}

          {/* Spoken with full stops rather than the dot. */}
          <Text
            variant="caption"
            color="textMuted"
            numberOfLines={1}
            accessibilityLabel={meta.join('. ')}
            style={styles.meta}>
            {meta.join(META_SEPARATOR)}
          </Text>

          {canReport && (
            <View style={styles.report}>
              <ReportFlag
                target={{ kind: 'review', logId: log.id }}
                authorId={log.user_id}
                label={
                  profile ? `Report ${displayNameFor(profile)}’s review` : 'Report this review'
                }
              />
            </View>
          )}
        </View>
      </View>
    </Card>
  );
});

const styles = StyleSheet.create({
  /* Header, excerpt, foot. `x8` (6) under the header, and the foot two more —
     the intervals the design sets between the three. */
  root: { gap: Spacing.x8 },

  /* The header text and the art side by side. Stretched, so the text column
     is always the head's full height and the headline can stand at its foot;
     the art sets its own `alignSelf` below, so its link never stretches into
     an invisible tail of touch area under the cover. */
  head: { flexDirection: 'row', gap: Spacing.x12 },
  /* `minWidth: 0` is load-bearing: without it a long unbroken title measures at
     its natural width and pushes the art off the card instead of wrapping. */
  headText: { flex: 1, minWidth: 0 },

  authorRow: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    maxWidth: '100%',
    gap: Spacing.x8,
    marginBottom: Spacing.x12,
  },
  /* Semibold at the floor — a name is a label here, not a heading. */
  authorName: { flexShrink: 1, fontFamily: FontFamily.semibold },
  statusLine: { marginBottom: Spacing.x12 },

  /* Title and score sit tight, one block of facts — the design leaves no
     interval between them beyond their own line boxes. */
  header: { alignSelf: 'stretch' },
  /* `flexGrow` rather than `flex: 1`: the link keeps its content height as its
     basis and only grows into the room the art leaves, so a header taller than
     the art is never squeezed. */
  headerToLine: { flexGrow: 1 },
  /* The auto margin takes all of that room, so the headline stands at the foot
     of the head — on the art's bottom edge (see `artOnLine`). */
  headline: { marginTop: 'auto' },
  /* The gap is the three caption spaces that used to sit between the title
     and its credit. `flexShrink` on the title alone is what makes the title,
     and never the year, give way — every flex child in React Native defaults
     to 0. */
  titleRow: { flexDirection: 'row', alignItems: 'baseline', gap: Spacing.x12 },
  title: { flexShrink: 1 },
  scoreRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    columnGap: Spacing.x20,
    rowGap: 2,
  },
  /* Lets a long verdict shorten rather than push the row wider than the column
     when the strip has already wrapped below. */
  readout: { flexShrink: 1 },

  /* Hung from the top, its top edge level with the avatar's… */
  art: { width: BOX_ART_WIDTH, alignSelf: 'flex-start' },
  /* …or, under a headline, standing on it: the bottom edge sits
     `HEADLINE_DESCENT` above the head's foot, which is exactly the headline's
     baseline. The art is the taller of the two on almost every card, so this
     sets the head's height and the headline comes down to meet it; only a
     header that outgrows the art — a two-line headline — moves the art down. */
  artOnLine: { alignSelf: 'flex-end', marginBottom: HEADLINE_DESCENT },
  proseTap: { width: '100%' },
  excerpt: { lineHeight: EXCERPT_LINE, letterSpacing: 0 },

  footer: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16, marginTop: 2 },
  like: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  /* Gives way before the flag does: on a narrow card the date ends in "…"
     rather than pushing the flag off the edge. */
  meta: { flexShrink: 1 },
  report: { marginLeft: 'auto' },
});
