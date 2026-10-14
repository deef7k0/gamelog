import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { MemberReviewCard } from '@/components/member-review-card';
import { ScoreSummary } from '@/components/score-summary';
import { Avatar } from '@/components/ui/avatar';
import { InfoCard } from '@/components/ui/info-card';
import { PANEL_GAP, Panel } from '@/components/ui/panel';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Section, useSectionInset } from '@/components/ui/section';
import { StatsStrip } from '@/components/ui/stats-strip';
import { Text } from '@/components/ui/text';
import { ratingVerdict, scoreColor } from '@/constants/score';
import { STATUS_LABEL } from '@/constants/status';
import { FontFamily, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useReadingLanguages } from '@/hooks/use-reading-languages';
import { useTheme } from '@/hooks/use-theme';
import { getGamePlayers, getRatingBreakdown, getTopGameReview, type GamePlayer } from '@/lib/api';
import { readingKey } from '@/lib/discovery';
import { displayNameFor } from '@/lib/format';
import { getTimeToBeat } from '@/lib/games/igdb';
import { parseGameId } from '@/lib/games';
import { useAuth } from '@/store/auth';

/** IGDB returns times in seconds. */
const SECONDS_PER_HOUR = 3600;

// ---------------------------------------------------------------------------
// Ratings — what the people here scored it
// ---------------------------------------------------------------------------

/**
 * GameLog's own verdict on the game, at the head of its Overview: the word,
 * the average, and how the scores divide.
 *
 * ```text
 *   ╭ Ratings ──────────────── 128 ratings ╮
 *   │ ──────────────────────────────────── │
 *   │ Great                           ┌──┐ │
 *   │                                 │84│ │
 *   │ ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓  ▒▒▒▒  ░░    └──┘ │
 *   ╰──────────────────────────────────────╯
 * ```
 *
 * The owner's direction (2026-10-09): the ratings graph "used inside the
 * reviews sheet", on the Overview — in a card titled as the reference's is, a
 * film's page in Letterboxd, with the count at the far end of the title. The
 * graph is `<ScoreSummary>`, the sheet's own, so the two are one thing; the
 * card is a door to that sheet, where the same summary heads every review.
 *
 * **The app's own numbers, never IGDB's.** This answers what an outside score
 * cannot: what the people here thought.
 *
 * Renders nothing when nobody has rated the game — an empty graph under a real
 * heading claims a distribution exists and that it is flat — and nothing while
 * it loads: the page's masthead asks for the same numbers under the same key,
 * so they have nearly always arrived with the page.
 */
export function RatingsCard({
  gameId,
  title,
  onOpen,
}: {
  gameId: string;
  title: string;
  /** Open every review of the game. */
  onOpen: () => void;
}) {
  const accent = useAccent();

  const breakdown = useQuery({
    queryKey: ['rating-breakdown', gameId],
    queryFn: () => getRatingBreakdown(gameId),
    enabled: !!gameId,
  });

  const data = breakdown.data;
  if (!data) return null;

  const verdict = ratingVerdict(data.average, data.total);
  const counted = `${data.total.toLocaleString()} ${data.total === 1 ? 'rating' : 'ratings'}`;

  return (
    <Panel
      title="Ratings"
      trailing={
        <Text variant="bodySmall" style={{ color: accent.quietInk }}>
          {counted}
        </Text>
      }
      onPress={onOpen}
      accessibilityLabel={`Ratings of ${title} on GameLog: ${verdict.label}, ${data.average} out of 100 from ${counted}. Opens the reviews.`}>
      {/* The count is in the heading, so the summary does not say it twice. */}
      <ScoreSummary breakdown={data} counted={false} />
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// Played by — and by the people you follow
// ---------------------------------------------------------------------------

/** A face in a square: the reference's 46pt on a 393pt phone, to the app's scale. */
const FACE = 44;

/**
 * Who played the game, as two squares side by side: anybody, and the people
 * you follow.
 *
 * ```text
 *   ╭ Played by ──── 214 ╮  ╭ From your friends ╮
 *   │ ────────────────── │  │ ───────────────── │
 *   │  ◍      ◍          │  │  ◍      ◍         │
 *   │  84     Playing    │  │  91     77        │
 *   ╰────────────────────╯  ╰───────────────────╯
 * ```
 *
 * The owner's reference (2026-10-09) is the pair of "Watched by" squares on a
 * film's page in Letterboxd: two faces each, and under each face what that
 * person gave it — here the 0–100 score in the score ramp's colour, or the
 * word for where they are with it when they have not scored it.
 *
 * - **Played** is playing, played, paused or dropped. A game on somebody's
 *   backlog has not been played by them.
 * - **Friends** are the people you follow and your accepted friends
 *   (`getCircleIds`). You are in neither square: these are other people.
 * - **A face opens that person's record of this game** (`game-stats`): what
 *   they logged, and Steam's measured time when there is any.
 *
 * The pair is absent when nobody else has played the game. When somebody has
 * and none of them is yours, the second square says so in a sentence rather
 * than leaving, so the first is never a lone half-width card.
 */
export function PlayedBy({ gameId }: { gameId: string }) {
  const accent = useAccent();
  const inset = useSectionInset();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;

  const players = useQuery({
    queryKey: ['game-players', gameId, viewerId],
    queryFn: () => getGamePlayers(gameId, viewerId),
    enabled: !!gameId,
    staleTime: 60_000,
  });

  const data = players.data;
  if (!data || data.total === 0) return null;

  return (
    <View style={[styles.squares, { paddingHorizontal: inset }]}>
      <Panel
        title="Played by"
        margin={0}
        style={styles.square}
        trailing={
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            {data.total.toLocaleString()}
          </Text>
        }>
        <Faces players={data.recent} gameId={gameId} />
      </Panel>

      <Panel title="From your friends" margin={0} style={styles.square}>
        {data.circle.length > 0 ? (
          <Faces players={data.circle} gameId={gameId} />
        ) : (
          <Text variant="bodySmall" style={{ color: accent.quietInk }}>
            Nobody you follow has played this yet.
          </Text>
        )}
      </Panel>
    </View>
  );
}

/** Up to two people: a face each, and under it what they gave the game. */
function Faces({ players, gameId }: { players: readonly GamePlayer[]; gameId: string }) {
  const router = useRouter();
  const theme = useTheme();
  const accent = useAccent();

  return (
    <View style={styles.faces}>
      {players.map((player) => {
        const rounded = player.rating === null ? null : Math.round(player.rating);
        const status = STATUS_LABEL[player.status];

        return (
          <PressableScale
            key={player.userId}
            accessibilityRole="button"
            accessibilityLabel={`${player.name}, ${
              rounded !== null ? `scored it ${rounded}` : status.toLowerCase()
            }. Opens their record of this game.`}
            onPress={() =>
              router.push({
                pathname: '/game-stats/[user]/[game]',
                params: { user: player.userId, game: gameId },
              })
            }
            hitSlop={FACE_SLOP}
            scaleTo={0.94}
            style={StyleSheet.flatten(styles.face)}>
            <Avatar uri={player.avatarUrl} name={player.name} size={FACE} />
            {rounded !== null ? (
              <Text
                variant="bodySmall"
                style={[styles.faceScore, { color: scoreColor(rounded, theme) }]}>
                {rounded}
              </Text>
            ) : (
              <Text variant="bodySmall" numberOfLines={1} style={{ color: accent.quietInk }}>
                {status}
              </Text>
            )}
          </PressableScale>
        );
      })}
    </View>
  );
}

/** A face is 44 across; this takes its target to the tap floor on Android. */
const FACE_SLOP = { left: 2, right: 2, top: 0, bottom: 0 };

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
// Reviews — the most liked of the app's own
// ---------------------------------------------------------------------------

/**
 * How much of the most-liked review the Overview prints. A sample, offered to
 * somebody reading about the game; the sheet behind the heading's More prints
 * twice as much of each, and the review's own page all of it.
 */
const TOP_REVIEW_LINES = 5;

/**
 * What people here wrote: the most liked review of the game, in one card.
 *
 * It was a rail of the ten newest reviews, most liked first, in the critics'
 * card. The owner's direction (2026-10-09): one card, "from the most liked
 * review", drawn as a review is on a film's page in Letterboxd —
 * `<MemberReviewCard>`, which the reviews sheet's rows are too. One, because
 * the heading's More is a tap from all of them, and a sample that scrolls
 * sideways is a second list competing with the first.
 *
 * Which review it is is `getTopGameReview`: most liked, the newest of a tie —
 * **of the ones this reader can read**, when there is one (0038). The slot
 * holds one review, and the most liked one in a language somebody does not
 * read tells them nothing; with none they can read, it is the most liked
 * outright. The card opens that review; the heading's More opens every
 * review, in the sheet, where nothing is left out.
 *
 * Absent when nobody has written one — a section exists here only when it has
 * something in it — and no skeleton, for the reason the critics' rail has
 * none: a section drawn while loading and then withdrawn would move everything
 * under it twice.
 */
export function TopReview({
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
  const inset = useSectionInset();
  const viewerId = useAuth((state) => state.session?.user.id) ?? null;
  const { reading, ready } = useReadingLanguages();

  const top = useQuery({
    /* Under the key the log form and a moderator's removal invalidate
       (`['top-reviews', gameId]`), with the viewer after it: whether the
       heart is lit depends on who is looking. */
    queryKey: ['top-reviews', gameId, viewerId, readingKey(reading)],
    queryFn: () => getTopGameReview(gameId, viewerId, reading),
    /* After the reader's languages are known, so the card is not drawn with
       one review and then redrawn with another. */
    enabled: !!gameId && ready,
    staleTime: 60_000,
  });

  const review = top.data;
  if (!review) return null;

  const { log } = review;
  const name = displayNameFor(log.profile);

  return (
    <Section
      title="Reviews"
      more={{ accessibilityLabel: `See all reviews of ${title}`, onPress: onSeeAll }}>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={[
          `${name}’s review, the most liked`,
          log.rating !== null ? `scored it ${Math.round(log.rating)}` : null,
          log.spoilers ? 'Contains spoilers' : (log.review ?? '').trim(),
          review.likes > 0 ? `${review.likes} ${review.likes === 1 ? 'like' : 'likes'}` : null,
          'Opens the review.',
        ]
          .filter(Boolean)
          .join('. ')}
        onPress={() => router.push({ pathname: '/review/[id]', params: { id: log.id } })}
        scaleTo={0.99}
        style={{ marginHorizontal: inset }}>
        <MemberReviewCard
          name={name}
          avatarUrl={log.profile?.avatar_url ?? null}
          text={log.review ?? ''}
          score={log.rating}
          likes={review.likes}
          comments={review.comments}
          likedByViewer={review.likedByViewer}
          lines={TOP_REVIEW_LINES}
          spoiler={!!log.spoilers}
        />
      </PressableScale>
    </Section>
  );
}

// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  /* Two equal squares, a panel's gap apart; `stretch` (the default) keeps them
     one height whichever holds more. */
  squares: { flexDirection: 'row', gap: PANEL_GAP },
  square: { flex: 1 },
  faces: { flexDirection: 'row', gap: Spacing.x12 },
  /* Its line under the face is centred on the face, as the reference's
     ratings are under theirs. */
  face: { alignItems: 'center', gap: Spacing.x4, minWidth: FACE },
  /* The bold family — Android synthesises no weight for a custom font. */
  faceScore: { fontFamily: FontFamily.bold, fontVariant: ['tabular-nums'] },
});
