import type { ImageSourcePropType } from 'react-native';

/**
 * Physical case templates, one per platform family.
 *
 * A template is a PNG of the case's front face: opaque chrome (border, top
 * band, branding) with the cover window punched out as transparent pixels. The
 * artwork is drawn *beneath* the template and shows through that window, which
 * is why `coverArea` is never hardcoded in the component — it comes from here.
 *
 * REPLACING OR ADDING ARTWORK
 * ---------------------------
 * The files in assets/cases/ are the owner's templates. Swap one, or add a
 * platform's, freely; the contract is:
 *
 *   - keep `templateSize` accurate for the file — its real pixel dimensions
 *   - keep `coverArea` describing the transparent window, in template pixels
 *   - keep the window genuinely transparent (alpha 0), not white
 *
 * Nothing in <GameCase /> needs to change when you do: every face is drawn at
 * its own template's proportions.
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
  | 'virtualboy'
  | 'pokemonmini'
  /* Sega. */
  | 'dreamcast'
  | 'saturn'
  | 'genesis'
  | 'segacd'
  | 'sega32x'
  | 'mastersystem'
  | 'gamegear'
  | 'sg1000'
  /* Atari. `atari` is the rest of the family — the ST, the 8-bit computers. */
  | 'atari2600'
  | 'atari5200'
  | 'atari7800'
  | 'jaguar'
  | 'jaguarcd'
  | 'lynx'
  | 'atari'
  /* The other consoles and handhelds with a box of their own. */
  | 'neogeo'
  | 'ngp'
  | 'ngpc'
  | 'pcengine'
  | 'pcfx'
  | 'threedo'
  | 'wonderswan'
  | 'wonderswancolor'
  | 'colecovision'
  | 'intellivision'
  | 'vectrex'
  | 'odyssey2'
  | 'arcadia'
  | 'vc4000'
  | 'supervision'
  | 'megaduck'
  | 'arduboy'
  /* Home computers. */
  | 'c64'
  | 'amstradcpc'
  | 'apple2'
  /* Everything genuinely unusual. */
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
 *
 * A platform has a case here once its artwork is in `assets/cases/` — the
 * owner's templates, one file each (`<key>_case.png`). Most are the front
 * covers of the owner's pack, a folder per console beside them; see
 * `assets/cases/README.md` for which file each one was. Four are the owner's
 * own instead — PS4, Switch 2, Wii U and 3DS, shells drawn with their plastic.
 * The ones without (the original Xbox, PC by decision) show the bare cover;
 * nothing is drawn in another console's box.
 */
export type CasePlatformKey =
  | 'ps5'
  | 'ps4'
  | 'ps3'
  | 'ps2'
  | 'ps1'
  | 'psp'
  | 'vita'
  | 'xbox'
  | 'xbox360'
  | 'switch2'
  | 'switch'
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
  | 'virtualboy'
  | 'pokemonmini'
  | 'dreamcast'
  | 'saturn'
  | 'genesis'
  | 'segacd'
  | 'sega32x'
  | 'mastersystem'
  | 'gamegear'
  | 'sg1000'
  | 'atari2600'
  | 'atari5200'
  | 'atari7800'
  | 'jaguar'
  | 'jaguarcd'
  | 'lynx'
  | 'neogeo'
  | 'ngp'
  | 'ngpc'
  | 'pcengine'
  | 'pcfx'
  | 'threedo'
  | 'wonderswan'
  | 'wonderswancolor'
  | 'colecovision'
  | 'intellivision'
  | 'vectrex'
  | 'odyssey2'
  | 'arcadia'
  | 'vc4000'
  | 'supervision'
  | 'megaduck'
  | 'arduboy'
  | 'c64'
  | 'amstradcpc'
  | 'apple2';

export const CASE_PLATFORMS: readonly CasePlatformKey[] = [
  'ps5',
  'ps4',
  'ps3',
  'ps2',
  'ps1',
  'psp',
  'vita',
  'xbox',
  'xbox360',
  'switch2',
  'switch',
  'wiiu',
  'wii',
  'gamecube',
  'n64',
  'snes',
  'nes',
  'threeds',
  'ds',
  'gba',
  'gbc',
  'gameboy',
  'virtualboy',
  'pokemonmini',
  'dreamcast',
  'saturn',
  'genesis',
  'segacd',
  'sega32x',
  'mastersystem',
  'gamegear',
  'sg1000',
  'atari2600',
  'atari5200',
  'atari7800',
  'jaguar',
  'jaguarcd',
  'lynx',
  'neogeo',
  'ngp',
  'ngpc',
  'pcengine',
  'pcfx',
  'threedo',
  'wonderswan',
  'wonderswancolor',
  'colecovision',
  'intellivision',
  'vectrex',
  'odyssey2',
  'arcadia',
  'vc4000',
  'supervision',
  'megaduck',
  'arduboy',
  'c64',
  'amstradcpc',
  'apple2',
];

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
  /* The machines below this line are each their own platform for one reason:
     each has a box of its own in `assets/cases/`, and a game drawn in another
     console's box is in the wrong one. Before the owner's pack arrived most of
     them were folded into a neighbour — every Sega cartridge was `genesis`,
     every Atari but the 2600 was `atari`, the PC Engine was a PC. None has a
     store to open. */
  virtualboy: {
    key: 'virtualboy',
    label: 'Virtual Boy',
    short: 'VB',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  pokemonmini: {
    key: 'pokemonmini',
    label: 'Pokémon mini',
    short: 'PM',
    icon: 'game-controller',
    accent: '#FF6B6B',
    storeLabel: null,
    externalCategory: null,
  },
  segacd: {
    key: 'segacd',
    label: 'Sega CD',
    short: 'SEGA CD',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  sega32x: {
    key: 'sega32x',
    label: 'Sega 32X',
    short: '32X',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  mastersystem: {
    key: 'mastersystem',
    label: 'Master System',
    short: 'SMS',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  gamegear: {
    key: 'gamegear',
    label: 'Game Gear',
    short: 'GG',
    icon: 'game-controller',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  sg1000: {
    key: 'sg1000',
    label: 'SG-1000',
    short: 'SG-1000',
    icon: 'hardware-chip',
    accent: '#6BA4FF',
    storeLabel: null,
    externalCategory: null,
  },
  atari5200: {
    key: 'atari5200',
    label: 'Atari 5200',
    short: '5200',
    icon: 'hardware-chip',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  atari7800: {
    key: 'atari7800',
    label: 'Atari 7800',
    short: '7800',
    icon: 'hardware-chip',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  jaguar: {
    key: 'jaguar',
    label: 'Atari Jaguar',
    short: 'JAGUAR',
    icon: 'game-controller',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  jaguarcd: {
    key: 'jaguarcd',
    label: 'Atari Jaguar CD',
    short: 'JAG CD',
    icon: 'game-controller',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  lynx: {
    key: 'lynx',
    label: 'Atari Lynx',
    short: 'LYNX',
    icon: 'game-controller',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  neogeo: {
    key: 'neogeo',
    label: 'Neo Geo',
    short: 'NEO GEO',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  ngp: {
    key: 'ngp',
    label: 'Neo Geo Pocket',
    short: 'NGP',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  ngpc: {
    key: 'ngpc',
    label: 'Neo Geo Pocket Color',
    short: 'NGPC',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  pcengine: {
    key: 'pcengine',
    label: 'TurboGrafx-16',
    short: 'TG-16',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  pcfx: {
    key: 'pcfx',
    label: 'PC-FX',
    short: 'PC-FX',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  threedo: {
    key: 'threedo',
    label: '3DO',
    short: '3DO',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  wonderswan: {
    key: 'wonderswan',
    label: 'WonderSwan',
    short: 'WS',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  wonderswancolor: {
    key: 'wonderswancolor',
    label: 'WonderSwan Color',
    short: 'WSC',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  colecovision: {
    key: 'colecovision',
    label: 'ColecoVision',
    short: 'COLECO',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  intellivision: {
    key: 'intellivision',
    label: 'Intellivision',
    short: 'INTV',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  vectrex: {
    key: 'vectrex',
    label: 'Vectrex',
    short: 'VECTREX',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  odyssey2: {
    key: 'odyssey2',
    label: 'Odyssey 2',
    short: 'ODYSSEY 2',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  arcadia: {
    key: 'arcadia',
    label: 'Arcadia 2001',
    short: 'ARCADIA',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  vc4000: {
    key: 'vc4000',
    label: 'VC 4000',
    short: 'VC 4000',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  supervision: {
    key: 'supervision',
    label: 'Supervision',
    short: 'SUPERVISION',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  megaduck: {
    key: 'megaduck',
    label: 'Mega Duck',
    short: 'MEGA DUCK',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  arduboy: {
    key: 'arduboy',
    label: 'Arduboy',
    short: 'ARDUBOY',
    icon: 'game-controller',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  c64: {
    key: 'c64',
    label: 'Commodore 64',
    short: 'C64',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  amstradcpc: {
    key: 'amstradcpc',
    label: 'Amstrad CPC',
    short: 'CPC',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  apple2: {
    key: 'apple2',
    label: 'Apple II',
    short: 'APPLE II',
    icon: 'hardware-chip',
    accent: '#9BA7B8',
    storeLabel: null,
    externalCategory: null,
  },
  atari2600: {
    key: 'atari2600',
    label: 'Atari 2600',
    short: '2600',
    icon: 'hardware-chip',
    accent: '#E0A458',
    storeLabel: null,
    externalCategory: null,
  },
  /* The rest of the family — the ST, the 8-bit computers — which has no box. */
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
 * The standard case face — the proportion of a modern keep case, 135×170mm.
 *
 * **Not the size of every template.** Each entry below carries its own
 * `templateSize`, the real dimensions of its PNG, because the boxes are not one
 * shape: a Switch 2 case is tall, a 3DS case nearly square, a SNES box and a
 * Game Boy Advance cartridge lie on their side. `caseHeightFor(width, platform)`
 * in `<GameCase>` is how a caller asks how tall one platform's case will be.
 *
 * This is what that function answers with when it is given no platform — the
 * masthead uses it to pull the cover up into the hero by a fraction of a case's
 * height, whichever game it is.
 */
export const CASE_TEMPLATE_SIZE = { width: 540, height: 680 };

/*
 * Every `templateSize` and `coverArea` below is measured from its file, not
 * estimated, by `scripts/case-templates.mjs`: the size is the PNG's own, and
 * the window is the bounding box of everything in it the cover has to be
 * behind — its see-through regions (a clear window, the inside of a
 * translucent shell) and any shading that fades into them — widened by
 * 2px wherever there is chrome for the cover to slide under (so a rounding
 * seam can never show the page through the edge of a window) and never past
 * the image. A window need not be a rectangle — the NES box's is slanted, the
 * Wii's runs under a curved band, a Jaguar box has two — because the cover is
 * drawn *beneath* the template and the template's own pixels do the cutting.
 * Run the script after replacing a file; it says which entry no longer agrees.
 *
 * `spineColor` is the band across the head of the case's back (`<GameCaseBack>`
 * prints white type on it, so it is never a light colour); nothing draws a
 * spine.
 */
export const CASE_TEMPLATES: Record<CasePlatformKey, CaseTemplate> = {
  ps5: {
    key: 'ps5',
    label: 'PlayStation 5',
    spineLabel: 'PS5',
    template: require('@/assets/cases/ps5_case.png'),
    templateSize: { width: 549, height: 688 },
    coverArea: { x: 0, y: 78, width: 549, height: 610 },
    spineWidth: 26,
    spineColor: '#0D47A1',
    spineTextColor: '#FFFFFF',
    accent: '#1565C0',
  },
  /* A translucent shell: the cover shows through the plastic, and the window
     is the inside of it — from the shell's left edge to the hinge band, from
     under the header to the bottom lip. It was the whole image for a while,
     when the file had clear space round the shell, and the cover showed past
     the case on every side; the owner re-cut the file to the shell. */
  ps4: {
    key: 'ps4',
    label: 'PlayStation 4',
    spineLabel: 'PS4',
    template: require('@/assets/cases/ps4_case.png'),
    templateSize: { width: 476, height: 671 },
    coverArea: { x: 0, y: 9, width: 467, height: 654 },
    spineWidth: 26,
    spineColor: '#0D47A1',
    spineTextColor: '#FFFFFF',
    accent: '#1565C0',
  },
  ps3: {
    key: 'ps3',
    label: 'PlayStation 3',
    spineLabel: 'PS3',
    template: require('@/assets/cases/ps3_case.png'),
    templateSize: { width: 571, height: 659 },
    coverArea: { x: 0, y: 67, width: 571, height: 592 },
    spineWidth: 26,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  ps2: {
    key: 'ps2',
    label: 'PlayStation 2',
    spineLabel: 'PS2',
    template: require('@/assets/cases/ps2_case.png'),
    templateSize: { width: 486, height: 680 },
    coverArea: { x: 0, y: 70, width: 486, height: 610 },
    spineWidth: 26,
    spineColor: '#00308F',
    spineTextColor: '#FFFFFF',
    accent: '#00308F',
  },
  /* A jewel case: the ridged hinge down the left is the template, the cover is
     everything to its right. */
  ps1: {
    key: 'ps1',
    label: 'PlayStation',
    spineLabel: 'PS1',
    template: require('@/assets/cases/ps1_case.png'),
    templateSize: { width: 792, height: 680 },
    coverArea: { x: 181, y: 0, width: 611, height: 680 },
    spineWidth: 26,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  psp: {
    key: 'psp',
    label: 'PlayStation Portable',
    spineLabel: 'PSP',
    template: require('@/assets/cases/psp_case.png'),
    templateSize: { width: 397, height: 680 },
    coverArea: { x: 0, y: 34, width: 397, height: 646 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  vita: {
    key: 'vita',
    label: 'PlayStation Vita',
    spineLabel: 'VITA',
    template: require('@/assets/cases/vita_case.png'),
    templateSize: { width: 534, height: 680 },
    coverArea: { x: 0, y: 53, width: 534, height: 627 },
    spineWidth: 22,
    spineColor: '#0B4EA2',
    spineTextColor: '#FFFFFF',
    accent: '#0B4EA2',
  },
  /* Xbox One's box, for the family that is Series X|S, One and cloud: there is
     no Series template, and most of that family's games shipped in this one. */
  xbox: {
    key: 'xbox',
    label: 'Xbox',
    spineLabel: 'XBOX',
    template: require('@/assets/cases/xone_case.png'),
    templateSize: { width: 516, height: 730 },
    coverArea: { x: 0, y: 88, width: 516, height: 642 },
    spineWidth: 24,
    spineColor: '#107C10',
    spineTextColor: '#FFFFFF',
    accent: '#107C10',
  },
  /* `xbox_case.png` is the 360's artwork, whatever its name says — it was the
     `xbox` entry's file until the Xbox One template arrived. */
  xbox360: {
    key: 'xbox360',
    label: 'Xbox 360',
    spineLabel: 'X360',
    template: require('@/assets/cases/xbox_case.png'),
    templateSize: { width: 610, height: 870 },
    coverArea: { x: 0, y: 104, width: 610, height: 766 },
    spineWidth: 24,
    spineColor: '#107C10',
    spineTextColor: '#FFFFFF',
    accent: '#107C10',
  },
  switch2: {
    key: 'switch2',
    label: 'Nintendo Switch 2',
    spineLabel: 'SWITCH 2',
    template: require('@/assets/cases/switch2_case.png'),
    templateSize: { width: 388, height: 636 },
    coverArea: { x: 0, y: 91, width: 372, height: 532 },
    spineWidth: 22,
    spineColor: '#E60012',
    spineTextColor: '#FFFFFF',
    accent: '#E60012',
  },
  /* The whole face is cover: the red corner mark and the rating are printed
     over it. */
  switch: {
    key: 'switch',
    label: 'Nintendo Switch',
    spineLabel: 'SWITCH',
    template: require('@/assets/cases/switch_case.png'),
    templateSize: { width: 421, height: 680 },
    coverArea: { x: 0, y: 0, width: 421, height: 680 },
    spineWidth: 22,
    spineColor: '#E60012',
    spineTextColor: '#FFFFFF',
    accent: '#E60012',
  },
  wiiu: {
    key: 'wiiu',
    label: 'Wii U',
    spineLabel: 'WII U',
    template: require('@/assets/cases/wiiu_case.png'),
    templateSize: { width: 523, height: 732 },
    coverArea: { x: 0, y: 0, width: 510, height: 732 },
    spineWidth: 24,
    spineColor: '#007FAE',
    spineTextColor: '#FFFFFF',
    accent: '#007FAE',
  },
  /* The Wii's own band is white; `spineColor` is its logo's grey, deep enough
     to carry the back's white type. */
  wii: {
    key: 'wii',
    label: 'Wii',
    spineLabel: 'WII',
    template: require('@/assets/cases/wii_case.png'),
    templateSize: { width: 486, height: 680 },
    coverArea: { x: 0, y: 16, width: 486, height: 664 },
    spineWidth: 24,
    spineColor: '#6E7176',
    spineTextColor: '#FFFFFF',
    accent: '#6E7176',
  },
  gamecube: {
    key: 'gamecube',
    label: 'GameCube',
    spineLabel: 'GCN',
    template: require('@/assets/cases/gamecube_case.png'),
    templateSize: { width: 486, height: 680 },
    coverArea: { x: 0, y: 43, width: 486, height: 637 },
    spineWidth: 24,
    spineColor: '#4B4391',
    spineTextColor: '#FFFFFF',
    accent: '#4B4391',
  },
  /* A box on its side. The strip down the right is drawn a shade short of
     opaque; it is chrome, and the cover stops under its edge. */
  n64: {
    key: 'n64',
    label: 'Nintendo 64',
    spineLabel: 'N64',
    template: require('@/assets/cases/n64_case.png'),
    templateSize: { width: 680, height: 497 },
    coverArea: { x: 0, y: 0, width: 558, height: 497 },
    spineWidth: 22,
    spineColor: '#C4161C',
    spineTextColor: '#FFFFFF',
    accent: '#C4161C',
  },
  snes: {
    key: 'snes',
    label: 'Super Nintendo',
    spineLabel: 'SNES',
    template: require('@/assets/cases/snes_case.png'),
    templateSize: { width: 680, height: 497 },
    coverArea: { x: 0, y: 21, width: 562, height: 398 },
    spineWidth: 22,
    spineColor: '#C8102E',
    spineTextColor: '#FFFFFF',
    accent: '#C8102E',
  },
  /* The black box: its window is slanted, and the template's own pixels cut
     the cover to it. */
  nes: {
    key: 'nes',
    label: 'NES',
    spineLabel: 'NES',
    template: require('@/assets/cases/nes_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 49, y: 47, width: 401, height: 342 },
    spineWidth: 22,
    spineColor: '#C4161C',
    spineTextColor: '#FFFFFF',
    accent: '#C4161C',
  },
  threeds: {
    key: 'threeds',
    label: 'Nintendo 3DS',
    spineLabel: '3DS',
    template: require('@/assets/cases/3ds_case.png'),
    templateSize: { width: 572, height: 523 },
    coverArea: { x: 2, y: 13, width: 498, height: 497 },
    spineWidth: 22,
    spineColor: '#CE181E',
    spineTextColor: '#FFFFFF',
    accent: '#CE181E',
  },
  ds: {
    key: 'ds',
    label: 'Nintendo DS',
    spineLabel: 'DS',
    template: require('@/assets/cases/ds_case.png'),
    templateSize: { width: 514, height: 458 },
    coverArea: { x: 70, y: 0, width: 444, height: 458 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  /* The three Game Boys are a box with its banner down the left; the cover is
     everything to the banner's right, edge to edge. */
  gba: {
    key: 'gba',
    label: 'Game Boy Advance',
    spineLabel: 'GBA',
    template: require('@/assets/cases/gba_case.png'),
    templateSize: { width: 700, height: 700 },
    coverArea: { x: 144, y: 0, width: 556, height: 700 },
    spineWidth: 22,
    spineColor: '#3F3A96',
    spineTextColor: '#FFFFFF',
    accent: '#3F3A96',
  },
  gbc: {
    key: 'gbc',
    label: 'Game Boy Color',
    spineLabel: 'GBC',
    template: require('@/assets/cases/gbc_case.png'),
    templateSize: { width: 700, height: 700 },
    coverArea: { x: 144, y: 0, width: 556, height: 700 },
    spineWidth: 22,
    spineColor: '#6A2C91',
    spineTextColor: '#FFFFFF',
    accent: '#6A2C91',
  },
  gameboy: {
    key: 'gameboy',
    label: 'Game Boy',
    spineLabel: 'GB',
    template: require('@/assets/cases/gameboy_case.png'),
    templateSize: { width: 700, height: 700 },
    coverArea: { x: 144, y: 0, width: 556, height: 700 },
    spineWidth: 22,
    spineColor: '#2B3287',
    spineTextColor: '#FFFFFF',
    accent: '#2B3287',
  },
  virtualboy: {
    key: 'virtualboy',
    label: 'Virtual Boy',
    spineLabel: 'VB',
    template: require('@/assets/cases/virtualboy_case.png'),
    templateSize: { width: 513, height: 458 },
    coverArea: { x: 0, y: 26, width: 513, height: 320 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  pokemonmini: {
    key: 'pokemonmini',
    label: 'Pokémon mini',
    spineLabel: 'PM',
    template: require('@/assets/cases/pokemonmini_case.png'),
    templateSize: { width: 700, height: 700 },
    coverArea: { x: 0, y: 116, width: 700, height: 584 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  dreamcast: {
    key: 'dreamcast',
    label: 'Dreamcast',
    spineLabel: 'DC',
    template: require('@/assets/cases/dreamcast_case.png'),
    templateSize: { width: 680, height: 680 },
    coverArea: { x: 84, y: 0, width: 596, height: 680 },
    spineWidth: 22,
    spineColor: '#C2500F',
    spineTextColor: '#FFFFFF',
    accent: '#C2500F',
  },
  saturn: {
    key: 'saturn',
    label: 'Sega Saturn',
    spineLabel: 'SATURN',
    template: require('@/assets/cases/saturn_case.png'),
    templateSize: { width: 441, height: 680 },
    coverArea: { x: 80, y: 0, width: 361, height: 680 },
    spineWidth: 22,
    spineColor: '#33337A',
    spineTextColor: '#FFFFFF',
    accent: '#33337A',
  },
  genesis: {
    key: 'genesis',
    label: 'Sega Genesis',
    spineLabel: 'GENESIS',
    template: require('@/assets/cases/genesis_case.png'),
    templateSize: { width: 484, height: 680 },
    coverArea: { x: 93, y: 0, width: 391, height: 589 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  segacd: {
    key: 'segacd',
    label: 'Sega CD',
    spineLabel: 'SEGA CD',
    template: require('@/assets/cases/segacd_case.png'),
    templateSize: { width: 481, height: 680 },
    coverArea: { x: 78, y: 0, width: 403, height: 627 },
    spineWidth: 22,
    spineColor: '#1F5FBF',
    spineTextColor: '#FFFFFF',
    accent: '#1F5FBF',
  },
  sega32x: {
    key: 'sega32x',
    label: 'Sega 32X',
    spineLabel: '32X',
    template: require('@/assets/cases/sega32x_case.png'),
    templateSize: { width: 484, height: 680 },
    coverArea: { x: 92, y: 0, width: 392, height: 680 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  mastersystem: {
    key: 'mastersystem',
    label: 'Master System',
    spineLabel: 'SMS',
    template: require('@/assets/cases/mastersystem_case.png'),
    templateSize: { width: 484, height: 680 },
    coverArea: { x: 41, y: 134, width: 403, height: 467 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  gamegear: {
    key: 'gamegear',
    label: 'Game Gear',
    spineLabel: 'GG',
    template: require('@/assets/cases/gamegear_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 88, y: 0, width: 408, height: 615 },
    spineWidth: 22,
    spineColor: '#8E1B5E',
    spineTextColor: '#FFFFFF',
    accent: '#8E1B5E',
  },
  sg1000: {
    key: 'sg1000',
    label: 'SG-1000',
    spineLabel: 'SG-1000',
    template: require('@/assets/cases/sg1000_case.png'),
    templateSize: { width: 492, height: 680 },
    coverArea: { x: 70, y: 136, width: 350, height: 453 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  atari2600: {
    key: 'atari2600',
    label: 'Atari 2600',
    spineLabel: '2600',
    template: require('@/assets/cases/atari2600_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 28, y: 314, width: 441, height: 328 },
    spineWidth: 22,
    spineColor: '#D40000',
    spineTextColor: '#FFFFFF',
    accent: '#D40000',
  },
  atari5200: {
    key: 'atari5200',
    label: 'Atari 5200',
    spineLabel: '5200',
    template: require('@/assets/cases/atari5200_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 41, y: 315, width: 414, height: 326 },
    spineWidth: 22,
    spineColor: '#0B5CAD',
    spineTextColor: '#FFFFFF',
    accent: '#0B5CAD',
  },
  atari7800: {
    key: 'atari7800',
    label: 'Atari 7800',
    spineLabel: '7800',
    template: require('@/assets/cases/atari7800_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 41, y: 166, width: 415, height: 429 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  /* Two windows — the cover, and the notch at the foot of the black band — and
     one cover behind both. */
  jaguar: {
    key: 'jaguar',
    label: 'Atari Jaguar',
    spineLabel: 'JAGUAR',
    template: require('@/assets/cases/jaguar_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 40, y: 0, width: 456, height: 635 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  jaguarcd: {
    key: 'jaguarcd',
    label: 'Atari Jaguar CD',
    spineLabel: 'JAG CD',
    template: require('@/assets/cases/jaguarcd_case.png'),
    templateSize: { width: 486, height: 680 },
    coverArea: { x: 0, y: 0, width: 486, height: 637 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  lynx: {
    key: 'lynx',
    label: 'Atari Lynx',
    spineLabel: 'LYNX',
    template: require('@/assets/cases/lynx_case.png'),
    templateSize: { width: 554, height: 680 },
    coverArea: { x: 29, y: 22, width: 495, height: 560 },
    spineWidth: 22,
    spineColor: '#A31515',
    spineTextColor: '#FFFFFF',
    accent: '#A31515',
  },
  neogeo: {
    key: 'neogeo',
    label: 'Neo Geo',
    spineLabel: 'NEO GEO',
    template: require('@/assets/cases/neogeo_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 0, y: 0, width: 496, height: 680 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  ngp: {
    key: 'ngp',
    label: 'Neo Geo Pocket',
    spineLabel: 'NGP',
    template: require('@/assets/cases/ngp_case.png'),
    templateSize: { width: 510, height: 458 },
    coverArea: { x: 0, y: 0, width: 510, height: 417 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  ngpc: {
    key: 'ngpc',
    label: 'Neo Geo Pocket Color',
    spineLabel: 'NGPC',
    template: require('@/assets/cases/ngpc_case.png'),
    templateSize: { width: 599, height: 700 },
    coverArea: { x: 0, y: 0, width: 599, height: 644 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  pcengine: {
    key: 'pcengine',
    label: 'TurboGrafx-16',
    spineLabel: 'TG-16',
    template: require('@/assets/cases/pcengine_case.png'),
    templateSize: { width: 517, height: 680 },
    coverArea: { x: 46, y: 131, width: 400, height: 399 },
    spineWidth: 22,
    spineColor: '#C2410C',
    spineTextColor: '#FFFFFF',
    accent: '#C2410C',
  },
  pcfx: {
    key: 'pcfx',
    label: 'PC-FX',
    spineLabel: 'PC-FX',
    template: require('@/assets/cases/pcfx_case.png'),
    templateSize: { width: 680, height: 680 },
    coverArea: { x: 0, y: 0, width: 680, height: 680 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  threedo: {
    key: 'threedo',
    label: '3DO',
    spineLabel: '3DO',
    template: require('@/assets/cases/threedo_case.png'),
    templateSize: { width: 370, height: 700 },
    coverArea: { x: 0, y: 29, width: 370, height: 671 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  wonderswan: {
    key: 'wonderswan',
    label: 'WonderSwan',
    spineLabel: 'WS',
    template: require('@/assets/cases/wonderswan_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 0, y: 25, width: 497, height: 655 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  wonderswancolor: {
    key: 'wonderswancolor',
    label: 'WonderSwan Color',
    spineLabel: 'WSC',
    template: require('@/assets/cases/wonderswancolor_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 0, y: 94, width: 497, height: 586 },
    spineWidth: 22,
    spineColor: '#B5121B',
    spineTextColor: '#FFFFFF',
    accent: '#B5121B',
  },
  colecovision: {
    key: 'colecovision',
    label: 'ColecoVision',
    spineLabel: 'COLECO',
    template: require('@/assets/cases/colecovision_case.png'),
    templateSize: { width: 498, height: 680 },
    coverArea: { x: 28, y: 89, width: 444, height: 393 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  intellivision: {
    key: 'intellivision',
    label: 'Intellivision',
    spineLabel: 'INTV',
    template: require('@/assets/cases/intellivision_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 41, y: 187, width: 415, height: 397 },
    spineWidth: 22,
    spineColor: '#1E2A9A',
    spineTextColor: '#FFFFFF',
    accent: '#1E2A9A',
  },
  vectrex: {
    key: 'vectrex',
    label: 'Vectrex',
    spineLabel: 'VECTREX',
    template: require('@/assets/cases/vectrex_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 121, y: 268, width: 253, height: 348 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
  odyssey2: {
    key: 'odyssey2',
    label: 'Odyssey 2',
    spineLabel: 'ODYSSEY 2',
    template: require('@/assets/cases/odyssey2_case.png'),
    templateSize: { width: 495, height: 680 },
    coverArea: { x: 0, y: 0, width: 495, height: 680 },
    spineWidth: 22,
    spineColor: '#B8500F',
    spineTextColor: '#FFFFFF',
    accent: '#B8500F',
  },
  arcadia: {
    key: 'arcadia',
    label: 'Arcadia 2001',
    spineLabel: 'ARCADIA',
    template: require('@/assets/cases/arcadia_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 32, y: 212, width: 432, height: 432 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  /* The window fades in under the black of its header; the cover starts where
     the fade does. */
  vc4000: {
    key: 'vc4000',
    label: 'VC 4000',
    spineLabel: 'VC 4000',
    template: require('@/assets/cases/vc4000_case.png'),
    templateSize: { width: 514, height: 680 },
    coverArea: { x: 0, y: 228, width: 514, height: 452 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  supervision: {
    key: 'supervision',
    label: 'Supervision',
    spineLabel: 'SUPERVISION',
    template: require('@/assets/cases/supervision_case.png'),
    templateSize: { width: 535, height: 700 },
    coverArea: { x: 64, y: 249, width: 402, height: 350 },
    spineWidth: 22,
    spineColor: '#1F8A7A',
    spineTextColor: '#FFFFFF',
    accent: '#1F8A7A',
  },
  megaduck: {
    key: 'megaduck',
    label: 'Mega Duck',
    spineLabel: 'MEGA DUCK',
    template: require('@/assets/cases/megaduck_case.png'),
    templateSize: { width: 680, height: 533 },
    coverArea: { x: 146, y: 0, width: 534, height: 533 },
    spineWidth: 22,
    spineColor: '#1F7A5C',
    spineTextColor: '#FFFFFF',
    accent: '#1F7A5C',
  },
  arduboy: {
    key: 'arduboy',
    label: 'Arduboy',
    spineLabel: 'ARDUBOY',
    template: require('@/assets/cases/arduboy_case.png'),
    templateSize: { width: 497, height: 680 },
    coverArea: { x: 0, y: 0, width: 497, height: 680 },
    spineWidth: 22,
    spineColor: '#2B2D33',
    spineTextColor: '#FFFFFF',
    accent: '#2B2D33',
  },
  c64: {
    key: 'c64',
    label: 'Commodore 64',
    spineLabel: 'C64',
    template: require('@/assets/cases/c64_case.png'),
    templateSize: { width: 483, height: 680 },
    coverArea: { x: 0, y: 0, width: 483, height: 680 },
    spineWidth: 22,
    spineColor: '#1F6F8B',
    spineTextColor: '#FFFFFF',
    accent: '#1F6F8B',
  },
  amstradcpc: {
    key: 'amstradcpc',
    label: 'Amstrad CPC',
    spineLabel: 'CPC',
    template: require('@/assets/cases/amstradcpc_case.png'),
    templateSize: { width: 439, height: 680 },
    coverArea: { x: 0, y: 0, width: 439, height: 680 },
    spineWidth: 22,
    spineColor: '#2A2A2E',
    spineTextColor: '#FFFFFF',
    accent: '#2A2A2E',
  },
  apple2: {
    key: 'apple2',
    label: 'Apple II',
    spineLabel: 'APPLE II',
    template: require('@/assets/cases/apple2_case.png'),
    templateSize: { width: 496, height: 680 },
    coverArea: { x: 0, y: 0, width: 496, height: 680 },
    spineWidth: 22,
    spineColor: '#4A4D52',
    spineTextColor: '#FFFFFF',
    accent: '#4A4D52',
  },
};

/*
 * PC has no case, by the owner's earlier decision, and still has none: the
 * pack's "PC Windows" front is in `assets/cases/Other/` and deliberately
 * unassigned. PC leads `PLATFORM_PRIORITY` below *because* it shows the bare
 * cover, so giving it a box would put every multiplatform game in one.
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
  /* The machines that got a box with the owner's pack, newest generation
     first, as the block above runs. */
  'arduboy',
  'wonderswancolor',
  'wonderswan',
  'ngpc',
  'ngp',
  'pokemonmini',
  'virtualboy',
  'pcfx',
  'threedo',
  'jaguarcd',
  'jaguar',
  'neogeo',
  'sega32x',
  'segacd',
  'gamegear',
  'pcengine',
  'lynx',
  'megaduck',
  'supervision',
  'mastersystem',
  'atari7800',
  'sg1000',
  'c64',
  'amstradcpc',
  'atari5200',
  'colecovision',
  'vectrex',
  'intellivision',
  'arcadia',
  'apple2',
  'odyssey2',
  'vc4000',
  'arcade',
  'atari2600',
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
  { match: ['virtual boy'], key: 'virtualboy' },
  { match: ['pokémon mini', 'pokemon mini'], key: 'pokemonmini' },
  { match: ['gamecube'], key: 'gamecube' },
  { match: ['nintendo 64', 'n64'], key: 'n64' },
  /* "Super NES CD-ROM System" holds no "snes", and would fall to the NES row. */
  { match: ['super nintendo', 'super famicom', 'super nes', 'snes', 'satellaview'], key: 'snes' },

  /* Sega — and this block *must* stay above the NES row below it.
     "Genesis" contains the substring "nes", so a bare `'nes'` pattern tested
     first files every Sega Mega Drive game as a Nintendo Entertainment System
     game. Caught by the substring sweep in the scratchpad, not by the compiler:
     both keys are valid `PlatformKey`s and nothing about it is a type error.
     Each machine is its own row now that each has its own box; "sega cd" is
     tested before "32x" because IGDB lists a "Sega CD 32X". */
  { match: ['dreamcast'], key: 'dreamcast' },
  { match: ['saturn'], key: 'saturn' },
  { match: ['sega cd', 'mega cd', 'mega-cd'], key: 'segacd' },
  { match: ['32x'], key: 'sega32x' },
  { match: ['master system', 'mark iii'], key: 'mastersystem' },
  { match: ['game gear'], key: 'gamegear' },
  { match: ['sg-1000'], key: 'sg1000' },
  { match: ['mega drive', 'genesis'], key: 'genesis' },

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
     out of "macOS" and leave the phone platforms unmatched. "Apple II" first:
     it is a 1977 computer with a box, not a phone. */
  { match: ['apple ii'], key: 'apple2' },
  { match: ['ios', 'iphone', 'ipad', 'apple tv'], key: 'ios' },
  { match: ['android'], key: 'android' },

  /* The machines the desktop row below would otherwise claim, because "pc" is
     two letters and they are in a lot of names: the PC Engine, the PC-FX, the
     Amstrad C**PC** — and two that are simply not desktops, Microsoft's phones
     and the 1978 "PC-50X" family of pong consoles. */
  { match: ['turbografx', 'pc engine'], key: 'pcengine' },
  { match: ['pc-fx'], key: 'pcfx' },
  { match: ['amstrad cpc'], key: 'amstradcpc' },
  { match: ['windows phone', 'windows mobile', 'pc-50x'], key: 'other' },

  /* Desktop. */
  { match: ['pc', 'windows', 'mac', 'linux', 'dos', 'steam'], key: 'pc' },

  /* Atari. Each machine with a box before the family row, which catches what
     is left — the ST, the 8-bit computers. Only the name "Atari 2600": IGDB's
     "Atari VCS" is the 2021 console, not the 2600's old name. "jaguar cd"
     before "jaguar". */
  { match: ['atari 2600'], key: 'atari2600' },
  { match: ['atari 5200'], key: 'atari5200' },
  { match: ['atari 7800'], key: 'atari7800' },
  { match: ['jaguar cd'], key: 'jaguarcd' },
  { match: ['jaguar'], key: 'jaguar' },
  { match: ['lynx'], key: 'lynx' },
  { match: ['atari'], key: 'atari' },

  /* SNK. The handhelds and the home console before `arcade`, which keeps the
     cabinets — the MVS, the Hyper Neo Geo 64. */
  { match: ['neo geo pocket color'], key: 'ngpc' },
  { match: ['neo geo pocket'], key: 'ngp' },
  { match: ['neo geo aes', 'neo geo cd'], key: 'neogeo' },
  { match: ['arcade', 'neo geo', 'mame'], key: 'arcade' },

  /* Everything else with a box. "wonderswan color" before "wonderswan"; the
     Amico is a 2020s console that shares only its name with the Intellivision. */
  { match: ['3do'], key: 'threedo' },
  { match: ['wonderswan color', 'swancrystal'], key: 'wonderswancolor' },
  { match: ['wonderswan'], key: 'wonderswan' },
  { match: ['colecovision'], key: 'colecovision' },
  { match: ['intellivision amico'], key: 'other' },
  { match: ['intellivision'], key: 'intellivision' },
  { match: ['vectrex'], key: 'vectrex' },
  { match: ['odyssey 2', 'videopac'], key: 'odyssey2' },
  { match: ['arcadia 2001'], key: 'arcadia' },
  { match: ['vc 4000'], key: 'vc4000' },
  { match: ['supervision'], key: 'supervision' },
  { match: ['mega duck', 'cougar boy'], key: 'megaduck' },
  { match: ['arduboy'], key: 'arduboy' },
  { match: ['commodore c64', 'commodore 64'], key: 'c64' },
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
