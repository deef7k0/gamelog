import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { RAIL, SECTION, coversInView, footHeight, railLayout } from './cover-rail';

/** The phones this ships to, narrowest to widest. */
const DISPLAYS = [320, 360, 375, 393, 412, 430];

/** A game page's own inset at 360dp (`useSectionMetrics`). */
const GAME_PAGE_INSET = 20;

describe('a row of covers', () => {
  it('is 120 by 180, twenty apart, on a 360dp phone — the size it always was', () => {
    assert.deepEqual(railLayout(360), { cover: { width: 120, height: 180 }, gap: 20 });
  });

  it('is never the small cover the owner called too tiny', () => {
    for (const display of DISPLAYS) {
      /* 22.8% of the display, for one build. */
      assert.ok(railLayout(display).cover.width > display * 0.3, `${display}dp`);
    }
  });

  it('keeps box art two to three at every width', () => {
    for (const display of DISPLAYS) {
      const { cover } = railLayout(display);
      assert.ok(
        Math.abs(cover.width / cover.height - RAIL.aspect) < 0.01,
        `${display}dp: ${cover.width}×${cover.height}`
      );
    }
  });

  it('stops growing past the content width', () => {
    assert.deepEqual(railLayout(1200), railLayout(800));
  });

  it('shows two covers whole and about half of the third, from the page’s margin', () => {
    for (const display of DISPLAYS) {
      const layout = railLayout(display);
      /* The row starts at the margin and runs off the far edge of the screen. */
      const inView = coversInView(layout, display - SECTION.margin);
      assert.ok(inView > 2.4 && inView < 2.75, `${display}dp: ${inView.toFixed(2)} in view`);
    }
  });

  it('still shows a good part of the third from a game page’s wider inset', () => {
    for (const display of DISPLAYS) {
      const layout = railLayout(display);
      const inset = (GAME_PAGE_INSET * display) / 360;
      const inView = coversInView(layout, display - inset);
      assert.ok(inView > 2.35 && inView < 2.75, `${display}dp: ${inView.toFixed(2)} in view`);
    }
  });

  it('counts covers by the pitch, the last as the share of it that shows', () => {
    const layout = { cover: { width: 80, height: 120 }, gap: 10 };
    assert.equal(coversInView(layout, 0), 0);
    assert.equal(coversInView(layout, 80), 1);
    assert.equal(coversInView(layout, 90), 1);
    assert.equal(coversInView(layout, 130), 1.5);
    assert.equal(coversInView(layout, 270), 3);
  });
});

describe('what stands under a cover', () => {
  it('is nothing, one line, or a face beside two lines', () => {
    assert.equal(footHeight('none'), 0);
    assert.equal(footHeight('line'), 8 + 15);
    assert.equal(footHeight('person'), 8 + 30);
  });
});

describe('a section on the page', () => {
  it('starts on the page’s margin', () => {
    /* `Spacing.x16` is 15. */
    assert.equal(SECTION.margin, 15);
  });
});
