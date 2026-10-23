/**
 * Where a physical copy's back cover and disc label come from — the owner's
 * request (2026-10-22): "When someone scans a game and they add it to their
 * physical collection, you should fetch in the two apis below for a back cover
 * and CD disc to display. The front stays app-default." The two are GameTDB
 * and ScreenScraper.
 *
 * No imports: the `copy-art` Edge Function deploys this and `npm test` loads it
 * by relative path (`src/lib/copy-art.test.ts`), as the SoundCloud matcher and
 * the Steam store parser are.
 *
 * ## GameTDB
 *
 * Read on 2026-10-22, live. There is no API — the repository the owner pointed
 * at (`emilydaemon/gametdb-api`) is a small server over GameTDB's title lists —
 * so the function does what it does: GameTDB publishes, per console, a text
 * list of `ID = Title` (`www.gametdb.com/wiitdb.txt?LANG=EN`, 0.3–0.8 MB each),
 * and its art lives at `art.gametdb.com/{console}/{type}/{region}/{ID}.{png|jpg}`,
 * 404 when it does not exist. What each console has, checked file by file:
 *
 * | Console          | Back                                   | Disc         |
 * | Wii, GameCube    | `coverfullHQ` — the whole sleeve, back | `disc` (png) |
 * |                  | left of the spine, 1024 × 680          |              |
 * | Wii U            | `backHQ` (jpg)                         | `disc` (png) |
 * | DS, 3DS, Switch  | `backHQ` (jpg)                         | — (cartridge)|
 *
 * GameCube's IDs are in the Wii list and its art under `wii/`. A cartridge's
 * label is not a disc, and the copy screen draws no cartridge (the owner's
 * rule), so those consoles give a back only.
 *
 * ## ScreenScraper
 *
 * Its API v2 (`api.screenscraper.fr/api2`, documented at
 * `screenscraper.fr/webapi2.php`): `jeuRecherche.php` finds a game by name on a
 * system and answers up to thirty, each with its `medias` — `box-2D-back` (the
 * back) and `support-2D` / `support-texture` (the disc or cartridge label),
 * each tagged with a region. It needs **developer credentials** (`devid`,
 * `devpassword`) that ScreenScraper grants on request, and every media URL it
 * answers carries them — so the function downloads the image and keeps its own
 * copy, and no ScreenScraper URL reaches a phone. **Not run**: the project has
 * no ScreenScraper credentials yet. The system ids below are the ones the
 * scraping tools use (Skyscraper's table), and are to be checked on the first
 * run with keys.
 */

/** The regions a copy can be from — `owned_copies.region`'s CHECK (0024). */
export type CopyRegion = 'ntsc_u' | 'pal' | 'ntsc_j' | 'asia' | 'region_free' | 'other';

export type ArtSource = 'gametdb' | 'screenscraper';

/** A picture found for a copy: where it is kept, its size, and — for a sleeve — which part is the back. */
export type CopyArtImage = {
  url: string;
  width: number;
  height: number;
  /**
   * The part of the image that is the back, as fractions of its width, when
   * the image is the whole sleeve (back, spine, front). Null when the image is
   * the back alone.
   */
  crop: { left: number; right: number } | null;
  source: ArtSource;
};

export type CopyArt = { back: CopyArtImage | null; disc: CopyArtImage | null };

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * What two names are compared on: the app's `titleKey` (`lib/games/rawg-match`),
 * restated here because this file imports nothing. Lower case, no accents or
 * trademark signs, "&" as "and", every other mark a space.
 */
export function artTitleKey(name: string): string {
  return name
    .replace(/[™®©]/g, '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/['’`]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** The key a copy's art is kept under: its platform, region and name. */
export function artCacheKey(platform: string, region: CopyRegion | null, title: string): string {
  return `${platform}|${region ?? 'any'}|${artTitleKey(title)}`;
}

// ---------------------------------------------------------------------------
// GameTDB
// ---------------------------------------------------------------------------

export type TdbConsole = 'wii' | 'wiiu' | 'ds' | '3ds' | 'switch';

type TdbPlan = {
  /** Which title list, and which folder of art. */
  console: TdbConsole;
  back: { type: string; ext: 'png' | 'jpg'; spread: boolean };
  disc: { type: string; ext: 'png' | 'jpg' } | null;
};

/** The app's platform keys (`constants/platform-cases.ts`) that GameTDB has art for. */
const TDB_PLANS: Record<string, TdbPlan> = {
  wii: {
    console: 'wii',
    back: { type: 'coverfullHQ', ext: 'png', spread: true },
    disc: { type: 'disc', ext: 'png' },
  },
  gamecube: {
    console: 'wii',
    back: { type: 'coverfullHQ', ext: 'png', spread: true },
    disc: { type: 'disc', ext: 'png' },
  },
  wiiu: {
    console: 'wiiu',
    back: { type: 'backHQ', ext: 'jpg', spread: false },
    disc: { type: 'disc', ext: 'png' },
  },
  ds: { console: 'ds', back: { type: 'backHQ', ext: 'jpg', spread: false }, disc: null },
  threeds: { console: '3ds', back: { type: 'backHQ', ext: 'jpg', spread: false }, disc: null },
  switch: { console: 'switch', back: { type: 'backHQ', ext: 'jpg', spread: false }, disc: null },
};

export function tdbPlanFor(platform: string): TdbPlan | null {
  return TDB_PLANS[platform] ?? null;
}

/** GameTDB's title list for a console, in English. */
export function tdbTitlesUrl(console: TdbConsole): string {
  return `https://www.gametdb.com/${console}tdb.txt?LANG=EN`;
}

/** `ID = Title` lines, the first line (the list's own header) left out. */
export function parseTdbTitles(text: string): { id: string; title: string }[] {
  const out: { id: string; title: string }[] = [];
  for (const line of text.split(/\r?\n/)) {
    const match = /^([A-Z0-9]{4,10}) = (.+)$/.exec(line.trim());
    if (match && match[1] !== 'TITLES') out.push({ id: match[1], title: match[2].trim() });
  }
  return out;
}

/**
 * Which region an ID is from: GameTDB's IDs carry it in a letter — the fourth
 * of a Wii, GameCube, Wii U, DS or 3DS ID (RMC**E**01, AMK**E**), the fifth of
 * a Switch one.
 */
export function tdbRegionOf(console: TdbConsole, id: string): CopyRegion {
  const letter = console === 'switch' ? id[4] : id[3];
  switch (letter) {
    case 'E':
    case 'N':
      return 'ntsc_u';
    case 'J':
      return 'ntsc_j';
    case 'K':
    case 'W':
    case 'Q':
    case 'T':
    case 'C':
      return 'asia';
    case 'A':
      return 'region_free';
    case undefined:
      return 'other';
    default:
      /* P, D, F, S, I, X, Y, U (Australia), H, R, L, M…: Europe and Australia. */
      return 'pal';
  }
}

/** The art folders a region's box is filed under, the likeliest first. */
export function tdbFoldersFor(region: CopyRegion): string[] {
  switch (region) {
    case 'ntsc_u':
      return ['US', 'EN'];
    case 'ntsc_j':
      return ['JA', 'US'];
    case 'asia':
      return ['KO', 'ZH', 'JA', 'US'];
    case 'pal':
      return ['EN', 'FR', 'DE', 'ES', 'IT', 'NL', 'AU', 'US'];
    default:
      return ['US', 'EN', 'JA'];
  }
}

/**
 * The IDs that are this game, the copy's own region first: every ID whose
 * title is the game's name, read past a trailing edition ("Mario Kart 8
 * Deluxe Bundle (…)" is not "Mario Kart 8 Deluxe"). A copy with no region
 * takes NTSC-U's first, then Europe's.
 */
export function tdbCandidates(
  titles: readonly { id: string; title: string }[],
  console: TdbConsole,
  name: string,
  region: CopyRegion | null
): string[] {
  const key = artTitleKey(name);
  const named = titles.filter((entry) => artTitleKey(entry.title) === key).map((entry) => entry.id);
  const order: CopyRegion[] = [
    ...(region && region !== 'other' ? [region] : []),
    'ntsc_u',
    'region_free',
    'pal',
    'ntsc_j',
    'asia',
    'other',
  ];
  return [...new Set(named)].sort(
    (a, b) => order.indexOf(tdbRegionOf(console, a)) - order.indexOf(tdbRegionOf(console, b))
  );
}

/** An art URL on GameTDB. */
export function tdbArtUrl(
  console: TdbConsole,
  type: string,
  folder: string,
  id: string,
  ext: 'png' | 'jpg'
): string {
  return `https://art.gametdb.com/${console}/${type}/${folder}/${id}.${ext}`;
}

/** GameTDB's front cover is 160 × 224 on every disc console: the shape a sleeve's back shares. */
const TDB_FRONT_ASPECT = 160 / 224;

/**
 * Which part of a sleeve is the back: from its left edge to as wide as a front
 * is at that height. Mario Kart Wii's sleeve is 1024 × 680, so the back is the
 * left 486 — where the spine begins, measured on the image.
 */
export function sleeveBackCrop(width: number, height: number): { left: number; right: number } {
  if (!(width > 0) || !(height > 0)) return { left: 0, right: 0.5 };
  return { left: 0, right: Math.min(0.5, (height * TDB_FRONT_ASPECT) / width) };
}

// ---------------------------------------------------------------------------
// ScreenScraper
// ---------------------------------------------------------------------------

/**
 * ScreenScraper's system ids for the app's platform keys — the ones the
 * scraping tools use. Unverified here (no credentials); a key missing from
 * this table is simply not asked about.
 */
export const SCREENSCRAPER_SYSTEMS: Record<string, number> = {
  genesis: 1,
  mastersystem: 2,
  nes: 3,
  snes: 4,
  gameboy: 9,
  gbc: 10,
  virtualboy: 11,
  gba: 12,
  gamecube: 13,
  n64: 14,
  ds: 15,
  wii: 16,
  threeds: 17,
  wiiu: 18,
  sega32x: 19,
  segacd: 20,
  gamegear: 21,
  saturn: 22,
  dreamcast: 23,
  ngp: 25,
  atari2600: 26,
  jaguar: 27,
  lynx: 28,
  threedo: 29,
  pcengine: 31,
  xboxOriginal: 32,
  xbox360: 33,
  atari5200: 40,
  atari7800: 41,
  wonderswan: 45,
  wonderswancolor: 46,
  colecovision: 48,
  ps1: 57,
  ps2: 58,
  ps3: 59,
  ps4: 60,
  psp: 61,
  vita: 62,
  ngpc: 82,
  neogeo: 142,
  switch: 225,
};

/** ScreenScraper's region codes for a copy's region, the likeliest first; `wor` (world) and `ss` last. */
export function screenscraperRegionsFor(region: CopyRegion | null): string[] {
  switch (region) {
    case 'ntsc_u':
      return ['us', 'wor', 'ss', 'eu'];
    case 'pal':
      return ['eu', 'uk', 'fr', 'de', 'sp', 'it', 'wor', 'ss', 'us'];
    case 'ntsc_j':
      return ['jp', 'wor', 'ss', 'us'];
    case 'asia':
      return ['asi', 'kr', 'cn', 'jp', 'wor', 'ss'];
    default:
      return ['wor', 'us', 'eu', 'ss', 'jp'];
  }
}

type SsMedia = { type?: string; url?: string; region?: string; format?: string };
type SsGame = {
  id?: string | number;
  noms?: { region?: string; text?: string }[];
  medias?: SsMedia[];
};

/** The games in a `jeuRecherche.php` JSON answer. An answer with none is `[{}]` there. */
export function screenscraperGames(answer: unknown): SsGame[] {
  const games = (answer as { response?: { jeux?: unknown } } | null)?.response?.jeux;
  return Array.isArray(games)
    ? (games as SsGame[]).filter((game) => game && (game.id !== undefined || game.noms))
    : [];
}

/**
 * The game that is this one: any of its names the game's own, else nothing —
 * ScreenScraper ranks by "probability", and its first guess for a name it
 * does not know is another game.
 */
export function pickScreenscraperGame(games: readonly SsGame[], name: string): SsGame | null {
  const key = artTitleKey(name);
  return (
    games.find((game) => (game.noms ?? []).some((nom) => artTitleKey(nom.text ?? '') === key)) ??
    null
  );
}

/** The media of a kind in the copy's region, the likeliest region first. */
export function pickScreenscraperMedia(
  game: SsGame,
  types: readonly string[],
  region: CopyRegion | null
): SsMedia | null {
  const regions = screenscraperRegionsFor(region);
  const medias = (game.medias ?? []).filter(
    (media) => media.url && types.includes(media.type ?? '')
  );
  for (const type of types) {
    const ofType = medias.filter((media) => media.type === type);
    const ranked = [...ofType].sort((a, b) => rank(a.region) - rank(b.region));
    if (ranked[0]) return ranked[0];
  }
  return null;

  function rank(code: string | undefined): number {
    const at = regions.indexOf(code ?? '');
    return at < 0 ? regions.length : at;
  }
}

// ---------------------------------------------------------------------------
// Images
// ---------------------------------------------------------------------------

/**
 * A PNG's or a JPEG's size from its first bytes — the sleeve's crop needs it,
 * and the function decodes nothing else. Null for anything else.
 */
export function imageSize(bytes: Uint8Array): { width: number; height: number } | null {
  /* PNG: the signature, then IHDR's width and height, big-endian. */
  if (bytes.length >= 24 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e) {
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  /* JPEG: walk the segments to a start-of-frame. */
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) {
    let at = 2;
    while (at + 9 < bytes.length) {
      if (bytes[at] !== 0xff) return null;
      const marker = bytes[at + 1];
      const length = (bytes[at + 2] << 8) | bytes[at + 3];
      const frame =
        marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (frame) {
        return {
          height: (bytes[at + 5] << 8) | bytes[at + 6],
          width: (bytes[at + 7] << 8) | bytes[at + 8],
        };
      }
      at += 2 + length;
    }
  }
  return null;
}
