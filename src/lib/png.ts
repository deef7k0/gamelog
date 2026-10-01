/**
 * A PNG decoder small enough to read a logo's pixels in JavaScript.
 *
 * It exists for one job: `measureLogoLuminance` needs the RGBA of a studio's
 * Commons logo to decide whether it can be drawn as it is on a dark page. That
 * used to be Skia's (`Image.MakeImageFromEncoded` → `readPixels`), and it was
 * the last thing Skia did in this app — the glows it drew are CSS gradients
 * now — so an 8–15 MB native library per CPU architecture was in every APK to
 * decode a handful of 250px images. This is a few hundred lines, pure, and
 * under `npm test`.
 *
 * ## What it reads
 *
 * Every colour type (grey, RGB, palette, grey + alpha, RGBA) at every legal bit
 * depth, with a `tRNS` chunk's transparency for the three types that have one.
 * 16-bit samples keep their high byte. Wikimedia's thumbnailer emits 8-bit
 * palette or RGBA files, so the rest is completeness, not need.
 *
 * **Not interlaced files.** Adam7 is seven sub-images and nothing this app
 * fetches uses it; one is answered with null, as anything malformed is, and the
 * caller treats null as "unmeasured" — which draws the logo light, the legible
 * failure. CRCs are not checked: a corrupt file either fails to inflate or
 * yields a wrong mean, and neither is worse than not measuring.
 *
 * ## Inflate
 *
 * A port of Mark Adler's `puff.c` — zlib's reference decoder, written for
 * clarity and verifiability rather than speed — onto typed arrays, writing into
 * an output buffer allocated at exactly the size the image header implies. The
 * bit-at-a-time Huffman decode is slow next to a table-driven one and does not
 * need to be fast: a 250px logo is ~80 KB of pixels, a few milliseconds.
 */

export type DecodedImage = {
  width: number;
  height: number;
  /** RGBA, 8 bits per channel, row-major, unpremultiplied. */
  data: Uint8Array;
};

/** The largest image this will decode. A logo is ~20k pixels; this is a backstop. */
const DEFAULT_MAX_PIXELS = 4_000_000;

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Channels per pixel for each PNG colour type. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

/** The bit depths the spec allows for each colour type. */
const DEPTHS: Record<number, readonly number[]> = {
  0: [1, 2, 4, 8, 16],
  2: [8, 16],
  3: [1, 2, 4, 8],
  4: [8, 16],
  6: [8, 16],
};

/**
 * Decode a PNG into RGBA, or null when it is not one this can read.
 *
 * Never throws: every failure — a wrong signature, a truncated stream, an
 * unsupported layout, an image over `maxPixels` — is null.
 */
export function decodePng(
  bytes: Uint8Array,
  { maxPixels = DEFAULT_MAX_PIXELS }: { maxPixels?: number } = {}
): DecodedImage | null {
  try {
    return decode(bytes, maxPixels);
  } catch {
    return null;
  }
}

function decode(bytes: Uint8Array, maxPixels: number): DecodedImage | null {
  if (bytes.length < SIGNATURE.length) return null;
  for (let i = 0; i < SIGNATURE.length; i++) {
    if (bytes[i] !== SIGNATURE[i]) return null;
  }

  let width = 0;
  let height = 0;
  let depth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  let transparency: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let idatLength = 0;

  let offset = SIGNATURE.length;
  while (offset + 8 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = String.fromCharCode(
      bytes[offset + 4],
      bytes[offset + 5],
      bytes[offset + 6],
      bytes[offset + 7]
    );
    const start = offset + 8;
    const end = start + length;
    if (end + 4 > bytes.length) return null;
    const chunk = bytes.subarray(start, end);

    if (type === 'IHDR') {
      if (length < 13) return null;
      width = readUint32(chunk, 0);
      height = readUint32(chunk, 4);
      depth = chunk[8];
      colorType = chunk[9];
      /* Compression and filter method 0 are the only ones defined; interlace
         method 1 is Adam7, which this does not read. */
      if (chunk[10] !== 0 || chunk[11] !== 0 || chunk[12] !== 0) return null;
    } else if (type === 'PLTE') {
      palette = chunk;
    } else if (type === 'tRNS') {
      transparency = chunk;
    } else if (type === 'IDAT') {
      idat.push(chunk);
      idatLength += length;
    } else if (type === 'IEND') {
      break;
    }
    offset = end + 4; // past the CRC
  }

  const channels = CHANNELS[colorType];
  if (!channels || !DEPTHS[colorType].includes(depth)) return null;
  if (width <= 0 || height <= 0 || width * height > maxPixels) return null;
  if (colorType === 3 && !palette) return null;
  if (idat.length === 0) return null;

  const stream = idat.length === 1 ? idat[0] : concat(idat, idatLength);
  const rowBytes = Math.ceil((width * channels * depth) / 8);
  /* One filter-type byte at the head of every row. */
  const filtered = inflateZlib(stream, height * (rowBytes + 1));
  const pixels = unfilter(filtered, width, height, rowBytes, Math.max(1, (channels * depth) >> 3));

  return {
    width,
    height,
    data: toRgba(pixels, width, height, rowBytes, colorType, depth, palette, transparency),
  };
}

function readUint32(bytes: Uint8Array, at: number): number {
  return ((bytes[at] << 24) | (bytes[at + 1] << 16) | (bytes[at + 2] << 8) | bytes[at + 3]) >>> 0;
}

function concat(parts: Uint8Array[], length: number): Uint8Array {
  const joined = new Uint8Array(length);
  let at = 0;
  for (const part of parts) {
    joined.set(part, at);
    at += part.length;
  }
  return joined;
}

// ---------------------------------------------------------------------------
// Filters
// ---------------------------------------------------------------------------

/**
 * Undo each row's filter, returning the rows packed without their type bytes.
 *
 * `bpp` is the filters' "bytes per complete pixel", rounded up to one for
 * sub-byte depths, which is what the spec's left neighbour is measured in.
 */
function unfilter(
  filtered: Uint8Array,
  width: number,
  height: number,
  rowBytes: number,
  bpp: number
): Uint8Array {
  const out = new Uint8Array(height * rowBytes);
  let source = 0;

  for (let y = 0; y < height; y++) {
    const filter = filtered[source++];
    const row = y * rowBytes;
    const above = row - rowBytes; // negative on the first row: no row above

    for (let x = 0; x < rowBytes; x++) {
      const raw = filtered[source++];
      const left = x >= bpp ? out[row + x - bpp] : 0;
      const up = y > 0 ? out[above + x] : 0;
      let value: number;

      switch (filter) {
        case 0:
          value = raw;
          break;
        case 1:
          value = raw + left;
          break;
        case 2:
          value = raw + up;
          break;
        case 3:
          value = raw + ((left + up) >> 1);
          break;
        case 4: {
          const upLeft = x >= bpp && y > 0 ? out[above + x - bpp] : 0;
          value = raw + paeth(left, up, upLeft);
          break;
        }
        default:
          throw new Error(`Unknown PNG filter ${filter}`);
      }
      out[row + x] = value & 0xff;
    }
  }
  return out;
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

// ---------------------------------------------------------------------------
// Colour
// ---------------------------------------------------------------------------

function toRgba(
  pixels: Uint8Array,
  width: number,
  height: number,
  rowBytes: number,
  colorType: number,
  depth: number,
  palette: Uint8Array | null,
  transparency: Uint8Array | null
): Uint8Array {
  const rgba = new Uint8Array(width * height * 4);
  /* One loop per colour type rather than a branch per pixel. 16-bit samples
     are two bytes, high byte first: `step` skips to the next sample and the
     high byte is the one kept. */
  const step = depth === 16 ? 2 : 1;
  let o = 0;

  if (colorType === 6) {
    const stride = 4 * step;
    for (let y = 0; y < height; y++) {
      for (let i = y * rowBytes, end = i + width * stride; i < end; i += stride, o += 4) {
        rgba[o] = pixels[i];
        rgba[o + 1] = pixels[i + step];
        rgba[o + 2] = pixels[i + 2 * step];
        rgba[o + 3] = pixels[i + 3 * step];
      }
    }
    return rgba;
  }

  if (colorType === 4) {
    const stride = 2 * step;
    for (let y = 0; y < height; y++) {
      for (let i = y * rowBytes, end = i + width * stride; i < end; i += stride, o += 4) {
        rgba[o] = rgba[o + 1] = rgba[o + 2] = pixels[i];
        rgba[o + 3] = pixels[i + step];
      }
    }
    return rgba;
  }

  if (colorType === 2) {
    /* The `tRNS` key colour, compared at the file's own depth. */
    const key =
      transparency && transparency.length >= 6
        ? [
            (transparency[0] << 8) | transparency[1],
            (transparency[2] << 8) | transparency[3],
            (transparency[4] << 8) | transparency[5],
          ]
        : null;
    const stride = 3 * step;
    for (let y = 0; y < height; y++) {
      for (let i = y * rowBytes, end = i + width * stride; i < end; i += stride, o += 4) {
        rgba[o] = pixels[i];
        rgba[o + 1] = pixels[i + step];
        rgba[o + 2] = pixels[i + 2 * step];
        rgba[o + 3] =
          key &&
          sample(pixels, i, step) === key[0] &&
          sample(pixels, i + step, step) === key[1] &&
          sample(pixels, i + 2 * step, step) === key[2]
            ? 0
            : 255;
      }
    }
    return rgba;
  }

  if (colorType === 3) {
    /* An index past the palette's end draws black, as most decoders draw it. */
    const colors = palette ?? new Uint8Array(0);
    const alphas = transparency ?? new Uint8Array(0);
    for (let y = 0; y < height; y++) {
      const row = y * rowBytes;
      for (let x = 0; x < width; x++, o += 4) {
        const index = depth === 8 ? pixels[row + x] : packedSample(pixels, row, x, depth);
        const p = index * 3;
        if (p + 2 < colors.length) {
          rgba[o] = colors[p];
          rgba[o + 1] = colors[p + 1];
          rgba[o + 2] = colors[p + 2];
        }
        rgba[o + 3] = index < alphas.length ? alphas[index] : 255;
      }
    }
    return rgba;
  }

  // 0: greyscale, at any depth, with an optional `tRNS` key at the file's depth.
  const key =
    transparency && transparency.length >= 2 ? (transparency[0] << 8) | transparency[1] : -1;
  const scale = depth < 8 ? 255 / ((1 << depth) - 1) : 1;
  for (let y = 0; y < height; y++) {
    const row = y * rowBytes;
    for (let x = 0; x < width; x++, o += 4) {
      let gray: number;
      let raw: number;
      if (depth === 16) {
        gray = pixels[row + x * 2];
        raw = (gray << 8) | pixels[row + x * 2 + 1];
      } else {
        raw = depth === 8 ? pixels[row + x] : packedSample(pixels, row, x, depth);
        gray = Math.round(raw * scale);
      }
      rgba[o] = rgba[o + 1] = rgba[o + 2] = gray;
      rgba[o + 3] = raw === key ? 0 : 255;
    }
  }
  return rgba;
}

/** A sample at the file's own depth: the byte, or two bytes as one number for 16-bit. */
function sample(pixels: Uint8Array, at: number, step: number): number {
  return step === 2 ? (pixels[at] << 8) | pixels[at + 1] : pixels[at];
}

/** The `x`th sample of a row packed below 8 bits per sample, most significant first. */
function packedSample(pixels: Uint8Array, row: number, x: number, depth: number): number {
  const bit = x * depth;
  const byte = pixels[row + (bit >> 3)];
  return (byte >> (8 - depth - (bit & 7))) & ((1 << depth) - 1);
}

// ---------------------------------------------------------------------------
// Inflate (RFC 1950 / 1951), after puff.c
// ---------------------------------------------------------------------------

const MAX_BITS = 15;
const MAX_LIT_CODES = 286;
const MAX_DIST_CODES = 30;
const FIXED_LIT_CODES = 288;

const LENGTH_BASE = [
  3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59, 67, 83, 99, 115, 131,
  163, 195, 227, 258,
];
const LENGTH_EXTRA = [
  0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 5, 5, 5, 5, 0,
];
const DIST_BASE = [
  1, 2, 3, 4, 5, 7, 9, 13, 17, 25, 33, 49, 65, 97, 129, 193, 257, 385, 513, 769, 1025, 1537, 2049,
  3073, 4097, 6145, 8193, 12289, 16385, 24577,
];
const DIST_EXTRA = [
  0, 0, 0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6, 7, 7, 8, 8, 9, 9, 10, 10, 11, 11, 12, 12, 13, 13,
];
/** The order code-length code lengths arrive in, in a dynamic block's header. */
const CODE_LENGTH_ORDER = [16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15];

type Huffman = { count: Uint16Array; symbol: Uint16Array };

/** The fixed block's codes never change, so they are built once, on first use. */
let fixedCodes: { lit: Huffman; dist: Huffman } | null = null;

/**
 * Inflate a zlib stream into a buffer of exactly `size` bytes.
 *
 * Throws on anything malformed — a bad header, a preset dictionary, an invalid
 * code, output that over- or under-runs `size` — and `decodePng` turns that
 * into null. The Adler-32 trailer is not checked, for the reason CRCs are not.
 */
export function inflateZlib(stream: Uint8Array, size: number): Uint8Array {
  if (stream.length < 2) throw new Error('Truncated zlib stream');
  const cmf = stream[0];
  const flg = stream[1];
  if ((cmf & 0x0f) !== 8 || ((cmf << 8) | flg) % 31 !== 0 || flg & 0x20) {
    throw new Error('Not a zlib stream this can read');
  }
  const out = new Uint8Array(size);
  const written = new Inflater(stream, 2, out).run();
  if (written !== size) throw new Error('Inflated to the wrong size');
  return out;
}

/* Fields assigned in the constructor rather than as parameter properties:
   `npm test` runs this file under Node's type stripping, which cannot read them. */
class Inflater {
  private readonly input: Uint8Array;
  private readonly out: Uint8Array;
  private inPos: number;
  private bitBuf = 0;
  private bitCnt = 0;
  private outPos = 0;

  constructor(input: Uint8Array, inPos: number, out: Uint8Array) {
    this.input = input;
    this.inPos = inPos;
    this.out = out;
  }

  run(): number {
    let last = 0;
    do {
      last = this.bits(1);
      const type = this.bits(2);
      if (type === 0) this.stored();
      else if (type === 1) this.fixed();
      else if (type === 2) this.dynamic();
      else throw new Error('Invalid deflate block type');
    } while (!last);
    return this.outPos;
  }

  /** `need` bits, least significant first. `need` ≤ 13, so this stays in 32-bit ints. */
  private bits(need: number): number {
    let value = this.bitBuf;
    while (this.bitCnt < need) {
      if (this.inPos >= this.input.length) throw new Error('Out of input');
      value |= this.input[this.inPos++] << this.bitCnt;
      this.bitCnt += 8;
    }
    this.bitBuf = value >>> need;
    this.bitCnt -= need;
    return value & ((1 << need) - 1);
  }

  private stored(): void {
    /* Leftover bits are the rest of the byte the header was read from. */
    this.bitBuf = 0;
    this.bitCnt = 0;
    if (this.inPos + 4 > this.input.length) throw new Error('Out of input');
    const length = this.input[this.inPos] | (this.input[this.inPos + 1] << 8);
    const check = this.input[this.inPos + 2] | (this.input[this.inPos + 3] << 8);
    this.inPos += 4;
    if (length !== (~check & 0xffff)) throw new Error('Stored block length does not check');
    if (this.inPos + length > this.input.length) throw new Error('Out of input');
    if (this.outPos + length > this.out.length) throw new Error('Output overrun');
    this.out.set(this.input.subarray(this.inPos, this.inPos + length), this.outPos);
    this.inPos += length;
    this.outPos += length;
  }

  private fixed(): void {
    if (!fixedCodes) {
      const lengths = new Uint8Array(FIXED_LIT_CODES);
      lengths.fill(8, 0, 144);
      lengths.fill(9, 144, 256);
      lengths.fill(7, 256, 280);
      lengths.fill(8, 280, FIXED_LIT_CODES);
      const lit = huffman(lengths, 0, FIXED_LIT_CODES);
      const dist = huffman(new Uint8Array(MAX_DIST_CODES).fill(5), 0, MAX_DIST_CODES);
      fixedCodes = { lit: lit.code, dist: dist.code };
    }
    this.codes(fixedCodes.lit, fixedCodes.dist);
  }

  private dynamic(): void {
    const litCount = this.bits(5) + 257;
    const distCount = this.bits(5) + 1;
    const codeCount = this.bits(4) + 4;
    if (litCount > MAX_LIT_CODES || distCount > MAX_DIST_CODES) {
      throw new Error('Bad dynamic block counts');
    }

    const lengths = new Uint8Array(MAX_LIT_CODES + MAX_DIST_CODES);
    for (let i = 0; i < codeCount; i++) lengths[CODE_LENGTH_ORDER[i]] = this.bits(3);
    const lengthCode = huffman(lengths, 0, 19);
    if (lengthCode.left !== 0) throw new Error('Incomplete code-length code');

    /* The code-length code's own lengths are done with: reuse the array. */
    lengths.fill(0, 0, 19);
    let index = 0;
    while (index < litCount + distCount) {
      let symbol = this.decode(lengthCode.code);
      if (symbol < 16) {
        lengths[index++] = symbol;
        continue;
      }
      let repeat = 0;
      if (symbol === 16) {
        if (index === 0) throw new Error('Repeat with no previous length');
        repeat = lengths[index - 1];
        symbol = 3 + this.bits(2);
      } else if (symbol === 17) {
        symbol = 3 + this.bits(3);
      } else {
        symbol = 11 + this.bits(7);
      }
      if (index + symbol > litCount + distCount) throw new Error('Too many lengths');
      lengths.fill(repeat, index, index + symbol);
      index += symbol;
    }
    if (lengths[256] === 0) throw new Error('No end-of-block code');

    const lit = huffman(lengths, 0, litCount);
    /* An incomplete code is legal only when it is a single code (puff.c). */
    if (lit.left < 0 || (lit.left > 0 && litCount !== lit.code.count[0] + lit.code.count[1])) {
      throw new Error('Bad literal/length code');
    }
    const dist = huffman(lengths, litCount, distCount);
    if (dist.left < 0 || (dist.left > 0 && distCount !== dist.code.count[0] + dist.code.count[1])) {
      throw new Error('Bad distance code');
    }
    this.codes(lit.code, dist.code);
  }

  private codes(lit: Huffman, dist: Huffman): void {
    const out = this.out;
    for (;;) {
      let symbol = this.decode(lit);
      if (symbol < 256) {
        if (this.outPos >= out.length) throw new Error('Output overrun');
        out[this.outPos++] = symbol;
        continue;
      }
      if (symbol === 256) return;

      symbol -= 257;
      if (symbol >= 29) throw new Error('Bad length symbol');
      let length = LENGTH_BASE[symbol] + this.bits(LENGTH_EXTRA[symbol]);
      const distSymbol = this.decode(dist);
      if (distSymbol >= 30) throw new Error('Bad distance symbol');
      const distance = DIST_BASE[distSymbol] + this.bits(DIST_EXTRA[distSymbol]);
      if (distance > this.outPos) throw new Error('Distance too far back');
      if (this.outPos + length > out.length) throw new Error('Output overrun');
      /* Byte by byte: a copy may overlap what it is writing (distance < length). */
      let from = this.outPos - distance;
      while (length-- > 0) out[this.outPos++] = out[from++];
    }
  }

  /**
   * One symbol of a canonical Huffman code, a bit at a time (puff.c `decode`).
   *
   * The bit reader is inlined: this runs once per symbol and once per bit
   * inside it, and a method call per bit was most of the decode's time.
   */
  private decode(code: Huffman): number {
    const counts = code.count;
    let bitBuf = this.bitBuf;
    let bitCnt = this.bitCnt;
    let value = 0;
    let first = 0;
    let index = 0;
    for (let length = 1; length <= MAX_BITS; length++) {
      if (bitCnt === 0) {
        if (this.inPos >= this.input.length) throw new Error('Out of input');
        bitBuf = this.input[this.inPos++];
        bitCnt = 8;
      }
      value |= bitBuf & 1;
      bitBuf >>>= 1;
      bitCnt--;
      const count = counts[length];
      if (value - count < first) {
        this.bitBuf = bitBuf;
        this.bitCnt = bitCnt;
        return code.symbol[index + (value - first)];
      }
      index += count;
      first = (first + count) << 1;
      value <<= 1;
    }
    throw new Error('Ran out of codes');
  }
}

/**
 * A canonical Huffman code from code lengths (puff.c `construct`).
 *
 * `left` is the number of unused codes: 0 for a complete code, positive for an
 * incomplete one, negative for an over-subscribed one, which is always invalid.
 */
function huffman(lengths: Uint8Array, offset: number, n: number): { code: Huffman; left: number } {
  const count = new Uint16Array(MAX_BITS + 1);
  const symbol = new Uint16Array(n);
  for (let i = 0; i < n; i++) count[lengths[offset + i]]++;
  if (count[0] === n) return { code: { count, symbol }, left: 0 };

  let left = 1;
  for (let length = 1; length <= MAX_BITS; length++) {
    left = (left << 1) - count[length];
    if (left < 0) return { code: { count, symbol }, left };
  }

  const offs = new Uint16Array(MAX_BITS + 1);
  for (let length = 1; length < MAX_BITS; length++) offs[length + 1] = offs[length] + count[length];
  for (let i = 0; i < n; i++) {
    const length = lengths[offset + i];
    if (length !== 0) symbol[offs[length]++] = i;
  }
  return { code: { count, symbol }, left };
}
