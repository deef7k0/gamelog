import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { contrast } from './color.ts';
import {
  dominantSwatch,
  immersiveBackground,
  logoNeedsLightInk,
  meanOpaqueLuminance,
  smoothScrimStops,
  towardBlack,
} from './immersive-color.ts';

/** An RGBA buffer from runs of `[hex, pixelCount]`, the way a decoded thumbnail arrives. */
function image(runs: [string, number][], alpha = 255): Uint8Array {
  const total = runs.reduce((sum, [, count]) => sum + count, 0);
  const data = new Uint8Array(total * 4);
  let offset = 0;
  for (const [hex, count] of runs) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    for (let i = 0; i < count; i += 1) {
      data.set([r, g, b, alpha], offset);
      offset += 4;
    }
  }
  return data;
}

describe('dominantSwatch (Palette port)', () => {
  it('returns the colour that covers the most of the image, quantised as Palette does', () => {
    /* #9C3D8A quantises to 5 bits per channel and widens back to #983888. */
    const swatch = dominantSwatch(
      image([
        ['#9C3D8A', 6000],
        ['#2050C0', 2100],
      ])
    );
    assert.equal(swatch?.color, '#983888');
    assert.equal(swatch?.population, 6000);
  });

  it('lets greys through, so black-and-white art gives a grey page', () => {
    assert.equal(
      dominantSwatch(
        image([
          ['#4D4D4D', 5000],
          ['#000000', 3100],
        ])
      )?.color,
      '#484848'
    );
  });

  it('filters near-black and near-white out, and gives up when nothing else is left', () => {
    assert.equal(
      dominantSwatch(
        image([
          ['#000000', 4000],
          ['#FFFFFF', 4100],
        ])
      ),
      null
    );
    assert.equal(dominantSwatch(image([['#050505', 8100]])), null);
  });

  it('filters the skin-tone band, as Palette’s default filter does', () => {
    /* Tan sits on Palette's "red I line" (hue 10–37°, saturation ≤ 0.82). */
    assert.equal(
      dominantSwatch(
        image([
          ['#C8966E', 6000],
          ['#2050C0', 2100],
        ])
      )?.color,
      '#2050C0'
    );
  });

  it('median-cuts an image with more than sixteen colours and keeps the largest box', () => {
    const gradient: [string, number][] = [];
    for (let i = 0; i < 64; i += 1) {
      const v = (40 + i * 2).toString(16).padStart(2, '0');
      gradient.push([`#${v}20${v}`, 20]);
    }
    const swatch = dominantSwatch(image([...gradient, ['#20A040', 4000]]));
    assert.ok(swatch);
    /* The flat green block outweighs any one slice of the purple gradient. */
    const { r, g, b } = {
      r: parseInt(swatch.color.slice(1, 3), 16),
      g: parseInt(swatch.color.slice(3, 5), 16),
      b: parseInt(swatch.color.slice(5, 7), 16),
    };
    assert.ok(g > r && g > b, `expected a green swatch, got ${swatch.color}`);
  });

  it('ignores a truncated trailing pixel instead of reading past the buffer', () => {
    const data = new Uint8Array([60, 90, 200, 255, 60, 90]);
    assert.equal(dominantSwatch(data)?.color, '#3858C8');
  });
});

describe('immersiveBackground (toImmersiveBackground, in Oklab)', () => {
  /* Reference values from an independent Oklab implementation. */
  it('matches the reference darkening', () => {
    assert.equal(immersiveBackground('#FFFFFF'), '#161616');
    assert.equal(immersiveBackground('#808080'), '#232323');
    assert.equal(immersiveBackground('#000000'), '#000000');
    assert.equal(immersiveBackground('#983888'), '#350E2F');
  });

  it('reproduces SimpMusic’s measured pages', () => {
    /* Interpol's black-and-white photo page measures #1A1A1A; the off-white
       "This Mirror Weighs a Ton" page #1B1B1B. */
    assert.equal(immersiveBackground('#4D4D4D'), '#1A1A1A');
    assert.equal(immersiveBackground('#E0E0E0'), '#1D1D1D');
  });

  it('darkens in Oklab, not in sRGB', () => {
    /* sRGB would give #333333 for white at 0.8. */
    assert.equal(towardBlack('#FFFFFF', 0.8), '#161616');
  });

  it('keeps the quietest ink at AA when asked to', () => {
    for (const dominant of ['#FF3030', '#30FF30', '#3030FF', '#FFE000', '#00E0E0', '#B0B0B0']) {
      const page = immersiveBackground(dominant, { ink: '#8F8F8F' });
      assert.ok(
        contrast('#8F8F8F', page) >= 4.5,
        `${dominant} → ${page} is ${contrast('#8F8F8F', page).toFixed(2)}:1`
      );
    }
  });

  it('passes a non-hex value through rather than inventing a colour', () => {
    assert.equal(immersiveBackground('transparent'), 'transparent');
  });
});

describe('smoothScrimStops (artworkScrimBrush)', () => {
  it('runs from clear to opaque over 25 stops, eased at both ends', () => {
    const { locations, alphas } = smoothScrimStops();
    assert.equal(locations.length, 25);
    assert.equal(alphas[0], 0);
    assert.equal(alphas[24], 1);
    assert.equal(alphas[12], 0.5);
    /* Flat at the ends: the first and last steps move less than a straight line. */
    assert.ok(alphas[1] < 1 / 24);
    assert.ok(1 - alphas[23] < 1 / 24);
    for (let i = 1; i < alphas.length; i += 1) assert.ok(alphas[i] > alphas[i - 1]);
  });
});

describe('logos on the page', () => {
  it('measures the ink of the opaque pixels only', () => {
    assert.equal(meanOpaqueLuminance(image([['#000000', 100]])), 0);
    assert.equal(meanOpaqueLuminance(image([['#FFFFFF', 100]])), 1);
    assert.equal(meanOpaqueLuminance(image([['#FFFFFF', 100]], 0)), null);
    const half = meanOpaqueLuminance(new Uint8Array([255, 255, 255, 255, 0, 0, 0, 0]));
    assert.equal(half, 1);
  });

  it('draws a dark logo light, and leaves a legible one as it is', () => {
    const page = '#1B1B1B';
    /* FromSoftware: pure black type. */
    assert.equal(logoNeedsLightInk(0, page), true);
    /* Mojang Studios: white type on a red block, mean luminance 0.46. */
    assert.equal(logoNeedsLightInk(0.461, page), false);
    /* Valve: bright red-orange, 0.25. */
    assert.equal(logoNeedsLightInk(0.248, page), false);
    /* Supergiant Games: dark red, 0.133 — 3.0:1 on this page, just on the floor. */
    assert.equal(logoNeedsLightInk(0.133, page), false);
    /* A navy wordmark (#1A2A5A, 0.025) would be 1.4:1: drawn light. */
    assert.equal(logoNeedsLightInk(0.025, page), true);
    /* Not measured (the web build has no decoder): drawn light. */
    assert.equal(logoNeedsLightInk(null, page), true);
  });
});
