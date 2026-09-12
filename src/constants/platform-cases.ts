import type { ImageSourcePropType } from 'react-native';

/**
 * Physical case templates, one per platform family.
 *
 * A template is a PNG of the case's front face: opaque chrome (border, top
 * band, branding) with the cover window punched out as transparent pixels. The
 * artwork is drawn *beneath* the template and shows through that window, which
 * is why `coverArea` is never hardcoded in the component — it comes from here.
 *
 * REPLACING THE ARTWORK
 * ---------------------
 * The files in assets/cases/ are generated placeholders. Swap them for real
 * templates freely; the only contract is:
 *
 *   - keep `templateSize` accurate for the new file
 *   - keep `coverArea` describing the transparent window, in template pixels
 *   - keep the window genuinely transparent (alpha 0), not white
 *
 * Nothing in <GameCase /> needs to change when you do.
 */

export type PlatformKey =
  /* Current and recent, in the order a switcher should offer them. */
  | 'ps5'
  | 'xbox'
  | 'switch2'
  | 'switch'
  | 'ps4'
  | 'pc'
  | 'ios'
  | 'android'
  /* Streaming. */
  | 'stadia'
  | 'luna'
  /* PlayStation back catalogue. */
  | 'ps3'
  | 'ps2'
  | 'ps1'
  | 'psp'
  | 'vita'
  /* Xbox back catalogue. */
  | 'xbox360'
  | 'xboxOriginal'
  /* Nintendo back catalogue. */
  | 'wiiu'
  | 'wii'
  | 'gamecube'
  | 'n64'
  | 'snes'
  | 'nes'
  | 'threeds'
  | 'ds'
  | 'gba'
  | 'gbc'
  | 'gameboy'
  /* Sega. */
  | 'dreamcast'
  | 'saturn'
  | 'genesis'
  /* Everything older, and everything genuinely unusual. */
  | 'atari'
  | 'arcade'
  | 'vr'
  | 'other';

/**
 * The platforms that get a physical case.
 *
 * Console only, and that is the whole rule: a boxed copy is a real object you
 * could have put on a shelf. PC has been digital-first for a decade and mobile
 * never had a box at all, so rendering one there is a prop, not a memory — those
 * platforms show the bare cover art instead.
 */
export type CasePlatformKey = 'ps5' | 'ps4' | 'xbox' | 'switch';

export const CASE_PLATFORMS: readonly CasePlatformKey[] = ['ps5', 'ps4', 'xbox', 'switch'];

export function hasCase(key: PlatformKey): key is CasePlatformKey {
  return (CASE_PLATFORMS as readonly PlatformKey[]).includes(key);
}

/**
 * Everything about a platform that is not its case: how to name it, which mark
 * to draw, and where its store lives.
 */
export type PlatformMeta = {
  key: PlatformKey;
  label: string;
  /** Short form for a chip or a generated spine. */
  short: string;
  /**
   * Ionicons glyph. Nintendo has no mark in the set, so Switch falls back to a
   * generic controller rather than borrowing another vendor's logo.
   */
  icon:
    | 'logo-playstation'
    | 'logo-xbox'
    | 'logo-steam'
    | 'logo-apple'
    | 'logo-google-playstore'
    | 'logo-google'
    | 'logo-amazon'
    | 'game-controller'
    | 'glasses'
    | 'hardware-chip'
    | 'tv';
  accent: string;
  /**
   * What the "open the store" line says for this platform, or **null when there
   * is no store to open**.
   *
   * Null and `externalCategory: null` always travel together: a platform whose
   * store IGDB does not publish a link for has nothing to label. Retro consoles
   * and the ones added without a verified category are all in this state, and
   * the price block renders no link rather than an inert one.
   */
  storeLabel: string | null;
  /**
   * IGDB `external_games.category`, used to resolve the store link.
   *
   * Null where IGDB publishes no store entry for the platform — Nintendo's
   * eShop has no category in IGDB's list, so a Switch game links nowhere and
   * the UI says so rather than guessing a URL.
   */
  externalCategory: number | null;
};

/**
 * Every platform family the app can present, keyed by our own id rather than
 * IGDB's.
 *
 * ## Why a family and not a platform
 *
 * IGDB publishes over two hundred platforms, and most of the distinctions are
 * not ones a player makes. "PlayStation 5" and "PlayStation 5 (Digital)" are the
 * same shelf; so are the six revisions of the Game Boy. A key here is the thing
 * somebody would *say* they played it on, and `PATTERNS` collapses IGDB's names
 * onto it.
 *
 * ## `externalCategory` is null unless it has been verified
 *
 * It resolves the "Open in <store>" link, and a wrong number silently sends
 * somebody to the wrong storefront. Only the ids already confirmed against the
 * live API carry a value; every platform added since is `null`, which renders no
 * store link at all rather than a guess. PRODUCT.md's second principle: when a
 * provider does not give us the fact, hide the feature.
 *
 * ## The icon set is Ionicons, so some of these are approximations
 *
 * Nintendo, Sega and Atari have no marks in the set, and borrowing another
 * vendor's logo would be worse than a generic one. They take a controller (or a
 * chip, for hardware old enough that "console" is the wrong word), and the
 * `label` carries the real name.
 */
export const PLATFORMS: Record<PlatformKey, PlatformMeta> = {
  ps5: {
    key: 'ps5',
    label: 'PlayStation 5',
    short: 'PS5',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: 'Open in PlayStation Store',
    externalCategory: 36,
  },
  xbox: {
    key: 'xbox',
    label: 'Xbox',
    short: 'XBOX',
    icon: 'logo-xbox',
    accent: '#5DD45D',
    storeLabel: 'Open in Microsoft Store',
    externalCategory: 11,
  },
  switch2: {
    key: 'switch2',
    label: 'Nintendo Switch 2',
    short: 'SWITCH 2',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: 'Open in Nintendo eShop',
    externalCategory: null,
  },
  switch: {
    key: 'switch',
    label: 'Nintendo Switch',
    short: 'SWITCH',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: 'Open in Nintendo eShop',
    externalCategory: null,
  },
  ps4: {
    key: 'ps4',
    label: 'PlayStation 4',
    short: 'PS4',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: 'Open in PlayStation Store',
    externalCategory: 36,
  },
  pc: {
    key: 'pc',
    label: 'PC',
    short: 'PC',
    icon: 'logo-steam',
    accent: '#9BA7B8',
    storeLabel: 'Open in Steam',
    externalCategory: 1,
  },
  ios: {
    key: 'ios',
    label: 'iOS',
    short: 'iOS',
    icon: 'logo-apple',
    accent: '#C9C9C9',
    storeLabel: 'Open in the App Store',
    externalCategory: 13,
  },
  android: {
    key: 'android',
    label: 'Android',
    short: 'ANDROID',
    icon: 'logo-google-playstore',
    accent: '#7BD88F',
    storeLabel: 'Open in Google Play',
    externalCategory: 15,
  },
  stadia: {
    key: 'stadia',
    label: 'Google Stadia',
    short: 'STADIA',
    icon: 'logo-google',
    accent: '#E86A5C',
    storeLabel: 'Open in Stadia',
    externalCategory: null,
  },
  luna: {
    key: 'luna',
    label: 'Amazon Luna',
    short: 'LUNA',
    icon: 'logo-amazon',
    accent: '#7B8CFF',
    storeLabel: 'Open in Amazon Luna',
    externalCategory: null,
  },
  ps3: {
    key: 'ps3',
    label: 'PlayStation 3',
    short: 'PS3',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: null,
    externalCategory: null,
  },
  ps2: {
    key: 'ps2',
    label: 'PlayStation 2',
    short: 'PS2',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: null,
    externalCategory: null,
  },
  ps1: {
    key: 'ps1',
    label: 'PlayStation',
    short: 'PS1',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: null,
    externalCategory: null,
  },
  psp: {
    key: 'psp',
    label: 'PlayStation Portable',
    short: 'PSP',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: null,
    externalCategory: null,
  },
  vita: {
    key: 'vita',
    label: 'PlayStation Vita',
    short: 'VITA',
    icon: 'logo-playstation',
    accent: '#4C8DFF',
    storeLabel: null,
    externalCategory: null,
  },
  xbox360: {
    key: 'xbox360',
    label: 'Xbox 360',
    short: 'X360',
    icon: 'logo-xbox',
    accent: '#5DD45D',
    storeLabel: null,
    externalCategory: null,
  },
  xboxOriginal: {
    key: 'xboxOriginal',
    label: 'Xbox',
    short: 'XBOX',
    icon: 'logo-xbox',
    accent: '#5DD45D',
    storeLabel: null,
    externalCategory: null,
  },
  wiiu: {
    key: 'wiiu',
    label: 'Wii U',
    short: 'WII U',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  wii: {
    key: 'wii',
    label: 'Wii',
    short: 'WII',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  gamecube: {
    key: 'gamecube',
    label: 'GameCube',
    short: 'GCN',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  n64: {
    key: 'n64',
    label: 'Nintendo 64',
    short: 'N64',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  snes: {
    key: 'snes',
    label: 'Super Nintendo',
    short: 'SNES',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  nes: {
    key: 'nes',
    label: 'NES',
    short: 'NES',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  threeds: {
    key: 'threeds',
    label: 'Nintendo 3DS',
    short: '3DS',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  ds: {
    key: 'ds',
    label: 'Nintendo DS',
    short: 'DS',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  gba: {
    key: 'gba',
    label: 'Game Boy Advance',
    short: 'GBA',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  gbc: {
    key: 'gbc',
    label: 'Game Boy Color',
    short: 'GBC',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  gameboy: {
    key: 'gameboy',
    label: 'Game Boy',
    short: 'GB',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  dreamcast: {
    key: 'dreamcast',
    label: 'Dreamcast',
    short: 'DC',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  saturn: {
    key: 'saturn',
    label: 'Sega Saturn',
    short: 'SATURN',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  genesis: {
    key: 'genesis',
    label: 'Sega Genesis',
    short: 'GENESIS',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  atari: {
    key: 'atari',
    label: 'Atari',
    short: 'ATARI',
    icon: 'hardware-chip',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  arcade: {
    key: 'arcade',
    label: 'Arcade',
    short: 'ARCADE',
    icon: 'hardware-chip',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  vr: {
    key: 'vr',
    label: 'VR',
    short: 'VR',
    icon: 'glasses',
    accent: '#B98CFF',
    storeLabel: null,
    externalCategory: null,
  },
  other: {
    key: 'other',
    label: 'Other',
    short: 'OTHER',
    icon: 'tv',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
};

export type CaseTemplate = {
  key: CasePlatformKey;
  /** Shown on the platform switcher chips. */
  label: string;
  /** Short form for the generated spine. */
  spineLabel: string;
  template: ImageSourcePropType;
  /** Pixel dimensions of `template`. `coverArea` is expressed in these units. */
  templateSize: { width: number; height: number };
  /** The transparent window, in template pixels. */
  coverArea: { x: number; y: number; width: number; height: number };
  /** Spine thickness in template pixels, scaled with the case. */
  spineWidth: number;
  spineColor: string;
  spineTextColor: string;
  /** Used for the switcher chip and any platform-tinted chrome. */
  accent: string;
};

/**
 * Every template PNG is authored at this size, so one ratio describes them all.
 *
 * Exported because a caller that lays out *around* a case has to know how tall
 * it will be before it renders — the masthead pulls the case up into the hero by
 * a fraction of its own height, and guessing that would break the moment the
 * artwork changed size.
 */
export const CASE_TEMPLATE_SIZE = { width: 540, height: 680 };

const TEMPLATE_SIZE = CASE_TEMPLATE_SIZE;

export const CASE_TEMPLATES: Record<CasePlatformKey, CaseTemplate> = {
  ps5: {
    key: 'ps5',
    label: 'PlayStation 5',
    spineLabel: 'PS5',
    template: require('@/assets/cases/ps5_case.png'),
    templateSize: TEMPLATE_SIZE,
    coverArea: { x: 16, y: 58, width: 508, height: 606 },
    spineWidth: 26,
    spineColor: '#0D47A1',
    spineTextColor: '#FFFFFF',
    accent: '#1565C0',
  },
  ps4: {
    key: 'ps4',
    label: 'PlayStation 4',
    spineLabel: 'PS4',
    template: require('@/assets/cases/ps4_case.png'),
    templateSize: TEMPLATE_SIZE,
    coverArea: { x: 16, y: 52, width: 508, height: 612 },
    spineWidth: 26,
    spineColor: '#0D47A1',
    spineTextColor: '#FFFFFF',
    accent: '#1565C0',
  },
  xbox: {
    key: 'xbox',
    label: 'Xbox',
    spineLabel: 'XBOX',
    template: require('@/assets/cases/xbox_case.png'),
    templateSize: TEMPLATE_SIZE,
    coverArea: { x: 14, y: 62, width: 512, height: 604 },
    spineWidth: 24,
    spineColor: '#107C10',
    spineTextColor: '#FFFFFF',
    accent: '#107C10',
  },
  switch: {
    key: 'switch',
    label: 'Nintendo Switch',
    spineLabel: 'SWITCH',
    template: require('@/assets/cases/switch_case.png'),
    templateSize: TEMPLATE_SIZE,
    coverArea: { x: 14, y: 46, width: 512, height: 620 },
    spineWidth: 22,
    spineColor: '#E60012',
    spineTextColor: '#FFFFFF',
    accent: '#E60012',
  },
};

/*
 * `assets/cases/pc_case.png` is deliberately unreferenced now. PC dropped its
 * case when the presentation split by platform — the file is kept rather than
 * deleted so that decision can be reversed without regenerating artwork.
 */

/** The optical disc overlay used by <GameDisc />. */
export const DISC_TEMPLATE = {
  template: require('@/assets/cases/disc.png') as ImageSourcePropType,
  size: 512,
  /** Artwork is masked to this circle, centred — matches the template's annulus. */
  artRadius: 248,
  /** Centre hole; artwork is punched out inside it by the template. */
  hubRadius: 78,
};

/**
 * Preference order when a game lists several platforms and the viewer has not
 * picked one.
 *
 * **PC leads, and it is the only entry here placed for a presentation reason
 * rather than a recency one.** Everything below it is current-gen-first, which
 * is the edition most people picture. PC is above all of it because it is the
 * one platform with no case: `assets/cases/pc_case.png` went unreferenced when
 * the presentation split by platform, so a PC selection renders the bare
 * portrait cover. That is the artwork a game page should open on wherever it
 * exists — the publisher's own box art, undressed — and defaulting to PS5 put a
 * plastic case in front of it on every multiplatform release.
 *
 * A console-exclusive is unaffected: `platformKeysFor` filters this list down to
 * what the game actually shipped on, so a Switch game still opens in its Switch
 * case.
 */
export const PLATFORM_PRIORITY: readonly PlatformKey[] = [
  'pc',
  'ps5',
  'xbox',
  'switch2',
  'switch',
  'ps4',
  'stadia',
  'luna',
  'ios',
  'android',
  'vr',
  'ps3',
  'xbox360',
  'wiiu',
  'threeds',
  'vita',
  'ps2',
  'psp',
  'xboxOriginal',
  'gamecube',
  'wii',
  'ds',
  'gba',
  'dreamcast',
  'ps1',
  'n64',
  'saturn',
  'snes',
  'genesis',
  'gbc',
  'gameboy',
  'nes',
  'arcade',
  'atari',
  'other',
];

/**
 * Substring patterns matched against the platform names our providers return.
 *
 * IGDB, RAWG and Steam all name platforms differently ("PC (Microsoft
 * Windows)", "Windows", "PlayStation 5", "PS5"), so matching is done on
 * lowercased substrings rather than exact values. Order matters: the more
 * specific pattern has to win, which is why "xbox series"/"xbox one" are tested
 * before a bare "xbox".
 */
const PATTERNS: readonly { match: readonly string[]; key: PlatformKey }[] = [
  /* ---- Longest and most specific first. Every entry below this line is only
     reachable because nothing above it matched, so an ordering mistake here is
     a silent misfiling rather than a type error. ---- */

  /* PlayStation. "playstation 5" before "playstation" or PS5 lands on PS1. */
  { match: ['playstation 5', 'ps5'], key: 'ps5' },
  { match: ['playstation 4', 'ps4'], key: 'ps4' },
  { match: ['playstation 3', 'ps3'], key: 'ps3' },
  { match: ['playstation 2', 'ps2'], key: 'ps2' },
  { match: ['playstation vr', 'psvr'], key: 'vr' },
  { match: ['playstation vita', 'ps vita'], key: 'vita' },
  { match: ['playstation portable', 'psp'], key: 'psp' },
  /* Last of the family: IGDB calls the original console simply "PlayStation". */
  { match: ['playstation'], key: 'ps1' },

  /* Xbox. The bare "xbox" is the *original* console, so it goes last here —
     the reverse of the mistake that would file a Series X as an OG Xbox. */
  { match: ['xbox series', 'xbox one', 'xbox cloud'], key: 'xbox' },
  { match: ['xbox 360'], key: 'xbox360' },
  { match: ['xbox'], key: 'xboxOriginal' },

  /* Nintendo. "switch 2" before "switch". */
  { match: ['switch 2'], key: 'switch2' },
  { match: ['switch'], key: 'switch' },
  { match: ['wii u'], key: 'wiiu' },
  { match: ['wii'], key: 'wii' },
  { match: ['new nintendo 3ds', 'nintendo 3ds', '3ds'], key: 'threeds' },
  { match: ['nintendo ds', 'nintendo dsi'], key: 'ds' },
  { match: ['game boy advance', 'gba'], key: 'gba' },
  { match: ['game boy color'], key: 'gbc' },
  { match: ['game boy'], key: 'gameboy' },
  { match: ['gamecube'], key: 'gamecube' },
  { match: ['nintendo 64', 'n64'], key: 'n64' },
  { match: ['super nintendo', 'super famicom', 'snes'], key: 'snes' },

  /* Sega — and this block *must* stay above the NES row below it.
     "Genesis" contains the substring "nes", so a bare `'nes'` pattern tested
     first files every Sega Mega Drive game as a Nintendo Entertainment System
     game. Caught by the substring sweep in the scratchpad, not by the compiler:
     both keys are valid `PlatformKey`s and nothing about it is a type error. */
  { match: ['dreamcast'], key: 'dreamcast' },
  { match: ['saturn'], key: 'saturn' },
  { match: ['mega drive', 'genesis', 'master system', 'game gear'], key: 'genesis' },

  /* Last of the Nintendo family, because `'nes'` is the loosest pattern in this
     table and will match inside any word containing it. */
  { match: ['family computer', 'famicom', 'nintendo entertainment system', 'nes'], key: 'nes' },

  /* Streaming. */
  { match: ['stadia'], key: 'stadia' },
  { match: ['luna'], key: 'luna' },

  /* Headsets. Checked before the desktop bucket, because IGDB names several of
     them with a platform they run on ("Oculus Rift", "SteamVR", "Meta Quest"). */
  {
    match: [
      'oculus',
      'meta quest',
      'steamvr',
      'vive',
      'windows mixed reality',
      'daydream',
      'gear vr',
    ],
    key: 'vr',
  },

  /* Apple and Google. Before the PC bucket, which would otherwise claim "mac"
     out of "macOS" and leave the phone platforms unmatched. */
  { match: ['ios', 'iphone', 'ipad', 'apple tv'], key: 'ios' },
  { match: ['android'], key: 'android' },

  /* Desktop. */
  { match: ['pc', 'windows', 'mac', 'linux', 'dos', 'steam'], key: 'pc' },

  /* Old and unusual. `atari` catches the whole family — 2600, 5200, 7800, ST,
     Lynx, Jaguar — because nobody distinguishes them on a shelf of modern
     games, and `arcade` covers Neo Geo and the cabinets. */
  { match: ['atari', 'lynx', 'jaguar'], key: 'atari' },
  { match: ['arcade', 'neo geo', 'mame'], key: 'arcade' },
];

/** Resolve one provider platform string to a case, or null if unrecognised. */
export function platformKeyFor(platform: string): PlatformKey | null {
  const value = platform.toLowerCase();
  for (const entry of PATTERNS) {
    if (entry.match.some((pattern) => value.includes(pattern))) return entry.key;
  }
  return null;
}

/**
 * Every platform a game can be presented as, deduped and in priority order.
 *
 * Returns `['pc']` for a game whose platforms we cannot parse at all, so a game
 * page always has something to render.
 *
 * Named for platforms rather than cases since the split: the list drives the
 * switcher, the price and the store link as well as the artwork, and only some
 * of its entries have a case at all.
 */
export function platformKeysFor(platforms: string[] | null | undefined): PlatformKey[] {
  const found = new Set<PlatformKey>();
  let sawUnknown = false;

  for (const platform of platforms ?? []) {
    const key = platformKeyFor(platform);
    if (key) found.add(key);
    else if (platform.trim()) sawUnknown = true;
  }

  /* An unmatched name becomes `other` rather than disappearing. IGDB lists
     platforms this app has never heard of — a Sharp X1, a Philips CD-i — and
     silently dropping them made the switcher claim a game was PC-only when it
     was not. `other` is honest: it says "released somewhere else too" and shows
     the bare cover, which is what every caseless platform shows anyway. */
  if (sawUnknown) found.add('other');
  if (found.size === 0) return ['pc'];
  return PLATFORM_PRIORITY.filter((key) => found.has(key));
}
