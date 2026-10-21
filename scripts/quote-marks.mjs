/**
 * Rasterises a review's quotation marks — `assets/images/quotes/quote-marks.svg`
 * — into the two PNGs the app draws: `quote-open.png` and `quote-close.png`,
 * each exactly its ink (200 x 140 in the source), white on transparent, at
 * four times the tallest size the app draws a mark (`constants/pull-quote.ts`).
 *
 *   node scripts/quote-marks.mjs
 *
 * Needs `rsvg-convert`. Each mark is cut out of the source by viewBox, so no
 * cropping step can drift from the shapes.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/* `fileURLToPath`, not `.pathname`: this repository's path has a space in it. */
const dir = fileURLToPath(new URL('../assets/images/quotes/', import.meta.url));
const source = readFileSync(join(dir, 'quote-marks.svg'), 'utf8');
const scratch = mkdtempSync(join(tmpdir(), 'quote-marks-'));

/** Rendered height, px: 3x the review page's largest mark (about 45dp). */
const HEIGHT = 140;

for (const [name, x] of [
  ['open', 0],
  ['close', 220],
]) {
  const svg = source
    .replace(/width="420" height="140" viewBox="0 0 420 140"/, `width="200" height="140" viewBox="${x} 0 200 140"`);
  const file = join(scratch, `${name}.svg`);
  writeFileSync(file, svg);
  execFileSync('rsvg-convert', ['-h', String(HEIGHT), file, '-o', join(dir, `quote-${name}.png`)]);
  console.log(`quote-${name}.png`);
}
