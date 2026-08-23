import { steamCoverUrl, steamHeaderUrl } from '@/components/gaming/game-tile';
import type { ShelfGame } from '@/components/games-widget';
import type { LogWithRelations } from '@/lib/database.types';
import type { OwnedGame } from '@/lib/gaming';

/**
 * One shelf, from two sources that do not know about each other.
 *
 * A profile's recent games come from a linked Steam library (`lastPlayedAt`)
 * and from what the person logged in this app (`created_at`). Neither alone is
 * the answer: Steam knows what you played and nothing about the PS5 game you
 * reviewed here, and the app knows what you wrote about and nothing about the
 * four hours you put into something last night without saying so.
 *
 * ## Dedupe
 *
 * A game can legitimately be in both — you played it on Steam *and* logged it.
 * The log wins, for two reasons. Its `game_id` is a real catalogue id, so the
 * cover is IGDB's portrait box art rather than a Steam capsule that may not
 * exist for the title; and a log is a deliberate act, where a Steam timestamp
 * is a side effect of launching something.
 *
 * Steam rows with no `gameId` are still shown. They are not tappable — there is
 * no page to open — but leaving them out would silently drop most of a large
 * library from the shelf, since only games somebody has logged get cached.
 */
export function buildShelf(
  logs: readonly LogWithRelations[],
  owned: readonly OwnedGame[],
  limit: number
): ShelfGame[] {
  type Dated = { game: ShelfGame; at: number };
  const entries: Dated[] = [];
  const seen = new Set<string>();

  for (const log of logs) {
    const game = log.game;
    if (!game) continue;
    if (seen.has(game.id)) continue;
    seen.add(game.id);

    entries.push({
      game: {
        gameId: game.id,
        title: game.title,
        coverUrl: game.cover_url,
        heroUrl: game.hero_url,
      },
      at: Date.parse(log.created_at) || 0,
    });
  }

  for (const entry of owned) {
    if (entry.gameId && seen.has(entry.gameId)) continue;
    if (entry.gameId) seen.add(entry.gameId);

    entries.push({
      game: {
        gameId: entry.gameId,
        title: entry.name,
        coverUrl: steamCoverUrl(entry.appId),
        heroUrl: steamHeaderUrl(entry.appId),
      },
      /* Never played, or a provider that does not report it: sorts to the back
         rather than to the front, which `0` would do if the field were absent
         and the comparison ran the other way. */
      at: entry.lastPlayedAt ? Date.parse(entry.lastPlayedAt) || 0 : 0,
    });
  }

  return entries
    .sort((a, b) => b.at - a.at)
    .slice(0, limit)
    .map((item) => item.game);
}
