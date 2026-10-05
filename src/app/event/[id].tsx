import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { FlatList, Linking, StyleSheet, View, useWindowDimensions } from 'react-native';

import { EventRsvp } from '@/components/event-rsvp';
import { GameGridTile } from '@/components/game-grid-tile';
import { PORTRAIT_COLUMNS, gridItemWidth } from '@/components/gaming/game-tile';
import { Button } from '@/components/ui/button';
import { ExpandableText } from '@/components/ui/expandable-text';
import { FrostedTopBar } from '@/components/ui/frosted-top-bar';
import { InfoCard } from '@/components/ui/info-card';
import { EmptyState, ErrorState, LoadingState, Screen } from '@/components/ui/screen';
import { Text } from '@/components/ui/text';
import { CoverGridWindow } from '@/constants/list-window';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { getEvent, getEventGames, type EventDetail } from '@/lib/games/browse';

/** Between covers, across and down — the collection grid's. */
const GRID_GAP = Spacing.x12;

/** Lines of the event's description before More. */
const ABOUT_LINES = 5;

/** IGDB's event art is 16:9, and so is the banner. */
const BANNER_RATIO = 9 / 16;

function open(url: string) {
  Linking.openURL(url).catch(() => {
    // No handler for the scheme; nothing useful to say about it.
  });
}

/** "Thu 11 December 2025, 20:30", in the reader's own zone. */
function formatStart(unixSeconds: number): string {
  const date = new Date(unixSeconds * 1000);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    weekday: 'short',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * One event — a showcase, a conference, an award show — and the games shown at
 * it.
 *
 * Opened from a row in Search's Events. The game page's "Featured in" rail
 * names the events a game appeared at; this is the other direction, an event
 * and everything that appeared at it, which IGDB only exposes from the event's
 * side (`events.games`).
 *
 * The banner leads and runs under the floating back disc, the way a game or a
 * collection opens — the event's key art is the one picture it has. Under it:
 * when, what it was, where to watch it, and then the games as a grid of titled
 * covers three across, each a door to its page.
 *
 * An event still to come also asks whether you will be watching, and offers a
 * reminder before it starts (`<EventRsvp>`, the control News' event cards
 * carry — one record of attendance, whichever screen it was made on). One that
 * has started or has no announced time does not: there is nothing left to say
 * you will attend, and no moment to be reminded of.
 *
 * Two requests: the event, then the games it lists by id. The second starts
 * when the first lands, so the heading and the banner are on screen while the
 * covers load.
 */
export default function EventScreen() {
  const theme = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const eventId = Number(id);
  const valid = Number.isFinite(eventId);
  /* Read once, when the screen mounts: "now" must not move between renders, and
     a lazy initialiser is the one place a clock may be read during one. */
  const [now] = useState(() => Date.now());

  const { width: windowWidth } = useWindowDimensions();
  const width = Math.min(windowWidth, MaxContentWidth);
  const tileWidth = gridItemWidth(width, PORTRAIT_COLUMNS, Spacing.x16, GRID_GAP);

  const event = useQuery({
    queryKey: ['event', eventId],
    queryFn: ({ signal }) => getEvent(eventId, signal),
    enabled: valid,
    staleTime: 30 * 60_000,
  });

  const gameIds = event.data?.gameIds ?? [];
  const games = useQuery({
    queryKey: ['event-games', eventId],
    queryFn: ({ signal }) => getEventGames(gameIds, signal),
    enabled: gameIds.length > 0,
    staleTime: 30 * 60_000,
  });

  if (event.isLoading) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <LoadingState />
      </Screen>
    );
  }

  if (event.isLoadingError) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <ErrorState error={event.error} onRetry={() => event.refetch()} />
      </Screen>
    );
  }

  if (!event.data) {
    return (
      <Screen edges={['bottom']} insetHeader topBar={<FrostedTopBar back />}>
        <EmptyState title="Event not found" />
      </Screen>
    );
  }

  const data = event.data;
  const shown = games.data ?? [];
  const upcoming = data.startTime !== null && data.startTime * 1000 > now;

  const head = (
    <View style={styles.head}>
      {/* Cancels the list's side padding so the art reaches both edges. */}
      <View style={styles.bleed}>
        <EventBanner event={data} width={width} fill={theme.surfaceElevated} />
      </View>

      <View style={styles.title}>
        <Text variant="display" accessibilityRole="header">
          {data.name}
        </Text>
        {data.startTime !== null && (
          <Text variant="body" color="textSecondary">
            {formatStart(data.startTime)}
          </Text>
        )}
      </View>

      {upcoming && (
        <View style={styles.rsvp}>
          <Text variant="itemTitle">Will you be watching?</Text>
          <EventRsvp
            event={{
              id: String(data.id),
              name: data.name,
              description: data.description,
              startsAt: new Date(data.startTime! * 1000).toISOString(),
              liveStreamUrl: data.liveStreamUrl,
              isUpcoming: true,
            }}
          />
        </View>
      )}

      {data.liveStreamUrl && (
        <Button
          title="Watch"
          icon="play"
          variant="primary"
          fullWidth
          accessibilityLabel={`Watch ${data.name}`}
          onPress={() => open(data.liveStreamUrl!)}
        />
      )}

      {data.description && (
        <InfoCard title="About">
          <ExpandableText lines={ABOUT_LINES} subject="the description">
            {data.description}
          </ExpandableText>
        </InfoCard>
      )}

      {data.links.length > 0 && (
        <View style={styles.links}>
          {data.links.map((link) => (
            <Button
              key={link.url}
              title={link.label}
              size="small"
              variant="secondary"
              accessibilityLabel={`Open ${data.name} on ${link.label}`}
              onPress={() => open(link.url)}
            />
          ))}
        </View>
      )}

      {gameIds.length > 0 && (
        <View style={styles.gamesHead}>
          <Text variant="h4" accessibilityRole="header">
            Games shown
          </Text>
          <Text variant="bodySmall" color="textMuted">
            {gameIds.length}
          </Text>
        </View>
      )}
    </View>
  );

  return (
    /* The banner runs under the bar, so no `insetHeader`. */
    <Screen edges={['bottom']} topBar={<FrostedTopBar back />}>
      <FlatList
        data={shown}
        numColumns={PORTRAIT_COLUMNS}
        keyExtractor={(game) => game.id}
        {...CoverGridWindow}
        columnWrapperStyle={styles.column}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={head}
        renderItem={({ item }) => (
          <GameGridTile
            id={item.id}
            title={item.title}
            coverUrl={item.coverUrl}
            heroUrl={item.heroUrl}
            edition={item.edition}
            steamAppId={item.steamAppId}
            caption={item.releaseYear}
            width={tileWidth}
          />
        )}
        ListEmptyComponent={
          gameIds.length === 0 ? (
            <Text variant="body" color="textSecondary">
              IGDB lists no games for this event yet.
            </Text>
          ) : games.isLoadingError ? (
            <ErrorState error={games.error} onRetry={() => games.refetch()} />
          ) : (
            <LoadingState />
          )
        }
      />
    </Screen>
  );
}

/**
 * The event's key art, edge to edge — or, for the few with none, a panel in
 * the app's own surface with its initial, so the page still opens on a shape.
 */
function EventBanner({ event, width, fill }: { event: EventDetail; width: number; fill: string }) {
  const height = Math.round(width * BANNER_RATIO);

  if (!event.bannerUrl) {
    return (
      <View style={[styles.bannerEmpty, { width, height, backgroundColor: fill }]}>
        <Text variant="display" color="textMuted">
          {event.name.trim().charAt(0).toUpperCase()}
        </Text>
      </View>
    );
  }

  return (
    <Image
      source={{ uri: event.bannerUrl }}
      style={{ width, height, backgroundColor: fill }}
      cachePolicy="memory-disk"
      contentFit="cover"
      transition={220}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Key art for ${event.name}`}
      accessibilityIgnoresInvertColors
    />
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: Spacing.x16,
    paddingBottom: Spacing.x48,
    gap: Spacing.x16,
  },
  column: { gap: GRID_GAP },
  head: { gap: Spacing.x16 },
  bleed: { marginHorizontal: -Spacing.x16 },
  title: { gap: Spacing.x4 },
  rsvp: { gap: Spacing.x4 },
  /* Wrapped: an event has four or five places it lives, and their names are
     different lengths. `rowGap` clears the small buttons' touch slop. */
  links: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x8, rowGap: Spacing.x16 },
  gamesHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingTop: Spacing.x8,
  },
  bannerEmpty: { alignItems: 'center', justifyContent: 'center' },
});
