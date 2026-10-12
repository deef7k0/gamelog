import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { SLIDE, slideHeight, slideScrimAt, slideScrimStops } from './search-spotlight';

const DISPLAYS = [320, 360, 375, 393, 412, 430];

describe('the slider', () => {
  it('is the reference’s shape: three across to two up', () => {
    assert.equal(slideHeight(360), 240);
    assert.equal(slideHeight(393), 262);
    /* The reference measured 1.48:1. */
    assert.ok(Math.abs(SLIDE.aspect - 1.48) < 0.03);
  });

  it('stops growing past the content width', () => {
    assert.equal(slideHeight(1200), slideHeight(800));
  });

  it('leaves room under the last line of text for its segments', () => {
    assert.ok(SLIDE.textBottom > SLIDE.segment.gap);
    assert.ok(SLIDE.segment.bottom + SLIDE.segment.height < 20);
  });
});

/** WCAG relative luminance of a grey at this linear-light share of white. */
const contrastOnWhiteArt = (alpha: number) => {
  /* White art under a black scrim of this alpha, composited in sRGB. */
  const channel = 1 - alpha;
  const linear = channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  /* The ink is `text`, #F5F5F5: luminance 0.913. */
  return (0.913 + 0.05) / (linear + 0.05);
};

describe('the darkening behind a slide’s words', () => {
  it('starts from nothing, with no slope, and ends at its peak', () => {
    const stops = slideScrimStops();
    assert.equal(stops[0].alpha, 0);
    assert.equal(stops.at(-1)?.alpha, SLIDE.scrimPeak);
    assert.ok(stops[1].alpha < SLIDE.scrimPeak * 0.1, 'the first band is the faintest');
    for (let index = 1; index < stops.length; index += 1) {
      assert.ok(stops[index].alpha >= stops[index - 1].alpha, `stop ${index}`);
    }
  });

  it('never blacks the art out', () => {
    assert.ok(SLIDE.scrimPeak < 0.9);
  });

  it('keeps the name and the line under it legible on white art, on every phone', () => {
    const foot = SLIDE.segment.bottom + SLIDE.segment.height + SLIDE.textBottom;
    /* One line of `bodySmall`, and over it the gap and `h2` twice. */
    const lineTop = foot + 15;
    const nameTop = lineTop + 4 + 25 * 2;

    for (const display of DISPLAYS) {
      const scrim = slideHeight(display) * SLIDE.scrim;
      const under = (fromFoot: number) => contrastOnWhiteArt(slideScrimAt(1 - fromFoot / scrim));

      /* The name is 20px bold — large text, which needs 3:1. Its first line
         is the highest thing set on the art, so this is the worst of it. */
      assert.ok(under(nameTop) >= 3, `${display}dp: the name at ${under(nameTop).toFixed(2)}:1`);
      /* The line under it is 11px and needs the full 4.5:1. */
      assert.ok(under(lineTop) >= 4.5, `${display}dp: the line at ${under(lineTop).toFixed(2)}:1`);
    }
  });
});
