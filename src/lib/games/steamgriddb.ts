/**
 * SteamGridDB — square (1:1) cover art, which IGDB does not publish.
 *
 * IGDB publishes portrait box art (2:3) and landscape key art, and nothing
 * square. Three surfaces want a square: a profile's Reviews tab, a collection's
 * 2×2 mosaic, and Surprise Me. All three used to crop the portrait cover — and
 * box art is *composed* for 2:3, so the crop routinely cuts the logo in half.
 * SteamGridDB hosts community grids at true 1:1, which are composed square.
 *
 * ## Square only — there is no per-platform lookup here
 *
 * There was one, briefly: the game page asked for the selected platform's own
 * box front. It could not work. `/grids/{platform}/{id}` takes *store* slugs —
 * `steam`, `gog`, `egs`, `origin`, `eshop` — not console families, so
 * `playstation` and `xbox` have no endpoint to resolve against and every console
 * tap spent a request to fall back to the cover it already had. Don't rebuild
 * it against this API.
 *
 * ## What this is not
 *
 * **Not a catalogue provider.** It resolves artwork for a game the app already
 * has, and nothing here may put a game into the app. IGDB stays the only source
 * of games — see CLAUDE.md, "One catalogue".
 *
 * ## Why the key ships in the bundle
 *
 * `EXPO_PUBLIC_SGDB_API_KEY` is inlined at build time, exactly like the RAWG and
 * Steam keys beside it in `.env.example`. It is a read-only key against a public
 * image database, so the exposure is the same class as those — unlike IGDB's
 * Twitch `client_secret`, which is why *that* one lives in an Edge Function. If
 * this ever needs to be a true secret, the move is an `sgdb` Edge Function
 * mirroring `itad`, and only this file changes.
 *
 * **No key means no requests.** Every function here short-circuits to `null`, so
 * an unconfigured build falls back to the IGDB cover rather than firing a round
 * of 401s.
 */

const API = 'https://www.steamgriddb.com/api/v2';

const KEY = process.env.EXPO_PUBLIC_SGDB_API_KEY ?? '';

/**
 * Whether this build can ask SteamGridDB anything at all.
 *
 * Exported so a caller can answer "is there a square cover" *synchronously* when
 * the answer is unconditionally no. Every function here already short-circuits
 * on a missing key, but it does so by resolving a promise — and a promise that
 * resolves null next tick still costs a render where the answer is unknown,
 * which is a placeholder frame in front of every cover in the app. See
 * `use-square-cover`.
 */
export const SGDB_ENABLED = KEY.length > 0;

/**
 * Asked for in this order, and the second is a real fallback rather than a
 * courtesy.
 *
 * SteamGridDB's square grids are uploaded at both sizes and 512 is by far the
 * more common — a 1024-only query comes back empty for a large slice of the
 * catalogue. Asking for the larger first and settling for the smaller is what
 * makes the difference between "most games have one" and "some do"; at a 56dp
 * row even 512 is eight times the pixels the row can show.
 */
const DIMENSIONS = ['1024x1024', '512x512'] as const;

/**
 * Resolved covers, keyed by the identity they were resolved from.
 *
 * Module scope, so it survives navigation and every screen shares one copy —
 * and it holds `null` as a real answer, which is the half that matters. A game
 * SteamGridDB has never heard of is the common case, and without a negative
 * cache every remount of a fifty-row list would re-ask for all fifty misses.
 */
const cache = new Map<string, string | null>();

/** One game on SteamGridDB. The id is all the square lookup needs. */
export type SgdbGame = { id: number };

/**
 * Resolved games, keyed by lower-cased title, holding `null` for a miss.
 *
 * Separate from `cache` because the two have different lifetimes in principle
 * and very different shapes in practice: this is resolved **once per game** and
 * then answers every platform tap on that game's page without a request, which
 * is the whole reason the platform lookup is two steps instead of one.
 */
const games = new Map<string, SgdbGame | null>();
const gamesInflight = new Map<string, Promise<SgdbGame | null>>();

/**
 * Lookups currently in flight, so two rows for the same game make one request.
 *
 * TanStack Query already dedupes by key at the call site; this dedupes the layer
 * *below* that, where several different keys (a Steam appid and a title, say)
 * can resolve to the same fetch.
 */
const inflight = new Map<string, Promise<string | null>>();

type GridResponse = {
  success?: boolean;
  data?: { url?: string }[];
};

/**
 * How many requests may be in the air at once.
 *
 * **This is the one thing standing between a mosaic wall and a rate limit.** The
 * square lookup is per *tile*, and the screens that use it are dense: a
 * Collections tab with twenty collections mounts eighty mosaic tiles, a Reviews
 * tab with forty reviews mounts forty rows, and each miss costs a search plus
 * two grid requests. Nothing above this line throttles any of it — TanStack
 * dedupes identical keys and the maps below dedupe identical fetches, but eighty
 * *different* games are eighty legitimate lookups that would otherwise leave
 * together.
 *
 * Four is chosen to be unremarkable rather than fast. None of these requests is
 * blocking: every caller has an IGDB cover on screen already and the square
 * replaces it whenever it arrives, so the only thing a queue costs is that the
 * eightieth tile sharpens a second or two after the first. What it buys is that
 * the eightieth tile is *answered* rather than 429'd — and a 429 is
 * indistinguishable here from "this game has no square art", so the failure mode
 * of not having this is a permanent-looking wrong answer cached for the session.
 */
const MAX_CONCURRENT = 4;

let active = 0;
const queue: (() => void)[] = [];

/** Waits for a slot, runs `task`, then hands the slot to whoever is next. */
async function limited<T>(task: () => Promise<T>): Promise<T> {
  if (active >= MAX_CONCURRENT) {
    await new Promise<void>((resolve) => queue.push(resolve));
  }
  active += 1;

  try {
    return await task();
  } finally {
    active -= 1;
    queue.shift()?.();
  }
}

async function sgdb<T>(path: string, signal?: AbortSignal): Promise<T | null> {
  return limited(async () => {
    try {
      const response = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${KEY}` },
        ...(signal ? { signal } : {}),
      });
      /* Every non-200 is the same answer to the caller: a 401 (no key or a bad
         one), a 404 (SteamGridDB does not have this game, or not on this store)
         and a 429 all mean "no art from here", and all three are handled by
         falling back to the IGDB cover. */
      if (!response.ok) return null;
      return (await response.json()) as T;
    } catch {
      /* A missing cover is not worth surfacing: the caller falls back to the
         IGDB portrait, which is what it was showing before this existed. */
      return null;
    }
  });
}

/**
 * The first grid URL at any of `DIMENSIONS`, or null if there is none.
 *
 * Walks the ladder in order and stops at the first size that returns anything,
 * so `DIMENSIONS`' order *is* the priority order.
 */
async function firstGrid(scope: string, signal?: AbortSignal): Promise<string | null> {
  for (const dimensions of DIMENSIONS) {
    const body = await sgdb<GridResponse>(
      `/grids/${scope}?dimensions=${dimensions}&limit=1`,
      signal
    );
    const url = body?.data?.[0]?.url;
    if (url) return url;
  }
  return null;
}

/** One search hit. Only the id is read — see `resolveGame`. */
type SearchHit = { id?: number };

type SearchResponse = {
  success?: boolean;
  data?: SearchHit[];
};

/**
 * Title → SteamGridDB game id.
 *
 * **The only resolution path most of this app's games have**, which is why it is
 * here despite being the weakest one. `games.source_id` is an IGDB id for
 * everything added since the catalogue cutover, and SteamGridDB indexes Steam,
 * GOG, Epic and a handful of other stores — but not IGDB. Without a title search
 * the square cover would resolve for legacy `steam:` rows only, which is a
 * feature that works for almost nobody.
 *
 * The cost is honest: this is a string match against a catalogue with three
 * games called "Mafia", so a wrong cover is possible where an id lookup could
 * not produce one. It is bounded — the worst outcome is the wrong square art on
 * a 56dp row in an index, not a wrong game opening — and the first result for an
 * exact title is right the overwhelming majority of the time. If it ever needs
 * to be tighter, the fix is to compare the returned game's name with the
 * request's rather than to take `data[0]` on faith.
 */
export async function resolveGame(
  gameName: string,
  signal?: AbortSignal
): Promise<SgdbGame | null> {
  if (!KEY || !gameName.trim()) return null;

  const key = gameName.trim().toLowerCase();

  const cached = games.get(key);
  if (cached !== undefined) return cached;

  const existing = gamesInflight.get(key);
  if (existing) return existing;

  const request = (async (): Promise<SgdbGame | null> => {
    const body = await sgdb<SearchResponse>(
      `/search/autocomplete/${encodeURIComponent(gameName.trim())}`,
      signal
    );
    const hit = body?.data?.[0];
    if (!hit?.id) return null;
    return { id: hit.id };
  })();

  gamesInflight.set(key, request);

  try {
    const resolved = await request;
    games.set(key, resolved);
    return resolved;
  } finally {
    gamesInflight.delete(key);
  }
}

export type SquareCoverInput = {
  /** A SteamGridDB game id, when one is already known. The strongest match. */
  gameId?: number;
  /** A Steam appid. An identity match, and the only one this app can usually make. */
  steamAppId?: number;
  /** The game's title, for the search fallback. See `resolveGame`. */
  title?: string;
};

/**
 * A square cover for one game, or `null` when SteamGridDB has none.
 *
 * Tries the identities strongest-first — known grid id, then Steam appid, then
 * the title — and each of those tries 1024 before 512. `null` is a normal
 * answer and the caller is expected to fall back to the IGDB cover, so this
 * never throws and never rejects.
 */
export async function getSquareCover(
  { gameId, steamAppId, title }: SquareCoverInput,
  signal?: AbortSignal
): Promise<string | null> {
  if (!KEY) return null;

  const key = gameId
    ? `game:${gameId}`
    : steamAppId
      ? `steam:${steamAppId}`
      : title
        ? `title:${title.toLowerCase()}`
        : null;
  if (!key) return null;

  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  const existing = inflight.get(key);
  if (existing) return existing;

  const request = (async () => {
    if (gameId) return firstGrid(`game/${gameId}`, signal);
    if (steamAppId) {
      const direct = await firstGrid(`steam/${steamAppId}`, signal);
      if (direct) return direct;
    }
    if (title) {
      const found = await resolveGame(title, signal);
      if (found) return firstGrid(`game/${found.id}`, signal);
    }
    return null;
  })();

  inflight.set(key, request);

  try {
    const url = await request;
    cache.set(key, url);
    return url;
  } finally {
    inflight.delete(key);
  }
}
