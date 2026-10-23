import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { DISCOVER, discoverGeometry, discoverKeyline, discoverScrim } from './discover-carousel';

describe('discover carousel', () => {
  it("is SimpMusic's on a 360dp phone: a 266dp card, 320 tall, 28 round", () => {
    const g = discoverGeometry(360);
    assert.ok(Math.abs(g.hero - 266.4) < 0.01);
    assert.equal(DISCOVER.height, 320);
    assert.equal(DISCOVER.radius, 28);
    assert.equal(g.step, g.hero + 8);
  });

  it('never makes the middle card wider than 360', () => {
    assert.equal(discoverGeometry(800).hero, 360);
  });

  it('fills the row exactly: padding, two neighbours, two gaps and the card', () => {
    const g = discoverGeometry(360);
    assert.ok(
      Math.abs(2 * DISCOVER.padding + 2 * g.small + 2 * DISCOVER.gap + g.hero - 360) < 1e-9
    );
  });

  it('centres the middle card', () => {
    const g = discoverGeometry(360);
    const k = discoverKeyline(0, g);
    assert.ok(Math.abs(k.left + k.width / 2 - 180) < 1e-9);
    assert.equal(k.width, g.hero);
  });

  it('keeps every gap exactly 8 at every point of a swipe', () => {
    const g = discoverGeometry(392);
    for (let progress = 0; progress <= 3; progress += 0.05) {
      for (let index = 0; index < 5; index += 1) {
        const a = discoverKeyline(index - progress, g);
        const b = discoverKeyline(index + 1 - progress, g);
        assert.ok(Math.abs(b.left - (a.left + a.width) - DISCOVER.gap) < 1e-9);
      }
    }
  });

  it('morphs a neighbour into the middle card as it arrives', () => {
    const g = discoverGeometry(360);
    const half = discoverKeyline(0.5, g);
    assert.ok(Math.abs(half.width - (g.hero + g.small) / 2) < 1e-9);
  });

  it('ramps the scrim from clear at 45% to 0.78 at the foot', () => {
    const { locations, alphas } = discoverScrim();
    assert.equal(locations[0], DISCOVER.scrimFrom);
    assert.equal(locations.at(-1), 1);
    assert.equal(alphas[0], 0);
    assert.ok(Math.abs(alphas.at(-1)! - 0.78) < 1e-9);
  });
});
