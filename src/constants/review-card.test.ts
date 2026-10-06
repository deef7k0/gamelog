import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { contrast, luminance } from '../lib/color.ts';

/*
 * The tokens are read out of `theme.ts` as text. That file imports React
 * Native, so it cannot be loaded here — and copying the hexes into the test
 * would only prove the copy.
 */
const theme = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
function token(name: string): string {
  const match = theme.match(new RegExp(`^\\s{4}${name}: '(#[0-9A-Fa-f]{6})',`, 'm'));
  assert.ok(match, `no ${name} token in constants/theme.ts`);
  return match[1];
}

const card = token('reviewCard');

/** WCAG AA for body text. */
const AA = 4.5;

describe('the review card in a list', () => {
  /*
   * The owner's rule: nearly the page, ever so slightly different. Under 1.01
   * the two are the same colour on most panels; over 1.04 the card is a darker
   * thing set into the page. The card is on Home and on every other list of
   * reviews, so it is held to both pages — change either and this says the
   * card has to move with it.
   */
  for (const page of ['background', 'homeBackground']) {
    it(`is almost the colour of \`${page}\` — and not quite`, () => {
      const ratio = contrast(card, token(page));
      assert.ok(ratio > 1.01 && ratio < 1.04, `card against ${page}: ${ratio.toFixed(3)}`);
    });

    it(`is darker than \`${page}\``, () => {
      assert.ok(luminance(card) < luminance(token(page)));
    });
  }

  it('holds every ink set on it at AA', () => {
    for (const ink of ['text', 'textSecondary', 'textMuted']) {
      const ratio = contrast(token(ink), card);
      assert.ok(ratio >= AA, `${ink} on the card: ${ratio.toFixed(2)}`);
    }
  });
});
