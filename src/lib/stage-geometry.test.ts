import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  STAGE_CAMERA,
  driftProgress,
  lampGlint,
  lampShade,
  nearestFace,
  nearestFront,
  restAfter,
  rubberBand,
  showsFront,
  smoothstep,
  solveFace,
  turnX,
  turnZ,
  wrapDegrees,
  type FacePose,
} from './stage-geometry.ts';

const RAD = Math.PI / 180;
const HEIGHT = 400;

type Point = { x: number; y: number };

/** Where the camera really puts an upright edge: its top, at half the face's height. */
function real(x: number, z: number, scale = 1): Point {
  const k = STAGE_CAMERA / (STAGE_CAMERA - z);
  return { x: x * k, y: (HEIGHT / 2) * scale * k };
}

/**
 * Where the two nested views put a corner of the laid-out rectangle — the
 * transforms the showcase hands to React Native, done by hand: the inner view
 * turned about its centre under its own perspective, then the outer scale and
 * translation applied on the screen.
 */
function drawn(pose: FacePose, width: number, side: -1 | 1): Point {
  const x = (side * width) / 2;
  const turnedX = x * Math.cos(pose.angle * RAD);
  const turnedZ = -x * Math.sin(pose.angle * RAD);
  const k = pose.perspective / (pose.perspective - turnedZ);
  return { x: pose.tx + pose.sx * turnedX * k, y: pose.sy * (HEIGHT / 2) * k };
}

function assertLandsOn(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  width: number,
  scale = 1
): FacePose {
  const pose = solveFace(ax, az, bx, bz, width, scale);
  assert.ok(pose.visible, `face (${ax},${az})→(${bx},${bz}) should be visible`);
  const left = drawn(pose, width, -1);
  const right = drawn(pose, width, 1);
  const a = real(ax, az, scale);
  const b = real(bx, bz, scale);
  for (const [got, want, what] of [
    [left.x, a.x, 'left edge x'],
    [left.y, a.y, 'left edge height'],
    [right.x, b.x, 'right edge x'],
    [right.y, b.y, 'right edge height'],
  ] as const) {
    assert.ok(Math.abs(got - want) < 1e-6, `${what}: drew ${got}, the camera sees ${want}`);
  }
  return pose;
}

/** The four upright faces of a shut case, turned. */
function box(width: number, depth: number, degrees: number) {
  const at = (x: number, z: number) => [turnX(x, z, degrees), turnZ(x, z, degrees)] as const;
  const w = width / 2;
  const d = depth / 2;
  return {
    front: [...at(-w, d), ...at(w, d), width] as const,
    back: [...at(w, -d), ...at(-w, -d), width] as const,
    spine: [...at(-w, -d), ...at(-w, d), depth] as const,
    edge: [...at(w, d), ...at(w, -d), depth] as const,
  };
}

describe('solveFace', () => {
  it('draws a face square to the camera at its real size for its distance', () => {
    const pose = assertLandsOn(-150, 15, 150, 15, 300);
    assert.equal(pose.angle, 0);
    assert.ok(Math.abs(pose.sx - STAGE_CAMERA / (STAGE_CAMERA - 15)) < 1e-9);
    assert.ok(Math.abs(pose.sx - pose.sy) < 1e-9);
  });

  it('lands every visible face of a turning box on its real projection', () => {
    let checked = 0;
    for (let degrees = -180; degrees <= 540; degrees += 7) {
      for (const face of Object.values(box(295, 31, degrees))) {
        const [ax, az, bx, bz, width] = face;
        if (!solveFace(ax, az, bx, bz, width).visible) continue;
        assertLandsOn(ax, az, bx, bz, width);
        checked += 1;
      }
    }
    assert.ok(checked > 150, `only ${checked} faces were ever visible`);
  });

  it('shows the cover from in front, the back from behind, and never both', () => {
    for (let degrees = 0; degrees < 360; degrees += 5) {
      const { front, back } = box(295, 31, degrees);
      const seesFront = solveFace(...front).visible;
      const seesBack = solveFace(...back).visible;
      assert.ok(!(seesFront && seesBack), `both faces at ${degrees}°`);
    }
    assert.ok(solveFace(...box(295, 31, 0).front).visible);
    assert.ok(!solveFace(...box(295, 31, 0).back).visible);
    assert.ok(solveFace(...box(295, 31, 180).back).visible);
    assert.ok(!solveFace(...box(295, 31, 180).front).visible);
  });

  it('shows the spine as the cover turns to the right, and only once it has cleared the cover', () => {
    /* Square on, a box's sides are hidden behind its face — the camera is close
       enough that they stay hidden for the first few degrees. */
    assert.ok(!solveFace(...box(295, 31, 0).spine).visible);
    assert.ok(!solveFace(...box(295, 31, 5).spine).visible);
    assert.ok(solveFace(...box(295, 31, 30).spine).visible);
    assert.ok(!solveFace(...box(295, 31, 30).edge).visible);
    assert.ok(solveFace(...box(295, 31, -30).edge).visible);
    assert.ok(!solveFace(...box(295, 31, -30).spine).visible);
  });

  it('joins the cover to the spine along their shared corner', () => {
    for (const degrees of [15, 30, 45, 60, 80]) {
      const { front, spine } = box(295, 31, degrees);
      const cover = solveFace(...front);
      const side = solveFace(...spine);
      const coverLeft = drawn(cover, 295, -1);
      const spineRight = drawn(side, 31, 1);
      assert.ok(Math.abs(coverLeft.x - spineRight.x) < 1e-6, `gap at ${degrees}°`);
      assert.ok(Math.abs(coverLeft.y - spineRight.y) < 1e-6, `step at ${degrees}°`);
    }
  });

  it('carries the scale of a smaller object into its height', () => {
    assertLandsOn(-120, 10, 140, -30, 295, 0.9);
  });

  it('still lands an open cover, which points at the camera from the side', () => {
    /* The inside of a cover standing 100° open, on a case turned -12°: seen at
       a glancing angle, its near end a third taller than its hinge. The view
       cannot be turned that far and stay drawable, so its perspective is
       tightened instead — and it must land all the same. */
    const pose = assertLandsOn(-228.4, 290.5, -107.8, 22.9, 295, 0.9);
    assert.ok(Math.abs(pose.angle) <= 72);
    assert.ok(pose.perspective > 0 && Number.isFinite(pose.sx));
  });

  it('answers finite numbers for every face it calls visible', () => {
    for (let degrees = 0; degrees < 360; degrees += 1) {
      for (const face of Object.values(box(243, 49, degrees))) {
        const pose = solveFace(...face);
        if (!pose.visible) continue;
        for (const value of [pose.tx, pose.sx, pose.sy, pose.perspective, pose.angle]) {
          assert.ok(Number.isFinite(value), `not finite at ${degrees}°`);
        }
        assert.ok(pose.sx > 0 && pose.sy > 0 && pose.perspective > 0);
      }
    }
  });
});

describe('the turn', () => {
  it('carries the near face to the right on a positive turn', () => {
    assert.ok(turnX(0, 10, 20) > 0);
    assert.ok(turnX(0, 10, -20) < 0);
    /* And the right-hand edge away from the camera. */
    assert.ok(turnZ(100, 0, 20) < 0);
  });

  it('finds the nearest face and the nearest cover', () => {
    assert.equal(nearestFace(80), 0);
    assert.equal(nearestFace(100), 180);
    assert.equal(nearestFace(-100), -180);
    assert.equal(nearestFace(530), 540);
    assert.equal(nearestFront(170), 0);
    assert.equal(nearestFront(190), 360);
    assert.equal(nearestFront(-200), -360);
  });

  it('knows which side is showing', () => {
    assert.ok(showsFront(0));
    assert.ok(showsFront(80));
    assert.ok(!showsFront(100));
    assert.ok(!showsFront(180));
    assert.ok(showsFront(360));
    assert.ok(showsFront(-30));
  });

  it('comes to rest on the face its momentum was carrying it to', () => {
    assert.equal(restAfter(20, 0), 0);
    assert.equal(restAfter(20, 400), 180);
    assert.equal(restAfter(20, -700), -180);
    /* A hard flick goes round more than once. */
    assert.equal(restAfter(0, 2000), 360);
  });
});

describe('driftProgress', () => {
  const HALVES = 200;
  const LINGER = 0.22;

  it('starts at nothing, ends at everything, and never goes back', () => {
    assert.equal(driftProgress(0, HALVES, LINGER), 0);
    assert.ok(Math.abs(driftProgress(1, HALVES, LINGER) - 1) < 1e-12);
    let last = 0;
    for (let i = 1; i <= 20_000; i += 1) {
      const now = driftProgress(i / 20_000, HALVES, LINGER);
      assert.ok(now > last, `stood still or went back at step ${i}`);
      last = now;
    }
  });

  it('is on a face at the end of every half-turn', () => {
    for (const half of [1, 2, 37, 199]) {
      const turned = driftProgress(half / HALVES, HALVES, LINGER) * HALVES;
      assert.ok(Math.abs(turned - half) < 1e-9);
    }
  });

  it('lingers on a face and hurries through the edge', () => {
    const pace = (within: number) => {
      const step = 1e-5 / HALVES;
      const t = within / HALVES;
      return (driftProgress(t + step, HALVES, LINGER) - driftProgress(t, HALVES, LINGER)) / step;
    };
    const onFace = pace(0.001);
    const onEdge = pace(0.5);
    assert.ok(onFace > 0, 'it stopped on the face');
    assert.ok(onEdge > onFace * 4, `edge ${onEdge} is not much quicker than face ${onFace}`);
  });
});

describe('helpers', () => {
  it('eases a step', () => {
    assert.equal(smoothstep(0.2, 0.8, 0.1), 0);
    assert.equal(smoothstep(0.2, 0.8, 0.9), 1);
    assert.ok(Math.abs(smoothstep(0.2, 0.8, 0.5) - 0.5) < 1e-12);
  });

  it('gives way to a drag and never past its limit', () => {
    assert.ok(Math.abs(rubberBand(1, 22) - 1) < 0.05);
    assert.ok(rubberBand(22, 22) < 22 && rubberBand(22, 22) > 10);
    assert.ok(rubberBand(500, 22) <= 22);
    assert.equal(rubberBand(-40, 22), -rubberBand(40, 22));
  });
});

describe('the lamp', () => {
  it('brings any angle into one lap', () => {
    assert.equal(wrapDegrees(0), 0);
    assert.equal(wrapDegrees(190), -170);
    assert.equal(wrapDegrees(-190), 170);
    assert.equal(wrapDegrees(720 + 30), 30);
  });

  it('darkens a face as it turns away, and barely touches one that is square', () => {
    assert.ok(lampShade(0, 0) < 0.06);
    assert.ok(lampShade(80, 0) > lampShade(40, 0));
    assert.ok(lampShade(40, 0) > lampShade(0, 0));
    /* The side toward the lamp is the lit one. */
    assert.ok(lampShade(-24, 0) < 1e-9);
    assert.ok(lampShade(-60, 0) < lampShade(60, 0));
    /* A lap later it is the same face. */
    assert.ok(Math.abs(lampShade(370, 0) - lampShade(10, 0)) < 1e-9);
  });

  it('keeps the reflection off a face at rest, and brings it across with a turn or a tilt', () => {
    const rest = lampGlint(0, 0, 0);
    assert.ok(rest < 0, 'the glint should wait off the left edge');
    /* Coming round to square from the left, it crosses the middle. */
    const turning = lampGlint(-18, 0, 0);
    assert.ok(turning > 0.3 && turning < 0.7, `turning: ${turning}`);
    /* And the phone alone moves it, with the case standing still. */
    assert.ok(lampGlint(0, 0.7, 0) > 0.3);
    assert.ok(lampGlint(0, 0, 1) > rest);
  });
});

describe('worklets', () => {
  /*
   * Every function in that module runs on the UI thread, where the names a
   * worklet captures — a constant, another function — are unpacked from its
   * closure by the first statement of its body. A parameter's default is
   * evaluated before the body, so one that names a constant finds nothing:
   * "Property 'STAGE_CAMERA' doesn't exist", on the first frame, on a device.
   * Node cannot see that — here a default reads the module like anything else,
   * which is how it shipped once with every test green. So the source is read:
   * a default may be a number, a string, a boolean or null, and nothing else.
   */
  it('gives no worklet a parameter default that reads outside the function', () => {
    const source = readFileSync(new URL('./stage-geometry.ts', import.meta.url), 'utf8');
    const signatures = [...source.matchAll(/export function (\w+)\(([^)]*)\)/g)];
    assert.ok(signatures.length > 10, 'the module was not read as expected');

    for (const [, name, parameters] of signatures) {
      for (const [, value] of parameters.matchAll(/=\s*([^,)]+)/g)) {
        assert.match(
          value.trim(),
          /^(-?\d+(\.\d+)?|'[^']*'|true|false|null)$/,
          `${name} has a parameter default of \`${value.trim()}\`; read it in the body instead`
        );
      }
    }
  });
});
