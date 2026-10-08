import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

/*
 * The back disc's size and place are in `<FrostedTopBar>`; the room a screen
 * leaves for it is `TopBarHeight`, in the theme. Neither can import the other
 * (see the note on `TopBarHeight`), and neither can be loaded here — both reach
 * React Native — so the two files are read. Move the disc without moving the
 * room and a screen's first row slides under it, on every screen at once.
 */
const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

function constant(source: string, name: string): number {
  const match = new RegExp(`export const ${name} = (\\d+);`).exec(source);
  assert.ok(match, `${name} is not a plain number any more`);
  return Number(match[1]);
}

describe('the floating back disc', () => {
  const bar = read('./frosted-top-bar.tsx');
  const theme = read('../../constants/theme.ts');

  it('ends where the room a screen reserves for it ends', () => {
    const disc = constant(bar, 'TOP_BAR_DISC');
    const edge = constant(bar, 'TOP_BAR_EDGE');
    assert.equal(edge + disc, constant(theme, 'TopBarHeight'));
  });

  it('is SimpMusic’s: 48 across, 12 from the corner', () => {
    assert.equal(constant(bar, 'TOP_BAR_DISC'), 48);
    assert.equal(constant(bar, 'TOP_BAR_EDGE'), 12);
  });

  it('is never smaller than a finger', () => {
    /* 48 is Android's floor and over iOS's 44. */
    assert.ok(constant(bar, 'TOP_BAR_DISC') >= 48);
  });

  it('fades its light to white at nothing, never to a keyword', () => {
    /* Android interpolates a gradient unpremultiplied: `transparent` is black
       at zero, and a fade to it goes grey on the way. */
    const gradients = bar.match(/linear-gradient\([^']+\)/g) ?? [];
    assert.ok(gradients.length >= 2, 'the rim and the sheen');
    for (const gradient of gradients) assert.doesNotMatch(gradient, /transparent/);
  });
});
