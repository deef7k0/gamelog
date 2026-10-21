/**
 * SimpMusic's Apple Music page, ported: an artwork's own colours reduced to a
 * mesh and hung from where the artwork stops, so the colour directly under
 * the picture is the colour the picture ended on and there is no join to hide.
 *
 * Read from SimpMusic's source, not its screens —
 * `ui/screen/player/content/applemusic/AppleMusicMeshBackdrop.kt` (the mesh)
 * and `NowPlayingContentAppleMusic.kt` (the top wash) — for the game page's
 * cover viewer, at the owner's direction (2026-10-21): "The space left below
 * should be filled with the same effect that SimpMusic uses for their Apple
 * Music Now Playing screen style, with the blur from the image,
 * fading/blending into the artwork above."
 *
 * How it is built, step for step as the reference does it:
 *
 *  - the artwork is averaged into a `MESH_GRID` square of means, read
 *    bottom-up, so row 0 is its bottom edge;
 *  - every mean is lifted (`lifted`): averaging greys a block, so saturation
 *    gets back roughly what averaging took, and lightness is floored just off
 *    black;
 *  - every row but row 0 is shifted sideways by a seeded amount and mirrored
 *    half the time — a flip alone reads as a reflection of a face or a logo;
 *    the shift breaks that without putting side by side two colours that were
 *    not neighbours in the artwork;
 *  - the grid is resampled with smoothstep, which is what makes it smooth.
 *
 * **One departure: the blur is in the texture.** The reference resamples to
 * 32 and then blurs the page 44dp as it draws it. There is nothing to blur
 * with at draw time here (no Skia, by § APK size), and without it the six
 * cells read as blocks — seen on a contact sheet of four real covers. So the
 * texture is finer (`MESH_TEX`, 64) and blurred before it is drawn
 * (`MESH_SIGMA`, a Gaussian), clamped at its edges as the reference's blur
 * is, and the platform's bilinear filter does the rest. The held first row
 * above the seam is the blurred texture's first row, so the two meet without
 * a step.
 *
 * It is drawn as an image — a 64×64 BMP in a data URI, a few kilobytes — not
 * as a picture put behind the page to borrow its colour (CLAUDE.md, the
 * Ambience rule): it fills exactly the region it is for and has no edge.
 *
 * Pure — no React Native, no network — so `npm test` covers it. The decode is
 * `hooks/use-artwork-mesh.ts`; the drawing is `<ArtworkMeshPage>`.
 */

/** How many cells across: enough that a cover's layout survives, few enough that nothing recognisable does. */
export const MESH_GRID = 6;

/** What the grid is smoothed to before the platform stretches it. The reference's 32, doubled — see above. */
export const MESH_TEX = 64;

/**
 * The blur, in texels of the 64 across: about the reference's 44dp on a
 * 360dp-wide page (Android turns a blur radius into a sigma of ~0.58 of it,
 * ~25dp, which is four and a half of these texels).
 */
export const MESH_SIGMA = 4.5;

/** The reference's saturation lift and lightness floor. */
const MESH_VIBRANCE = 1.12;
const MESH_FLOOR = 0.045;

/**
 * The scrim over the whole page: black from 6% at the top to 30% at the foot,
 * on smoothstep — "just enough to keep white text readable over a bright
 * sleeve. The colours are the sleeve's own, so a sleeve that ends dark should
 * leave a dark page, not a greyed one."
 */
export const MESH_SCRIM = { top: 0.06, bottom: 0.3 } as const;

/**
 * The wash under the status bar: as dark as the artwork's own top band is
 * bright, 16%–65%, so a dark cover is left almost untouched and a bright one
 * still carries white icons (the reference's `TOP_WASH_MIN_ALPHA` /
 * `TOP_WASH_MAX_ALPHA`).
 */
export const TOP_WASH = { min: 0.16, max: 0.65 } as const;

export type ArtworkMesh = {
  /** `MESH_TEX`² colours as 0xRRGGBB, row by row; row 0 is the artwork's bottom edge. */
  texels: number[];
  /** How bright the artwork's top band is, 0–1 — it sets the top wash. */
  topLuminance: number;
};

/** A 32-bit seed from a string: the same artwork always lands the same way. */
export function seedOf(text: string): number {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

/** mulberry32: small, seeded, and the same on every engine. */
function random(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The mesh of an RGBA image, or null when it has no pixels.
 *
 * `rgba` is row by row, top first, four bytes a pixel — what `jpeg-js`
 * decodes to. The image is read whole at its own aspect; the reference reads
 * it at 120 across first, and a 90×128 thumbnail is already that small.
 */
export function meshOf(
  rgba: Uint8Array | Uint8ClampedArray,
  width: number,
  height: number,
  seed: number
): ArtworkMesh | null {
  if (!(width > 0 && height > 0) || rgba.length < width * height * 4) return null;

  const cols = MESH_GRID;
  const rows = MESH_GRID;
  const cells = cols * rows;
  const red = new Float64Array(cells);
  const green = new Float64Array(cells);
  const blue = new Float64Array(cells);
  const count = new Uint32Array(cells);

  for (let y = 0; y < height; y += 1) {
    /* Flipped as it is read: row 0 of the grid is the artwork's bottom edge. */
    const rowBase = Math.floor(((height - 1 - y) * rows) / height) * cols;
    for (let x = 0; x < width; x += 1) {
      const cell = rowBase + Math.floor((x * cols) / width);
      const offset = (y * width + x) * 4;
      red[cell] += rgba[offset];
      green[cell] += rgba[offset + 1];
      blue[cell] += rgba[offset + 2];
      count[cell] += 1;
    }
  }

  const grid: number[] = [];
  for (let cell = 0; cell < cells; cell += 1) {
    const n = Math.max(1, count[cell]);
    grid.push(lifted(red[cell] / n, green[cell] / n, blue[cell] / n));
  }

  /* The grid's last row is the artwork's top band, read before any lifting. */
  let topSum = 0;
  let topPixels = 0;
  for (let cell = (rows - 1) * cols; cell < rows * cols; cell += 1) {
    topSum += 0.2126 * red[cell] + 0.7152 * green[cell] + 0.0722 * blue[cell];
    topPixels += count[cell];
  }
  const topLuminance = Math.min(1, Math.max(0, topSum / Math.max(1, topPixels) / 255));

  return {
    texels: blurred(
      resampled(rotatedBelowSeam(grid, cols, rows, seed), cols, rows, MESH_TEX),
      MESH_TEX,
      MESH_SIGMA
    ),
    topLuminance,
  };
}

/**
 * A separable Gaussian, edges clamped: past the top the first row goes on —
 * which is what is drawn above the seam, so the blur there is the truth —
 * and past the sides and the foot the edge colour does.
 */
function blurred(texels: number[], size: number, sigma: number): number[] {
  const radius = Math.ceil(sigma * 3);
  const weights: number[] = [];
  let total = 0;
  for (let offset = -radius; offset <= radius; offset += 1) {
    const weight = Math.exp(-(offset * offset) / (2 * sigma * sigma));
    weights.push(weight);
    total += weight;
  }
  const kernel = weights.map((weight) => weight / total);

  const pass = (source: Float64Array[], horizontal: boolean): Float64Array[] =>
    [0, 1, 2].map((channel) => {
      const from = source[channel];
      const out = new Float64Array(size * size);
      for (let y = 0; y < size; y += 1) {
        for (let x = 0; x < size; x += 1) {
          let sum = 0;
          for (let k = -radius; k <= radius; k += 1) {
            const sx = horizontal ? Math.min(size - 1, Math.max(0, x + k)) : x;
            const sy = horizontal ? y : Math.min(size - 1, Math.max(0, y + k));
            sum += from[sy * size + sx] * kernel[k + radius];
          }
          out[y * size + x] = sum;
        }
      }
      return out;
    });

  const planes = [16, 8, 0].map((shift) =>
    Float64Array.from(texels, (rgb) => (rgb >> shift) & 0xff)
  );
  const [r, g, b] = pass(pass(planes, true), false);
  return texels.map((_, index) => {
    const byte = (value: number) => Math.min(255, Math.max(0, Math.round(value)));
    return (byte(r[index]) << 16) | (byte(g[index]) << 8) | byte(b[index]);
  });
}

/**
 * Every row but the seam row, carried sideways by one seeded amount and
 * mirrored half the time. A cyclic shift keeps each cell's neighbours, so no
 * colour boundary is invented.
 */
function rotatedBelowSeam(grid: number[], cols: number, rows: number, seed: number): number[] {
  if (rows <= 1) return grid;
  const next = random(seed);
  const mirror = next() < 0.5;
  const shift = Math.floor(next() * cols);
  const out = grid.slice();
  for (let row = 1; row < rows; row += 1) {
    const base = row * cols;
    for (let x = 0; x < cols; x += 1) {
      const source = mirror ? cols - 1 - x : x;
      out[base + x] = grid[base + ((source + shift) % cols)];
    }
  }
  return out;
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function lerpRgb(from: number, to: number, t: number): number {
  if (t <= 0) return from;
  if (t >= 1) return to;
  const channel = (shift: number) => {
    const a = (from >> shift) & 0xff;
    const b = (to >> shift) & 0xff;
    return Math.min(255, Math.max(0, Math.round(a + (b - a) * t)));
  };
  return (channel(16) << 16) | (channel(8) << 8) | channel(0);
}

/**
 * Smoothstep between control points: bilinear alone leaves a crease at every
 * cell boundary once the grid is magnified to a screen; a curve that is flat
 * at each control point does not.
 */
function resampled(grid: number[], cols: number, rows: number, size: number): number[] {
  const out: number[] = new Array(size * size);
  for (let ty = 0; ty < size; ty += 1) {
    const fy = ((ty + 0.5) / size) * rows - 0.5;
    const y0 = Math.min(rows - 1, Math.max(0, Math.floor(fy)));
    const y1 = Math.min(rows - 1, y0 + 1);
    const wy = smoothstep(fy - y0);
    for (let tx = 0; tx < size; tx += 1) {
      const fx = ((tx + 0.5) / size) * cols - 0.5;
      const x0 = Math.min(cols - 1, Math.max(0, Math.floor(fx)));
      const x1 = Math.min(cols - 1, x0 + 1);
      const wx = smoothstep(fx - x0);
      const top = lerpRgb(grid[y0 * cols + x0], grid[y0 * cols + x1], wx);
      const bottom = lerpRgb(grid[y1 * cols + x0], grid[y1 * cols + x1], wx);
      out[ty * size + tx] = lerpRgb(top, bottom, wy);
    }
  }
  return out;
}

/**
 * The one liberty the reference takes with the colours: averaging greys a
 * block (the mean of a red stripe and the black around it is a dull maroon),
 * so saturation gets back roughly what averaging took, and lightness is
 * floored just off pure black. Neither touches the proportions.
 */
function lifted(r255: number, g255: number, b255: number): number {
  const r = r255 / 255;
  const g = g255 / 255;
  const b = b255 / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) {
    const grey = Math.round(Math.max(lightness, MESH_FLOOR) * 255);
    return (grey << 16) | (grey << 8) | grey;
  }
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue: number;
  if (max === r) hue = ((((g - b) / delta) % 6) + 6) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return hslToRgb(
    hue * 60,
    Math.min(1, Math.max(0, saturation * MESH_VIBRANCE)),
    Math.min(1, Math.max(MESH_FLOOR, lightness))
  );
}

function hslToRgb(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const hp = h / 60;
  const x = c * (1 - Math.abs((hp % 2) - 1));
  const [r1, g1, b1] =
    hp < 1
      ? [c, x, 0]
      : hp < 2
        ? [x, c, 0]
        : hp < 3
          ? [0, c, x]
          : hp < 4
            ? [0, x, c]
            : hp < 5
              ? [x, 0, c]
              : [c, 0, x];
  const m = l - c / 2;
  const byte = (v: number) => Math.min(255, Math.max(0, Math.round((v + m) * 255)));
  return (byte(r1) << 16) | (byte(g1) << 8) | byte(b1);
}

/**
 * The thumbnail a mesh is read from: IGDB's `t_cover_small`, the whole cover
 * fitted in 90×128 (about 5 KB) — not `t_thumb`, a square crop that would
 * cut the cover's foot, which is the row the page hangs from. A legacy Steam
 * cover reads its `capsule_sm_120`, as the accent does. Anything else has no
 * small copy to read, and gets no mesh.
 */
export function meshSourceUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  if (/\/t_[a-z0-9_]+\//i.test(uri)) return uri.replace(/\/t_[a-z0-9_]+\//i, '/t_cover_small/');
  const steam =
    /^(https:\/\/[^/]*steamstatic\.com\/(?:store_item_assets\/)?steam\/apps\/\d+\/)/.exec(uri);
  return steam ? `${steam[1]}capsule_sm_120.jpg` : null;
}

// ---------------------------------------------------------------------------
// Drawing it: a BMP the platform stretches
// ---------------------------------------------------------------------------

const BASE64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

function base64(bytes: Uint8Array): string {
  let out = '';
  for (let index = 0; index < bytes.length; index += 3) {
    const a = bytes[index];
    const b = index + 1 < bytes.length ? bytes[index + 1] : 0;
    const c = index + 2 < bytes.length ? bytes[index + 2] : 0;
    const triple = (a << 16) | (b << 8) | c;
    out += BASE64[(triple >> 18) & 63] + BASE64[(triple >> 12) & 63];
    out += index + 1 < bytes.length ? BASE64[(triple >> 6) & 63] : '=';
    out += index + 2 < bytes.length ? BASE64[triple & 63] : '=';
  }
  return out;
}

/**
 * Colours as an uncompressed 24-bit BMP, in a data URI: no checksum and no
 * compression to get wrong, and decoded by both platforms' own image codecs
 * (Android's BitmapFactory under Glide, iOS's ImageIO). `texels` are row by
 * row, top first; a BMP stores its rows bottom first, so they are written in
 * reverse.
 */
export function bmpDataUri(texels: readonly number[], width: number, height: number): string {
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelBytes = rowSize * height;
  const bytes = new Uint8Array(54 + pixelBytes);
  const view = new DataView(bytes.buffer);
  bytes[0] = 0x42;
  bytes[1] = 0x4d;
  view.setUint32(2, bytes.length, true);
  view.setUint32(10, 54, true);
  view.setUint32(14, 40, true);
  view.setInt32(18, width, true);
  view.setInt32(22, height, true);
  view.setUint16(26, 1, true);
  view.setUint16(28, 24, true);
  view.setUint32(34, pixelBytes, true);
  view.setInt32(38, 2835, true);
  view.setInt32(42, 2835, true);
  for (let y = 0; y < height; y += 1) {
    const row = 54 + (height - 1 - y) * rowSize;
    for (let x = 0; x < width; x += 1) {
      const rgb = texels[y * width + x];
      bytes[row + x * 3] = rgb & 0xff;
      bytes[row + x * 3 + 1] = (rgb >> 8) & 0xff;
      bytes[row + x * 3 + 2] = (rgb >> 16) & 0xff;
    }
  }
  return `data:image/bmp;base64,${base64(bytes)}`;
}

/** The whole mesh, and its first row alone — what is held behind the artwork, above the seam. */
export function meshImages(mesh: ArtworkMesh): { page: string; seam: string } {
  return {
    page: bmpDataUri(mesh.texels, MESH_TEX, MESH_TEX),
    seam: bmpDataUri(mesh.texels.slice(0, MESH_TEX), MESH_TEX, 1),
  };
}

// ---------------------------------------------------------------------------
// What is drawn over it
// ---------------------------------------------------------------------------

/** The top wash's strength for an artwork whose top band is this bright. */
export function topWashAlpha(topLuminance: number): number {
  const lum = Math.min(1, Math.max(0, topLuminance));
  return TOP_WASH.min + (TOP_WASH.max - TOP_WASH.min) * lum;
}

/** WCAG luminance of a colour with black laid over it at `veil`, composited in sRGB as drawn. */
function luminanceUnder(rgb: number, veil: number): number {
  const linear = (byte: number) => {
    const c = (byte * (1 - veil)) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return (
    0.2126 * linear((rgb >> 16) & 0xff) +
    0.7152 * linear((rgb >> 8) & 0xff) +
    0.0722 * linear(rgb & 0xff)
  );
}

/**
 * Whether white holds 3:1 — large bold type — everywhere on a band of the
 * page, under the scrim as it stands there. The Static and Animated keys
 * stand on the mesh, and a pale cover's mesh is pale: white on it is checked,
 * not assumed. `from` and `to` are the band's share of the mesh's height.
 */
export function whiteHoldsOn(mesh: ArtworkMesh, from = 0, to = 1): boolean {
  const first = Math.max(0, Math.floor(from * MESH_TEX));
  const last = Math.min(MESH_TEX - 1, Math.ceil(to * MESH_TEX));
  for (let ty = first; ty <= last; ty += 1) {
    const scrim =
      MESH_SCRIM.top + (MESH_SCRIM.bottom - MESH_SCRIM.top) * smoothstep(ty / (MESH_TEX - 1));
    for (let tx = 0; tx < MESH_TEX; tx += 1) {
      const lum = luminanceUnder(mesh.texels[ty * MESH_TEX + tx], scrim);
      if (1.05 / (lum + 0.05) < 3) return false;
    }
  }
  return true;
}
