import { contrast, hexToRgb } from './color';
import { fromOklab, linearToOklab, toOklab, towardBlack, type Oklab } from './immersive-color';

/**
 * Apple's key colour — `keyColor` on an Apple Music artist, the iTunes 11
 * background behind an open album — ported for the hero of a game, a studio
 * and a collection.
 *
 * ## What it is for
 *
 * A key colour is not the colour of the picture. It is the colour the picture
 * *ends in*: read off the edge where the artwork meets the page, so that when
 * the page is filled with it the art has no border — the image does not sit
 * on the page, it runs out into it. That is the whole effect, and it is why
 * the colour is sampled at the edges and nowhere else. iTunes 11 put the
 * album art at the right of a panel and the colour to its left, and sampled
 * the left edge; a hero here melts into the page at its *foot*, so the foot
 * is what counts most (`HERO_EDGES`).
 *
 * ## The algorithm, as reverse-engineered from iTunes 11
 *
 *  1. **Crop the outer border** (`border`), so a thin frame, a JPEG's ringing
 *     at the image edge, or a one-pixel letterbox line is never the answer.
 *  2. **Sample the edges** — a band of each (`band`), weighted per edge.
 *  3. **Cluster** what was sampled by colour distance. iTunes compared sRGB
 *     channels at about a tenth of their range; this clusters in **Oklab**,
 *     where a distance is the same visible difference everywhere — in sRGB a
 *     tenth is a shade apart in the darks and invisible in the lights, which
 *     is exactly where an edge of key art tends to sit. `radius` is about four
 *     just-noticeable differences: "the same colour", allowing for grain.
 *  4. **The largest cluster is the key colour** — except that near-black and
 *     near-white yield to a real colour that is at least 30% as large, which
 *     is iTunes' own rule (`SLColorArt`'s `_findEdgeColor`): a black edge is
 *     more often a vignette or a letterbox than the picture's colour.
 *
 * The clustering is deterministic: pixels are counted into a 5-bit histogram
 * first, and clusters are seeded from the most populous bins down, so the
 * answer never depends on the order the pixels were read in.
 *
 * ## What it is measured on
 *
 * **Only the part of the image that is on screen** (`visibleRegion`). A 16:9
 * key art drawn into a square banner shows its middle; its left and right
 * edges are cropped away, and a colour read off them would be the colour of
 * something nobody can see. The hook passes the frame and the image's anchor,
 * and the edges sampled are the edges of the crop.
 *
 * ## What it is not
 *
 * Not `immersiveBackground` (`lib/immersive-color.ts`): that is Palette's
 * *dominant* colour of the whole picture. The key colour is **the page's own
 * colour** on the three pages that draw an Apple Music hero — one colour from
 * the top of the page to its foot, which darkens as the page is read
 * (`keyPage`) — toned for this app's dark room first, because Apple's own can
 * be white.
 *
 * Pure: no React Native and no `@/`, so `npm test` loads it.
 */

export type Size = { width: number; height: number };

/** A point in an image, as fractions of its width and height — an anchor. */
export type Anchor = { x: number; y: number };

/** A region of an image, as fractions of its width and height. */
export type Region = { left: number; top: number; right: number; bottom: number };

/** How much each edge counts toward the key colour. Zero leaves it out. */
export type EdgeWeights = { top: number; right: number; bottom: number; left: number };

export const KEY_COLOR = {
  /** How much of each side is cropped away first: a thin frame, ringing, a stray line. */
  border: 0.03,
  /** How deep a band of each edge is sampled, as a share of that side. */
  band: 0.12,
  /** The cluster radius, in Oklab: about four just-noticeable differences. */
  radius: 0.08,
  /** A colour beats black or white when it is at least this much of their size. */
  colourOverExtreme: 0.3,
  /** iTunes' `pc_isBlackOrWhite`: every sRGB channel under 0.09, or every one over 0.91. */
  black: 0.09,
  white: 0.91,
} as const;

/**
 * A hero's edges: the foot first — it is where the art melts into the page —
 * the sides half as much, because they meet the display's edge and not the
 * page, and the top hardly at all, under the status bar's scrim.
 */
export const HERO_EDGES: EdgeWeights = { top: 0.15, right: 0.5, bottom: 1, left: 0.5 };

const CENTRE: Anchor = { x: 0.5, y: 0.5 };
const WHOLE: Region = { left: 0, top: 0, right: 1, bottom: 1 };

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/**
 * The part of an image `contentFit: 'cover'` shows in a frame, with the
 * image's own point `anchor` laid on the frame's — `contentPosition`, which is
 * CSS's `object-position`: `{ x: 0.5, y: 0.22 }` is `left: 50%, top: 22%`.
 */
export function visibleRegion(image: Size, frame: Size, anchor: Anchor = CENTRE): Region {
  const valid = [image.width, image.height, frame.width, frame.height].every(
    (side) => Number.isFinite(side) && side > 0
  );
  if (!valid) return WHOLE;

  const imageAspect = image.width / image.height;
  const frameAspect = frame.width / frame.height;

  if (imageAspect > frameAspect) {
    /* Wider than the frame: the full height is shown and the sides are cut. */
    const shown = frameAspect / imageAspect;
    const left = (1 - shown) * clamp01(anchor.x);
    return { left, top: 0, right: left + shown, bottom: 1 };
  }
  const shown = imageAspect / frameAspect;
  const top = (1 - shown) * clamp01(anchor.y);
  return { left: 0, top, right: 1, bottom: top + shown };
}

export type KeyColorOptions = {
  /** The part of the image on screen. The whole of it by default. */
  region?: Region;
  /** Which edges count, and how much. A hero's by default (`HERO_EDGES`). */
  edges?: EdgeWeights;
  border?: number;
  band?: number;
  radius?: number;
};

export type KeyColor = {
  /** The key colour, as it is in the art. */
  color: string;
  /** How much of what was sampled it covers, 0–1: its confidence. */
  share: number;
  /** The dominant primary accent color extracted via K-Means and Apple Music rules. */
  primary?: string;
};

type Cluster = {
  weight: number;
  /** Weighted sums, for the centroid. */
  l: number;
  a: number;
  b: number;
  r: number;
  g: number;
  bl: number;
};

/** sRGB 0–255 → linear light, once per value. */
const LINEAR = Array.from({ length: 256 }, (_, value) => {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
});

/**
 * The key colour of an RGBA image, or null when there is nothing to read
 * (a region a pixel wide, or nothing opaque in it).
 */
export function keyColorOf(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  {
    region = WHOLE,
    edges = HERO_EDGES,
    border = KEY_COLOR.border,
    band = KEY_COLOR.band,
    radius = KEY_COLOR.radius,
  }: KeyColorOptions = {}
): KeyColor | null {
  if (width <= 0 || height <= 0 || data.length < width * height * 4) return null;

  /* The region in pixels, then the border cropped off it. */
  const x0 = Math.max(0, Math.floor(clamp01(region.left) * width));
  const x1 = Math.min(width, Math.ceil(clamp01(region.right) * width));
  const y0 = Math.max(0, Math.floor(clamp01(region.top) * height));
  const y1 = Math.min(height, Math.ceil(clamp01(region.bottom) * height));
  const cropX = borderOf(x1 - x0, border);
  const cropY = borderOf(y1 - y0, border);
  const left = x0 + cropX;
  const right = x1 - cropX;
  const top = y0 + cropY;
  const bottom = y1 - cropY;
  if (right - left < 2 || bottom - top < 2) return null;

  const bandX = Math.max(1, Math.round((right - left) * band));
  const bandY = Math.max(1, Math.round((bottom - top) * band));

  /* 1–2. Every sampled pixel into a 5-bit histogram, with its edge's weight. */
  const bins = new Map<number, { weight: number; r: number; g: number; b: number }>();
  for (let y = top; y < bottom; y += 1) {
    for (let x = left; x < right; x += 1) {
      const weight = Math.max(
        y < top + bandY ? edges.top : 0,
        y >= bottom - bandY ? edges.bottom : 0,
        x < left + bandX ? edges.left : 0,
        x >= right - bandX ? edges.right : 0
      );
      if (weight <= 0) continue;

      const i = (y * width + x) * 4;
      if (data[i + 3] < 128) continue;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const key = ((r >> 3) << 10) | ((g >> 3) << 5) | (b >> 3);
      const bin = bins.get(key);
      if (bin) {
        bin.weight += weight;
        bin.r += r * weight;
        bin.g += g * weight;
        bin.b += b * weight;
      } else {
        bins.set(key, { weight, r: r * weight, g: g * weight, b: b * weight });
      }
    }
  }
  if (bins.size === 0) return null;

  /* 3. Clusters, seeded from the most populous bins down — ties by bin, so
     the order the pixels were read in never matters. */
  const seeds = [...bins.entries()].sort((p, q) => q[1].weight - p[1].weight || p[0] - q[0]);
  const clusters: Cluster[] = [];
  let total = 0;

  for (const [, bin] of seeds) {
    const r = bin.r / bin.weight;
    const g = bin.g / bin.weight;
    const b = bin.b / bin.weight;
    const lab = oklabOf(r, g, b);
    total += bin.weight;

    let nearest: Cluster | null = null;
    let nearestDistance = radius;
    for (const cluster of clusters) {
      const distance = Math.hypot(
        lab[0] - cluster.l / cluster.weight,
        lab[1] - cluster.a / cluster.weight,
        lab[2] - cluster.b / cluster.weight
      );
      if (distance <= nearestDistance) {
        nearest = cluster;
        nearestDistance = distance;
      }
    }

    const target = nearest ?? { weight: 0, l: 0, a: 0, b: 0, r: 0, g: 0, bl: 0 };
    target.weight += bin.weight;
    target.l += lab[0] * bin.weight;
    target.a += lab[1] * bin.weight;
    target.b += lab[2] * bin.weight;
    target.r += r * bin.weight;
    target.g += g * bin.weight;
    target.bl += b * bin.weight;
    if (!nearest) clusters.push(target);
  }

  /* Stable: a tie keeps the cluster that was seeded first. */
  const ranked = clusters
    .map((cluster, index) => ({ cluster, index }))
    .sort((p, q) => q.cluster.weight - p.cluster.weight || p.index - q.index)
    .map((entry) => entry.cluster);

  /* 4. The largest — unless it is black or white and a colour is close behind. */
  let chosen = ranked[0];
  if (isExtreme(chosen)) {
    for (const next of ranked.slice(1)) {
      if (next.weight / chosen.weight < KEY_COLOR.colourOverExtreme) break;
      if (!isExtreme(next)) {
        chosen = next;
        break;
      }
    }
  }

  /* Dominant palette extraction via K-Means and Apple Music accent selection rules. */
  let primary = chosen ? fromOklab([chosen.l / chosen.weight, chosen.a / chosen.weight, chosen.b / chosen.weight]) : '#5E81F4';
  try {
    const dominantClusters = kMeans(data, width, height, 5, 10);
    if (dominantClusters.length > 0) {
      primary = selectAccentColor(dominantClusters);
    }
  } catch {
    /* Fall back to chosen key color */
  }

  return {
    color: fromOklab([
      chosen.l / chosen.weight,
      chosen.a / chosen.weight,
      chosen.b / chosen.weight,
    ]),
    share: chosen.weight / total,
    primary,
  };
}

/** How many pixels of a side the border crop takes: at least one, once there is room for it. */
function borderOf(side: number, fraction: number): number {
  if (side < 16) return 0;
  return Math.max(1, Math.round(side * fraction));
}

function oklabOf(r: number, g: number, b: number): Oklab {
  /* A bin's mean is not a whole number; interpolating the table is exact enough
     for a colour that is about to be clustered at four JNDs. */
  return linearToOklab(linearOf(r), linearOf(g), linearOf(b));
}

function linearOf(value: number): number {
  const v = Math.min(255, Math.max(0, value));
  const low = Math.floor(v);
  const high = Math.min(255, low + 1);
  return LINEAR[low] + (LINEAR[high] - LINEAR[low]) * (v - low);
}

/** iTunes' `pc_isBlackOrWhite`, on a cluster's mean sRGB. */
function isExtreme(cluster: Cluster): boolean {
  const r = cluster.r / cluster.weight / 255;
  const g = cluster.g / cluster.weight / 255;
  const b = cluster.bl / cluster.weight / 255;
  const white = r > KEY_COLOR.white && g > KEY_COLOR.white && b > KEY_COLOR.white;
  const black = r < KEY_COLOR.black && g < KEY_COLOR.black && b < KEY_COLOR.black;
  return white || black;
}

/**
 * WCAG relative luminance formula as used in Apple Music iOS adaptive design.
 *
 * @param hex - Hexadecimal color string (#rrggbb or #rgb)
 */
export function relativeLuminance(hex: string): number {
  const clean = hex.replace('#', '').trim();
  let r = 0;
  let g = 0;
  let b = 0;
  if (clean.length === 3) {
    r = parseInt(clean[0] + clean[0], 16) || 0;
    g = parseInt(clean[1] + clean[1], 16) || 0;
    b = parseInt(clean[2] + clean[2], 16) || 0;
  } else {
    r = parseInt(clean.substring(0, 2), 16) || 0;
    g = parseInt(clean.substring(2, 4), 16) || 0;
    b = parseInt(clean.substring(4, 6), 16) || 0;
  }
  const toLinear = (c: number) => {
    c /= 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * toLinear(r) + 0.7152 * toLinear(g) + 0.0722 * toLinear(b);
}

/**
 * Text Color: Luminance Threshold.
 * Apple computes the relative luminance of the keyColor and picks text color based on a ~0.5 threshold.
 */
export function getTextColor(keyColor: string): string {
  const L = relativeLuminance(keyColor);
  return L > 0.5 ? '#1c1c1e' : '#ffffff';
}

/**
 * Secondary text color matching Apple Music adaptive secondary label.
 */
export function getSecondaryTextColor(keyColor: string): string {
  const L = relativeLuminance(keyColor);
  return L > 0.5 ? 'rgba(60, 60, 67, 0.6)' : 'rgba(235, 235, 245, 0.6)';
}

/**
 * Maximum relative luminance allowed for the bright tone (ceiling at rest).
 * Prevents hyper-saturated hues like Red Dead Redemption 2's red from burning
 * neon in the dark room, pulling them down to a rich, cinematic tone.
 */
export const MAX_BRIGHT_LUMINANCE = 0.12;

/**
 * The key colour as a page colour in this app's dark room: the same hue, taken
 * toward black in Oklab — where black is the origin, so the hue and the
 * colour's character survive — in tenths, until `ink` holds `minContrast` on
 * it, and capped at `MAX_BRIGHT_LUMINANCE` so bright neon art settles down.
 */
export function keyGround(
  key: string,
  { ink, minContrast = 4.5 }: { ink?: string; minContrast?: number } = {}
): string {
  let ground = key;
  if (ink) {
    for (let step = 0; step < 20 && contrast(ink, ground) < minContrast; step += 1) {
      ground = towardBlack(ground, 0.1);
    }
  }
  for (let step = 0; step < 20 && relativeLuminance(ground) > MAX_BRIGHT_LUMINANCE; step += 1) {
    ground = towardBlack(ground, 0.05);
  }
  return ground;
}

/**
 * How much darker the page is once its artwork has gone.
 */
export const KEY_PAGE_DARKEN = 0.5;

export type KMeansCluster = {
  r: number;
  g: number;
  b: number;
  hex: string;
  weight: number;
  h: number;
  s: number;
  l: number;
  relLum: number;
};

export function rgbToHex(r: number, g: number, b: number): string {
  const byte = (v: number) =>
    Math.min(255, Math.max(0, Math.round(v)))
      .toString(16)
      .padStart(2, '0');
  return `#${byte(r)}${byte(g)}${byte(b)}`.toUpperCase();
}

/**
 * Standard HSL conversion with linearized sRGB for relative luminance.
 */
export function rgbToHsl(
  r: number,
  g: number,
  b: number
): { h: number; s: number; l: number; relLum: number } {
  const rf = r / 255;
  const gf = g / 255;
  const bf = b / 255;
  const max = Math.max(rf, gf, bf);
  const min = Math.min(rf, gf, bf);
  const delta = max - min;
  const l = (max + min) / 2;
  const s = delta === 0 ? 0 : delta / (1 - Math.abs(2 * l - 1));
  let h = 0;
  if (delta !== 0) {
    if (max === rf) {
      h = (((gf - bf) / delta) % 6) * 60;
    } else if (max === gf) {
      h = ((bf - rf) / delta + 2) * 60;
    } else {
      h = ((rf - gf) / delta + 4) * 60;
    }
  }
  if (h < 0) h += 360;
  return { h, s, l, relLum: relativeLuminance(rgbToHex(r, g, b)) };
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0;
  let g = 0;
  let b = 0;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return [
    Math.round((r + m) * 255),
    Math.round((g + m) * 255),
    Math.round((b + m) * 255),
  ];
}

/**
 * Dominant Colors (K-Means) clustering: finds up to k dominant colors.
 * Emulates Core Image's CIFilter.kMeans() in JavaScript.
 */
export function kMeans(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  k = 5,
  passes = 10
): KMeansCluster[] {
  const pixels: [number, number, number][] = [];
  const total = width * height;
  const step = Math.max(1, Math.floor(total / 1000));
  for (let i = 0; i < data.length; i += 4 * step) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  if (pixels.length === 0) return [];

  const centroids: [number, number, number][] = [];
  centroids.push(pixels[Math.floor(pixels.length / 2)]);
  while (centroids.length < k && centroids.length < pixels.length) {
    let bestDist = -1;
    let bestPix = pixels[0];
    for (const p of pixels) {
      let minDist = Infinity;
      for (const c of centroids) {
        const d = (p[0] - c[0]) ** 2 + (p[1] - c[1]) ** 2 + (p[2] - c[2]) ** 2;
        if (d < minDist) minDist = d;
      }
      if (minDist > bestDist) {
        bestDist = minDist;
        bestPix = p;
      }
    }
    centroids.push(bestPix);
  }

  const assignments = new Int32Array(pixels.length);
  for (let pass = 0; pass < passes; pass += 1) {
    const sums = Array.from({ length: centroids.length }, () => [0, 0, 0, 0]);
    for (let i = 0; i < pixels.length; i += 1) {
      const p = pixels[i];
      let nearest = 0;
      let nearestDist = Infinity;
      for (let c = 0; c < centroids.length; c += 1) {
        const d = (p[0] - centroids[c][0]) ** 2 + (p[1] - centroids[c][1]) ** 2 + (p[2] - centroids[c][2]) ** 2;
        if (d < nearestDist) {
          nearestDist = d;
          nearest = c;
        }
      }
      assignments[i] = nearest;
      sums[nearest][0] += p[0];
      sums[nearest][1] += p[1];
      sums[nearest][2] += p[2];
      sums[nearest][3] += 1;
    }
    for (let c = 0; c < centroids.length; c += 1) {
      if (sums[c][3] > 0) {
        centroids[c] = [
          sums[c][0] / sums[c][3],
          sums[c][1] / sums[c][3],
          sums[c][2] / sums[c][3],
        ];
      }
    }
  }

  const counts = new Array(centroids.length).fill(0);
  for (let i = 0; i < pixels.length; i += 1) {
    counts[assignments[i]] += 1;
  }

  return centroids
    .map((c, i) => {
      const [r, g, b] = c;
      const hsl = rgbToHsl(r, g, b);
      return {
        r: Math.round(r),
        g: Math.round(g),
        b: Math.round(b),
        hex: rgbToHex(r, g, b),
        weight: counts[i] / pixels.length,
        ...hsl,
      };
    })
    .sort((a, b) => b.weight - a.weight);
}

/**
 * Apple Music Accent Color Selection Rules:
 * Picks a vibrant, high-luminance, high-saturation accent color from candidates.
 */
export function selectAccentColor(clusters: KMeansCluster[], darkBgLum = 0.022): string {
  let best: KMeansCluster | null = null;
  let bestScore = -Infinity;

  for (const c of clusters) {
    if (c.l < 0.15 || c.l > 0.85) continue;
    if (c.s < 0.20) continue;

    let score = c.weight * 2;
    score += c.s * 3;
    if (c.h >= 180 && c.h <= 300) {
      score += 2; // Preference for cool/vivid blue-purple
    }
    if (c.h >= 30 && c.h <= 90 && c.s < 0.45) {
      score -= 2; // Disallow low-sat warm yellow-greens
    }
    if (c.h < 30 && c.l > 0.4 && c.l < 0.7 && c.s < 0.5) {
      score -= 1.5; // Demote muddy skin-tone reds
    }

    if (score > bestScore) {
      bestScore = score;
      best = c;
    }
  }

  if (!best) {
    const sorted = [...clusters]
      .filter((c) => c.l >= 0.15 && c.l <= 0.85)
      .sort((a, b) => b.s - a.s);
    best = sorted[0] ?? clusters[0];
  }
  if (!best) return '#5E81F4';

  const h = best.h;
  const s = Math.min(1.0, Math.max(best.s, 0.5) + 0.15); // Vibrancy boost
  let l = Math.min(0.68, Math.max(best.l, 0.45)); // High luminance

  let rgb = hslToRgb(h, s, l);
  let hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
  let relLum = relativeLuminance(hex);
  let cr = (relLum + 0.05) / (darkBgLum + 0.05);

  while (cr < 4.5 && l < 0.75) {
    l = Math.min(0.75, l + 0.05);
    rgb = hslToRgb(h, s, l);
    hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    relLum = relativeLuminance(hex);
    cr = (relLum + 0.05) / (darkBgLum + 0.05);
  }

  return hex;
}

/** Minimum relative luminance floor for the dark background so it never sinks to 0. */
export const MIN_DARK_LUMINANCE = 0.018;
export const TARGET_DARK_LUMINANCE = 0.022;

/**
 * Calibrate the dark background tone so it stays rich and dark with the artwork's hue,
 * but never sinks to pitch black near-0.
 */
export function calibrateDarkBackground(keyHex: string, ink?: string, minContrast = 4.5): string {
  let bg = keyHex;
  for (let step = 0; step < 30 && relativeLuminance(bg) > 0.025; step += 1) {
    bg = towardBlack(bg, 0.05);
  }
  let lab = toOklab(bg);
  if (lab) {
    let currentLum = relativeLuminance(bg);
    while (currentLum < MIN_DARK_LUMINANCE && lab[0] < 0.35) {
      lab = [lab[0] + 0.01, lab[1] * 0.98, lab[2] * 0.98];
      bg = fromOklab(lab);
      currentLum = relativeLuminance(bg);
    }
  }
  if (ink) {
    for (let step = 0; step < 20 && contrast(ink, bg) < minContrast; step += 1) {
      bg = towardBlack(bg, 0.05);
    }
  }
  return bg;
}

/**
 * A page's adaptive tones:
 * - `dark`: The always-dark page background, richly tinted with a calibrated luminance floor.
 * - `bright` / `primary`: The high-saturation, high-luminance primary accent color for cards and buttons.
 */
export function keyPage(
  key: string,
  {
    ink,
    minContrast = 4.5,
    primary,
  }: { ink?: string; minContrast?: number; primary?: string } = {}
): { bright: string; dark: string; primary: string } {
  const dark = calibrateDarkBackground(key, ink, minContrast);
  let accent = primary;
  if (!accent) {
    const rgb = hexToRgb(key);
    if (rgb) {
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      const cluster = { r: rgb.r, g: rgb.g, b: rgb.b, hex: key, weight: 1, ...hsl };
      accent = selectAccentColor([cluster], relativeLuminance(dark));
    } else {
      accent = keyGround(key, { ink, minContrast });
    }
  }
  return { bright: accent, dark, primary: accent };
}
