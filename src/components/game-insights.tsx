import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Image } from 'expo-image';
import { Linking, StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { InfoCard } from '@/components/ui/info-card';
import { Text } from '@/components/ui/text';
import { ACCLAIM_THRESHOLD, ratingVerdict, scoreColor } from '@/constants/score';
import { Radius, Spacing, withAlpha } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getRatingBreakdown } from '@/lib/api';
import { getCriticReviews } from '@/lib/games/critics';
import { getGameEvents, getTimeToBeat, type GameEvent } from '@/lib/games/igdb';
import { parseGameId } from '@/lib/games';

/** The event thumbnail. Wide enough to recognise a logo, small enough to be a mark. */
const EVENT_ART = 64;

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
 */
export function RatingBreakdownGraph({ gameId, title }: { gameId: string; title: string }) {
  const theme = useTheme();
  const accent = useAccent();
  const [criticsOpen, setCriticsOpen] = useState(false);

  const critics = useQuery({
    queryKey: ['critic-reviews', title],
    queryFn: () => getCriticReviews(title),
    enabled: !!title,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  const data = breakdown.data;
  if (!data) return null;

  const peak = Math.max(...data.buckets);
  const verdict = ratingVerdict(data.average, data.total);
  const acclaim = critics.data && critics.data.reviews.length > 0 ? critics.data : null;

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

      {/*
        Critics, when there are any.

        A second, separate claim — this is the trade press, not the people here —
        so it sits under its own rule rather than being mixed into the numbers
        above. `Critically Acclaimed` is earned by the *average of outlets*
        clearing `ACCLAIM_THRESHOLD`, never by one good review.

        Renders nothing at all when OpenCritic has no record, or when the
        `opencritic` function is not deployed: see `lib/games/critics.ts`. The
        section is absent rather than empty, because "no critic scores" is not a
        fact worth a heading.
      */}
      {acclaim && (
        <View style={[styles.critics, { borderTopColor: theme.border }]}>
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded: criticsOpen }}
            accessibilityLabel={
              criticsOpen
                ? 'Hide critic scores'
                : `Show ${acclaim.reviews.length} critic scores, average ${acclaim.average}`
            }
            onPress={() => setCriticsOpen((open) => !open)}
            scaleTo={0.98}
            hitSlop={Spacing.x8}
            style={StyleSheet.flatten(styles.criticsHead)}>
            <View style={styles.criticsHeadText}>
              {acclaim.average !== null && acclaim.average >= ACCLAIM_THRESHOLD && (
                <Text variant="h5" style={{ color: theme.identityGold }}>
                  Critically Acclaimed
                </Text>
              )}
              <Text variant="bodySmall" color="textMuted">
                {acclaim.count} critic {acclaim.count === 1 ? 'review' : 'reviews'}
                {acclaim.average !== null ? ` · ${acclaim.average} average` : ''}
              </Text>
            </View>

            <Ionicons
              name={criticsOpen ? 'chevron-up' : 'chevron-down'}
              size={18}
              color={theme.textMuted}
            />
          </PressableScale>

          {criticsOpen && (
            <View style={styles.criticRows}>
              {acclaim.reviews.map((review) => (
                <View key={`${review.outlet}-${review.score}`} style={styles.criticRow}>
                  <View style={styles.criticLine}>
                    <Text variant="body" numberOfLines={1} style={styles.criticOutlet}>
                      {review.outlet}
                    </Text>
                    <Text variant="h5" style={{ color: scoreColor(review.score, theme) }}>
                      {review.score}
                    </Text>
                  </View>

                  {/* The score, drawn. A number and a bar of the same length say
                      the same thing twice — which is the point: the bars make a
                      column of outlets scannable as a shape, the way the
                      histogram above is, without reading a single figure. */}
                  <View style={[styles.criticTrack, { backgroundColor: accent.elevated }]}>
                    <View
                      style={[
                        styles.criticFill,
                        {
                          width: `${Math.max(0, Math.min(100, review.score))}%`,
                          backgroundColor: scoreColor(review.score, theme),
                        },
                      ]}
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>
      )}
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
  const accent = useAccent();
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

  return (
    <InfoCard title="Time to beat">
      <View style={styles.times}>
        {lengths.map((entry) => (
          <View key={entry.label} style={[styles.time, { backgroundColor: accent.elevated }]}>
            <Text variant="body" color="textSecondary">
              {entry.label}
            </Text>
            <Text variant="h2">{hoursFor(entry.seconds!)}</Text>
          </View>
        ))}
      </View>

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
// Events
// ---------------------------------------------------------------------------

/**
 * Showcases, conferences and award shows the game appeared at.
 *
 * Most games have none, and that is what makes it worth a widget: an appearance
 * at The Game Awards or a Nintendo Direct is a fact about the game's *life* that
 * nothing else on the page carries. A release date says when it shipped; this
 * says when it was a moment.
 *
 * Renders nothing when the list is empty rather than an empty state — an absence
 * here is the normal case and does not need explaining.
 */
export function GameEventsWidget({ gameId }: { gameId: string }) {
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const events = useQuery({
    queryKey: ['game-events', igdbId],
    queryFn: ({ signal }) => getGameEvents(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  const data = events.data ?? [];
  if (data.length === 0) return null;

  return (
    <InfoCard
      title="Featured in"
      action={
        <Text variant="body" color="textMuted">
          {data.length}
        </Text>
      }>
      {/*
        A stacked list of rows, not a carousel of cards.

        Each event used to be its own filled, rounded card with a 16:9 banner,
        paged horizontally — a card inside a card, and the most elaborate one on
        the tab for a section most games do not have at all. As rows with a small
        thumbnail they cost a fraction of the height, need no paging hint, and
        stop competing with the panels around them. The art shrinks from a
        full-width banner to a 64dp thumb, which is the right size for something
        that is a label rather than a picture you are meant to look at.
      */}
      <View style={styles.events}>
        {data.map((event) => (
          <EventRow key={event.id} event={event} />
        ))}
      </View>
    </InfoCard>
  );
}

/**
 * One event: its art, its name, its date.
 *
 * The artwork falls back twice — IGDB's `event_logo`, then a frame of the stream
 * it links to (see `youtubeThumbnail`), then a flat panel carrying the event's
 * initial. The third rung matters: a card with a hole where a picture should be
 * looks broken, where a lettered panel looks like a thing without a picture.
 */
function EventRow({ event }: { event: GameEvent }) {
  const accent = useAccent();

  const body = (
    <View style={styles.event}>
      {event.logoUrl ? (
        <Image
          source={{ uri: event.logoUrl }}
          style={styles.eventArt}
          contentFit="cover"
          transition={220}
          accessibilityIgnoresInvertColors
        />
      ) : (
        <View
          style={[
            styles.eventArt,
            styles.eventFallback,
            { backgroundColor: accent.m3.surfaceContainerHigh },
          ]}>
          <Text variant="h2" color="textMuted">
            {event.name.trim().charAt(0).toUpperCase()}
          </Text>
        </View>
      )}

      <View style={styles.eventText}>
        <Text variant="body" numberOfLines={2}>
          {event.name}
        </Text>
        {event.startTime !== null && (
          <Text variant="bodySmall" color="textMuted" numberOfLines={1}>
            {formatEventDate(event.startTime)}
          </Text>
        )}
      </View>
    </View>
  );

  /* Only the ones with somewhere to go are pressable. A tappable row that does
     nothing is worse than a flat one. */
  if (!event.liveStreamUrl) return body;

  return (
    <PressableScale
      accessibilityRole="link"
      accessibilityLabel={`${event.name}. Opens the event.`}
      scaleTo={0.98}
      onPress={() => {
        Linking.openURL(event.liveStreamUrl!).catch(() => {
          // No handler for the scheme; nothing useful to say about it.
        });
      }}>
      {body}
    </PressableScale>
  );
}

/** Unix seconds → "10 December 2020, 20:30" in the reader's own locale. */
function formatEventDate(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* `flex-end` so the bars grow upward from a shared baseline — the whole read
     of a histogram is the silhouette along its top edge. */
  graph: { flexDirection: 'row', alignItems: 'flex-end', gap: Spacing.x4, height: GRAPH_HEIGHT },
  barSlot: { flex: 1, justifyContent: 'flex-end' },
  bar: { width: '100%', borderRadius: Radius.xs },

  verdictRow: { gap: 1 },
  critics: { paddingTop: Spacing.x12, borderTopWidth: StyleSheet.hairlineWidth, gap: Spacing.x8 },
  criticsHead: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  criticsHeadText: { flex: 1, gap: 1 },
  criticRows: { gap: Spacing.x12 },
  criticRow: { gap: Spacing.x4 },
  criticLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  criticOutlet: { flex: 1 },
  criticTrack: { height: 4, borderRadius: Radius.pill, overflow: 'hidden' },
  criticFill: { height: '100%', borderRadius: Radius.pill },

  times: { flexDirection: 'row', gap: Spacing.x8 },
  time: {
    flex: 1,
    alignItems: 'center',
    gap: Spacing.x4,
    paddingVertical: Spacing.x12,
    borderRadius: Radius.image,
  },

  events: { gap: Spacing.x12 },
  /* A row with no fill of its own — the `<InfoCard>` around it is the surface. */
  event: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x12 },
  eventFallback: { alignItems: 'center', justifyContent: 'center' },
  /* 16:9 still — event art is a landscape banner — but at thumbnail scale. A
     fixed dp width rather than a share of the row, per the rule that artwork does
     not ride the spacing ladder. */
  eventArt: { width: EVENT_ART, aspectRatio: 16 / 9, borderRadius: Radius.image },
  eventText: { flex: 1, gap: 1 },
});
