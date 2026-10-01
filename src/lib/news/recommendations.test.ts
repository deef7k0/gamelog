import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { recommendationSeed, type SeedLog } from './recommendations.ts';

const log = (overrides: Partial<SeedLog> & { game_id: string }): SeedLog => ({
  rating: null,
  review: null,
  updated_at: '2026-01-01T00:00:00Z',
  game: { title: overrides.game_id },
  ...overrides,
});

describe('recommendationSeed', () => {
  it('seeds from the most recently reviewed game, not the best-rated one', () => {
    const seed = recommendationSeed([
      log({ game_id: 'igdb:1', rating: 98, updated_at: '2025-01-01T00:00:00Z' }),
      log({ game_id: 'igdb:2', rating: 70, updated_at: '2026-09-01T00:00:00Z' }),
    ]);
    assert.equal(seed?.gameId, 'igdb:2');
    assert.equal(seed?.heading, 'Similar to igdb:2');
  });

  it('counts writing without a score as a review', () => {
    const seed = recommendationSeed([
      log({ game_id: 'igdb:1', rating: 90, updated_at: '2026-01-01T00:00:00Z' }),
      log({ game_id: 'igdb:2', review: 'Loved the ending.', updated_at: '2026-02-01T00:00:00Z' }),
    ]);
    assert.equal(seed?.gameId, 'igdb:2');
  });

  it('passes over a newer log with neither a score nor writing', () => {
    const seed = recommendationSeed([
      log({ game_id: 'igdb:1', rating: 85, updated_at: '2026-01-01T00:00:00Z' }),
      log({ game_id: 'igdb:2', updated_at: '2026-05-01T00:00:00Z' }),
    ]);
    assert.equal(seed?.gameId, 'igdb:1');
    assert.equal(seed?.heading, 'Similar to igdb:1');
  });

  it('falls back to the latest logged game when nothing is reviewed', () => {
    const seed = recommendationSeed([
      log({ game_id: 'igdb:1', updated_at: '2026-01-01T00:00:00Z' }),
      log({ game_id: 'igdb:2', updated_at: '2026-03-01T00:00:00Z' }),
    ]);
    assert.equal(seed?.gameId, 'igdb:2');
  });

  it('never seeds from a game IGDB cannot find similar games for', () => {
    const seed = recommendationSeed([
      log({ game_id: 'steam:367520', rating: 95, updated_at: '2026-09-01T00:00:00Z' }),
      log({ game_id: 'igdb:7', rating: 60, updated_at: '2026-01-01T00:00:00Z' }),
    ]);
    assert.equal(seed?.gameId, 'igdb:7');
    assert.equal(recommendationSeed([]), null);
  });
});
