import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import jpeg from 'jpeg-js';

import { Hct, argbFromHex } from '@material/material-color-utilities';

import { generateDynamicTheme } from '../theme/dynamic-color.ts';
import { VIVID_FLOOR, filledInks } from './filled.ts';
import { contrast, ensureContrast, fromHsl, luminance, saturate, toHsl } from './color.ts';
import { visibleRegion } from './key-color.ts';
import {
  ARTWORK_PALETTE,
  PAGE_COLOR,
  adaptedSaturation,
  buttonFamily,
  buttonTone,
  cropPixels,
  deltaE,
  harmonySeed,
  HARMONY,
  holdsInks,
  m3Seeds,
  pageFrom,
  pageInks,
  quietInk,
  readArtwork,
} from './page-color.ts';

/** An RGBA image `width` × `height`, each pixel painted by `paint`. */
function image(width: number, height: number, paint: (x: number, y: number) => string) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const hex = paint(x, y);
      const i = (y * width + x) * 4;
      data[i] = parseInt(hex.slice(1, 3), 16);
      data[i + 1] = parseInt(hex.slice(3, 5), 16);
      data[i + 2] = parseInt(hex.slice(5, 7), 16);
      data[i + 3] = 255;
    }
  }
  return data;
}

describe('cropPixels', () => {
  it('cuts a ring of the region off each side before anything is counted', () => {
    /* A white frame two pixels wide round a blue field: the brief's border. */
    const data = image(20, 20, (x, y) =>
      x < 2 || y < 2 || x >= 18 || y >= 18 ? '#FFFFFF' : '#2050C0'
    );
    const cropped = cropPixels(data, 20, 20, undefined, PAGE_COLOR.crop);
    assert.equal(cropped.length, 16 * 16 * 4);
    for (let i = 0; i < cropped.length; i += 4) assert.equal(cropped[i + 2], 0xc0);
  });

  it('crops the part on screen first, then the ring of that', () => {
    const data = image(40, 10, (x) => (x < 10 ? '#FF0000' : x < 30 ? '#00FF00' : '#0000FF'));
    /* A square frame shows the middle 10 × 10 of a 4:1 image. */
    const region = visibleRegion({ width: 40, height: 10 }, { width: 1, height: 1 });
    const cropped = cropPixels(data, 40, 10, region, 0);
    assert.equal(cropped.length, 10 * 10 * 4);
    for (let i = 0; i < cropped.length; i += 4) assert.equal(cropped[i + 1], 0xff);
  });
});

describe('adaptedSaturation — BitChord’s grey guard', () => {
  it('clamps a colour into the band', () => {
    assert.equal(adaptedSaturation(0.9, [0.2, 0.62]), 0.62);
    assert.equal(adaptedSaturation(0.15, [0.2, 0.62]), 0.2);
    assert.equal(adaptedSaturation(0.4, [0.2, 0.62]), 0.4);
  });

  it('leaves a grey grey: under 0.12 the saturation is not raised to the floor', () => {
    assert.equal(adaptedSaturation(0, [0.2, 0.62]), 0);
    assert.equal(adaptedSaturation(0.11, [0.2, 0.62]), 0.11);
  });
});

describe('readArtwork — the picture asked twice', () => {
  it('the dominant is what it is mostly made of, near-black included (the filter off)', () => {
    /* Nine tenths near-black, a tenth warm orange: the filter would drop the
       black and call the picture orange. */
    const data = image(20, 20, (x, y) => (y < 18 ? '#080808' : '#D08030'));
    const read = readArtwork(data)!;
    assert.ok(luminance(read.dominant) < 0.01, read.dominant);
  });

  it('the accent is saturation × √population: a fleck loses to a colour that is there', () => {
    /* 1% vivid red, 30% a moderately saturated blue, the rest grey. */
    const data = image(40, 40, (x, y) =>
      y === 0 && x < 16 ? '#E01010' : y < 13 ? '#3060A0' : '#606060'
    );
    const read = readArtwork(data)!;
    assert.ok(hueOf(read.accent) > 190 && hueOf(read.accent) < 240, read.accent);
  });

  it('and a vivid colour with enough of it wins over a large grey-blue', () => {
    const data = image(40, 40, (x, y) => (y < 8 ? '#E01010' : '#505868'));
    assert.ok(isRed(readArtwork(data)!.accent), readArtwork(data)!.accent);
  });

  it('an image with no pixel to count gives nothing', () => {
    assert.equal(readArtwork(new Uint8Array(0)), null);
  });
});

describe('pageFrom — BitChord’s page, which reads', () => {
  const hues = Array.from({ length: 36 }, (_, i) => i * 10);
  const sats = [0, 0.05, 0.3, 0.6, 1];
  const lights = [0.02, 0.1, 0.3, 0.5, 0.7, 0.95];

  it('every page holds white at 7:1 and its quiet ink at 4.5:1, whatever the picture', () => {
    for (const h of hues)
      for (const s of sats)
        for (const l of lights) {
          const page = pageFrom(fromHsl({ h, s, l }));
          assert.ok(holdsInks(page), `${page} from h${h} s${s} l${l}`);
          assert.ok(contrast(page, '#FFFFFF') >= ARTWORK_PALETTE.read.white, page);
          assert.ok(contrast(page, quietInk(page)) >= ARTWORK_PALETTE.read.quiet, page);
        }
  });

  it('keeps the picture’s hue, re-lit into BitChord’s band', () => {
    const page = pageFrom('#2060D0');
    const hsl = toHsl(page)!;
    assert.ok(Math.abs(hsl.h - toHsl('#2060D0')!.h) < 2, page);
    assert.ok(hsl.l >= 0.13 - 1e-9 && hsl.l <= 0.24 + 1e-9, `${page} at ${hsl.l}`);
    assert.ok(hsl.s <= 0.62 + 0.01, `${page} at ${hsl.s}`);
  });

  it('a dark picture gives a dark page, and a bright one is brought down', () => {
    assert.ok(toHsl(pageFrom('#06080A'))!.l <= 0.13 + 1e-9);
    assert.ok(toHsl(pageFrom('#F0E0A0'))!.l <= 0.24 + 1e-9);
  });

  it('a grey is not given a hue: near-black gives a neutral page, not maroon', () => {
    const page = pageFrom('#0B0B0B');
    const rgb = [page.slice(1, 3), page.slice(3, 5), page.slice(5, 7)].map((c) => parseInt(c, 16));
    assert.ok(Math.max(...rgb) - Math.min(...rgb) <= 1, page);
  });
});

/**
 * Five live heroes, as the phone reads them: IGDB's `t_cover_small_2x` of the
 * chosen art (`lib/games/hero-art`), cropped as a 360dp phone's hero frame
 * crops it. Each was picked for what it tests.
 */
const HEROES = {
  /* A grey-blue picture with a small red logo. */
  godOfWar: 'god-of-war.jpg',
  /* Red is the game. */
  persona: 'persona-5-royal.jpg',
  /* Near-black, with a 1% fleck of red (the blood). */
  witcher: 'the-witcher-3.jpg',
  stardew: 'stardew-valley.jpg',
  doom: 'doom-eternal.jpg',
  /* A blue page whose buttons came out olive (the owner's, 2026-10-27). */
  ark: 'ark-survival-evolved.jpg',
} as const;

const FRAME = { width: 1.18, height: 1 };

function read(file: string) {
  const decoded = jpeg.decode(
    readFileSync(new URL(`./fixtures/page-color/${file}`, import.meta.url)),
    {
      useTArray: true,
    }
  );
  const region = visibleRegion(decoded, FRAME);
  return {
    page: cropPixels(decoded.data, decoded.width, decoded.height, region, PAGE_COLOR.crop),
    seed: cropPixels(decoded.data, decoded.width, decoded.height, region, 0),
  };
}

const hueOf = (color: string) => toHsl(color)!.h;
const isRed = (color: string) => hueOf(color) < 15 || hueOf(color) > 340;

const artworkOf = (file: string) => readArtwork(read(file).page)!;

describe('the page, on real heroes', () => {
  const pages = Object.fromEntries(
    Object.entries(HEROES).map(([name, file]) => [name, pageFrom(artworkOf(file).dominant)])
  ) as Record<keyof typeof HEROES, string>;

  it('every page holds white at 7:1 and its quiet ink at 4.5:1', () => {
    for (const page of Object.values(pages)) assert.ok(holdsInks(page), page);
  });

  it('God of War is its dark blue-grey, not its logo', () => {
    assert.ok(!isRed(pages.godOfWar), pages.godOfWar);
    const hue = hueOf(pages.godOfWar);
    assert.ok(hue >= 170 && hue <= 240, `${pages.godOfWar} at ${hue}°`);
  });

  it('The Witcher 3 is dark and not the colour of its blood', () => {
    assert.ok(luminance(pages.witcher) < 0.05, pages.witcher);
    assert.ok(toHsl(pages.witcher)!.s < 0.4, pages.witcher);
  });

  it('Stardew Valley is blue and DOOM Eternal is red-orange', () => {
    const blue = hueOf(pages.stardew);
    assert.ok(blue > 200 && blue < 250, pages.stardew);
    const doom = hueOf(pages.doom);
    assert.ok(doom < 40 || doom > 345, pages.doom);
  });

  it('Persona 5 Royal and ARK, mostly black, are neutral — and their colour is the accent', () => {
    for (const name of ['persona', 'ark'] as const) {
      const hsl = toHsl(pages[name])!;
      assert.ok(hsl.s < ARTWORK_PALETTE.greyGuard, `${name}: ${pages[name]}`);
    }
    assert.ok(isRed(artworkOf(HEROES.persona).accent), artworkOf(HEROES.persona).accent);
    const ark = hueOf(artworkOf(HEROES.ark).accent);
    assert.ok(ark > 190 && ark < 240, `ARK’s accent at ${ark}°`);
  });
});

describe('pageInks — BitChord’s quiet ink', () => {
  it('white, and the page’s own hue lifted pale', () => {
    const page = '#5D1C24';
    const inks = pageInks(page);
    assert.equal(inks.primary, '#FFFFFF');
    assert.equal(inks.secondary, quietInk(page));
    assert.ok(Math.abs(hueOf(inks.secondary) - hueOf(page)) < 3, inks.secondary);
    assert.ok(Math.abs(toHsl(inks.secondary)!.l - ARTWORK_PALETTE.quiet.lightness) < 0.01);
  });

  it('the owner’s reference: their value ink is within reach of ours on their page', () => {
    /* `#D69BA1` on `#5D1C24`, measured off the owner's image (2026-10-28). */
    const ours = quietInk('#5D1C24');
    assert.ok(deltaE(ours, '#D69BA1') < 12, `${ours} against #D69BA1`);
    assert.ok(
      contrast(ours, '#5D1C24') >= contrast('#D69BA1', '#5D1C24'),
      'and reads at least as well'
    );
  });

  it('a grey page’s quiet ink is grey', () => {
    const quiet = quietInk('#212121');
    assert.ok(toHsl(quiet)!.s < ARTWORK_PALETTE.greyGuard, quiet);
  });
});

describe('m3Seeds — Material’s own seed for the buttons', () => {
  it('is deterministic, and leaves Math.random as it found it', () => {
    const { seed } = read(HEROES.godOfWar);
    const random = Math.random;
    const first = m3Seeds(seed);
    assert.equal(Math.random, random);
    assert.deepEqual(m3Seeds(seed), first);
    assert.ok(first.length > 0);
  });

  it('is a colour of the picture: DOOM’s is red-orange', () => {
    const [best] = m3Seeds(read(HEROES.doom).seed);
    const hue = hueOf(best);
    assert.ok(hue < 40 || hue > 345, best);
  });

  it('a grey picture has none, and the caller falls back', () => {
    assert.deepEqual(m3Seeds(image(30, 30, (x) => (x % 2 ? '#808080' : '#404040'))), []);
  });
});

describe('the buttons: of the page’s family, apart by tone', () => {
  /* The button's own arithmetic (`filledRoles`): the scheme's primary at a
     tone, lifted to the vivid floor. */
  const fillAt = (seed: string, tone?: number) =>
    saturate(generateDynamicTheme(seed, true, { primaryTone: tone }).primary, VIVID_FLOOR);
  const hueGap = (a: string, b: string) => {
    const d = Math.abs(Hct.fromInt(argbFromHex(a)).hue - Hct.fromInt(argbFromHex(b)).hue) % 360;
    return d > 180 ? 360 - d : d;
  };
  const buttonsFor = (file: string) => {
    const { page: pagePixels, seed: seedPixels } = read(file);
    const artwork = readArtwork(pagePixels)!;
    const page = pageFrom(artwork.dominant);
    const family = buttonFamily(page, artwork.accent);
    const harmony = harmonySeed(m3Seeds(seedPixels), family)!;
    const tone = buttonTone(page, (at) => fillAt(harmony.seed, at));
    return { page, family, seed: harmony.seed, tone, fill: fillAt(harmony.seed, tone) };
  };

  it('ARK: Survival Evolved’s buttons are its blue, not earth (the owner’s, 2026-10-27)', () => {
    const ark = buttonsFor(HEROES.ark);
    /* Its page is neutral now, so the buttons keep to the accent — the sky's
       blue, which leads the field. They were an olive #9FA21A. */
    assert.notEqual(ark.family, ark.page, 'a neutral page hands the family to the accent');
    assert.ok(hueGap(ark.fill, ark.family) < 40, `${ark.fill} for ${ark.family}`);
    assert.ok(deltaE(ark.fill, ark.page) >= PAGE_COLOR.accentDistance, 'and still stand apart');
  });

  it('a neutral page keeps its buttons to the accent; a coloured one to itself', () => {
    assert.equal(buttonFamily('#212121', '#2060D0'), '#2060D0');
    assert.equal(buttonFamily('#173F63', '#E01010'), '#173F63');
    assert.equal(buttonFamily('#212121', '#5A5A5A'), '#212121');
    assert.equal(buttonFamily('#212121', null), '#212121');
  });

  it('God of War’s are not its logo’s red', () => {
    const gow = buttonsFor(HEROES.godOfWar);
    assert.ok(!isRed(gow.fill), `${gow.fill} on ${gow.page}`);
  });

  it('every hero’s buttons stand ΔE 30 from its page, and read their own ink', () => {
    for (const file of Object.values(HEROES)) {
      const buttons = buttonsFor(file);
      const ink = generateDynamicTheme(buttons.seed, true, { primaryTone: buttons.tone }).onPrimary;
      assert.ok(deltaE(buttons.fill, buttons.page) >= PAGE_COLOR.accentDistance, file);
      assert.ok(contrast(ink, buttons.fill) >= 4.5, `${file}: ink on its button`);
    }
  });

  it('a card in the button’s colour reads: its ink and its quieter ink hold AA', () => {
    for (const file of Object.values(HEROES)) {
      const buttons = buttonsFor(file);
      const onPrimary = generateDynamicTheme(buttons.seed, true, {
        primaryTone: buttons.tone,
      }).onPrimary;
      /* `filledRoles`' ink, then the card's (`filledInks`). */
      const ink = ensureContrast(onPrimary, buttons.fill, 4.5);
      const inks = filledInks(buttons.fill, ink);
      assert.ok(contrast(inks.text, buttons.fill) >= 4.5, `${file}: text`);
      assert.ok(contrast(inks.secondary, buttons.fill) >= 4.5, `${file}: secondary`);
      assert.notEqual(inks.secondary, inks.text, `${file}: quieter than the text`);
    }
  });

  it('a grey page takes the art’s best seed, whatever its hue', () => {
    assert.deepEqual(harmonySeed(['#C02030', '#2050C0'], '#5A5A5C'), {
      seed: '#C02030',
      from: 'art',
    });
  });

  it('a seed near the page is harmonized toward it; none near, the page seeds it', () => {
    const page = '#2060B0';
    const near = harmonySeed(['#C02030', '#3070D0'], page)!;
    assert.equal(near.from, 'art');
    assert.ok(hueGap(near.seed, page) <= hueGap('#3070D0', page), 'pulled toward the page');
    assert.deepEqual(harmonySeed(['#C02030'], page), { seed: page, from: 'page' });
  });

  it('keeps the scheme’s own tone on a dark page, and goes lighter on a mid one', () => {
    const fill = (at: number) => fillAt('#2060B0', at);
    assert.equal(buttonTone('#101828', fill), HARMONY.toneFrom);
    assert.ok(buttonTone('#4070B0', fill) > HARMONY.toneFrom);
  });

  it('moves the primary alone: every other role of the scheme is the same', () => {
    const plain = generateDynamicTheme('#2060B0', true);
    const lifted = generateDynamicTheme('#2060B0', true, { primaryTone: 85 });
    assert.notEqual(lifted.primary, plain.primary);
    for (const role of Object.keys(plain) as (keyof typeof plain)[]) {
      if (role !== 'primary') assert.equal(lifted[role], plain[role], role);
    }
  });
});
