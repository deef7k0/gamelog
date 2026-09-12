import { useQuery } from '@tanstack/react-query';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Platform } from 'react-native';

import { extractArtworkColor } from '@/lib/artwork-color';
import { FALLBACK_SEED, NEUTRAL_SEED } from '@/theme/dynamic-color';

/**
 * The dominant colour of a piece of artwork, as a seed for `generateDynamicTheme`.
 *
 * ## Two extractors, and why there have to be two
 *
 * `react-native-image-colors` is the better one: it reads the decoded bitmap
 * natively (Android Palette, iOS `UIImage`), handles every format the platform
 * can display, and costs nothing in JS. It is also **a native module that Expo
 * Go cannot load**. Its entry point is a bare
 * `requireNativeModule('ImageColors')` evaluated at import scope, and Expo Go's
 * binary ships only Expo SDK modules — so a static `import` of it throws while
 * the module is *evaluating*, taking down every module that transitively
 * imported it. That is the exact failure CLAUDE.md records for
 * `expo-notifications`, and it presents as the app closing on launch with no
 * red screen.
 *
 * So the package is only imported once `requireOptionalNativeModule` has
 * confirmed the native side is registered — see `NATIVE_MODULE_PRESENT` below
 * for why the probe comes first rather than a try/catch around the import. On a
 * development build it binds and is used; in Expo Go it is never touched, and
 * the second extractor takes over for the session.
 *
 * The fallback is `lib/artwork-color.ts`, which the app already had: it fetches
 * IGDB's 90×90 `t_thumb` (~3 KB) and decodes it with `jpeg-js` — pure JS, so it
 * works anywhere. It is not a *worse* answer, just a narrower one: JPEG only,
 * and one network round trip it caches in `AsyncStorage` for good.
 *
 * **This is not a second native colour library.** It is the pure-JS decoder that
 * was already in the repo, kept as the floor so the feature works in the
 * environment this project is actually developed in.
 *
 * ## Why the cache is TanStack rather than a `Map`
 *
 * The brief asked for a module-level cache keyed by URI, which is what a `Map`
 * gives. A query keyed on the URI gives the same thing plus the three properties
 * a `Map` does not: two components asking for the same cover in the same frame
 * issue one extraction rather than two, an in-flight extraction is cancelled
 * when the screen unmounts, and the result survives into `AsyncStorage` through
 * the layer below. `artwork-color.ts` already persists, so the query is the
 * near cache and the storage is the far one.
 */

/**
 * Is the native side of `react-native-image-colors` actually registered?
 *
 * **Asked before importing the package, not by trying and catching.** Its entry
 * point calls `requireNativeModule('ImageColors')`, which *throws* when the
 * module is absent — and a throw inside a deferred `import()` is still reported
 * by Metro's async-require machinery before the promise rejects, so a
 * try/catch around it leaves a red `ERROR [Cannot find native module
 * 'ImageColors']` in the console on the first game anybody opens. Caught, fully
 * recovered from, and alarming.
 *
 * `requireOptionalNativeModule` is the same lookup with `null` instead of the
 * throw. It is exported by `expo-modules-core`, which is core Expo and always
 * present, so this costs one property read and the package is never touched at
 * all unless it can work.
 *
 * Deliberately not an Expo-Go check. `Constants.executionEnvironment` reports
 * `storeClient` for Expo Go *and* for a dev-client build — where this module is
 * present and should be used — so an ownership heuristic would disable the good
 * extractor on exactly the builds that have it. Asking whether the module is
 * registered is the question we actually mean.
 */
const NATIVE_MODULE_PRESENT = !!requireOptionalNativeModule('ImageColors');

/** Latches false if the package somehow fails to load despite the probe. */
let nativeAvailable: boolean | null = NATIVE_MODULE_PRESENT ? null : false;
let nativeModule: Promise<typeof import('react-native-image-colors') | null> | null = null;

async function loadNativeExtractor() {
  if (nativeAvailable === false) return null;

  nativeModule ??= import('react-native-image-colors')
    .then((module) => {
      nativeAvailable = true;
      return module;
    })
    .catch(() => {
      nativeAvailable = false;
      return null;
    });

  return nativeModule;
}

/** `#RRGGBB` — what both extractors are expected to return, and neither promises. */
const HEX = /^#[0-9a-f]{6}$/i;

function normalise(value: string | undefined | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (HEX.test(trimmed)) return trimmed.toUpperCase();
  /* Android's Palette can hand back `#AARRGGBB`. Take the RGB half rather than
     dropping the answer — an 8-digit hex reaching `argbFromHex` would parse as
     something unrelated. */
  if (/^#[0-9a-f]{8}$/i.test(trimmed)) return `#${trimmed.slice(3)}`.toUpperCase();
  return null;
}

/**
 * One extraction, whichever extractor is available.
 *
 * Exported for the provider's prefetch and kept out of the hook body so the
 * ordering is stated once: native first, JPEG decoder second, `null` last.
 * `null` means "no colour", not "error" — the caller supplies the seed.
 */
export async function extractSeedColor(uri: string): Promise<string | null> {
  const native = await loadNativeExtractor();

  if (native) {
    try {
      const result = await native.getColors(uri, {
        /* The library's own cache, on top of the query cache. Cheap, and it is
           the one that survives a query-cache eviction mid-session. */
        cache: true,
        key: uri,
        fallback: NEUTRAL_SEED,
      });

      /* The result is a discriminated union over `platform`, and the useful
         field differs: Android's Palette exposes `dominant`, iOS's
         `UIImageColors` exposes `primary`. Reading the wrong one is a type
         error rather than a silent `undefined`, which is why this switches
         rather than reaching for `(result as any).dominant`. */
      const picked =
        result.platform === 'android'
          ? result.dominant
          : result.platform === 'ios'
            ? result.primary
            : result.dominant;

      const hex = normalise(picked);
      if (hex) return hex;
    } catch {
      /* A single image that Palette cannot read — a 404, an animated WebP.
         Falls through to the decoder rather than failing the extraction. */
    }
  }

  const decoded = await extractArtworkColor(uri);
  return normalise(decoded?.raw) ?? normalise(decoded?.color);
}

export type UseAlbumArtColorOptions = {
  /**
   * What to return while nothing has been extracted yet, and when everything
   * fails.
   *
   * Defaults to M3's baseline purple. Pass `NEUTRAL_SEED` where a recognisably
   * neutral page is better than a recognisably default one.
   */
  fallback?: string;
};

/**
 * The seed colour for one piece of artwork. Never null — falls back instead.
 *
 * Returning a seed rather than `string | null` is deliberate: every caller would
 * otherwise write the same `?? FALLBACK_SEED`, and one of them would eventually
 * write a different one. The page always has a colour.
 */
export function useAlbumArtColor(
  imageUri: string | null | undefined,
  { fallback = FALLBACK_SEED }: UseAlbumArtColorOptions = {}
): string {
  const seed = useQuery({
    queryKey: ['album-art-color', imageUri],
    queryFn: () => extractSeedColor(imageUri!),
    enabled: !!imageUri,
    /* The colour of a piece of box art does not change. Ever. */
    staleTime: Infinity,
    gcTime: Infinity,
    retry: false,
  });

  return seed.data ?? fallback;
}

/** Whether the native extractor bound. Diagnostics only — never branch UI on it. */
export function nativeExtractorAvailable(): boolean {
  return nativeAvailable === true;
}

/** Unused today; kept so a future dev-build-only path can read the platform. */
export const EXTRACTOR_PLATFORM = Platform.OS;
