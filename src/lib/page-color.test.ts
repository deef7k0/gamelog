import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import jpeg from 'jpeg-js';

import { generateDynamicTheme } from '../theme/dynamic-color.ts';
import { contrast, luminance, mix, saturate, toHsl } from './color.ts';
import { visibleRegion } from './key-color.ts';
import {
  GLASS,
  PAGE_COLOR,
  cropPixels,
  darkenForWhite,
  deltaE,
  m3Seeds,
  pageInks,
  paletteOf,
  pickAccentSeed,
  pickPageColor,
  type Candidate,
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

const candidate = (color: string, population: number, ...names: Candidate['names']) => ({
  color,
  population,
  names,
});

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

describe('paletteOf', () => {
  it('names Palette’s targets and counts what it counted', () => {
    /* Three quarters a mid saturated blue, a quarter a dark muted grey-green. */
    const data = image(40, 40, (x, y) => (y < 30 ? '#2060D0' : '#303828'));
    const { candidates, counted } = paletteOf(data);
    const blue = candidates.find((entry) => entry.color.startsWith('#2'));
    assert.ok(blue, 'the blue is a candidate');
    assert.ok(blue.names.includes('dominant'));
    assert.ok(blue.names.includes('vibrant') || blue.names.includes('darkVibrant'));
    assert.equal(counted, 40 * 40);
    /* The mean is offered last, with no population of its own. */
    assert.deepEqual(candidates.at(-1)?.names, ['average']);
  });

  it('is sorted by population', () => {
    const data = image(30, 30, (x) => (x < 5 ? '#C02020' : x < 15 ? '#20A040' : '#2040A0'));
    const { candidates } = paletteOf(data);
    const swatches = candidates.filter((entry) => !entry.names.includes('average'));
    for (let i = 1; i < swatches.length; i += 1) {
      assert.ok(swatches[i - 1].population >= swatches[i].population);
    }
  });
});

describe('pickPageColor — the brief’s rules', () => {
  const counted = 1000;

  it('rule 2: a grey under the saturation floor is not a page', () => {
    const pick = pickPageColor({
      candidates: [candidate('#606060', 900, 'dominant'), candidate('#2A5590', 100, 'muted')],
      counted,
    });
    assert.equal(pick.from?.color, '#2A5590');
  });

  it('rule 3: near-black and near-white are not pages', () => {
    const pick = pickPageColor({
      candidates: [
        candidate('#100808', 500, 'dominant'),
        candidate('#F8F0F0', 300, 'lightMuted'),
        candidate('#7A3040', 200, 'muted'),
      ],
      counted,
    });
    assert.equal(pick.from?.color, '#7A3040');
  });

  it('rule 4: the page is darkened until white holds 3:1, and no further', () => {
    const pick = pickPageColor({ candidates: [candidate('#80C8F0', 1000, 'dominant')], counted });
    assert.ok(pick.darkened);
    assert.ok(contrast(pick.color, '#FFFFFF') >= PAGE_COLOR.whiteContrast);
    /* One step lighter would not have held. */
    const hsl = toHsl(pick.color)!;
    assert.equal(Math.round(toHsl(pick.from!.color)!.h), Math.round(hsl.h));
    assert.equal(darkenForWhite(pick.color), pick.color);
  });

  it('rule 6: a vibrant swatch beats a larger muted one', () => {
    const pick = pickPageColor({
      candidates: [candidate('#506070', 600, 'muted'), candidate('#2050C0', 300, 'vibrant')],
      counted,
    });
    assert.equal(pick.from?.color, '#2050C0');
  });

  it('a fleck is not a page, however vibrant (under 5% of the picture)', () => {
    const pick = pickPageColor({
      candidates: [candidate('#587890', 600, 'muted'), candidate('#C01020', 20, 'vibrant')],
      counted,
    });
    assert.equal(pick.from?.color, '#587890');
  });

  it('nothing saturated enough: the most saturated, rather than a flat grey', () => {
    const pick = pickPageColor({
      candidates: [candidate('#606060', 600, 'dominant'), candidate('#5A6066', 400, 'muted')],
      counted,
    });
    assert.equal(pick.by, 'most-saturated');
    assert.equal(pick.from?.color, '#5A6066');
  });

  it('nothing at all: Apple’s system dark grey', () => {
    const white = image(20, 20, () => '#FFFFFF');
    const pick = pickPageColor(paletteOf(cropPixels(white, 20, 20, undefined, PAGE_COLOR.crop)));
    assert.equal(pick.by, 'rejected');
    assert.equal(pick.color, PAGE_COLOR.rejected);
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

describe('pickPageColor — on real heroes', () => {
  const picks = Object.fromEntries(
    Object.entries(HEROES).map(([name, file]) => [name, pickPageColor(paletteOf(read(file).page))])
  ) as Record<keyof typeof HEROES, ReturnType<typeof pickPageColor>>;

  it('every page holds white at 3:1', () => {
    for (const pick of Object.values(picks)) {
      assert.ok(contrast(pick.color, '#FFFFFF') >= PAGE_COLOR.whiteContrast, pick.color);
    }
  });

  it('God of War is its blue-grey, not its logo', () => {
    const hue = hueOf(picks.godOfWar.color);
    assert.ok(hue > 180 && hue < 240, `${picks.godOfWar.color} at ${hue}°`);
  });

  it('Persona 5 Royal is red', () => assert.ok(isRed(picks.persona.color), picks.persona.color));

  it('The Witcher 3 is not the colour of its blood', () => {
    assert.ok(!isRed(picks.witcher.color) || toHsl(picks.witcher.color)!.s < 0.4);
    assert.ok(luminance(picks.witcher.color) < 0.05, 'a dark picture gives a dark page');
  });

  it('Stardew Valley is blue and DOOM Eternal is red-orange', () => {
    const blue = hueOf(picks.stardew.color);
    assert.ok(blue > 200 && blue < 250, picks.stardew.color);
    const doom = hueOf(picks.doom.color);
    assert.ok(doom < 40 || doom > 345, picks.doom.color);
  });
});

describe('pageInks', () => {
  it('white on every page the filter can return, the secondary at 60%', () => {
    const inks = pageInks('#587890');
    assert.equal(inks.primary, '#FFFFFF');
    assert.equal(inks.secondary, 'rgba(255, 255, 255, 0.6)');
    assert.equal(inks.secondarySolid, mix('#587890', '#FFFFFF', 0.6));
  });

  it('black on a light page', () => assert.equal(pageInks('#E8E8E8').primary, '#000000'));
});

describe('the glass', () => {
  it('reads brightest to darkest: highlight, edge, fill, page', () => {
    const over = (alpha: number, page: string) => mix(page, '#FFFFFF', alpha);
    const alphaOf = (rgba: string) => Number(rgba.match(/[\d.]+\)$/)![0].slice(0, -1));
    for (const page of ['#587890', '#A80008', '#082060', '#301F16']) {
      const fill = over(alphaOf(GLASS.fill), page);
      const edge = over(alphaOf(GLASS.edge), page);
      /* The highlight is drawn inside the edge, over the fill. */
      const highlight = over(alphaOf(GLASS.highlight), edge);
      assert.ok(luminance(fill) > luminance(page), `fill on ${page}`);
      assert.ok(luminance(edge) > luminance(fill), `edge on ${page}`);
      assert.ok(luminance(highlight) > luminance(edge), `highlight on ${page}`);
    }
  });

  it('is see-through: the fill sits in the brief’s 0.10–0.15, and says so twice alike', () => {
    assert.ok(GLASS.fillAlpha >= 0.1 && GLASS.fillAlpha <= 0.15);
    assert.equal(GLASS.fill, `rgba(255, 255, 255, ${GLASS.fillAlpha})`);
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

describe('pickAccentSeed — rule 5', () => {
  /* The button's own arithmetic: M3's dark primary, lifted as `filledRoles` lifts it. */
  const fillOf = (seed: string) => saturate(generateDynamicTheme(seed, true).primary, 0.72);

  it('keeps the first seed whose button stands ΔE 30 from the page', () => {
    const page = '#082060';
    /* A blue seed's button on a blue page, then an orange one. */
    const picked = pickAccentSeed(['#1B57E8', '#E06020'], page, fillOf);
    assert.ok(picked);
    assert.ok(deltaE(fillOf(picked.seed), page) >= PAGE_COLOR.accentDistance);
  });

  it('turns the hue 180° when no seed stands apart', () => {
    const picked = pickAccentSeed(['#3060C0'], '#3060C0', () => '#3264C0');
    assert.ok(picked?.rotated);
    const turned = hueOf(picked!.seed);
    const turn = (((turned - hueOf('#3060C0')) % 360) + 360) % 360;
    assert.ok(Math.abs(turn - 180) < 2, `${turn}°`);
  });

  it('has nothing to say without seeds', () => {
    assert.equal(pickAccentSeed([], '#3060C0', fillOf), null);
  });
});
