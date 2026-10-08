import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { formatDuration, formatRunningTime, pickTrack, type Pickable } from './soundtrack-pick.ts';

const track = (urn: string, plays: number | null, access?: Pickable['access']): Pickable => ({
  urn,
  plays,
  access,
});

/** Dice that read the given values in turn, then keep reading the last. */
function dice(...values: number[]) {
  let index = 0;
  return () => values[Math.min(index++, values.length - 1)];
}

describe('pickTrack', () => {
  const tracks = [track('a', 10), track('b', 5000), track('c', 300), track('d', null)];

  it('answers nothing for an empty soundtrack', () => {
    assert.equal(pickTrack([], 'popular'), null);
    assert.equal(pickTrack([track('x', 1, 'blocked')], 'random'), null);
  });

  it('reaches for the most played first in popular mode', () => {
    assert.equal(pickTrack(tracks, 'popular', undefined, dice(0))?.urn, 'b');
    /* And never a track whose plays are hidden: there is no evidence for it. */
    for (let roll = 0; roll < 1; roll += 0.05) {
      assert.notEqual(pickTrack(tracks, 'popular', undefined, dice(roll))?.urn, 'd');
    }
  });

  it('falls back to random when nothing says how often anything was played', () => {
    const quiet = [track('a', null), track('b', null)];
    assert.equal(pickTrack(quiet, 'popular', undefined, dice(0.99))?.urn, 'b');
  });

  it('picks anywhere in random mode, hidden plays included', () => {
    assert.equal(pickTrack(tracks, 'random', undefined, dice(0.99))?.urn, 'd');
    assert.equal(pickTrack(tracks, 'random', undefined, dice(0))?.urn, 'a');
  });

  it('never picks a track that cannot be heard', () => {
    const mixed = [track('a', 9_000, 'blocked'), track('b', 1), track('c', 2, 'preview')];
    for (let roll = 0; roll < 1; roll += 0.1) {
      assert.notEqual(pickTrack(mixed, 'random', undefined, dice(roll))?.urn, 'a');
      assert.notEqual(pickTrack(mixed, 'popular', undefined, dice(roll))?.urn, 'a');
    }
  });

  it('walks the soundtrack before it repeats, then starts again', () => {
    const heard = new Set(['a', 'b', 'c']);
    assert.equal(pickTrack(tracks, 'random', heard, dice(0))?.urn, 'd');
    const all = new Set(['a', 'b', 'c', 'd']);
    assert.ok(pickTrack(tracks, 'random', all, dice(0)));
  });

  it('flips a coin in surprise mode', () => {
    /* First die below a half: popular. Then the weighted pick's own die. */
    assert.equal(pickTrack(tracks, 'surprise', undefined, dice(0.1, 0))?.urn, 'b');
    /* Above a half: random, and the next die picks the slot. */
    assert.equal(pickTrack(tracks, 'surprise', undefined, dice(0.9, 0.99))?.urn, 'd');
  });
});

describe('formatDuration', () => {
  it('reads milliseconds as minutes and seconds', () => {
    assert.equal(formatDuration(222_000), '3:42');
    assert.equal(formatDuration(61_400), '1:01');
    assert.equal(formatDuration(3_600_000), '60:00');
  });

  it('says so when there is no length', () => {
    assert.equal(formatDuration(null), '--:--');
    assert.equal(formatDuration(0), '--:--');
  });
});

describe('formatRunningTime', () => {
  it('adds a soundtrack up to the minute', () => {
    assert.equal(formatRunningTime([180_000, 200_000, 100_000]), '8 min');
    assert.equal(formatRunningTime([3_600_000, 720_000]), '1 h 12 min');
    assert.equal(formatRunningTime([7_200_000]), '2 h');
  });

  it('skips tracks that do not say how long they are', () => {
    assert.equal(formatRunningTime([120_000, null, 60_000]), '3 min');
  });

  it('says nothing rather than "0 min"', () => {
    assert.equal(formatRunningTime([]), null);
    assert.equal(formatRunningTime([null, null]), null);
    /* Twenty seconds of music is still a minute's worth of soundtrack. */
    assert.equal(formatRunningTime([20_000]), '1 min');
  });
});
