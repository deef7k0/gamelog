import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MESH_TEX,
  TOP_WASH,
  bmpDataUri,
  meshImages,
  meshOf,
  meshSourceUrl,
  seedOf,
  topWashAlpha,
  whiteHoldsOn,
} from './artwork-mesh.ts';

/** An RGBA image from a function of (x, y), top row first. */
function image(width: number, height: number, at: (x: number, y: number) => number[]) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const [r, g, b] = at(x, y);
      data.set([r, g, b, 255], (y * width + x) * 4);
    }
  }
  return data;
}

const channels = (rgb: number) => [(rgb >> 16) & 0xff, (rgb >> 8) & 0xff, rgb & 0xff];
const RED = [200, 30, 30];
const BLUE = [20, 40, 210];

describe('meshOf', () => {
  /* A 90×128 thumbnail, as IGDB's t_cover_small is: red over blue. */
  const twoTone = image(90, 128, (_, y) => (y < 64 ? RED : BLUE));

  it('hangs the artwork’s bottom edge from the seam — row 0 is the foot', () => {
    const mesh = meshOf(twoTone, 90, 128, 1)!;
    const [r, , b] = channels(mesh.texels[0]);
    assert.ok(b > r, 'the first row under the art is the art’s own blue foot');
  });

  it('reads the top band for the wash, before any lifting', () => {
    const mesh = meshOf(twoTone, 90, 128, 1)!;
    const expected = (0.2126 * 200 + 0.7152 * 30 + 0.0722 * 30) / 255;
    assert.ok(Math.abs(mesh.topLuminance - expected) < 1e-9);
  });

  it('keeps the seam row as the artwork has it, left to right', () => {
    /* Black on the left of the foot, white on the right. */
    const ramp = image(90, 128, (x) => (x < 45 ? [0, 0, 0] : [255, 255, 255]));
    for (const seed of [1, 2, 3, 4, 5, 6, 7, 8]) {
      const mesh = meshOf(ramp, 90, 128, seed)!;
      const left = channels(mesh.texels[0])[0];
      const right = channels(mesh.texels[MESH_TEX - 1])[0];
      assert.ok(left < right, `seed ${seed}: the seam row is never shifted or mirrored`);
    }
  });

  it('lands the same artwork the same way every time', () => {
    const a = meshOf(twoTone, 90, 128, seedOf('co1wyy'))!;
    const b = meshOf(twoTone, 90, 128, seedOf('co1wyy'))!;
    assert.deepEqual(a.texels, b.texels);
  });

  it('leaves a black-and-white cover grey, and floored just off black', () => {
    const mesh = meshOf(
      image(90, 128, () => [0, 0, 0]),
      90,
      128,
      1
    )!;
    const [r, g, b] = channels(mesh.texels[0]);
    assert.equal(r, g);
    assert.equal(g, b);
    assert.ok(r > 0 && r < 16, `floored at ${r}`);
  });

  it('is smooth: no two neighbours differ by more than a step', () => {
    const mesh = meshOf(twoTone, 90, 128, 9)!;
    for (let y = 0; y < MESH_TEX; y += 1) {
      for (let x = 1; x < MESH_TEX; x += 1) {
        const a = channels(mesh.texels[y * MESH_TEX + x - 1]);
        const b = channels(mesh.texels[y * MESH_TEX + x]);
        for (let c = 0; c < 3; c += 1) assert.ok(Math.abs(a[c] - b[c]) <= 24);
      }
    }
  });

  it('has nothing to say about an image with no pixels', () => {
    assert.equal(meshOf(new Uint8Array(0), 0, 0, 1), null);
    assert.equal(meshOf(new Uint8Array(8), 90, 128, 1), null);
  });
});

describe('bmpDataUri', () => {
  it('writes a 24-bit BMP both platforms decode, rows bottom first', () => {
    const uri = bmpDataUri([0xff0000, 0x00ff00, 0x0000ff, 0xffffff], 2, 2);
    assert.ok(uri.startsWith('data:image/bmp;base64,'));
    const bytes = Buffer.from(uri.split(',')[1], 'base64');
    assert.equal(bytes.toString('latin1', 0, 2), 'BM');
    assert.equal(bytes.readUInt32LE(2), bytes.length);
    assert.equal(bytes.readInt32LE(18), 2);
    assert.equal(bytes.readInt32LE(22), 2);
    assert.equal(bytes.readUInt16LE(28), 24);
    /* Rows of 2×3 bytes are padded to 8. The first row stored is the bottom
       one: blue, white — in BGR. */
    assert.deepEqual([...bytes.subarray(54, 60)], [0xff, 0, 0, 0xff, 0xff, 0xff]);
    /* The top row, stored second: red, green. */
    assert.deepEqual([...bytes.subarray(62, 68)], [0, 0, 0xff, 0, 0xff, 0]);
  });

  it('draws the page and its held first row', () => {
    const mesh = meshOf(
      image(90, 128, () => BLUE),
      90,
      128,
      1
    )!;
    const { page, seam } = meshImages(mesh);
    const pageBytes = Buffer.from(page.split(',')[1], 'base64');
    const seamBytes = Buffer.from(seam.split(',')[1], 'base64');
    assert.equal(pageBytes.readInt32LE(22), MESH_TEX);
    assert.equal(seamBytes.readInt32LE(18), MESH_TEX);
    assert.equal(seamBytes.readInt32LE(22), 1);
  });
});

describe('the inks over it', () => {
  it('washes the status bar as dark as the art’s top is bright, within the reference’s range', () => {
    assert.equal(topWashAlpha(0), TOP_WASH.min);
    assert.equal(topWashAlpha(1), TOP_WASH.max);
    assert.equal(topWashAlpha(4), TOP_WASH.max);
  });

  it('keeps white on a dark cover’s page, and not on a pale one', () => {
    const dark = meshOf(
      image(90, 128, () => [30, 20, 60]),
      90,
      128,
      1
    )!;
    const pale = meshOf(
      image(90, 128, () => [235, 230, 220]),
      90,
      128,
      1
    )!;
    assert.equal(whiteHoldsOn(dark), true);
    assert.equal(whiteHoldsOn(pale), false);
  });
});

describe('meshSourceUrl', () => {
  it('reads the whole cover small — never the square crop that cuts its foot', () => {
    assert.equal(
      meshSourceUrl('https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg'),
      'https://images.igdb.com/igdb/image/upload/t_cover_small/co1wyy.jpg'
    );
    assert.equal(
      meshSourceUrl('https://images.igdb.com/igdb/image/upload/t_1080p/co1wyy.jpg'),
      'https://images.igdb.com/igdb/image/upload/t_cover_small/co1wyy.jpg'
    );
  });

  it('reads a legacy Steam cover’s small capsule, and nothing it cannot shrink', () => {
    assert.equal(
      meshSourceUrl(
        'https://shared.steamstatic.com/store_item_assets/steam/apps/730/library_600x900.jpg'
      ),
      'https://shared.steamstatic.com/store_item_assets/steam/apps/730/capsule_sm_120.jpg'
    );
    assert.equal(meshSourceUrl('https://example.com/cover.png'), null);
    assert.equal(meshSourceUrl(null), null);
  });
});
