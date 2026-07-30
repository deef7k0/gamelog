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

export type PlatformKey = 'ps5' | 'ps4' | 'xbox' | 'switch' | 'pc';

export type CaseTemplate = {
  key: PlatformKey;
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

const TEMPLATE_SIZE = { width: 540, height: 680 };

export const CASE_TEMPLATES: Record<PlatformKey, CaseTemplate> = {
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
  pc: {
    key: 'pc',
    label: 'PC',
    spineLabel: 'PC',
    template: require('@/assets/cases/pc_case.png'),
    templateSize: TEMPLATE_SIZE,
    coverArea: { x: 14, y: 54, width: 512, height: 612 },
    spineWidth: 22,
    spineColor: '#2B2B2B',
    spineTextColor: '#FFFFFF',
    accent: '#4A4A4A',
  },
};

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
export const PLATFORM_PRIORITY: readonly PlatformKey[] = ['ps5', 'xbox', 'switch', 'ps4', 'pc'];

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
 * Every case a game can be shown in, deduped and in priority order.
 *
 * Returns `['pc']` for a game whose platforms we cannot parse at all, so a game
 * page always has something to render rather than falling back to a bare cover.
 */
export function caseKeysFor(platforms: string[] | null | undefined): PlatformKey[] {
  const found = new Set<PlatformKey>();
  for (const platform of platforms ?? []) {
    const key = platformKeyFor(platform);
    if (key) found.add(key);
  }
  if (found.size === 0) return ['pc'];
  return PLATFORM_PRIORITY.filter((key) => found.has(key));
}
