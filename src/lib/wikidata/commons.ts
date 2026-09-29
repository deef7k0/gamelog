import { WikidataProperty } from '../../constants/wikidata';
import { isRecord, statementsOf, stringOf, unique, type WikidataClaims } from './claims';

/**
 * Wikimedia Commons files, and whether one may be shown as a studio's logo.
 *
 * ## The rule, and it is never reversed
 *
 * A logo is displayed only when Commons' **machine-readable** licence says it
 * is in the public domain or dedicated to it with CC0. Anything else — CC BY,
 * CC BY-SA, "no known copyright restrictions", fair use, a missing or
 * contradictory field — is not a logo, and the studio page prints the studio's
 * name instead. The app gives up a logo rather than show one whose reuse status
 * is unclear.
 *
 * What is read, all from `extmetadata`, all verified against the live API:
 *
 *  - `License` — the licence *template's* code, not prose. Public-domain files
 *    (PD-textlogo, PD-old, PD-mark…) say `pd`; CC0 says `cc0`; CC BY-SA 4.0 says
 *    `cc-by-sa-4.0`. "No known copyright restrictions" has no code at all, and a
 *    fair-use upload on English Wikipedia has none either. **This is the field
 *    the allowlist is on.**
 *  - `Copyrighted` — `False` on a public-domain file. A `pd` code with
 *    `Copyrighted: True` contradicts itself and is rejected. CC0 legitimately
 *    says `True`: the waiver is the rights holder's.
 *  - `LicenseShortName` / `LicenseUrl` — must agree with the code.
 *  - `NonFree` — present only on non-free uploads; rejected outright. Commons
 *    accepts no non-free files, so this should never fire, and is checked
 *    anyway.
 *
 * Titles, descriptions and file names are **never** read as licence evidence.
 *
 * Pure, and covered by `npm test`.
 */

export type StudioLogoLicense = 'public-domain' | 'cc0';

/** A verified logo. Anything short of verified is `null`, never a guess. */
export type StudioLogo = {
  /** A PNG render on Wikimedia's media host — Commons rasterises SVGs, keeping transparency. */
  url: string;
  width: number;
  height: number;
  source: 'wikimedia-commons';
  license: StudioLogoLicense;
  /** Commons' own name for it: "Public domain", "CC0". */
  licenseName: string;
  /** The file's page on Commons, where the licence can be audited. */
  sourcePage: string | null;
  fileName: string;
  /** Kept although the UI shows no credit: PD and CC0 do not require one, and this says so. */
  attributionRequired: boolean;
  /** Plain text, stripped of Commons' HTML. For audit; not displayed. */
  artist: string | null;
  credit: string | null;
  /** Usually "trademarked": a public-domain logo is still somebody's mark. */
  restrictions: string | null;
  /** Mean luminance of its opaque pixels, measured on device; null until then or on the web. */
  luminance: number | null;
};

/** One file page from `prop=imageinfo`, narrowed to what the checks read. */
export type CommonsFile = {
  /** "File:Valve logo.svg" */
  title: string;
  mime: string;
  thumbUrl: string | null;
  thumbWidth: number;
  thumbHeight: number;
  sourcePage: string | null;
  /** `extmetadata`, each field's `value` as text. */
  metadata: Readonly<Record<string, string>>;
  /** From `extmetadata.Categories`, without the "Category:" prefix. */
  categories: string[];
};

/** Formats the page can draw; the first four keep transparency. */
const TRANSPARENT_MIMES = new Set(['image/svg+xml', 'image/png', 'image/webp', 'image/gif']);
const DRAWABLE_MIMES = new Set([...TRANSPARENT_MIMES, 'image/jpeg']);

/** Where a Commons image may be loaded from. Nothing else returned by the API is trusted. */
const MEDIA_HOSTS = new Set(['upload.wikimedia.org', 'thumb.wikimedia.org']);

/** The `extmetadata` fields a request needs — `iiextmetadatafilter`. */
export const EXTMETADATA_FIELDS = [
  'License',
  'LicenseShortName',
  'LicenseUrl',
  'UsageTerms',
  'Copyrighted',
  'NonFree',
  'AttributionRequired',
  'Restrictions',
  'Artist',
  'Credit',
  'Categories',
].join('|');

// ---------------------------------------------------------------------------
// The licence
// ---------------------------------------------------------------------------

export type VerifiedLicense = {
  license: StudioLogoLicense;
  licenseName: string;
  attributionRequired: boolean;
};

const isTrue = (value: string | undefined) => value?.trim().toLowerCase() === 'true';
const isFalse = (value: string | undefined) => value?.trim().toLowerCase() === 'false';

/**
 * The licence, if — and only if — Commons' machine-readable metadata says the
 * file is public domain or CC0. See the module comment for what each field
 * contributes.
 */
export function verifyLicense(metadata: Readonly<Record<string, string>>): VerifiedLicense | null {
  if (isTrue(metadata.NonFree)) return null;

  const code = metadata.License?.trim().toLowerCase();
  if (!code) return null;

  const shortName = metadata.LicenseShortName?.trim() ?? '';
  const attributionRequired = isTrue(metadata.AttributionRequired);

  if (code === 'pd') {
    if (!isFalse(metadata.Copyrighted)) return null;
    if (!/public domain/i.test(shortName)) return null;
    return { license: 'public-domain', licenseName: shortName, attributionRequired };
  }

  if (code === 'cc0') {
    const url = metadata.LicenseUrl?.trim() ?? '';
    const saysCc0 =
      /^cc0\b/i.test(shortName) || /creativecommons\.org\/publicdomain\/zero\//i.test(url);
    if (!saysCc0) return null;
    return { license: 'cc0', licenseName: shortName || 'CC0', attributionRequired };
  }

  /* cc-by-*, cc-by-sa-*, gfdl, and every other code: free, perhaps, but not
     public domain. A separate, explicit feature if it is ever wanted. */
  return null;
}

/** The yes/no form of `verifyLicense`, for readers who want only the verdict. */
export function isPublicDomainLogo(metadata: Readonly<Record<string, string>>): boolean {
  return verifyLicense(metadata) !== null;
}

// ---------------------------------------------------------------------------
// Reading the API
// ---------------------------------------------------------------------------

/**
 * An image URL, if it is on Wikimedia's own media host over HTTPS — with the
 * `utm_*` tracking Commons appends taken off. Anything else is refused: a URL
 * from an external API is not trusted just because the API returned it.
 */
export function mediaUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const match = /^https:\/\/([a-z0-9.-]+)(\/[^?#\s]*)(?:\?([^#\s]*))?$/i.exec(value.trim());
  if (!match) return null;
  const host = match[1].toLowerCase();
  if (!MEDIA_HOSTS.has(host)) return null;
  const query = (match[3] ?? '').split('&').filter((part) => part && !/^utm_/i.test(part));
  return `https://${host}${match[2]}${query.length > 0 ? `?${query.join('&')}` : ''}`;
}

function pageUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  return /^https:\/\/commons\.wikimedia\.org\/wiki\/File:[^\s]+$/i.test(value.trim())
    ? value.trim()
    : null;
}

/** Commons' HTML (links, hidden spans) as plain text, for the audit fields. */
export function plainText(value: string | undefined): string | null {
  if (!value) return null;
  const text = value
    .replace(/<span[^>]*display:\s*none[^>]*>[\s\S]*?<\/span>/gi, '')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
  return text || null;
}

/** One `query.pages` entry, or null when it is missing, not a file, or malformed. */
export function readCommonsFile(page: unknown): CommonsFile | null {
  if (!isRecord(page) || 'missing' in page || typeof page.title !== 'string') return null;
  const info = Array.isArray(page.imageinfo) ? page.imageinfo[0] : undefined;
  if (!isRecord(info)) return null;

  const metadata: Record<string, string> = {};
  if (isRecord(info.extmetadata)) {
    for (const [key, field] of Object.entries(info.extmetadata)) {
      if (isRecord(field) && (typeof field.value === 'string' || typeof field.value === 'number')) {
        metadata[key] = String(field.value);
      }
    }
  }

  const number = (value: unknown) => (typeof value === 'number' && value > 0 ? value : 0);
  return {
    title: page.title,
    mime: typeof info.mime === 'string' ? info.mime.toLowerCase() : '',
    thumbUrl: mediaUrl(info.thumburl),
    thumbWidth: number(info.thumbwidth),
    thumbHeight: number(info.thumbheight),
    sourcePage: pageUrl(info.descriptionurl),
    metadata,
    categories: (metadata.Categories ?? '')
      .split('|')
      .map((category) => category.trim())
      .filter(Boolean),
  };
}

// ---------------------------------------------------------------------------
// Choosing
// ---------------------------------------------------------------------------

/**
 * A studio's current logo files, from its Wikidata item's P154 (logo image).
 *
 * Wikidata's best rank — the preferred statements when there are any — and
 * never one with an end time: Mojang Studios keeps its 2011 and 2013 wordmarks
 * beside the current one, marked with P582, and a retired logo is not the
 * studio's logo. Returned in Wikidata's order.
 */
export function logoFileNames(claims: WikidataClaims): string[] {
  const current = statementsOf(claims, WikidataProperty.logoImage).filter((statement) => {
    const ended = statement.qualifiers[WikidataProperty.endTime];
    return !(Array.isArray(ended) && ended.length > 0);
  });
  const preferred = current.filter((statement) => statement.rank === 'preferred');
  const best = preferred.length > 0 ? preferred : current;
  return unique(
    best.map((statement) => stringOf(statement.mainsnak)).filter((name): name is string => !!name)
  );
}

/**
 * The first file that is drawable, loadable from Wikimedia's host and verified
 * public domain or CC0 — preferring a transparent format when there is a choice,
 * since a JPEG logo arrives as a white rectangle.
 */
export function pickVerifiedLogo(files: readonly CommonsFile[]): StudioLogo | null {
  const usable = files
    .map((file) => ({ file, license: verifyLicense(file.metadata) }))
    .filter(
      (entry): entry is { file: CommonsFile & { thumbUrl: string }; license: VerifiedLicense } =>
        entry.license !== null &&
        entry.file.thumbUrl !== null &&
        entry.file.thumbWidth > 0 &&
        entry.file.thumbHeight > 0 &&
        DRAWABLE_MIMES.has(entry.file.mime)
    );

  const chosen = usable.find((entry) => TRANSPARENT_MIMES.has(entry.file.mime)) ?? usable[0];
  if (!chosen) return null;

  const { file, license } = chosen;
  return {
    url: file.thumbUrl,
    width: file.thumbWidth,
    height: file.thumbHeight,
    source: 'wikimedia-commons',
    license: license.license,
    licenseName: license.licenseName,
    sourcePage: file.sourcePage,
    fileName: file.title.replace(/^File:/i, ''),
    attributionRequired: license.attributionRequired,
    artist: plainText(file.metadata.Artist),
    credit: plainText(file.metadata.Credit),
    restrictions: plainText(file.metadata.Restrictions),
    luminance: null,
  };
}

// ---------------------------------------------------------------------------
// Names
// ---------------------------------------------------------------------------

/**
 * A name reduced to lower-case words: punctuation and spacing gone, letters of
 * any script kept. "Valve, L.L.C." → "valve l l c"; "Supergiant Games" →
 * "supergiant games". Hand-rolled rather than `normalize()` and `\p{…}`, neither
 * of which Hermes promises.
 */
export function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[\s.,:;!?'"’‘`´()[\]{}<>|\\/_+*#@&=~^%$–—-]+/g, ' ')
    .trim();
}

/** Whether two names are the same once normalised. Empty never matches. */
export function namesMatch(a: string, b: string): boolean {
  const left = normalizeName(a);
  return left !== '' && left === normalizeName(b);
}

const hasPhrase = (haystack: string, phrase: string) => ` ${haystack} `.includes(` ${phrase} `);

/** The words that make a title a logo's. */
const LOGO_WORDS = new Set(['logo', 'logos', 'logotype', 'wordmark', 'textlogo']);

/**
 * Words a logo's title may carry besides the studio's name without naming
 * something else: a variant, a colour, a legal suffix. "Mojang Studios Logo
 * (2020, wide)", "Supergiant Games logo 2color", "Valve old logo". A word
 * outside this list — "Index", "Switch", "Interactive" — is a product or a
 * different company, and the file is not the studio's logo.
 */
const LOGO_MODIFIERS = new Set([
  'old',
  'new',
  'current',
  'original',
  'wide',
  'horizontal',
  'vertical',
  'stacked',
  'full',
  'simple',
  'small',
  'large',
  'alt',
  'alternate',
  'alternative',
  'variant',
  'version',
  'text',
  'black',
  'white',
  'color',
  'colour',
  'colored',
  'coloured',
  'monochrome',
  'inverted',
  'transparent',
  'corporation',
  'corp',
  'inc',
  'incorporated',
  'ltd',
  'limited',
  'llc',
  'co',
  'gmbh',
  'ag',
  'sa',
  'plc',
  'kk',
]);

/** Years, "2color", "v2": numbered variants. */
const NUMBERED = /^(\d+[a-z]*|v\d+)$/;

/**
 * Whether a file found by *searching* Commons can be taken as this studio's
 * logo. Two independent checks, both on whole words so "Valve" never matches
 * "Valves":
 *
 *  - **the title is the studio's name and "logo", and nothing that names
 *    something else** — every other word must be a variant, a colour, a year
 *    or a legal suffix (`LOGO_MODIFIERS`). This is the check that caught a real
 *    false positive: searching "Valve" returned "Valve Index logo.svg", the
 *    logo of Valve's headset, filed under "Valve Corporation logos";
 *  - one of its categories names the studio *and* is a logos category —
 *    Commons files studio logos under "<Studio> logos". A photograph of a
 *    mechanical valve is in "Valves"; the Steam logo is titled "Steam".
 *
 * Files found through the studio's own Wikidata item skip this: the item says
 * which file is its logo, which is stronger than any match on words.
 */
export function isStudioLogoFile(file: CommonsFile, studioName: string): boolean {
  const name = normalizeName(studioName);
  if (!name) return false;

  const title = normalizeName(file.title.replace(/^File:/i, '').replace(/\.[a-z0-9]+$/i, ''));
  if (!hasPhrase(title, name)) return false;

  const rest = ` ${title} `.replace(` ${name} `, ' ').trim().split(' ').filter(Boolean);
  if (!rest.some((word) => LOGO_WORDS.has(word))) return false;
  if (
    !rest.every((word) => LOGO_WORDS.has(word) || LOGO_MODIFIERS.has(word) || NUMBERED.test(word))
  ) {
    return false;
  }

  return file.categories.some((category) => {
    const normalised = normalizeName(category);
    return hasPhrase(normalised, name) && /(^| )logos?( |$)/.test(normalised);
  });
}

/**
 * Searched logo files, current ones first: a title that says "old" is the
 * studio's previous mark. Stable, so search relevance decides everything else.
 * Searching Commons for "Valve" ranks "Valve old logo.svg" above the current
 * one; Wikidata's route never needs this, since P154 already marks the current
 * logo.
 */
export function currentLogosFirst(files: readonly CommonsFile[]): CommonsFile[] {
  const isOld = (file: CommonsFile) =>
    / old /.test(` ${normalizeName(file.title.replace(/^File:/i, ''))} `);
  return [...files.filter((file) => !isOld(file)), ...files.filter(isOld)];
}
