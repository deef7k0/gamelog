import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { decode } from 'jpeg-js';
import { useMemo } from 'react';

import { accentRoles } from '@/constants/theme';
import { useGameColours } from '@/hooks/use-game-colours';
import { useTheme } from '@/hooks/use-theme';
import { filledRoles } from '@/lib/filled';
import { visibleRegion, type Anchor, type Size } from '@/lib/key-color';
import {
  PAGE_COLOR,
  cropPixels,
  buttonTone,
  harmonySeed,
  m3Seeds,
  paletteOf,
  pickPageColor,
} from '@/lib/page-color';

/**
 * The file a page's colours are read from: IGDB's `t_cover_small_2x` of the
 * hero — a *fit*, never a crop, 180 wide, about 5 KB — or null when the hero
 * is not IGDB's (a legacy Steam hero has no small copy).
 *
 * Not `t_cover_small`, which the key colour read: at 90 wide the cropped
 * hero is ~2,000 pixels, and on twenty live heroes it chose a different page
 * for nine of them — Persona 5 Royal's red was lost. At 180 the crop is about
 * 12,000 pixels, which is Palette's own sampling area (it resizes to 112 ×
 * 112), so the swatches are the ones Palette would have found.
 */
export function pageColorSource(uri: string | null | undefined): string | null {
  if (!uri || !/^https:\/\/images\.igdb\.com\//.test(uri)) return null;
  if (!/\/t_[a-z0-9_]+\//i.test(uri)) return null;
  /* JPEG whatever the slot draws: the decoder reads nothing else, and IGDB
     answers any extension. */
  return uri
    .replace(/\/t_[a-z0-9_]+\//i, '/t_cover_small_2x/')
    .replace(/\.(png|webp)(\?.*)?$/i, '.jpg');
}

/** What is kept per hero: the page and Material's seeds, best first. Plain JSON. */
type Read = { page: string; seeds: string[] };

/** Bump when what is read, or how, changes. */
const CACHE_PREFIX = 'page-color:v1:';
/** A 180-wide fit is ~5 KB and 0.02 MP; these only stop a host that ignored the size. */
const MAX_BYTES = 60_000;
const MAX_MP = 0.06;

export type PageColor = {
  /** The page's one colour, top to foot, at rest and scrolled. */
  page: string;
  /**
   * The seed of the page's Material 3 scheme — its buttons — in the page's own
   * family (`harmonySeed`). Null where the art gave none: the caller's own
   * fallback (the genre's hue) stands.
   */
  seed: string | null;
  /**
   * The tone the buttons' fill is taken at, so it stands apart from the page
   * by lightness rather than by hue (`buttonTone`). Undefined with no seed.
   */
  tone?: number;
  /**
   * Whether the page is the art's colour, so its cards and selected tabs wear
   * the filled colour (`<Screen artColoured>`). False while game colours are
   * off: the page is then the app's own room, cards and all.
   */
  artColoured: boolean;
  /** Whether `page` is the answer, and not the placeholder before it. */
  resolved: boolean;
};

/**
 * A game page's colours, from its hero (`lib/page-color`): the page by the
 * brief's filter over Palette's swatches, the buttons by Material 3's own
 * seed choice kept to the page's family — both read off the part of the hero
 * `frame` shows, once per
 * hero and kept for good (the query is saved with the app's cache; the device
 * keeps its own copy for when that cache has let it go).
 *
 * Off with game colours (Settings): the app's page, no seed, the app's cards.
 */
export function usePageColor(
  uri: string | null | undefined,
  { frame, anchor }: { frame: Size; anchor?: Anchor }
): PageColor {
  const theme = useTheme();
  const colours = useGameColours();
  const source = colours.on ? pageColorSource(uri) : null;

  /* The crop is the frame's shape, not its size: rounded, so a rotation does
     not ask again for a hair's difference. */
  const aspect = frame.height > 0 ? Math.round((frame.width / frame.height) * 100) / 100 : 1;
  const ax = Math.round((anchor?.x ?? 0.5) * 100) / 100;
  const ay = Math.round((anchor?.y ?? 0.5) * 100) / 100;

  const read = useQuery({
    queryKey: ['page-color', source, aspect, ax, ay],
    queryFn: () => readPageColor(source!, aspect, { x: ax, y: ay }),
    enabled: !!source,
    /* A picture does not change. */
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  /* No art at all — an empty collection — is the app's own page, not a
     failure: there was nothing to read. Art that could not be read (not
     IGDB's, or the request failed) is the brief's neutral grey. */
  const coloured = colours.on && !!uri;
  const data = source ? read.data : undefined;
  const page = !coloured
    ? theme.background
    : (data?.page ?? (source && read.isPending ? theme.background : PAGE_COLOR.failed));

  /* The buttons: the art's seed of the page's family, and the tone that holds
     the brief's ΔE 30 from the page — measured on the button's own fill
     (`filledRoles`), the arithmetic the review button draws with. */
  const buttons = useMemo(() => {
    if (!data) return null;
    const harmony = harmonySeed(data.seeds, data.page);
    if (!harmony) return null;
    const tone = buttonTone(
      data.page,
      (at) => filledRoles(accentRoles(harmony.seed, { tonal: true, primaryTone: at })).fill
    );
    return { seed: harmony.seed, tone };
  }, [data]);

  return {
    page,
    seed: buttons?.seed ?? null,
    tone: buttons?.tone,
    artColoured: coloured,
    resolved: !coloured || !source || !read.isPending,
  };
}

async function readPageColor(source: string, aspect: number, anchor: Anchor): Promise<Read> {
  const cacheKey = `${CACHE_PREFIX}${source}:${aspect}:${anchor.x}:${anchor.y}`;
  try {
    const stored = await AsyncStorage.getItem(cacheKey);
    if (stored) return JSON.parse(stored) as Read;
  } catch {
    /* An unreadable cache is an empty one. */
  }

  /* A failure throws, so it is neither saved nor restored: the page is the
     brief's neutral grey for this visit and the next one asks again. */
  const response = await fetch(source);
  if (!response.ok) throw new Error(`page colour: ${response.status}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new Error('page colour: image too large');
  /* `useTArray`: React Native has no Node `Buffer` for jpeg-js to reach for. */
  const image = decode(bytes, {
    useTArray: true,
    maxMemoryUsageInMB: 8,
    maxResolutionInMP: MAX_MP,
  });

  const frame: Size = { width: aspect, height: 1 };
  const region = visibleRegion(image, frame, anchor);
  /* The page from the part on screen less its 10% ring (rule 1); the seed from
     all of the part on screen — Material's `Score` drops a border's black or
     white by itself. */
  const page = pickPageColor(
    paletteOf(cropPixels(image.data, image.width, image.height, region, PAGE_COLOR.crop))
  ).color;
  const seeds = m3Seeds(cropPixels(image.data, image.width, image.height, region, 0));

  const result: Read = { page, seeds };
  try {
    await AsyncStorage.setItem(cacheKey, JSON.stringify(result));
  } catch {
    /* A full disk should not stop a page from having a colour. */
  }
  return result;
}
