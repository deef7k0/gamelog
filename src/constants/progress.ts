import type Ionicons from '@expo/vector-icons/Ionicons';

import type { CompletionLevel, GameLog, LogStatus } from '@/lib/database.types';

/**
 * How far someone got, in the words a player uses (0023).
 *
 * The database stores a level; this is what each level is called and what it
 * means. The three are ordered — `story` < `main` < `full` — and
 * `public.completion_rank()` is the same order in SQL.
 */
export const COMPLETION_LEVELS: readonly CompletionLevel[] = ['story', 'main', 'full'];

export const COMPLETION_LABEL: Record<CompletionLevel, string> = {
  story: 'Story',
  main: 'Main + extras',
  full: '100%',
};

/** The sentence under each level wherever there is room for one. */
export const COMPLETION_HINT: Record<CompletionLevel, string> = {
  story: 'The credits rolled',
  main: 'The story and the main side content',
  full: 'Everything the game has to do',
};

/**
 * The seven answers to "where are you with this game?".
 *
 * ## Why seven choices over two columns
 *
 * Underneath, a log is a **status** (want to play, playing, paused, played,
 * dropped) and a **completion level** (story, main, full) — two independent
 * facts, because a game can be paused after its credits. But nobody thinks of
 * their progress as a pair. They think "I finished it" or "I 100%'d it", and
 * the progress sheet has to answer in one tap, so each choice here is a named
 * pair and the sheet is a single list.
 *
 * `completed` covers both `story` and `main`: which of the two is a detail the
 * sheet asks for underneath, once you have said you finished it. Offering both as
 * top-level choices would put three near-synonyms in a row of seven.
 *
 * "Abandoned" and "Dropped" are one choice. They mean the same thing, and two
 * words for one state is exactly the drift the condition scale in
 * `constants/physical.ts` is built to avoid.
 */
export type ProgressChoice =
  'backlog' | 'playing' | 'paused' | 'played' | 'completed' | 'full' | 'dropped';

export type ProgressChoiceMeta = {
  key: ProgressChoice;
  label: string;
  /** One line under the label on the sheet. */
  hint: string;
  status: LogStatus;
  icon: keyof typeof Ionicons.glyphMap;
  /** The same glyph, outlined — for places that draw off and on states. */
  outline: keyof typeof Ionicons.glyphMap;
};

export const PROGRESS_CHOICES: readonly ProgressChoiceMeta[] = [
  {
    key: 'backlog',
    label: 'Want to play',
    hint: 'On the list',
    status: 'backlog',
    /* Not the bookmark `STATUS_ICON` gives backlog: this glyph sits in the
       action row beside the Wishlist key, which *is* a bookmark, and two
       bookmarks in one row would be two keys nobody could tell apart. */
    icon: 'time',
    outline: 'time-outline',
  },
  {
    key: 'playing',
    label: 'Playing',
    hint: 'In it right now',
    status: 'playing',
    icon: 'game-controller',
    outline: 'game-controller-outline',
  },
  {
    key: 'paused',
    label: 'Paused',
    hint: 'Stopped for now, coming back',
    status: 'paused',
    icon: 'pause-circle',
    outline: 'pause-circle-outline',
  },
  {
    key: 'completed',
    label: 'Completed',
    hint: 'Finished it',
    status: 'played',
    icon: 'flag',
    outline: 'flag-outline',
  },
  {
    key: 'full',
    label: '100% complete',
    hint: 'Everything the game has to do',
    status: 'played',
    icon: 'trophy',
    outline: 'trophy-outline',
  },
  {
    key: 'played',
    label: 'Played',
    hint: "Didn't finish, or there's no end",
    status: 'played',
    icon: 'checkmark-circle',
    outline: 'checkmark-circle-outline',
  },
  {
    key: 'dropped',
    label: 'Dropped',
    hint: 'Stopped for good',
    status: 'dropped',
    icon: 'close-circle',
    outline: 'close-circle-outline',
  },
];

export const PROGRESS_META: Record<ProgressChoice, ProgressChoiceMeta> = Object.fromEntries(
  PROGRESS_CHOICES.map((choice) => [choice.key, choice])
) as Record<ProgressChoice, ProgressChoiceMeta>;

/** Which of the seven a log currently is. Null when there is no log. */
export function progressChoiceFor(
  log: Pick<GameLog, 'status' | 'completion'> | null | undefined
): ProgressChoice | null {
  if (!log) return null;
  switch (log.status) {
    case 'backlog':
      return 'backlog';
    case 'playing':
      return 'playing';
    case 'paused':
      return 'paused';
    case 'dropped':
      return 'dropped';
    case 'played':
      if (log.completion === 'full') return 'full';
      if (log.completion === 'story' || log.completion === 'main') return 'completed';
      return 'played';
  }
}

/**
 * The columns a choice writes.
 *
 * **Completion is left alone by the four status-only choices.** It is the best
 * this person has ever got with the game, and pausing, dropping or re-queueing a
 * finished game is not a statement that they did not finish it — the same
 * raise-only rule the playthrough trigger follows in 0023.
 *
 * The three that *are* about completion set it: `played` clears it ("I have
 * played it, and that is all I am claiming"), `full` sets it and the matching
 * 100%, and `completed` keeps a `main` it already had rather than knocking it
 * back to `story`.
 */
export function progressPatch(
  choice: ProgressChoice,
  current: Pick<GameLog, 'completion'> | null | undefined
): {
  status: LogStatus;
  completion?: CompletionLevel | null;
  completion_percent?: number;
} {
  switch (choice) {
    case 'backlog':
    case 'playing':
    case 'paused':
    case 'dropped':
      return { status: PROGRESS_META[choice].status };
    case 'played':
      return { status: 'played', completion: null };
    case 'completed':
      return {
        status: 'played',
        completion: current?.completion === 'main' ? 'main' : 'story',
      };
    case 'full':
      return { status: 'played', completion: 'full', completion_percent: 100 };
  }
}

/**
 * A partial ISO date, as the player gave it: '2021', 'May 2021' or '14 May 2021'.
 *
 * Month names come from the device locale; a string that is not one of the three
 * shapes is returned untouched rather than guessed at.
 */
export function formatPartialDate(value: string | null | undefined): string | null {
  if (!value) return null;
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value);
  if (!match) return value;

  const [, year, month, day] = match;
  if (!month) return year;

  const date = new Date(Number(year), Number(month) - 1, day ? Number(day) : 1);
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    ...(day ? { day: 'numeric' } : {}),
  });
}
