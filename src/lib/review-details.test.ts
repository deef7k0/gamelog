import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { ordinalDate, playedDetails, type PlayedRecord } from './review-details';

const NOTHING: PlayedRecord = {
  status: 'played',
  completion: null,
  platinum: false,
  hours_played: null,
  completion_percent: null,
  coop: null,
  player_count: null,
};

const log = (patch: Partial<PlayedRecord>): PlayedRecord => ({ ...NOTHING, ...patch });

describe('playedDetails', () => {
  it('says nothing when the log records only that it was played', () => {
    assert.equal(playedDetails(NOTHING, null), null);
    assert.equal(playedDetails(NOTHING, '   '), null);
  });

  it('writes the whole run as one sentence', () => {
    assert.equal(
      playedDetails(log({ completion: 'story', coop: false, hours_played: 42 }), 'PlayStation 5'),
      'Finished the story solo on PlayStation 5 in 42 hours.'
    );
  });

  it('counts the writer among the players', () => {
    assert.equal(
      playedDetails(log({ coop: true, player_count: 4, hours_played: 20 }), 'PC'),
      'Played it with 3 others on PC for 20 hours.'
    );
    assert.equal(
      playedDetails(log({ coop: true, player_count: 2 }), null),
      'Played it with 1 other.'
    );
    assert.equal(playedDetails(log({ coop: true }), null), 'Played it in co-op.');
  });

  it('says how long in the words each kind of run takes', () => {
    assert.equal(
      playedDetails(log({ status: 'playing', hours_played: 12 }), 'PC'),
      'Playing it on PC, 12 hours in.'
    );
    assert.equal(
      playedDetails(log({ status: 'dropped', hours_played: 3 }), 'Switch'),
      'Dropped it on Switch after 3 hours.'
    );
    assert.equal(
      playedDetails(log({ status: 'paused', hours_played: 1 }), null),
      'Paused it after 1 hour.'
    );
    assert.equal(
      playedDetails(log({ completion: 'full', hours_played: 12.46 }), null),
      'Completed it 100% in 12.5 hours.'
    );
  });

  it('names the extras, and lets a platinum speak for 100%', () => {
    assert.equal(
      playedDetails(log({ completion: 'main' }), null),
      'Finished the story and its extras.'
    );
    assert.equal(
      playedDetails(log({ platinum: true, completion_percent: 100, hours_played: 80 }), 'PS5'),
      'Earned the platinum on PS5 in 80 hours.'
    );
  });

  it('adds a percentage only when it says something the sentence did not', () => {
    assert.equal(playedDetails(log({ completion_percent: 73 }), null), '73% complete.');
    assert.equal(
      playedDetails(log({ completion: 'full', completion_percent: 100 }), null),
      'Completed it 100%.'
    );
  });

  it('closes on the scorecard, in the order it is given', () => {
    assert.equal(
      playedDetails(NOTHING, null, [
        { label: 'Gameplay', score: 90 },
        { label: 'Narrative', score: 85 },
      ]),
      'Scored by category: Gameplay 90, Narrative 85.'
    );
  });

  it('never says zero hours', () => {
    assert.equal(playedDetails(log({ hours_played: 0 }), null), null);
  });
});

describe('ordinalDate', () => {
  /* Local noon, so no time zone moves the day. */
  const on = (year: number, month: number, day: number) =>
    new Date(year, month - 1, day, 12).toISOString();

  it('writes the date as the reference does', () => {
    assert.equal(ordinalDate(on(2026, 10, 16)), '16th October 2026');
  });

  it('gives each day its own suffix', () => {
    const days = [1, 2, 3, 4, 11, 12, 13, 21, 22, 23, 31].map(
      (day) => ordinalDate(on(2026, 1, day)).split(' ')[0]
    );
    assert.deepEqual(days, [
      '1st',
      '2nd',
      '3rd',
      '4th',
      '11th',
      '12th',
      '13th',
      '21st',
      '22nd',
      '23rd',
      '31st',
    ]);
  });

  it('hands back what it cannot read', () => {
    assert.equal(ordinalDate('not a date'), 'not a date');
  });
});
