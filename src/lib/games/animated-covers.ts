import { Platform } from 'react-native';

import {
  MAX_ALTERNATES,
  igdbAnimatedCoverUrl,
  lightEnough,
  matchesAspect,
  sgdbCandidates,
  type AnimatedAsset,
  type CoverAspect,
  type CoverPlatform,
} from '../animated-cover';
import { igdbQuery } from './igdb';
import { getAnimatedGrids } from './steamgriddb';
import { parseGameId } from './types';

/**
 * Finding a game's animated covers in one shape: SteamGridDB first, IGDB
 * second — the files light enough to show (`MAX_ANIMATED_BYTES`), in order:
 * every grid's full-size animation before any grid's small preview, the
 * most-liked grid first, never a joke one (`sgdbCandidates`, `rankGrids`).
 * Up to `MAX_ALTERNATES`: the first is played, the rest are what a phone
 * that cannot play it falls back on (`pickPlayable`) — with the first
 * preview always among them, where there is one, since it is a different
 * decoder. Each carries its weight in bytes, from the HEAD that checked it,
 * so a screen can plan what to download before it does.
 *
 * The rules are `lib/animated-cover.ts`; the cache in front of this, which is
 * what keeps a game known to have none from being asked again, is
 * `hooks/use-animated-cover.ts`.
 *
 * **Never throws.** An empty list is the normal answer — very few games have
 * one — and every failure on the way (a 404, a 429, no network) is empty too, as
 * the square cover's are (`lib/games/steamgriddb.ts` says what that costs).
 */

export type AnimatedCoverInput = {
  /** App-wide game id (`igdb:1234`): the IGDB id, and a legacy row's Steam appid. */
  gameId: string;
  /** For SteamGridDB, which does not index IGDB and is searched by title. */
  title: string | null;
  aspect: CoverAspect;
};

const PLATFORM: CoverPlatform =
  Platform.OS === 'ios' ? 'ios' : Platform.OS === 'web' ? 'web' : 'android';

/** One IGDB cover, as `covers` answers it. */
type IgdbCover = { image_id?: string; width?: number; height?: number; animated?: boolean };

export async function findAnimatedCovers(
  { gameId, title, aspect }: AnimatedCoverInput,
  signal?: AbortSignal
): Promise<AnimatedAsset[]> {
  const parsed = parseGameId(gameId);
  const steamAppId = parsed?.source === 'steam' ? Number(parsed.sourceId) || undefined : undefined;

  /* 1. SteamGridDB's animated grids: the files light enough, in order, and
     the first preview kept back as the last resort. */
  const grids = await getAnimatedGrids({ steamAppId, title: title ?? undefined }, aspect, signal);
  const candidates = sgdbCandidates(grids, PLATFORM);
  const firstPreview = candidates.find((candidate) => candidate.quality === 'preview');
  const found: AnimatedAsset[] = [];
  for (const candidate of candidates) {
    const room = MAX_ALTERNATES - (firstPreview && candidate !== firstPreview ? 1 : 0);
    if (found.length >= room && candidate !== firstPreview) continue;
    const weight = await weigh(candidate.url, signal);
    if (weight.fits) found.push({ ...candidate, bytes: weight.bytes });
    if (found.length >= MAX_ALTERNATES) break;
  }
  if (found.length > 0) return found;

  /* 2. IGDB's own cover, when it is animated and the right shape. Only 51
     covers in the whole catalogue are (checked live, 2026-10-20), so this
     is a rare second chance, not a second source of many. */
  if (parsed?.source !== 'igdb') return [];
  try {
    const covers = await igdbQuery<IgdbCover[]>(
      'covers',
      `fields image_id, animated, width, height;
       where game = ${Number(parsed.sourceId)} & animated = true;
       limit 10;`,
      signal
    );
    const cover = (covers ?? []).find(
      (entry) =>
        entry.animated &&
        entry.image_id &&
        matchesAspect(entry.width ?? 0, entry.height ?? 0, aspect)
    );
    if (!cover?.image_id) return [];
    const url = igdbAnimatedCoverUrl(cover.image_id);
    const weight = await weigh(url, signal);
    return weight.fits
      ? [
          {
            url,
            format: 'image',
            quality: 'full',
            bytes: weight.bytes,
            width: cover.width ?? null,
            height: cover.height ?? null,
          },
        ]
      : [];
  } catch {
    return [];
  }
}

/**
 * How heavy a file is, and whether that is light enough to show
 * (`MAX_ANIMATED_BYTES`), by a HEAD request: a few hundred bytes, against an
 * animated WebP that can weigh eighteen megabytes. A server that does not say
 * is believed (`bytes: null`); one that cannot be reached is not.
 */
async function weigh(
  url: string,
  signal?: AbortSignal
): Promise<{ fits: boolean; bytes: number | null }> {
  try {
    const response = await fetch(url, { method: 'HEAD', ...(signal ? { signal } : {}) });
    if (!response.ok) return { fits: false, bytes: null };
    const length = response.headers.get('content-length');
    const bytes = length === null ? null : Number(length);
    return { fits: lightEnough(bytes), bytes: Number.isFinite(bytes) ? bytes : null };
  } catch {
    return { fits: false, bytes: null };
  }
}
