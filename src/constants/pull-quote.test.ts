import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { PULL_QUOTE, quoteMarkSize, type PullQuoteSize } from './pull-quote.ts';

const SIZES = Object.keys(PULL_QUOTE) as PullQuoteSize[];

describe('the quotation marks', () => {
  it('set the card’s words at the owner’s 12, and the page’s smaller than it was', () => {
    assert.equal(PULL_QUOTE.card.fontSize, 12);
    /* The fitted page quote ran from 15 to 41; the owner took it back. */
    assert.ok(PULL_QUOTE.page.fontSize <= 16);
  });

  for (const size of SIZES) {
    const { fontSize, lineHeight } = PULL_QUOTE[size];

    it(`${size}: are slightly larger than the words, not much`, () => {
      const mark = quoteMarkSize(size);
      assert.ok(mark > fontSize, `${mark} is not over ${fontSize}`);
      assert.ok(mark <= fontSize * 1.35, `${mark} is too big against ${fontSize}`);
    });

    it(`${size}: fit the marks in the words' line`, () => {
      assert.ok(quoteMarkSize(size) < lineHeight);
    });
  }
});
