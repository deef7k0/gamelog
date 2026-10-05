/**
 * Case templates: measure the files the app draws.
 *
 *   node --import ./scripts/esm-register.mjs scripts/case-templates.mjs
 *
 * Every `assets/cases/<key>_case.png` is a case's front face: opaque chrome with
 * a see-through window the cover shows through. This reads each one's size and
 * its window from the pixels — the `templateSize` and `coverArea` in
 * `src/constants/platform-cases.ts` — and says which entries there disagree
 * with their file. Run it after replacing or adding a template: one dropped in
 * without re-measuring is drawn stretched with its cover in the wrong place.
 * PS4 and PS5 were, for two months.
 *
 * Most of the templates began as the front covers of the owner's pack — a
 * folder per console, each with a `cover/` folder — copied here under these
 * flat names because the pack's own paths hold spaces and colons, which Metro
 * turns into URLs and Android resource names. The pack is no longer in the
 * repository; `assets/cases/README.md` records which file each one was.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { decodePng } from '../src/lib/png.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const CASES = join(ROOT, 'assets', 'cases');

/**
 * A pixel under this shows the cover through it: a clear window, or the
 * translucent plastic of a shell (PS4's, the 3DS's), which is drawn at a
 * fraction of full opacity so the art reads through it.
 */
const SEE_THROUGH = 128;
/**
 * A pixel under this is still soft enough to need cover behind it — a band of
 * shading fading into the art, the shadow beside a banner. Not 255: the strip
 * down an N64 box is drawn a shade short of opaque, and that is chrome.
 */
const SOFT = 200;
/**
 * A see-through patch smaller than this share of the image is a speck, not a
 * window: the clear corner outside a shell's rounded outline, a gap in a
 * ribbon. The smallest real second window measured — the corner past a
 * Commodore box's banner — is 0.7%; the largest speck, 0.3%.
 */
const SPECK = 0.005;
/** How far the window is widened under opaque chrome, so no seam shows. */
const TUCK = 2;

/**
 * A template's size and cover window, from its pixels.
 *
 * The cover is drawn underneath the template and the template's own pixels cut
 * it, so the window is the bounding box of everything the cover has to be
 * behind, widened two pixels under the chrome:
 *
 *  - **the largest see-through region** — the window itself, or the inside of
 *    a translucent shell;
 *  - **any other see-through region of a real size** — the notch at the foot
 *    of a Jaguar box's band, the strip of art under an Arduboy box's;
 *  - **the soft pixels that touch those** — the shading that fades into an
 *    Interton box's art.
 *
 * What is left out is the specks: the clear corners outside a shell's rounded
 * outline. Counting those makes the window the whole image, and a cover drawn
 * across the whole image shows *past* the case — which is what PS4's did.
 *
 * It cannot tell a case drawn inside a clear margin from a window that runs
 * to the edge. Crop a template to its case before dropping it in.
 */
export function measure(file) {
  const image = decodePng(new Uint8Array(readFileSync(file)), { maxPixels: 8_000_000 });
  if (!image) throw new Error(`Could not decode ${file}`);
  const { width, height, data } = image;
  const total = width * height;
  const alpha = (index) => data[index * 4 + 3];
  const neighbours = (index) => {
    const x = index % width;
    const near = [];
    if (x > 0) near.push(index - 1);
    if (x < width - 1) near.push(index + 1);
    if (index >= width) near.push(index - width);
    if (index < total - width) near.push(index + width);
    return near;
  };

  /* Every connected see-through region. */
  const seen = new Uint8Array(total);
  const regions = [];
  for (let start = 0; start < total; start += 1) {
    if (seen[start] || alpha(start) >= SEE_THROUGH) continue;
    const pixels = [start];
    seen[start] = 1;
    for (let at = 0; at < pixels.length; at += 1) {
      for (const next of neighbours(pixels[at])) {
        if (seen[next] || alpha(next) >= SEE_THROUGH) continue;
        seen[next] = 1;
        pixels.push(next);
      }
    }
    regions.push(pixels);
  }
  if (regions.length === 0) return { width, height, window: null };

  regions.sort((a, b) => b.length - a.length);
  const windows = regions.filter((region, index) => index === 0 || region.length >= total * SPECK);

  /* Grow from the windows through whatever soft pixels touch them — never into
     another see-through region, which is how the outside would leak in. */
  const stack = windows.flat();
  const grown = new Uint8Array(total);
  for (const index of stack) grown[index] = 1;
  let left = width;
  let top = height;
  let right = -1;
  let bottom = -1;
  while (stack.length > 0) {
    const index = stack.pop();
    const x = index % width;
    const y = (index - x) / width;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
    for (const next of neighbours(index)) {
      if (grown[next] || alpha(next) < SEE_THROUGH || alpha(next) >= SOFT) continue;
      grown[next] = 1;
      stack.push(next);
    }
  }

  const x = Math.max(0, left - TUCK);
  const y = Math.max(0, top - TUCK);
  return {
    width,
    height,
    window: {
      x,
      y,
      width: Math.min(width, right + 1 + TUCK) - x,
      height: Math.min(height, bottom + 1 + TUCK) - y,
    },
  };
}

function main() {
  const table = readFileSync(join(ROOT, 'src', 'constants', 'platform-cases.ts'), 'utf8');
  const files = readdirSync(CASES)
    .filter((name) => name.endsWith('_case.png'))
    .sort();

  for (const name of files) {
    const key = name.replace(/_case\.png$/, '');
    const { width, height, window } = measure(join(CASES, name));
    const size = `templateSize: { width: ${width}, height: ${height} }`;
    const area = window
      ? `coverArea: { x: ${window.x}, y: ${window.y}, width: ${window.width}, height: ${window.height} }`
      : 'coverArea: none — the file has no window';

    /* The entry that requires this file, if there is one, and whether it
       carries these numbers. */
    const at = table.indexOf(`cases/${name}'`);
    const entry = at < 0 ? '' : table.slice(at, table.indexOf('spineWidth', at));
    const note =
      at < 0
        ? 'not in the table'
        : entry.includes(size) && entry.includes(area)
          ? 'ok'
          : 'DIFFERS from the table';

    console.log(`${key.padEnd(16)} ${size}, ${area}  [${note}]`);
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main();
