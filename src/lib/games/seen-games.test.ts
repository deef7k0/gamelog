import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';

import { SEEN_GAMES_LIMIT, forgetSeenGames, recallGame, rememberGame } from './seen-games.ts';
import type { Game } from './types.ts';

const game = (n: number) => ({ id: `igdb:${n}`, title: `Game ${n}` }) as Game;

describe('seen games', () => {
  beforeEach(() => forgetSeenGames());

  it('hands the game page a remembered game and when it was seen', () => {
    rememberGame(game(1), 5_000);
    assert.deepEqual(recallGame('igdb:1'), { value: game(1), at: 5_000 });
    assert.equal(recallGame('igdb:2'), null);
  });

  it('holds a long session of rails and no more', () => {
    for (let n = 0; n <= SEEN_GAMES_LIMIT; n += 1) rememberGame(game(n), n);
    assert.equal(recallGame('igdb:0'), null);
    assert.ok(recallGame(`igdb:${SEEN_GAMES_LIMIT}`));
  });
});
