import {
  Blend,
  Hct,
  QuantizerCelebi,
  Score,
  argbFromHex,
  argbFromRgb,
  hexFromArgb,
  labFromArgb,
} from '@material/material-color-utilities';

import { contrast, fromHsl, rgbToHex, toHsl, withAlpha } from './color';
import { paletteSwatches } from './immersive-color';

/**
 * The art-coloured pages' colours — a game's, a studio's, a collection's —
 * read off their hero art.
 *
 * ## BitChord's page, not the brief's filter (2026-10-28)
 *
 * The owner, having read how BitChord colours an artist page: "Bitchord's
 * background colors seem to be nicer to read than gamelog's, so make sure to
 * apply their same logic". This is BitChord's `ArtworkPalette` (`seedOf` and
 * `toPalette(dark)`, sharedUi/…/ui/theme/ArtworkPalette.kt), ported:
 *
 *  1. **The page is what the picture is mostly made of** — the most populous
 *     of Palette's swatches *with its filter off* (`paletteSwatches(…, {
 *     filter: false })`). The filter drops near-black and near-white, which
 *     is right while looking for an accent and wrong for "what colour is
 *     this?": a dark picture is reduced to whatever warm detail survived it.
 *  2. **It keeps its hue and is re-lit**: saturation into 0.20–0.62, lightness
 *     into 0.13–0.24 (`ARTWORK_PALETTE.page`) — BitChord's page at 0.13 and
 *     its wash's ceiling at 0.24. That is what makes it read: white holds
 *     about 11–17:1 on every live hero measured, where the brief's page was
 *     darkened only until white held 3:1 and its quiet type was white at 60%,
 *     2:1 on the brightest pages.
 *  3. **A grey is not given a hue** (`adaptedSaturation`): below 0.12 HSL
 *     saturation, saturation is left alone. HSL calls grey hue 0, so raising
 *     a grey to a floor manufactures red — maroon, once darkened. A near-black
 *     hero gives a near-black neutral page, and its colour is carried by the
 *     field behind it (`fieldColors`, `lib/artwork-field`).
 *  4. **The quiet ink is the page's own hue, lifted** (`quietInk`): saturation
 *     0.22–0.50, lightness 0.80 — Apple Music's secondary lines, "the
 *     sleeve's colour, lifted, so a blue record's credits read light blue on
 *     its blue page". The owner's reference for the game page's details
 *     (`#D69BA1` on `#5D1C24`) is exactly that.
 *  5. **Both inks are held** (`ARTWORK_PALETTE.read`): the page's lightness is
 *     lowered until white holds 7:1 and the quiet ink 4.5:1. On the live
 *     heroes it never has to move.
 *
 * ## The accent: saturation × √population
 *
 * The one vivid colour the art gives (`readArtwork().accent`) is BitChord's:
 * Palette's filtered swatches, scored by saturation times the *square root*
 * of their population. Saturation alone hands it to a fleck — The Witcher 3's
 * blood, God of War's logo, Ghost of Tsushima's leaves, each 1–2% of their
 * heroes, which is why the brief's pipeline needed a hard 5% floor; population
 * alone hands a sleeve that is four-fifths black sky a black accent. The root
 * makes a colour earn its place twice, continuously, with no floor to tune.
 * It leads the field behind the page.
 *
 * ## The buttons: Material 3, from the same art, of the page's family
 *
 * `m3Seeds` is Android's own wallpaper-colour path — Material's Celebi
 * quantiser (Wu, then weighted k-means) to 128 colours, then `Score`, which
 * ranks them for a UI theme — on the part of the hero that is on screen. Of
 * those, the one nearest the page's hue seeds the buttons, harmonized toward
 * it; with none near, the page's own colour does (`harmonySeed`). A neutral
 * page takes the art's best seed. They are then held ΔE 30 from the page by
 * **tone** (`buttonTone`).
 *
 * Pure: no React Native and no `@/`, so `npm test` loads it.
 */

/** The parameters of the crop and the fallbacks. */
export const PAGE_COLOR = {
  /** How much of each side is cropped off before the page is read. */
  crop: 0.1,
  /** How far apart, in CIELAB, the page and its filled button must be. */
  accentDistance: 30,
  /** The image could not be read. */
  failed: '#1C1C1E',
  /** Nothing in the image could be read for a colour: Apple's system dark grey. */
  rejected: '#2C2C2E',
  /** How many seeds Material's `Score` is asked for. */
  seeds: 4,
  /** Celebi's colour count, as Android's wallpaper extraction asks. */
  quantize: 128,
  /** The most pixels the seed is read from; more are sampled evenly. */
  seedPixels: 1000,
} as const;

/**
 * BitChord's numbers (`toPalette(dark)`), each with where it was read.
 * `[min, max]` pairs clamp; a single number sets.
 */
export const ARTWORK_PALETTE = {
  /** `CHROMATIC_SATURATION_THRESHOLD`: under this a swatch is grey, and stays grey. */
  greyGuard: 0.12,
  /** The page: `background`'s saturation band, lightness from its 0.13 to `wash`'s 0.24. */
  page: { saturation: [0.2, 0.62], lightness: [0.13, 0.24] },
  /** The quiet ink: `onBackgroundVariant`. */
  quiet: { saturation: [0.22, 0.5], lightness: 0.8 },
  /** What the page must hold: white, and the quiet ink. */
  read: { white: 7, quiet: 4.5 },
  /** The lightness step the page is lowered by when it does not. */
  step: 0.01,
} as const;

export type Region = { left: number; top: number; right: number; bottom: number };

const WHOLE: Region = { left: 0, top: 0, right: 1, bottom: 1 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const clamp = (value: number, [min, max]: readonly [number, number]) =>
  Math.min(max, Math.max(min, value));

/**
 * The RGBA pixels of `region` (fractions of the image), with `ring` of the
 * region's own width and height cropped off each side.
 */
export function cropPixels(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  region: Region = WHOLE,
  ring = 0
): Uint8Array {
  const x0 = Math.floor(clamp01(region.left) * width);
  const x1 = Math.ceil(clamp01(region.right) * width);
  const y0 = Math.floor(clamp01(region.top) * height);
  const y1 = Math.ceil(clamp01(region.bottom) * height);
  const cutX = Math.round((x1 - x0) * ring);
  const cutY = Math.round((y1 - y0) * ring);
  const left = x0 + cutX;
  const right = Math.max(left, x1 - cutX);
  const top = y0 + cutY;
  const bottom = Math.max(top, y1 - cutY);

  const out = new Uint8Array((right - left) * (bottom - top) * 4);
  let o = 0;
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const i = (y * width + x) * 4;
      out[o] = data[i];
      out[o + 1] = data[i + 1];
      out[o + 2] = data[i + 2];
      out[o + 3] = data[i + 3];
      o += 4;
    }
  }
  return out;
}

/**
 * BitChord's `adaptedArtworkSaturation`: a colour's saturation clamped into a
 * band — unless it is a grey, which keeps the little it has. HSL represents
 * grey with hue 0, so raising a grey to a floor does not make it more
 * colourful; it manufactures red, which becomes brown or maroon once the page
 * is darkened.
 */
export function adaptedSaturation(source: number, band: readonly [number, number]): number {
  const saturation = clamp01(source);
  return saturation < ARTWORK_PALETTE.greyGuard ? saturation : clamp(saturation, band);
}

/** `color` with its saturation adapted into `saturation` and its lightness set or clamped. */
export function relight(
  color: string,
  saturation: readonly [number, number],
  lightness: number | readonly [number, number]
): string {
  const hsl = toHsl(color);
  if (!hsl) return color;
  return fromHsl({
    h: hsl.h,
    s: adaptedSaturation(hsl.s, saturation),
    l: typeof lightness === 'number' ? lightness : clamp(hsl.l, lightness),
  });
}

/** One swatch: a colour, and how many of the picture's pixels it stands for. */
export type Swatch = { color: string; population: number };

/** What a picture gives the page, before anything is re-lit. */
export type ArtworkRead = {
  /** The most populous swatch, the filter off: what the picture is mostly made of. */
  dominant: string;
  /** Saturation × √population over the filtered swatches: its one vivid colour. */
  accent: string;
  /** The filtered swatches (all of them when the filter left none), most populous first. */
  swatches: Swatch[];
};

const toSwatches = (data: Uint8Array | Uint8ClampedArray, filter: boolean): Swatch[] =>
  paletteSwatches(data, { filter })
    .map((swatch) => ({
      color: rgbToHex({ r: swatch.rgb[0], g: swatch.rgb[1], b: swatch.rgb[2] }),
      population: swatch.population,
    }))
    .sort((a, b) => b.population - a.population);

/**
 * BitChord's `seedOf`: the picture asked twice. Null for an image with no
 * pixel to count.
 */
export function readArtwork(data: Uint8Array | Uint8ClampedArray): ArtworkRead | null {
  const all = toSwatches(data, false);
  if (all.length === 0) return null;
  const filtered = toSwatches(data, true);
  const pool = filtered.length > 0 ? filtered : all;

  /* `hsl.s × sqrt(population)`: a colour nobody sees enough of reads as
     arbitrary, and a grey one is not an accent at all. */
  let accent = pool[0];
  let best = -Infinity;
  for (const swatch of pool) {
    const score = (toHsl(swatch.color)?.s ?? 0) * Math.sqrt(swatch.population);
    if (score > best) {
      best = score;
      accent = swatch;
    }
  }
  return { dominant: all[0].color, accent: accent.color, swatches: pool };
}

/** The page's quiet ink: its own hue, lifted pale (`ARTWORK_PALETTE.quiet`). */
export function quietInk(page: string): string {
  return relight(page, ARTWORK_PALETTE.quiet.saturation, ARTWORK_PALETTE.quiet.lightness);
}

/** Whether a page holds both its inks (`ARTWORK_PALETTE.read`). */
export function holdsInks(page: string, quiet = quietInk(page)): boolean {
  return (
    contrast(page, '#FFFFFF') >= ARTWORK_PALETTE.read.white &&
    contrast(page, quiet) >= ARTWORK_PALETTE.read.quiet
  );
}

/**
 * The page from a picture's dominant colour: re-lit (`ARTWORK_PALETTE.page`),
 * then lowered until both its inks hold — which on every live hero measured
 * it already did.
 */
export function pageFrom(dominant: string): string {
  let page = relight(dominant, ARTWORK_PALETTE.page.saturation, ARTWORK_PALETTE.page.lightness);
  const hsl = toHsl(page);
  if (!hsl) return page;
  /* The quiet ink is read off the page's hue and saturation, which lowering
     its lightness does not move. */
  const quiet = quietInk(page);
  let l = hsl.l;
  while (!holdsInks(page, quiet) && l > 0) {
    l = Math.max(0, l - ARTWORK_PALETTE.step);
    page = fromHsl({ h: hsl.h, s: hsl.s, l });
  }
  return page;
}

/**
 * The page's inks: white, the quiet ink (its own hue, lifted), and a rule of
 * white at 12%. Every page `pageFrom` returns is dark, so these are always
 * the light ones. `secondarySolid` is the quiet ink again — it was the white
 * at 60% composited onto the page, for a token colour maths is done on; the
 * quiet ink is opaque already.
 */
export function pageInks(page: string): {
  primary: string;
  secondary: string;
  secondarySolid: string;
  rule: string;
} {
  const quiet = quietInk(page);
  return {
    primary: '#FFFFFF',
    secondary: quiet,
    secondarySolid: quiet,
    rule: withAlpha('#FFFFFF', 0.12),
  };
}

/**
 * Material 3's seed colours for an RGBA image, best first — Android's own
 * wallpaper path: Celebi to 128 colours, then `Score`, which drops what is
 * too grey or too rare and ranks the rest for a theme. Empty when nothing in
 * the image is fit to seed one (Score's own fallback is not a colour of the
 * image, so it is never returned).
 *
 * **Deterministic.** The JavaScript port of Celebi's k-means step starts its
 * assignments from `Math.random()`, where the Java reference seeds its own
 * `Random` with `0x42688`; measured on twenty live heroes, two reads of the
 * same picture disagreed by ΔE 17 one time in ten, so a game's buttons would
 * have changed colour between visits. It runs here under a fixed seed, and
 * since the call is synchronous nothing else can draw from `Math.random`
 * while it is swapped.
 */
export function m3Seeds(data: Uint8Array | Uint8ClampedArray): string[] {
  /* Every nth pixel, to at most `seedPixels`. Measured with the JIT off (a
     phone's interpreter): 1,060 ms for a whole 180-px hero, ~220 ms for a
     thousand of its pixels — and most of what is left is Celebi's 128
     clusters, which is Android's own number and is kept. */
  const total = Math.floor(data.length / 4);
  const stride = Math.max(1, Math.ceil(total / PAGE_COLOR.seedPixels));
  const pixels: number[] = [];
  for (let i = 0; i + 3 < data.length; i += 4 * stride) {
    if (data[i + 3] < 255) continue;
    pixels.push(argbFromRgb(data[i], data[i + 1], data[i + 2]));
  }
  if (pixels.length === 0) return [];

  const quantized = seeded(() => QuantizerCelebi.quantize(pixels, PAGE_COLOR.quantize));
  /* A sentinel no image produces (it is transparent), so a fallback is known. */
  const NONE = 0x00000001;
  const ranked = Score.score(quantized, { desired: PAGE_COLOR.seeds, fallbackColorARGB: NONE });
  return ranked.filter((argb) => argb !== NONE).map((argb) => hexFromArgb(argb).toUpperCase());
}

/** `fn` with `Math.random` replaced by a fixed-seed generator (a 32-bit LCG). */
function seeded<T>(fn: () => T): T {
  const original = Math.random;
  let state = 0x42688;
  Math.random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
  try {
    return fn();
  } finally {
    Math.random = original;
  }
}

/** CIE76: Euclidean distance in CIELAB, L* 0–100. */
export function deltaE(a: string, b: string): number {
  const [l1, a1, b1] = labFromArgb(argbFromHex(a));
  const [l2, a2, b2] = labFromArgb(argbFromHex(b));
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

/**
 * How the buttons are made to belong to the page — the owner's (2026-10-27),
 * after ARK: Survival Evolved, whose page came out cyan and whose buttons came
 * out earth: "They just dont blend at all."
 *
 * The two came from two algorithms reading the same art for different things:
 * the page from Palette's swatches by the brief's rules, the buttons from
 * Material's `Score`, which favours chroma — so a small vivid thing in the
 * picture (God of War's red logo, Persona 5's teal) could seed buttons of a
 * hue the page has nothing of. And the brief's rule 5, followed literally,
 * pushes *apart*: a button too like the page takes the next seed, or the
 * complement.
 */
export const HARMONY = {
  /**
   * Within this many degrees of the page's hue (HCT), a seed of the art's own
   * is of the page's family, and is used — pulled the rest of the way by
   * Material's own `Blend.harmonize`. Further than this, the page's colour is
   * the seed.
   */
  range: 30,
  /**
   * A page greyer than this (HCT chroma) has no family to keep to, and takes
   * the art's own best seed, whatever its hue: a vivid button on a grey page
   * is the classic pairing, not a clash.
   */
  neutralChroma: 12,
  /** The button's tone: the scheme's own first, and lighter in steps to the ceiling. */
  toneFrom: 60,
  toneTo: 95,
  toneStep: 5,
} as const;

/** The shortest way round the hue circle between two hues, in degrees. */
function hueDistance(a: number, b: number): number {
  const d = Math.abs(a - b) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * The seed for the page's buttons: one of Material's seeds for the art
 * (`m3Seeds`) that belongs to the page's family, harmonized toward it — or,
 * when none does, the page's own colour. Null without a page colour's worth
 * of anything (no seeds and a grey page): the caller keeps its fallback.
 */
export function harmonySeed(
  seeds: readonly string[],
  page: string
): { seed: string; from: 'art' | 'page' } | null {
  const pageHct = Hct.fromInt(argbFromHex(page));
  if (pageHct.chroma < HARMONY.neutralChroma) {
    return seeds[0] ? { seed: seeds[0], from: 'art' } : null;
  }

  let nearest: string | null = null;
  let distance = Infinity;
  for (const seed of seeds) {
    const hct = Hct.fromInt(argbFromHex(seed));
    /* A grey seed has no hue to agree with. */
    if (hct.chroma < HARMONY.neutralChroma) continue;
    const d = hueDistance(hct.hue, pageHct.hue);
    if (d < distance) {
      distance = d;
      nearest = seed;
    }
  }
  if (nearest && distance <= HARMONY.range) {
    const harmonized = Blend.harmonize(argbFromHex(nearest), argbFromHex(page));
    return { seed: hexFromArgb(harmonized).toUpperCase(), from: 'art' };
  }
  return { seed: page, from: 'page' };
}

/**
 * The colour the buttons keep to (`harmonySeed`'s `page`): the page, unless
 * it is neutral — then the art's accent, the colour that leads the field
 * behind it. BitChord's page leaves a near-black picture's page near-black
 * and grey, and its colour in the field; buttons that took Material's best
 * seed whatever its hue there gave ARK: Survival Evolved olive buttons over
 * its blue field — the pairing the owner rejected on 2026-10-27.
 */
export function buttonFamily(page: string, accent: string | null | undefined): string {
  const neutral = (color: string) => Hct.fromInt(argbFromHex(color)).chroma < HARMONY.neutralChroma;
  if (!neutral(page) || !accent || neutral(accent)) return page;
  return accent;
}

/**
 * Rule 5, kept by **tone** rather than by hue: the tone the page's buttons
 * take their palette's primary at — the scheme's own 60 when that already
 * stands ΔE 30 from the page, else lighter, a step at a time, until it does.
 * The brief's own remedy (the next seed, or the complement) is what made a
 * cyan page wear earth buttons; a lighter button of the page's own family
 * stands apart and still belongs.
 *
 * `fillAt` is the button's own arithmetic at a tone (`filledRoles` over the
 * scheme's primary). Every page holds white at 3:1, so it is never light:
 * lighter is always away from it.
 */
export function buttonTone(page: string, fillAt: (tone: number) => string): number {
  for (let tone = HARMONY.toneFrom; tone < HARMONY.toneTo; tone += HARMONY.toneStep) {
    if (deltaE(fillAt(tone), page) >= PAGE_COLOR.accentDistance) return tone;
  }
  return HARMONY.toneTo;
}
