import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  ACTIONS,
  AVATAR,
  COUNTS,
  FAVOURITES,
  HEADER_GAP,
  PROFILE_MARGIN,
  actionRowWidth,
  avatarSize,
  favouriteCoverWidth,
} from './profile-layout';

/** The phones this ships to, narrowest to widest. */
const PHONES = [320, 360, 375, 393, 412, 430];

describe('the profile’s margin', () => {
  it('is ten — the owner’s number, and not the app’s fifteen', () => {
    assert.equal(PROFILE_MARGIN, 10);
  });

  it('is not the twenty of the layout the owner went back from', () => {
    assert.notEqual(PROFILE_MARGIN, 20);
  });
});

describe('the head’s rhythm', () => {
  it('is twelve between its parts', () => {
    assert.equal(HEADER_GAP, 12);
  });
});

describe('the four covers of a widget', () => {
  it('span the page from margin to margin, to within a few dp', () => {
    for (const display of PHONES) {
      const used =
        favouriteCoverWidth(display) * FAVOURITES.columns +
        FAVOURITES.gap * (FAVOURITES.columns - 1);
      const row = display - PROFILE_MARGIN * 2;
      assert.ok(used <= row, `${display}dp: ${used} in ${row}`);
      /* Whole dp covers leave at most a dp each over; it goes between them. */
      assert.ok(row - used < FAVOURITES.columns, `${display}dp: ${row - used} left over`);
    }
  });

  it('are 79 wide on a 360dp phone', () => {
    assert.equal(favouriteCoverWidth(360), 79);
  });

  it('are four, eight apart', () => {
    assert.deepEqual(FAVOURITES, { columns: 4, gap: 8 });
  });

  it('are still a recognisable box on the narrowest phone', () => {
    assert.ok(favouriteCoverWidth(320) >= 64);
  });
});

describe('the face', () => {
  it('is the reference’s share of the display, between 72 and 96', () => {
    /* 54px across a 242px phone. */
    assert.equal(avatarSize(360), Math.round((360 * 54) / 242));
    assert.equal(avatarSize(360), Math.round(360 * AVATAR.ratio));
    assert.equal(avatarSize(900), 96);
    assert.equal(avatarSize(300), 72);
  });
});

describe('the centred head', () => {
  /** The reference's pixels, at 360/242 dp each. */
  const dp = (px: number) => (px * 360) / 242;

  it('spaces the three counts as the reference does', () => {
    /* Their centres are 59px apart. */
    assert.ok(Math.abs(COUNTS.column - dp(59)) < 1);
    assert.ok(COUNTS.column * 3 <= 320 - PROFILE_MARGIN * 2, 'fits the narrowest phone');
  });

  it('draws the follow button the reference’s width, and at least the tap floor tall', () => {
    assert.ok(Math.abs(ACTIONS.button - dp(120)) < 1);
    assert.ok(ACTIONS.height >= 44);
    assert.ok(ACTIONS.key >= 44);
  });

  it('fits the row of actions on the narrowest phone', () => {
    assert.ok(actionRowWidth(2) <= 320 - PROFILE_MARGIN * 2, `${actionRowWidth(2)}`);
    assert.equal(actionRowWidth(0), ACTIONS.button);
    assert.equal(actionRowWidth(1), ACTIONS.button + ACTIONS.gap + ACTIONS.key);
  });
});
