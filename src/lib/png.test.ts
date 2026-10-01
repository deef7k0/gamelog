import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { crc32, deflateSync, inflateSync } from 'node:zlib';

import { decodePng, inflateZlib } from './png.ts';

/**
 * Run with `npm test`.
 *
 * The decoder is checked against Node's own zlib, which shares no code with it:
 * every stream here is compressed by `deflateSync` and inflated twice, once by
 * Node and once by `inflateZlib`, and the two must agree byte for byte. The PNG
 * layer is checked by round trips through an encoder written here from the
 * spec — all five filters, every colour type and depth — and by one real file:
 * Nintendo's Commons logo as Wikimedia's thumbnailer serves it (250px, an 8-bit
 * palette with transparency; public domain), against an independent decode.
 */

// ---------------------------------------------------------------------------
// A PNG encoder, for building fixtures
// ---------------------------------------------------------------------------

type Fixture = {
  width: number;
  height: number;
  colorType: 0 | 2 | 3 | 4 | 6;
  depth: number;
  /** Each row's samples, packed at `depth`, unfiltered. */
  rows: Uint8Array[];
  /** The filter for each row; cycles through 0–4 when absent. */
  filters?: number[];
  palette?: number[];
  trns?: number[];
  interlace?: number;
  level?: number;
  /** Split the compressed stream into this many IDAT chunks. */
  idatChunks?: number;
};

const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function chunk(type: string, data: Uint8Array): Buffer {
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write(type, 4, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0);
  return Buffer.concat([head, data, crc]);
}

function filterRows(fixture: Fixture): Buffer {
  const { width, colorType, depth, rows } = fixture;
  const bpp = Math.max(1, (CHANNELS[colorType] * depth) >> 3);
  const rowBytes = Math.ceil((width * CHANNELS[colorType] * depth) / 8);
  const out: number[] = [];
  rows.forEach((row, y) => {
    assert.equal(row.length, rowBytes, 'fixture row length');
    const filter = fixture.filters?.[y] ?? y % 5;
    const prior = y > 0 ? rows[y - 1] : new Uint8Array(rowBytes);
    out.push(filter);
    for (let x = 0; x < rowBytes; x++) {
      const a = x >= bpp ? row[x - bpp] : 0;
      const b = prior[x];
      const c = x >= bpp ? prior[x - bpp] : 0;
      const predictor =
        filter === 0
          ? 0
          : filter === 1
            ? a
            : filter === 2
              ? b
              : filter === 3
                ? (a + b) >> 1
                : paeth(a, b, c);
      out.push((row[x] - predictor) & 0xff);
    }
  });
  return Buffer.from(out);
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function encode(fixture: Fixture): Uint8Array {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(fixture.width, 0);
  header.writeUInt32BE(fixture.height, 4);
  header[8] = fixture.depth;
  header[9] = fixture.colorType;
  header[12] = fixture.interlace ?? 0;

  const compressed = deflateSync(filterRows(fixture), { level: fixture.level ?? 6 });
  const pieces = fixture.idatChunks ?? 1;
  const size = Math.ceil(compressed.length / pieces);
  const idats: Buffer[] = [];
  for (let at = 0; at < compressed.length; at += size) {
    idats.push(chunk('IDAT', compressed.subarray(at, at + size)));
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    ...(fixture.palette ? [chunk('PLTE', Uint8Array.from(fixture.palette))] : []),
    ...(fixture.trns ? [chunk('tRNS', Uint8Array.from(fixture.trns))] : []),
    ...idats,
    chunk('IEND', new Uint8Array(0)),
  ]);
}

/** Deterministic bytes, so a failure reproduces. */
function noise(length: number, seed: number): Uint8Array {
  const out = new Uint8Array(length);
  let state = seed;
  for (let i = 0; i < length; i++) {
    state = (state * 1103515245 + 12345) & 0x7fffffff;
    out[i] = state >> 16;
  }
  return out;
}

function pixelAt(data: Uint8Array, width: number, x: number, y: number): number[] {
  const o = (y * width + x) * 4;
  return [data[o], data[o + 1], data[o + 2], data[o + 3]];
}

// ---------------------------------------------------------------------------

describe('inflateZlib', () => {
  const cases: [string, Uint8Array, number][] = [
    ['stored blocks (level 0)', noise(300, 1), 0],
    ['several stored blocks (over 64 KB)', noise(150_000, 2), 0],
    ['fixed Huffman (short input)', new TextEncoder().encode('a gamelog, a gamelog'), 9],
    ['dynamic Huffman', new TextEncoder().encode('Doom Eternal '.repeat(400)), 9],
    ['dynamic Huffman over noisy data', noise(70_000, 3).map((v) => v & 0x0f), 6],
    ['empty input', new Uint8Array(0), 6],
  ];

  for (const [name, input, level] of cases) {
    it(`agrees with Node's zlib: ${name}`, () => {
      const stream = deflateSync(input, { level });
      const ours = inflateZlib(stream, input.length);
      assert.deepEqual(Buffer.from(ours), inflateSync(stream));
    });
  }

  it('rejects a stream that inflates to a different size than the header promised', () => {
    const stream = deflateSync(noise(100, 4));
    assert.throws(() => inflateZlib(stream, 99));
    assert.throws(() => inflateZlib(stream, 101));
  });

  it('rejects a truncated stream and a non-zlib header', () => {
    const stream = deflateSync(noise(5_000, 5).map((v) => v & 7));
    assert.throws(() => inflateZlib(stream.subarray(0, stream.length >> 1), 5_000));
    assert.throws(() => inflateZlib(Uint8Array.from([0x00, 0x00, 0x00]), 1));
  });
});

describe('decodePng', () => {
  it('reads 8-bit RGBA through all five filters', () => {
    const width = 7;
    const height = 10; // two passes through filters 0–4
    const pixels = noise(width * height * 4, 6);
    const rows = Array.from({ length: height }, (_, y) =>
      pixels.subarray(y * width * 4, (y + 1) * width * 4)
    );
    const image = decodePng(encode({ width, height, colorType: 6, depth: 8, rows }));
    assert.ok(image);
    assert.equal(image.width, width);
    assert.equal(image.height, height);
    assert.deepEqual(image.data, pixels);
  });

  it('keeps the high byte of 16-bit RGBA', () => {
    const rows = [Uint8Array.from([0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0])];
    const image = decodePng(encode({ width: 1, height: 1, colorType: 6, depth: 16, rows }));
    assert.deepEqual(image && pixelAt(image.data, 1, 0, 0), [0x12, 0x56, 0x9a, 0xde]);
  });

  it('makes the tRNS key colour of an RGB image transparent', () => {
    const rows = [Uint8Array.from([10, 20, 30, 40, 50, 60])];
    const image = decodePng(
      encode({ width: 2, height: 1, colorType: 2, depth: 8, rows, trns: [0, 40, 0, 50, 0, 60] })
    );
    assert.ok(image);
    assert.deepEqual(pixelAt(image.data, 2, 0, 0), [10, 20, 30, 255]);
    assert.deepEqual(pixelAt(image.data, 2, 1, 0), [40, 50, 60, 0]);
  });

  it('compares a 16-bit RGB key at full depth', () => {
    const rows = [Uint8Array.from([1, 2, 3, 4, 5, 6, 1, 2, 3, 4, 5, 7])];
    const image = decodePng(
      encode({ width: 2, height: 1, colorType: 2, depth: 16, rows, trns: [1, 2, 3, 4, 5, 6] })
    );
    assert.ok(image);
    assert.equal(image.data[3], 0); // exact key
    assert.equal(image.data[7], 255); // differs only in the low byte
  });

  it('scales packed greyscale to 8 bits, at 1, 2 and 4 bits per sample', () => {
    // 1-bit: 1 0 1 1 0 0 0 1 | 1 (padded)
    let image = decodePng(
      encode({
        width: 9,
        height: 1,
        colorType: 0,
        depth: 1,
        rows: [Uint8Array.from([0b10110001, 0b10000000])],
      })
    );
    assert.deepEqual(
      Array.from({ length: 9 }, (_, x) => image?.data[x * 4]),
      [255, 0, 255, 255, 0, 0, 0, 255, 255]
    );
    // 2-bit: 0 1 2 3
    image = decodePng(
      encode({ width: 4, height: 1, colorType: 0, depth: 2, rows: [Uint8Array.from([0b00011011])] })
    );
    assert.deepEqual(
      Array.from({ length: 4 }, (_, x) => image?.data[x * 4]),
      [0, 85, 170, 255]
    );
    // 4-bit: 15 0 | 7 (padded)
    image = decodePng(
      encode({ width: 3, height: 1, colorType: 0, depth: 4, rows: [Uint8Array.from([0xf0, 0x70])] })
    );
    assert.deepEqual(
      Array.from({ length: 3 }, (_, x) => image?.data[x * 4]),
      [255, 0, 119]
    );
  });

  it('reads 16-bit greyscale with a tRNS key, and grey + alpha', () => {
    let image = decodePng(
      encode({
        width: 2,
        height: 1,
        colorType: 0,
        depth: 16,
        rows: [Uint8Array.from([0x80, 0x01, 0xff, 0xff])],
        trns: [0x80, 0x01],
      })
    );
    assert.deepEqual(image && pixelAt(image.data, 2, 0, 0), [0x80, 0x80, 0x80, 0]);
    assert.deepEqual(image && pixelAt(image.data, 2, 1, 0), [255, 255, 255, 255]);

    image = decodePng(
      encode({
        width: 2,
        height: 1,
        colorType: 4,
        depth: 8,
        rows: [Uint8Array.from([9, 200, 77, 0])],
      })
    );
    assert.deepEqual(image && pixelAt(image.data, 2, 0, 0), [9, 9, 9, 200]);
    assert.deepEqual(image && pixelAt(image.data, 2, 1, 0), [77, 77, 77, 0]);
  });

  it('expands a palette, with partial tRNS, at every packed depth', () => {
    const palette = [255, 0, 0, 0, 255, 0, 0, 0, 255, 9, 9, 9];
    const trns = [0, 128]; // entries 2 and 3 are opaque
    const expected = [
      [255, 0, 0, 0],
      [0, 255, 0, 128],
      [0, 0, 255, 255],
      [9, 9, 9, 255],
    ];
    const packed: Record<number, Uint8Array> = {
      1: Uint8Array.from([0b01000000]), // indices 0 1 — only two fit the palette at 1 bit
      2: Uint8Array.from([0b00011011]),
      4: Uint8Array.from([0x01, 0x23]),
      8: Uint8Array.from([0, 1, 2, 3]),
    };
    for (const depth of [1, 2, 4, 8]) {
      const width = depth === 1 ? 2 : 4;
      const image = decodePng(
        encode({ width, height: 1, colorType: 3, depth, rows: [packed[depth]], palette, trns })
      );
      assert.ok(image, `depth ${depth}`);
      for (let x = 0; x < width; x++) {
        assert.deepEqual(pixelAt(image.data, width, x, 0), expected[x], `depth ${depth}, x ${x}`);
      }
    }
  });

  it('joins image data split across several IDAT chunks', () => {
    const width = 40;
    const height = 30;
    const pixels = noise(width * height * 3, 7);
    const rows = Array.from({ length: height }, (_, y) =>
      pixels.subarray(y * width * 3, (y + 1) * width * 3)
    );
    const image = decodePng(encode({ width, height, colorType: 2, depth: 8, rows, idatChunks: 5 }));
    assert.ok(image);
    for (let i = 0; i < width * height; i++) {
      assert.deepEqual(
        [image.data[i * 4], image.data[i * 4 + 1], image.data[i * 4 + 2], image.data[i * 4 + 3]],
        [pixels[i * 3], pixels[i * 3 + 1], pixels[i * 3 + 2], 255]
      );
    }
  });

  it('answers null for what it does not read', () => {
    const rows = [Uint8Array.from([1, 2, 3, 4])];
    const good = encode({ width: 1, height: 1, colorType: 6, depth: 8, rows });
    assert.ok(decodePng(good));
    // Adam7 interlacing.
    assert.equal(
      decodePng(encode({ width: 1, height: 1, colorType: 6, depth: 8, rows, interlace: 1 })),
      null
    );
    // Not a PNG; a truncated one; one over the pixel budget; an illegal depth.
    assert.equal(decodePng(Uint8Array.from([0xff, 0xd8, 0xff, 0xe0])), null);
    assert.equal(decodePng(good.subarray(0, good.length - 20)), null);
    assert.equal(decodePng(good, { maxPixels: 0 }), null);
    assert.equal(
      decodePng(
        encode({ width: 1, height: 1, colorType: 2, depth: 4, rows: [Uint8Array.from([0, 0])] })
      ),
      null
    );
    // A palette image with no palette.
    assert.equal(
      decodePng(
        encode({ width: 1, height: 1, colorType: 3, depth: 8, rows: [Uint8Array.from([0])] })
      ),
      null
    );
  });

  it("decodes Wikimedia's thumbnail of a real logo exactly", () => {
    const file = readFileSync(new URL('./__fixtures__/nintendo-logo-250.png', import.meta.url));
    const bytes = new Uint8Array(file.buffer, file.byteOffset, file.byteLength);
    const image = decodePng(bytes);
    assert.ok(image);
    assert.equal(image.width, 250);
    assert.equal(image.height, 84);
    assert.deepEqual(image.data, referenceDecode(bytes));

    // White lettering on a Nintendo-red (#E60012) racetrack, transparent past
    // its rounded corners — which is what decides how the studio page draws it.
    const tally = new Map<string, number>();
    for (let i = 0; i < image.data.length; i += 4) {
      const key =
        image.data[i + 3] < 128
          ? 'clear'
          : `${image.data[i]},${image.data[i + 1]},${image.data[i + 2]}`;
      tally.set(key, (tally.get(key) ?? 0) + 1);
    }
    const ranked = [...tally].sort((a, b) => b[1] - a[1]).map(([key]) => key);
    assert.equal(ranked[0], '230,0,18');
    assert.equal(ranked[1], '255,255,255');
    assert.ok((tally.get('clear') ?? 0) > 0, 'the corners are transparent');
  });
});

/**
 * An independent decode of an 8-bit palette PNG for the real-file test: Node's
 * zlib for the inflate and a filter undo written separately from the module's.
 */
function referenceDecode(bytes: Uint8Array): Uint8Array {
  const view = Buffer.from(bytes);
  let at = 8;
  let width = 0;
  let height = 0;
  let palette = Buffer.alloc(0);
  let trns = Buffer.alloc(0);
  const idat: Buffer[] = [];
  while (at < view.length) {
    const length = view.readUInt32BE(at);
    const type = view.toString('ascii', at + 4, at + 8);
    const data = view.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      assert.equal(data[8], 8, 'fixture is 8-bit');
      assert.equal(data[9], 3, 'fixture is a palette image');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'tRNS') trns = data;
    else if (type === 'IDAT') idat.push(data);
    at += 12 + length;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const indices = Buffer.alloc(width * height);
  for (let y = 0; y < height; y++) {
    const filter = raw[y * (width + 1)];
    for (let x = 0; x < width; x++) {
      const value = raw[y * (width + 1) + 1 + x];
      const left = x > 0 ? indices[y * width + x - 1] : 0;
      const up = y > 0 ? indices[(y - 1) * width + x] : 0;
      const upLeft = x > 0 && y > 0 ? indices[(y - 1) * width + x - 1] : 0;
      const predictor = [0, left, up, (left + up) >> 1, paeth(left, up, upLeft)][filter];
      indices[y * width + x] = (value + predictor) & 0xff;
    }
  }

  const rgba = new Uint8Array(width * height * 4);
  for (let i = 0; i < width * height; i++) {
    const index = indices[i];
    rgba[i * 4] = palette[index * 3];
    rgba[i * 4 + 1] = palette[index * 3 + 1];
    rgba[i * 4 + 2] = palette[index * 3 + 2];
    rgba[i * 4 + 3] = index < trns.length ? trns[index] : 255;
  }
  return rgba;
}
