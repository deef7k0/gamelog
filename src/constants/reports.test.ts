import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  CONTENT_REPORT_REASONS,
  CONTENT_REPORT_REASON_HINT,
  CONTENT_REPORT_REASON_LABEL,
  MAX_REPORT_NOTE,
  isReportKind,
} from './reports.ts';

const MIGRATION = readFileSync(
  new URL('../../supabase/migrations/0031_content_reports.sql', import.meta.url),
  'utf8'
);

describe('content report reasons', () => {
  it('are exactly what both report tables accept', () => {
    const checks = [...MIGRATION.matchAll(/check \(reason in \(([^)]*)\)\)/g)].map((match) =>
      match[1].split(',').map((value) => value.trim().replace(/'/g, ''))
    );

    // One CHECK per table: suggestions and reviews.
    assert.equal(checks.length, 2);
    for (const accepted of checks) {
      assert.deepEqual([...accepted].sort(), [...CONTENT_REPORT_REASONS].sort());
    }
  });

  it('each has a label and a hint', () => {
    for (const reason of CONTENT_REPORT_REASONS) {
      assert.ok(CONTENT_REPORT_REASON_LABEL[reason]);
      assert.ok(CONTENT_REPORT_REASON_HINT[reason]);
    }
  });

  it('cap the note where the tables do', () => {
    const caps = [...MIGRATION.matchAll(/char_length\(note\) <= (\d+)/g)].map((match) =>
      Number(match[1])
    );
    assert.deepEqual(caps, [MAX_REPORT_NOTE, MAX_REPORT_NOTE]);
  });
});

describe('isReportKind', () => {
  it('accepts the three kinds and nothing else', () => {
    assert.ok(isReportKind('pick'));
    assert.ok(isReportKind('suggestion'));
    assert.ok(isReportKind('review'));
    assert.equal(isReportKind('post'), false);
    assert.equal(isReportKind(undefined), false);
  });
});
