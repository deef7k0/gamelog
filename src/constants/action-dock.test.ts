import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DOCK,
  DOCK_FOOT_SPACE,
  barProgress,
  capsuleBeside,
  circleAlpha,
  dockBottom,
  dockFootRoom,
  dockFrames,
  dockHeight,
  dockWidth,
  foldProgress,
  keysAlpha,
  labelAlpha,
  lerpFrame,
  type DockFrame,
  type DockState,
} from './action-dock.ts';
import { MINI_PLAYER_HEIGHT, MINI_PLAYER_MAX_WIDTH, MINI_PLAYER_SIDE } from './player.ts';
import { HOME_BAR, homeBarMoved, homeBarOpen } from './top-bar.ts';

/** A 360dp phone's row. */
const ROW = dockWidth(360);

const frames = (state: Partial<DockState>) =>
  dockFrames({ width: ROW, expanded: true, review: true, player: false, ...state });

const right = (frame: DockFrame) => frame.left + frame.width;
const middle = (frame: DockFrame) => frame.bottom + frame.height / 2;

describe('the docked actions, against SimpMusic’s folding bar', () => {
  it('take the reference’s sizes a step smaller, in its proportions', () => {
    /* The reference: FlatBarHeight 64, SearchSize 56, CollapsedBarSize 48 —
       each a step (8) apart. The owner had the bars made smaller (2026-10-14);
       the steps are kept. SearchGap, BarEdgePadding and BAR_MORPH_MS are the
       reference's own. */
    assert.equal(DOCK.bar, 56);
    assert.equal(DOCK.fab, DOCK.bar - 8);
    assert.equal(DOCK.folded, DOCK.fab - 8);
    assert.equal(DOCK.top, DOCK.fab);
    assert.ok(DOCK.key >= 48, 'a key stays at the tap floor');
    assert.equal(DOCK.fabGap, 12);
    assert.equal(DOCK.side, 16);
    assert.equal(DOCK.gap, 8);
    assert.equal(DOCK.morphMs, 300);
    assert.deepEqual(DOCK.easing, [0.4, 0, 0.2, 1]);
  });

  it('are the mini player’s width, and draw it no taller than its own capsule', () => {
    assert.equal(DOCK.side, MINI_PLAYER_SIDE);
    assert.equal(DOCK.maxWidth, MINI_PLAYER_MAX_WIDTH);
    assert.ok(DOCK.top <= MINI_PLAYER_HEIGHT);
    assert.equal(dockWidth(360), 328);
    assert.equal(dockWidth(1200), DOCK.maxWidth);
  });

  it('hold the keys in the capsule, their round ends concentric with its', () => {
    assert.equal(DOCK.key + DOCK.inset * 2, DOCK.bar);
    assert.equal(DOCK.bar / 2 - DOCK.inset, DOCK.key / 2);
  });
});

describe('the two layouts', () => {
  it('expanded: the review bar on its own over a capsule the full width', () => {
    const open = frames({});
    assert.deepEqual(open.actions, { left: 0, bottom: 0, width: ROW, height: DOCK.bar });
    assert.deepEqual(open.review, {
      left: 0,
      bottom: DOCK.bar + DOCK.gap,
      width: ROW,
      height: DOCK.top,
    });
    assert.equal(open.player, null);
  });

  it('contracted: the capsule makes room, the review a circle at its end', () => {
    const shut = frames({ expanded: false });
    assert.equal(shut.actions.width, capsuleBeside(ROW));
    assert.equal(shut.review!.width, DOCK.fab);
    assert.equal(shut.review!.height, DOCK.fab);
    assert.equal(right(shut.review!), ROW);
    assert.equal(shut.review!.left - right(shut.actions), DOCK.fabGap);
    assert.equal(middle(shut.review!), middle(shut.actions));
  });

  it('with music: the player over the capsule, the review a circle beside it', () => {
    const open = frames({ player: true });
    assert.equal(open.player!.width, ROW);
    assert.equal(open.player!.bottom, DOCK.bar + DOCK.gap);
    assert.equal(open.actions.width, capsuleBeside(ROW));
    assert.equal(right(open.review!), ROW);
  });

  it('with music, contracted: folded capsule, the player, the review — the reference’s row', () => {
    const shut = frames({ player: true, expanded: false });
    assert.deepEqual(
      [shut.actions.left, shut.actions.width, shut.actions.height],
      [0, DOCK.folded, DOCK.folded]
    );
    assert.equal(shut.player!.left - right(shut.actions), DOCK.gap);
    assert.equal(shut.review!.left - right(shut.player!), DOCK.gap);
    assert.equal(right(shut.review!), ROW);
    for (const frame of [shut.actions, shut.player!, shut.review!]) {
      assert.equal(middle(frame), DOCK.bar / 2);
    }
  });

  it('for a game not out yet: the capsule alone, folding to its circle', () => {
    const open = frames({ review: false });
    const shut = frames({ review: false, expanded: false });
    assert.equal(open.review, null);
    assert.equal(open.actions.width, ROW);
    assert.equal(shut.actions.width, DOCK.folded);

    const playing = frames({ review: false, player: true, expanded: false });
    assert.equal(right(playing.player!), ROW);
  });

  it('never put a bar past the row, at either end or anywhere between', () => {
    for (const review of [true, false]) {
      for (const player of [true, false]) {
        const open = frames({ review, player });
        const shut = frames({ review, player, expanded: false });
        for (const key of ['actions', 'review', 'player'] as const) {
          const a = open[key];
          const b = shut[key];
          if (!a || !b) continue;
          for (const t of [0, 0.25, 0.5, 0.75, 1]) {
            const frame = lerpFrame(b, a, t);
            assert.ok(frame.left >= 0 && right(frame) <= ROW + 1e-9, `${key} at ${t}`);
          }
        }
      }
    }
  });

  it('are as tall as the row and the bar over it', () => {
    const both = DOCK.bar + DOCK.gap + DOCK.top;
    assert.equal(dockHeight({ width: ROW, review: true, player: false }), both);
    assert.equal(dockHeight({ width: ROW, review: false, player: true }), both);
    assert.equal(dockHeight({ width: ROW, review: false, player: false }), DOCK.bar);
  });
});

describe('the morph', () => {
  it('interpolates a frame from one layout to the other', () => {
    const from = frames({ expanded: false }).review!;
    const to = frames({}).review!;
    assert.deepEqual(lerpFrame(from, to, 0), from);
    assert.deepEqual(lerpFrame(from, to, 1), to);
    assert.equal(lerpFrame(from, to, 0.5).width, (from.width + to.width) / 2);
  });

  it('fades the keys in after the folded glyph has gone — unfoldingTabs, foldedCircle', () => {
    assert.equal(keysAlpha(0.3), 0);
    assert.equal(keysAlpha(1), 1);
    assert.equal(circleAlpha(0), 1);
    assert.equal(circleAlpha(0.4), 0);
    /* Never both clearly there at once. */
    for (let fold = 0; fold <= 1; fold += 0.05) {
      assert.ok(keysAlpha(fold) + circleAlpha(fold) <= 1.0001, `${fold}`);
    }
  });

  it('keeps the keys whole while the capsule only narrows to make room', () => {
    const keysWidth = capsuleBeside(ROW);
    assert.equal(foldProgress(keysWidth, keysWidth), 1);
    assert.equal(foldProgress(ROW, keysWidth), 1);
    assert.equal(foldProgress(DOCK.folded, keysWidth), 0);
  });

  it('takes the review button’s words away in the first half of its fold — fabAlpha', () => {
    assert.equal(barProgress(DOCK.fab, ROW), 0);
    assert.equal(barProgress(ROW, ROW), 1);
    assert.equal(labelAlpha(0.5), 0);
    assert.equal(labelAlpha(1), 1);
  });

  it('answers only after Home’s travel, from the very top', () => {
    assert.equal(DOCK.slop, HOME_BAR.slop);
    const open = (was: boolean, anchor: number, offset: number) =>
      homeBarOpen(was, anchor, offset, DOCK.hold, DOCK.slop);
    assert.equal(open(false, 40, 0), true);
    assert.equal(open(true, 0, DOCK.slop), true);
    assert.equal(open(true, 0, DOCK.slop + 1), false);
    assert.equal(open(false, 500, 500 - DOCK.slop - 1), true);
    assert.equal(homeBarMoved(0, DOCK.slop + 1, DOCK.slop), true);
  });
});

describe('the room it takes', () => {
  it('stands over the navigation inset by the reference’s 8', () => {
    assert.equal(dockBottom(24), 32);
  });

  it('leaves the page a foot the contracted row never covers', () => {
    const bottom = dockBottom(24);
    assert.equal(dockFootRoom(bottom) - (bottom + DOCK.bar), DOCK_FOOT_SPACE);
  });
});
