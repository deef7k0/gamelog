import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { TOP_BAR_DISC_ROOM, TOP_BAR_ROW } from '../../constants/top-bar';

/*
 * The bar's measurements are in `constants/top-bar.ts`, with their own tests.
 * What is held here is that the things built on them still say what they
 * measure: the bar, the hooks a screen reserves room with, and the list a
 * page scrolls. None of the three can be loaded here — each reaches React
 * Native — so their sources are read.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

describe('the top bar', () => {
  const bar = read('./frosted-top-bar.tsx');
  const heights = read('../../hooks/use-header-height.ts');
  const scrollers = read('./page-scroll.tsx');

  it('has no size of its own — every number is the constants’', () => {
    /* A second `TOP_BAR_…` declared beside the first is how the disc and the
       room reserved for it came apart once. */
    assert.doesNotMatch(bar, /const TOP_BAR_[A-Z_]+ = \d/);
    assert.match(bar, /from '@\/constants\/top-bar'/);
  });

  it('reserves the bar’s row under a list, and the discs’ room under artwork', () => {
    assert.match(heights, /useTopBarInset\(modal\) \+ TOP_BAR_ROW/);
    assert.match(heights, /useTopBarInset\(modal\) \+ TOP_BAR_DISC_ROOM/);
    /* A page laid out under its discs does not move when the bar's row grows. */
    assert.equal(TOP_BAR_ROW - TOP_BAR_DISC_ROOM, 4);
  });

  it('is told how far the page has scrolled by the page’s own scroller', () => {
    /* The offset the bar reads and the one a page scroller writes are the
       same value, published by `<Screen>`. */
    assert.match(bar, /useScreenChrome\(\)\?\.scrollY/);
    assert.match(scrollers, /useScreenChrome\(\)\?\.scrollY/);
    assert.match(scrollers, /useScrollOffset\(scroller, offset\)/);
  });

  it('fades its light to white at nothing, never to a keyword', () => {
    /* Android interpolates a gradient unpremultiplied: `transparent` is black
       at zero, and a fade to it goes grey on the way. */
    const gradients = bar.match(/linear-gradient\([^']+\)/g) ?? [];
    assert.ok(gradients.length >= 2, 'the rim and the sheen');
    for (const gradient of gradients) assert.doesNotMatch(gradient, /transparent/);
  });

  it('is the page’s colour, not a blur — the glass discs alone blur', () => {
    /* The owner had the bar's blur removed (2026-10-14). The one `<BlurView>`
       left is the disc of glass over artwork, which is a button, not the bar. */
    assert.equal((bar.match(/^\s*<BlurView\b/gm) ?? []).length, 1);
    assert.doesNotMatch(bar, /AnimatedBlurView/);
  });

  it('keeps Home’s bar where it is: nothing folds it with the scroll', () => {
    /* "Make the home top bar stay at the top, it should not move with the
       scroll" (2026-10-14). */
    assert.doesNotMatch(bar, /homeBarOpen|homeBarMoved/);
  });

  it('gives no worklet a default that names a constant', () => {
    /* A parameter default is evaluated before a worklet's closure is unpacked
       (CLAUDE.md § Gotchas); under Node it would pass and on a phone throw. */
    const maths = read('../../constants/top-bar.ts');
    const worklets = maths.match(/export function \w+\([^)]*\)[^{]*\{\s*'worklet'/g) ?? [];
    assert.ok(worklets.length >= 5, 'the worklets are still marked');
    for (const worklet of worklets) assert.doesNotMatch(worklet, /=/, worklet);
  });
});
