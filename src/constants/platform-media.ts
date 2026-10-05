import type { PlatformKey } from './platform-cases';

/**
 * What a game physically *is* on each platform — disc, cartridge, card — which
 * `platform-cases.ts` does not carry and the physical-copy forms need.
 *
 * Kept out of `platform-cases.ts` because that file also holds the game case's
 * templates, and out of `platform-family.ts` because a family is a question
 * about vendors ("PlayStation") where this is a question about media ("a disc").
 *
 * Every table here is `Record<PlatformKey, …>`, so a platform added to
 * `platform-cases.ts` is a type error here until it is placed — a copy form that
 * silently called a cartridge a disc is the failure that prevents.
 */

// ---------------------------------------------------------------------------
// Media — for describing a physical copy
// ---------------------------------------------------------------------------

/**
 * What the game itself is, physically.
 *
 * "Loose" means a different object on each: a disc in a sleeve, a bare
 * cartridge, a Switch card no bigger than a stamp. The copy form words the
 * completeness choices from this so a collector reads their own vocabulary —
 * see `completenessLabel` in `constants/physical.ts`.
 *
 * `digital` platforms have no physical copies at all, and are left out of the
 * copy form's platform choices.
 */
export type PlatformMedium = 'disc' | 'cartridge' | 'card' | 'digital' | 'other';

export const PLATFORM_MEDIUM: Record<PlatformKey, PlatformMedium> = {
  pc: 'disc',
  ps5: 'disc',
  ps4: 'disc',
  ps3: 'disc',
  ps2: 'disc',
  ps1: 'disc',
  psp: 'disc',
  vita: 'card',
  xbox: 'disc',
  xbox360: 'disc',
  xboxOriginal: 'disc',
  switch2: 'card',
  switch: 'card',
  wiiu: 'disc',
  wii: 'disc',
  gamecube: 'disc',
  n64: 'cartridge',
  snes: 'cartridge',
  nes: 'cartridge',
  threeds: 'card',
  ds: 'card',
  gba: 'cartridge',
  gbc: 'cartridge',
  gameboy: 'cartridge',
  dreamcast: 'disc',
  saturn: 'disc',
  genesis: 'cartridge',
  segacd: 'disc',
  sega32x: 'cartridge',
  mastersystem: 'cartridge',
  gamegear: 'cartridge',
  sg1000: 'cartridge',
  virtualboy: 'cartridge',
  pokemonmini: 'cartridge',
  atari2600: 'cartridge',
  atari5200: 'cartridge',
  atari7800: 'cartridge',
  jaguar: 'cartridge',
  jaguarcd: 'disc',
  lynx: 'card',
  atari: 'cartridge',
  neogeo: 'cartridge',
  ngp: 'cartridge',
  ngpc: 'cartridge',
  /* A HuCard: the size of a credit card, and called one. */
  pcengine: 'card',
  pcfx: 'disc',
  threedo: 'disc',
  wonderswan: 'cartridge',
  wonderswancolor: 'cartridge',
  colecovision: 'cartridge',
  intellivision: 'cartridge',
  vectrex: 'cartridge',
  odyssey2: 'cartridge',
  arcadia: 'cartridge',
  vc4000: 'cartridge',
  supervision: 'cartridge',
  megaduck: 'cartridge',
  /* Tapes, floppies and a flashed handheld: none is a disc or a cartridge in
     the sense the copy form's words are written for. */
  arduboy: 'other',
  c64: 'other',
  amstradcpc: 'other',
  apple2: 'other',
  ios: 'digital',
  android: 'digital',
  stadia: 'digital',
  luna: 'digital',
  arcade: 'other',
  vr: 'other',
  other: 'other',
};

/**
 * Platforms whose boxes ship without a paper manual.
 *
 * "Game + manual" is a real state for a SNES cartridge and a meaningless one for
 * a Switch card, where there has not been a manual to lose since 2017. Offering
 * it there would be a choice nobody can truthfully make.
 */
export const NO_PRINTED_MANUAL: ReadonlySet<PlatformKey> = new Set<PlatformKey>([
  'ps5',
  'xbox',
  'switch',
  'switch2',
]);
