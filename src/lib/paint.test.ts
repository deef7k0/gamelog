import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { paintReach } from './paint.ts';

describe('how far the paint has to reach', () => {
  it('reaches the tips of a pill, which are half its width away', () => {
    assert.equal(paintReach(160, 40, 999), 80);
    assert.equal(paintReach(90, 32, 16), 45);
  });

  it('reaches the corners of a square-cornered box', () => {
    assert.equal(paintReach(80, 60, 0), 50);
  });

  it("reaches a rounded box's corner arcs, not its bounding corners", () => {
    const reach = paintReach(160, 48, 20);
    assert.ok(reach < Math.hypot(80, 24), 'less than half the bounding diagonal');
    assert.ok(reach > 80, 'more than half the width: the corners stick out past the ends');
  });

  it('covers every point of the shape', () => {
    // Sample the edge of a 120×44 box with 12-unit corners.
    const width = 120;
    const height = 44;
    const corner = 12;
    const reach = paintReach(width, height, corner);
    for (let angle = 0; angle < Math.PI * 2; angle += 0.01) {
      const cx = Math.sign(Math.cos(angle)) * (width / 2 - corner);
      const cy = Math.sign(Math.sin(angle)) * (height / 2 - corner);
      const x = cx + Math.cos(angle) * corner;
      const y = cy + Math.sin(angle) * corner;
      assert.ok(Math.hypot(x, y) <= reach + 1e-9);
    }
  });
});
