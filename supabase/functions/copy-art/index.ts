// A physical copy's back cover and disc label, from GameTDB and ScreenScraper.
//
// POST { title, platform, region } — `platform` is the app's platform key
// (`constants/platform-cases.ts`: 'wii', 'ps2', 'switch'…), `region` the copy's
// (`owned_copies.region`). Answers `{ back, disc }`, each null or an image this
// project keeps — never a URL of either source: GameTDB's are kept so no phone
// hot-links its art, ScreenScraper's because they carry the developer
// password. What each source has and how a game is found in it is
// `_shared/copy-art.ts`, which `npm test` reads.
//
// Secrets: none for GameTDB. ScreenScraper is used when these are set —
//   supabase secrets set SCREENSCRAPER_DEV_ID=… SCREENSCRAPER_DEV_PASSWORD=…
//   (optional, a user account raises the quota) SCREENSCRAPER_USER=… SCREENSCRAPER_PASSWORD=…
// Without them, GameTDB alone answers (Nintendo's disc and cartridge consoles).
//
// Needs migration 0042: the `copy_art` cache and the public `copy-art` bucket.
// Without the table it still works, asking the sources every time; without the
// bucket it has nowhere to keep an image and answers nothing.

import { jsonResponse, preflight } from '../_shared/http.ts';
import { adminClient, userFromRequest } from '../_shared/supabase-admin.ts';
import {
  SCREENSCRAPER_SYSTEMS,
  artCacheKey,
  imageSize,
  parseTdbTitles,
  pickScreenscraperGame,
  pickScreenscraperMedia,
  screenscraperGames,
  sleeveBackCrop,
  tdbArtUrl,
  tdbCandidates,
  tdbFoldersFor,
  tdbPlanFor,
  tdbTitlesUrl,
  type ArtSource,
  type CopyArt,
  type CopyArtImage,
  type CopyRegion,
  type TdbConsole,
} from '../_shared/copy-art.ts';

const USER_AGENT = 'GameLog/1.0 (game diary app; physical copy art)';
const TIMEOUT_MS = 9000;
/** A found picture is kept three months; a miss a week, so a new upload is found. */
const FOUND_TTL_DAYS = 90;
const MISS_TTL_DAYS = 7;
const BUCKET = 'copy-art';
/** The largest image kept: a GameTDB sleeve is about 1 MB, a Switch back about the same. */
const MAX_BYTES = 6 * 1024 * 1024;

const REGIONS: readonly CopyRegion[] = ['ntsc_u', 'pal', 'ntsc_j', 'asia', 'region_free', 'other'];

/** GameTDB's title lists, kept while this instance lives: each is one 0.3–0.8 MB download. */
const titleLists = new Map<TdbConsole, Promise<{ id: string; title: string }[]>>();

function titlesFor(console: TdbConsole) {
  let list = titleLists.get(console);
  if (!list) {
    list = fetch(tdbTitlesUrl(console), {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then((response) => (response.ok ? response.text() : ''))
      .then(parseTdbTitles)
      .catch(() => {
        titleLists.delete(console);
        return [];
      });
    titleLists.set(console, list);
  }
  return list;
}

/** An image's bytes, or null for anything that is not one. */
async function download(url: string): Promise<{ bytes: Uint8Array; type: string } | null> {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return null;
    const type = response.headers.get('content-type') ?? '';
    if (!type.startsWith('image/')) return null;
    const bytes = new Uint8Array(await response.arrayBuffer());
    return bytes.length > 0 && bytes.length <= MAX_BYTES ? { bytes, type } : null;
  } catch {
    return null;
  }
}

async function sha1(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

/** Keep an image in the project's bucket, and answer its public address. */
async function keep(
  admin: ReturnType<typeof adminClient>,
  source: string,
  image: { bytes: Uint8Array; type: string }
): Promise<string | null> {
  const ext = image.type.includes('png') ? 'png' : image.type.includes('webp') ? 'webp' : 'jpg';
  const path = `${await sha1(source)}.${ext}`;
  const uploaded = await admin.storage
    .from(BUCKET)
    .upload(path, image.bytes, { contentType: image.type, upsert: true });
  if (uploaded.error) {
    console.warn('[copy-art] keep failed:', uploaded.error.message);
    return null;
  }
  return admin.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;
}

async function asImage(
  admin: ReturnType<typeof adminClient>,
  url: string,
  source: ArtSource,
  spread: boolean
): Promise<CopyArtImage | null> {
  const image = await download(url);
  if (!image) return null;
  const size = imageSize(image.bytes);
  if (!size) return null;
  const kept = await keep(admin, url, image);
  if (!kept) return null;
  return {
    url: kept,
    width: size.width,
    height: size.height,
    crop: spread ? sleeveBackCrop(size.width, size.height) : null,
    source,
  };
}

/** GameTDB: the game's IDs, then the first folder each picture is in. */
async function fromGameTdb(
  admin: ReturnType<typeof adminClient>,
  platform: string,
  title: string,
  region: CopyRegion | null
): Promise<CopyArt> {
  const plan = tdbPlanFor(platform);
  if (!plan) return { back: null, disc: null };
  const ids = tdbCandidates(await titlesFor(plan.console), plan.console, title, region).slice(0, 4);

  for (const id of ids) {
    const folders = tdbFoldersFor(region ?? 'ntsc_u');
    let back: CopyArtImage | null = null;
    let disc: CopyArtImage | null = null;
    for (const folder of folders) {
      if (!back) {
        back = await asImage(
          admin,
          tdbArtUrl(plan.console, plan.back.type, folder, id, plan.back.ext),
          'gametdb',
          plan.back.spread
        );
      }
      if (!disc && plan.disc) {
        disc = await asImage(
          admin,
          tdbArtUrl(plan.console, plan.disc.type, folder, id, plan.disc.ext),
          'gametdb',
          false
        );
      }
      if (back && (disc || !plan.disc)) break;
    }
    if (back || disc) return { back, disc };
  }
  return { back: null, disc: null };
}

/** ScreenScraper: one search by name on the system, then the region's back and label. */
async function fromScreenScraper(
  admin: ReturnType<typeof adminClient>,
  platform: string,
  title: string,
  region: CopyRegion | null
): Promise<CopyArt> {
  const devId = Deno.env.get('SCREENSCRAPER_DEV_ID')?.trim();
  const devPassword = Deno.env.get('SCREENSCRAPER_DEV_PASSWORD')?.trim();
  const system = SCREENSCRAPER_SYSTEMS[platform];
  if (!devId || !devPassword || !system) return { back: null, disc: null };

  const params = new URLSearchParams({
    devid: devId,
    devpassword: devPassword,
    softname: 'GameLog',
    output: 'json',
    systemeid: String(system),
    recherche: title,
  });
  const user = Deno.env.get('SCREENSCRAPER_USER')?.trim();
  const password = Deno.env.get('SCREENSCRAPER_PASSWORD')?.trim();
  if (user && password) {
    params.set('ssid', user);
    params.set('sspassword', password);
  }

  let answer: unknown = null;
  try {
    const response = await fetch(`https://api.screenscraper.fr/api2/jeuRecherche.php?${params}`, {
      headers: { 'User-Agent': USER_AGENT },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) {
      console.warn('[copy-art] ScreenScraper answered', response.status);
      return { back: null, disc: null };
    }
    answer = await response.json().catch(() => null);
  } catch (error) {
    console.warn(
      '[copy-art] ScreenScraper failed:',
      error instanceof Error ? error.message : error
    );
    return { back: null, disc: null };
  }

  const game = pickScreenscraperGame(screenscraperGames(answer), title);
  if (!game) return { back: null, disc: null };
  const backMedia = pickScreenscraperMedia(game, ['box-2D-back'], region);
  const discMedia = pickScreenscraperMedia(game, ['support-2D', 'support-texture'], region);
  return {
    back: backMedia?.url ? await asImage(admin, backMedia.url, 'screenscraper', false) : null,
    disc: discMedia?.url ? await asImage(admin, discMedia.url, 'screenscraper', false) : null,
  };
}

Deno.serve(async (request: Request) => {
  if (request.method === 'OPTIONS') return preflight();
  if (request.method !== 'POST') return jsonResponse({ error: 'Use POST.' }, 405);

  if (!(await userFromRequest(request))) {
    return jsonResponse({ error: 'Sign in to look up a copy’s art.' }, 401);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: 'Body must be JSON.' }, 400);
  }

  const title = typeof body.title === 'string' ? body.title.trim().slice(0, 200) : '';
  const platform = typeof body.platform === 'string' ? body.platform.trim() : '';
  const region = REGIONS.includes(body.region as CopyRegion) ? (body.region as CopyRegion) : null;
  if (!title || !platform)
    return jsonResponse({ error: 'A title and a platform are needed.' }, 400);

  const admin = adminClient();
  const key = artCacheKey(platform, region, title);

  /* The cache is 0042's. A database without it answers an error here, and the
     sources are asked every time — slower, never wrong. */
  const cached = await admin
    .from('copy_art')
    .select('answer, fetched_at')
    .eq('key', key)
    .maybeSingle<{ answer: CopyArt; fetched_at: string }>();
  if (cached.data) {
    const found = !!(cached.data.answer.back || cached.data.answer.disc);
    const days = found ? FOUND_TTL_DAYS : MISS_TTL_DAYS;
    if (Date.now() - new Date(cached.data.fetched_at).getTime() < days * 86_400_000) {
      return jsonResponse(cached.data.answer);
    }
  }

  /* GameTDB first — it is free and its scans are the cleanest — then
     ScreenScraper for whatever GameTDB did not have. */
  const tdb = await fromGameTdb(admin, platform, title, region);
  const answer: CopyArt =
    tdb.back && (tdb.disc || !tdbPlanFor(platform)?.disc)
      ? tdb
      : await fromScreenScraper(admin, platform, title, region).then((ss) => ({
          back: tdb.back ?? ss.back,
          disc: tdb.disc ?? ss.disc,
        }));

  const written = await admin
    .from('copy_art')
    .upsert({ key, answer, fetched_at: new Date().toISOString() });
  if (written.error) console.warn('[copy-art] cache write failed:', written.error.message);

  return jsonResponse(answer);
});
