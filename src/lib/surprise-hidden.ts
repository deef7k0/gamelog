import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Games banished from Surprise Me, on the device.
 *
 * ## Why this is not in `SurprisePrefs`
 *
 * Everything in `surprise-prefs.ts` is a closed vocabulary — three enums, a
 * boolean, a handful of IGDB ids — read on every render of the settings block
 * and validated field by field. This is an unbounded list that grows every time
 * somebody double-taps a cover, and it is read by two screens that share nothing
 * else. Keeping it in its own key means a corrupt prefs blob cannot take the
 * hidden list with it, and a hidden list of three hundred rows is not parsed to
 * answer "which pool is selected".
 *
 * It is on the device for the same reason the prefs are — see that file's note
 * on why there is no `user_settings` table — and keyed by user id for the same
 * reason too: two accounts on one handset do not inherit each other's exclusions.
 *
 * ## The promise
 *
 * A hidden game never comes back. `getSurpriseBatch` drops these *after* every
 * other filter and, unlike `excludeLogged`, it never abandons the filter to
 * avoid an empty batch — "you will never see this again" is the whole feature,
 * and a version of it that lapses when the pool runs thin is not that feature.
 * Coming back is a thing the person does, in Settings.
 */

const PREFIX = 'gamelog:surprise-hidden';

/**
 * Enough to render the row in Settings without a lookup.
 *
 * The title and the cover are copied in at the moment of hiding rather than
 * resolved later, because the alternative is a screen that spends one IGDB
 * request per hidden game to draw a list whose whole purpose is deleting from
 * it. They are a *snapshot* — a retitled game keeps the name it had when it was
 * hidden, which is the name the person remembers hiding.
 */
export type HiddenGame = {
  /** The app-wide `${source}:${sourceId}`. The only field anything filters on. */
  id: string;
  title: string;
  coverUrl: string | null;
  /** ms since epoch, so the list can show the most recently hidden first. */
  hiddenAt: number;
};

/**
 * Where the list stops growing.
 *
 * Not a limit anybody will reach by hand — it is a ceiling on what one
 * AsyncStorage value can become if something goes wrong, since the whole list is
 * parsed on every read. At roughly 120 bytes a row this caps the blob near
 * 60 KB. The oldest entries fall off the end, which is the right end to lose
 * from: a game hidden three hundred games ago is one you will not recognise.
 */
const LIMIT = 500;

function keyFor(userId: string) {
  return `${PREFIX}:${userId}`;
}

/** Discards anything that is not a usable row rather than trusting the parse. */
function coerce(value: unknown): HiddenGame[] {
  if (!Array.isArray(value)) return [];

  const out: HiddenGame[] = [];
  const seen = new Set<string>();

  for (const entry of value) {
    if (!entry || typeof entry !== 'object') continue;
    const row = entry as Partial<HiddenGame>;
    if (typeof row.id !== 'string' || !row.id) continue;
    if (seen.has(row.id)) continue;

    seen.add(row.id);
    out.push({
      id: row.id,
      title: typeof row.title === 'string' && row.title ? row.title : 'Unknown game',
      coverUrl: typeof row.coverUrl === 'string' ? row.coverUrl : null,
      hiddenAt: typeof row.hiddenAt === 'number' ? row.hiddenAt : 0,
    });
  }

  return out;
}

export async function loadHiddenGames(userId: string): Promise<HiddenGame[]> {
  try {
    const raw = await AsyncStorage.getItem(keyFor(userId));
    if (!raw) return [];
    return coerce(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function write(userId: string, games: HiddenGame[]): Promise<HiddenGame[]> {
  const capped = games.slice(0, LIMIT);
  try {
    await AsyncStorage.setItem(keyFor(userId), JSON.stringify(capped));
  } catch {
    /* Ignored — the caller has already been handed the new list, and the worst
       case is that a game reappears in a later session. */
  }
  return capped;
}

/**
 * Hide one game, newest first, and hand back the whole list.
 *
 * Read-modify-write rather than an append, because the store is a single JSON
 * value and there is no other way to add to one. Returning the result is what
 * lets the caller put it straight into the query cache instead of refetching
 * what it just wrote.
 */
export async function hideGame(
  userId: string,
  game: { id: string; title: string; coverUrl?: string | null }
): Promise<HiddenGame[]> {
  const current = await loadHiddenGames(userId);
  const without = current.filter((entry) => entry.id !== game.id);

  return write(userId, [
    { id: game.id, title: game.title, coverUrl: game.coverUrl ?? null, hiddenAt: Date.now() },
    ...without,
  ]);
}

export async function unhideGame(userId: string, gameId: string): Promise<HiddenGame[]> {
  const current = await loadHiddenGames(userId);
  return write(
    userId,
    current.filter((entry) => entry.id !== gameId)
  );
}

export async function clearHiddenGames(userId: string): Promise<HiddenGame[]> {
  try {
    await AsyncStorage.removeItem(keyFor(userId));
  } catch {
    /* Ignored, as above. */
  }
  return [];
}

/** The ids alone, for the filter. Membership is the only question anything asks. */
export function hiddenGameIds(games: readonly HiddenGame[]): ReadonlySet<string> {
  return new Set(games.map((game) => game.id));
}
