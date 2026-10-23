import { genreFeed, type GenreChoice } from './games/genre-feed';
import { moodFor, type HomeFeed, type MoodKey } from './games/moods';

/**
 * What Home is showing: its own bands (All), one of the ten moods, or one
 * genre — SimpMusic's `params`, which reloads its Home in place. Session state;
 * Home always opens on All.
 */
export type HomeView =
  { kind: 'all' } | { kind: 'mood'; mood: MoodKey } | { kind: 'genre'; genre: GenreChoice };

export const ALL: HomeView = { kind: 'all' };

/** The feed behind a view, or null for All. */
export function feedFor(view: HomeView): HomeFeed | null {
  switch (view.kind) {
    case 'mood':
      return moodFor(view.mood);
    case 'genre':
      return genreFeed(view.genre);
    default:
      return null;
  }
}

/** Whether two views show the same page — a genre is its id, not its label. */
export function sameView(a: HomeView, b: HomeView): boolean {
  if (a.kind !== b.kind) return false;
  if (a.kind === 'mood' && b.kind === 'mood') return a.mood === b.mood;
  if (a.kind === 'genre' && b.kind === 'genre') return a.genre.id === b.genre.id;
  return true;
}
