import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'jpeg-js';
import { useMemo } from 'react';

import { useGameColours } from '@/hooks/use-game-colours';
import { keyColorOf, keyPage, visibleRegion, type Anchor, type Size } from '@/lib/key-color';

/**
 * The file a hero's key colour is read from, or null when it cannot be read
 * for nothing.
 *
 * **IGDB's `t_cover_small` of the same picture.** IGDB names a size in the
 * path, and `cover_small` is a *fit* — the whole image scaled into 90 × 128,
 * never cropped — so a 16:9 key art comes back as 90 × 51, every edge intact,
 * in about 2 KB. Decoded in JavaScript that is about 15 ms on a phone's
 * interpreter. Never `t_thumb`, which is a centre crop: it cuts away the very
 * edges this reads.
 *
 * **Nothing else.** SteamGridDB's smallest square is 400 × 400, a second of
 * JavaScript decoding (measured, JIT off: 1.0 s on a desktop CPU), and a
 * Steam hero has no small copy at all; a collection drawing square art and a
 * legacy Steam game have no key colour, and their hero melts into the page's
 * own colour, as it did before. The edges of a *different* picture — the box
 * art standing in for the square — would be the colour of an edge nobody can
 * see, which is the one thing a key colour must never be.
 */
export function keyColorSource(uri: string | null | undefined): string | null {
  if (!uri || !/^https:\/\/images\.igdb\.com\//.test(uri)) return null;
  if (!/\/t_[a-z0-9_]+\//i.test(uri)) return null;
  /* JPEG whatever the slot draws: the decoder reads nothing else, and IGDB
     answers any extension. */
  return uri
    .replace(/\/t_[a-z0-9_]+\//i, '/t_cover_small/')
    .replace(/\.(png|webp)(\?.*)?$/i, '.jpg');
}

/** Cache version. Bump it when what is read, or how, changes. */
const CACHE_PREFIX = 'key-color:v2:';
/** Stored when the image decoded and had nothing to read. */
const NONE = 'none';
/** A `t_cover_small` is ~2 KB and 0.012 MP; these only stop a host that ignored the size. */
const MAX_BYTES = 40_000;
const MAX_MP = 0.03;

export type ReadKeyResult = {
  color: string;
  primary?: string;
};

/** Synchronous in-memory cache so subsequent screen renders have 0ms disk delay. */
const MEMORY_CACHE = new Map<string, ReadKeyResult | null>();

/**
 * The page's adaptive tones:
 * - `dark`: The always-dark page background.
 * - `bright` / `primary`: The high-saturation, high-luminance primary accent color for cards and buttons.
 */
export function useKeyColor(
  uri: string | null | undefined,
  { frame, anchor, ink }: { frame: Size; anchor?: Anchor; ink?: string }
): { bright: string | null; dark: string | null; primary: string | null; resolved: boolean } {
  const colours = useGameColours();
  const source = colours.on ? keyColorSource(uri) : null;

  /* The crop is a property of the frame's shape, not its size: rounded, so a
     rotation or a keyboard does not ask again for a hair's difference. */
  const aspect = frame.height > 0 ? Math.round((frame.width / frame.height) * 100) / 100 : 1;
  const ax = Math.round((anchor?.x ?? 0.5) * 100) / 100;
  const ay = Math.round((anchor?.y ?? 0.5) * 100) / 100;

  const cacheKey = source ? `${CACHE_PREFIX}${source}:${aspect}:${ax}:${ay}` : null;
  const inMemory = cacheKey && MEMORY_CACHE.has(cacheKey) ? MEMORY_CACHE.get(cacheKey) : undefined;

  const key = useQuery({
    queryKey: ['key-color-v2', source, aspect, ax, ay],
    queryFn: () => readKeyColor(source!, aspect, { x: ax, y: ay }),
    enabled: !!source,
    initialData: () => (inMemory !== undefined ? inMemory : undefined),
    /* A picture's edges do not change; the far cache is AsyncStorage. */
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  const raw = source ? (key.data ?? null) : null;
  const tones = useMemo(
    () => (raw ? keyPage(raw.color, { ink, primary: raw.primary }) : null),
    [raw, ink]
  );
  return {
    bright: tones?.bright ?? null,
    dark: tones?.dark ?? null,
    primary: tones?.primary ?? null,
    resolved: !source || !key.isPending,
  };
}

async function readKeyColor(
  source: string,
  aspect: number,
  anchor: Anchor
): Promise<ReadKeyResult | null> {
  const cacheKey = `${CACHE_PREFIX}${source}:${aspect}:${anchor.x}:${anchor.y}`;
  if (MEMORY_CACHE.has(cacheKey)) {
    return MEMORY_CACHE.get(cacheKey) ?? null;
  }

  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (stored === NONE) {
      MEMORY_CACHE.set(cacheKey, null);
      return null;
    }
    if (stored) {
      if (stored.startsWith('{')) {
        const parsed = JSON.parse(stored) as ReadKeyResult;
        MEMORY_CACHE.set(cacheKey, parsed);
        return parsed;
      }
      if (/^#[0-9a-f]{6}$/i.test(stored)) {
        const parsed = { color: stored };
        MEMORY_CACHE.set(cacheKey, parsed);
        return parsed;
      }
    }
  } catch {
    /* An unreadable cache is an empty one. */
  }

  let result: ReadKeyResult | null = null;
  try {
    const response = await fetch(source);
    if (!response.ok) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > MAX_BYTES) return null;
    /* `useTArray`: React Native has no Node `Buffer` for jpeg-js to reach for. */
    const image = decode(bytes, {
      useTArray: true,
      maxMemoryUsageInMB: 8,
      maxResolutionInMP: MAX_MP,
    });
    const frame: Size = { width: aspect, height: 1 };
    const sampled = keyColorOf(image.data, image.width, image.height, {
      region: visibleRegion(image, frame, anchor),
    });
    if (sampled) {
      result = { color: sampled.color, primary: sampled.primary };
    }
  } catch {
    /* A hero whose colour cannot be read melts into the page's own colour, and
       looks entirely normal; the next visit asks again. */
    return null;
  }

  MEMORY_CACHE.set(cacheKey, result);

  try {
    await AsyncStorage.setItem(cacheKey, result ? JSON.stringify(result) : NONE);
  } catch {
    /* A full disk should not stop a hero from having a ground. */
  }
  return result;
}
