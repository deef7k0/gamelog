import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  CASE_WIDTH_SHARE,
  OPEN_ANGLE,
  OPEN_SCALE,
  OPEN_SHIFT,
  OPEN_TURN,
  caseBuildFor,
  caseDepth,
  discDiameter,
  opensToDisc,
  stageMetrics,
} from './copy-stage.ts';
import { STAGE_CAMERA, turnX, turnZ } from '../lib/stage-geometry.ts';

/** A PS5 case's shape, from its template. */
const KEEP = 688 / 549;
/** A Switch 2 case: the tallest. */
const TALL = 870 / 610;
/** A SNES box: on its side. */
const WIDE = 497 / 680;

describe('stageMetrics', () => {
  it('stands the case 295dp wide on a 360dp phone, where it was 238', () => {
    const stage = stageMetrics(360, 800, 512, KEEP);
    assert.equal(stage.caseWidth, Math.floor(360 * CASE_WIDTH_SHARE));
    assert.equal(stage.caseWidth, 295);
  });

  it('never makes the stage taller than the room it was given', () => {
    for (const [width, height, room] of [
      [360, 800, 512],
      [412, 915, 600],
      [360, 640, 372],
      [320, 568, 300],
      [430, 932, 640],
    ]) {
      for (const shape of [KEEP, TALL, WIDE, 1, 1.75]) {
        const stage = stageMetrics(width, height, room, shape);
        /* The floor of 132dp is the one thing allowed to outgrow a tiny room. */
        if (stage.caseWidth > 132) {
          assert.ok(
            stage.stageHeight <= room + 2,
            `${width}×${height} shape ${shape}: stage ${stage.stageHeight} in a room of ${room}`
          );
        }
        assert.ok(stage.caseWidth <= width * CASE_WIDTH_SHARE);
        assert.ok(stage.floorY > stage.centreY && stage.stageHeight > stage.floorY);
      }
    }
  });

  it('takes the first screen whole for a keep case on a tall phone', () => {
    /* Width-bound, so shorter than its room: the spare height becomes air, and
       the notes under it stay below the fold. */
    const stage = stageMetrics(360, 800, 521, KEEP);
    assert.equal(stage.stageHeight, 521);
    /* Half the air above the case and half below it. */
    const above = stage.centreY - stage.caseHeight / 2;
    const below = stage.stageHeight - stage.floorY;
    assert.ok(above > 60 && below > 60, `above ${above}, below ${below}`);
  });

  it('does not stand a low box in the middle of an empty room', () => {
    const stage = stageMetrics(360, 800, 521, WIDE);
    assert.ok(stage.stageHeight < 400, `a SNES box was given ${stage.stageHeight}dp`);
  });

  it('keeps a wide box bound by the width, not the height', () => {
    const stage = stageMetrics(360, 800, 512, WIDE);
    assert.equal(stage.caseWidth, 295);
    assert.ok(stage.caseHeight < stage.caseWidth);
  });
});

describe('the box', () => {
  it('knows a cartridge box from a keep case from a jewel case', () => {
    assert.equal(caseBuildFor('ps5'), 'keep');
    assert.equal(caseBuildFor('switch'), 'keep');
    assert.equal(caseBuildFor('ps1'), 'jewel');
    assert.equal(caseBuildFor('snes'), 'box');
    assert.equal(caseBuildFor('genesis'), 'clamshell');
  });

  it('makes a cartridge box about twice as deep as a keep case', () => {
    const keep = caseDepth('ps5', true, 295, 370);
    const box = caseDepth('nes', true, 295, 404);
    assert.equal(keep, 31);
    assert.ok(box > keep * 1.8 && box < keep * 2.2);
    /* The shorter side: a box on its side is no deeper for being wider. */
    assert.equal(caseDepth('snes', true, 295, 216), Math.round(0.2 * 216));
  });

  it('gives bare box art a card and no more', () => {
    assert.equal(caseDepth('pc', false, 295, 442), 3);
  });

  it('opens a hinged case with a disc in it, and nothing else', () => {
    for (const platform of [
      'ps5',
      'ps2',
      'ps1',
      'xbox360',
      'wii',
      'gamecube',
      'dreamcast',
    ] as const) {
      assert.ok(opensToDisc(platform, true), platform);
    }
    for (const platform of ['switch', 'snes', 'gba', 'threeds', 'genesis', 'vita'] as const) {
      assert.ok(!opensToDisc(platform, true), platform);
    }
    /* A disc platform with no case has nothing to open. */
    assert.ok(!opensToDisc('pc', false));
    assert.ok(!opensToDisc('ps5', false));
  });
});

describe('the disc beside its case', () => {
  it('is 12cm in a 135mm keep case', () => {
    assert.equal(discDiameter('ps5', 295, 370), Math.round((295 * 120) / 135));
    assert.equal(discDiameter('ps5', 295, 370), 262);
  });

  it('is visibly smaller for a GameCube and a UMD', () => {
    assert.equal(discDiameter('gamecube', 295, 413), Math.round((295 * 80) / 135));
    assert.ok(discDiameter('psp', 240, 411) < 0.65 * 240);
  });

  it('always goes back in its box', () => {
    /* A jewel case is wider than it is tall. */
    const disc = discDiameter('ps1', 295, 253);
    assert.ok(disc < 253, `a ${disc}dp disc in a case 253dp tall`);
  });
});

describe('the open case', () => {
  /** Where the camera puts a point of the open case's plan on the screen. */
  function onScreen(x: number, z: number, width: number): number {
    const turnedX = OPEN_SCALE * turnX(x, z, OPEN_TURN) + OPEN_SHIFT * width;
    const turnedZ = OPEN_SCALE * turnZ(x, z, OPEN_TURN);
    return (turnedX * STAGE_CAMERA) / (STAGE_CAMERA - turnedZ);
  }

  it('keeps the whole tray on the display, and its cover leaving by the left', () => {
    for (const [windowWidth, windowHeight, room] of [
      [360, 800, 512],
      [412, 915, 600],
      [360, 640, 372],
    ]) {
      const { caseWidth, caseHeight } = stageMetrics(windowWidth, windowHeight, room, KEEP);
      const depth = caseDepth('ps5', true, caseWidth, caseHeight);
      const half = windowWidth / 2;

      const trayRight = onScreen(caseWidth / 2, depth / 2, caseWidth);
      const hinge = onScreen(-caseWidth / 2, depth / 2, caseWidth);
      assert.ok(trayRight < half - 8, `tray runs off the right at ${windowWidth}dp`);
      assert.ok(hinge > -half + 40, `no room for the cover at ${windowWidth}dp`);

      const radians = (OPEN_ANGLE * Math.PI) / 180;
      const coverEnd = onScreen(
        -caseWidth / 2 + caseWidth * Math.cos(radians),
        depth / 2 + caseWidth * Math.sin(radians),
        caseWidth
      );
      assert.ok(coverEnd < hinge, 'the cover swung the wrong way');
    }
  });
});
