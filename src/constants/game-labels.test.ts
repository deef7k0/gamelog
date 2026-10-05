import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import { GAME_LABELS, GAME_LABEL_TEXT, isGameLabel } from './game-labels.ts';

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/0034_game_labels.sql', import.meta.url),
  'utf8'
);

describe('game labels', () => {
  it('are exactly what the table accepts', () => {
    const check = MIGRATION.match(/check \(label in \(([^)]*)\)\)/);
    assert.ok(check, '0034 has a CHECK on label');
    const accepted = check[1].split(',').map((value) => value.trim().replace(/'/g, ''));
    assert.deepEqual(accepted.sort(), [...GAME_LABELS].sort());
  });

  it('each has its words', () => {
    for (const label of GAME_LABELS) {
      assert.ok(GAME_LABEL_TEXT[label].title);
      assert.ok(GAME_LABEL_TEXT[label].description);
      assert.ok(GAME_LABEL_TEXT[label].spoken);
    }
  });
});

describe('isGameLabel', () => {
  it('accepts the vocabulary and nothing else', () => {
    assert.ok(isGameLabel('must_play'));
    assert.equal(isGameLabel('Must Play'), false);
    assert.equal(isGameLabel(undefined), false);
  });
});
