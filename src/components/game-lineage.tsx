import { useQuery } from '@tanstack/react-query';

import { GameCoverRail } from '@/components/game-rail';
import { Section } from '@/components/ui/section';
import { editionLabel, type EditionKind } from '@/constants/game-editions';
import { getGameById, getGameEditions, parseGameId } from '@/lib/games';

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
 * One cover under its heading, as every section with artwork is drawn (see
 * `<InfoCard>`): the art, the title, the studio and year. It sits in a rail of
 * one, which does not scroll — there is exactly one answer, and it is shown the
 * way the franchise's many are.
 *
 * The parent is fetched on demand rather than embedded in the child's payload.
 * IGDB returns `parent_game` as a bare id, and expanding it in `GAME_FIELDS`
 * would add a nested game object to *every* search result to serve the handful
 * of pages that need it.
 */
export function OriginalGame({ parentId, edition }: OriginalGameProps) {
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
    <Section title="Original game">
      <GameCoverRail
        games={[game]}
        subtitleOf={() => [game.developer, game.releaseYear].filter(Boolean).join(' · ') || null}
        labelOf={() => `${game.title}, the game this ${label.toLowerCase()} is based on`}
      />
    </Section>
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

  /* Each cover carries its own badge, which is what makes this rail readable —
     six covers of the same game are only distinguishable by the word on them. */
  return (
    <Section title="Editions & extras">
      <GameCoverRail games={list} />
    </Section>
  );
}
