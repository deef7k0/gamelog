import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { STACK_ORDER, STACK_SIZE, STACK_SPAN, STACK_STEP, stackLayout } from './cover-stack.ts';

/** The reference, in its own pixels: a 72px poster, five of them 232 across. */
const REFERENCE = { poster: 72, stack: 232, step: 40 };

/**
 * The rows a stack is drawn in. On a 360dp phone: the inside of a collection's
 * card at the app's margin (330, less the card's 15 either side) and the inside
 * of the profile's box (320, less its 8). Then the same two on phones 393, 412
 * and 430 wide.
 */
const CARD_ROW = 300;
const ROWS = [CARD_ROW, 304, 333, 337, 352, 356, 370, 374];

const byIndex = (available: number, count = STACK_SIZE) =>
  [...stackLayout(count, available).places].sort((a, b) => a.index - b.index);

/** The air left of the covers and right of them, in a row. */
function margins(count: number, available: number) {
  const layout = stackLayout(count, available);
  return { left: layout.inset, right: available - layout.inset - layout.width };
}

describe('the cover stack against its reference', () => {
  it('steps and spans as the reference does', () => {
    assert.ok(Math.abs(STACK_STEP - REFERENCE.step / REFERENCE.poster) < 1e-9);
    assert.ok(Math.abs(STACK_SPAN - REFERENCE.stack / REFERENCE.poster) < 1e-9);
  });

  it('drawn at the reference’s own width, is the reference', () => {
    const layout = stackLayout(STACK_SIZE, REFERENCE.stack);
    assert.equal(layout.cover.width, REFERENCE.poster);
    assert.equal(layout.width, REFERENCE.stack);
    assert.deepEqual(
      byIndex(REFERENCE.stack).map((place) => place.left),
      [80, 40, 120, 0, 160]
    );
  });

  it('is 93 by 140 in a collection’s card on a 360dp phone', () => {
    assert.deepEqual(stackLayout(STACK_SIZE, CARD_ROW).cover, { width: 93, height: 140 });
  });
});

describe('a full stack', () => {
  it('runs from one edge of its row to the other, to the dp, and its covers are 2:3', () => {
    for (const available of ROWS) {
      const layout = stackLayout(STACK_SIZE, available);
      assert.equal(layout.inset, 0, `${available}dp`);
      assert.equal(layout.width, available, `${available}dp`);
      assert.equal(Math.min(...layout.places.map((place) => place.left)), 0, `${available}dp`);
      const right = Math.max(...layout.places.map((place) => place.left + layout.cover.width));
      assert.equal(right, available, `${available}dp`);
      assert.equal(layout.height, Math.round(layout.cover.width * 1.5));
    }
  });

  it('puts the first cover in the middle of the row and in front', () => {
    for (const available of ROWS) {
      const layout = stackLayout(STACK_SIZE, available);
      const [first, second, third, fourth, fifth] = byIndex(available);
      assert.equal(first.depth, 0);
      assert.ok(second.left < first.left && first.left < third.left);
      assert.ok(fourth.left < second.left && third.left < fifth.left);
      assert.equal(fourth.left, 0);
      const centre = first.left + layout.cover.width / 2;
      assert.ok(Math.abs(centre - available / 2) <= 1, `${available}dp: ${centre}`);
    }
  });

  it('is drawn deepest first, so the one in front is painted last', () => {
    const depths = stackLayout(STACK_SIZE, CARD_ROW).places.map((place) => place.depth);
    assert.deepEqual(depths, [2, 2, 1, 1, 0]);
    assert.equal(stackLayout(STACK_SIZE, CARD_ROW).places.at(-1)?.index, 0);
  });

  it('shows the same strip of every cover behind the front one, within a dp', () => {
    for (const available of ROWS) {
      const lefts = byIndex(available)
        .map((place) => place.left)
        .sort((a, b) => a - b);
      const steps = lefts.slice(1).map((left, index) => left - lefts[index]);
      assert.ok(Math.max(...steps) - Math.min(...steps) <= 1, `${available}dp: ${steps}`);
    }
  });

  it('has each cover cast only on the one behind it, away from the middle', () => {
    const [first, second, third, fourth, fifth] = byIndex(CARD_ROW);
    assert.deepEqual([first.shadesLeft, first.shadesRight], [true, true]);
    assert.deepEqual([second.shadesLeft, second.shadesRight], [true, false]);
    assert.deepEqual([third.shadesLeft, third.shadesRight], [false, true]);
    assert.deepEqual([fourth.shadesLeft, fourth.shadesRight], [false, false]);
    assert.deepEqual([fifth.shadesLeft, fifth.shadesRight], [false, false]);
  });
});

describe('a stack of fewer than five', () => {
  it('keeps the cover the size it is in a full stack', () => {
    for (let count = 0; count <= STACK_SIZE; count++) {
      assert.deepEqual(stackLayout(count, CARD_ROW).cover, stackLayout(STACK_SIZE, CARD_ROW).cover);
    }
  });

  it('stands in the middle of its row: the same air either side, to the dp', () => {
    for (const available of ROWS) {
      for (let count = 0; count < STACK_SIZE; count++) {
        const { left, right } = margins(count, available);
        assert.ok(left > 0 && right > 0, `${count} in ${available}dp`);
        assert.ok(Math.abs(left - right) <= 1, `${count} in ${available}dp: ${left}, ${right}`);
      }
    }
  });

  it('places every cover inside the box it reports', () => {
    for (const available of ROWS) {
      for (let count = 1; count <= STACK_SIZE; count++) {
        const layout = stackLayout(count, available);
        const lefts = layout.places.map((place) => place.left);
        assert.equal(Math.min(...lefts), layout.inset);
        assert.equal(Math.max(...lefts) + layout.cover.width, layout.inset + layout.width);
      }
    }
  });

  it('does not leave three games at the left with a third of the row empty', () => {
    /* The complaint this answers, in numbers: three covers are 197dp of a
       300dp row, and what is left over is split in two. */
    assert.equal(stackLayout(3, CARD_ROW).width, 197);
    const { left, right } = margins(3, CARD_ROW);
    assert.ok(left >= 50 && right >= 50, `${left}, ${right}`);
  });

  it('centres the front cover itself when the covers either side of it are even', () => {
    for (const count of [1, 3]) {
      const layout = stackLayout(count, CARD_ROW);
      const front = layout.places.at(-1);
      assert.equal(front?.index, 0);
      const centre = (front?.left ?? 0) + layout.cover.width / 2;
      assert.ok(Math.abs(centre - CARD_ROW / 2) <= 1, `${count} covers: ${centre}`);
    }
  });

  it('is narrower than a full one, built from the first cover outward', () => {
    const full = stackLayout(STACK_SIZE, CARD_ROW);
    for (let count = 1; count < STACK_SIZE; count++) {
      const layout = stackLayout(count, CARD_ROW);
      assert.equal(layout.places.length, count);
      assert.ok(layout.width < full.width, `${count} covers`);
      assert.equal(layout.places.at(-1)?.index, 0, 'the first cover is still the one in front');
    }
  });

  it('is one cover wide with one game, and casts nothing', () => {
    const layout = stackLayout(1, CARD_ROW);
    assert.equal(layout.width, layout.cover.width);
    assert.deepEqual(layout.places, [
      { index: 0, left: layout.inset, depth: 0, shadesLeft: false, shadesRight: false },
    ]);
  });

  it('never casts where there is no cover to cast on', () => {
    for (let count = 1; count <= STACK_SIZE; count++) {
      const offsets = STACK_ORDER.slice(0, count);
      for (const place of stackLayout(count, CARD_ROW).places) {
        const offset = offsets[place.index];
        if (place.shadesLeft) assert.ok(offsets.includes(offset - 1));
        if (place.shadesRight) assert.ok(offsets.includes(offset + 1));
      }
    }
  });

  it('holds its height with nothing in it, for the placeholder, and says where that stands', () => {
    const empty = stackLayout(0, CARD_ROW);
    assert.equal(empty.places.length, 0);
    assert.equal(empty.height, stackLayout(STACK_SIZE, CARD_ROW).height);
    assert.equal(empty.width, empty.cover.width);
    assert.equal(empty.inset, stackLayout(1, CARD_ROW).inset);
  });

  it('never draws more than five', () => {
    assert.equal(stackLayout(12, CARD_ROW).places.length, STACK_SIZE);
  });
});
