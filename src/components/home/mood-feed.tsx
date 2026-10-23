import { useQuery } from '@tanstack/react-query';
import { Fragment, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';

import { BandError } from '@/components/home/band-error';
import { QuickPicks, QuickPicksSkeleton } from '@/components/home/quick-picks';
import { CoverRailSkeleton, GameCoverRail } from '@/components/game-rail';
import { HomeSection } from '@/components/home-section';
import { Arrive, stagger } from '@/components/ui/arrive';
import { LogoMark } from '@/components/ui/logo-mark';
import { Spacing } from '@/constants/theme';
import type { Game } from '@/lib/games';
import {
  getMoodQuickPicks,
  getMoodShelves,
  getMoodStudio,
  type MoodStudio,
} from '@/lib/games/mood-feed';
import { quickPicksFor, type HomeFeed } from '@/lib/games/moods';

/**
 * A feed's shelves rarely move: IGDB's ratings shift by the week, its
 * keywords by the month — a genre's "New releases" by the day, which six
 * hours covers. Kept in memory for the session, never on the device
 * (`home-feed` is in `NEVER_PERSIST`): Home always opens on All, so a saved
 * feed would only cost room the other screens' rows need.
 */
const FEED_STALE_MS = 6 * 60 * 60_000;

/** The three queries behind a mood or a genre — all idle while Home shows All. */
export function useMoodFeed(feed: HomeFeed | null) {
  const id = feed?.id ?? null;

  const shelves = useQuery({
    queryKey: ['home-feed', id, 'shelves'],
    queryFn: ({ signal }) => getMoodShelves(feed!, signal),
    enabled: !!feed,
    staleTime: FEED_STALE_MS,
  });

  const quickPicks = useQuery({
    queryKey: ['home-feed', id, 'quick-picks'],
    queryFn: ({ signal }) => getMoodQuickPicks(feed!, signal),
    enabled: !!feed,
    staleTime: FEED_STALE_MS,
  });

  const studio = useQuery({
    queryKey: ['home-feed', id, 'studio'],
    queryFn: ({ signal }) => getMoodStudio(feed!, signal),
    enabled: !!feed,
    staleTime: FEED_STALE_MS,
  });

  /* The first shelf with games in it heads the page: it carries the strapline,
     and its first game's box art is the glow's colour. */
  const leadIndex = shelves.data ? shelves.data.findIndex((shelf) => shelf.length > 0) : -1;

  return { feed, shelves, quickPicks, studio, leadIndex };
}

export type MoodFeed = ReturnType<typeof useMoodFeed>;

/**
 * The mood's first shelf, under the strapline that names the mood — YouTube's
 * "FOR RELAXING" over "Unwind + explore". The page draws it inside the block
 * its glow is the background of.
 */
export function MoodLead({ feed }: { feed: MoodFeed }) {
  const { feed: spec, shelves, leadIndex } = feed;
  if (!spec) return null;

  if (shelves.isPending) {
    return (
      <HomeSection strapline={spec.strapline} title={spec.shelves[0].title}>
        <CoverRailSkeleton inset={Spacing.x16} />
      </HomeSection>
    );
  }

  if (shelves.isLoadingError) {
    return (
      <HomeSection strapline={spec.strapline} title={spec.label}>
        <View style={styles.inset}>
          <BandError label={`${spec.label} could not load.`} onRetry={() => shelves.refetch()} />
        </View>
      </HomeSection>
    );
  }

  if (leadIndex < 0) return null;
  return (
    <HomeSection strapline={spec.strapline} title={spec.shelves[leadIndex].title}>
      {/* `of` the feed, so changing mood plays the arrival again rather than
          swapping one set of covers for another in place. */}
      <Arrive of={spec.id}>
        <GameCoverRail games={shelves.data![leadIndex]} inset={Spacing.x16} parallax />
      </Arrive>
    </HomeSection>
  );
}

/**
 * Everything of a mood after its first shelf, in the order a YouTube mood feed
 * comes in: Quick picks, the next shelf, the studio, then the rest.
 *
 * Each part loads and fails on its own. A shelf left with too few games after
 * the ones above it is not drawn (`distinctShelves`); a studio that made too
 * few of the mood's games is not drawn either, and nothing is drawn for it
 * while it is still being worked out — it is the one band that may not exist.
 */
export function MoodBody({
  feed,
  logged,
}: {
  feed: MoodFeed;
  /** This person's logged games: Quick picks leaves them out. */
  logged: ReadonlySet<string>;
}) {
  const { feed: spec, shelves, quickPicks, studio, leadIndex } = feed;

  const picks = useMemo(
    () => (quickPicks.data ? quickPicksFor(quickPicks.data, logged) : []),
    [logged, quickPicks.data]
  );

  if (!spec) return null;

  const rest =
    shelves.data && leadIndex >= 0
      ? shelves.data
          .map((games, index) => ({ games, shelf: spec.shelves[index] }))
          .filter((entry, index) => index > leadIndex && entry.games.length > 0)
      : [];

  const quickPicksBand = quickPicks.isPending ? (
    <HomeSection strapline="Let's start with one of these" title="Quick picks">
      <QuickPicksSkeleton />
    </HomeSection>
  ) : quickPicks.isLoadingError ? (
    <HomeSection strapline="Let's start with one of these" title="Quick picks">
      <View style={styles.inset}>
        <BandError label="Quick picks could not load." onRetry={() => quickPicks.refetch()} />
      </View>
    </HomeSection>
  ) : picks.length > 0 ? (
    <HomeSection strapline="Let's start with one of these" title="Quick picks">
      <Arrive of={spec.id}>
        <QuickPicks games={picks} />
      </Arrive>
    </HomeSection>
  ) : null;

  const studioBand = studio.data ? <StudioShelf studio={studio.data} /> : null;

  return (
    <>
      {quickPicksBand}
      {shelves.isPending ? (
        <>
          {spec.shelves.slice(1, 3).map((shelf) => (
            <HomeSection key={shelf.key} title={shelf.title}>
              <CoverRailSkeleton inset={Spacing.x16} />
            </HomeSection>
          ))}
        </>
      ) : (
        rest.map(({ games, shelf }, index) => (
          <Fragment key={shelf.key}>
            <MoodShelf title={shelf.title} games={games} at={index} />
            {/* The studio stands after the first shelf of the rest, as an
                artist's row does a few shelves into a YouTube feed. */}
            {index === 0 && studioBand}
          </Fragment>
        ))
      )}
      {!shelves.isPending && rest.length === 0 && studioBand}
    </>
  );
}

function MoodShelf({ title, games, at }: { title: string; games: readonly Game[]; at: number }) {
  return (
    <HomeSection title={title}>
      {/* Staggered down the feed, so a mood's shelves fill from the top. */}
      <Arrive delay={stagger(at)}>
        <GameCoverRail games={games} inset={Spacing.x16} parallax />
      </Arrive>
    </HomeSection>
  );
}

/** `HomeSectionHeader`'s avatar: 36, a circle. */
const AVATAR = 36;

/**
 * The studio of the mood: SimpMusic's shelf headed by an artist's round
 * picture, here the studio's logo on its plate in a circle, "FROM THE STUDIO"
 * over its name, and its games in the mood under it. The heading opens the
 * studio's page, as the reference's opens the artist's.
 */
function StudioShelf({ studio }: { studio: MoodStudio }) {
  return (
    <HomeSection
      avatar={
        <View style={styles.avatar}>
          <LogoMark uri={studio.logoUrl} name={studio.name} width={AVATAR} height={AVATAR} tile />
        </View>
      }
      strapline="FROM THE STUDIO"
      title={studio.name}
      seeAll={{ pathname: '/studio/[id]', params: { id: String(studio.id), name: studio.name } }}>
      <Arrive of={studio.id}>
        <GameCoverRail games={studio.games} inset={Spacing.x16} parallax />
      </Arrive>
    </HomeSection>
  );
}

const styles = StyleSheet.create({
  inset: { paddingHorizontal: Spacing.x16 },
  avatar: { width: AVATAR, height: AVATAR, borderRadius: AVATAR / 2, overflow: 'hidden' },
});
