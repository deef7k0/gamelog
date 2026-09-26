import type {
  ContributionStatus,
  CopyCompleteness,
  CopyCondition,
  ReleasePhotoKind,
  ReleaseRegion,
} from '@/lib/database.types';

import type { PlatformKey } from './platform-cases';
import { NO_PRINTED_MANUAL, PLATFORM_MEDIUM, type PlatformMedium } from './platform-media';

/**
 * The words for physical releases and copies (migration 0024).
 *
 * **One representation for each state, everywhere.** The database stores a key,
 * this file owns the word, and no screen spells a condition itself — so "Very
 * good" can never also appear as "VG" on one screen and "Pretty good" on
 * another. The key lists here must match the CHECK constraints in 0024.
 *
 * Nothing here is a price, and nothing ever will be: condition and completeness
 * describe a copy, they do not value it.
 */

// ---------------------------------------------------------------------------
// Regions
// ---------------------------------------------------------------------------

export const REGIONS: readonly ReleaseRegion[] = [
  'ntsc_u',
  'pal',
  'ntsc_j',
  'asia',
  'region_free',
  'other',
];

/** The collector's short name — what is printed on a spine or a listing. */
export const REGION_LABEL: Record<ReleaseRegion, string> = {
  ntsc_u: 'NTSC-U',
  pal: 'PAL',
  ntsc_j: 'NTSC-J',
  asia: 'Asia',
  region_free: 'Region free',
  other: 'Other',
};

/** Where each one is sold, for anybody who does not know the codes by heart. */
export const REGION_HINT: Record<ReleaseRegion, string> = {
  ntsc_u: 'North America',
  pal: 'Europe, Australia',
  ntsc_j: 'Japan',
  asia: 'Hong Kong, Korea, Southeast Asia',
  region_free: 'Plays anywhere',
  other: 'Anywhere else',
};

// ---------------------------------------------------------------------------
// Completeness — what came with the copy
// ---------------------------------------------------------------------------

/** Most complete first, which is also the order a collector ranks them in. */
export const COMPLETENESS: readonly CopyCompleteness[] = [
  'sealed',
  'cib_inserts',
  'cib',
  'game_box',
  'game_manual',
  'loose',
  'other',
];

/** The short form, for a one-line quick view: "CIB · Very good". */
export const COMPLETENESS_SHORT: Record<CopyCompleteness, string> = {
  sealed: 'Sealed',
  cib_inserts: 'CIB + inserts',
  cib: 'CIB',
  game_box: 'Game + box',
  game_manual: 'Game + manual',
  loose: 'Loose',
  other: 'Other',
};

/**
 * The full label, worded for what the game physically is.
 *
 * "Loose" is a disc in a sleeve, a bare cartridge or a stamp-sized Switch card,
 * and a collector calls each by its own name. Everything else reads the same on
 * every medium, except "complete in box" on a platform whose boxes never had a
 * manual, where it means the case and the game.
 */
export function completenessLabel(value: CopyCompleteness, medium: PlatformMedium | null): string {
  switch (value) {
    case 'sealed':
      return 'Sealed';
    case 'cib_inserts':
      return 'Complete + inserts';
    case 'cib':
      return 'Complete in box';
    case 'game_box':
      return medium === 'disc' ? 'Disc + case' : 'Game + box';
    case 'game_manual':
      return 'Game + manual';
    case 'loose':
      return medium === 'disc'
        ? 'Disc only'
        : medium === 'cartridge'
          ? 'Cartridge only'
          : medium === 'card'
            ? 'Game card only'
            : 'Game only';
    case 'other':
      return 'Other';
  }
}

export const COMPLETENESS_HINT: Record<CopyCompleteness, string> = {
  sealed: 'Factory sealed, never opened',
  cib_inserts: 'Box, manual and the paper inserts',
  cib: 'The game, its box and its manual',
  game_box: 'The game and its box, no manual',
  game_manual: 'The game and its manual, no box',
  loose: 'Just the game',
  other: 'Something else — say in the notes',
};

/**
 * The completeness choices that make sense for a platform.
 *
 * Only "Game + manual" is ever withheld, and only where the boxes never had a
 * manual to lose (`NO_PRINTED_MANUAL`). Everything else is a state any physical
 * copy can be in.
 */
export function completenessChoices(platform: PlatformKey | null): CopyCompleteness[] {
  if (platform && NO_PRINTED_MANUAL.has(platform)) {
    return COMPLETENESS.filter((value) => value !== 'game_manual');
  }
  return [...COMPLETENESS];
}

/** The medium for a platform, or null when the copy has no platform yet. */
export function mediumFor(platform: PlatformKey | null): PlatformMedium | null {
  return platform ? PLATFORM_MEDIUM[platform] : null;
}

// ---------------------------------------------------------------------------
// Condition — how the copy has worn
// ---------------------------------------------------------------------------

/** The one condition scale, best first. */
export const CONDITIONS: readonly CopyCondition[] = [
  'mint',
  'near_mint',
  'excellent',
  'very_good',
  'good',
  'fair',
  'poor',
];

export const CONDITION_LABEL: Record<CopyCondition, string> = {
  mint: 'Mint',
  near_mint: 'Near mint',
  excellent: 'Excellent',
  very_good: 'Very good',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
};

/**
 * What each grade means, so two people calling a box "very good" mean the same
 * thing by it. Worded about wear, never about worth.
 */
export const CONDITION_HINT: Record<CopyCondition, string> = {
  mint: 'As new — no wear at all',
  near_mint: 'The faintest handling marks',
  excellent: 'Light wear you have to look for',
  very_good: 'Visible wear, nothing damaged',
  good: 'Obvious wear, works perfectly',
  fair: 'Heavy wear or small damage',
  poor: 'Damaged, but all there',
};

// ---------------------------------------------------------------------------
// Evidence photos
// ---------------------------------------------------------------------------

export const PHOTO_KINDS: readonly ReleasePhotoKind[] = [
  'front',
  'back',
  'barcode',
  'media',
  'manual',
  'markings',
  'other',
];

export const PHOTO_KIND_LABEL: Record<ReleasePhotoKind, string> = {
  front: 'Front cover',
  back: 'Back cover',
  barcode: 'Barcode',
  media: 'Disc or cartridge',
  manual: 'Manual',
  markings: 'Edition markings',
  other: 'Other',
};

// ---------------------------------------------------------------------------
// Contribution states
// ---------------------------------------------------------------------------

export const CONTRIBUTION_STATUS_LABEL: Record<ContributionStatus, string> = {
  pending: 'Waiting for review',
  approved: 'In the database',
  rejected: 'Not accepted',
  superseded: 'Another submission was accepted',
};

/**
 * One line naming a copy's release: "PS1 · PAL · Standard".
 *
 * "Standard" is dropped when it is the only thing the edition says — every
 * release is standard until it is not, and printing it on every row is noise.
 */
export function releaseLine(release: {
  platform: string | null;
  region: ReleaseRegion | null;
  edition: string | null;
}): string {
  const edition = release.edition?.trim();
  return [
    release.platform,
    release.region ? REGION_LABEL[release.region] : null,
    edition && edition.toLowerCase() !== 'standard' ? edition : null,
  ]
    .filter(Boolean)
    .join(' · ');
}

/** One line for a copy's state: "CIB · Very good". Null when neither is set. */
export function copyStateLine(copy: {
  completeness: CopyCompleteness | null;
  condition: CopyCondition | null;
}): string | null {
  const parts = [
    copy.completeness ? COMPLETENESS_SHORT[copy.completeness] : null,
    copy.condition ? CONDITION_LABEL[copy.condition] : null,
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(' · ') : null;
}
