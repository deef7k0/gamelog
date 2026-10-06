/**
 * A cover at the size the copy showcase draws it.
 *
 * Every cover in the app is IGDB's `t_cover_big`, 264px wide — right for a
 * rail, a grid and a list, which draw it at 80 to 130dp. The showcase stands a
 * case nearly 300dp wide, about 800 real pixels on a 3× phone, so the same file
 * was being stretched three times over on the one screen made for looking at
 * it. `t_1080p` is the same image fitted inside 1920×1080: 811×1080 for a
 * portrait cover (verified live, `co1wyy`: 157 KB against 22).
 *
 * **For that one screen.** CLAUDE.md's rule is to ask for artwork at the size
 * its slot draws, and this is that rule, not an exception to it: a 1080p cover
 * in a rail would be six times the bytes for pixels nobody sees, in an image
 * cache capped at 250 MB.
 *
 * Only IGDB's size segment is rewritten. A legacy Steam capsule is already
 * 600×900 and has no larger sibling at a guessable path; anything else is
 * handed back as it came.
 */
const IGDB_SIZE = /^(https:\/\/images\.igdb\.com\/igdb\/image\/upload\/)t_[a-z0-9_]+\//i;

export function sharpCoverUrl(uri: string | null | undefined): string | null {
  if (!uri) return null;
  return uri.replace(IGDB_SIZE, '$1t_1080p/');
}
