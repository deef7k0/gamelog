import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { CompletionLevel, LogStatus } from '../lib/database.types.ts';
import { PROGRESS_CHOICES, progressChoiceFor, progressPatch } from './progress.ts';

type Log = { status: LogStatus; completion: CompletionLevel | null };

/** What a log looks like after the sheet writes a choice's patch over it. */
function apply(log: Log, patch: ReturnType<typeof progressPatch>): Log {
  return {
    status: patch.status,
    completion: 'completion' in patch ? (patch.completion ?? null) : log.completion,
  };
}

describe('progressChoiceFor', () => {
  it('reads the three finished states from the completion level', () => {
    assert.equal(progressChoiceFor({ status: 'played', completion: 'story' }), 'completed');
    assert.equal(progressChoiceFor({ status: 'played', completion: 'main' }), 'completed');
    assert.equal(progressChoiceFor({ status: 'played', completion: 'full' }), 'full');
    assert.equal(progressChoiceFor({ status: 'played', completion: null }), 'played');
  });

  it('reads the other statuses as themselves, whatever the level', () => {
    assert.equal(progressChoiceFor({ status: 'playing', completion: null }), 'playing');
    assert.equal(progressChoiceFor({ status: 'paused', completion: 'story' }), 'paused');
    assert.equal(progressChoiceFor({ status: 'dropped', completion: null }), 'dropped');
    assert.equal(progressChoiceFor({ status: 'backlog', completion: null }), 'backlog');
  });

  it('is null with no log', () => {
    assert.equal(progressChoiceFor(null), null);
  });
});

describe('progressPatch', () => {
  it('writes 100% as a full completion and the matching percentage', () => {
    assert.deepEqual(progressPatch('full', null), {
      status: 'played',
      completion: 'full',
      completion_percent: 100,
    });
  });

  it('keeps "main + extras" when a finished game is marked completed again', () => {
    assert.equal(progressPatch('completed', { completion: 'main' }).completion, 'main');
    assert.equal(progressPatch('completed', { completion: null }).completion, 'story');
  });

  it('never lowers completion for playing, paused, dropped or the backlog', () => {
    for (const choice of ['playing', 'paused', 'dropped', 'backlog'] as const) {
      const patch = progressPatch(choice, { completion: 'full' });
      assert.equal('completion' in patch, false, `${choice} must leave completion alone`);
    }
  });

  it('clears the level for "Played", which claims nothing more', () => {
    assert.equal(progressPatch('played', { completion: 'full' }).completion, null);
  });

  it('round-trips every choice through the columns it writes', () => {
    const start: Log = { status: 'backlog', completion: null };
    for (const { key } of PROGRESS_CHOICES) {
      assert.equal(progressChoiceFor(apply(start, progressPatch(key, start))), key, key);
    }
  });
});
