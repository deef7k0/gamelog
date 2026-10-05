import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { clampPage, countByProbing, pageCountFor, pagerSlots, type PagerSlot } from './paging.ts';

/** A pager row as it reads: "1 … 4 5 6 … 512". */
function read(slots: PagerSlot[]): string {
  return slots.map((slot) => (slot.kind === 'page' ? String(slot.page) : '…')).join(' ');
}

describe('pageCountFor', () => {
  it('rounds up, and never answers zero pages', () => {
    assert.equal(pageCountFor(0), 1);
    assert.equal(pageCountFor(1), 1);
    assert.equal(pageCountFor(10), 1);
    assert.equal(pageCountFor(11), 2);
    assert.equal(pageCountFor(5120), 512);
  });
});

describe('clampPage', () => {
  it('keeps a typed number inside the range', () => {
    assert.equal(clampPage(0, 9), 1);
    assert.equal(clampPage(-3, 9), 1);
    assert.equal(clampPage(4.9, 9), 4);
    assert.equal(clampPage(900, 9), 9);
    assert.equal(clampPage(Number.NaN, 9), 1);
  });
});

describe('pagerSlots', () => {
  it('shows every page when there are only a few', () => {
    assert.equal(read(pagerSlots(1, 1)), '1');
    assert.equal(read(pagerSlots(2, 3)), '1 2 3');
    assert.equal(read(pagerSlots(3, 5)), '1 2 3 4 5');
  });

  it('keeps the ends and the pages around the current one', () => {
    assert.equal(read(pagerSlots(5, 9)), '1 … 4 5 6 … 9');
    assert.equal(read(pagerSlots(5, 512)), '1 … 4 5 6 … 512');
  });

  it('widens the window at either end', () => {
    assert.equal(read(pagerSlots(1, 512)), '1 2 3 … 512');
    assert.equal(read(pagerSlots(2, 512)), '1 2 3 … 512');
    assert.equal(read(pagerSlots(512, 512)), '1 … 510 511 512');
  });

  it('never hides a single page behind a gap', () => {
    assert.equal(read(pagerSlots(4, 512)), '1 2 3 4 5 … 512');
    assert.equal(read(pagerSlots(509, 512)), '1 … 508 509 510 511 512');
  });

  it('gives every gap its own key', () => {
    const gaps = pagerSlots(40, 512).filter((slot) => slot.kind === 'gap');
    assert.equal(gaps.length, 2);
    assert.equal(new Set(gaps.map((gap) => gap.key)).size, 2);
  });
});

describe('countByProbing', () => {
  /** A source of `total` rows, and how many times it was asked. */
  function source(total: number) {
    const calls = { n: 0 };
    const rows = async (limit: number, offset: number) => {
      calls.n += 1;
      return Math.max(0, Math.min(limit, total - offset));
    };
    return { rows, calls };
  }

  it('answers a short list in one request', async () => {
    for (const total of [0, 1, 37, 499]) {
      const { rows, calls } = source(total);
      assert.equal(await countByProbing(rows), total);
      assert.equal(calls.n, 1);
    }
  });

  it('is exact on either side of every boundary it searches by', async () => {
    for (const total of [500, 501, 999, 1000, 1001, 1499, 1500, 2000, 2001, 12_345, 250_007]) {
      const { rows } = source(total);
      assert.equal(await countByProbing(rows), total, `total ${total}`);
    }
  });

  it('costs a couple of dozen requests for a quarter of a million rows', async () => {
    const { rows, calls } = source(250_007);
    await countByProbing(rows);
    assert.ok(calls.n <= 24, `${calls.n} requests`);
  });

  it('stops at the ceiling for a source that never runs dry', async () => {
    const endless = async (limit: number) => limit;
    assert.equal(await countByProbing(endless, { ceiling: 8000 }), 8001);
  });
});
