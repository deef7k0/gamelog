/**
 * Home's moods: SimpMusic's ten, translated from songs to games.
 *
 * ## How SimpMusic knows which songs fit a mood
 *
 * It does not decide. Its Mood chip (`HomeScreen.kt`'s `homeMoods`) holds ten
 * opaque `params` strings, and choosing one reloads Home by sending that string
 * to YouTube Music's own home feed (`browse` on `FEmusic_home`,
 * `HomeRepositoryImpl.getHomeData`). Decoded, each string is a protobuf list of
 * YouTube's ten home filter chips — `{chip: 7, state: 3}` for Relax, the other
 * nine at `state: 1` — so the choice is YouTube's "Relax" chip, pressed. What
 * comes back is whatever YouTube Music's servers rank for that chip: a strapline
 * naming the mood over its first shelf ("FOR RELAXING" / "Unwind + explore"),
 * five to ten themed shelves of playlists ("Chilled", "Coffee shop blends",
 * "Deep focus"), a four-row "Quick picks" grid of songs somewhere among them, and
 * — signed in — shelves headed by an artist's round picture. Read off the live
 * API for all ten chips on 2026-10-22. The classifier is YouTube's and is not
 * published; SimpMusic only draws its answer.
 *
 * ## How GameLog does
 *
 * There is no YouTube for games. What IGDB has is a description of every game —
 * genres, themes, modes, perspectives and, most usefully, *keywords* written by
 * its editors ("relaxing", "cozy", "fast paced", "emotional", "couch co-op") —
 * and a `where` clause can ask for any of them. So each mood is a set of shelves,
 * and **each shelf is a clause**: what YouTube's ranker answers for a chip is
 * written down here, one sub-mood at a time, in the vocabulary IGDB already
 * keeps. Every clause was run against the live catalogue (through the deployed
 * `igdb` function) and tightened where it caught the wrong games — "farming"
 * alone is Demon's Souls and Rome: Total War, "fitness" alone is GTA, IGDB's
 * "Tactical" genre is Metal Gear and Call of Duty, its "Quiz/Trivia" is
 * Banjo-Kazooie. Calm moods shut out horror, thrillers, war and fighting
 * (`CALM`); nothing anywhere is IGDB's Erotic theme (`MOOD_FLOOR`).
 *
 * The names are SimpMusic's, in SimpMusic's order, except one: its "Sleep" is
 * music to fall asleep to, which a game is not, so the same slot is "Wind down".
 * Straplines are YouTube's own where it has one for that chip.
 *
 * Pure: no imports from React Native or the network, so `npm test` holds the
 * vocabulary to its rules (`moods.test.ts`). `mood-feed.ts` sends it.
 */

/** The ten, in SimpMusic's order (`homeMoods`). */
export const MOOD_KEYS = [
  'relax',
  'sleep',
  'energize',
  'sad',
  'romance',
  'feelgood',
  'workout',
  'party',
  'commute',
  'focus',
] as const;

export type MoodKey = (typeof MOOD_KEYS)[number];

/**
 * A themed row of a feed: its heading, and the IGDB clause that fills it.
 *
 * A mood's shelves are all the most-rated games of their clause on the rated
 * floor; a genre's are not — "New releases" is newest first and asks for no
 * ratings yet — so a shelf may name its own order and floor. A clause may say
 * `@now` or `@now-120d`: the clock, read when the request is made
 * (`atClock`), never while the page renders.
 */
export type FeedShelf = {
  key: string;
  title: string;
  where: string;
  /** IGDB's `sort`; the most-rated first unless it says otherwise. */
  sort?: string;
  /** The floor it stands on; `MOOD_FLOOR` unless it says otherwise. */
  floor?: string;
};

/**
 * One thing Home can show besides All: a mood, or a genre (`genre-feed.ts`).
 * Its shelves, the strapline over the first, and what its Quick picks and
 * its studio are drawn from.
 */
export type HomeFeed = {
  /** Unique across moods and genres — it is the feed's query key. */
  id: string;
  /** The chip's word. */
  label: string;
  /** The small capitals over the first shelf: YouTube's "FOR RELAXING". */
  strapline: string;
  /** First is the lead: the shelf the strapline heads and the glow is taken from. */
  shelves: readonly FeedShelf[];
  /** The feed as one pool, for Quick picks and the studio; any of its shelves when omitted. */
  pool?: string;
};

/** One of the app's identity hues, by token name — the mood's stripe on its tile. */
export type MoodHue =
  | 'identityEmber'
  | 'identityCrimson'
  | 'identityGold'
  | 'identityLime'
  | 'identityJade'
  | 'identityAqua'
  | 'identitySky'
  | 'identityCobalt'
  | 'identityViolet'
  | 'identityMagenta';

export type Mood = HomeFeed & {
  key: MoodKey;
  /** The tile's stripe in "Let's pick a mood" — SimpMusic's `stripeColor`. */
  hue: MoodHue;
};

/**
 * IGDB's keywords "nudity" (1961), "sexual content" (3586) and "sexual themes"
 * (26306), read off the live catalogue. Nekopara carries the first two and not
 * the Erotic theme, so the theme alone does not keep it off a romance shelf.
 */
export const ADULT_KEYWORDS: readonly number[] = [1961, 3586, 26306];

/**
 * What a game has to be to stand on any mood's shelf: a game rather than an
 * edition, DLC or bundle (the platform pages' definition, less mods and
 * episodes), with a cover, never IGDB's Erotic theme (42) nor its keywords for
 * nudity and sexual content (`ADULT_KEYWORDS`), and rated — by enough people,
 * well enough — that a shelf of ten is ten worth opening.
 *
 * Both exclusions are `!= (…)` on an **id** list, which is "contains none of"
 * and keeps a game with no themes or keywords at all (checked live: 8,965 of
 * 9,001 rated games pass the theme, 8,780 the keywords). Never write it on
 * `keywords.name`: a dotted field's `!=` is "has some keyword not in the list",
 * which let Nekopara through.
 */
export const BASIC_FLOOR = `version_parent = null & game_type = (0,8,9) & cover != null & themes != (42) & keywords != (${ADULT_KEYWORDS.join(',')})`;

/** `BASIC_FLOOR`, and rated: by fifteen people at least, at 70 or more. */
export const MOOD_FLOOR = `${BASIC_FLOOR} & total_rating_count >= 15 & total_rating >= 70`;

/**
 * Quick picks ask more of a game: they are ranked by score, not by reach, and a
 * score of 95 from forty people put "American Chopper" and "Club Penguin" at
 * the top of two moods. A hundred ratings is a game people know.
 */
export const QUICK_PICKS_FLOOR = 'total_rating_count >= 100';

/** No horror, thriller, war or action theme; no fighting, shooter or hack-and-slash. */
const CALM = 'themes != (1,19,20,39) & genres != (4,5,25)';

const MOOD_LIST: readonly Omit<Mood, 'id'>[] = [
  {
    key: 'relax',
    label: 'Relax',
    strapline: 'FOR RELAXING',
    hue: 'identityAqua',
    shelves: [
      {
        key: 'unwind',
        title: 'Unwind + explore',
        where: `keywords.name = ("relaxing","cozy") & ${CALM}`,
      },
      {
        key: 'cozy',
        title: 'Cozy life',
        where:
          'genres = (13) & keywords.name = ("cozy","wholesome","life simulation","life sim") & themes != (1,19,20,39,41)',
      },
      {
        key: 'wander',
        title: 'Wander and wonder',
        where: 'keywords.name = "walking simulator" & themes != (19,20,39)',
      },
      {
        key: 'puzzles',
        title: 'Gentle puzzles',
        where:
          'genres = (9) & keywords.name = ("relaxing","cozy","wholesome","cute","colorful") & themes != (19,20,39)',
      },
      {
        key: 'build',
        title: 'Build at your own pace',
        where: 'keywords.name = "city builder" & themes != (19,20,21,39,41) & genres != (11)',
      },
    ],
  },
  {
    key: 'sleep',
    label: 'Wind down',
    strapline: 'BEFORE YOU SLEEP',
    hue: 'identityCobalt',
    shelves: [
      { key: 'bedtime', title: 'Peaceful bedtime', where: `keywords.name = "short" & ${CALM}` },
      { key: 'stories', title: 'Quiet stories', where: 'genres = (2,34) & themes != (1,19,20,39)' },
      {
        key: 'softlit',
        title: 'Soft-lit worlds',
        where: `keywords.name = "atmospheric" & ${CALM}`,
      },
      {
        key: 'nothing-to-lose',
        title: 'Nothing to lose',
        where:
          'keywords.name = ("walking simulator","non-violent","pacifist","no combat") & themes != (19,20,39)',
      },
    ],
  },
  {
    key: 'energize',
    label: 'Energize',
    strapline: 'BOOSTING YOUR ENERGY',
    hue: 'identityEmber',
    shelves: [
      { key: 'boost', title: 'Power boost', where: 'keywords.name = "fast paced" & genres != (5)' },
      { key: 'bullet-hell', title: 'Bullet hell', where: 'keywords.name = "bullet hell"' },
      {
        key: 'rip-and-tear',
        title: 'Rip and tear',
        where: 'genres = (5) & keywords.name = ("fast paced","arena shooter") & themes != (39)',
      },
      {
        key: 'hard',
        title: 'Hard and fast',
        where: 'keywords.name = "difficult" & genres = (8,25)',
      },
      { key: 'throttle', title: 'Full throttle', where: 'genres = (10) & genres != (5,12,31)' },
    ],
  },
  {
    key: 'sad',
    label: 'Sad',
    strapline: 'FOR FEELING IT',
    hue: 'identitySky',
    shelves: [
      {
        key: 'cry',
        title: 'Have a good cry',
        where: 'keywords.name = "emotional" & themes != (19,39) & genres != (4,5)',
      },
      {
        key: 'stay',
        title: 'Stories that stay',
        where: 'themes = (31) & keywords.name = "story rich"',
      },
      {
        key: 'alone',
        title: 'Alone out there',
        where:
          'keywords.name = ("loneliness","isolation","melancholy","solitude") & themes != (19,20)',
      },
      {
        key: 'heavy',
        title: 'Heavy hearts',
        where:
          'themes = (31) & keywords.name = ("death","grief","loss","tragedy") & themes != (19)',
      },
    ],
  },
  {
    key: 'romance',
    label: 'Romance',
    strapline: 'FOR THE ROMANTIC',
    hue: 'identityCrimson',
    shelves: [
      {
        key: 'sweethearts',
        title: 'Sweethearts & romance',
        where: 'themes = (44) & themes != (19)',
      },
      {
        key: 'party',
        title: 'Romance your party',
        where: 'themes = (44) & genres = (12) & themes != (19,20)',
      },
      {
        key: 'hopeless',
        title: 'Hopeless romantic',
        where: 'themes = (44) & genres = (2,34) & themes != (19)',
      },
      {
        key: 'dating',
        title: 'Love on the side',
        where: 'keywords.name = ("dating sim","dating","relationships") & themes != (19)',
      },
    ],
  },
  {
    key: 'feelgood',
    label: 'Feel good',
    strapline: 'FOR FEELING GOOD',
    hue: 'identityGold',
    shelves: [
      {
        key: 'happy',
        title: 'Feeling happy',
        where: 'keywords.name = ("wholesome","cute") & themes != (1,19,20,39)',
      },
      { key: 'funny', title: 'Laugh out loud', where: 'keywords.name = "funny" & themes != (19)' },
      {
        key: 'joy',
        title: 'Pure joy',
        where: 'genres = (8) & keywords.name = ("colorful","cute")',
      },
      { key: 'everyone', title: 'Fun for everyone', where: 'keywords.name = "family friendly"' },
    ],
  },
  {
    key: 'workout',
    label: 'Workout',
    strapline: 'FOR YOUR WORKOUT',
    hue: 'identityLime',
    shelves: [
      {
        key: 'move',
        title: 'Get moving',
        where:
          'keywords.name = ("fitness","exercise","motion control") & genres = (7,14) & genres != (10)',
      },
      {
        key: 'dance',
        title: 'Dance it out',
        where: 'genres = (7) & keywords.name = ("dance","dancing")',
      },
      { key: 'beat', title: 'On the beat', where: 'genres = (7)' },
      {
        key: 'vr',
        title: 'Sweat in VR',
        where: 'player_perspectives = (7) & genres = (7,14) & genres != (10)',
      },
      {
        key: 'sport',
        title: 'Game on',
        where: 'genres = (14) & game_modes = (2,4) & genres != (10)',
      },
    ],
  },
  {
    key: 'party',
    label: 'Party',
    strapline: 'FOR THE PARTY',
    hue: 'identityMagenta',
    shelves: [
      { key: 'party', title: 'Party games', where: 'themes = (40)' },
      {
        key: 'couch',
        title: 'Couch co-op',
        where: 'keywords.name = ("couch co-op","local multiplayer")',
      },
      { key: 'fight', title: 'Fight night', where: 'genres = (4) & game_modes = (2,4)' },
      { key: 'game-night', title: 'Game night', where: 'genres = (26,35) & themes = (40)' },
      { key: 'race', title: 'Race your friends', where: 'genres = (10) & game_modes = (4)' },
    ],
  },
  {
    key: 'commute',
    label: 'Commute',
    strapline: 'FOR THE COMMUTE',
    hue: 'identityJade',
    shelves: [
      {
        key: 'quick',
        title: 'Quick sessions',
        where:
          'platforms = (34,39,130) & keywords.name = ("short","casual","high score","roguelike","roguelite") & genres = (9,32,33,35)',
      },
      {
        key: 'pocket',
        title: 'Pocket puzzles',
        where: 'genres = (9) & platforms = (34,39) & genres != (5,12,31)',
      },
      { key: 'run', title: 'One more run', where: 'keywords.name = ("roguelike","roguelite")' },
      { key: 'cards', title: 'Deal me in', where: 'genres = (35)' },
      {
        key: 'handheld',
        title: 'Handheld classics',
        where: 'platforms = (20,22,24,33,37,38,46) & platforms != (6,9,12,14,48,49,130,167,169)',
      },
    ],
  },
  {
    key: 'focus',
    label: 'Focus',
    strapline: 'STAYING FOCUSED',
    hue: 'identityViolet',
    shelves: [
      { key: 'flow', title: 'Flow state', where: 'genres = (16) & genres != (12)' },
      { key: 'tactics', title: 'Think in turns', where: 'genres = [16,24]' },
      {
        key: 'teasers',
        title: 'Brain teasers',
        where: 'genres = (9) & keywords.name = ("difficult","logic","brain teaser")',
      },
      {
        key: 'manage',
        title: 'Run the show',
        where: 'keywords.name = ("management","city builder") & genres = (13) & themes != (1,39)',
      },
      {
        key: 'case',
        title: 'Solve the case',
        where: 'themes = (43) & genres = (2,34) & themes != (1,19)',
      },
      { key: 'four-x', title: 'One more turn', where: 'themes = (41)' },
    ],
  },
];

export const MOODS: readonly Mood[] = MOOD_LIST.map((mood) => ({
  ...mood,
  id: `mood:${mood.key}`,
}));

export function isMoodKey(value: unknown): value is MoodKey {
  return typeof value === 'string' && (MOOD_KEYS as readonly string[]).includes(value);
}

export function moodFor(key: MoodKey): Mood {
  return MOODS.find((mood) => mood.key === key)!;
}

/** Seconds in a day, for `@now-120d`. */
const DAY = 86_400;

/**
 * A clause with the clock in it: `@now` is `now` in Unix seconds and
 * `@now-120d` that many days before. Read when the request is made.
 */
export function atClock(where: string, nowSeconds: number): string {
  return where.replace(/@now(?:-(\d+)d)?/g, (_, days?: string) =>
    String(Math.floor(nowSeconds) - (days ? Number(days) * DAY : 0))
  );
}

/** One shelf's clause, on its floor. */
export function shelfWhere(shelf: Pick<FeedShelf, 'where' | 'floor'>): string {
  return `(${shelf.where}) & ${shelf.floor ?? MOOD_FLOOR}`;
}

/** The order a shelf's games come in. */
export function shelfSort(shelf: Pick<FeedShelf, 'sort'>): string {
  return shelf.sort ?? 'total_rating_count desc';
}

/** The feed as one pool, on the rated floor — its `pool`, or any of its shelves. */
export function moodWhere(feed: Pick<HomeFeed, 'shelves' | 'pool'>): string {
  const any = feed.pool ?? feed.shelves.map((shelf) => `(${shelf.where})`).join(' | ');
  return `(${any}) & ${MOOD_FLOOR}`;
}

/** The pool Quick picks are ranked from: the whole feed, among games more people rated. */
export function quickPicksWhere(feed: Pick<HomeFeed, 'shelves' | 'pool'>): string {
  return `${moodWhere(feed)} & ${QUICK_PICKS_FLOOR}`;
}

/** How many games a shelf shows — YouTube's shelves run to ten. */
export const SHELF_SIZE = 10;
/** A shelf with fewer than this left after the ones above it is dropped: YouTube's smallest were three or four. */
export const SHELF_MIN = 4;
/** How many each shelf asks IGDB for, so it still has ten once the shelves above have taken theirs. */
export const SHELF_FETCH = 18;

type Titled = { id: string; title: string };

/**
 * What makes two entries the same game on a shelf: the id, or the name. A
 * remake that kept its name is its own IGDB game (`game_type` 8), and Shadow of
 * the Colossus twice in one row of Quick picks reads as a bug.
 */
function sameGameKeys(game: Titled): string[] {
  return [`id:${game.id}`, `name:${game.title.trim().toLowerCase()}`];
}

/**
 * The shelves in order, each without a game a shelf above it already shows.
 *
 * YouTube never puts one playlist on two shelves of a feed, and a mood's
 * clauses overlap by design (Stardew Valley is relaxing *and* cozy *and* a
 * romance). Each shelf keeps its own order and is cut to `size`; one left with
 * fewer than `min` is emptied, and the caller draws nothing for it.
 */
export function distinctShelves<T extends Titled>(
  shelves: readonly (readonly T[])[],
  size = SHELF_SIZE,
  min = SHELF_MIN
): T[][] {
  const seen = new Set<string>();
  return shelves.map((games) => {
    const kept: T[] = [];
    const here = new Set<string>();
    for (const game of games) {
      if (kept.length >= size) break;
      const keys = sameGameKeys(game);
      if (keys.some((key) => seen.has(key) || here.has(key))) continue;
      kept.push(game);
      for (const key of keys) here.add(key);
    }
    if (kept.length < min) return [];
    for (const key of here) seen.add(key);
    return kept;
  });
}

/** How many games Quick picks shows: SimpMusic's grid is four rows, five columns of them here. */
export const QUICK_PICKS_SIZE = 20;

/**
 * Quick picks without the games this person has already logged — the one
 * personal thing a mood has. YouTube's Quick picks are the signed-in listener's
 * own; here the catalogue is everyone's, so what makes it yours is what it
 * leaves out.
 */
export function quickPicksFor<T extends Titled>(
  games: readonly T[],
  logged: ReadonlySet<string>,
  size = QUICK_PICKS_SIZE
): T[] {
  const unlogged = games.filter((game) => !logged.has(game.id));
  return distinctShelves([unlogged], size, 0)[0];
}

/** An IGDB game's credits, as the studio tally asks for them. */
export type CreditRow = {
  id: number;
  involved_companies?: { developer?: boolean; company?: number }[];
};

/** A studio has to have made at least this many of a mood's games to head a shelf. */
export const STUDIO_MIN_GAMES = 3;

/**
 * The studio that made the most of a mood's games, and which of them — the
 * shelf headed by a round picture that YouTube gives an artist.
 *
 * Developers only: a publisher is on everything it sells ("Nintendo" would win
 * every mood), and the artist of a record is the one who made it. A game counts
 * once per studio however many credit rows name it. Ties go to the studio whose
 * games come first in `rows`, which arrive most-rated first — the better-known
 * studio. Null when nobody made `STUDIO_MIN_GAMES`.
 */
export function moodStudio(
  rows: readonly CreditRow[],
  minGames = STUDIO_MIN_GAMES
): { companyId: number; gameIds: number[] } | null {
  const games = new Map<number, number[]>();
  for (const row of rows) {
    const makers = new Set<number>();
    for (const credit of row.involved_companies ?? []) {
      if (credit.developer && typeof credit.company === 'number') makers.add(credit.company);
    }
    for (const company of makers) {
      const list = games.get(company) ?? [];
      list.push(row.id);
      games.set(company, list);
    }
  }

  let best: { companyId: number; gameIds: number[] } | null = null;
  for (const [companyId, gameIds] of games) {
    if (gameIds.length < minGames) continue;
    if (!best || gameIds.length > best.gameIds.length) best = { companyId, gameIds };
  }
  return best;
}
