import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';

import {
  COMPANY_OPTIONS,
  EMPTY_ANSWERS,
  INTRO_LINES,
  PLATFORM_OPTIONS,
  afterPicks,
  TYPE_MS,
  handleProblem,
  hasFallbackUsername,
  interleave,
  lettersShown,
  normaliseHandle,
  onboardingSteps,
  picksClause,
  typingDuration,
} from './onboarding.ts';

describe('who still has to be onboarded', () => {
  /*
   * The name is the database's, not ours: `handle_new_user()` in 0001. Read it
   * from the migration so the two cannot drift — if the trigger's fallback
   * ever changes, every new account would skip onboarding without this.
   */
  it('recognises the name 0001 gives an account that signed up without one', () => {
    const sql = readFileSync(
      new URL('../../supabase/migrations/0001_init.sql', import.meta.url),
      'utf8'
    );
    assert.match(
      sql,
      /fallback text := 'user_' \|\| substr\(replace\(new\.id::text, '-', ''\), 1, 12\)/
    );
    const id = '3f2a9c1e-77b0-4d1a-9e2f-0c4b5a6d7e8f';
    assert.equal(hasFallbackUsername(`user_${id.replace(/-/g, '').slice(0, 12)}`), true);
  });

  it('leaves a chosen name alone, including one that merely starts the same way', () => {
    for (const name of [
      'ana',
      'user_ana',
      'user_3f2a9c1e77b',
      'User_3f2a9c1e77b0',
      null,
      undefined,
    ]) {
      assert.equal(hasFallbackUsername(name), false, String(name));
    }
  });
});

describe('a handle', () => {
  it('drops the @ and any spaces', () => {
    assert.equal(normaliseHandle('@@ana banana'), 'anabanana');
  });

  it('follows the CHECK on profiles.username', () => {
    assert.equal(handleProblem(''), null, 'nothing typed is not an error yet');
    assert.equal(handleProblem('ana_92'), null);
    assert.ok(handleProblem('an'));
    assert.ok(handleProblem('ana-92'));
    assert.ok(handleProblem('a'.repeat(25)));
    assert.equal(handleProblem('a'.repeat(24)), null);
  });

  it('cannot be the fallback, which would mean not onboarded forever', () => {
    assert.ok(handleProblem('user_3f2a9c1e77b0'));
  });
});

describe('the typing', () => {
  it('types a letter at a time, from the first frame', () => {
    const text = 'hello gorgeous.';
    assert.equal(lettersShown(text, 0), 1);
    assert.equal(lettersShown(text, TYPE_MS - 1), 1);
    assert.equal(lettersShown(text, TYPE_MS), 2);
    assert.equal(lettersShown(text, TYPE_MS * 5), 6);
  });

  it('keeps an even pace: no pause at punctuation or between words', () => {
    const text = 'nice thumbs. been gaming?';
    for (let letters = 1; letters <= text.length; letters += 1) {
      assert.equal(lettersShown(text, (letters - 1) * TYPE_MS), letters);
    }
  });

  it('catches up after a late frame instead of falling behind', () => {
    const text = 'hello gorgeous.';
    assert.equal(lettersShown(text, TYPE_MS * 4 + 3), 5);
  });

  it('stops at the end of the line', () => {
    const text = 'hi.';
    assert.equal(lettersShown(text, 10_000), 3);
    assert.equal(lettersShown(text, typingDuration(text)), 3);
  });

  it('is fast: the longest intro line is typed in under two seconds', () => {
    for (const line of INTRO_LINES) {
      assert.ok(typingDuration(line) < 2000, `${line}: ${typingDuration(line)}ms`);
    }
  });
});

describe('the steps', () => {
  it('shows every step where everything is available', () => {
    assert.equal(onboardingSteps({ notifications: true, steam: true }).length, 12);
  });

  it('leaves out a page that could only fail', () => {
    const steps = onboardingSteps({ notifications: false, steam: false });
    assert.ok(!steps.includes('notify'));
    assert.ok(!steps.includes('steam'));
    assert.equal(steps[0], 'name');
    assert.equal(steps.at(-1), 'picks');
  });

  it('claims the handle before the last page, so finishing needs one', () => {
    const steps = onboardingSteps({ notifications: true, steam: true });
    assert.equal(steps.indexOf('handle'), steps.length - 2);
  });
});

describe('the games at the end', () => {
  it('asks only for real games with a box when nothing was answered', () => {
    const clause = picksClause(EMPTY_ANSWERS, []);
    assert.match(clause, /version_parent = null/);
    assert.match(clause, /cover != null/);
    assert.doesNotMatch(clause, /platforms|genres|game_modes|id/);
  });

  it('widens as more is ticked: every filter is "any of"', () => {
    const clause = picksClause(
      { hereFor: null, platforms: ['ps5', 'phone'], genres: [12, 31], company: 'friends' },
      [1942, 72]
    );
    assert.match(clause, /platforms = \(167,39,34\)/);
    assert.match(clause, /genres = \(12,31\)/);
    assert.match(clause, /game_modes = \(2,3,4,5\)/);
    assert.match(clause, /id != \(1942,72\)/);
    assert.doesNotMatch(clause, /\{/, 'braces would mean "all of"');
  });

  it('asks nothing about company for "both"', () => {
    assert.doesNotMatch(picksClause({ ...EMPTY_ANSWERS, company: 'both' }, []), /game_modes/);
    assert.deepEqual(COMPANY_OPTIONS.find((option) => option.key === 'both')?.modes, []);
  });

  it("can be narrowed to the favourites' similar games", () => {
    assert.match(picksClause(EMPTY_ANSWERS, [], [5, 6]), /id = \(5,6\)/);
  });

  it('names each platform once', () => {
    const ids = PLATFORM_OPTIONS.flatMap((option) => option.ids);
    assert.equal(new Set(ids).size, ids.length);
  });

  it('takes each favourite in turn and skips what is already chosen', () => {
    assert.deepEqual(
      interleave(
        [
          [1, 2, 3],
          [4, 1, 5],
          [6, 7],
        ],
        new Set([7]),
        5
      ),
      [1, 4, 6, 2, 3]
    );
  });

  it('sends a reviewer to write and an explorer to Search', () => {
    assert.equal(afterPicks('reviewing'), 'review');
    assert.equal(afterPicks('discovering'), 'search');
    assert.equal(afterPicks('logging'), 'home');
    assert.equal(afterPicks(null), 'home');
  });
});
