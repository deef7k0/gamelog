import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import jpeg from 'jpeg-js';

import {
  FIELD,
  base64ToBytes,
  blobAt,
  blobGradient,
  blobHolds,
  fieldColors,
  frameFieldColors,
  isLikelyBlackFrame,
  tuneBlob,
} from './artwork-field.ts';
import { contrast, hexToRgb, mix, toHsl } from './color.ts';
import { visibleRegion } from './key-color.ts';
import {
  ARTWORK_PALETTE,
  PAGE_COLOR,
  cropPixels,
  pageFrom,
  quietInk,
  readArtwork,
} from './page-color.ts';

const HEROES = [
  'god-of-war',
  'persona-5-royal',
  'the-witcher-3',
  'stardew-valley',
  'doom-eternal',
  'ark-survival-evolved',
];

function decodeHero(name: string) {
  return jpeg.decode(readFileSync(new URL(`./fixtures/page-color/${name}.jpg`, import.meta.url)), {
    useTArray: true,
  });
}

/** What the phone reads off a hero: the page, and its field. */
function fieldOf(name: string) {
  const image = decodeHero(name);
  const region = visibleRegion(image, { width: 1.18, height: 1 });
  const read = readArtwork(
    cropPixels(image.data, image.width, image.height, region, PAGE_COLOR.crop)
  );
  const page = read ? pageFrom(read.dominant) : PAGE_COLOR.rejected;
  return { read, page, field: fieldColors(read, page) };
}

const hueGap = (a: string, b: string) => {
  const d = Math.abs(toHsl(a)!.h - toHsl(b)!.h) % 360;
  return Math.min(d, 360 - d);
};

/** `top` laid over `under` at `alpha`, as a view with alpha draws it (in sRGB). */
const over = (under: string, top: string, alpha: number) => mix(under, top, alpha);

describe('the field, on real heroes', () => {
  for (const name of HEROES) {
    it(`${name}: four blobs, each holding the page’s two inks`, () => {
      const { page, field } = fieldOf(name);
      const quiet = quietInk(page);
      assert.equal(field.length, 4);
      for (const blob of field) assert.ok(blobHolds(blob, quiet), `${blob} on ${page}`);
    });
  }

  it('any blend of the blobs over the page still holds both inks', () => {
    /* The field is the page with blobs laid over it at up to FIELD.alpha, and
       over each other. A blend is never brighter than the brightest colour in
       it, so this is the claim the field rests on — checked, not assumed. */
    for (const name of HEROES) {
      const { page, field } = fieldOf(name);
      const quiet = quietInk(page);
      for (const a of field)
        for (const b of field)
          for (const t of [0.25, 0.5, FIELD.alpha]) {
            const composite = over(over(page, a, t), b, t);
            assert.ok(
              contrast(composite, '#FFFFFF') >= ARTWORK_PALETTE.read.white,
              `${name}: ${composite}`
            );
            assert.ok(
              contrast(composite, quiet) >= ARTWORK_PALETTE.read.quiet,
              `${name}: ${composite}`
            );
          }
    }
  });

  it('the accent leads the field', () => {
    for (const name of HEROES) {
      const { read, field } = fieldOf(name);
      if ((toHsl(read!.accent)?.s ?? 0) < ARTWORK_PALETTE.greyGuard) continue;
      assert.ok(hueGap(field[0], read!.accent) < 3, `${name}: ${field[0]} from ${read!.accent}`);
    }
  });

  it('Persona 5 Royal’s neutral page has its red in the field; ARK’s, its blue', () => {
    const persona = fieldOf('persona-5-royal').field[0];
    const hue = toHsl(persona)!.h;
    assert.ok(hue < 15 || hue > 345, persona);
    const ark = toHsl(fieldOf('ark-survival-evolved').field[0])!.h;
    assert.ok(ark > 190 && ark < 240, `ARK at ${ark}°`);
  });
});

describe('tuneBlob', () => {
  it('a grey stays grey', () => {
    const blob = tuneBlob('#707070', quietInk('#212121'));
    assert.ok(toHsl(blob)!.s < ARTWORK_PALETTE.greyGuard, blob);
  });

  it('a bright colour is brought down until both inks hold', () => {
    const page = '#173F63';
    const blob = tuneBlob('#88E0F0', quietInk(page));
    assert.ok(blobHolds(blob, quietInk(page)), blob);
  });
});

describe('fieldColors', () => {
  it('nothing read is no field: the page alone', () => {
    assert.deepEqual(fieldColors(null, '#212121'), []);
  });

  it('a picture of one colour still fills four blobs', () => {
    const one = {
      dominant: '#2050A0',
      accent: '#2050A0',
      swatches: [{ color: '#2050A0', population: 100 }],
    };
    const field = fieldColors(one, pageFrom('#2050A0'));
    assert.equal(field.length, 4);
  });
});

describe('a frame of the trailer', () => {
  const solid = (width: number, height: number, rgb: [number, number, number], noise = 0) => {
    const data = new Uint8Array(width * height * 4);
    for (let i = 0; i < width * height; i += 1) {
      const n = noise ? (i * 7919) % (noise + 1) : 0;
      data[i * 4] = rgb[0] + n;
      data[i * 4 + 1] = rgb[1] + n;
      data[i * 4 + 2] = rgb[2] + n;
      data[i * 4 + 3] = 255;
    }
    return data;
  };

  it('a black buffer is not a frame; the field keeps what it has', () => {
    assert.ok(isLikelyBlackFrame(solid(64, 36, [0, 0, 0]), 64, 36));
    assert.equal(frameFieldColors(solid(64, 36, [2, 2, 3]), 64, 36, '#212121'), null);
  });

  it('a dark frame with noise in it is a frame', () => {
    assert.ok(!isLikelyBlackFrame(solid(64, 36, [10, 12, 14], 8), 64, 36));
  });

  it('captured as a JPEG, sent as base64, decoded: the hero’s field comes back', () => {
    /* What the phone does every three seconds, end to end, on a real hero. */
    const image = decodeHero('stardew-valley');
    const encoded = jpeg.encode(
      { data: Buffer.from(image.data), width: image.width, height: image.height },
      80
    ).data;
    const bytes = base64ToBytes(Buffer.from(encoded).toString('base64'));
    const frame = jpeg.decode(bytes, { useTArray: true });
    const page = pageFrom('#173F63');
    const field = frameFieldColors(frame.data, frame.width, frame.height, page);
    assert.ok(field && field.length === 4);
    for (const blob of field!) assert.ok(blobHolds(blob, quietInk(page)), blob);
  });
});

describe('base64ToBytes', () => {
  it('agrees with Node’s, padding and line breaks included', () => {
    for (const length of [0, 1, 2, 3, 4, 5, 63, 64, 1000]) {
      const bytes = Uint8Array.from({ length }, (_, i) => (i * 131 + 7) % 256);
      const text = Buffer.from(bytes).toString('base64');
      assert.deepEqual(base64ToBytes(text), bytes, `length ${length}`);
      assert.deepEqual(
        base64ToBytes(text.replace(/(.{20})/g, '$1\n')),
        bytes,
        `wrapped, ${length}`
      );
    }
  });
});

describe('the geometry — BitChord’s MeshGradientBackground, number for number', () => {
  it('its anchors, speeds, radius, centre alpha and timings', () => {
    assert.deepEqual(
      FIELD.anchors.map((a) => [a.x, a.y]),
      [
        [0.2, 0.25],
        [0.8, 0.2],
        [0.75, 0.8],
        [0.25, 0.75],
      ]
    );
    assert.deepEqual([...FIELD.speeds], [1, -0.7, 0.85, -1.15]);
    assert.equal(FIELD.radius, 0.62);
    assert.equal(FIELD.alpha, 0.85);
    assert.equal(FIELD.fadeMs, 1400);
    assert.equal(FIELD.driftMs, 8000);
    assert.equal(FIELD.refreshMs, 3000);
    assert.ok(Math.abs(FIELD.driftRadians - Math.PI * 0.45) < 1e-12);
  });

  it('a blob orbits its anchor, 0.16 of the field from it at most', () => {
    for (let index = 0; index < 4; index += 1) {
      for (const phase of [0, 1, FIELD.driftRadians]) {
        const blob = blobAt(index, phase, 360, 800);
        const anchor = FIELD.anchors[index];
        assert.ok(Math.abs(blob.x / 360 - anchor.x) <= FIELD.wander + 1e-9);
        assert.ok(Math.abs(blob.y / 800 - anchor.y) <= FIELD.wander + 1e-9);
        assert.equal(blob.radius, 800 * FIELD.radius);
      }
    }
  });

  it('a blob is its colour at the centre alpha, easing to its colour at nothing', () => {
    const gradient = blobGradient('#2050A0');
    assert.ok(gradient.startsWith('radial-gradient(circle at center, '), gradient);
    assert.ok(!gradient.includes('transparent'), 'never the keyword (CLAUDE.md, gradients)');
    const stops = gradient.slice(gradient.indexOf(',') + 2, -1).split(/,\s(?=rgba|#)/);
    assert.equal(stops.length, FIELD.stops + 1);
    const rgb = hexToRgb('#2050A0')!;
    assert.ok(stops[0].includes(`${rgb.r}, ${rgb.g}, ${rgb.b}, ${FIELD.alpha}`), stops[0]);
    assert.ok(/, 0\) 100%$/.test(stops[stops.length - 1]), stops[stops.length - 1]);
  });
});
