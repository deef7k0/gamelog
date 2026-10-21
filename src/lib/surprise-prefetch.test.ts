import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  LIGHT_ANIMATION,
  LOOKAHEAD,
  PREFETCH_BUDGET,
  animationFor,
  chooseCardShape,
  planPrefetch,
  stillBytes,
  type CardArtAnswers,
} from './surprise-prefetch.ts';

const SQUARE = 'https://cdn2.steamgriddb.com/grid/abc.png';
const COVER = (n: number) => `https://images.igdb.com/igdb/image/upload/t_cover_big/co${n}.jpg`;
const PORTRAIT_LOOP = {
  url: 'https://cdn2.steamgriddb.com/grid/loop.webp',
  format: 'image' as const,
  bytes: 6_500_000,
};
const SQUARE_LOOP = {
  url: 'https://cdn2.steamgriddb.com/grid/sq.webp',
  format: 'image' as const,
  bytes: 1_000_000,
};

const known = (patch: Partial<CardArtAnswers>): CardArtAnswers => ({
  square: SQUARE,
  animatedSquare: null,
  animatedPortrait: null,
  ...patch,
});

describe('chooseCardShape', () => {
  const on = { animated: true, patience: false };
  const off = { animated: false, patience: false };

  it('never draws before the square has an answer', () => {
    assert.equal(chooseCardShape(known({ square: undefined }), on), null);
    assert.equal(chooseCardShape(known({ square: undefined }), off), null);
  });

  it('plays an animated square, then an animated portrait — over a still square', () => {
    assert.equal(chooseCardShape(known({ animatedSquare: SQUARE_LOOP }), on), 'square');
    assert.equal(
      chooseCardShape(known({ animatedSquare: null, animatedPortrait: PORTRAIT_LOOP }), on),
      'portrait'
    );
    assert.equal(
      chooseCardShape(known({ animatedSquare: SQUARE_LOOP, animatedPortrait: PORTRAIT_LOOP }), on),
      'square'
    );
  });

  it('plays a full-size portrait before a square that is only a preview', () => {
    const preview = { ...SQUARE_LOOP, format: 'video' as const, quality: 'preview' as const };
    assert.equal(
      chooseCardShape(known({ animatedSquare: preview, animatedPortrait: PORTRAIT_LOOP }), on),
      'portrait'
    );
    assert.equal(chooseCardShape(known({ animatedSquare: preview }), on), 'square');
  });

  it('falls back to the still square, then the box', () => {
    assert.equal(chooseCardShape(known({}), on), 'square');
    assert.equal(chooseCardShape(known({ square: null }), on), 'portrait');
  });

  it('waits for the animated answers — until patience runs out', () => {
    assert.equal(chooseCardShape(known({ animatedPortrait: undefined }), on), null);
    assert.equal(
      chooseCardShape(known({ animatedPortrait: undefined }), { animated: true, patience: true }),
      'square'
    );
  });

  it('does not wait for, or play, what is switched off', () => {
    assert.equal(
      chooseCardShape(known({ animatedSquare: undefined, animatedPortrait: PORTRAIT_LOOP }), off),
      'square'
    );
  });

  it('plays the animation of the shape it chose', () => {
    const answers = known({ animatedPortrait: PORTRAIT_LOOP });
    assert.equal(animationFor('portrait', answers), PORTRAIT_LOOP);
    assert.equal(animationFor('square', answers), null);
  });
});

describe('planPrefetch', () => {
  it('walks forward, a still a card, within the budget', () => {
    const cards = [1, 2, 3].map((distance) => ({
      distance,
      still: COVER(distance),
      animation: null,
    }));
    assert.deepEqual(planPrefetch(cards), [COVER(1), COVER(2), COVER(3)]);
  });

  it('never looks further than the lookahead', () => {
    const cards = Array.from({ length: 10 }, (_, index) => ({
      distance: index + 1,
      still: COVER(index + 1),
      animation: null,
    }));
    assert.equal(planPrefetch(cards).length, LOOKAHEAD);
  });

  it('stops at the first still that does not fit — a nearer card always first', () => {
    const cards = [
      { distance: 1, still: SQUARE, animation: null },
      { distance: 2, still: SQUARE, animation: null },
      { distance: 3, still: COVER(3), animation: null },
    ];
    const budget = stillBytes(SQUARE) + stillBytes(COVER(3));
    assert.deepEqual(planPrefetch(cards, budget), [SQUARE]);
  });

  it('takes a light animation with the next card, and only the next', () => {
    const light = { url: 'https://x.test/light.webp', format: 'image' as const, bytes: 400_000 };
    const plan = planPrefetch([
      { distance: 1, still: COVER(1), animation: light },
      { distance: 2, still: COVER(2), animation: { ...light, url: 'https://x.test/b.webp' } },
    ]);
    assert.deepEqual(plan, [COVER(1), light.url, COVER(2)]);
  });

  it('leaves a heavy animation, a video and a weightless one for when the card is in front', () => {
    const plan = planPrefetch([
      { distance: 1, still: COVER(1), animation: PORTRAIT_LOOP },
      { distance: 2, still: COVER(2), animation: null },
    ]);
    assert.deepEqual(plan, [COVER(1), COVER(2)]);
    assert.deepEqual(
      planPrefetch([
        {
          distance: 1,
          still: COVER(1),
          animation: { url: 'https://x.test/a.webm', format: 'video', bytes: 900_000 },
        },
      ]),
      [COVER(1)]
    );
    assert.deepEqual(
      planPrefetch([{ distance: 1, still: COVER(1), animation: { ...SQUARE_LOOP, bytes: null } }]),
      [COVER(1)]
    );
  });

  it('holds the light animation to the budget too', () => {
    const light = {
      url: 'https://x.test/light.webp',
      format: 'image' as const,
      bytes: LIGHT_ANIMATION,
    };
    const budget = stillBytes(COVER(1)) + LIGHT_ANIMATION - 1;
    assert.deepEqual(planPrefetch([{ distance: 1, still: COVER(1), animation: light }], budget), [
      COVER(1),
    ]);
  });

  it('fits every cover the lookahead reaches inside the budget', () => {
    const covers = Array.from({ length: 5 }, (_, index) => ({
      distance: index + 1,
      still: COVER(index + 1),
      animation: null,
    }));
    const spent = planPrefetch(covers).reduce((sum, url) => sum + stillBytes(url), 0);
    assert.ok(spent < PREFETCH_BUDGET);
  });
});
