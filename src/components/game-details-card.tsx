import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeIn, LinearTransition, useReducedMotion } from 'react-native-reanimated';

import { InfoCard } from '@/components/ui/info-card';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing, TapTarget } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { FACET_INFO, facetParams, type FacetKind } from '@/lib/games/facets';
import { getGameDetails, type GameCompany, type GameDetails } from '@/lib/games/igdb';
import { getGameRawgTags, rawgTagsAvailable, type RawgTag } from '@/lib/games/rawg-tags';
import { parseGameId } from '@/lib/games';

/**
 * One entry: its heading, and its values — each a way onward when it carries
 * an id: a facet's games in Search, or a company's page.
 */
type Entry = {
  label: string;
  kind: FacetKind | 'company';
  values: { name: string; id: number | null }[];
};

/** A value's reach past its own words: the lines are close, so up and down stay small. */
const VALUE_SLOP = { top: 4, bottom: 4, left: 4, right: 4 };

/**
 * More values than this and an entry runs the full width, its values wrapping
 * as words — tags, languages, age ratings — rather than standing one to a line
 * down half the page.
 */
const LONG = 6;

/** How many entries the grid shows before "Show all": the owner's reference has four. */
const FOLDED = 4;

/**
 * The IGDB record for a game, on the Overview, as text on the page — the
 * owner's reference (2026-10-28): headings in bold white, the values under
 * each in the page's quiet ink, one to a line, two entries to a row.
 *
 * ```text
 *   Developers                Genres
 *   Rockstar North            Action
 *   Rockstar Games            Shooter
 *
 *   Themes                    Game modes
 *   Open world                Single player
 * ```
 *
 * No card: the game page has none (`<BareCards>`). The first four entries
 * are the reference's own — the developers, the genres, the themes, the game
 * modes — and "Show all" opens the rest in place: publishers, perspectives,
 * series, franchises, the engine, then the long lists (RAWG's tags, the age
 * ratings, the languages) across the full width.
 *
 * **The developers are here again.** The owner had them taken out on
 * 2026-10-15, as they are the links under the game's name in the masthead;
 * the reference of 2026-10-28 puts them first, and the newer word stands.
 *
 * **Every value is still a way to its games** — the owner's (2026-10-16) — a
 * genre or a theme to Search on it, a company to its page. The values are no
 * longer bold, which was that rule's sign: the reference sets them in the
 * page's quiet ink at the body's weight, and a value is still a link to a
 * screen reader and to a finger.
 *
 * The record is asked for as this mounts, under the key the stats strip
 * already reads, so it is the same one request. An entry IGDB has nothing for
 * is left out rather than printed as a dash; with none at all this is not
 * drawn.
 */
export function GameDetailsCard({
  gameId,
  title,
  year,
  companies = [],
}: {
  gameId: string;
  /** The game's name and year, which RAWG's tags are looked up by. */
  title?: string;
  year?: number | null;
  /** The developers and publishers, with their ids (`getGameExtras`). */
  companies?: readonly GameCompany[];
}) {
  const accent = useAccent();
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const [expanded, setExpanded] = useState(false);

  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const details = useQuery({
    queryKey: ['game-details', igdbId],
    queryFn: ({ signal }) => getGameDetails(igdbId!, signal),
    enabled: !!igdbId,
    staleTime: 24 * 60 * 60_000,
    retry: false,
  });

  /* A record saved on the device before values carried their ids has none:
     ask again once, so its values become links instead of staying words for
     the day the record is fresh for. */
  const untagged = !!details.data && !details.data.tags;
  const { refetch } = details;
  useEffect(() => {
    if (untagged) void refetch();
  }, [untagged, refetch]);

  const rawgTags = useQuery({
    queryKey: ['rawg-game-tags', gameId],
    queryFn: ({ signal }) => getGameRawgTags(title!, year ?? null, signal),
    enabled: !!title && rawgTagsAvailable(),
    staleTime: 7 * 24 * 60 * 60_000,
    retry: false,
  });

  if (!igdbId || !details.data) return null;

  const open = (entry: Entry, value: { name: string; id: number }) => {
    if (entry.kind === 'company') {
      router.push({ pathname: '/studio/[id]', params: { id: String(value.id), name: value.name } });
      return;
    }
    router.navigate({
      pathname: '/search',
      params: facetParams({ kind: entry.kind, id: value.id, name: value.name }),
    });
  };

  const entries = entriesOf(details.data, rawgTags.data ?? [], companies);
  if (entries.length === 0) return null;
  const shown = expanded ? entries : entries.slice(0, FOLDED);
  const folds = entries.length > FOLDED;

  /* Short entries two to a row, each row's two tops level; a long one the
     whole width, on a row of its own. */
  const rows: Entry[][] = [];
  for (const entry of shown) {
    const last = rows[rows.length - 1];
    if (entry.values.length > LONG) rows.push([entry]);
    else if (last && last.length === 1 && last[0].values.length <= LONG) last.push(entry);
    else rows.push([entry]);
  }

  return (
    <InfoCard title="Details">
      <Animated.View
        style={styles.rows}
        layout={reduceMotion ? undefined : LinearTransition.duration(250)}>
        {rows.map((row, index) => (
          <Animated.View
            key={row.map((entry) => entry.label).join('|')}
            entering={
              reduceMotion || index < Math.ceil(FOLDED / 2) ? undefined : FadeIn.duration(220)
            }
            style={styles.row}>
            {row.map((entry) => (
              <View
                key={entry.label}
                style={entry.values.length > LONG ? styles.wide : styles.cell}>
                <Text variant="h5" accessibilityRole="header">
                  {entry.label}
                </Text>
                <View style={entry.values.length > LONG ? styles.wrapped : styles.lines}>
                  {entry.values.map((value, place) => {
                    const wraps = entry.values.length > LONG;
                    const words = (
                      <Text variant="body" color="textSecondary">
                        {value.name}
                        {wraps && place < entry.values.length - 1 ? ',' : ''}
                      </Text>
                    );
                    if (value.id === null) return <View key={value.name}>{words}</View>;
                    const id = value.id;
                    return (
                      <PressableScale
                        key={`${entry.kind}:${id}`}
                        accessibilityRole="link"
                        accessibilityLabel={
                          entry.kind === 'company'
                            ? `${value.name}. See their games.`
                            : `${value.name}. See ${FACET_INFO[
                                entry.kind
                              ].label.toLowerCase()} games like it in Search.`
                        }
                        onPress={() => open(entry, { name: value.name, id })}
                        hitSlop={VALUE_SLOP}
                        scaleTo={0.96}
                        style={styles.value}>
                        {words}
                      </PressableScale>
                    );
                  })}
                </View>
              </View>
            ))}
          </Animated.View>
        ))}

        {folds && (
          <PressableScale
            accessibilityRole="button"
            accessibilityState={{ expanded }}
            accessibilityLabel={expanded ? 'Show fewer details' : 'Show all the details'}
            onPress={() => setExpanded((current) => !current)}
            scaleTo={0.98}
            style={styles.toggle}>
            <Text variant="itemTitle">{expanded ? 'Show less' : 'Show all'}</Text>
            <Ionicons
              name={expanded ? 'chevron-up' : 'chevron-down'}
              size={16}
              color={accent.quietInk}
            />
          </PressableScale>
        )}
      </Animated.View>
    </InfoCard>
  );
}

/**
 * Every entry, in order: the reference's four first (the developers, the
 * genres, the themes, the game modes), then the rest. Empty ones are left out.
 */
function entriesOf(
  details: GameDetails,
  rawgTags: readonly RawgTag[],
  companies: readonly GameCompany[]
): Entry[] {
  const tags = details.tags;

  /* With ids, each value is a link; a record from before them is words. */
  const facet = (label: string, kind: FacetKind, names: string[]): Entry => ({
    label,
    kind,
    values: tags?.[kind]
      ? tags[kind]!.map((tag) => ({ name: tag.name, id: tag.id }))
      : names.map((name) => ({ name, id: null })),
  });
  const company = (label: string, role: GameCompany['role']): Entry => ({
    label,
    kind: 'company',
    values: companies
      .filter((entry) => entry.role === role)
      .map((entry) => ({ name: entry.name, id: entry.id })),
  });

  /* A publisher that also developed it is under Developers once. */
  const developers = new Set(
    companies.filter((entry) => entry.role === 'developer').map((entry) => entry.id)
  );
  const publishers = company('Publishers', 'publisher');
  publishers.values = publishers.values.filter((value) => !developers.has(value.id!));

  return [
    company('Developers', 'developer'),
    facet('Genres', 'genre', details.genres),
    facet('Themes', 'theme', details.themes),
    facet('Game modes', 'mode', details.gameModes),
    publishers,
    facet('Perspectives', 'perspective', details.playerPerspectives),
    facet('Series', 'series', details.series ? [details.series] : []),
    facet('Franchises', 'franchise', details.franchises),
    facet('Engine', 'engine', details.engines),
    {
      label: 'Tags',
      kind: 'tag' as const,
      values: rawgTags.map((tag) => ({ name: tag.name, id: tag.id })),
    },
    facet(
      'Age ratings',
      'rating',
      details.ageRatings.map((entry) => `${entry.organization} ${entry.rating}`)
    ),
    facet('Languages', 'language', details.languages),
  ].filter((entry) => entry.values.length > 0);
}

const styles = StyleSheet.create({
  /* The reference's rhythm: twenty between rows of entries. */
  rows: { gap: Spacing.x20 },
  row: { flexDirection: 'row', gap: Spacing.x16 },
  /* Half the width each — a lone short entry still takes only its half, so
     the column lines up with the rows above it. */
  cell: { flex: 1, maxWidth: '50%', gap: Spacing.x8 },
  wide: { flex: 1, gap: Spacing.x8 },
  /* One value to a line, four apart — the reference's 23 from line to line. */
  lines: { gap: Spacing.x4 },
  /* A long list wraps as words do, a space apart, each its own target. */
  wrapped: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.x4, rowGap: 2 },
  value: { alignSelf: 'flex-start' },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4,
    alignSelf: 'flex-start',
    minHeight: TapTarget,
  },
});
