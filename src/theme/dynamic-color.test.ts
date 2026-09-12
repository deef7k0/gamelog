import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  DYNAMIC_ROLES,
  FALLBACK_SEED,
  NEUTRAL_SEED,
  generateDynamicTheme,
} from './dynamic-color.ts';

/**
 * Run with `npm test`.
 *
 * `node:test` and `node:assert` rather than a test framework, because adding one
 * is not free here: `jest-expo` pulls a babel transform, a React Native preset
 * and a jsdom-ish environment into a project that has no other tests, to check a
 * function that takes a string and returns strings. Node 24 strips the types
 * itself and the runner is in the standard library.
 *
 * The one piece of scaffolding it does need is `scripts/esm-extensionless.mjs` —
 * `@material/material-color-utilities` ships ESM with extensionless internal
 * imports, which Metro resolves and Node does not. See that file.
 */

const HEX = /^#[0-9a-fA-F]{6}$/;

/** Real extractions, plus the two seeds the app falls back to. */
const SEEDS = {
  'warm box art': '#B69254',
  'DOOM red': '#C1272D',
  'Celeste blue': '#4A90D9',
  'near-grey cover': '#6B7984',
  fallback: FALLBACK_SEED,
  neutral: NEUTRAL_SEED,
};

describe('generateDynamicTheme', () => {
  it('returns every role, as a valid hex, for every seed and both modes', () => {
    for (const [name, seed] of Object.entries(SEEDS)) {
      for (const isDark of [true, false]) {
        const theme = generateDynamicTheme(seed, isDark);
        const keys = Object.keys(theme);

        assert.equal(
          keys.length,
          DYNAMIC_ROLES.length,
          `${name} ${isDark ? 'dark' : 'light'}: expected ${DYNAMIC_ROLES.length} roles, got ${keys.length}`
        );

        for (const role of DYNAMIC_ROLES) {
          assert.match(theme[role], HEX, `${name} ${isDark ? 'dark' : 'light'}: ${role}`);
        }
      }
    }
  });

  it('is pure — the same seed gives the same scheme', () => {
    assert.deepEqual(generateDynamicTheme('#B69254', true), generateDynamicTheme('#B69254', true));
  });

  it('falls back rather than throwing on a malformed seed', () => {
    const expected = generateDynamicTheme(FALLBACK_SEED, true);
    for (const bad of ['', 'nonsense', '#12', 'rgb(1,2,3)']) {
      assert.deepEqual(generateDynamicTheme(bad, true), expected, `seed ${JSON.stringify(bad)}`);
    }
  });

  it('puts dark mode on a dark background and light mode on a light one', () => {
    for (const seed of Object.values(SEEDS)) {
      const dark = generateDynamicTheme(seed, true);
      const light = generateDynamicTheme(seed, false);
      assert.ok(
        relativeLuminance(dark.background) < 0.05,
        `dark background too light for ${seed}: ${dark.background}`
      );
      assert.ok(
        relativeLuminance(light.background) > 0.8,
        `light background too dark for ${seed}: ${light.background}`
      );
    }
  });

  /*
   * The property the whole system rests on: body text has to clear WCAG AA on
   * the surfaces it lands on, for *any* seed. A scheme that looks handsome and
   * puts `onSurfaceVariant` at 3.9:1 on a card is a scheme that quietly fails
   * half the people using it, and the seeds here are arbitrary — they come off
   * box art, so this cannot be checked by eye once and trusted.
   */
  it('keeps text above AA on every surface it is paired with', () => {
    const pairs: [keyof ReturnType<typeof generateDynamicTheme>, string][] = [
      ['onBackground', 'background'],
      ['onSurface', 'surface'],
      ['onSurface', 'surfaceContainer'],
      ['onSurface', 'surfaceContainerHigh'],
      ['onSurface', 'surfaceContainerHighest'],
      ['onSurfaceVariant', 'surfaceVariant'],
      ['onPrimary', 'primary'],
      ['onPrimaryContainer', 'primaryContainer'],
      ['onSecondaryContainer', 'secondaryContainer'],
      ['onTertiaryContainer', 'tertiaryContainer'],
    ];

    for (const [name, seed] of Object.entries(SEEDS)) {
      for (const isDark of [true, false]) {
        const theme = generateDynamicTheme(seed, isDark);
        for (const [ink, surface] of pairs) {
          const ratio = contrast(theme[ink], theme[surface as DynamicRoleKey]);
          assert.ok(
            ratio >= 4.5,
            `${name} ${isDark ? 'dark' : 'light'}: ${ink} on ${surface} is ${ratio.toFixed(2)}:1`
          );
        }
      }
    }
  });
});

type DynamicRoleKey = (typeof DYNAMIC_ROLES)[number];

function channel(value: number): number {
  const c = value / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function relativeLuminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return (
    0.2126 * channel((n >> 16) & 255) + 0.7152 * channel((n >> 8) & 255) + 0.0722 * channel(n & 255)
  );
}

function contrast(a: string, b: string): number {
  const light = Math.max(relativeLuminance(a), relativeLuminance(b));
  const dark = Math.min(relativeLuminance(a), relativeLuminance(b));
  return (light + 0.05) / (dark + 0.05);
}
