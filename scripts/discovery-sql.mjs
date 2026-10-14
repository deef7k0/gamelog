/**
 * Runs migration 0038's functions on a real Postgres, against the project's
 * real schema, with seven people who do known things — and compares what the
 * functions answer with what was worked out by hand.
 *
 *     node scripts/discovery-sql.mjs
 *
 * `npm test` cannot do this: it has no database. The SQL behind Search's
 * Reviews and People charts was otherwise only ever going to be checked by
 * running it on the live project and looking — which says whether it runs, not
 * whether "one review a member, first" does what the comment says.
 *
 * ## What it needs
 *
 * PGlite — Postgres compiled to WebAssembly, in-process, no server and no
 * Docker. It is **not** a dependency of the app and is not in package.json: it
 * is a tool for this script, the way `rsvg-convert` is for
 * `scripts/score-figures.mjs`. Get it without recording it:
 *
 *     npm install --no-save @electric-sql/pglite
 *
 * ## How the schema gets there
 *
 * Every file in `supabase/migrations/` is loaded in order, behind a stub of
 * the three things Supabase provides and plain Postgres does not: the `auth`
 * schema (`auth.users`, `auth.uid()`), the `storage` schema, and the roles the
 * policies name. Every one loads as written. `SKIP=0036` leaves a file
 * out, to stand where the live project stands.
 *
 * ## Reading a failure
 *
 * Each assertion's message is the rule it checks. The fixtures are small
 * enough to redo by hand — who liked what, how many days ago — and that is the
 * point: if an expectation here and the function disagree, one of them is
 * wrong about what the feature is, and it should be argued out, not updated.
 */
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MIGRATIONS = join(dirname(fileURLToPath(import.meta.url)), '..', 'supabase', 'migrations');
const UNDER_TEST = '0038_discovery_ranking.sql';

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

/** What Supabase provides that the migrations assume. */
const SUPABASE = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema if not exists auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text,
    raw_user_meta_data jsonb default '{}'::jsonb,
    created_at timestamptz default now()
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
`;

const skipped = new Set((process.env.SKIP ?? '').split(',').filter(Boolean));
const db = new PGlite();
await db.exec(SUPABASE);

const files = readdirSync(MIGRATIONS)
  .filter((file) => file.endsWith('.sql'))
  .sort();
for (const file of files) {
  if (skipped.has(file.slice(0, 4))) {
    console.log(`skipped ${file}`);
    continue;
  }
  await db.exec(readFileSync(join(MIGRATIONS, file), 'utf8'));
}
/* "Safe to re-run", as its header says. */
await db.exec(readFileSync(join(MIGRATIONS, UNDER_TEST), 'utf8'));

// ---------------------------------------------------------------------------
// Seven people
// ---------------------------------------------------------------------------

const uid = (n) => `00000000-0000-4000-8000-00000000000${n}`;
const P = { ana: uid(1), ben: uid(2), cho: uid(3), dev: uid(4), eli: uid(5), fay: uid(6), gus: uid(7) };
const ago = (days) => `now() - interval '${days} days'`;

for (const [name, id] of Object.entries(P)) {
  await db.query('insert into auth.users (id, email, raw_user_meta_data) values ($1, $2, $3)', [
    id,
    `${name}@example.test`,
    { username: name },
  ]);
}
const profiles = await db.query('select id from public.profiles');
assert.equal(profiles.rows.length, 7, 'the sign-up trigger (0001) made a profile for each');

for (const game of ['g1', 'g2', 'g3', 'g4', 'g5']) {
  await db.query("insert into public.games (id, source, source_id, title) values ($1, 'igdb', $2, $3)", [
    `igdb:${game}`,
    game,
    game.toUpperCase(),
  ]);
}

/*
 * The reviews. `created_at` can be set on insert: 0001's trigger touches
 * `updated_at`, on UPDATE only.
 *
 *   ben  b1  20 days ago  en      b2   3 days ago  en      b3  200 days ago  en
 *   cho  c1   2 days ago  es
 *   dev  d1  400 days ago (no label — written before labels existed)
 *   eli  e1   5 days ago  ja
 *   ana  a1   1 day  ago  en      ana is the reader in every "with friends" case
 */
const R = {};
async function review(key, who, game, days, language) {
  const result = await db.query(
    `insert into public.logs (user_id, game_id, status, rating, review, review_lang, created_at)
     values ($1, $2, 'played', 80, 'words about a game', $3, ${ago(days)}) returning id`,
    [P[who], `igdb:${game}`, language]
  );
  R[key] = result.rows[0].id;
}
await review('b1', 'ben', 'g1', 20, 'en');
await review('b2', 'ben', 'g2', 3, 'en');
await review('b3', 'ben', 'g3', 200, 'en');
await review('c1', 'cho', 'g1', 2, 'es');
await review('d1', 'dev', 'g2', 400, null);
await review('e1', 'eli', 'g4', 5, 'ja');
await review('a1', 'ana', 'g5', 1, 'en');

/* Not reviews: a score with no words, and words that are only spaces. */
await db.query("insert into public.logs (user_id, game_id, status, rating) values ($1, 'igdb:g1', 'played', 90)", [
  P.fay,
]);
await db.query(
  "insert into public.logs (user_id, game_id, status, rating, review) values ($1, 'igdb:g2', 'played', 90, '   ')",
  [P.fay]
);
/* A review a moderator removed (0031): the words are gone, its label is not. */
await db.query(
  "insert into public.logs (user_id, game_id, status, rating, review, review_lang) values ($1, 'igdb:g3', 'played', 70, null, 'ja')",
  [P.gus]
);

const like = (who, key, days) =>
  db.query(
    `insert into public.likes (user_id, target_type, target_id, created_at) values ($1, 'log', $2, ${ago(days)})`,
    [P[who], R[key]]
  );
await like('ana', 'b1', 2);
await like('cho', 'b1', 10);
await like('dev', 'b1', 40);
await like('ben', 'b1', 1); // his own review
await like('cho', 'b2', 1);
await like('eli', 'b3', 300);
await like('ana', 'd1', 3); // an old review, liked this week
await like('ben', 'e1', 1);
await like('cho', 'e1', 1);

const comment = (who, key, days) =>
  db.query(
    `insert into public.comments (user_id, target_type, target_id, body, created_at) values ($1, 'log', $2, 'said', ${ago(days)})`,
    [P[who], R[key]]
  );
for (let reply = 0; reply < 5; reply += 1) await comment('cho', 'b1', 3); // one person, five times
await comment('ben', 'b1', 2); // his own thread
await comment('ben', 'b1', 2);
await comment('dev', 'c1', 1);

const follow = (from, to, days) =>
  db.query(
    `insert into public.follows (follower_id, following_id, created_at) values ($1, $2, ${ago(days)})`,
    [P[from], P[to]]
  );
await follow('ana', 'ben', 100);
await follow('ben', 'eli', 2);
await follow('cho', 'eli', 2);
await follow('cho', 'dev', 50);
await follow('ben', 'gus', 2);
await follow('dev', 'ana', 4);
await follow('eli', 'ana', 4);

/* ana and cho are friends (0005: stored ordered, accepted); ana and fay are not yet. */
const pair = (one, two) => [P[one], P[two]].sort();
await db.query(
  "insert into public.friendships (user_a, user_b, requested_by, status) values ($1, $2, $1, 'accepted')",
  pair('ana', 'cho')
);
await db.query(
  "insert into public.friendships (user_a, user_b, requested_by, status) values ($1, $2, $1, 'pending')",
  pair('ana', 'fay')
);

// ---------------------------------------------------------------------------
// What the functions say
// ---------------------------------------------------------------------------

const nameOf = Object.fromEntries(Object.entries(P).map(([name, id]) => [id, name]));
const keyOf = Object.fromEntries(Object.entries(R).map(([key, id]) => [id, key]));
const WEEK = "now() - interval '7 days'";
const EVER = 'null';

async function reviews(since, languages, limit = 20) {
  const result = await db.query(`select * from public.review_popularity(${since}, $1, $2)`, [
    languages,
    limit,
  ]);
  return result.rows.map((row) => `${keyOf[row.log_id]}:${row.activity}`);
}

async function members(since, viewer, circle, languages, limit = 20) {
  const result = await db.query(
    `select * from public.member_popularity(${since}, $1, $2, $3, $4)`,
    [viewer, circle, languages, limit]
  );
  return result.rows.map(
    (row) => `${nameOf[row.user_id]}:${row.activity}(${row.likes}l ${row.comments}c ${row.followers}f)`
  );
}

const circle = await db.query('select user_id from public.circle_of($1)', [P.ana]);
assert.deepEqual(
  circle.rows.map((row) => nameOf[row.user_id]).sort(),
  ['ben', 'cho'],
  'a circle is who you follow and your accepted friends — not a pending request'
);

// --- reviews ---------------------------------------------------------------

assert.deepEqual(
  await reviews(WEEK, null),
  ['e1:2', 'b1:2', 'c1:1', 'd1:1', 'a1:0', 'b2:1'],
  'this week: every author’s best first (newest of a tie), then ben’s second; ' +
    'an old review liked this week is in, one nobody touched is not'
);
assert.deepEqual(
  await reviews(WEEK, ['en']),
  ['b1:2', 'd1:1', 'a1:0', 'b2:1'],
  'for an English reader: the Spanish and the Japanese are out, the unlabelled one stays'
);
assert.deepEqual(
  await reviews(EVER, null),
  ['b1:4', 'e1:2', 'c1:1', 'd1:1', 'a1:0', 'b2:1', 'b3:1'],
  'ever: every review; his own like and his own replies count for nothing, ' +
    'and five replies from one person are one person'
);
assert.deepEqual(await reviews(EVER, null, 2), ['b1:4', 'e1:2'], 'the limit comes after the order');

// --- people ----------------------------------------------------------------

const week = await members(WEEK, P.ana, false, null);
assert.deepEqual(
  week.slice(0, 3),
  ['eli:4(2l 0c 2f)', 'ben:3(2l 1c 0f)', 'gus:1(0l 0c 1f)'],
  'this week: eli by likes and followers, ben by likes and one commenter, ' +
    'then gus — of those with one, the one somebody followed'
);
assert.deepEqual(
  week.slice(3).map((entry) => entry.split(':')[0]).sort(),
  ['cho', 'dev'],
  'then the other two with one each'
);
assert.ok(!week.some((entry) => entry.startsWith('ana')), 'nobody is in their own chart');

const everyone = await members(EVER, null, false, null);
assert.equal(everyone[0], 'ben:7(5l 1c 1f)', 'ever, with no reader: ben, by five likes');
assert.ok(everyone.includes('ana:2(0l 0c 2f)'), 'and with no reader, ana is somebody too');

assert.deepEqual(
  await members(EVER, P.ana, true, null),
  ['eli:4(2l 0c 2f)', 'dev:1(0l 0c 1f)', 'gus:1(0l 0c 1f)'],
  'with friends: who ben and cho follow and like, that ana does not follow — and not ben or cho'
);
assert.deepEqual(
  await members(WEEK, P.ana, true, null),
  ['eli:4(2l 0c 2f)', 'gus:1(0l 0c 1f)'],
  'with friends, this week: cho followed dev fifty days ago'
);
assert.deepEqual(
  await members(EVER, P.ana, true, ['en']),
  ['dev:1(0l 0c 1f)', 'gus:1(0l 0c 1f)'],
  'for an English reader: eli writes only in Japanese; dev’s review has no label; ' +
    'gus’s label is on a review that is no longer there'
);
assert.deepEqual(
  await members(EVER, null, true, null),
  [],
  'a circle needs somebody to be the circle of'
);

// --- the column ------------------------------------------------------------

const refuses = (value) =>
  assert.rejects(
    db.query('update public.logs set review_lang = $1 where id = $2', [value, R.a1]),
    /logs_review_lang_check/,
    `${value} is not the shape of a code`
  );
await refuses('English');
await refuses('EN');
await refuses('e');
await db.query("update public.logs set review_lang = 'fil' where id = $1", [R.a1]);
await db.query('update public.logs set review_lang = null where id = $1', [R.a1]);

// --- nothing at all --------------------------------------------------------

await db.exec(
  'delete from public.likes; delete from public.comments; delete from public.follows; delete from public.logs;'
);
assert.deepEqual(await reviews(WEEK, null), [], 'an empty app is an empty chart, not an error');
assert.deepEqual(await members(EVER, P.ana, false, null), []);

await db.close();
console.log(
  `0038 on ${files.length - skipped.size} migrations: every answer matched what was worked out by hand.`
);
