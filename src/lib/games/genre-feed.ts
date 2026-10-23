import { BASIC_FLOOR, MOOD_FLOOR, type HomeFeed } from './moods';

/**
 * A genre as a Home feed — the owner's direction (2026-10-22): a genre "should
 * behave like the moods, it reloads the page you're on with sections tailored
 * for the selected genre. With best rated, newest release, specific things".
 *
 * Every genre gets the same eight shelves, each a clause on the genre (IGDB
 * genre ids are read live, `getGenres`), run against the live catalogue for
 * Shooter, Puzzle and Sport before being written down. Pure; `mood-feed.ts`
 * sends it as it sends a mood.
 *
 * - **Best rated** leads: the best scores among games 50 people have rated.
 * - **New releases** — the last 120 days, newest first — and **Coming soon**,
 *   by how many follow them, stand on `BASIC_FLOOR`: a game out last week has
 *   no ratings yet. They ask for a little attention instead (two follows or
 *   ratings, five follows ahead of release) so the row is not uploads nobody
 *   noticed.
 * - **Hidden gems** is scored 80 or more by no more than sixty people.
 * - **Classics** is before 2005; **Better with friends** has a multiplayer,
 *   co-op or split-screen mode; **Indie picks** is the genre and IGDB's Indie
 *   (32) both.
 *
 * Quick picks and the studio are drawn from the whole genre (`pool`).
 */
export type GenreChoice = { id: number; label: string };

/** IGDB's Indie genre: the one genre whose "indie picks" would be itself. */
const INDIE = 32;

/** 2005-01-01, in Unix seconds: "Classics" is everything before. */
const CLASSIC_BEFORE = 1104537600;

export function genreFeed({ id, label }: GenreChoice): HomeFeed {
  const genre = `genres = (${Math.trunc(id)})`;
  const shelves: HomeFeed['shelves'] = [
    {
      key: 'best',
      title: 'Best rated',
      where: `${genre} & total_rating_count >= 50`,
      sort: 'total_rating desc',
    },
    {
      key: 'new',
      title: 'New releases',
      where: `${genre} & first_release_date >= @now-120d & first_release_date <= @now & (hypes >= 2 | total_rating_count >= 2)`,
      sort: 'first_release_date desc',
      floor: BASIC_FLOOR,
    },
    { key: 'popular', title: 'Most played', where: genre },
    {
      key: 'soon',
      title: 'Coming soon',
      where: `${genre} & first_release_date > @now & hypes >= 5`,
      sort: 'hypes desc',
      floor: BASIC_FLOOR,
    },
    { key: 'friends', title: 'Better with friends', where: `${genre} & game_modes = (2,3,4)` },
    {
      key: 'gems',
      title: 'Hidden gems',
      where: `${genre} & total_rating >= 80 & total_rating_count <= 60`,
      sort: 'total_rating desc',
      floor: MOOD_FLOOR,
    },
    {
      key: 'classics',
      title: 'Classics',
      where: `${genre} & first_release_date < ${CLASSIC_BEFORE}`,
    },
    ...(id === INDIE
      ? []
      : [{ key: 'indie', title: 'Indie picks', where: `genres = [${Math.trunc(id)},${INDIE}]` }]),
  ];

  return {
    id: `genre:${Math.trunc(id)}`,
    label,
    strapline: label.toUpperCase(),
    shelves,
    pool: genre,
  };
}
