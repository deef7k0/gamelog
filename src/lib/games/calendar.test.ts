import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  calendarWeight,
  gamesByDay,
  gamesOfMonth,
  monthRows,
  monthStart,
  monthTense,
  precisionOf,
  undatedOf,
  type CalendarGame,
} from './calendar.ts';

const utc = (iso: string) => Math.floor(Date.parse(`${iso}T00:00:00Z`) / 1000);

function game(over: Partial<CalendarGame> & { id: string; releasedAt: number }): CalendarGame {
  return {
    title: over.id,
    coverImageId: null,
    precision: 'day',
    hypes: 0,
    ratings: 0,
    score: null,
    ...over,
  };
}

describe('precisionOf', () => {
  const date = utc('2026-11-19');

  it('reads the format off the release that carries the first date', () => {
    assert.equal(precisionOf(date, [{ date, date_format: 0 }]), 'day');
    assert.equal(precisionOf(date, [{ date, date_format: 1 }]), 'month');
    assert.equal(precisionOf(date, [{ date, date_format: 2 }]), 'year');
  });

  it('treats a quarter and a TBD as no month at all', () => {
    assert.equal(precisionOf(date, [{ date, date_format: 4 }]), 'year');
    assert.equal(precisionOf(date, [{ date, date_format: 7 }]), 'year');
  });

  it('lets one region with a day make the day real', () => {
    assert.equal(
      precisionOf(date, [
        { date, date_format: 2 },
        { date, date_format: 0 },
      ]),
      'day'
    );
  });

  it('ignores later releases, and trusts a game with none', () => {
    assert.equal(precisionOf(date, [{ date: utc('2027-03-01'), date_format: 2 }]), 'day');
    assert.equal(precisionOf(date, undefined), 'day');
    assert.equal(precisionOf(date, []), 'day');
  });
});

describe('monthRows', () => {
  it('counts the days from the 1st, seven to a row, whatever weekday it falls on', () => {
    /* January 2026 starts on a Thursday; the grid does not care. */
    const rows = monthRows(2026, 0);
    assert.deepEqual(rows[0], [1, 2, 3, 4, 5, 6, 7]);
    assert.deepEqual(rows[3], [22, 23, 24, 25, 26, 27, 28]);
    assert.deepEqual(rows[4], [29, 30, 31, null, null, null, null]);
  });

  it('is five rows of seven for every month', () => {
    for (let month = 0; month < 12; month += 1) {
      const rows = monthRows(2026, month);
      assert.equal(rows.length, 5);
      assert.ok(rows.every((row) => row.length === 7));
    }
  });

  it('ends a 30-day month two squares into the fifth row', () => {
    assert.deepEqual(monthRows(2026, 3)[4], [29, 30, null, null, null, null, null]);
  });

  it('knows a leap February, and leaves the fifth row of a short one empty', () => {
    assert.equal(monthRows(2028, 1).flat().filter(Boolean).length, 29);
    assert.equal(monthRows(2026, 1).flat().filter(Boolean).length, 28);
    assert.deepEqual(monthRows(2026, 1)[4], [null, null, null, null, null, null, null]);
  });
});

describe('a month of releases', () => {
  const games = [
    game({ id: 'small', releasedAt: utc('2026-05-19'), hypes: 3 }),
    game({ id: 'big', releasedAt: utc('2026-05-19'), hypes: 100, ratings: 105 }),
    game({ id: 'late', releasedAt: utc('2026-05-31'), hypes: 40 }),
    game({ id: 'sometime', releasedAt: utc('2026-05-31'), precision: 'month', hypes: 500 }),
    game({ id: 'june', releasedAt: utc('2026-06-01'), hypes: 900 }),
    game({ id: 'tbd', releasedAt: utc('2026-12-31'), precision: 'year', hypes: 71 }),
  ];

  it('lists the month biggest first, with month-only dates but not the next month', () => {
    assert.deepEqual(
      gamesOfMonth(games, 2026, 4).map((entry) => entry.id),
      ['sometime', 'big', 'late', 'small']
    );
  });

  it('puts only day-precise releases on a square, biggest first', () => {
    const days = gamesByDay(games, 2026, 4);
    assert.deepEqual(
      [...days.keys()].sort((a, b) => a - b),
      [19, 31]
    );
    assert.deepEqual(
      days.get(19)?.map((entry) => entry.id),
      ['big', 'small']
    );
    assert.deepEqual(
      days.get(31)?.map((entry) => entry.id),
      ['late']
    );
  });

  it('keeps a year-only release out of December and in the undated list', () => {
    assert.deepEqual(gamesOfMonth(games, 2026, 11), []);
    assert.deepEqual(
      undatedOf(games).map((entry) => entry.id),
      ['tbd']
    );
  });

  it('reads the day in UTC, not in the reader’s zone', () => {
    const midnight = game({ id: 'midnight', releasedAt: monthStart(2026, 4) });
    assert.deepEqual([...gamesByDay([midnight], 2026, 4).keys()], [1]);
  });
});

describe('calendarWeight', () => {
  it('adds anticipation to turnout', () => {
    assert.equal(calendarWeight({ hypes: 309, ratings: 345 }), 654);
    assert.equal(calendarWeight({ hypes: 1072, ratings: 0 }), 1072);
  });
});

describe('monthTense', () => {
  const now = new Date('2026-10-03T12:00:00Z');

  it('places a month against today', () => {
    assert.equal(monthTense(2026, 8, now), 'past');
    assert.equal(monthTense(2026, 9, now), 'current');
    assert.equal(monthTense(2026, 10, now), 'future');
    assert.equal(monthTense(2025, 11, now), 'past');
    assert.equal(monthTense(2027, 0, now), 'future');
  });
});
