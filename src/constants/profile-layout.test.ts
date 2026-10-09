import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { STACK_SIZE, stackLayout } from './cover-stack.ts';
import {
  BOX,
  FAVOURITES,
  IDENTITY_GAP,
  PROFILE_MARGIN,
  avatarSize,
  boxInside,
  favouriteCoverWidth,
} from './profile-layout.ts';

/** The mock: a 375pt screen. Its figures, in points. */
const MOCK = {
  screen: 375,
  margin: 20,
  avatar: 77,
  poster: 74.6,
  box: 333,
  boxPadding: 10,
  gap: 5,
};

const PHONES = [320, 360, 393, 412, 430];

describe('the profile against its mock', () => {
  it('takes the mock’s margin, not the app’s 15', () => {
    assert.equal(PROFILE_MARGIN, MOCK.margin);
  });

  it('draws the face at the mock’s share of the display', () => {
    const share = MOCK.avatar / MOCK.screen;
    assert.ok(Math.abs(avatarSize(360) / 360 - share) < 0.01, `${avatarSize(360)}`);
    assert.equal(avatarSize(360), 76);
  });

  it('draws a favourite at the mock’s share of the display, within two dp', () => {
    const scaled = (MOCK.poster / MOCK.screen) * 360;
    assert.ok(Math.abs(favouriteCoverWidth(360) - scaled) <= 2, `${favouriteCoverWidth(360)}`);
  });
});

describe('the box', () => {
  it('is as wide inside as the display, less the margin and its own inset twice', () => {
    assert.equal(boxInside(360), 360 - PROFILE_MARGIN * 2 - BOX.padding * 2);
    assert.equal(boxInside(360), 304);
    assert.equal(boxInside(0), 0);
  });

  it('is tighter than the mock’s, which is where the favourites’ extra width came from', () => {
    assert.ok(BOX.padding < MOCK.boxPadding);
    assert.ok(FAVOURITES.gap < MOCK.gap);
  });

  it('still keeps its contents a readable distance from its edge', () => {
    assert.ok(BOX.padding >= 8);
    assert.ok(FAVOURITES.gap >= 4);
  });
});

describe('the favourites', () => {
  it('fill the box with four covers and their gaps exactly, to within the rounding', () => {
    for (const display of PHONES) {
      const inside = boxInside(display);
      const used =
        favouriteCoverWidth(display) * FAVOURITES.columns +
        FAVOURITES.gap * (FAVOURITES.columns - 1);
      assert.ok(used <= inside, `${display}dp overflows`);
      assert.ok(inside - used < FAVOURITES.columns, `${display}dp leaves ${inside - used}`);
    }
  });

  it('are 73 across on a 360dp phone — two more than the mock’s insides gave', () => {
    const asTheMockHasIt = Math.floor(
      (360 - PROFILE_MARGIN * 2 - MOCK.boxPadding * 2 - MOCK.gap * (FAVOURITES.columns - 1)) /
        FAVOURITES.columns
    );
    assert.equal(asTheMockHasIt, 71);
    assert.equal(favouriteCoverWidth(360), 73);
  });

  it('keep a cover wide enough to read on the narrowest phone', () => {
    assert.ok(favouriteCoverWidth(320) >= 60);
  });
});

describe('the identity row', () => {
  it('leaves the name and the four counts more than half the row on a 360dp phone', () => {
    const row = 360 - PROFILE_MARGIN * 2;
    assert.ok(row - avatarSize(360) - IDENTITY_GAP > row / 2);
  });

  it('never lets the face grow past its ceiling', () => {
    assert.equal(avatarSize(900), 96);
    assert.equal(avatarSize(300), 72);
  });
});

describe('the library stack, in its own box', () => {
  it('is 94 by 141 on a 360dp phone, and five covers span the box’s inside exactly', () => {
    const row = boxInside(360);
    const stack = stackLayout(STACK_SIZE, row);
    assert.deepEqual(stack.cover, { width: 94, height: 141 });
    assert.equal(stack.inset, 0);
    assert.equal(stack.width, row);
  });

  it('is the size of a collection’s stack elsewhere, within two dp', () => {
    /* A collection's card at the app's margin, 15, less the card's own inset,
       15: the row `<ListTile>` hands its stack. */
    for (const display of PHONES) {
      const here = stackLayout(STACK_SIZE, boxInside(display));
      const elsewhere = stackLayout(STACK_SIZE, display - 15 * 2 - 15 * 2);
      assert.ok(
        Math.abs(here.cover.width - elsewhere.cover.width) <= 2,
        `${display}dp: ${here.cover.width} and ${elsewhere.cover.width}`
      );
    }
  });
});
