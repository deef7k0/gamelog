import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { pickTrailer, trailerUrl } from './trailer.ts';

describe('which video is the trailer', () => {
  it('passes over a developer diary to a trailer, as on The Witcher 3', () => {
    const picked = pickTrailer([
      { video_id: 'yowv6_rspoM', name: 'Developer Diary: Creating the Sound' },
      { video_id: 'xQGam9OHSUo', name: 'TV Spot' },
      { video_id: '5nLipy-Z4yo', name: 'The Begining trailer' },
      { video_id: '8ZLfJjlZKvc', name: 'A Night to Remember Trailer' },
    ]);
    assert.equal(picked?.videoId, '5nLipy-Z4yo');
  });

  it('prefers a launch or official trailer', () => {
    const picked = pickTrailer([
      { video_id: 'aaaaaaaaaaa', name: 'Story Trailer' },
      { video_id: 'bbbbbbbbbbb', name: 'Official Launch Trailer' },
    ]);
    assert.equal(picked?.videoId, 'bbbbbbbbbbb');
  });

  it('falls back to the first video that is not a diary or a review', () => {
    const picked = pickTrailer([
      { video_id: 'aaaaaaaaaaa', name: 'Review' },
      { video_id: 'bbbbbbbbbbb', name: 'TV Spot' },
    ]);
    assert.equal(picked?.videoId, 'bbbbbbbbbbb');
  });

  it('has none for a game with no usable video', () => {
    assert.equal(pickTrailer(undefined), null);
    assert.equal(pickTrailer([{ video_id: 'not-an-id', name: 'Trailer' }]), null);
  });

  it('links to YouTube', () => {
    assert.equal(
      trailerUrl({ videoId: '5nLipy-Z4yo', name: 'x' }),
      'https://www.youtube.com/watch?v=5nLipy-Z4yo'
    );
  });
});
