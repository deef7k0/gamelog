import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { inList } from './postgrest.ts';

describe('inList', () => {
  it('quotes every value', () => {
    assert.equal(inList(['PS4', 'PS5']), '("PS4","PS5")');
  });

  it('keeps reserved characters inside the quotes', () => {
    assert.equal(inList(['Wii U, (EU)', 'N.E.S.: Classic']), '("Wii U, (EU)","N.E.S.: Classic")');
  });

  it('escapes a double quote and a backslash', () => {
    assert.equal(inList([`Grandad's "Amiga"`]), `("Grandad's \\"Amiga\\"")`);
    assert.equal(inList(['C:\\Games']), '("C:\\\\Games")');
  });

  it('writes an empty list as empty brackets', () => {
    assert.equal(inList([]), '()');
  });
});
