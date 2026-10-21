import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CHART_BASES,
  TOP_CHART_PAGE_SIZE,
  TOP_CHART_SIZE,
  chartLength,
  chartWindow,
  countLine,
} from './top-chart.ts';
import { pageCountFor } from './games/paging.ts';

describe('the Top 1000', () => {
  it('is a thousand games in pages of twenty — fifty pages', () => {
    assert.equal(TOP_CHART_SIZE, 1000);
    assert.equal(TOP_CHART_PAGE_SIZE, 20);
    assert.equal(pageCountFor(chartLength(1635), TOP_CHART_PAGE_SIZE), 50);
  });

  it('is never longer than a thousand, and as short as what there is', () => {
    assert.equal(chartLength(1635), 1000);
    assert.equal(chartLength(55), 55);
    assert.equal(chartLength(0), 0);
    assert.equal(chartLength(-3), 0);
  });

  it('starts each page where the last one ended', () => {
    assert.deepEqual(chartWindow(1), { offset: 0, limit: 20 });
    assert.deepEqual(chartWindow(2), { offset: 20, limit: 20 });
    assert.deepEqual(chartWindow(50), { offset: 980, limit: 20 });
  });

  it('never reaches rank 1,001, however far the pager is pushed', () => {
    assert.deepEqual(chartWindow(51), { offset: 1000, limit: 0 });
    assert.deepEqual(chartWindow(500), { offset: 1000, limit: 0 });
  });

  it('ends a short chart on a short page', () => {
    /* The live project's 55 rated games: three pages, the last of fifteen. */
    assert.equal(pageCountFor(chartLength(55), TOP_CHART_PAGE_SIZE), 3);
    assert.deepEqual(chartWindow(3, 55), { offset: 40, limit: 15 });
    assert.deepEqual(chartWindow(4, 55), { offset: 55, limit: 0 });
  });

  it('treats a page before the first as the first', () => {
    assert.deepEqual(chartWindow(0), { offset: 0, limit: 20 });
    assert.deepEqual(chartWindow(-2), { offset: 0, limit: 20 });
  });

  it('offers GameLog first and the critics second', () => {
    assert.deepEqual(
      CHART_BASES.map((basis) => basis.key),
      ['gamelog', 'critics']
    );
  });

  it('says what a score is made of', () => {
    assert.equal(countLine('gamelog', 1), '1 rating');
    assert.equal(countLine('gamelog', 3), '3 ratings');
    assert.equal(countLine('critics', 1), '1 critic');
    assert.equal(countLine('critics', 27), '27 critics');
    assert.equal(countLine('gamelog', 1200), '1,200 ratings');
  });
});
