import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { contrast } from '../lib/color.ts';
import {
  SHARE_CARD,
  SHARE_SWATCHES,
  shareCardRamp,
  shareCardWidth,
  shareInkToken,
  shareTintOn,
} from './share-card.ts';

/* Read out of `theme.ts` as text: it imports React Native. */
const theme = readFileSync(new URL('./theme.ts', import.meta.url), 'utf8');
function token(name: string): string {
  const match = theme.match(new RegExp(`^\\s{4}${name}: '(#[0-9A-Fa-f]{6})',`, 'm'));
  assert.ok(match, `no ${name} token in constants/theme.ts`);
  return match[1];
}

/* Colours a game's cover gives, from black to white through the vivid ones. */
const SEEDS = ['#0A0A06', '#530000', '#1E5AA8', '#F2C21B', '#7ED957', '#E04BA0', '#FAFAFA'];

describe('the share card’s ink', () => {
  for (const name of SHARE_SWATCHES) {
    it(`reads on ${name}, at the top of its ramp and at the foot`, () => {
      const background = token(name);
      const ink = token(shareInkToken(background));
      for (const stop of shareCardRamp(background)) {
        assert.ok(contrast(ink, stop) >= 4.5, `${ink} on ${stop}: ${contrast(ink, stop)}`);
      }
    });
  }

  it('reads on a game’s own colour, whatever the cover gives', () => {
    for (const seed of SEEDS) {
      const ink = token(shareInkToken(seed));
      /* The words are bold 22 — large text — so 3:1 is AA for them. */
      for (const stop of shareCardRamp(seed)) {
        assert.ok(contrast(ink, stop) >= 3, `${ink} on ${stop}`);
      }
    }
  });

  it('pushes a tint far enough from a fill to read on it', () => {
    for (const seed of SEEDS) {
      for (const fill of [token('shareInkLight'), token('shareInkDark')]) {
        const tint = shareTintOn(seed, fill);
        assert.ok(contrast(tint, fill) >= 3, `${tint} on ${fill}: ${contrast(tint, fill)}`);
      }
    }
  });
});

describe('the share card’s width', () => {
  it('is never wider than SimpMusic’s ceiling, and keeps the sheet’s gutters', () => {
    assert.equal(shareCardWidth(430), SHARE_CARD.maxWidth);
    assert.equal(shareCardWidth(360), 360 - 2 * SHARE_CARD.gutter);
  });
});
