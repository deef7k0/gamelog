import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { sharpCoverUrl } from './sharp-cover.ts';

describe('sharpCoverUrl', () => {
  it('asks IGDB for the 1080p rendition of the same image', () => {
    assert.equal(
      sharpCoverUrl('https://images.igdb.com/igdb/image/upload/t_cover_big/co1wyy.jpg'),
      'https://images.igdb.com/igdb/image/upload/t_1080p/co1wyy.jpg'
    );
    assert.equal(
      sharpCoverUrl('https://images.igdb.com/igdb/image/upload/t_thumb/abc123.jpg'),
      'https://images.igdb.com/igdb/image/upload/t_1080p/abc123.jpg'
    );
  });

  it('leaves a Steam capsule, and anything it does not know, as it came', () => {
    const steam =
      'https://shared.steamstatic.com/store_item_assets/steam/apps/730/library_600x900.jpg';
    assert.equal(sharpCoverUrl(steam), steam);
    assert.equal(
      sharpCoverUrl('https://example.com/t_cover_big/x.jpg'),
      'https://example.com/t_cover_big/x.jpg'
    );
  });

  it('answers null for no cover', () => {
    assert.equal(sharpCoverUrl(null), null);
    assert.equal(sharpCoverUrl(undefined), null);
    assert.equal(sharpCoverUrl(''), null);
  });
});
