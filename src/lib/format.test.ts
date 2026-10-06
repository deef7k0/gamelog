import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { timeAgo, timeAgoPosted } from './format.ts';

const NOW = Date.UTC(2026, 9, 5, 12, 0, 0);
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

describe('timeAgoPosted', () => {
  it('says "now" for the first minute, with no suffix', () => {
    assert.equal(timeAgoPosted(ago(0), NOW), 'now');
    assert.equal(timeAgoPosted(ago(59_000), NOW), 'now');
  });

  it('counts minutes, hours and days ago', () => {
    assert.equal(timeAgoPosted(ago(5 * MINUTE), NOW), '5m ago');
    assert.equal(timeAgoPosted(ago(12 * HOUR), NOW), '12h ago');
    assert.equal(timeAgoPosted(ago(3 * DAY), NOW), '3d ago');
    assert.equal(timeAgoPosted(ago(7 * DAY - MINUTE), NOW), '6d ago');
  });

  it('gives a date after a week, and never calls a date "ago"', () => {
    const old = timeAgoPosted(ago(30 * DAY), NOW);
    assert.equal(old, timeAgo(ago(30 * DAY), NOW));
    assert.ok(!old.endsWith('ago'), old);
    assert.match(old, /\d/);
  });

  it('answers nothing for a date it cannot read', () => {
    assert.equal(timeAgoPosted('not a date', NOW), '');
  });
});
