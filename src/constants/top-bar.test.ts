import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  BAR_SLIDE,
  BAR_SPRING,
  FROST,
  HOME_BAR,
  TOP_BAR_DISC,
  TOP_BAR_DISC_ROOM,
  TOP_BAR_EDGE,
  TOP_BAR_GLYPH,
  TOP_BAR_KEY,
  TOP_BAR_KEY_FILL,
  TOP_BAR_ROW,
  TOP_BAR_SIDE,
  discShift,
  frostStrength,
  homeBarMoved,
  homeBarOpen,
  isScrolled,
  revealOffset,
  titleStart,
} from './top-bar';

/** Status bar insets this ships under: none (a modal on iOS), Android's, an iPhone's notch. */
const INSETS = [0, 24, 47, 59];

describe('the top bar’s size — SimpMusic’s, which is Material 3’s', () => {
  it('is a row 64 high', () => {
    /* `TopAppBarDefaults.TopAppBarExpandedHeight`. */
    assert.equal(TOP_BAR_ROW, 64);
  });

  it('holds a 24dp glyph in a control 48 to touch, its held circle 40', () => {
    assert.equal(TOP_BAR_GLYPH, 24);
    assert.equal(TOP_BAR_KEY, 48);
    assert.equal(TOP_BAR_KEY_FILL, 40);
    assert.ok(TOP_BAR_KEY <= TOP_BAR_ROW, 'a control fits the row');
  });

  it('is never smaller than a finger', () => {
    /* 48 is Android's floor and over iOS's 44. */
    assert.ok(TOP_BAR_KEY >= 48);
    assert.ok(TOP_BAR_DISC >= 48);
  });

  it('starts its title at 56 behind a chevron and 16 without one', () => {
    assert.equal(TOP_BAR_SIDE, 4);
    assert.equal(titleStart(true), 56);
    assert.equal(titleStart(false), 16);
  });

  it('puts the chevron’s glyph on the reference’s line, 16 from the edge', () => {
    assert.equal(TOP_BAR_SIDE + (TOP_BAR_KEY - TOP_BAR_GLYPH) / 2, 16);
  });
});

describe('the glass discs over artwork', () => {
  it('are the album screen’s: 48 across, 12 from the corner', () => {
    assert.equal(TOP_BAR_DISC, 48);
    assert.equal(TOP_BAR_EDGE, 12);
  });

  it('take 60 off the top of the page, which fits inside the bar’s row', () => {
    assert.equal(TOP_BAR_DISC_ROOM, 60);
    /* A page laid out under its discs is not under the bar that follows them. */
    assert.ok(TOP_BAR_DISC_ROOM <= TOP_BAR_ROW);
  });

  it('go exactly as far as the page does', () => {
    for (const inset of INSETS) {
      const limit = inset + TOP_BAR_DISC_ROOM;
      assert.equal(discShift(0, limit), 0);
      assert.equal(discShift(30, limit), -30);
      /* An overscroll at the top pulls them down with the art. */
      assert.equal(discShift(-20, limit), 20);
    }
  });

  it('stop once they are off the display', () => {
    for (const inset of INSETS) {
      const limit = inset + TOP_BAR_DISC_ROOM;
      assert.equal(discShift(limit, limit), -limit);
      assert.equal(discShift(4000, limit), -limit);
      assert.equal(discShift(-4000, limit), limit);
      /* Carried that far, a disc's foot is at the top edge or above it. */
      assert.ok(inset + TOP_BAR_DISC_ROOM + discShift(4000, limit) <= 0);
    }
  });
});

describe('the frost', () => {
  it('cross-fades over 300ms on Compose’s default easing', () => {
    assert.equal(FROST.ms, 300);
    assert.deepEqual(FROST.easing, [0.4, 0, 0.2, 1]);
  });

  it('is washed with the page’s colour at 30%, and 55% where the colour is artwork’s', () => {
    assert.equal(FROST.pageTint, 0.3);
    assert.equal(FROST.artTint, 0.55);
  });

  it('is a wash a title can be read through, and never a lid', () => {
    for (const tint of [FROST.pageTint, FROST.artTint]) {
      assert.ok(tint > 0 && tint < 0.6, `${tint}`);
    }
  });

  it('blurs harder than a disc does', () => {
    /* The reference's bar blurs by 24dp and its disc by 8; the disc here is 60. */
    assert.ok(FROST.intensity > 60 && FROST.intensity <= 100);
  });

  it('is never at a strength of nothing, on either platform', () => {
    /* Android's blur is set up at the strength it has when it is handed its
       target, and at exactly zero the platform throws "nativePtr is null" —
       which a bar that mounted clear logged on every screen. */
    assert.ok(FROST.floor > 0 && FROST.floor < 0.1);
    for (const max of [FROST.intensity, FROST.androidIntensity]) {
      for (const progress of [0, -0.2, 1e-9]) {
        assert.ok(frostStrength(progress, max, FROST.floor) > 0, `${max} at ${progress}`);
      }
    }
  });

  it('reaches its full strength, and only gets stronger on the way', () => {
    for (const max of [FROST.intensity, FROST.androidIntensity]) {
      assert.equal(frostStrength(1, max, FROST.floor), max);
      /* A spring may pass its mark by a hair; the blur does not. */
      assert.equal(frostStrength(1.04, max, FROST.floor), max);
      let last = 0;
      for (let step = 0; step <= 20; step++) {
        const now = frostStrength(step / 20, max, FROST.floor);
        assert.ok(now > last, `${max} at ${step / 20}`);
        last = now;
      }
    }
  });

  it('is asked of Android at a strength its own grey cannot be seen at', () => {
    /* expo-blur paints the material's grey over the blur at 55% of the
       strength (`TintStyle.kt`, systemUltraThinMaterialDark). At 85 that is a
       47% lid; here it is two parts in a hundred. */
    const grey = (strength: number) => 0.55 * (strength / 100);
    assert.ok(grey(FROST.intensity) > 0.4, 'which is why it is not 85 there');
    assert.ok(grey(FROST.androidIntensity) < 0.03);
  });

  it('is the same radius on Android as the bar it replaced: 80 over 4', () => {
    const reduction = FROST.androidIntensity / FROST.androidRadius;
    assert.ok(Math.abs(FROST.androidIntensity / reduction - FROST.androidRadius) < 1e-9);
    assert.ok(FROST.androidRadius >= 80 / 4);
    /* …and wider than a disc's, which is 60 over 4. */
    assert.ok(FROST.androidRadius > 60 / 4);
  });

  it('is there for any scroll at all, and not at rest', () => {
    assert.equal(isScrolled(0), false);
    /* A bounce settling back through a fraction of a point. */
    assert.equal(isScrolled(0.3), false);
    assert.equal(isScrolled(-40), false);
    assert.equal(isScrolled(1), true);
    assert.equal(isScrolled(900), true);
  });
});

describe('the bar that comes in after the artwork', () => {
  it('arrives as the header’s foot reaches the bar’s', () => {
    for (const inset of INSETS) {
      const bar = inset + TOP_BAR_ROW;
      /* A game's hero on a 360×800 phone: 38% of the display. */
      assert.equal(revealOffset(304, bar), 304 - bar);
      /* A collection's: half of it. */
      assert.equal(revealOffset(400, bar), 400 - bar);
    }
  });

  it('never arrives over the artwork it would have covered', () => {
    for (const inset of INSETS) {
      const bar = inset + TOP_BAR_ROW;
      for (const header of [200, 304, 400, 640]) {
        /* Scrolled that far, what is left of the header is no taller than the bar. */
        assert.ok(header - revealOffset(header, bar) <= bar, `${header} under ${inset}`);
      }
    }
  });

  it('waits for the page to move even when the header is shorter than the bar', () => {
    assert.equal(revealOffset(40, 111), 0);
    /* …and `isScrolled` is the other half of the test the bar makes. */
    assert.equal(isScrolled(revealOffset(40, 111)), false);
  });

  it('has left before the discs could be in its way, on every header the app has', () => {
    for (const inset of INSETS) {
      const bar = inset + TOP_BAR_ROW;
      /* The shortest header that opens a page here is a game's, on a short phone. */
      const header = Math.round(640 * 0.38);
      assert.ok(revealOffset(header, bar) >= 0);
      assert.ok(revealOffset(header, bar) + bar >= inset + TOP_BAR_DISC_ROOM);
    }
  });

  it('comes in on Compose’s default spring, which does not overshoot', () => {
    assert.equal(BAR_SPRING.stiffness, 400);
    /* Critically damped: 2√(k·m). */
    assert.equal(BAR_SPRING.damping, 2 * Math.sqrt(BAR_SPRING.stiffness * BAR_SPRING.mass));
  });

  it('slides from half its own height, as `slideInVertically()` does', () => {
    assert.equal(BAR_SLIDE, 0.5);
  });
});

describe('Home’s row', () => {
  const { hold, slop } = HOME_BAR;
  const open = (was: boolean, anchor: number, offset: number) =>
    homeBarOpen(was, anchor, offset, hold, slop);

  it('is open at the top of the page, whichever way it is going', () => {
    assert.equal(open(true, 0, 0), true);
    assert.equal(open(false, 0, hold), true);
    /* Reading down through the first shelf does not fold it. */
    assert.equal(open(true, 100, 250), true);
  });

  it('folds on the way down, past the first shelf', () => {
    assert.equal(open(true, hold + 100, hold + 100 + slop + 1), false);
  });

  it('comes back on the way up, from anywhere', () => {
    assert.equal(open(false, 2400, 2400 - slop - 1), true);
  });

  it('does not answer a thumb that is only resting', () => {
    for (const was of [true, false]) {
      assert.equal(open(was, 1000, 1000), was);
      assert.equal(open(was, 1000, 1000 + slop), was);
      assert.equal(open(was, 1000, 1000 - slop), was);
    }
  });

  it('takes a new anchor only once the page has really moved', () => {
    assert.equal(homeBarMoved(1000, 1000 + slop, slop), false);
    assert.equal(homeBarMoved(1000, 1000 - slop, slop), false);
    assert.equal(homeBarMoved(1000, 1000 + slop + 1, slop), true);
    assert.equal(homeBarMoved(1000, 1000 - slop - 1, slop), true);
  });

  it('follows a whole read down and back up', () => {
    let isOpen = true;
    let anchor = 0;
    const seen: boolean[] = [];
    const path = [0, 80, 200, 320, 480, 900, 1400, 1396, 1390, 1380, 1200, 600, 280, 0];
    for (const offset of path) {
      isOpen = open(isOpen, anchor, offset);
      if (homeBarMoved(anchor, offset, slop)) anchor = offset;
      seen.push(isOpen);
    }
    assert.deepEqual(seen, [
      true,
      true,
      true, // the first shelf
      false,
      false,
      false,
      false, // reading down
      false, // 4dp back: a tremor
      true,
      true,
      true,
      true, // on the way up
      true,
      true, // and home
    ]);
  });
});
