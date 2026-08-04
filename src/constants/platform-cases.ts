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

export type PlatformKey = 'ps5' | 'ps4' | 'xbox' | 'switch' | 'pc' | 'ios' | 'android';

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
    | 'game-controller';
  accent: string;
  /** What the "open the store" line says for this platform. */
  storeLabel: string;
  /**
   * IGDB `external_games.category`, used to resolve the store link.
   *
   * Null where IGDB publishes no store entry for the platform — Nintendo's
   * eShop has no category in IGDB's list, so a Switch game links nowhere and
   * the UI says so rather than guessing a URL.
   */
  externalCategory: number | null;
};

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
  ps4: {
    key: 'ps4',
    label: 'PlayStation 4',
    short: 'PS4',
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
  switch: {
    key: 'switch',
    label: 'Nintendo Switch',
    short: 'SWITCH',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: 'Open in Nintendo eShop',
    externalCategory: null,
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
 * picked one. Current-gen first — that is the edition most people picture.
 */
export const PLATFORM_PRIORITY: readonly PlatformKey[] = [
  'ps5',
  'xbox',
  'switch',
  'ps4',
  'pc',
  'ios',
  'android',
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
  { match: ['playstation 5', 'ps5'], key: 'ps5' },
  { match: ['playstation 4', 'ps4'], key: 'ps4' },
  { match: ['xbox series', 'xbox one', 'xbox'], key: 'xbox' },
  { match: ['switch'], key: 'switch' },
  // Before 'mac': IGDB calls the iPhone platform "iOS", and 'mac' would not
  // match that anyway — but 'ios' must be tested before the PC bucket claims
  // anything Apple-shaped.
  { match: ['ios', 'iphone', 'ipad'], key: 'ios' },
  { match: ['android'], key: 'android' },
  { match: ['pc', 'windows', 'mac', 'linux'], key: 'pc' },
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
  for (const platform of platforms ?? []) {
    const key = platformKeyFor(platform);
    if (key) found.add(key);
  }
  if (found.size === 0) return ['pc'];
  return PLATFORM_PRIORITY.filter((key) => found.has(key));
}
