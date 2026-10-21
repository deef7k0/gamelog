import { luminance, mix } from '../lib/color';
import type { ThemeColor } from './theme';

/**
 * A review shared as an image — the owner's direction (2026-10-16): "Just copy
 * how simpmusic does it, look at the sizes, margins, positioning of things, the
 * actual code". SimpMusic's lyrics card, read from its source
 * (`ShareLyricsCard.kt`, `ShareLyricsSheet.kt`, `ShareLyricsSelection.kt`), and
 * every number here is the one it uses, in the same order:
 *
 * ```text
 *   ┌─────────────────────────────────┐
 *   │ [art]  Hollow Knight            │  56dp art, 17sp title
 *   │                                 │  14
 *   │ (◍) ada                         │  the writer, a row of their own
 *   │                                 │  26
 *   │ Gorgeous and lonely, and far    │  bold 22 on 30, eight lines at most
 *   │ too long for what it has to say │
 *   │                                 │  24
 *   │ (◉) GameLog          92 GREAT   │  the signature, and the score opposite
 *   └─────────────────────────────────┘
 * ```
 *
 * Pure, so `share-card.test.ts` can hold the colours at AA.
 */
export const SHARE_CARD = {
  /**
   * A ceiling, not a size. SimpMusic's reason, which holds here: 340 does not
   * fit inside the sheet's 20dp gutters on a 360dp phone, and the capture takes
   * whatever width the card ends up at.
   */
  maxWidth: 340,
  /** The sheet's own gutter either side of the card. */
  gutter: 20,
  radius: 20,
  padding: 24,

  /**
   * The game: SimpMusic's 38dp art and 13sp title made bigger at the owner's
   * direction (2026-10-16) — still smaller than the words, which are the card.
   */
  art: 56,
  artRadius: 7,
  artGap: 14,
  title: { fontSize: 17, lineHeight: 22 },
  /** Developer · year under the title, quiet (the owner's, 2026-10-17). */
  credit: { fontSize: 13, lineHeight: 17 },
  titleToCredit: 2,
  /** The writer, on a row of their own under the game (the owner's). */
  headToWriter: 14,
  writerGap: 8,
  byline: { fontSize: 13, lineHeight: 17 },
  avatar: 22,

  /** Between the head and the words, and between the words and the foot. */
  headToText: 26,
  textToFoot: 24,

  /**
   * The words: bold, and a little bigger than anything else on the card — "The
   * text is the focus on this image". Eight lines at most, the owner's number.
   */
  text: { fontSize: 22, lineHeight: 30 },
  maxLines: 8,

  /** The signature: a 14dp disc with a 10dp glyph, 6 to a 10sp medium label. */
  signature: { disc: 14, glyph: 10, gap: 6, fontSize: 10, lineHeight: 13 },

  /** Everything that is not the words, at 68% of the words' ink. */
  secondaryAlpha: 0.68,
  /** The card's ramp, top to bottom: its colour, then 28% of the way to black. */
  darken: 0.28,
} as const;

/** The sheet the card is made in. */
export const SHARE_SHEET = {
  /** The sheet's own ramp runs much further: 82% of the way to black. */
  darken: 0.82,
  /** A picked line, a filled pill: the tint pushed this far from its fill. */
  tintPush: 0.55,
  /** The background choices: 32dp discs, 14 apart, a 2dp ring on the chosen. */
  swatch: 32,
  swatchGap: 14,
  swatchRing: 2,
  /** The quote, as the picker shows it: 18sp medium on 25, SimpMusic's line. */
  line: { fontSize: 18, lineHeight: 25 },
  /** The pills: 28 across, 14 down, a 15sp label, an 18dp glyph. */
  pill: { padX: 28, padY: 14, fontSize: 15, glyph: 18 },
  /** A disabled pill's fill. */
  disabledAlpha: 0.35,
} as const;

/**
 * The fixed background choices, after the game's own colour — SimpMusic's four,
 * as tokens (`theme.ts`).
 */
export const SHARE_SWATCHES: readonly ThemeColor[] = [
  'shareCharcoal',
  'shareForest',
  'shareBrick',
  'sharePaper',
];

/**
 * Whether type on `background` should be dark.
 *
 * A luminance test rather than a fixed white, as SimpMusic's
 * `shareCardContentColor`: one of the swatches is a near-white paper, and the
 * game's own colour can be anything.
 */
export function isLightCard(background: string): boolean {
  return luminance(background) > 0.5;
}

/** The ink on `background`: one of the two share inks, by luminance. */
export function shareInkToken(background: string): ThemeColor {
  return isLightCard(background) ? 'shareInkDark' : 'shareInkLight';
}

const BLACK = '#000000';
const WHITE = '#FFFFFF';

/**
 * `color` pushed away from `fill` until it reads on it — SimpMusic's
 * `shareTintOn`.
 *
 * For whatever inverts: a picked line, a filled pill, the glyph on the
 * signature's disc. The raw tint printed on a white fill can land at 2:1 and
 * look like a disabled control; pushed 55% towards black (or white, on a dark
 * fill) it keeps the game's hue and still reads.
 */
export function shareTintOn(color: string, fill: string): string {
  return mix(color, isLightCard(fill) ? BLACK : WHITE, SHARE_SHEET.tintPush);
}

/** The card's ramp: its colour at the top, 28% of the way to black at the foot. */
export function shareCardRamp(background: string): [string, string] {
  return [background, mix(background, BLACK, SHARE_CARD.darken)];
}

/** The sheet's ramp: the seed at the top, 82% of the way to black at the foot. */
export function shareSheetRamp(seed: string): [string, string] {
  return [seed, mix(seed, BLACK, SHARE_SHEET.darken)];
}

/** The words' width on a card of a given width: the card less its padding. */
export function shareTextWidth(cardWidth: number): number {
  return cardWidth - 2 * SHARE_CARD.padding;
}

/** The card's width on a display: its ceiling, or the display less the sheet's gutters. */
export function shareCardWidth(displayWidth: number): number {
  return Math.min(SHARE_CARD.maxWidth, displayWidth - 2 * SHARE_CARD.gutter);
}

/**
 * The second shared image — the owner's reference (2026-10-16), a rating card
 * from a music app ("the podiums one"), its layout replicated:
 *
 * ```text
 *   ┌──────────────────────────────────────────┐
 *   │ (◍) @ada  now                       (◉)  │  the writer, when; the app's mark
 *   │ ┌──────┐  The Witcher 3:          ┌────┐ │
 *   │ │ art  │  Wild Hunt               │ 92 │ │  the art, the game, the score —
 *   │ └──────┘  CD Projekt Red · 2015   └────┘ │  the app's square, not a circle
 *   │                                          │
 *   │ “ The quote, or the part picked     ”    │
 *   └──────────────────────────────────────────┘
 * ```
 *
 * Measured off the reference (437 wide) and set a little smaller, to the
 * classic card's width. Its ground is the classic card's: the chosen
 * background as a ramp, the type by its luminance — the owner had the light,
 * frosted wash of the reference taken off.
 */
export const SHARE_PODIUM = {
  padding: 16,
  radius: 22,
  /** The writer's row: a 26dp face, the handle bold, the time quiet. */
  avatar: 26,
  handle: { fontSize: 13, lineHeight: 17 },
  time: { fontSize: 12, lineHeight: 16 },
  /** The app's mark at the top right. */
  mark: 26,
  markGlyph: 15,
  /** Between the writer's row and the game's, and the game's and the words. */
  rowGap: 16,
  art: 76,
  artRadius: 8,
  artGap: 12,
  title: { fontSize: 16, lineHeight: 20 },
  credit: { fontSize: 12, lineHeight: 16 },
  /** The excerpt, under the game: 14 on 20, in italic as the reference sets it. */
  text: { fontSize: 14, lineHeight: 20 },
  maxLines: 8,
  /** The quiet type: the handle's time, the credit. */
  quietAlpha: 0.58,
} as const;
