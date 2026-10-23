/**
 * PlayStation, Xbox and GOG libraries read from a public username — RAWG's
 * way, as its shipped web app shows it (2026-10-22): the person types the
 * name they are known by on the service, nothing more, and the server imports
 * what that service shows to anybody. The pure half: names, answers, rows.
 * `functions/game-accounts` does the fetching.
 *
 * What each service shows, and to whom — RAWG's own help text says the same:
 *
 * - **GOG** — no key. `gog.com/u/{username}` is the profile (404: no such
 *   user; its HTML carries the user's id), and `gog.com/u/{username}/games/
 *   stats?sort=…&order=…&page=N` its games, the endpoint GOG's own profile
 *   page calls (`profiles-static.gog.com/assets/bundle_min.js`) and Playnite's
 *   GOG plugin reads when logged out. 403 when the profile is private, 404
 *   when its games are (both observed live; the success shape is Playnite's
 *   model — no public profile was found to read one).
 * - **PlayStation** — the trophy API, which answers only a signed-in caller:
 *   the app's own PSN account (an NPSSO cookie → an access code → a token,
 *   psn-api's flow). The Online ID's `profile2` gives the account id, then
 *   `trophyTitles` every game with trophies. "Not permitted by access
 *   control" when trophies are private. Only games with trophies exist here,
 *   which RAWG says too: "We can import games only with trophies info."
 * - **Xbox** — title history, which Xbox Live answers only to a signed-in
 *   caller: through OpenXBL (xbl.io, an API key), `/search/{gamertag}` for the
 *   xuid, then `/player/titleHistory/{xuid}`.
 *
 * No imports: `npm test` loads this file by relative path, and Deno deploys it.
 */

export type ImportProvider = 'playstation' | 'xbox' | 'gog';

export const IMPORT_PROVIDERS: readonly ImportProvider[] = ['playstation', 'xbox', 'gog'];

/**
 * RAWG's statuses, as its client names them, plus the two this app needs:
 * `not-found` (RAWG folds it into `error`) and `unconfigured` (the function
 * has no key for the service yet).
 */
export type ImportStatus =
  | 'ready'
  | 'private-user'
  | 'private-games'
  | 'not-found'
  | 'taken'
  | 'unavailable'
  | 'unconfigured'
  | 'error';

/** One owned game, in `gaming_owned_games`' shape (less the user and provider). */
export type ImportedGame = {
  app_id: string;
  name: string;
  icon_url: string | null;
  playtime_minutes: number;
  last_played_at: string | null;
  achievements_total: number | null;
  achievements_unlocked: number | null;
};

export type ImportedAccount = {
  externalId: string;
  handle: string;
  displayName: string | null;
  avatarUrl: string | null;
  profileUrl: string | null;
};

/**
 * A name as the service would take it, or null when it cannot be one.
 *
 * - PSN Online ID: 3–16 letters, digits, hyphens and underscores.
 * - Xbox gamertag: letters, digits and spaces, a classic one up to 15, a
 *   modern one up to 12 with a `#1234` suffix.
 * - GOG username: what follows `gog.com/u/` — a pasted profile address is
 *   read for it, as RAWG's form tells people to look there.
 */
export function cleanHandle(provider: ImportProvider, raw: string): string | null {
  const value = raw.trim();
  switch (provider) {
    case 'playstation':
      return /^[A-Za-z][A-Za-z0-9_-]{2,15}$/.test(value) ? value : null;
    case 'xbox': {
      const tag = value.replace(/\s+/g, ' ');
      return /^[A-Za-z0-9 ]{1,15}$/.test(tag) || /^[A-Za-z0-9 ]{1,12}#\d{1,4}$/.test(tag)
        ? tag
        : null;
    }
    case 'gog': {
      const fromUrl = /gog\.com\/(?:[a-z]{2}\/)?u\/([^/?#\s]+)/i.exec(value);
      const name = fromUrl ? decodeURIComponent(fromUrl[1]) : value;
      return /^[A-Za-z0-9._-]{1,40}$/.test(name) ? name : null;
    }
  }
}

/** What the person is told for each status. RAWG's words where it has them. */
export function statusMessage(provider: ImportProvider, status: ImportStatus): string | null {
  const name = PROVIDER_LABEL[provider];
  switch (status) {
    case 'ready':
      return null;
    case 'private-user':
    case 'private-games':
      return `Your ${name} profile or games seem to be private. Set them to public and import again.`;
    case 'not-found':
      return `No ${name} account has that ${HANDLE_LABEL[provider]}.`;
    case 'taken':
      return `That ${name} account is already linked to another GameLog account.`;
    case 'unavailable':
      return `${name} is not answering right now. Try again in a while.`;
    case 'unconfigured':
      return `${name} import is not connected yet.`;
    case 'error':
      return `Something went wrong importing from ${name}.`;
  }
}

export const PROVIDER_LABEL: Record<ImportProvider, string> = {
  playstation: 'PlayStation',
  xbox: 'Xbox',
  gog: 'GOG',
};

export const HANDLE_LABEL: Record<ImportProvider, string> = {
  playstation: 'Online ID',
  xbox: 'gamertag',
  gog: 'username',
};

// ---------------------------------------------------------------------------
// GOG
// ---------------------------------------------------------------------------

/** One item of `games/stats`: Playnite's `LibraryGameResponse`. */
export type GogStatsItem = {
  game?: { id?: string | number; title?: string; image?: string; url?: string };
  /** Keyed by the profile's user id: `{ "4698…": { playtime, lastSession } }`. */
  stats?: Record<string, { playtime?: number; lastSession?: string | null } | undefined> | null;
};

export type GogStatsPage = {
  page?: number;
  pages?: number;
  total?: number;
  _embedded?: { items?: GogStatsItem[] };
};

/** The user id a GOG profile page carries (`"userId":"46987787926178880"`). */
export function gogUserIdFromPage(html: string): string | null {
  return /"userId"\s*:\s*"(\d{5,25})"/.exec(html)?.[1] ?? null;
}

/** GOG's images are addresses without a size; `_196.jpg` is its square tile. */
export function gogImageUrl(image: string | undefined): string | null {
  if (!image) return null;
  const absolute = image.startsWith('//') ? `https:${image}` : image;
  if (!/^https:\/\/[a-z0-9.-]*gog(-statics)?\.com\//i.test(absolute)) return null;
  return /\.(jpe?g|png|webp)$/i.test(absolute) ? absolute : `${absolute}_196.jpg`;
}

export function gogRows(items: readonly GogStatsItem[]): ImportedGame[] {
  return dedupe(
    items.flatMap((item): ImportedGame[] => {
      const id = item.game?.id;
      const title = item.game?.title?.trim();
      if (id === undefined || id === null || !title) return [];
      const stats = item.stats ? Object.values(item.stats).find(Boolean) : undefined;
      return [
        {
          app_id: String(id),
          name: title,
          icon_url: gogImageUrl(item.game?.image),
          playtime_minutes: Math.max(0, Math.round(stats?.playtime ?? 0)),
          last_played_at: isoOrNull(stats?.lastSession),
          achievements_total: null,
          achievements_unlocked: null,
        },
      ];
    })
  );
}

// ---------------------------------------------------------------------------
// PlayStation
// ---------------------------------------------------------------------------

export type TrophyCounts = { bronze?: number; silver?: number; gold?: number; platinum?: number };

/** One of `trophyTitles` (psn-api's `TrophyTitle`). */
export type PsnTrophyTitle = {
  npCommunicationId?: string;
  trophyTitleName?: string;
  trophyTitleIconUrl?: string;
  trophyTitlePlatform?: string;
  definedTrophies?: TrophyCounts;
  earnedTrophies?: TrophyCounts;
  lastUpdatedDateTime?: string;
  hiddenFlag?: boolean;
};

/** Sony's answer when trophies are not shared with the caller. */
export const PSN_NOT_PERMITTED = 2240526;

function trophyTotal(counts: TrophyCounts | undefined): number {
  return (
    (counts?.bronze ?? 0) + (counts?.silver ?? 0) + (counts?.gold ?? 0) + (counts?.platinum ?? 0)
  );
}

export function psnRows(titles: readonly PsnTrophyTitle[]): ImportedGame[] {
  return dedupe(
    titles.flatMap((title): ImportedGame[] => {
      const id = title.npCommunicationId;
      const name = title.trophyTitleName?.trim();
      /* A title its owner hid from their list is not shown to anybody else. */
      if (!id || !name || title.hiddenFlag) return [];
      return [
        {
          app_id: id,
          name,
          icon_url: httpsOrNull(title.trophyTitleIconUrl),
          playtime_minutes: 0,
          /* The last time a trophy moved: the nearest thing to "last played"
             the trophy API has. */
          last_played_at: isoOrNull(title.lastUpdatedDateTime),
          achievements_total: trophyTotal(title.definedTrophies),
          achievements_unlocked: trophyTotal(title.earnedTrophies),
        },
      ];
    })
  );
}

/** The PSN error code in an answer, when it is one. */
export function psnErrorCode(body: unknown): number | null {
  const error = isRecord(body) && isRecord(body.error) ? body.error : null;
  return error && typeof error.code === 'number' ? error.code : null;
}

// ---------------------------------------------------------------------------
// Xbox
// ---------------------------------------------------------------------------

export type XboxPerson = {
  xuid?: string;
  gamertag?: string;
  modernGamertag?: string;
  uniqueModernGamertag?: string;
  displayPicRaw?: string;
};

/** One of OpenXBL's `titleHistory` titles (Xbox Live's titlehub). */
export type XboxTitle = {
  titleId?: string | number;
  name?: string;
  type?: string;
  displayImage?: string;
  achievement?: { currentAchievements?: number; totalAchievements?: number };
  titleHistory?: { lastTimePlayed?: string };
};

/** The person whose gamertag is exactly this one — never the search's first guess. */
export function xboxPersonFor(people: readonly XboxPerson[], gamertag: string): XboxPerson | null {
  const wanted = gamertag.toLowerCase();
  return (
    people.find((person) =>
      [person.gamertag, person.modernGamertag, person.uniqueModernGamertag].some(
        (tag) => tag?.toLowerCase() === wanted
      )
    ) ?? null
  );
}

export function xboxRows(titles: readonly XboxTitle[]): ImportedGame[] {
  return dedupe(
    titles.flatMap((title): ImportedGame[] => {
      const id = title.titleId;
      const name = title.name?.trim();
      /* Title history holds apps too — Netflix, the Store. Games only. */
      if (id === undefined || !name || (title.type && title.type !== 'Game')) return [];
      const total = title.achievement?.totalAchievements;
      return [
        {
          app_id: String(id),
          name,
          icon_url: httpsOrNull(title.displayImage),
          playtime_minutes: 0,
          last_played_at: isoOrNull(title.titleHistory?.lastTimePlayed),
          achievements_total: typeof total === 'number' && total > 0 ? total : null,
          achievements_unlocked:
            typeof total === 'number' && total > 0
              ? (title.achievement?.currentAchievements ?? 0)
              : null,
        },
      ];
    })
  );
}

// ---------------------------------------------------------------------------

function dedupe(rows: ImportedGame[]): ImportedGame[] {
  const seen = new Set<string>();
  return rows.filter((row) => !seen.has(row.app_id) && !!seen.add(row.app_id));
}

function isoOrNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : null;
}

function httpsOrNull(value: string | undefined): string | null {
  if (!value) return null;
  if (value.startsWith('https://')) return value;
  if (value.startsWith('http://')) return `https://${value.slice('http://'.length)}`;
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
