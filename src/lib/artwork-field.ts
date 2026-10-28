import { contrast, fromHsl, toHsl, withAlpha } from './color';
import { ARTWORK_PALETTE, quietInk, readArtwork, type ArtworkRead } from './page-color';

/**
 * The colour field behind an art-coloured page — BitChord's legacy Now Playing
 * backdrop (`MeshGradientBackground`, sharedUi/…/ui/player/MeshGradient.kt),
 * at the owner's direction (2026-10-28): four soft blobs of the art's own
 * colours over the page's colour, which drift when the page opens and then
 * rest, and which change colour by cross-fading — on a game's page and a
 * studio's, following the trailer while it plays.
 *
 * ## What is BitChord's, and what is not
 *
 * - **The geometry is theirs, number for number**: the four anchors, the
 *   radii (0.62 of the longer side), the 0.85 at each blob's centre, the
 *   drift of a shade under half a turn over eight seconds, the 1.4-second
 *   colour fade, a frame read every three seconds.
 * - **Which colours**: theirs is the four most populous of Palette's
 *   swatches; here the accent leads — BitChord's own saturation × √population
 *   (`readArtwork`) — then the rest by population. Near-duplicates are dropped
 *   and a shortfall is filled from the art's own colours, hue and lightness
 *   fanned out, as theirs is (`expandedToFour`).
 * - **How bright**: theirs is a Now Playing screen — a cover and two lines of
 *   white — so its blobs are lifted into 0.28–0.58. This is a page that is
 *   read, so each blob is tuned as theirs is (saturation × 1.35, the grey left
 *   grey) and then **lowered until the page's two inks hold on it**: white at
 *   7:1, the quiet ink at 4.5:1 (`ARTWORK_PALETTE.read`). The field is drawn
 *   by laying blobs over the page's colour with alpha, and a blend of colours
 *   is never brighter than the brightest of them (sRGB's transfer is convex),
 *   so a field whose every blob holds both inks holds them everywhere.
 * - **No blur.** Theirs blurs the layer 64dp to soften it; a radial gradient
 *   with enough stops is already soft (`blobGradient`), and costs nothing per
 *   frame.
 *
 * Pure: no React Native and no `@/`, so `npm test` loads it.
 */
export const FIELD = {
  /** Where each blob sits at rest, as fractions of the field: BitChord's. */
  anchors: [
    { x: 0.2, y: 0.25 },
    { x: 0.8, y: 0.2 },
    { x: 0.75, y: 0.8 },
    { x: 0.25, y: 0.75 },
  ],
  /** Each blob's speed round its anchor, and its phase: BitChord's. */
  speeds: [1, -0.7, 0.85, -1.15],
  /** How far a blob wanders from its anchor, as a fraction of the field. */
  wander: 0.16,
  /** A blob's radius, as a fraction of the field's longer side. */
  radius: 0.62,
  /** A blob's opacity at its centre. */
  alpha: 0.85,
  /** How far the blobs travel when the page opens: a shade under half a turn. */
  driftRadians: Math.PI * 0.45,
  /** How long that takes, on Material's standard ease. */
  driftMs: 8_000,
  /** How long a change of colour takes to cross-fade. */
  fadeMs: 1_400,
  /** How often a playing trailer is read again. */
  refreshMs: 3_000,
  /** The size a trailer frame is read at: averaged to four colours, so small. */
  capture: { width: 64, height: 36 },
  /** Mean luma, 0–255, under which a frame is an undecoded buffer: BitChord's. */
  blackFrame: 12,
  /** The blobs' tuning before the inks are held: BitChord's `tuned`, lower. */
  tune: { saturation: 1.35, lightness: [0.2, 0.45] as const },
  /** Two colours closer than this are one blob: BitChord's `isCloseTo`. */
  distinct: { hue: 15, lightness: 0.12 },
  /** Gradient stops from a blob's centre out (`blobGradient`). */
  stops: 12,
} as const;

/** Whether two colours would read as one blob. */
function isCloseTo(a: string, b: string): boolean {
  const x = toHsl(a);
  const y = toHsl(b);
  if (!x || !y) return false;
  const gap = Math.abs(x.h - y.h) % 360;
  return (
    Math.min(gap, 360 - gap) < FIELD.distinct.hue && Math.abs(x.l - y.l) < FIELD.distinct.lightness
  );
}

/** Keeps the first of every group of near-duplicates. */
function distinct(colors: readonly string[]): string[] {
  const kept: string[] = [];
  for (const color of colors) if (!kept.some((other) => isCloseTo(other, color))) kept.push(color);
  return kept;
}

/** BitChord's `shifted`: the hue turned and the lightness raised, kept off the ends. */
function shifted(color: string, hue: number, lightness: number): string {
  const hsl = toHsl(color);
  if (!hsl) return color;
  return fromHsl({
    h: (hsl.h + hue) % 360,
    s: hsl.s,
    l: Math.min(0.7, Math.max(0.2, hsl.l + lightness)),
  });
}

/**
 * One blob's colour: BitChord's `tuned` (the saturation raised by a third,
 * a grey left grey, the lightness clamped), then lowered until white and the
 * page's quiet ink both hold on it.
 */
export function tuneBlob(color: string, quiet: string): string {
  const hsl = toHsl(color);
  if (!hsl) return color;
  const s = hsl.s < ARTWORK_PALETTE.greyGuard ? hsl.s : Math.min(1, hsl.s * FIELD.tune.saturation);
  let l = Math.min(FIELD.tune.lightness[1], Math.max(FIELD.tune.lightness[0], hsl.l));
  let out = fromHsl({ h: hsl.h, s, l });
  while (!blobHolds(out, quiet) && l > 0) {
    l = Math.max(0, l - ARTWORK_PALETTE.step);
    out = fromHsl({ h: hsl.h, s, l });
  }
  return out;
}

/** Whether the page's two inks hold on a blob at full strength. */
export function blobHolds(blob: string, quiet: string): boolean {
  return (
    contrast(blob, '#FFFFFF') >= ARTWORK_PALETTE.read.white &&
    contrast(blob, quiet) >= ARTWORK_PALETTE.read.quiet
  );
}

/**
 * The four blob colours for a picture, on `page`: the accent first, then the
 * rest by population, near-duplicates dropped — before and after tuning, since
 * two colours can meet once both are darkened — and a shortfall fanned out of
 * the colours there are. Empty for a picture that gave nothing: the field is
 * the page's colour alone.
 */
export function fieldColors(read: ArtworkRead | null, page: string): string[] {
  if (!read) return [];
  const quiet = quietInk(page);
  const order = [read.accent, ...read.swatches.map((swatch) => swatch.color)];
  const source = distinct(order);
  const tuned = distinct(source.map((color) => tuneBlob(color, quiet)));

  let step = 1;
  while (tuned.length < 4 && step <= 12) {
    const from = source[(step - 1) % source.length];
    const next = tuneBlob(shifted(from, 24 * step, 0.12 * step), quiet);
    if (!tuned.some((other) => isCloseTo(other, next))) tuned.push(next);
    step += 1;
  }
  /* A picture of one colour fans out into blobs too close to tell apart, and
     the loop gives up: the field repeats its colours rather than leave a hole. */
  while (tuned.length < 4) tuned.push(tuned[tuned.length % Math.max(1, tuned.length)]);
  return tuned.slice(0, 4);
}

/**
 * A frame's mean luma (BT.601, as BitChord's `isLikelyBlackFrame`), on a
 * sparse grid. Under `FIELD.blackFrame` it is the first read after a surface
 * was made, before the decoder has drawn anything — a genuinely dark frame
 * clears it on compression noise alone.
 */
export function isLikelyBlackFrame(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number
): boolean {
  if (width <= 0 || height <= 0) return true;
  const stride = Math.max(1, Math.floor(Math.min(width, height) / 32));
  let sum = 0;
  let count = 0;
  for (let y = 0; y < height; y += stride) {
    for (let x = 0; x < width; x += stride) {
      const i = (y * width + x) * 4;
      sum += (data[i] * 30 + data[i + 1] * 59 + data[i + 2] * 11) / 100;
      count += 1;
    }
  }
  return count === 0 || sum / count < FIELD.blackFrame;
}

/**
 * The field's colours for a frame of a playing trailer, or null for a frame
 * that is black (`isLikelyBlackFrame`) — the field then keeps what it has.
 * The page and its inks are the still's and do not move: only the field
 * follows the clip.
 */
export function frameFieldColors(
  data: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  page: string
): string[] | null {
  if (isLikelyBlackFrame(data, width, height)) return null;
  const colors = fieldColors(readArtwork(data), page);
  return colors.length > 0 ? colors : null;
}

/** One blob's place: its centre and radius, in the field's own units. */
export type Blob = { x: number; y: number; radius: number };

/**
 * Where blob `index` is at `phase` (radians of drift), on a field `width` ×
 * `height`: BitChord's orbit, `anchor + 0.16 × (cos, sin)` of a phase each
 * blob runs at its own speed.
 */
export function blobAt(index: number, phase: number, width: number, height: number): Blob {
  const anchor = FIELD.anchors[index % FIELD.anchors.length];
  const speed = FIELD.speeds[index % FIELD.speeds.length];
  return {
    x: (anchor.x + FIELD.wander * Math.cos(phase * speed + index * 1.7)) * width,
    y: (anchor.y + FIELD.wander * Math.sin(phase * speed * 0.9 + index * 2.3)) * height,
    radius: Math.max(width, height) * FIELD.radius,
  };
}

/**
 * A blob as a CSS radial gradient: `FIELD.alpha` at the centre to nothing at
 * the rim, along a smoothstep so it has no visible ring where it ends —
 * `FIELD.stops` stops, each band narrow (CLAUDE.md, there is no Skia).
 * Ending on the colour at alpha 0, never `transparent`: Android interpolates
 * a gradient unpremultiplied.
 */
export function blobGradient(color: string): string {
  const stops: string[] = [];
  for (let i = 0; i <= FIELD.stops; i += 1) {
    const t = i / FIELD.stops;
    const eased = 1 - t * t * (3 - 2 * t);
    stops.push(
      `${withAlpha(color, Math.round(FIELD.alpha * eased * 1000) / 1000)} ${Math.round(t * 1000) / 10}%`
    );
  }
  return `radial-gradient(circle at center, ${stops.join(', ')})`;
}

/** A field's colours as one key: the same colours are the same field. */
export const fieldKey = (colors: readonly string[]) => colors.join(',');

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
const LOOKUP = (() => {
  const table = new Int16Array(128).fill(-1);
  for (let i = 0; i < BASE64.length; i += 1) table[BASE64.charCodeAt(i)] = i;
  return table;
})();

/**
 * Base64 to bytes — a captured frame comes over the bridge as a string. Its
 * own, so nothing depends on which engine has `atob`. Skips anything that is
 * not in the alphabet (line breaks, padding).
 */
export function base64ToBytes(text: string): Uint8Array {
  const out = new Uint8Array(Math.floor((text.length * 3) / 4));
  let buffer = 0;
  let bits = 0;
  let length = 0;
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i);
    const value = code < 128 ? LOOKUP[code] : -1;
    if (value < 0) continue;
    /* Only the last fourteen bits are ever read. */
    buffer = ((buffer << 6) | value) & 0xffffff;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out[length] = (buffer >> bits) & 0xff;
      length += 1;
    }
  }
  return out.subarray(0, length);
}
