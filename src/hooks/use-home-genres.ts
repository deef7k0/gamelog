import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { GAME_GENRES, type GameGenre } from '@/constants/game-genres';
import { getGenres } from '@/lib/games';
import type { GenreChoice } from '@/lib/games/genre-feed';

export type HomeGenre = GenreChoice & { genre: GameGenre };

/**
 * The ten genres Home offers (`GAME_GENRES`), each with IGDB's id for it.
 *
 * IGDB owns the vocabulary, so the ids are read live, under the key Surprise
 * Me and onboarding already share; a genre IGDB no longer names is left out
 * rather than offered as a choice that loads nothing. Empty until IGDB has
 * answered.
 */
export function useHomeGenres(): readonly HomeGenre[] {
  const genres = useQuery({
    queryKey: ['igdb', 'genres'],
    queryFn: ({ signal }) => getGenres(signal),
    staleTime: Infinity,
    gcTime: Infinity,
  });

  return useMemo(
    () =>
      GAME_GENRES.flatMap((genre) => {
        const id = genres.data?.find((tag) => tag.name.toLowerCase().includes(genre.match))?.id;
        return id === undefined ? [] : [{ id, label: genre.label, genre }];
      }),
    [genres.data]
  );
}
