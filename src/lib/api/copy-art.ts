import { supabase } from '../supabase';

/**
 * A physical copy's back cover and disc label, from the `copy-art` Edge
 * Function (GameTDB, then ScreenScraper). The shapes are the function's
 * (`supabase/functions/_shared/copy-art.ts`), restated: app code does not
 * import from the functions' folder.
 */
export type CopyArtImage = {
  /** This project's own copy of the picture, in the `copy-art` bucket. */
  url: string;
  width: number;
  height: number;
  /** For a whole sleeve, the part that is the back, as fractions of its width. */
  crop: { left: number; right: number } | null;
  source: 'gametdb' | 'screenscraper';
};

export type CopyArt = { back: CopyArtImage | null; disc: CopyArtImage | null };

export const NO_COPY_ART: CopyArt = { back: null, disc: null };

/** What a copy is looked up by: its game's name, its platform key, its region. */
export type CopyArtQuery = { title: string; platform: string; region: string | null };

/**
 * The art for a copy, or none. A function that is not deployed (404) or that
 * fails is "none": the copy screen then draws its own back and the art disc,
 * exactly as before this existed.
 */
export async function getCopyArt(query: CopyArtQuery, signal?: AbortSignal): Promise<CopyArt> {
  const { data, error } = await supabase.functions.invoke('copy-art', {
    body: query,
    ...(signal ? { signal } : {}),
  });
  if (error || !data || typeof data !== 'object' || 'error' in data) return NO_COPY_ART;
  const answer = data as Partial<CopyArt>;
  return { back: answer.back ?? null, disc: answer.disc ?? null };
}
