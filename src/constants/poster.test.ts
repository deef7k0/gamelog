import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { contrast, readableInk } from '../lib/color.ts';
import { POSTER_THEMES } from './poster.ts';
import { PROGRESS_POSTER } from './progress.ts';

/*
 * The tokens are read out of `theme.ts` as text: that file imports React
 * Native, so it cannot be loaded here, and copying the hexes would only prove
 * the copy.
 */
const theme = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
function token(name: string): string {
  const match = theme.match(new RegExp(`^\\s{4}${name}: '(#[0-9A-Fa-f]{6})',`, 'm'));
  assert.ok(match, `no ${name} token in constants/theme.ts`);
  return match[1];
}

const AA = 4.5;
const AA_LARGE = 3;

describe('the onboarding pages', () => {
  for (const [key, poster] of Object.entries(POSTER_THEMES)) {
    const page = token(poster.page);

    it(`${key}: the headline reads as large text`, () => {
      const ratio = contrast(token(poster.ink), page);
      assert.ok(ratio >= AA_LARGE, `${poster.ink} on ${poster.page} is ${ratio.toFixed(2)}:1`);
    });

    it(`${key}: the small type reads at AA`, () => {
      for (const name of [poster.quiet, poster.link]) {
        const ratio = contrast(token(name), page);
        assert.ok(ratio >= AA, `${name} on ${poster.page} is ${ratio.toFixed(2)}:1`);
      }
    });

    it(`${key}: the pill's label reads at AA`, () => {
      const ratio = contrast(token(poster.buttonInk), token(poster.button));
      assert.ok(ratio >= AA, `${poster.buttonInk} on ${poster.button} is ${ratio.toFixed(2)}:1`);
    });
  }
});

describe('the progress pills', () => {
  it('give each of the seven its own colour', () => {
    const fills = Object.values(PROGRESS_POSTER).map(token);
    assert.equal(new Set(fills).size, 7);
  });

  /*
   * The reference sets white on every block, yellow included, which is under
   * 2:1. Here the ink is whichever of the two clears the fill, and the label is
   * 13sp semibold — small text — so it is held to 4.5.
   */
  it('carry a label that reads on every fill', () => {
    for (const [choice, name] of Object.entries(PROGRESS_POSTER)) {
      const fill = token(name);
      const ratio = contrast(readableInk(fill), fill);
      assert.ok(ratio >= AA, `${choice}: ${ratio.toFixed(2)}:1 on ${name}`);
    }
  });
});
