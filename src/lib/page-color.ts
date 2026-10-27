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

import { contrast, fromHsl, luminance, mix, rgbToHex, toHsl, withAlpha } from './color';
import { paletteSwatches } from './immersive-color';

/**
 * A game page's colours, read off its hero art — the owner's brief of
 * 2026-10-27, which is Apple Music's artist page: **one page colour that never
 * changes**, picked from the art's palette by a set of "anti-ugly" rules, and
 * the page's buttons in **Material 3**, seeded by the same art.
 *
 * ## The page colour, in four steps
 *
 *  1. **Extraction** — Android Palette's named swatches (`paletteOf`):
 *     `dominant`, `vibrant`, `darkVibrant`, `lightVibrant`, `muted`,
 *     `darkMuted`, `lightMuted`, and the `average`. Palette's own quantiser
 *     (`paletteSwatches`, ported in `lib/immersive-color`) and Palette's own
 *     target scoring (`TARGETS`), so the swatches are the ones
 *     `react-native-image-colors` returns on Android — but computed here, in
 *     JavaScript, for three reasons the brief's own rules need: the image can
 *     be **cropped before extraction** (rule 1), every swatch carries its
 *     **population** (the native module returns bare hexes), and the answer is
 *     the same on Android, iOS (whose native result is not Palette's at all)
 *     and Expo Go (which has no native module).
 *  2. **The filter** (`pickPageColor`): a 10% ring cropped off first, then
 *     saturation ≥ 0.15, lightness 0.08–0.92 (HSL), `vibrant` / `darkVibrant`
 *     preferred over the rest, and the survivor darkened in HSL until white
 *     holds 3:1 on it. Nothing survives the saturation floor: the most
 *     saturated candidate inside the lightness bounds. Nothing at all:
 *     `REJECTED`, Apple's system dark grey.
 *  3. **The page's inks** (`pageInks`): white or black by the page's
 *     luminance, the secondary at 60% of it.
 *  4. **Failure**: an image that will not load is `FAILED`, a neutral dark
 *     grey; the glass still works on it.
 *
 * ## The buttons: Material 3, from the same art, of the page's family
 *
 * `m3Seeds` is Android's own wallpaper-colour path — Material's Celebi
 * quantiser (Wu, then weighted k-means) to 128 colours, then `Score`, which
 * ranks them for a UI theme — on the part of the hero that is on screen. Of
 * those, the one nearest the page's hue seeds the buttons, harmonized toward
 * it; with none near, the page's own colour does (`harmonySeed`). The brief's
 * rule 5 — the button ΔE 30 from the page — is then kept by **tone**: the same
 * palette, lighter (`buttonTone`). Followed literally, rule 5 reached for
 * another seed or the complement, and a cyan page wore earth buttons.
 *
 * Pure: no React Native and no `@/`, so `npm test` loads it.
 */

/** The parameters, each the brief's own number. */
export const PAGE_COLOR = {
  /** How much of each side is cropped off before extraction (rule 1). */
  crop: 0.1,
  /** HSL saturation a page colour must reach (rule 2). */
  saturationFloor: 0.15,
  /** HSL lightness bounds (rule 3). */
  lightnessMin: 0.08,
  lightnessMax: 0.92,
  /** White on the page must hold this; the page is darkened until it does (rule 4). */
  whiteContrast: 3,
  /** How far apart, in CIELAB, the page and its filled button must be (rule 5). */
  accentDistance: 30,
  /** The darkening step, in HSL lightness. */
  darkenStep: 0.01,
  /**
   * How much of the picture a swatch must cover to be its page — rule 1's
   * reasoning carried past the border: a colour on 1–2% of the art is a fleck
   * (The Witcher 3's blood, God of War's logo, Ghost of Tsushima's leaves,
   * measured on their live heroes), and "prefer vibrant" would otherwise hand
   * the whole page to it. The image's mean colour is exempt; it is all of it.
   */
  minShare: 0.05,
  /** The image could not be read (step 4). */
  failed: '#1C1C1E',
  /** Nothing in the image could be a page (step 4): Apple's system dark grey. */
  rejected: '#2C2C2E',
  /** How many seeds Material's `Score` is asked for. */
  seeds: 4,
  /** Celebi's colour count, as Android's wallpaper extraction asks. */
  quantize: 128,
  /** The most pixels the seed is read from; more are sampled evenly. */
  seedPixels: 1000,
} as const;

/**
 * The glass card — a fixed recipe, the brief's Step 3: only the page colour is
 * dynamic, and this works on any page that passed the filter.
 *
 * Brightest to darkest, which is what reads as glass: the top highlight (the
 * light on the bevel), the edge, the fill, the page, the shadow.
 */
export const GLASS = {
  /** The body: the page shows through, a little lifted. 0.10–0.15 is glass; 0.25 is a white panel. */
  fill: 'rgba(255, 255, 255, 0.12)',
  /** The body's alpha, for the colour it is seen as (`mix(page, white, fillAlpha)`). */
  fillAlpha: 0.12,
  /** The bevel: brighter than the fill, or the card is a lighter rectangle and not an object. */
  edge: 'rgba(255, 255, 255, 0.3)',
  /** The specular line along the top edge, drawn inside it. */
  highlight: 'rgba(255, 255, 255, 0.25)',
  /** The float: large and soft, never sharp. */
  shadow: 'rgba(0, 0, 0, 0.15)',
  shadowOffset: 8,
  shadowBlur: 16,
} as const;

export type Region = { left: number; top: number; right: number; bottom: number };

export type SwatchName =
  | 'dominant'
  | 'vibrant'
  | 'darkVibrant'
  | 'lightVibrant'
  | 'muted'
  | 'darkMuted'
  | 'lightMuted'
  | 'average';

/** A candidate page colour: one colour, every swatch name it answers to, and its pixel count. */
export type Candidate = { color: string; population: number; names: SwatchName[] };

/**
 * Palette's candidates, and how many pixels it counted — every swatch's
 * population, the unnamed ones too. Less than the image: Palette's filter
 * drops near-black, near-white and a band of oranges before counting.
 */
export type PaletteResult = { candidates: Candidate[]; counted: number };

const WHOLE: Region = { left: 0, top: 0, right: 1, bottom: 1 };
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

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
 * AndroidX Palette's default targets (`Target.java`): lightness and saturation
 * as minimum, target and maximum, in the order `Palette.generate()` walks
 * them. Each is exclusive — a swatch one target took is not offered to the
 * next.
 */
const TARGETS: readonly {
  name: Exclude<SwatchName, 'dominant' | 'average'>;
  light: readonly [number, number, number];
  sat: readonly [number, number, number];
}[] = [
  { name: 'lightVibrant', light: [0.55, 0.74, 1], sat: [0.35, 1, 1] },
  { name: 'vibrant', light: [0.3, 0.5, 0.7], sat: [0.35, 1, 1] },
  { name: 'darkVibrant', light: [0, 0.26, 0.45], sat: [0.35, 1, 1] },
  { name: 'lightMuted', light: [0.55, 0.74, 1], sat: [0, 0.3, 0.4] },
  { name: 'muted', light: [0.3, 0.5, 0.7], sat: [0, 0.3, 0.4] },
  { name: 'darkMuted', light: [0, 0.26, 0.45], sat: [0, 0.3, 0.4] },
];

/** `Target`'s default weights: saturation, lightness, population. They sum to 1. */
const WEIGHT = { sat: 0.24, light: 0.52, population: 0.24 } as const;

/**
 * Palette's named swatches of an RGBA image, as candidates — one per colour,
 * carrying every name it answers to, sorted by population (the `average`,
 * which is not a swatch, last). No candidates for an image with no usable pixel.
 */
export function paletteOf(data: Uint8Array | Uint8ClampedArray): PaletteResult {
  const swatches = paletteSwatches(data).map((swatch) => {
    const color = rgbToHex({ r: swatch.rgb[0], g: swatch.rgb[1], b: swatch.rgb[2] });
    return { color, population: swatch.population, hsl: toHsl(color)! };
  });

  const named = new Map<string, Candidate>();
  const add = (color: string, population: number, name: SwatchName) => {
    const known = named.get(color);
    if (known) known.names.push(name);
    else named.set(color, { color, population, names: [name] });
  };

  if (swatches.length > 0) {
    const dominant = swatches.reduce((best, next) =>
      next.population > best.population ? next : best
    );
    add(dominant.color, dominant.population, 'dominant');

    const used = new Set<string>();
    for (const target of TARGETS) {
      let best: (typeof swatches)[number] | null = null;
      let bestScore = -Infinity;
      for (const swatch of swatches) {
        const { s, l } = swatch.hsl;
        if (used.has(swatch.color)) continue;
        if (s < target.sat[0] || s > target.sat[2]) continue;
        if (l < target.light[0] || l > target.light[2]) continue;
        const score =
          WEIGHT.sat * (1 - Math.abs(s - target.sat[1])) +
          WEIGHT.light * (1 - Math.abs(l - target.light[1])) +
          WEIGHT.population * (swatch.population / dominant.population);
        if (score > bestScore) {
          bestScore = score;
          best = swatch;
        }
      }
      if (best) {
        used.add(best.color);
        add(best.color, best.population, target.name);
      }
    }
  }

  /* The image's mean colour, as `react-native-image-colors` adds it. */
  let r = 0;
  let g = 0;
  let b = 0;
  let count = 0;
  for (let i = 0; i + 3 < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    r += data[i];
    g += data[i + 1];
    b += data[i + 2];
    count += 1;
  }
  const candidates = [...named.values()].sort((p, q) => q.population - p.population);
  if (count > 0) {
    const average = rgbToHex({ r: r / count, g: g / count, b: b / count });
    if (!named.has(average)) candidates.push({ color: average, population: 0, names: ['average'] });
  }
  const counted = swatches.reduce((sum, swatch) => sum + swatch.population, 0);
  return { candidates, counted };
}

export type PagePick = {
  /** The page colour. */
  color: string;
  /** The candidate it came from, before any darkening; null for a fallback. */
  from: Candidate | null;
  /** Which rule chose it. */
  by: 'rules' | 'most-saturated' | 'rejected' | 'failed';
  /** Whether rule 4 darkened it. */
  darkened: boolean;
};

function withinLightness(candidate: Candidate): boolean {
  const { l } = toHsl(candidate.color)!;
  return l >= PAGE_COLOR.lightnessMin && l <= PAGE_COLOR.lightnessMax;
}

function saturated(candidate: Candidate): boolean {
  return toHsl(candidate.color)!.s >= PAGE_COLOR.saturationFloor;
}

const vivid = (candidate: Candidate) =>
  candidate.names.includes('vibrant') || candidate.names.includes('darkVibrant');

/**
 * Rule 4: the colour, its HSL lightness lowered a step at a time until white
 * holds `whiteContrast` on it. Apple adjusts rather than rejects.
 */
export function darkenForWhite(color: string): string {
  const hsl = toHsl(color);
  if (!hsl) return color;
  let page = color;
  let l = hsl.l;
  while (contrast(page, '#FFFFFF') < PAGE_COLOR.whiteContrast && l > 0) {
    l = Math.max(0, l - PAGE_COLOR.darkenStep);
    page = fromHsl({ h: hsl.h, s: hsl.s, l });
  }
  return page;
}

/** The page colour from Palette's candidates (`paletteOf`), by the brief's rules. */
export function pickPageColor({ candidates, counted }: PaletteResult): PagePick {
  const floor = counted * PAGE_COLOR.minShare;
  const lit = candidates.filter(
    (candidate) =>
      withinLightness(candidate) &&
      (candidate.names.includes('average') || candidate.population >= floor)
  );
  const passing = lit.filter(saturated);

  let from: Candidate | undefined;
  let by: PagePick['by'] = 'rules';
  if (passing.length > 0) {
    /* Rule 6: the vibrant swatches first — the glass's white lifts a vivid
       colour and flattens a muted one — then everything else, each by how
       much of the picture it covers. The list is already in that order. */
    from = passing.find(vivid) ?? passing[0];
  } else if (lit.length > 0) {
    /* Nothing reached the saturation floor: the most saturated, rather than a
       flat grey. */
    by = 'most-saturated';
    from = lit.reduce((best, next) => (toHsl(next.color)!.s > toHsl(best.color)!.s ? next : best));
  }

  if (!from) return { color: PAGE_COLOR.rejected, from: null, by: 'rejected', darkened: false };
  const color = darkenForWhite(from.color);
  return { color, from, by, darkened: color !== from.color };
}

/**
 * The page's inks, from its colour alone: white on a dark page and black on a
 * light one, the secondary at 60%. Every page the filter returns holds 3:1
 * against white, so in practice these are always the white ones.
 *
 * `secondarySolid` is the secondary composited onto the page — the same
 * colour, opaque, for a token that colour maths will be done on.
 */
export function pageInks(page: string): {
  primary: string;
  secondary: string;
  secondarySolid: string;
  rule: string;
} {
  const primary = luminance(page) < 0.5 ? '#FFFFFF' : '#000000';
  return {
    primary,
    secondary: withAlpha(primary, 0.6),
    secondarySolid: mix(page, primary, 0.6),
    rule: withAlpha(primary, 0.12),
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
