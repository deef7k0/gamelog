/**
 * Reading a game's Steam store page: its Awards section, and its recent events
 * and announcements.
 *
 * Pure, and it imports nothing — the `steam-store` Edge Function deploys it and
 * `npm test` loads it by relative path (`src/lib/games/steam-store.test.ts`),
 * the arrangement `soundcloud-match.ts` set up. Keep it that way: no imports, no
 * `enum` (Node strips types and refuses one), nothing Deno-only.
 *
 * Everything here was read off real pages and responses on 2026-10-16, and the
 * test fixtures are excerpts of them. See the notes on each function for what
 * varied between games.
 */

// ---------------------------------------------------------------------------
// Awards
// ---------------------------------------------------------------------------

/** One image from the publisher's Awards section. */
export type AwardImage = {
  /** The URL Steam's page draws, resolved and on https. Never built from an id. */
  url: string;
  /** A larger copy, when the page names one (`data-big-src`, Steam's `extras_big`). */
  largeUrl: string | null;
  alt: string | null;
  /** As the page states them; null when it does not. */
  width: number | null;
  height: number | null;
};

/**
 * One of Steam's own award banners — "The Steam Awards 2022, Winner, Game of
 * the Year Award". These sit in the same section as the publisher's images but
 * are Steam's markup around a generic trophy, so they are read as text.
 */
export type SteamAwardBanner = {
  year: number | null;
  /** "Winner", or whatever word the banner prints there. */
  result: string | null;
  /** One banner can carry several: Elden Ring's 2022 names two. */
  awards: string[];
  url: string | null;
};

export type SteamAwards = {
  appId: number;
  pageUrl: string;
  /** Whether the page has an Awards section at all. */
  section: boolean;
  awardsImages: AwardImage[];
  steamAwards: SteamAwardBanner[];
};

/** The page Steam serves for an app, in English, priced in the US. */
export function storePageUrl(appId: number): string {
  return `https://store.steampowered.com/app/${appId}/?l=english&cc=us`;
}

/**
 * Whether a fetched document is the app's store page.
 *
 * A removed or region-locked app redirects to the store's front page, and an
 * age-gated one (Elden Ring, Baldur's Gate 3, The Witcher 3, Cyberpunk 2077 —
 * all of them, without the cookies) to `/agecheck/app/…`. Neither has the app's
 * name block, which every store page does.
 */
export function isStorePage(html: string): boolean {
  return (
    /\bid\s*=\s*["']?appHubAppName\b/.test(html) ||
    /\bclass\s*=\s*["'][^"']*\bapphub_AppName\b/.test(html)
  );
}

/**
 * The Awards section of a Steam store page.
 *
 * ## Where it is
 *
 * `#awardsTable`, in the page's right column, rendered by the server: no
 * request after the page fills it in, and on a page without one there is no
 * markup for it at all (checked on Half-Life, Counter-Strike, Vampire Survivors
 * and Schedule I — not a hidden block, not embedded data, nothing).
 *
 * ## What is in it, which varies
 *
 * - **Publisher images** — `img.bb_img` in a `bb_img_ctn` span, from the
 *   description editor. One tall strip (Disco Elysium, 349×1792; Baldur's Gate
 *   3, 794×6008), several (Hollow Knight, three; Elden Ring, five), with
 *   attribute values unquoted (`width=800`) and sometimes a larger copy in
 *   `data-big-src`.
 * - **The Steam Awards** — an `<a class="steamawards…_ctn">` banner per year
 *   with "Winner" and the award names as text beside a generic trophy image
 *   from `/promo/steamawards…/`. Counter-Strike 2's section is only this. The
 *   class names carry the year since 2020 and do not in 2018's
 *   (`steamawards_app_banner_2018`), so the year is read from the link.
 *
 * Images are taken from Steam's own hosts only, resolved against the page, and
 * never guessed: a URL is one the page names. Lazy-loading attributes
 * (`data-src`, `srcset`) are read when `src` is missing or a placeholder —
 * none of the pages checked used them, and nothing here depends on that
 * staying true.
 */
export function parseAwards(html: string, pageUrl: string, appId: number): SteamAwards {
  const empty: SteamAwards = { appId, pageUrl, section: false, awardsImages: [], steamAwards: [] };

  const page = stripInert(html);
  const block = elementById(page, 'awardsTable');
  if (block === null) return empty;

  const bannerRanges: [number, number][] = [];
  const steamAwards: SteamAwardBanner[] = [];

  /* Steam's own banners first, so their trophies can be told from the
     publisher's images below by position. */
  const anchor = /<a\b([^>]*)>([\s\S]*?)<\/a\s*>/gi;
  for (const match of block.matchAll(anchor)) {
    const attributes = parseAttributes(match[1]);
    const className = attributes.class ?? '';
    if (!/\bsteamawards\w*_ctn\b/.test(className)) continue;

    const start = match.index ?? 0;
    bannerRanges.push([start, start + match[0].length]);
    steamAwards.push(readBanner(match[2], attributes.href ?? null, pageUrl));
  }

  const seen = new Set<string>();
  const awardsImages: AwardImage[] = [];

  for (const match of block.matchAll(/<img\b([^>]*)>/gi)) {
    const at = match.index ?? 0;
    if (bannerRanges.some(([from, to]) => at >= from && at < to)) continue;

    const image = readImage(parseAttributes(match[1]), pageUrl);
    if (!image || seen.has(image.url)) continue;
    seen.add(image.url);
    awardsImages.push(image);
  }

  return { appId, pageUrl, section: true, awardsImages, steamAwards };
}

/** One `<img>`'s attributes as an award image, or null when it is not one. */
function readImage(attributes: Record<string, string>, pageUrl: string): AwardImage | null {
  const candidates = [
    attributes.src,
    attributes['data-src'],
    attributes['data-lazy-src'],
    attributes['data-original'],
    largestFromSrcset(attributes.srcset ?? attributes['data-srcset']),
  ];

  let url: string | null = null;
  for (const candidate of candidates) {
    if (!candidate || isPlaceholder(candidate)) continue;
    url = steamImageUrl(candidate, pageUrl);
    if (url) break;
  }
  if (!url || !isAwardArt(url)) return null;

  const width = dimension(attributes.width);
  const height = dimension(attributes.height);
  /* A spacer, not a picture. */
  if ((width !== null && width <= 4) || (height !== null && height <= 4)) return null;

  const big = attributes['data-big-src']
    ? steamImageUrl(attributes['data-big-src'], pageUrl)
    : null;
  const alt = attributes.alt?.trim() || null;

  return { url, largeUrl: big && big !== url ? big : null, alt, width, height };
}

/**
 * Whether an image on Steam's CDN can be an award graphic.
 *
 * The section is the publisher's, so what they put there is theirs to call an
 * award — but a few of Steam's own asset kinds are never one, and are dropped
 * by name: a screenshot (`ss_…`), the store's header and capsules, the library
 * art, and the Steam Awards trophy (read as a banner instead).
 */
function isAwardArt(url: string): boolean {
  const path = new URL(url).pathname.toLowerCase();
  if (path.includes('/promo/steamawards')) return false;
  const file = path.slice(path.lastIndexOf('/') + 1);
  return !/^(ss_[0-9a-f]+|header|capsule_\w+|library_\w+|logo|page_bg\w*|hero_capsule\w*)[._]/.test(
    file
  );
}

/** "data:" URIs and the transparent spacer GIFs lazy loaders put in `src`. */
function isPlaceholder(value: string): boolean {
  return /^data:/i.test(value) || /(blank|trans|spacer|pixel)\.gif(\?|$)/i.test(value);
}

/** The widest candidate in a `srcset`, by its `w` or `x` descriptor. */
function largestFromSrcset(srcset: string | undefined): string | undefined {
  if (!srcset) return undefined;
  let best: { url: string; size: number } | undefined;
  for (const part of srcset.split(',')) {
    const [url, descriptor = '1x'] = part.trim().split(/\s+/);
    if (!url) continue;
    const size = parseFloat(descriptor) || 1;
    if (!best || size > best.size) best = { url, size };
  }
  return best?.url;
}

/**
 * A Steam-hosted image URL, resolved against the page and moved to https — or
 * null for anything else.
 *
 * Only Steam's own hosts: the section is the publisher's free text, and the
 * app should draw what Steam serves and nothing a page could point it at.
 * `http:` is upgraded because iOS will not load it; every Steam host answers
 * on https.
 */
const STEAM_IMAGE_HOSTS =
  /(^|\.)(steamstatic\.com|steampowered\.com|steamcommunity\.com|steamusercontent\.com|akamaihd\.net)$/;

function steamImageUrl(raw: string, pageUrl: string): string | null {
  let resolved: URL;
  try {
    resolved = new URL(decodeEntities(raw.trim()), pageUrl);
  } catch {
    return null;
  }
  if (resolved.protocol !== 'https:' && resolved.protocol !== 'http:') return null;
  if (!STEAM_IMAGE_HOSTS.test(resolved.hostname)) return null;
  if (resolved.hostname.endsWith('akamaihd.net') && !/^steam/.test(resolved.hostname)) return null;
  resolved.protocol = 'https:';
  return resolved.href;
}

function dimension(value: string | undefined): number | null {
  if (!value) return null;
  const number = parseInt(value, 10);
  return Number.isFinite(number) && number > 0 ? number : null;
}

/** "The Steam Awards 2022 · Winner · Game of the Year Award, Best Game You Suck At Award". */
function readBanner(inner: string, href: string | null, pageUrl: string): SteamAwardBanner {
  let url: string | null = null;
  if (href) {
    try {
      url = new URL(decodeEntities(href), pageUrl).href;
    } catch {
      url = null;
    }
  }

  const fromLink = url?.match(/\/steamawards\/(\d{4})\b/)?.[1];
  const fromText = textOf(inner).match(/\b(20\d{2})\b/)?.[1];
  const year = Number(fromLink ?? fromText) || null;

  const winner = inner.match(
    /<(\w+)\b[^>]*class\s*=\s*["'][^"']*_banner_winner\b[^"']*["'][^>]*>([\s\S]*?)<\/\1\s*>/i
  );
  const result = winner ? textOf(winner[2]) || null : null;

  const awards: string[] = [];
  const title =
    /<div\b[^>]*class\s*=\s*["'][^"']*\baward_title\b[^"']*["'][^>]*>([\s\S]*?)<\/div\s*>/gi;
  for (const match of inner.matchAll(title)) {
    const text = textOf(match[1]);
    if (text) awards.push(text);
  }

  return { year, result, awards, url };
}

// ---------------------------------------------------------------------------
// Events and announcements
// ---------------------------------------------------------------------------

/**
 * What kind of post an event is, in the few words a reader needs.
 *
 * Steam's `event_type` is a number from its partner-event enum. The groups
 * below are coarse on purpose: the ones checked against real posts are 12 and
 * 13 (patch notes), 14 (a major update), 15 (a DLC going on sale), 20 (a sale),
 * 25 (Elden Ring's Community Quests, an in-game event with a two-month
 * window), 28 (news) and 34 (a post cross-posted from another of the
 * developer's games). The rest are grouped by Steam's own names for them.
 */
export type SteamEventKind = 'update' | 'news' | 'event' | 'release' | 'sale' | 'stream';

const KIND_OF_TYPE: Record<number, SteamEventKind> = {
  12: 'update',
  13: 'update',
  14: 'update',
  33: 'update',
  28: 'news',
  34: 'news',
  10: 'release',
  15: 'release',
  16: 'release',
  29: 'release',
  30: 'release',
  32: 'release',
  20: 'sale',
  21: 'sale',
  11: 'stream',
  17: 'stream',
  18: 'stream',
  19: 'stream',
};

export function eventKindOf(type: number): SteamEventKind {
  return KIND_OF_TYPE[type] ?? 'event';
}

/** One recent event or announcement from a game's Steam page. */
export type SteamEvent = {
  id: string;
  title: string;
  kind: SteamEventKind;
  /** Steam's own number, kept so a later reading of the enum needs no refetch. */
  type: number;
  /** Seconds since the epoch. For a post, when it went up; for an event, when it starts. */
  startsAt: number;
  endsAt: number | null;
  postedAt: number | null;
  /** A sentence or two: the event's own summary, else the start of its body. */
  summary: string | null;
  /** The event's capsule at 400×225, the size Steam's own lists use. */
  imageUrl: string | null;
  /** The same capsule at the size it was uploaded. */
  imageLargeUrl: string | null;
  /** The event on Steam. */
  url: string;
};

export type SteamEvents = {
  appId: number;
  /** Every post, on Steam. */
  newsUrl: string;
  events: SteamEvent[];
};

/** The endpoint behind a store page's "Recent Events & Announcements". */
export function eventsEndpoint(appId: number, count: number): string {
  return `https://store.steampowered.com/events/ajaxgetpartnereventspageable/?clan_accountid=0&appid=${appId}&offset=0&count=${count}&l=english`;
}

/**
 * The difference between a clan's 64-bit id and its account id, which is what
 * clan images are filed under: 103582791470526475 → 41005067 (Elden Ring's),
 * checked against the image host.
 */
const CLAN_BASE = BigInt('103582791429521408');

const CLAN_IMAGES = 'https://clan.fastly.steamstatic.com/images';

/**
 * The events endpoint's answer as a list of posts, newest first.
 *
 * The same data as the store page's "Recent Events & Announcements" block —
 * which the page fills in from this endpoint, in the browser — and richer than
 * the public `ISteamNews/GetNewsForApp`, which has no images and does not say
 * which posts are events. It is undocumented, so every field is read as
 * optional and an answer of the wrong shape is an empty list.
 */
export function parseEvents(raw: unknown, appId: number, limit = 10): SteamEvents {
  const events: SteamEvent[] = [];
  const list = isRecord(raw) && Array.isArray(raw.events) ? raw.events : [];

  for (const entry of list) {
    if (!isRecord(entry)) continue;
    const id = stringOf(entry.gid);
    const body = isRecord(entry.announcement_body) ? entry.announcement_body : {};
    const title = (stringOf(entry.event_name) ?? stringOf(body.headline) ?? '').trim();
    if (!id || !title) continue;

    const type = numberOf(entry.event_type) ?? 0;
    const startsAt = numberOf(entry.rtime32_start_time) ?? numberOf(body.posttime);
    if (startsAt === null) continue;

    const json = parseJson(entry.jsondata);
    const capsule = firstString(json?.localized_capsule_image);
    const clan = clanAccountOf(entry.clan_steamid);
    const imageLargeUrl = capsule && clan ? `${CLAN_IMAGES}/${clan}/${capsule}` : null;

    const summary =
      firstString(json?.localized_summary) ??
      firstString(json?.localized_subtitle) ??
      excerpt(bbcodeToText(stringOf(body.body) ?? ''), 220);

    events.push({
      id,
      title: decodeEntities(title),
      kind: eventKindOf(type),
      type,
      startsAt,
      endsAt: numberOf(entry.rtime32_end_time),
      postedAt: numberOf(body.posttime),
      summary: summary ? decodeEntities(summary) : null,
      imageUrl: imageLargeUrl ? resized(imageLargeUrl, '_400x225') : null,
      imageLargeUrl,
      url: `https://store.steampowered.com/news/app/${appId}/view/${id}`,
    });
    if (events.length >= limit) break;
  }

  events.sort((a, b) => b.startsAt - a.startsAt);
  return { appId, newsUrl: `https://store.steampowered.com/news/app/${appId}`, events };
}

/** `…/hash.jpg` → `…/hash_400x225.jpg`, the way Steam names a resized clan image. */
function resized(url: string, suffix: string): string {
  return url.replace(/(\.[a-z0-9]+)$/i, `${suffix}$1`);
}

function clanAccountOf(value: unknown): string | null {
  const raw = stringOf(value);
  if (!raw || !/^\d{15,20}$/.test(raw)) return null;
  const account = BigInt(raw) - CLAN_BASE;
  return account > BigInt(0) ? account.toString() : null;
}

/**
 * Steam's BBCode as plain text: tags gone, list items as bullets, escaped
 * brackets kept, images and embeds dropped.
 */
export function bbcodeToText(source: string): string {
  return decodeEntities(
    source
      .replace(/\\\[/g, '\u0000')
      .replace(/\\\]/g, '\u0001')
      .replace(/\[img\b[^\]]*\][\s\S]*?\[\/img\]/gi, ' ')
      .replace(/\[(previewyoutube|video|dynamiclink)\b[^\]]*\][\s\S]*?\[\/\1\]/gi, ' ')
      .replace(/\[\*\]/g, ' • ')
      .replace(/\[\/?(p|h[1-6]|list|olist|tr|table)\b[^\]]*\]/gi, ' ')
      .replace(/\[\/?[a-z*][^\]]*\]/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\u0000/g, '[')
      .replace(/\u0001/g, ']')
  )
    .replace(/\s+/g, ' ')
    .replace(/^(\s*•\s*)+/, '')
    .trim();
}

/** The first `length` characters, ended at a word and marked as cut. */
export function excerpt(text: string, length: number): string | null {
  const trimmed = text.trim();
  if (!trimmed) return null;
  if (trimmed.length <= length) return trimmed;
  const cut = trimmed.slice(0, length);
  const space = cut.lastIndexOf(' ');
  return `${(space > length * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,;:.–-]+$/, '')}…`;
}

// ---------------------------------------------------------------------------
// A little HTML, by hand
// ---------------------------------------------------------------------------

/** Comments, scripts and styles out, so a `<div` inside one cannot be counted. */
function stripInert(html: string): string {
  return html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script\b[\s\S]*?<\/script\s*>/gi, '')
    .replace(/<style\b[\s\S]*?<\/style\s*>/gi, '');
}

/**
 * The element with an id, opening tag to its matching close, or null.
 *
 * Depth is counted over tags of the element's own name, which is all a well-
 * formed page needs; the inert parts are already gone.
 */
export function elementById(html: string, id: string): string | null {
  const escaped = id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const opening = new RegExp(
    `<([a-zA-Z][\\w-]*)\\b[^>]*\\bid\\s*=\\s*(["']?)${escaped}\\2(?=[\\s/>])[^>]*>`,
    'i'
  );
  const found = opening.exec(html);
  if (!found) return null;

  const name = found[1].toLowerCase();
  const start = found.index;
  const tags = new RegExp(`<(/?)${name}\\b[^>]*>`, 'gi');
  tags.lastIndex = start + found[0].length;
  if (/\/>$/.test(found[0])) return found[0];

  let depth = 1;
  for (let tag = tags.exec(html); tag; tag = tags.exec(html)) {
    if (tag[1] === '/') depth -= 1;
    else if (!/\/>$/.test(tag[0])) depth += 1;
    if (depth === 0) return html.slice(start, tag.index + tag[0].length);
  }
  /* Never closed: the rest of the document is the best reading of it. */
  return html.slice(start);
}

/**
 * A tag's attributes, lower-cased names to decoded values.
 *
 * Steam writes them three ways on one page — `class="bb_img"`,
 * `width=800`, `data-big-src=https://…?t=1790290043` — so an unquoted value runs
 * to the next space, `=` and all.
 */
export function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s"'>/=]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    if (name in attributes) continue;
    let value = match[2] ?? match[3] ?? match[4] ?? '';
    if (match[4] !== undefined) value = value.replace(/\/$/, '');
    attributes[name] = decodeEntities(value);
  }
  return attributes;
}

/** Text content: tags out, entities decoded, white space collapsed. */
function textOf(html: string): string {
  return decodeEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const NAMED: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  ndash: '–',
  mdash: '—',
  hellip: '…',
  rsquo: '’',
  lsquo: '‘',
  rdquo: '”',
  ldquo: '“',
};

export function decodeEntities(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, entity: string) => {
    if (entity[0] === '#') {
      const code =
        entity[1] === 'x' || entity[1] === 'X'
          ? parseInt(entity.slice(2), 16)
          : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code < 0x110000
        ? String.fromCodePoint(code)
        : whole;
    }
    return NAMED[entity.toLowerCase()] ?? whole;
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function stringOf(value: unknown): string | null {
  if (typeof value === 'string' && value.length > 0) return value;
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function numberOf(value: unknown): number | null {
  const number = typeof value === 'string' ? Number(value) : value;
  return typeof number === 'number' && Number.isFinite(number) && number > 0 ? number : null;
}

function firstString(value: unknown): string | null {
  if (!Array.isArray(value)) return null;
  const first = value[0];
  return typeof first === 'string' && first.trim() ? first.trim() : null;
}

function parseJson(value: unknown): Record<string, unknown> | null {
  if (isRecord(value)) return value;
  if (typeof value !== 'string' || !value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return isRecord(parsed) ? parsed : null;
  } catch {
    return null;
  }
}
