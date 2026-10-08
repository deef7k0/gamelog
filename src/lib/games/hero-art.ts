/**
 * Which of a game's images is its hero — the landscape key art at the head of
 * its page.
 *
 * Pure, and under `npm test`.
 *
 * ## Why the first artwork is not the answer
 *
 * The hero used to be `artworks[0]`. IGDB's `artworks` is not a list of key
 * art: it is every piece of artwork anybody uploaded, in upload order, and the
 * first is whatever was uploaded first. Asked of the sixty most-rated games in
 * the catalogue (verified live, 2026-10-08), only **twelve** had a 16:9 image
 * there. The Witcher 3's first artwork is a 128×128 icon; Portal 2's and
 * Half-Life 2's are 256×256 icons; Elden Ring's is its wordmark, 5981×920;
 * thirteen were portrait. Stretched across a full-bleed hero, that is a blurred
 * icon or a strip of a logo with its ends cut off — "cropped and in low
 * quality", in the owner's words.
 *
 * IGDB says what each artwork *is* (`artwork_type`) and how large it is, so the
 * hero is chosen: real art before logos, covers and icons; landscape before
 * anything else; large enough to be sharp across a phone.
 *
 * ## The slot it is chosen for
 *
 * A full-bleed hero is 38% of the display tall (`heroHeightFor`), so on a
 * phone it is nearer 5:4 than 16:9 and the art is cropped at its sides to fill
 * it. A widescreen frame loses its outer thirds, which key art is composed
 * for. A 3.1:1 banner — Steam's 1920×620 library hero, which a great many
 * "Artwork" uploads are — keeps barely the middle third of itself and is
 * enlarged half as much again to do it. That is why a banner ranks under a
 * sharp screenshot here, though it is the better picture.
 */

/** As much of an IGDB image as choosing needs. Sizes are the original upload's. */
export type HeroCandidate = {
  image_id?: string;
  width?: number;
  height?: number;
  /** An `artwork_types` id. Absent on screenshots, and on a query that did not ask. */
  artwork_type?: number | null;
};

export type ChosenHero<T extends HeroCandidate> = {
  image: T;
  /** Width over height, or null when IGDB did not say how large the image is. */
  aspect: number | null;
};

/** The shape key art is composed for, and what "closest to" is measured against. */
const WIDESCREEN = 16 / 9;

/**
 * IGDB's `artwork_types`, by id, as how good a hero each makes — lower is
 * better, and `null` is never a hero.
 *
 * A literal, because `artwork_types` is not on the Edge Function's allowlist
 * and an id is a third the bytes of an expanded name on every artwork of every
 * game in a list. Verified live on 2026-10-08 across the 4,726 artworks of a
 * thousand games — every one carried a type, and these fifteen are all there
 * are:
 *
 *    1 Artwork               2 Key art without logo    3 Key art with logo
 *    4 Concept art           5 Game logo (white)       6 Game logo (black)
 *    7 Game logo (color)     8 Infographic             9 Alternative cover
 *   10 Historical cover     11 Square cover           12 Icon
 *   13 Historical logo      14 Historical icon        15 Historical artwork
 *
 * An id that is not in the table — a type IGDB adds later — ranks with plain
 * "Artwork": new kinds of art are likelier than new kinds of logo, and the
 * shape rules below still keep a strip or an icon out.
 */
const KIND_RANK: Record<number, number | null> = {
  2: 0,
  3: 0,
  1: 1,
  4: 2,
  15: 3,
  5: null,
  6: null,
  7: null,
  8: null,
  9: null,
  10: null,
  11: null,
  12: null,
  13: null,
  14: null,
};
const UNKNOWN_KIND_RANK = 1;

/** Narrower than this across, an image is soft at a phone's full width. */
const SHARP_WIDTH = 1000;
/** Narrower than this, it is not shown as a hero while anything else exists. */
const USABLE_WIDTH = 600;

function aspectOf(image: HeroCandidate): number | null {
  if (!image.width || !image.height || image.width <= 0 || image.height <= 0) return null;
  return image.width / image.height;
}

/**
 * How well a shape suits a full-width hero: 0 a widescreen frame, 1 a squarer
 * or a wider one, 2 a banner — and null for what is not landscape art at all.
 *
 *  - **0: 3:2 to 2.1:1.** 16:9 and its neighbours.
 *  - **1: 1.2:1 to 2.4:1.** 4:3 key art at one end, 21:9 at the other.
 *  - **2: up to 3.3:1.** Steam's library hero is 1920×620 — 3.1:1 — and a great
 *    many "Artwork" uploads are exactly that file. It is real key art, and the
 *    worst fit for the slot (see the note at the top), so it is used only when
 *    there is neither squarer art nor a sharp screenshot.
 *  - **null:** square and portrait pieces, and strips wider than any key art
 *    (a wordmark is 4:1 to 9:1).
 */
export function heroShape(aspect: number | null): 0 | 1 | 2 | null {
  if (aspect === null) return null;
  if (aspect >= 1.5 && aspect <= 2.1) return 0;
  if (aspect >= 1.2 && aspect <= 2.4) return 1;
  if (aspect > 2.4 && aspect <= 3.3) return 2;
  return null;
}

type Ranked<T extends HeroCandidate> = {
  image: T;
  aspect: number;
  kind: number;
  shape: 0 | 1 | 2;
  width: number;
};

function rankArtworks<T extends HeroCandidate>(artworks: readonly T[]): Ranked<T>[] {
  const ranked: Ranked<T>[] = [];

  for (const image of artworks) {
    if (!image.image_id) continue;
    const kind =
      typeof image.artwork_type === 'number'
        ? image.artwork_type in KIND_RANK
          ? KIND_RANK[image.artwork_type]
          : UNKNOWN_KIND_RANK
        : UNKNOWN_KIND_RANK;
    if (kind === null) continue;

    const aspect = aspectOf(image);
    const shape = heroShape(aspect);
    if (aspect === null || shape === null) continue;

    ranked.push({ image, aspect, kind, shape, width: image.width ?? 0 });
  }

  /*
   * In this order: a frame before a banner; then the kind of art, so key art
   * beats concept art; then how close to widescreen; then the closer to 16:9;
   * then the larger file.
   */
  return ranked.sort(
    (a, b) =>
      Number(a.shape === 2) - Number(b.shape === 2) ||
      a.kind - b.kind ||
      a.shape - b.shape ||
      Math.abs(a.aspect - WIDESCREEN) - Math.abs(b.aspect - WIDESCREEN) ||
      b.width - a.width
  );
}

/**
 * The hero for one game, or null when it has no image that can be one.
 *
 * Down a ladder, and the first rung that holds anything wins:
 *
 *  1. **A sharp piece of landscape art** — key art, then artwork, then concept
 *     art, then historical artwork — at least 1000px across, and not a banner.
 *  2. **A sharp widescreen screenshot.** Gameplay, but crisp and the right
 *     shape, which beats art that would be soft or cut to its middle third.
 *  3. **A sharp banner** — the 3.1:1 art many older games have and nothing else.
 *  4. **Smaller landscape art**, down to 600px across.
 *  5. **The first screenshot**, whatever it is.
 *  6. **Any piece of art at all** — a portrait painting, a square one. It is
 *     still the game's art, and never a logo, a cover or an icon.
 *
 * A query that did not ask IGDB for sizes or kinds (`similar_games`, which
 * expands a third of a game's fields) cannot be ranked, and gets what it
 * always got: the first artwork, else the first screenshot, with no shape.
 */
export function chooseHero<T extends HeroCandidate>(
  artworks: readonly T[] | null | undefined,
  screenshots: readonly T[] | null | undefined
): ChosenHero<T> | null {
  const art = (artworks ?? []).filter((image) => !!image.image_id);
  const shots = (screenshots ?? []).filter((image) => !!image.image_id);

  const described = art.some(
    (image) => typeof image.artwork_type === 'number' || aspectOf(image) !== null
  );
  if (!described) {
    const first = art[0] ?? shots[0];
    return first ? { image: first, aspect: aspectOf(first) } : null;
  }

  /* Ranked with frames ahead of banners, so within each rung below the first
     match is the best one. */
  const ranked = rankArtworks(art);
  const chosen = (entry: Ranked<T>) => ({ image: entry.image, aspect: entry.aspect });

  const frame = ranked.find((entry) => entry.shape !== 2 && entry.width >= SHARP_WIDTH);
  if (frame) return chosen(frame);

  const shot = shots.find(
    (image) => heroShape(aspectOf(image)) === 0 && (image.width ?? 0) >= SHARP_WIDTH
  );
  if (shot) return { image: shot, aspect: aspectOf(shot) };

  const banner = ranked.find((entry) => entry.width >= SHARP_WIDTH);
  if (banner) return chosen(banner);

  const small = ranked.find((entry) => entry.width >= USABLE_WIDTH);
  if (small) return chosen(small);

  if (shots[0]) return { image: shots[0], aspect: aspectOf(shots[0]) };

  const anyArt = art
    .filter((image) => {
      if (typeof image.artwork_type !== 'number') return true;
      return !(image.artwork_type in KIND_RANK) || KIND_RANK[image.artwork_type] !== null;
    })
    .sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0];
  return anyArt ? { image: anyArt, aspect: aspectOf(anyArt) } : null;
}
