/**
 * Steam's official store artwork, by appid.
 *
 * IGDB's covers are scraped and inconsistent — a game can have a fan-made
 * capsule, a box scan from 1998, or the wrong regional art. Steam's
 * `library_600x900_2x.jpg` is the publisher's own store asset at exactly the
 * 2:3 this UI is built around, so where a game has a Steam listing it is the
 * better image.
 *
 * **This is a preference, not a replacement.** IGDB stays the fallback and the
 * placeholder is the last resort, in that order — see `<Poster>`. Half
 * this catalogue is not on Steam at all (every Nintendo and PlayStation
 * exclusive), and swapping good IGDB art for a grey rectangle on those would be
 * a straight regression.
 *
 * ## Two URL shapes, and why the second one exists
 *
 * Most appids serve artwork at a predictable path:
 *
 *   …/store_item_assets/steam/apps/730/library_600x900_2x.jpg   → 200
 *
 * Newer or re-published entries put their assets behind a content hash:
 *
 *   …/store_item_assets/steam/apps/2623190/library_600x900_2x.jpg           → 404
 *   …/store_item_assets/steam/apps/2623190/b52322f…/library_600x900_2x.jpg  → 200
 *
 * Both verified against the live CDN. The hash is only discoverable through
 * `IStoreBrowseService/GetItems`, so the strategy is: construct the direct URL
 * for free, and resolve the hashed one *only* for the appids whose direct URL
 * actually failed. No HEAD probe, no request at all on the happy path.
 *
 * ## Host
 *
 * `shared.steamstatic.com`, not `shared.cloudflare.steamstatic.com` — the
 * latter 301s to the former, so using it costs a redirect on every single
 * image.
 */

/** Verified: the cloudflare subdomain 301s here, so go straight to it. */
const STEAM_CDN_BASE = 'https://shared.steamstatic.com/store_item_assets';

/**
 * The artwork slots this app asks for.
 *
 * `library` is the portrait capsule that fills a `<Poster>`; `header` is the
 * 460×215 store banner; `hero` is the 1920×620 page backdrop; `logo` is the
 * transparent wordmark that sits over a hero.
 */
export type SteamArtworkType = 'library' | 'header' | 'hero' | 'logo';

/**
 * The filename each slot maps to under an appid's asset directory.
 *
 * `library_logo.png`, not `logo.png`: the bare name is the *old* pre-library
 * asset and is missing for most modern apps. This is also the one slot with no
 * API fallback — see `ASSET_KEYS`.
 */
const FILENAMES: Record<SteamArtworkType, string> = {
  library: 'library_600x900_2x.jpg',
  header: 'header.jpg',
  hero: 'library_hero.jpg',
  logo: 'library_logo.png',
};

/**
 * What `GetItems` calls each slot inside its `assets` object.
 *
 * **`logo` is absent on purpose.** The live response for both a hashed and an
 * unhashed app returns `main_capsule`, `small_capsule`, `header`,
 * `library_capsule`, `library_hero` and their `_2x` variants — and no logo key
 * at all. So a logo can only ever be the direct URL, and a hashed app simply
 * has no logo this code can find. Rendering nothing is correct there; guessing
 * a hash is not.
 */
const ASSET_KEYS: Partial<Record<SteamArtworkType, string>> = {
  library: 'library_capsule_2x',
  header: 'header',
  hero: 'library_hero',
};

/**
 * The predictable URL for one asset. Pure string building — no network.
 *
 * Right for roughly 95% of appids. When it 404s, `fetchSteamArtwork` finds the
 * hashed path.
 */
export function getSteamArtworkUrl(appId: string | number, type: SteamArtworkType): string {
  return `${STEAM_CDN_BASE}/steam/apps/${appId}/${FILENAMES[type]}`;
}

/** Every slot's direct URL, for seeding a cache entry before anything fails. */
export function directArtwork(appId: string | number): Record<SteamArtworkType, string> {
  return {
    library: getSteamArtworkUrl(appId, 'library'),
    header: getSteamArtworkUrl(appId, 'header'),
    hero: getSteamArtworkUrl(appId, 'hero'),
    logo: getSteamArtworkUrl(appId, 'logo'),
  };
}

type StoreItem = {
  appid?: number;
  assets?: Record<string, string | undefined> & { asset_url_format?: string };
};

type GetItemsResponse = { response?: { store_items?: StoreItem[] } };

/** Steam's public store metadata service. No API key — verified against live. */
const GET_ITEMS_URL = 'https://api.steampowered.com/IStoreBrowseService/GetItems/v1/';

/** Steam rejects very large id batches; 50 is comfortably under any limit seen. */
const MAX_BATCH = 50;

/** Between batches, so a big library sweep is not a burst. */
const BATCH_DELAY_MS = 100;

const MAX_RETRIES = 2;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Turn one item's `assets` block into absolute URLs.
 *
 * `asset_url_format` comes back as a template with a cache token on the end:
 *
 *   "steam/apps/2623190/${FILENAME}?t=1786648304"
 *
 * so the filename is **substituted into** it, not concatenated onto a prefix.
 * Splitting on `${FILENAME}` and keeping the left half — the obvious approach —
 * silently drops `?t=…`, which is the CDN's cache key: a publisher who
 * re-uploads a capsule would keep serving the old one to anyone holding the
 * stripped URL.
 *
 * The template is also *relative to* `store_item_assets/`, not to the CDN root.
 * Prepending the bare host produces `…steamstatic.com/steam/apps/…`, which 404s
 * for every game — the missing path segment is the difference between this
 * fallback working and never working at all.
 */
function absoluteUrls(item: StoreItem): Partial<Record<SteamArtworkType, string>> {
  const assets = item.assets;
  const format = assets?.asset_url_format;
  if (!assets || !format) return {};

  const resolved: Partial<Record<SteamArtworkType, string>> = {};

  for (const [type, key] of Object.entries(ASSET_KEYS) as [SteamArtworkType, string][]) {
    const filename = assets[key];
    if (!filename) continue;
    resolved[type] = `${STEAM_CDN_BASE}/${format.replace('${FILENAME}', filename)}`;
  }

  return resolved;
}

/**
 * Resolve hashed artwork paths for a batch of appids.
 *
 * Called only for appids whose direct URL failed, so this is the exception
 * path — a warm app makes no calls here at all.
 *
 * Slots the response does not mention fall back to the direct URL rather than
 * being dropped: an app can have a hashed capsule and an unhashed header, and
 * returning nothing for the second would lose an image that works.
 *
 * A whole failed batch resolves to an empty map rather than throwing. Artwork
 * is decoration on top of a page that already works; a Steam outage should cost
 * nicer covers, not the screen.
 */
export async function fetchSteamArtwork(
  appIds: readonly (string | number)[],
  signal?: AbortSignal
): Promise<Map<string, Record<SteamArtworkType, string>>> {
  const resolved = new Map<string, Record<SteamArtworkType, string>>();

  const numeric = [...new Set(appIds.map(Number))].filter((id) => Number.isFinite(id) && id > 0);
  if (numeric.length === 0) return resolved;

  for (let offset = 0; offset < numeric.length; offset += MAX_BATCH) {
    const batch = numeric.slice(offset, offset + MAX_BATCH);
    if (offset > 0) await sleep(BATCH_DELAY_MS);

    /*
     * GET with `input_json`, not POST with a JSON body.
     *
     * Steam's WebAPI services take their arguments as a URL-encoded JSON blob;
     * this shape is what was verified working against the live endpoint, keyless.
     */
    const input = encodeURIComponent(
      JSON.stringify({
        ids: batch.map((appid) => ({ appid })),
        context: { country_code: 'US', language: 'english' },
        data_request: { include_assets: true },
      })
    );

    const items = await withRetry(async () => {
      const response = await fetch(`${GET_ITEMS_URL}?input_json=${input}`, { signal });
      if (!response.ok) throw new Error(`Steam GetItems failed (${response.status})`);
      const json = (await response.json()) as GetItemsResponse;
      return json.response?.store_items ?? [];
    }, signal);

    for (const item of items ?? []) {
      if (typeof item.appid !== 'number') continue;
      const direct = directArtwork(item.appid);
      resolved.set(String(item.appid), { ...direct, ...absoluteUrls(item) });
    }
  }

  return resolved;
}

/**
 * Two retries, then give up quietly.
 *
 * Aborts are not retried — a cancelled request means the screen went away, and
 * retrying it would be work for a component that no longer exists.
 */
async function withRetry<T>(run: () => Promise<T>, signal?: AbortSignal): Promise<T | null> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt += 1) {
    try {
      return await run();
    } catch (error) {
      if (signal?.aborted) return null;
      if (attempt === MAX_RETRIES) {
        console.warn('[steam-artwork] giving up after retries:', error);
        return null;
      }
      await sleep(BATCH_DELAY_MS * (attempt + 1));
    }
  }
  return null;
}
