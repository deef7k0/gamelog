import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ASSUMED_LENGTH_S,
  countdown,
  eventPhase,
  runningTime,
  showsGames,
  startCells,
} from './event-phase.ts';

const START = 1_800_000_000; // seconds
const ms = (seconds: number) => seconds * 1000;

describe('where an event is', () => {
  it('is upcoming before it starts and live once it has', () => {
    assert.equal(eventPhase(START, null, ms(START - 1)), 'upcoming');
    assert.equal(eventPhase(START, null, ms(START)), 'live');
  });

  it('ends at its end, or a long showcase after its start', () => {
    assert.equal(eventPhase(START, START + 3600, ms(START + 3599)), 'live');
    assert.equal(eventPhase(START, START + 3600, ms(START + 3600)), 'over');
    assert.equal(eventPhase(START, null, ms(START + ASSUMED_LENGTH_S - 1)), 'live');
    assert.equal(eventPhase(START, null, ms(START + ASSUMED_LENGTH_S)), 'over');
  });

  it('ignores an end that comes before the start', () => {
    assert.equal(eventPhase(START, START - 10, ms(START + 60)), 'live');
  });

  it('has no phase without a date', () => {
    assert.equal(eventPhase(null, null, ms(START)), 'undated');
  });
});

describe('the games shown', () => {
  it('are printed once it is over, and not before', () => {
    assert.equal(showsGames('upcoming'), false);
    assert.equal(showsGames('live'), false);
    assert.equal(showsGames('over'), true);
    assert.equal(showsGames('undated'), true);
  });
});

describe('saying when', () => {
  it('counts down in the largest unit that reads naturally', () => {
    assert.equal(countdown(START, ms(START - 30)), 'any minute now');
    assert.equal(countdown(START, ms(START - 60 * 20)), 'in 20 minutes');
    assert.equal(countdown(START, ms(START - 3600 * 5)), 'in 5 hours');
    assert.equal(countdown(START, ms(START - 86400 * 3)), 'in 3 days');
    assert.equal(countdown(START, ms(START - 3600)), 'in 1 hour');
  });

  it('says how long it ran only when both ends are known', () => {
    assert.equal(runningTime(START, START + 8100), '2h 15m');
    assert.equal(runningTime(START, START + 2700), '45m');
    assert.equal(runningTime(START, START + 7200), '2h');
    assert.equal(runningTime(START, null), null);
  });

  it('gives a date, a weekday and a time', () => {
    const cells = startCells(START, 'en-GB');
    assert.ok(cells.date.length > 0 && cells.weekday.length > 0);
    assert.match(cells.time, /\d{2}:\d{2}/);
  });
});
