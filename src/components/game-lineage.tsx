import Ionicons from '@expo/vector-icons/Ionicons';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { GamePosterRail } from '@/components/game-rail';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { InfoCard } from '@/components/ui/info-card';
import { Text } from '@/components/ui/text';
import { editionLabel, type EditionKind } from '@/constants/game-editions';
import { Radius, Spacing } from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useTheme } from '@/hooks/use-theme';
import { getGameById, getGameEditions, parseGameId } from '@/lib/games';

/** Box art in the "original game" row. Fixed dp, like every artwork size here. */
const ORIGINAL_ART = 56;

export type OriginalGameProps = {
  /** App-wide id of the game this one descends from. */
  parentId: string;
  /** What this game is, so the row can say what the link is *to*. */
  edition: EditionKind;
};

/**
 * The game a remake, remaster, DLC or edition came from.
 *
 * Shown on the derivative's page **instead of** the franchise rail, and that
 * swap is the point. A franchise list answers "what else is in this series",
 * which is a question you ask about Mafia II. On Mafia: Definitive Edition the
 * question is narrower and more urgent — *what is this a version of* — and
 * answering it with a rail of six Mafia games buries the one game that matters
 * among five that do not.
 *
 * A single row rather than a rail, for the same reason: there is exactly one
 * answer, and a one-item horizontal scroller is a rail pretending it has more
 * to show.
 *
 * The parent is fetched on demand rather than embedded in the child's payload.
 * IGDB returns `parent_game` as a bare id, and expanding it in `GAME_FIELDS`
 * would add a nested game object to *every* search result to serve the handful
 * of pages that need it.
 */
export function OriginalGame({ parentId, edition }: OriginalGameProps) {
  const theme = useTheme();
  const accent = useAccent();
  const parsed = parseGameId(parentId);

  const parent = useQuery({
    queryKey: ['game', parentId],
    queryFn: ({ signal }) => getGameById(parentId, signal),
    enabled: !!parsed,
    // Shares the game page's own cache key, so opening the parent afterwards is
    // already loaded.
    staleTime: 30 * 60_000,
  });

  // No section at all while it loads or if it 404s: a heading over a spinner,
  // then over nothing, is worse than the heading arriving late.
  if (!parent.data) return null;

  const game = parent.data;
  const label = editionLabel(edition) ?? 'version';

  return (
    <InfoCard title="Original game">
      <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${game.title}, the game this ${label.toLowerCase()} is based on`}
          scaleTo={0.98}
          style={StyleSheet.flatten([styles.row, { backgroundColor: accent.elevated }])}>
          <Poster
            coverUrl={game.coverUrl}
            heroUrl={game.heroUrl}
            title={game.title}
            width={ORIGINAL_ART}
            rounded="image"
          />

          <View style={styles.rowText}>
            <Text variant="h5" numberOfLines={2}>
              {game.title}
            </Text>
            <Text variant="caption" color="textMuted" numberOfLines={1}>
              {[game.developer, game.releaseYear].filter(Boolean).join(' · ')}
            </Text>
          </View>

          <Ionicons name="chevron-forward" size={16} color={theme.textMuted} />
        </PressableScale>
      </Link>
    </InfoCard>
  );
}

/**
 * Everything that descends from this game: remakes, remasters, ports, editions,
 * expansions and DLC.
 *
 * The other half of the split. The franchise rail above it now lists only
 * *originals* — `ORIGINALS_ONLY` in `games/igdb.ts` — so this is where the
 * versions went, and the two together say what one mixed list could not: Mafia's
 * page shows Mafia II and Mafia III in the series, and Mafia: Definitive Edition
 * under it, badged Remake.
 *
 * Renders nothing when there is nothing, which is the common case: most games
 * have no children at all.
 */
export function GameEditions({ gameId }: { gameId: string }) {
  const parsed = parseGameId(gameId);
  const igdbId = parsed?.source === 'igdb' ? parsed.sourceId : null;

  const editions = useQuery({
    queryKey: ['game-editions', gameId],
    queryFn: ({ signal }) => getGameEditions(igdbId!, signal),
    // Legacy `steam:`/`rawg:` rows have no relationships recorded, so there is
    // nothing to ask for.
    enabled: !!igdbId,
    staleTime: 30 * 60_000,
  });

  const list = editions.data ?? [];
  if (list.length === 0) return null;

  return (
    <InfoCard
      title="Editions & extras"
      action={
        <Text variant="bodySmall" color="textMuted">
          {list.length}
        </Text>
      }>
      {/* Each poster carries its own badge, which is what makes this rail
          readable — six covers of the same game are only distinguishable by the
          word on them. */}
      <GamePosterRail games={list} />
    </InfoCard>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x12,
    borderRadius: Radius.card,
  },
  rowText: { flex: 1, gap: 2 },
});
