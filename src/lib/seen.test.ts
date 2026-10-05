import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { createSeen } from './seen.ts';

type Row = { id: string; title: string };
const row = (n: number, title = `Row ${n}`): Row => ({ id: `r${n}`, title });

describe('createSeen', () => {
  it('recalls a record with the time it was seen', () => {
    const seen = createSeen<Row>(10);
    seen.remember(row(1), 5_000);
    assert.deepEqual(seen.recall('r1'), { value: row(1), at: 5_000 });
  });

  it('answers null for a record it has not seen, and for no id', () => {
    const seen = createSeen<Row>(10);
    assert.equal(seen.recall('r404'), null);
    assert.equal(seen.recall(undefined), null);
    assert.equal(seen.recall(null), null);
    assert.equal(seen.recall(''), null);
  });

  it('keeps the newest sighting of a record', () => {
    const seen = createSeen<Row>(10);
    seen.remember(row(1, 'Old'), 1_000);
    seen.remember(row(1, 'New'), 2_000);
    assert.deepEqual(seen.recall('r1'), { value: row(1, 'New'), at: 2_000 });
  });

  it('forgets the record seen longest ago once it is full', () => {
    const seen = createSeen<Row>(3);
    for (let n = 0; n <= 3; n += 1) seen.remember(row(n), n);
    assert.equal(seen.recall('r0'), null);
    assert.ok(seen.recall('r1'));
    assert.ok(seen.recall('r3'));
  });

  it('counts a record seen again as young', () => {
    const seen = createSeen<Row>(3);
    for (let n = 0; n < 3; n += 1) seen.remember(row(n), n);
    seen.remember(row(0), 99);
    seen.remember(row(3), 100);
    assert.ok(seen.recall('r0'), 'seen again, so kept');
    assert.equal(seen.recall('r1'), null, 'now the oldest, so dropped');
  });

  it('keeps separate stores apart', () => {
    const a = createSeen<Row>(3);
    const b = createSeen<Row>(3);
    a.remember(row(1));
    assert.equal(b.recall('r1'), null);
    a.clear();
    assert.equal(a.recall('r1'), null);
  });
});
