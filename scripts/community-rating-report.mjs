/**
 * A dry run of the weighted community score over the live project's ratings:
 * what 0041 would do to them, before anybody runs it.
 *
 *     node scripts/community-rating-report.mjs [--out report.md]
 *
 * Reads, never writes. It asks the project's REST API for every rated log —
 * `(user_id, game_id, rating)`, which is public by design (0001) — with the
 * anon key from `.env`, runs `src/lib/community-rating.ts` over them, and
 * prints how the weighted scores compare with today's plain means: the
 * weights, who is adjusted and why, the games that move most, whether the
 * order of the best-rated games changes, whether thinly rated games move more,
 * and how much the answer depends on each parameter.
 *
 * Nobody is named. Raters are "Rater A", "Rater B"… by how many games they
 * rated; no user id or handle is printed. Game titles are the catalogue's.
 *
 * What it cannot say: whether the weighted score is *more accurate*. There is
 * no observable true score for a game — not the critics', not IGDB's — so
 * this measures consistency, sensitivity and what changes, not correctness.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { COMMUNITY_RATING, computeCommunityRatings } from '../src/lib/community-rating.ts';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

function env() {
  const values = {};
  for (const line of readFileSync(join(ROOT, '.env'), 'utf8').split('\n')) {
    const match = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
    if (match) values[match[1]] = match[2].replace(/^['"]|['"]$/g, '');
  }
  return values;
}

const { EXPO_PUBLIC_SUPABASE_URL: url, EXPO_PUBLIC_SUPABASE_ANON_KEY: key } = env();
if (!url || !key) {
  console.error('Needs EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env.');
  process.exit(1);
}

/** Every row of a select, a thousand at a time. */
async function all(path) {
  const rows = [];
  for (let from = 0; ; from += 1000) {
    const response = await fetch(`${url}/rest/v1/${path}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}`, Range: `${from}-${from + 999}` },
    });
    if (!response.ok) throw new Error(`${path}: ${response.status} ${await response.text()}`);
    const page = await response.json();
    rows.push(...page);
    if (page.length < 1000) return rows;
  }
}

const logs = await all(
  'logs?select=user_id,game_id,rating&rating=not.is.null&order=user_id,game_id'
);
const records = logs.map((row) => ({
  userId: row.user_id,
  gameId: row.game_id,
  rating: row.rating,
}));
const gameIds = [...new Set(records.map((record) => record.gameId))];
const games = new Map();
for (let index = 0; index < gameIds.length; index += 100) {
  const ids = gameIds
    .slice(index, index + 100)
    .map((id) => `"${id}"`)
    .join(',');
  for (const game of await all(`games?select=id,title,genres&id=in.(${ids})`))
    games.set(game.id, game);
}

// ---------------------------------------------------------------------------

const lines = [];
const say = (text = '') => lines.push(text);
const fixed = (value, digits = 2) =>
  value === null || value === undefined ? '—' : Number(value).toFixed(digits);
const pct = (part, whole) => (whole === 0 ? '0%' : `${Math.round((part / whole) * 100)}%`);

const result = computeCommunityRatings(records);
const raters = [...result.raters.values()].sort(
  (a, b) => b.ratedCount - a.ratedCount || (a.userId < b.userId ? -1 : 1)
);
const alias = new Map(
  raters.map((stats, index) => [
    stats.userId,
    `Rater ${String.fromCharCode(65 + (index % 26))}${index >= 26 ? Math.floor(index / 26) : ''}`,
  ])
);
const scored = [...result.games.values()].map((game) => ({
  ...game,
  title: games.get(game.gameId)?.title ?? game.gameId,
  genres: games.get(game.gameId)?.genres ?? [],
  delta: game.weightedRating - game.rawMean,
}));

say(`# Weighted community score — dry run over the live ratings`);
say();
say(
  `Read ${new Date().toISOString().slice(0, 10)} from the live project (read-only, anon key). Method version ${COMMUNITY_RATING.version}.`
);
say();
say(
  `- **${records.length}** ratings by **${raters.length}** raters of **${scored.length}** games.`
);
const comparable = raters.filter(
  (stats) => stats.comparisons >= COMMUNITY_RATING.deviation.minComparisons
).length;
say(
  `- **${comparable}** raters have ${COMMUNITY_RATING.deviation.minComparisons}+ comparable ratings (games with ${COMMUNITY_RATING.deviation.minOtherRaters}+ other raters); the deviation signal needs **${COMMUNITY_RATING.deviation.minPopulation}**, so it is ${comparable >= COMMUNITY_RATING.deviation.minPopulation ? 'available' : '**unavailable** — only the low-entropy signal can apply'}.`
);
say();

say(`## Raters`);
say();
const adjusted = raters.filter((stats) => stats.weight < 1);
const floor = raters.filter((stats) => stats.weight <= COMMUNITY_RATING.weight.min);
say(
  `${adjusted.length} of ${raters.length} (${pct(adjusted.length, raters.length)}) would carry less than a full weight; ${floor.length} at the ${COMMUNITY_RATING.weight.min} floor.`
);
say();
say(
  `| Rater | Ratings | Spread over 0–19 · 20–39 · 40–59 · 60–79 · 80–100 | Norm. entropy | Comparisons | Signals | Weight |`
);
say(`| --- | ---: | --- | ---: | ---: | --- | ---: |`);
for (const stats of raters) {
  const signals =
    [stats.lowEntropy && 'low entropy', stats.highDeviation && 'high deviation']
      .filter(Boolean)
      .join(' + ') || '—';
  say(
    `| ${alias.get(stats.userId)} | ${stats.ratedCount} | ${stats.distribution.join(' · ')} | ${fixed(stats.normalizedEntropy, 3)} | ${stats.comparisons} | ${signals} | ${fixed(stats.weight, 4)} |`
  );
}
say();

say(`## Games`);
say();
const moved = scored.filter((game) => Math.round(game.weightedRating) !== Math.round(game.rawMean));
const meanAbs =
  scored.reduce((sum, game) => sum + Math.abs(game.delta), 0) / Math.max(1, scored.length);
const maxAbs = Math.max(0, ...scored.map((game) => Math.abs(game.delta)));
say(
  `- ${moved.length} of ${scored.length} games (${pct(moved.length, scored.length)}) would **show a different whole number** than today.`
);
say(
  `- Mean |weighted − plain|: **${fixed(meanAbs, 3)}** points; largest: **${fixed(maxAbs, 3)}**.`
);
say();
const largest = [...scored]
  .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta) || b.raters - a.raters)
  .slice(0, 10)
  .filter((game) => Math.abs(game.delta) > 0);
if (largest.length > 0) {
  say(`| Game | Raters | Plain | Weighted | Δ | Shown today → after |`);
  say(`| --- | ---: | ---: | ---: | ---: | --- |`);
  for (const game of largest) {
    say(
      `| ${game.title} | ${game.raters} | ${fixed(game.rawMean)} | ${fixed(game.weightedRating)} | ${game.delta > 0 ? '+' : ''}${fixed(game.delta)} | ${Math.round(game.rawMean)} → ${Math.round(game.weightedRating)} |`
    );
  }
} else {
  say(`No game's score changes at all.`);
}
say();

say(`### Thinly rated games`);
say();
say(`| Raters per game | Games | Mean |Δ| |`);
say(`| --- | ---: | ---: |`);
for (const [label, test] of [
  ['1', (n) => n === 1],
  ['2–3', (n) => n >= 2 && n <= 3],
  ['4–9', (n) => n >= 4 && n <= 9],
  ['10+', (n) => n >= 10],
]) {
  const group = scored.filter((game) => test(game.raters));
  const mean =
    group.reduce((sum, game) => sum + Math.abs(game.delta), 0) / Math.max(1, group.length);
  say(`| ${label} | ${group.length} | ${group.length ? fixed(mean, 3) : '—'} |`);
}
say();
say(`A game one person rated can never move: its weighted and plain means are that one rating.`);
say();

say(`### The order of the best-rated games`);
say();
const ranked = (by) =>
  [...scored]
    .filter((game) => game.raters >= 2)
    .sort((a, b) => by(b) - by(a) || b.raters - a.raters || (a.gameId < b.gameId ? -1 : 1));
const plainOrder = ranked((game) => game.rawMean)
  .slice(0, 10)
  .map((game) => game.gameId);
const weightedOrder = ranked((game) => game.weightedRating)
  .slice(0, 10)
  .map((game) => game.gameId);
const changedPlaces = plainOrder.filter((id, index) => weightedOrder[index] !== id).length;
say(
  `Among games with two or more raters, the top ten by the plain mean and by the weighted score differ at ${changedPlaces} of ${plainOrder.length} places.`
);
say();

say(`### By genre`);
say();
const byGenre = new Map();
for (const game of scored) {
  for (const genre of game.genres ?? []) {
    const entry = byGenre.get(genre) ?? { games: 0, delta: 0 };
    entry.games += 1;
    entry.delta += game.delta;
    byGenre.set(genre, entry);
  }
}
const genres = [...byGenre.entries()]
  .filter(([, entry]) => entry.games >= 3)
  .sort((a, b) => Math.abs(b[1].delta / b[1].games) - Math.abs(a[1].delta / a[1].games));
if (genres.length === 0) say(`Too few games per genre to say anything.`);
else {
  say(`| Genre | Games | Mean Δ (weighted − plain) |`);
  say(`| --- | ---: | ---: |`);
  for (const [genre, entry] of genres.slice(0, 10))
    say(`| ${genre} | ${entry.games} | ${fixed(entry.delta / entry.games, 3)} |`);
}
say();

say(`### Who the changes come from`);
say();
for (const stats of adjusted) {
  const theirs = records
    .filter((record) => record.userId === stats.userId)
    .map((record) => record.gameId);
  const touched = scored.filter((game) => theirs.includes(game.gameId) && Math.abs(game.delta) > 0);
  say(
    `- ${alias.get(stats.userId)} (weight ${fixed(stats.weight, 4)}) rated ${theirs.length} games; ${touched.length} of them have a score that moves, by ${fixed(touched.reduce((sum, game) => sum + Math.abs(game.delta), 0) / Math.max(1, touched.length), 3)} points on average.`
  );
}
if (adjusted.length === 0) say(`Nobody is adjusted, so nothing moves.`);
say();

say(`## Sensitivity`);
say();
say(
  `The same ratings under neighbouring parameters. "Adjusted" is raters below a full weight; "moved" is games whose whole number would change.`
);
say();
say(`| Variation | Adjusted raters | Games moved | Mean |Δ| |`);
say(`| --- | ---: | ---: | ---: |`);
const C = COMMUNITY_RATING;
const variations = [
  ['As configured', C],
  ['Entropy threshold 0.10', { ...C, entropy: { ...C.entropy, lowThreshold: 0.1 } }],
  ['Entropy threshold 0.20', { ...C, entropy: { ...C.entropy, lowThreshold: 0.2 } }],
  ['Entropy threshold 0.25', { ...C, entropy: { ...C.entropy, lowThreshold: 0.25 } }],
  ['Ten 10-point bands', { ...C, entropy: { ...C.entropy, bucketWidth: 10, buckets: 10 } }],
  ['Confidence from 5 to 20 ratings', { ...C, confidence: { from: 5, full: 20 } }],
  ['Confidence from 20 to 50 ratings', { ...C, confidence: { from: 20, full: 50 } }],
  [
    'Deviation with no population floor, 1 other rater',
    { ...C, deviation: { ...C.deviation, minOtherRaters: 1, minComparisons: 5, minPopulation: 2 } },
  ],
  ['Penalties halved (0.075 / 0.15)', { ...C, penalty: { lowEntropy: 0.075, combined: 0.15 } }],
];
for (const [label, config] of variations) {
  const run = computeCommunityRatings(records, config);
  const runAdjusted = [...run.raters.values()].filter((stats) => stats.weight < 1).length;
  const runGames = [...run.games.values()];
  const runMoved = runGames.filter(
    (game) => Math.round(game.weightedRating) !== Math.round(game.rawMean)
  ).length;
  const runMean =
    runGames.reduce((sum, game) => sum + Math.abs(game.weightedRating - game.rawMean), 0) /
    Math.max(1, runGames.length);
  say(`| ${label} | ${runAdjusted} | ${runMoved} | ${fixed(runMean, 3)} |`);
}
say();
say(`## What this cannot tell you`);
say();
say(
  `There is no ground-truth score for a game, so nothing here says the weighted score is *better* — only how different it is, where, and how much that depends on the parameters. The parameters are the brief's starting hypotheses (from analyses of a music site's ratings) and have not been validated on a game community.`
);

const report = lines.join('\n');
const out = process.argv.indexOf('--out');
if (out > 0 && process.argv[out + 1]) {
  writeFileSync(process.argv[out + 1], `${report}\n`);
  console.log(`Wrote ${process.argv[out + 1]}`);
} else {
  console.log(report);
}
