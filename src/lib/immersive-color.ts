import { contrast, hexToRgb, rgbToHex } from './color';

/**
 * The immersive page colour — a screen whose whole background is taken from
 * one piece of artwork, the way SimpMusic's album, playlist and artist pages
 * are (`UIExt.kt`, `toImmersiveBackground` and `artworkScrimBrush`, read from
 * the source rather than traced from screenshots).
 *
 * Three steps, each ported rather than approximated, because each one decides
 * how the page looks:
 *
 *  1. **The dominant swatch** — Android Palette's, which is what SimpMusic
 *     feeds in: the colour covering the most of the image after 5-bit
 *     quantisation and a median cut into sixteen boxes, with near-black,
 *     near-white and skin tones filtered out first. See `dominantSwatch`.
 *  2. **Darkened by its own lightness**, toward black *in Oklab*: the lighter
 *     the artwork, the harder it is pulled down, so white text holds on any
 *     cover. See `immersiveBackground`.
 *  3. **A smoothstep scrim** that melts the artwork into that colour over the
 *     bottom 70% of its frame. See `smoothScrimStops`.
 *
 * Unlike the accent extraction in `artwork-color.ts`, nothing here favours a
 * vivid hue: black-and-white art gives a grey page, which is the point — the
 * page is the artwork's own tone, not an accent read out of it.
 *
 * Pure: no React Native, no `@/`, so `npm test` loads it.
 */

// ---------------------------------------------------------------------------
// 1. The dominant swatch — AndroidX Palette's ColorCutQuantizer, ported
// ---------------------------------------------------------------------------

/** Palette quantises each channel to 5 bits before counting. */
const WORD_WIDTH = 5;
const WORD_MASK = (1 << WORD_WIDTH) - 1;

/** Palette's default `maximumColorCount`. */
const MAX_COLORS = 16;

type Swatch = { rgb: [number, number, number]; population: number };

const quantizedRed = (color: number) => (color >> (WORD_WIDTH * 2)) & WORD_MASK;
const quantizedGreen = (color: number) => (color >> WORD_WIDTH) & WORD_MASK;
const quantizedBlue = (color: number) => color & WORD_MASK;

/** `modifyWordWidth(value, 5, 8)`: a 5-bit channel back to 8 bits. */
const widen = (value: number) => (value << 3) & 0xff;

/** `ColorUtils.colorToHSL`, as Palette's filter reads it. */
function hslOf(r: number, g: number, b: number): [number, number, number] {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  const l = (max + min) / 2;

  let h = 0;
  let s = 0;
  if (max !== min) {
    if (max === rf) h = ((gf - bf) / delta) % 6;
    else if (max === gf) h = (bf - rf) / delta + 2;
    else h = (rf - gf) / delta + 4;
    s = delta / (1 - Math.abs(2 * l - 1));
  }
  h = (h * 60) % 360;
  if (h < 0) h += 360;

  return [Math.min(360, Math.max(0, h)), Math.min(1, Math.max(0, s)), Math.min(1, Math.max(0, l))];
}

/**
 * Palette's `DEFAULT_FILTER`: no near-black, no near-white, and nothing on the
 * "red I line" — the band of desaturated oranges that skin sits in, which
 * would otherwise win every portrait.
 */
function isAllowed(r: number, g: number, b: number): boolean {
  const [h, s, l] = hslOf(r, g, b);
  if (l <= 0.05 || l >= 0.95) return false;
  return !(h >= 10 && h <= 37 && s <= 0.82);
}

/** One median-cut box over a slice of the sorted colour list. */
class Vbox {
  lower: number;
  upper: number;
  population = 0;
  minR = 0;
  maxR = 0;
  minG = 0;
  maxG = 0;
  minB = 0;
  maxB = 0;
  private readonly colors: number[];
  private readonly histogram: Int32Array;

  constructor(lower: number, upper: number, colors: number[], histogram: Int32Array) {
    this.lower = lower;
    this.upper = upper;
    this.colors = colors;
    this.histogram = histogram;
    this.fit();
  }

  get volume(): number {
    return (this.maxR - this.minR + 1) * (this.maxG - this.minG + 1) * (this.maxB - this.minB + 1);
  }

  canSplit(): boolean {
    return this.upper - this.lower + 1 > 1;
  }

  fit(): void {
    let minR = Infinity;
    let minG = Infinity;
    let minB = Infinity;
    let maxR = -Infinity;
    let maxG = -Infinity;
    let maxB = -Infinity;
    let count = 0;
    for (let i = this.lower; i <= this.upper; i += 1) {
      const color = this.colors[i];
      count += this.histogram[color];
      const r = quantizedRed(color);
      const g = quantizedGreen(color);
      const b = quantizedBlue(color);
      if (r > maxR) maxR = r;
      if (r < minR) minR = r;
      if (g > maxG) maxG = g;
      if (g < minG) minG = g;
      if (b > maxB) maxB = b;
      if (b < minB) minB = b;
    }
    this.minR = minR;
    this.maxR = maxR;
    this.minG = minG;
    this.maxG = maxG;
    this.minB = minB;
    this.maxB = maxB;
    this.population = count;
  }

  /** Splits at the population median of the longest channel; returns the upper half. */
  split(): Vbox {
    const point = this.splitPoint();
    const upperBox = new Vbox(point + 1, this.upper, this.colors, this.histogram);
    this.upper = point;
    this.fit();
    return upperBox;
  }

  private splitPoint(): number {
    const redLength = this.maxR - this.minR;
    const greenLength = this.maxG - this.minG;
    const blueLength = this.maxB - this.minB;

    /* Palette swaps the longest channel into the most significant bits and
       sorts numerically: red → (r, g, b), green → (g, r, b), blue → (b, g, r). */
    const key =
      redLength >= greenLength && redLength >= blueLength
        ? (c: number) => c
        : greenLength >= redLength && greenLength >= blueLength
          ? (c: number) =>
              (quantizedGreen(c) << (WORD_WIDTH * 2)) |
              (quantizedRed(c) << WORD_WIDTH) |
              quantizedBlue(c)
          : (c: number) =>
              (quantizedBlue(c) << (WORD_WIDTH * 2)) |
              (quantizedGreen(c) << WORD_WIDTH) |
              quantizedRed(c);

    const slice = this.colors.slice(this.lower, this.upper + 1).sort((a, b) => key(a) - key(b));
    for (let i = 0; i < slice.length; i += 1) this.colors[this.lower + i] = slice[i];

    const midPoint = Math.floor(this.population / 2);
    let count = 0;
    for (let i = this.lower; i <= this.upper; i += 1) {
      count += this.histogram[this.colors[i]];
      /* Never split on the upper index — that would return the same box. */
      if (count >= midPoint) return Math.min(this.upper - 1, i);
    }
    return this.lower;
  }

  average(): Swatch {
    let redSum = 0;
    let greenSum = 0;
    let blueSum = 0;
    let total = 0;
    for (let i = this.lower; i <= this.upper; i += 1) {
      const color = this.colors[i];
      const population = this.histogram[color];
      total += population;
      redSum += population * quantizedRed(color);
      greenSum += population * quantizedGreen(color);
      blueSum += population * quantizedBlue(color);
    }
    return {
      rgb: [
        widen(Math.round(redSum / total)),
        widen(Math.round(greenSum / total)),
        widen(Math.round(blueSum / total)),
      ],
      population: total,
    };
  }
}

/**
 * The swatch covering the most of an RGBA image, as Palette computes it — or
 * null when every pixel was filtered out (an all-black, all-white or
 * all-skin-tone image), which is where SimpMusic falls back to black.
 *
 * Fed a 90×90 thumbnail: under Palette's own 112×112 resize area, so the pixel
 * set is exactly what Palette would have counted.
 */
export function dominantSwatch(
  data: Uint8Array | Uint8ClampedArray
): { color: string; population: number } | null {
  const histogram = new Int32Array(1 << (WORD_WIDTH * 3));
  for (let i = 0; i + 2 < data.length; i += 4) {
    const quantized =
      ((data[i] >> 3) << (WORD_WIDTH * 2)) |
      ((data[i + 1] >> 3) << WORD_WIDTH) |
      (data[i + 2] >> 3);
    histogram[quantized] += 1;
  }

  const colors: number[] = [];
  for (let color = 0; color < histogram.length; color += 1) {
    if (histogram[color] === 0) continue;
    const allowed = isAllowed(
      widen(quantizedRed(color)),
      widen(quantizedGreen(color)),
      widen(quantizedBlue(color))
    );
    if (allowed) colors.push(color);
    else histogram[color] = 0;
  }
  if (colors.length === 0) return null;

  let swatches: Swatch[];
  if (colors.length <= MAX_COLORS) {
    swatches = colors.map((color) => ({
      rgb: [widen(quantizedRed(color)), widen(quantizedGreen(color)), widen(quantizedBlue(color))],
      population: histogram[color],
    }));
  } else {
    /* The priority queue by volume: split the largest box until there are
       sixteen, stopping as soon as the largest one cannot split. */
    const boxes = [new Vbox(0, colors.length - 1, colors, histogram)];
    while (boxes.length < MAX_COLORS) {
      let largest = 0;
      for (let i = 1; i < boxes.length; i += 1) {
        if (boxes[i].volume > boxes[largest].volume) largest = i;
      }
      const box = boxes[largest];
      if (!box.canSplit()) break;
      boxes.push(box.split());
    }
    swatches = boxes
      .map((box) => box.average())
      .filter((swatch) => isAllowed(swatch.rgb[0], swatch.rgb[1], swatch.rgb[2]));
  }

  let best: Swatch | null = null;
  for (const swatch of swatches) {
    if (!best || swatch.population > best.population) best = swatch;
  }
  if (!best) return null;
  const [r, g, b] = best.rgb;
  return { color: rgbToHex({ r, g, b }), population: best.population };
}

// ---------------------------------------------------------------------------
// 2. The page colour — `toImmersiveBackground`, in Oklab
// ---------------------------------------------------------------------------

type Oklab = [l: number, a: number, b: number];

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const fromLinear = (c: number) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

function toOklab(hex: string): Oklab | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const r = toLinear(rgb.r / 255);
  const g = toLinear(rgb.g / 255);
  const b = toLinear(rgb.b / 255);
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

function fromOklab([L, A, B]: Oklab): string {
  const l = (L + 0.3963377774 * A + 0.2158037573 * B) ** 3;
  const m = (L - 0.1055613458 * A - 0.0638541728 * B) ** 3;
  const s = (L - 0.0894841775 * A - 1.291485548 * B) ** 3;
  const channel = (linear: number) =>
    Math.round(Math.min(1, Math.max(0, fromLinear(Math.max(0, linear)))) * 255);
  return rgbToHex({
    r: channel(4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s),
    g: channel(-1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s),
    b: channel(-0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s),
  });
}

/**
 * `lerp(color, Color.Black, fraction)` as Compose computes it — in Oklab, where
 * black is the origin, so the whole colour scales toward zero.
 *
 * Not `mix()` from `lib/color.ts`, which blends in sRGB. The two disagree most
 * for light colours: white pulled 80% toward black is #161616 in Oklab and
 * #333333 in sRGB. SimpMusic's own screenshots settle it — an off-white album
 * page measures #1B1B1B — so the port has to be in Oklab to look the same.
 */
export function towardBlack(color: string, fraction: number): string {
  const lab = toOklab(color);
  if (!lab) return color;
  const keep = 1 - Math.min(1, Math.max(0, fraction));
  return fromOklab([lab[0] * keep, lab[1] * keep, lab[2] * keep]);
}

/**
 * SimpMusic's `toImmersiveBackground`: the dominant colour, darkened by
 * 0.35 + 0.45 × its perceived lightness (0.299R + 0.587G + 0.114B), so a white
 * cover lands near #161616 and a mid purple on a deep one.
 *
 * `ink`, when given, is the quietest text the page will carry — `textMuted` on
 * this app's screens — and the colour keeps darkening in small steps until
 * that ink holds `minContrast` (AA, 4.5:1) on it. SimpMusic has no such guard
 * because its text is white; this app sets grey body text on the same page, and
 * a saturated mid-tone cover could otherwise land it under AA.
 */
export function immersiveBackground(
  dominant: string,
  { ink, minContrast = 4.5 }: { ink?: string; minContrast?: number } = {}
): string {
  const rgb = hexToRgb(dominant);
  if (!rgb) return dominant;

  const lightness = 0.299 * (rgb.r / 255) + 0.587 * (rgb.g / 255) + 0.114 * (rgb.b / 255);
  let page = towardBlack(dominant, 0.35 + 0.45 * lightness);

  if (ink) {
    for (let step = 0; step < 12 && contrast(ink, page) < minContrast; step += 1) {
      page = towardBlack(page, 0.15);
    }
  }
  return page;
}

// ---------------------------------------------------------------------------
// 3. The scrim — `artworkScrimBrush`
// ---------------------------------------------------------------------------

/** SimpMusic's stop count: enough that 8-bit banding never shows on a dark page. */
export const SCRIM_STEPS = 24;

/**
 * The stops of SimpMusic's `artworkScrimBrush`: a ramp from the page colour at
 * 0 alpha to the page colour, eased by smoothstep so it is flat at *both*
 * ends. A linear ramp has a corner where it leaves 0, and the eye tracks the
 * derivative of brightness — that corner is the edge people see.
 *
 * Returned as locations and alphas; the component applies them to the colour
 * with `withAlpha`, never to `'transparent'`, which is black at 0 alpha and
 * drags the middle of the ramp through grey.
 */
export function smoothScrimStops(steps = SCRIM_STEPS): { locations: number[]; alphas: number[] } {
  const locations: number[] = [];
  const alphas: number[] = [];
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    locations.push(t);
    alphas.push(t * t * (3 - 2 * t));
  }
  return { locations, alphas };
}

// ---------------------------------------------------------------------------
// Logos on the page
// ---------------------------------------------------------------------------

/**
 * The mean WCAG relative luminance of a logo's opaque pixels (alpha ≥ 50%), or
 * null when it has none. `stride` samples every nth pixel of a large image.
 */
export function meanOpaqueLuminance(
  data: Uint8Array | Uint8ClampedArray,
  stride = 1
): number | null {
  let sum = 0;
  let count = 0;
  const step = Math.max(1, Math.floor(stride)) * 4;
  for (let i = 0; i + 3 < data.length; i += step) {
    if (data[i + 3] < 128) continue;
    sum +=
      0.2126 * toLinear(data[i] / 255) +
      0.7152 * toLinear(data[i + 1] / 255) +
      0.0722 * toLinear(data[i + 2] / 255);
    count += 1;
  }
  return count > 0 ? sum / count : null;
}

/**
 * Whether a logo has to be drawn as a light silhouette to be seen on `page`.
 *
 * A logo is drawn as it is when its own ink holds 3:1 against the page — the
 * WCAG floor for a graphic — and as a light silhouette otherwise. Measured, not
 * assumed: of the first public-domain studio logos tried, FromSoftware's is
 * pure black and would vanish on any immersive page, while Mojang's is white
 * type on a red block, which a silhouette would turn into a blank rectangle.
 * One rule for both is only possible because it reads the pixels.
 *
 * An unmeasured logo (null) is drawn light: unreadable is the worse failure.
 */
export function logoNeedsLightInk(logoLuminance: number | null, page: string): boolean {
  if (logoLuminance === null) return true;
  const pageRgb = hexToRgb(page);
  if (!pageRgb) return true;
  const pageLuminance =
    0.2126 * toLinear(pageRgb.r / 255) +
    0.7152 * toLinear(pageRgb.g / 255) +
    0.0722 * toLinear(pageRgb.b / 255);
  const light = Math.max(logoLuminance, pageLuminance);
  const dark = Math.min(logoLuminance, pageLuminance);
  return (light + 0.05) / (dark + 0.05) < 3;
}
