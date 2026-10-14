import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';

import { getWrittenLanguages } from '@/lib/api';
import { deviceLocales } from '@/lib/device-locale';
import {
  DEFAULT_READING_CHOICE,
  automaticLanguages,
  readingLanguages,
  type ReadingChoice,
} from '@/lib/language';
import { loadReadingChoice } from '@/lib/reading-languages';
import { useAuth } from '@/store/auth';

/** The phone's locales do not change while the app is open; ask once. */
let device: string[] | null = null;

function localesOfDevice(): string[] {
  if (device === null) device = deviceLocales();
  return device;
}

export type ReadingLanguages = {
  /**
   * The languages this person is shown reviews in, or `null` for every
   * language. What a chart is asked for and what `canRead` is given.
   */
  reading: string[] | null;
  /** What they chose: worked out, picked by hand, or everything. */
  choice: ReadingChoice;
  /** What "worked out" comes to on this phone, for this account. */
  automatic: string[];
  /**
   * False until the stored choice has been read. A chart waits for it: asked
   * a moment early it would fetch for the wrong languages, draw, and then
   * swap its rows for the right ones.
   */
  ready: boolean;
};

/**
 * Which languages the signed-in person reads reviews in.
 *
 * Three sources and one rule (`lib/language.ts`, which is the tested part):
 *
 * - **the app's language**, always — the interface is in it;
 * - **the phone's** (`deviceLocales`);
 * - **the ones they have written reviews in** (`getWrittenLanguages`, 0038) —
 *   somebody whose phone is in English and whose reviews are in Portuguese
 *   reads Portuguese;
 *
 * unless they chose for themselves in Settings, which replaces all three.
 *
 * Signed out there is nothing stored and nothing written: it is the app's
 * language and the phone's.
 *
 * The array keeps its identity while its contents do not change, so it can go
 * in a dependency list or a query key (`readingKey`) without re-asking on
 * every render.
 */
export function useReadingLanguages(): ReadingLanguages {
  const userId = useAuth((state) => state.session?.user.id) ?? null;

  /* Reads a store the device already keeps — so, like the search history and
     the drafts, it is in `NEVER_PERSIST`, and never goes stale on its own:
     the one writer sets the cache as it writes. */
  const stored = useQuery({
    queryKey: ['reading-languages', userId],
    queryFn: () => loadReadingChoice(userId!),
    enabled: !!userId,
    staleTime: Infinity,
  });

  /* Kept with the rest of the cache, so a cold start has it before the first
     chart asks. A database without 0038 answers an empty list. */
  const written = useQuery({
    queryKey: ['written-languages', userId],
    queryFn: () => getWrittenLanguages(userId!),
    enabled: !!userId,
    staleTime: 30 * 60_000,
  });

  const choice = stored.data ?? DEFAULT_READING_CHOICE;
  const writtenKey = (written.data ?? []).join(',');

  return useMemo(() => {
    const wrote = writtenKey ? writtenKey.split(',') : [];
    const locales = localesOfDevice();
    return {
      reading: readingLanguages(choice, locales, wrote),
      choice,
      automatic: automaticLanguages(locales, wrote),
      /* An unreadable store is not a reason to wait for ever: it reads as
         `auto`, which is what `choice` already is. */
      ready: !userId || !stored.isPending,
    };
  }, [choice, writtenKey, userId, stored.isPending]);
}
