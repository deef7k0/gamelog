import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { revealOffset, TOP_BAR_ROW } from '../constants/top-bar.ts';
import {
  HERO_MOTION,
  SHELF_REVEAL,
  blurAmount,
  darkenOpacity,
  heroProgress,
  parallaxShift,
  shelfArrived,
  smoothstep,
  stretchOf,
  zoomOf,
} from './scroll-motion.ts';

/** A hero on a 360 × 800 phone with a 24dp status bar: the game page's 38%. */
const HERO = 304;
const BAR = 24 + TOP_BAR_ROW;
const DISTANCE = revealOffset(HERO, BAR);

const steps = (count: number) => Array.from({ length: count + 1 }, (_, i) => i / count);

describe('the hero as the page scrolls', () => {
  it('is at rest at the top, and done when the bar comes in', () => {
    assert.equal(heroProgress(0, DISTANCE), 0);
    assert.equal(heroProgress(DISTANCE, DISTANCE), 1);
    assert.equal(heroProgress(DISTANCE * 3, DISTANCE), 1, 'and stays done');
    assert.equal(heroProgress(-80, DISTANCE), 0, 'a bounce is not progress');
  });

  it('is sharp at rest and soft by the time it is gone', () => {
    assert.equal(blurAmount(0, HERO_MOTION.blurFrom), 0);
    assert.equal(blurAmount(HERO_MOTION.blurFrom, HERO_MOTION.blurFrom), 0);
    assert.equal(blurAmount(1, HERO_MOTION.blurFrom), 1);
  });

  it('moves without blur for a tiny bit then softens in clear view', () => {
    /* The owner's direction: blur begins earlier (0.08) so blurring is clearly
       visible on-screen, reaching 100% right before going out of bounds (0.85). */
    assert.equal(blurAmount(0, HERO_MOTION.blurFrom, HERO_MOTION.blurTo), 0);
    assert.equal(blurAmount(0.05, HERO_MOTION.blurFrom, HERO_MOTION.blurTo), 0);
    assert.ok(blurAmount(0.5, HERO_MOTION.blurFrom, HERO_MOTION.blurTo) > 0);
    assert.equal(blurAmount(HERO_MOTION.blurTo, HERO_MOTION.blurFrom, HERO_MOTION.blurTo), 1);
  });

  it('grows a little as it softens, and not before', () => {
    assert.equal(zoomOf(0, HERO_MOTION.blurFrom, HERO_MOTION.zoom), 1);
    assert.equal(zoomOf(HERO_MOTION.blurFrom, HERO_MOTION.blurFrom, HERO_MOTION.zoom), 1);
    assert.equal(zoomOf(1, HERO_MOTION.blurFrom, HERO_MOTION.zoom), HERO_MOTION.zoom);
    /* "Zooms in a little": it grows, and by a little. */
    assert.ok(HERO_MOTION.zoom > 1 && HERO_MOTION.zoom <= 1.15);
  });

  it('keeps its colour at rest and has the darker one once the bar is in', () => {
    assert.equal(darkenOpacity(0), 0);
    assert.equal(darkenOpacity(1), 1);
  });

  it('darkens the page over the whole way, and the picture softens inside that', () => {
    assert.ok(darkenOpacity(0.3) > 0);
    assert.ok(blurAmount(0.3, HERO_MOTION.blurFrom, HERO_MOTION.blurTo) > 0);
  });

  it('only ever goes one way as the page goes down', () => {
    let blur = 0;
    let dark = 0;
    let zoom = 1;
    for (const p of steps(400)) {
      const b = blurAmount(p, HERO_MOTION.blurFrom);
      const d = darkenOpacity(p);
      const z = zoomOf(p, HERO_MOTION.blurFrom, HERO_MOTION.zoom);
      assert.ok(b >= blur - 1e-12 && d >= dark - 1e-12 && z >= zoom - 1e-12, `at ${p}`);
      blur = b;
      dark = d;
      zoom = z;
    }
  });

  it('has no edge where it starts or stops: flat at both ends', () => {
    /* The eye follows the rate of change; a ramp that starts at full speed is
       a jolt the moment a thumb touches the page. */
    const e = 1e-4;
    assert.ok(smoothstep(0, 1, e) < 1e-6);
    assert.ok(1 - smoothstep(0, 1, 1 - e) < 1e-6);
    assert.ok(darkenOpacity(e) < 1e-6);
  });

  it('draws the blurred copy past its frame, as the reference does', () => {
    assert.equal(HERO_MOTION.blurScale, 1.1);
    assert.equal(HERO_MOTION.groundMs, 600);
  });
});

describe('the picture travelling with the page', () => {
  it('falls behind it, and does not overtake it', () => {
    /* The owner's (2026-10-23): "It scrolls with the user, it goes down, but it
       always stays behind the page". Lag, never lead. */
    assert.ok(HERO_MOTION.parallax > 0 && HERO_MOTION.parallax < 1);
    assert.equal(parallaxShift(0, HERO_MOTION.parallax, HERO), 0);
    assert.equal(parallaxShift(100, HERO_MOTION.parallax, HERO), 40);
  });

  it('does nothing on an overscroll — the stretch answers that', () => {
    assert.equal(parallaxShift(-120, HERO_MOTION.parallax, HERO), 0);
  });

  it('never uncovers the top of the frame on screen', () => {
    /*
     * The frame is in flow, so at an offset of `s` its top is at `-s` on the
     * display; the picture inside is pushed down by `k·s`, which leaves the
     * band from `-s` to `-s + k·s` with no picture in it. That band is above
     * the display for every offset, which is what makes a plain translate
     * enough — no taller image, no second copy.
     */
    for (const offset of [1, 10, 60, 150, 216, 400, 900]) {
      const shift = parallaxShift(offset, HERO_MOTION.parallax, HERO);
      const uncoveredFoot = -offset + shift;
      assert.ok(uncoveredFoot <= 0, `uncovered down to ${uncoveredFoot} at ${offset}`);
    }
  });

  it('stops once the whole picture has been pushed past its frame', () => {
    assert.equal(parallaxShift(10_000, HERO_MOTION.parallax, HERO), HERO);
  });
});

describe('the hero pulled past the top (iOS)', () => {
  it('does nothing at rest or while the page is read', () => {
    assert.deepEqual(stretchOf(0, HERO), { scale: 1, translateY: 0 });
    assert.deepEqual(stretchOf(120, HERO), { scale: 1, translateY: 0 });
  });

  it('keeps its top at the top of the display and its foot with the page', () => {
    for (const offset of [-1, -40, -120, -300]) {
      const { scale, translateY } = stretchOf(offset, HERO);
      /* The page has moved down by -offset; the hero is laid out there and
         scaled about its centre. */
      const laidAt = -offset;
      const centre = laidAt + HERO / 2;
      const top = centre - (HERO * scale) / 2 + translateY;
      const foot = centre + (HERO * scale) / 2 + translateY;
      assert.ok(Math.abs(top) < 1e-9, `top at ${top} for ${offset}`);
      assert.ok(Math.abs(foot - (laidAt + HERO)) < 1e-9, `foot at ${foot} for ${offset}`);
    }
  });
});

describe('a shelf arriving', () => {
  it('waits until its top is well inside the screen', () => {
    assert.equal(shelfArrived(800, 800, SHELF_REVEAL.inset), false);
    assert.equal(shelfArrived(800 - SHELF_REVEAL.inset, 800, SHELF_REVEAL.inset), false);
    assert.equal(shelfArrived(800 - SHELF_REVEAL.inset - 1, 800, SHELF_REVEAL.inset), true);
  });

  it('rises a little and lands softly', () => {
    assert.ok(SHELF_REVEAL.rise > 0 && SHELF_REVEAL.rise <= 24);
    assert.ok(SHELF_REVEAL.ms >= 400 && SHELF_REVEAL.ms <= 700);
    /* An ease-out: the first control point leaves fast, the second lands flat. */
    const [x1, y1, x2, y2] = SHELF_REVEAL.easing;
    assert.ok(y1 / x1 > 3, 'leaves fast');
    assert.equal(y2, 1, 'lands flat');
    assert.ok(x2 < 1);
  });
});

describe('the source', () => {
  it('gives no worklet a default — one would throw on a phone', () => {
    /* A parameter default is evaluated before a worklet's closure is unpacked
       (CLAUDE.md § Gotchas); under Node it would pass and on a phone throw. */
    const source = readFileSync(new URL('./scroll-motion.ts', import.meta.url), 'utf8');
    const worklets = [...source.matchAll(/export function (\w+)\(([^)]*)\)[^\n]*\n\s*'worklet'/g)];
    const exported = [...source.matchAll(/export function (\w+)/g)].map(([, name]) => name);
    /* Every function here runs on the UI thread, so every one is marked — a
       new one that is not would run on the JS thread and be a dropped frame a
       scroll. */
    assert.deepEqual(
      worklets.map(([, name]) => name),
      exported
    );
    for (const [, name, parameters] of worklets) assert.doesNotMatch(parameters, /=/, name);
  });
});
