import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useRouter } from 'expo-router';
import { Linking, StyleSheet, View } from 'react-native';

import { ReviewQuote } from '@/components/review-quote';
import { InfoCard } from '@/components/ui/info-card';
import { ArtRail, Section, SectionMore } from '@/components/ui/section';
import { StatsStrip } from '@/components/ui/stats-strip';
import { Text } from '@/components/ui/text';
import { ratingVerdict, scoreColor } from '@/constants/score';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getRatingBreakdown, getTopGameReviews } from '@/lib/api';
import type { LogWithRelations } from '@/lib/database.types';
import { displayNameFor } from '@/lib/format';
import { getCriticSummary, quotedReviews, type CriticReview } from '@/lib/games/critics';
import { getTimeToBeat } from '@/lib/games/igdb';
import { parseGameId } from '@/lib/games';

/**
 * Height of the tallest bar in the rating graph, in dp.
 *
 * Fixed rather than proportional. The graph is read as a *shape* — where the
 * mass sits — and a container that grew with the data would make two games'
 * distributions incomparable at a glance, which is the one thing this is for.
 */
const GRAPH_HEIGHT = 64;

/** Bars are this tall at minimum, so an empty band is still a visible band. */
const BAR_FLOOR = 2;

/** IGDB returns times in seconds. */
const SECONDS_PER_HOUR = 3600;

// ---------------------------------------------------------------------------
// Rating breakdown
// ---------------------------------------------------------------------------

/**
 * How **this app's** users scored the game, as ten bars.
 *
 * ## Why the app's own numbers and not IGDB's
 *
 * Because the page already carries IGDB's aggregate as `COMMUNITY` in the
 * masthead, and a second number from the same source would be the same claim
 * twice. This one answers a question no external score can: *what did the people
 * here think* — and on a Letterboxd-shaped product that is the number the app
 * exists to produce.
 *
 * It is also the honest one. A mean of 74 hides whether a game is quietly
 * agreeable or violently divisive, and those are different games. The shape says
 * it: one tall column is consensus, two humps at the ends is an argument.
 *
 * ## The colour is the score ramp, per bar
 *
 * Each band takes the verdict colour of its own range — `scoreColor` at the
 * middle of the bucket — so the graph reads red-through-green left to right
 * without introducing a hue the app does not already own. That ramp is *data*,
 * which is what exempts it from the single-accent rule.
 *
 * Renders nothing at all when nobody has rated the game. An empty histogram
 * under a real heading claims a distribution exists and that it is flat.
 *
 * It used to carry the critics too, as a fold-out list of outlets and scores.
 * They have a section of their own now — `<CriticReviewsWidget>`, which quotes
 * them — and this is the app's own ratings and nothing else.
 */
export function RatingBreakdownGraph({ gameId }: { gameId: string }) {
  const theme = useTheme();

  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  const data = breakdown.data;
  if (!data) return null;

  const peak = Math.max(...data.buckets);
  const verdict = ratingVerdict(data.average, data.total);

  return (
    <InfoCard title="Rating breakdown">
      <View style={styles.graph} accessibilityRole="image" accessibilityLabel={describe(data)}>
        {data.buckets.map((count, index) => {
          /* The middle of the band, so bucket 0 (1–10) reads as 5 rather than
             as 0 — which `scoreColor` would treat as the bottom of the scale
             and is a whole band off. */
          const midpoint = index * 10 + 5;
          const height =
            peak === 0 ? BAR_FLOOR : Math.max(BAR_FLOOR, (count / peak) * GRAPH_HEIGHT);

          return (
            <View key={index} style={styles.barSlot}>
              <View
                style={[
                  styles.bar,
                  {
                    height,
                    backgroundColor:
                      count === 0 ? withAlpha(theme.textMuted, 0.25) : scoreColor(midpoint, theme),
                  },
                ]}
              />
            </View>
          );
        })}
      </View>

      {/*
        The verdict, then the evidence for it.

        Steam's arrangement, and it is the right way round: the phrase is what
        somebody actually reads, and the count is what tells them how much to
        trust it. A distribution drawn from six ratings and one drawn from six
        hundred look identical as bars.
      */}
      <View style={styles.verdictRow}>
        <Text variant="h5" style={{ color: scoreColor(data.average, theme) }}>
          {verdict.label}
        </Text>
        <Text variant="body" color="textMuted">
          {data.total} {data.total === 1 ? 'rating' : 'ratings'} · {data.average} average
        </Text>
      </View>
    </InfoCard>
  );
}

/** One sentence for a screen reader, since the bars themselves say nothing. */
function describe(data: { buckets: number[]; total: number; average: number }): string {
  const bands = data.buckets
    .map((count, index) => (count > 0 ? `${index * 10 + 1} to ${index * 10 + 10}: ${count}` : null))
    .filter(Boolean)
    .join(', ');
  return `Rating breakdown from ${data.total} ratings, average ${data.average} out of 100. ${bands}`;
}

// ---------------------------------------------------------------------------
// Time to beat
// ---------------------------------------------------------------------------

/**
 * How long the game takes, from IGDB's submitted times.
 *
 * Three lengths — rushed, ordinary, everything — and the number of people behind
 * them. The submission count is not a footnote: "55 hours to complete" from four
 * players and from four hundred are different claims, and IGDB publishes the
 * count precisely so a client can say which it is.
 *
 * Hours only. IGDB stores seconds and the raw value is meaningless to a reader;
 * minutes would be worse, since a 60-hour RPG becomes 3,600 of them.
 */
export function TimeToBeatWidget({ gameId }: { gameId: string }) {
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const times = useQuery({
    queryKey: ['time-to-beat', igdbId],
    queryFn: ({ signal }) => getTimeToBeat(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const data = times.data;
  if (!data) return null;

  const lengths = [
    { label: 'Hastily', seconds: data.hastily },
    { label: 'Normally', seconds: data.normally },
    { label: 'Completely', seconds: data.completely },
  ].filter((entry) => entry.seconds !== null);

  if (lengths.length === 0) return null;

  /* The three lengths as the app's row of figures — a bold figure over a quiet
     word, rules between. They were three filled tiles, which inside the card
     were cards inside a card. */
  return (
    <InfoCard title="Time to beat">
      <StatsStrip
        cells={lengths.map((entry) => ({
          key: entry.label,
          value: hoursFor(entry.seconds!),
          label: entry.label,
          a11y: `${entry.label}: ${hoursFor(entry.seconds!).replace(' h', ' hours')}`,
        }))}
      />

      <Text variant="caption" color="textMuted">
        Based on {data.count} {data.count === 1 ? 'submission' : 'submissions'}
      </Text>
    </InfoCard>
  );
}

/**
 * Seconds → a readable length.
 *
 * Rounded to the nearest hour above two, because "41 h" and "41.3 h" carry the
 * same information and the second one implies a precision an average of seven
 * submissions does not have. Under two hours it keeps a decimal, where the
 * difference between 1 h and 1.5 h is most of the game.
 */
function hoursFor(seconds: number): string {
  const hours = seconds / SECONDS_PER_HOUR;
  if (hours < 2) return `${Math.round(hours * 10) / 10} h`;
  return `${Math.round(hours)} h`;
}

// ---------------------------------------------------------------------------
// Reviews — the app's own, then the critics'
// ---------------------------------------------------------------------------

/**
 * How many lines of a review a card in a rail prints. Six of `reviewExcerpt`
 * fill the frame; a card with a foot — a score, a name — gives one up to it.
 */
const QUOTE_LINES = 6;

/**
 * What people here wrote, as a rail of cards — the most liked first.
 *
 * The critics' rail directly under it, with the app's own writers in it: the
 * same card (`<ReviewQuote>`), at the same size, with the writer's name where
 * a critic's card has nothing, because that rail names its outlets underneath.
 * The owner's direction. It was one review in a card of its own, with a heart,
 * a platform mark and the hours played; a card is now the words, a name and a
 * score, and a tap opens the review, where the rest is.
 *
 * The heading's More opens every review, in the sheet.
 *
 * Absent when nobody has written one — a section exists here only when it has
 * something in it — and no skeleton, for the reason the critics' rail has
 * none: a section drawn while loading and then withdrawn would move everything
 * under it twice.
 */
export function MemberReviewsWidget({
  gameId,
  title,
  onSeeAll,
}: {
  gameId: string;
  title: string;
  /** Open every review of the game. */
  onSeeAll: () => void;
}) {
  const router = useRouter();

  const top = useQuery({
    queryKey: ['top-reviews', gameId],
    queryFn: () => getTopGameReviews(gameId),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const reviews = top.data ?? [];
  if (reviews.length === 0) return null;

  return (
    <Section
      title="Reviews"
      more={{ accessibilityLabel: `See all reviews of ${title}`, onPress: onSeeAll }}>
      <ArtRail
        data={reviews}
        keyOf={(log) => log.id}
        shape="wide"
        renderArt={(log, size) => (
          <ReviewQuote
            text={log.review ?? ''}
            byline={writerOf(log)}
            score={log.rating}
            /* Always a foot here: every card carries its writer's name. */
            lines={QUOTE_LINES - 1}
            spoiler={!!log.spoilers}
            size={size}
          />
        )}
        labelOf={(log) =>
          [
            `${writerOf(log)}’s review`,
            log.rating !== null ? `scored it ${Math.round(log.rating)}` : null,
            log.spoilers ? 'Contains spoilers' : (log.review ?? '').trim(),
            'Opens the review.',
          ]
            .filter(Boolean)
            .join('. ')
        }
        onPressItem={(log) => router.push({ pathname: '/review/[id]', params: { id: log.id } })}
      />
    </Section>
  );
}

/** The name a review is signed with. */
function writerOf(log: LogWithRelations): string {
  return log.profile ? displayNameFor(log.profile) : 'Someone';
}

/**
 * What the critics wrote, as a rail of quotes — one card per outlet.
 *
 * The trade press is a different claim from the people here, so it is its own
 * section rather than a line in the app's own reviews: a sentence of the
 * review, the outlet it ran in, and the score it gave. The cards are the size
 * and rhythm of the screenshots at the top of the tab (`<ArtRail shape="wide">`),
 * with the quote where the picture is, and a card opens the review it quotes.
 *
 * ## Where it comes from
 *
 * OpenCritic, through the `opencritic` Edge Function — IGDB has an averaged
 * number and nothing an outlet wrote. The heading's More goes to the game's
 * OpenCritic page, which is also the attribution their data asks for.
 *
 * ## It is absent far more often than it is present
 *
 * No section at all when OpenCritic does not know the game (everything before
 * about 2013, and most small releases), when the function is not deployed, or
 * when the deployed one predates snippets and has scores but nothing to quote.
 * No skeleton either, for the reason the Reviews card has none: a section drawn
 * while loading and then withdrawn would move everything under it twice.
 */
export function CriticReviewsWidget({
  gameId,
  title,
  releaseYear,
}: {
  gameId: string;
  title: string;
  releaseYear: number | null;
}) {
  const accent = useAccent();

  const critics = useQuery({
    queryKey: ['critic-reviews', gameId],
    queryFn: () => getCriticSummary({ title, year: releaseYear, gameId }),
    enabled: !!title,
    /* The function keeps its own answer for days; this only spares the round
       trip while the app is open. */
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const summary = critics.data;
  const reviews = useMemo(() => quotedReviews(summary), [summary]);
  if (!summary || reviews.length === 0) return null;

  const url = summary.url;
  const facts = [
    summary.average !== null ? `${summary.average} average` : null,
    summary.count > 0 ? `${summary.count} ${summary.count === 1 ? 'review' : 'reviews'}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <Section
      title="Critic reviews"
      action={
        facts ? (
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {facts}
          </Text>
        ) : undefined
      }
      moreSlot={
        url ? (
          <SectionMore
            label="OpenCritic"
            accessibilityLabel={`See every critic review of ${title} on OpenCritic`}
            onPress={() => {
              Linking.openURL(url).catch(() => {
                // No handler for the scheme; nothing useful to say about it.
              });
            }}
          />
        ) : undefined
      }>
      <ArtRail
        data={reviews}
        keyOf={(review) => `${review.outlet}-${review.url ?? review.score ?? ''}`}
        shape="wide"
        renderArt={(review, size) => (
          /* The card is `<ReviewQuote>`, shared with the rail of members'
             reviews above. No name inside it: the outlet is printed under the
             card. An unscored review has no foot, and keeps the sixth line. */
          <ReviewQuote
            text={review.snippet ?? ''}
            quoted
            score={review.score}
            lines={review.score !== null ? QUOTE_LINES - 1 : QUOTE_LINES}
            size={size}
          />
        )}
        titleOf={(review) => review.outlet}
        subtitleOf={criticLine}
        labelOf={(review) =>
          [
            review.outlet,
            review.score !== null ? `scored it ${review.score}` : null,
            review.snippet,
            review.url ? 'Opens the review.' : null,
          ]
            .filter(Boolean)
            .join('. ')
        }
        onPressItem={(review) => {
          if (!review.url) return;
          Linking.openURL(review.url).catch(() => {
            // No handler for the scheme; nothing useful to say about it.
          });
        }}
      />
    </Section>
  );
}

/** Under the outlet's name: who wrote it and what they gave it. */
function criticLine(review: CriticReview): string | null {
  const parts = [review.score !== null ? `${review.score} / 100` : 'Unscored', review.author];
  return parts.filter(Boolean).join(' · ') || null;
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* `flex-end` so the bars grow upward from a shared baseline — the whole read
     of a histogram is the silhouette along its top edge. */
  graph: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.x4, height: GRAPH_HEIGHT },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: Radius.xs },

  verdictRow: { gap: 1 },
});
