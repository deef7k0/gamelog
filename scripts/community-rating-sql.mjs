/**
 * Runs migration 0041 — the weighted community score — on a real Postgres,
 * over every migration before it and over ratings that existed before it ran,
 * and holds what it computes to the TypeScript reference in
 * `src/lib/community-rating.ts` and to a few numbers worked out by hand.
 *
 *     npm install --no-save @electric-sql/pglite
 *     node scripts/community-rating-sql.mjs
 *
 * `npm test` has no database, so it can hold the algorithm but not the SQL.
 * This is the other half: that the triggers fire when a rating changes and
 * only then, that every aggregate is what a full recalculation from the
 * canonical ratings says it is, and that no client can read anybody else's
 * statistics or write any of them.
 *
 * PGlite — Postgres compiled to WebAssembly, in-process — is not a dependency
 * of the app, as for `scripts/discovery-sql.mjs`; the Supabase stub below is
 * that script's, plus the default grants Supabase gives `anon` and
 * `authenticated`, without which a privilege test would prove nothing.
 *
 * What it cannot do: two connections. Concurrent saves are serialised by an
 * advisory lock in 0041, and that is argued in its header, not run here.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMUNITY_RATING, computeCommunityRatings } from '../src/lib/community-rating.ts';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const UNDER_TEST = '0041_community_ratings.sql';

let PGlite;
try {
  ({ PGlite } = await import('@electric-sql/pglite'));
} catch {
  console.error(
    'This needs PGlite, which is not one of the app’s dependencies:\n\n' +
      '    npm install --no-save @electric-sql/pglite\n'
  );
  process.exit(1);
}

/** What Supabase provides that the migrations assume, and the grants it gives clients. */
const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin bypassrls;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now(),
    last_sign_in_at timestamptz
  );
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create function auth.role() returns text language sql stable as
    $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
  create function auth.jwt() returns jsonb language sql stable as $$ select '{}'::jsonb $$;
  create schema if not exists storage;
  create table storage.buckets (id text primary key, name text, public boolean default false,
    file_size_limit bigint, allowed_mime_types text[]);
  create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text,
    name text, owner uuid, created_at timestamptz default now());
  alter table storage.objects enable row level security;
  create function storage.foldername(name text) returns text[] language sql immutable as
    $$ select string_to_array(name, '/') $$;
  create schema if not exists extensions;

  grant usage on schema public, auth to anon, authenticated, service_role;
  grant execute on all functions in schema auth to anon, authenticated, service_role;
  alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
  alter default privileges in schema public grant all on functions to anon, authenticated, service_role;
`;

const db = new PGlite();
await db.exec(SUPABASE);

const files = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort();
assert.ok(files.includes(UNDER_TEST));
for (const file of files.filter((name) => name < UNDER_TEST)) {
  await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
}

// ---------------------------------------------------------------------------
// The people, and the ratings they had given before 0041 existed
// ---------------------------------------------------------------------------

const ids = new Map();
let next = 1;
async function member(name) {
  const id = `00000000-0000-4000-8000-${String(next++).padStart(12, '0')}`;
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${name}@example.test`,
    { username: name.replace(/[^a-z0-9_]/gi, '_').padEnd(3, '_') },
  ]);
  ids.set(name, id);
  return id;
}

const games = new Set();
async function game(id) {
  if (games.has(id)) return;
  games.add(id);
  await db.query(
    "insert into public.games (id, source, source_id, title) values ($1, 'igdb', $2, $3)",
    [id, id.replace('igdb:', ''), `Game ${id}`]
  );
}

async function rate(name, gameId, rating, extra = '') {
  await game(gameId);
  await db.query(
    `insert into public.logs (user_id, game_id, status, rating ${extra ? ', review' : ''})
     values ($1, $2, 'played', $3 ${extra ? ', $4' : ''})`,
    extra ? [ids.get(name), gameId, rating, extra] : [ids.get(name), gameId, rating]
  );
}

const common = Array.from({ length: 30 }, (_, index) => `igdb:${1000 + index}`);

/* Forty-two people whose tastes differ in ordinary ways: 40–89 on everything. */
for (let user = 0; user < 42; user++) {
  await member(`player${user}`);
  for (let index = 0; index < common.length; index++) {
    await rate(`player${user}`, common[index], 40 + ((7 * user + 13 * index) % 50));
  }
}
/* A fan: everything 85–100, all thirty. */
await member('fan');
for (let index = 0; index < 30; index++) await rate('fan', common[index], 85 + (index % 16));
/* Everything a 5, far from everybody: both signals. */
await member('flat');
for (let index = 0; index < 30; index++) await rate('flat', common[index], 5);
/* Spread across the whole scale, and far from everybody. */
await member('contrarian');
for (let index = 0; index < 30; index++) {
  await rate('contrarian', common[index], [0, 25, 50, 75, 100][index % 5]);
}
/* Somebody who has been away for years: twelve spread-out ratings. */
await member('sleeper');
for (let index = 0; index < 12; index++) await rate('sleeper', common[index], 20 + index * 6);
await db.query(`update auth.users set last_sign_in_at = '2015-01-01' where id = $1`, [
  ids.get('sleeper'),
]);
/* Niche games only, each with one other player — and one long review. */
await member('indie');
await member('indie_friend');
for (let index = 0; index < 15; index++) {
  const niche = `igdb:${5000 + index}`;
  await rate(
    'indie',
    niche,
    [3, 97, 50, 12, 88][index % 5],
    index === 0 ? 'Long words. '.repeat(80) : ''
  );
  await rate('indie_friend', niche, 50);
}
/* A log with no score: it is in nobody's average. */
await member('backlogger');
await game('igdb:9999');
await db.query(
  "insert into public.logs (user_id, game_id, status) values ($1, 'igdb:9999', 'backlog')",
  [ids.get('backlogger')]
);
/* A game nobody rated. */
await game('igdb:8888');

const LOG_COLUMNS = 'id, user_id, game_id, status, rating, review, created_at, updated_at';
const beforeLogs = (await db.query(`select ${LOG_COLUMNS} from public.logs order by id`)).rows;

// ---------------------------------------------------------------------------
// 0041 runs, over all of that
// ---------------------------------------------------------------------------

await db.exec(readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8'));

assert.deepEqual(
  (await db.query(`select ${LOG_COLUMNS} from public.logs order by id`)).rows,
  beforeLogs,
  'every log, every rating and every timestamp is exactly as it was'
);

/** Everything 0041 stored, against the reference over the same ratings. */
async function matchesReference(label) {
  const records = (
    await db.query('select user_id, game_id, rating from public.logs where rating is not null')
  ).rows.map((row) => ({ userId: row.user_id, gameId: row.game_id, rating: row.rating }));
  const expected = computeCommunityRatings(records);

  const raters = (await db.query('select * from public.rater_stats')).rows;
  assert.equal(raters.length, expected.raters.size, `${label}: one row per person with a rating`);
  for (const row of raters) {
    const want = expected.raters.get(row.user_id);
    assert.ok(want, `${label}: ${row.user_id} has ratings`);
    const got = {
      ratedCount: row.rated_count,
      distribution: row.distribution,
      entropy: Number(row.entropy),
      normalizedEntropy: Number(row.normalized_entropy),
      comparisons: row.comparison_count,
      averageDeviation: row.average_deviation === null ? null : Number(row.average_deviation),
      deviationPercentile:
        row.deviation_percentile === null ? null : Number(row.deviation_percentile),
      lowEntropy: row.low_entropy,
      highDeviation: row.high_deviation,
      patternConfidence: Number(row.pattern_confidence),
      targetPenalty: Number(row.target_penalty),
      weight: Number(row.weight),
      version: row.algorithm_version,
    };
    const { userId: _userId, ...wanted } = want;
    assert.deepEqual(got, wanted, `${label}: the statistics of ${row.user_id}`);
  }

  const aggregates = (await db.query('select * from public.game_ratings')).rows;
  assert.equal(aggregates.length, expected.games.size, `${label}: one row per rated game`);
  for (const row of aggregates) {
    const want = expected.games.get(row.game_id);
    assert.ok(want, `${label}: ${row.game_id} is rated`);
    for (const [column, field] of [
      ['weighted_rating', 'weightedRating'],
      ['raw_mean', 'rawMean'],
      ['weight_sum', 'weightSum'],
      ['effective_raters', 'effectiveRaters'],
    ]) {
      assert.ok(
        Math.abs(Number(row[column]) - want[field]) < 1e-9,
        `${label}: ${row.game_id}'s ${column} is ${row[column]}, not ${want[field]}`
      );
    }
    assert.equal(row.raters, want.raters);
    assert.equal(row.min_rating, want.minRating);
    assert.equal(row.max_rating, want.maxRating);
    assert.deepEqual(row.histogram, want.histogram);
    assert.equal(row.algorithm_version, COMMUNITY_RATING.version);
  }
  return expected;
}

const weightOf = async (name) =>
  Number(
    (await db.query('select weight from public.rater_stats where user_id = $1', [ids.get(name)]))
      .rows[0]?.weight ?? NaN
  );

const first = await matchesReference('after the migration');
assert.equal(first.games.size, 30 + 15, 'every rated game, and not the unrated or the backlogged');

/* The parts worked out by hand. */
assert.equal(await weightOf('player0'), 1, 'an ordinary rater counts in full');
assert.equal(await weightOf('fan'), 0.85, 'all thirty in one band: the small adjustment');
assert.equal(await weightOf('flat'), 0.7, 'one band and the furthest from everybody: both');
assert.equal(await weightOf('contrarian'), 1, 'far from everybody, but spread out: nothing');
assert.equal(await weightOf('sleeper'), 1, 'away since 2015, and counting in full');
assert.equal(await weightOf('indie'), 1, 'niche games are not compared, so not held against them');
const indie = (
  await db.query('select comparison_count from public.rater_stats where user_id = $1', [
    ids.get('indie'),
  ])
).rows[0];
assert.equal(indie.comparison_count, 0);

const signals = async (name) =>
  (
    await db.query(
      'select low_entropy, high_deviation from public.rater_stats where user_id = $1',
      [ids.get(name)]
    )
  ).rows[0];
assert.deepEqual(
  await signals('contrarian'),
  { low_entropy: false, high_deviation: true },
  'the contrarian is among the most different — and that alone costs nothing'
);
assert.deepEqual(await signals('fan'), { low_entropy: true, high_deviation: false });
assert.deepEqual(await signals('flat'), { low_entropy: true, high_deviation: true });
assert.deepEqual(await signals('player0'), { low_entropy: false, high_deviation: false });
assert.equal(
  (
    await db.query(
      "select count(*)::int as n from public.game_ratings where game_id in ('igdb:9999', 'igdb:8888')"
    )
  ).rows[0].n,
  0,
  'a game with no rating has no score — not a zero'
);

const state = (await db.query('select * from public.community_rating_state')).rows[0];
assert.equal(state.raters, first.raters.size);
assert.equal(state.games, first.games.size);
assert.equal(state.stale_since, null);
assert.ok(
  state.comparable_raters >= COMMUNITY_RATING.deviation.minPopulation,
  'enough people can be compared for the deviation signal to be available at all'
);

// ---------------------------------------------------------------------------
// Re-running changes nothing
// ---------------------------------------------------------------------------

const snapshot = async () => ({
  raters: (await db.query('select * from public.rater_stats order by user_id')).rows,
  games: (await db.query('select * from public.game_ratings order by game_id')).rows,
});
const settled = await snapshot();
await db.exec(readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8'));
assert.deepEqual(
  await snapshot(),
  settled,
  'the migration is safe to re-run: not a value, not a timestamp moves'
);
const idle = (await db.query('select public._recalculate_community_ratings() as result')).rows[0]
  .result;
assert.equal(idle.raters_changed, 0, 'a recalculation with nothing new writes no statistics');
assert.equal(idle.games_changed, 0, 'and no scores');

// ---------------------------------------------------------------------------
// Time passing, logins, dates and reviews move nothing
// ---------------------------------------------------------------------------

await db.query(
  `update public.logs set created_at = '2014-01-01', review = 'Rewritten, at length. '
   where user_id = $1`,
  [ids.get('sleeper')]
);
await db.query(`update auth.users set last_sign_in_at = '1999-01-01'`);
await db.query('select public._recalculate_community_ratings()');
const strip = (rows) => rows.map(({ computed_at: _at, ...row }) => row);
const later = await snapshot();
assert.deepEqual(
  strip(later.raters),
  strip(settled.raters),
  'old dates and old logins: the same weights'
);
assert.deepEqual(strip(later.games), strip(settled.games), 'and the same scores');
assert.deepEqual(later, settled, 'nothing was even rewritten');

// ---------------------------------------------------------------------------
// As the app writes: signed in, through the policies
// ---------------------------------------------------------------------------

/** Run one statement as a signed-in person, as PostgREST would. */
async function as(name, sql, params = []) {
  await db.query(`select set_config('request.jwt.claim.sub', $1, false)`, [ids.get(name) ?? '']);
  await db.exec('set role authenticated');
  try {
    return await db.query(sql, params);
  } finally {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claim.sub', '', false)`);
  }
}
const UPSERT = `insert into public.logs (user_id, game_id, status, rating) values ($1, $2, 'played', $3)
                on conflict (user_id, game_id) do update set rating = excluded.rating, status = excluded.status`;

await member('newcomer');
await game('igdb:7000');
await as('newcomer', UPSERT, [ids.get('newcomer'), 'igdb:7000', 90]);
assert.equal(await weightOf('newcomer'), 1, 'a first rating counts in full');
let score = (await db.query("select * from public.game_ratings where game_id = 'igdb:7000'"))
  .rows[0];
assert.equal(Number(score.weighted_rating), 90);
assert.equal(score.raters, 1);

/* The same request again — a retry, a double tap. */
await as('newcomer', UPSERT, [ids.get('newcomer'), 'igdb:7000', 90]);
assert.equal(
  (await db.query("select count(*)::int as n from public.logs where game_id = 'igdb:7000'")).rows[0]
    .n,
  1,
  'a retried save is one rating, not two'
);
await assert.rejects(
  as(
    'newcomer',
    "insert into public.logs (user_id, game_id, status, rating) values ($1, 'igdb:7000', 'played', 10)",
    [ids.get('newcomer')]
  ),
  /duplicate key|logs_user_id_game_id_key/,
  'a second rating of the same game is refused'
);

await member('second');
await as('second', UPSERT, [ids.get('second'), 'igdb:7000', 40]);
score = (await db.query("select * from public.game_ratings where game_id = 'igdb:7000'")).rows[0];
assert.equal(Number(score.weighted_rating), 65);
assert.equal(score.raters, 2, 'two people, counted once each');

const before = (
  await db.query("select id from public.logs where user_id = $1 and game_id = 'igdb:7000'", [
    ids.get('second'),
  ])
).rows[0].id;
await as('second', UPSERT, [ids.get('second'), 'igdb:7000', 60]);
const edited = (
  await db.query(
    "select id, rating from public.logs where user_id = $1 and game_id = 'igdb:7000'",
    [ids.get('second')]
  )
).rows;
assert.deepEqual(edited, [{ id: before, rating: 60 }], 'an edit changes the one rating, in place');
score = (await db.query("select * from public.game_ratings where game_id = 'igdb:7000'")).rows[0];
assert.equal(Number(score.weighted_rating), 75);
await matchesReference('after a first rating, a retry and an edit');

/* Somebody else's rating cannot be changed, or written in their name. */
const other = await as('second', `update public.logs set rating = 1 where user_id = $1`, [
  ids.get('newcomer'),
]);
assert.equal(other.affectedRows ?? 0, 0, 'an update of another person’s log touches nothing');
assert.equal(
  (
    await db.query("select rating from public.logs where user_id = $1 and game_id = 'igdb:7000'", [
      ids.get('newcomer'),
    ])
  ).rows[0].rating,
  90
);
await assert.rejects(
  as(
    'second',
    "insert into public.logs (user_id, game_id, status, rating) values ($1, 'igdb:8888', 'played', 1)",
    [ids.get('player0')]
  ),
  /row-level security/,
  'nor written in their name'
);

/* Values the scale does not have are refused by the database itself. */
for (const bad of [101, -1]) {
  await assert.rejects(
    as('second', UPSERT, [ids.get('second'), 'igdb:1001', bad]),
    /logs_rating_check/
  );
}

/* A status edit on a scored log changes no rating, and recalculates nothing. */
const quiet = (await db.query('select recalculated_at from public.community_rating_state')).rows[0];
await as(
  'second',
  `update public.logs set status = 'playing', review = 'Changed my mind on the words.' where user_id = $1`,
  [ids.get('second')]
);
assert.deepEqual(
  (await db.query('select recalculated_at from public.community_rating_state')).rows[0],
  quiet,
  'the triggers saw no rating change, and did no work'
);

/* Clearing a score, and deleting the log. */
await as(
  'second',
  `update public.logs set rating = null where user_id = $1 and game_id = 'igdb:7000'`,
  [ids.get('second')]
);
score = (await db.query("select * from public.game_ratings where game_id = 'igdb:7000'")).rows[0];
assert.equal(Number(score.weighted_rating), 90);
assert.equal(score.raters, 1, 'a cleared score is out of the average');
await as('newcomer', `delete from public.logs where user_id = $1 and game_id = 'igdb:7000'`, [
  ids.get('newcomer'),
]);
assert.equal(
  (await db.query("select count(*)::int as n from public.game_ratings where game_id = 'igdb:7000'"))
    .rows[0].n,
  0,
  'and with the last rating gone, the game has no score'
);
assert.equal(Number.isNaN(await weightOf('newcomer')), true, 'nor its rater any statistics');
await matchesReference('after clearing and deleting');

// ---------------------------------------------------------------------------
// Nothing derived is a client's to read beyond its own, or to write at all
// ---------------------------------------------------------------------------

await assert.rejects(
  as(
    'fan',
    `insert into public.rater_stats (user_id, rated_count, distribution, entropy, normalized_entropy,
              comparison_count, low_entropy, high_deviation, pattern_confidence, target_penalty, weight,
              algorithm_version) values ($1, 1, '{1}', 0, 0, 0, false, false, 0, 0, 1, 1)
              on conflict (user_id) do update set weight = 1`,
    [ids.get('fan')]
  ),
  /permission denied/,
  'nobody can give themselves a weight'
);
await assert.rejects(
  as('fan', `update public.game_ratings set weighted_rating = 100`),
  /permission denied/
);
await assert.rejects(as('fan', `delete from public.rater_stats`), /permission denied/);
await assert.rejects(as('fan', `select weight_sum from public.game_ratings`), /permission denied/);
await assert.rejects(
  as('fan', `select public._recalculate_community_ratings()`),
  /permission denied/
);
await assert.rejects(as('fan', `select public._refresh_game_ratings(null)`), /permission denied/);
await assert.rejects(as('fan', `select public.recalculate_community_ratings()`), /Only moderators/);
await assert.rejects(as('fan', `select public.community_rating_report()`), /Only moderators/);

const seen = (await as('fan', 'select user_id, weight from public.rater_stats')).rows;
assert.equal(seen.length, 1, 'a person sees their own statistics and nobody else’s');
assert.equal(seen[0].user_id, ids.get('fan'));
assert.equal(Number(seen[0].weight), 0.85);
const mine = (await as('fan', 'select public.my_rating_influence() as answer')).rows[0].answer;
assert.equal(mine.rated, 30);
assert.equal(Number(mine.stats.weight), 0.85);
assert.equal(mine.stats.user_id, undefined);
assert.deepEqual(mine.params, COMMUNITY_RATING);
const scores = (await as('fan', 'select game_id, weighted_rating, raters from public.game_ratings'))
  .rows;
assert.ok(scores.length > 0, 'the scores themselves are public');

await db.query('insert into public.moderators (user_id) values ($1)', [ids.get('player1')]);
const report = (await as('player1', 'select public.community_rating_report(3) as report')).rows[0]
  .report;
assert.equal(
  report.raters.total,
  (await db.query('select count(*)::int as n from public.rater_stats')).rows[0].n
);
assert.equal(report.raters.both, 1, 'one person carries both signals');
assert.equal(report.largest.length, 3);
assert.ok(!JSON.stringify(report).includes(ids.get('flat')), 'the report names no person');
const recalculated = (
  await as('player1', 'select public.recalculate_community_ratings() as result')
).rows[0].result;
assert.equal(recalculated.raters_changed, 0);

// ---------------------------------------------------------------------------
// The two older functions, weighted
// ---------------------------------------------------------------------------

const target = common[3];
const stats = (await db.query('select public.game_review_stats($1) as stats', [target])).rows[0]
  .stats;
const stored = (
  await db.query('select weighted_rating from public.game_ratings where game_id = $1', [target])
).rows[0];
assert.ok(
  Math.abs(stats.weighted_mean - Number(stored.weighted_rating)) < 1e-9,
  'the sheet’s headline is the score'
);
assert.equal(stats.count, 46, 'forty-two players, the fan, flat, the contrarian and the sleeper');
for (const tally of Object.values(stats.groups)) {
  assert.ok(!('weight' in tally), 'no group carries a weight sum');
}

await db.query(
  "update public.logs set played_on = case when user_id = $1 then 'PS4' else 'PS5' end where game_id = $2",
  [ids.get('flat'), target]
);
const platforms = (await db.query('select public.game_review_stats($1) as stats', [target])).rows[0]
  .stats.platforms;
const shares = platforms.reduce((sum, entry) => sum + entry.weight_share, 0);
assert.ok(Math.abs(shares - 1) < 1e-12, 'the platforms’ shares of the weight add up to all of it');
const folded =
  platforms.reduce((sum, entry) => sum + entry.weight_share * entry.weighted_mean, 0) / shares;
assert.ok(Math.abs(folded - stats.weighted_mean) < 1e-9, 'PS4 + PS5 fold into PlayStation exactly');

const beloved = (
  await db.query("select * from public.beloved_games(now() - interval '1 year', 50)")
).rows;
const expectedNow = await matchesReference('before the charts');
for (const row of beloved) {
  const want = expectedNow.games.get(row.game_id);
  assert.ok(
    Math.abs(Number(row.average) - want.weightedRating) < 1e-9,
    `${row.game_id} in Beloved is its score`
  );
}

// ---------------------------------------------------------------------------
// When the app is big: changed games now, weights on a schedule
// ---------------------------------------------------------------------------

const params = readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8');
const small = /create or replace function public\.community_rating_params\(\)[\s\S]*?\$\$;/
  .exec(params)[0]
  .replace('"syncFullRecalculationMaxRatings": 5000', '"syncFullRecalculationMaxRatings": 5');
await db.exec(small);
const fanBefore = await weightOf('fan');
await db.query(`update public.logs set rating = 20 where user_id = $1 and game_id = $2`, [
  ids.get('fan'),
  common[0],
]);
const big = (await db.query('select stale_since from public.community_rating_state')).rows[0];
assert.ok(big.stale_since, 'above the limit, the weights are marked as lagging');
assert.equal(await weightOf('fan'), fanBefore, 'and are not recalculated in the save');
const records = (
  await db.query('select user_id, game_id, rating from public.logs where rating is not null')
).rows;
const weights = new Map(
  (await db.query('select user_id, weight from public.rater_stats')).rows.map((row) => [
    row.user_id,
    Number(row.weight),
  ])
);
const changed = records.filter((row) => row.game_id === common[0]);
const expectedChanged =
  changed.reduce((sum, row) => sum + row.rating * (weights.get(row.user_id) ?? 1), 0) /
  changed.reduce((sum, row) => sum + (weights.get(row.user_id) ?? 1), 0);
const refreshed = (
  await db.query('select weighted_rating from public.game_ratings where game_id = $1', [common[0]])
).rows[0];
assert.ok(
  Math.abs(Number(refreshed.weighted_rating) - expectedChanged) < 1e-9,
  'but the changed game is refreshed at once'
);
/* Weights left stale for longer than the patience: the next save catches them up. */
await db.query(
  `update public.community_rating_state set stale_since = now() - interval '16 minutes'`
);
await db.query(`update public.logs set rating = 21 where user_id = $1 and game_id = $2`, [
  ids.get('fan'),
  common[0],
]);
assert.equal(
  (await db.query('select stale_since from public.community_rating_state')).rows[0].stale_since,
  null,
  'a save after fifteen stale minutes recalculates the weights'
);
await matchesReference('after the catch-up');
await db.query(`update public.logs set rating = 22 where user_id = $1 and game_id = $2`, [
  ids.get('fan'),
  common[0],
]);
await db.query('select public._recalculate_community_ratings()');
assert.equal(
  (await db.query('select stale_since from public.community_rating_state')).rows[0].stale_since,
  null
);
await db.exec(readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8'));
await matchesReference('after the scheduled recalculation');

// ---------------------------------------------------------------------------
// An account deleted, by cascade
// ---------------------------------------------------------------------------

await db.query('delete from auth.users where id = $1', [ids.get('flat')]);
assert.equal(Number.isNaN(await weightOf('flat')), true);
await matchesReference('after an account is deleted');

const timing = (await db.query('select rated_logs, duration_ms from public.community_rating_state'))
  .rows[0];
await db.close();
console.log(
  `0041 on ${files.length} migrations: every weight and every score matched the reference, ` +
    `and every policy held. (A full recalculation over ${timing.rated_logs} ratings took ` +
    `${timing.duration_ms} ms in PGlite.)`
);
