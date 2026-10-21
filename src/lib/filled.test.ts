import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { AccentRoles } from '../constants/theme';
import { FALLBACK_SEED, NEUTRAL_SEED, generateDynamicTheme } from '../theme/dynamic-color.ts';
import { INK_ON_DARK, INK_ON_LIGHT, contrast, toHsl } from './color.ts';
import { filledRoles } from './filled.ts';

/** Real extractions, plus the two seeds the app falls back to. */
const SEEDS = {
  'warm box art': '#B69254',
  'DOOM red': '#C1272D',
  'Celeste blue': '#4A90D9',
  'mid green': '#3FA34D',
  'near-grey cover': '#6B7984',
  fallback: FALLBACK_SEED,
  neutral: NEUTRAL_SEED,
};

/* A game page's accent, as `accentRoles` builds it: `color` is M3's `primary`
   and `ink` its `onPrimary` (constants/theme imports React Native, so the two
   roles this reads are restated). */
function gameAccent(seed: string): AccentRoles {
  const m3 = generateDynamicTheme(seed, true);
  return { color: m3.primary, ink: m3.onPrimary, m3 } as unknown as AccentRoles;
}

describe('a filled control (SimpMusic’s onPrimary on primary)', () => {
  for (const [name, seed] of Object.entries(SEEDS)) {
    const { fill, ink, pressed } = filledRoles(gameAccent(seed));

    it(`${name}: the icon and words read on the fill`, () => {
      assert.ok(contrast(ink, fill) >= 4.5, `${contrast(ink, fill).toFixed(2)}:1`);
      assert.ok(contrast(ink, pressed) >= 3, 'held, it still reads');
    });

    it(`${name}: the ink is the game's hue, not plain black or white`, () => {
      assert.notEqual(ink.toUpperCase(), INK_ON_LIGHT.toUpperCase());
      assert.notEqual(ink.toUpperCase(), INK_ON_DARK.toUpperCase());
    });
  }

  it('keeps an already vivid fill where it was', () => {
    const accent = gameAccent(SEEDS['DOOM red']);
    const before = toHsl(accent.color)!;
    const after = toHsl(filledRoles(accent).fill)!;
    if (before.s >= 0.72) assert.equal(filledRoles(accent).fill, accent.color);
    else assert.ok(after.s >= 0.72 - 0.01);
  });
});
