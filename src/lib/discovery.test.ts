import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

import {
  CHART_PERIODS,
  DEFAULT_CHART_PERIOD,
  PERIOD_WORDS,
  circleLine,
  languageFacets,
  leadReview,
  periodStart,
  popularityLine,
  readingKey,
} from './discovery.ts';

const read = (path: string) => readFileSync(new URL(path, import.meta.url), 'utf8');

const MIGRATION = read('../../supabase/migrations/0038_discovery_ranking.sql');

/** `name` → its parameters, for every function 0038 creates. */
function sqlFunctions(sql: string): Map<string, string[]> {
  const functions = new Map<string, string[]>();
  const pattern = /create or replace function public\.(\w+)\(([^)]*)\)/g;
  for (const match of sql.matchAll(pattern)) {
    const parameters = match[2]
      .split(',')
      .map((parameter) => parameter.trim().split(/\s+/)[0])
      .filter(Boolean);
    functions.set(match[1], parameters);
  }
  return functions;
}

test('a period begins that many days ago, and all time has no beginning', () => {
  const now = Date.UTC(2026, 9, 13, 12, 0, 0);
  assert.equal(periodStart('week', now), '2026-10-06T12:00:00.000Z');
  assert.equal(periodStart('month', now), '2026-09-13T12:00:00.000Z');
  assert.equal(periodStart('year', now), '2025-10-13T12:00:00.000Z');
  /* Null is what the functions read as "no lower bound" — see 0038. */
  assert.equal(periodStart('all', now), null);
});

test('the periods a chart offers, and the one it opens on', () => {
  assert.deepEqual(
    CHART_PERIODS.map((period) => period.value),
    ['week', 'month', 'year', 'all']
  );
  assert.ok(CHART_PERIODS.some((period) => period.value === DEFAULT_CHART_PERIOD));
  for (const { value, label, short } of CHART_PERIODS) {
    assert.ok(label && short, value);
    assert.ok(PERIOD_WORDS[value], `${value} has words for the middle of a sentence`);
  }
});

test('the same languages in another order are the same question', () => {
  assert.equal(readingKey(['es', 'en']), readingKey(['en', 'es']));
  assert.equal(readingKey(['en']), 'en');
  assert.notEqual(readingKey(['en']), readingKey(['en', 'es']));
  /* Every language is not "no languages". */
  assert.equal(readingKey(null), 'all');
  assert.notEqual(readingKey(null), readingKey([]));
});

test('why somebody is in Popular, said as the things it was', () => {
  assert.equal(
    popularityLine({ likes: 12, comments: 3, followers: 2 }),
    '12 likes · 3 replies · 2 new followers'
  );
  assert.equal(
    popularityLine({ likes: 1, comments: 1, followers: 1 }),
    '1 like · 1 reply · 1 new follower'
  );
  /* A zero is not a reason, and is not printed. */
  assert.equal(popularityLine({ likes: 0, comments: 0, followers: 4 }), '4 new followers');
  assert.equal(popularityLine({ likes: 7, comments: 0, followers: 0 }), '7 likes');
  assert.equal(popularityLine({ likes: 1200, comments: 0, followers: 0 }), '1,200 likes');
});

test('why somebody is in Popular with friends: the strongest thing the circle did', () => {
  assert.equal(
    circleLine({ likes: 5, comments: 2, followers: 2 }),
    'Followed by 2 people you follow'
  );
  assert.equal(
    circleLine({ likes: 5, comments: 0, followers: 1 }),
    'Followed by 1 person you follow'
  );
  assert.equal(circleLine({ likes: 3, comments: 1, followers: 0 }), 'Liked by people you follow');
  assert.equal(
    circleLine({ likes: 0, comments: 1, followers: 0 }),
    'In conversation with people you follow'
  );
});

test('the review a game leads with is the best one the reader can read', () => {
  const ranked = [
    { id: 'ja', lang: 'ja' as string | null },
    { id: 'es', lang: 'es' },
    { id: 'none', lang: null },
    { id: 'en', lang: 'en' },
  ];
  const languageOf = (review: (typeof ranked)[number]) => review.lang;

  /* The most liked is in Japanese; an English reader is shown the next one
     they can read — and one with no label is readable by everybody. */
  assert.equal(leadReview(ranked, languageOf, ['en'])?.id, 'none');
  assert.equal(leadReview(ranked, languageOf, ['en', 'es'])?.id, 'es');
  assert.equal(leadReview(ranked, languageOf, ['ja'])?.id, 'ja');
  /* Every language: the most liked, as it was before any of this. */
  assert.equal(leadReview(ranked, languageOf, null)?.id, 'ja');

  /* None they can read is not none at all: the game still has a most liked
     review, and the slot is not left empty. */
  const foreign = [
    { id: 'ja', lang: 'ja' },
    { id: 'ko', lang: 'ko' },
  ];
  assert.equal(leadReview(foreign, (review) => review.lang, ['en'])?.id, 'ja');
  assert.equal(leadReview([], languageOf, ['en']), null);

  /* A row from a database with no such column: `undefined`, and readable. */
  const unlabelled = [{ id: 'old' } as { id: string; lang?: string }];
  assert.equal(leadReview(unlabelled, (review) => review.lang, ['en'])?.id, 'old');
});

test('a game’s reviews can be narrowed to a language only when there are two', () => {
  assert.deepEqual(languageFacets([]), []);
  /* One language is not a choice: the filter could only show the same list. */
  assert.deepEqual(languageFacets(['en', 'en', 'en']), []);
  assert.deepEqual(languageFacets(['en', null, undefined]), []);

  assert.deepEqual(languageFacets(['es', 'en', 'en', null, 'es', 'en', 'ja']), [
    { code: 'en', label: 'English', count: 3 },
    { code: 'es', label: 'Spanish', count: 2 },
    { code: 'ja', label: 'Japanese', count: 1 },
  ]);
  /* A label nothing can be written under is not offered. */
  assert.deepEqual(languageFacets(['en', 'xx', 'zz']), []);
  /* Between equals, by name — so the order does not depend on the rows'. */
  assert.deepEqual(
    languageFacets(['pt', 'es']).map((facet) => facet.code),
    ['pt', 'es']
  );
});

test('0038 creates what the app asks it for, by the names the app uses', () => {
  const functions = sqlFunctions(MIGRATION);
  assert.deepEqual([...functions.keys()].sort(), [
    'circle_of',
    'member_popularity',
    'review_popularity',
  ]);

  /* Every `.rpc('name', { p_x: … })` in the API against that function's
     parameters. A renamed parameter is a 404 at runtime (PGRST202) that the
     app reads as "the database has not run 0038" — and quietly falls back. */
  const api = read('./api/discover.ts');
  const calls = [...api.matchAll(/\.rpc\('(\w+)',\s*\{([^}]*)\}/g)];
  const checked: string[] = [];
  for (const [, name, body] of calls) {
    const parameters = functions.get(name);
    if (!parameters) continue;
    checked.push(name);
    const sent = [...body.matchAll(/\b(p_\w+)\s*:/g)].map((match) => match[1]);
    assert.ok(sent.length > 0, `${name} is called with arguments`);
    for (const argument of sent) {
      assert.ok(parameters.includes(argument), `${name}() has no parameter ${argument}`);
    }
  }
  assert.deepEqual(checked.sort(), ['member_popularity', 'review_popularity']);

  /* And the types say the same. */
  const types = read('./database.types.ts');
  for (const name of functions.keys()) {
    assert.match(types, new RegExp(`\\n\\s+${name}: \\{`), `${name} is declared in the types`);
  }
});

test('0038 leaves 0013 standing, because the app falls back to it', () => {
  /* `getReviewChart` and the People tab call `popular_reviews` and
     `popular_users` on a database without this migration. Dropping either
     here would turn "not migrated yet" into an error on both tabs. */
  assert.doesNotMatch(MIGRATION, /drop function/i);
  assert.doesNotMatch(MIGRATION, /drop table/i);
  const fallback = read('../../supabase/migrations/0013_discovery.sql');
  assert.match(fallback, /function public\.popular_reviews/);
  assert.match(fallback, /function public\.popular_users/);
});

test('unknown is never left out, in SQL as on the phone', () => {
  /* `canRead` shows an unlabelled review to everybody; the two functions must
     make the same promise, or a chart hides what the game's own page shows. */
  assert.match(MIGRATION, /l\.review_lang is null\s+or l\.review_lang = any \(p_langs\)/);
  /* A person is left out only when *every* labelled review is in another
     language: nobody with no labelled review is. */
  assert.match(
    MIGRATION,
    /not exists \(\s*select 1 from public\.logs l\s+where l\.user_id = c\.member\s+and l\.review is not null\s+and l\.review_lang is not null\)/
  );
});
