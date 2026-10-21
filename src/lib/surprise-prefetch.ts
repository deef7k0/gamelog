/**
 * Surprise Me's media rules, as data: which art a dealt card shows, and what
 * is fetched before the card is in front.
 *
 * The owner's brief (2026-10-21) — animated portraits as well as squares, and
 * loading planned "the way a feed of mixed media is": the client knows what
 * each item is before it fetches it, prefetches by a **byte budget** rather
 * than a count, treats each kind of media at its own distance, shows a still
 * first and swaps the animation in, cancels what is swiped past, and stops
 * prefetching while a finger is moving.
 *
 * Restated for this screen:
 *
 * - **What each card is, first.** SteamGridDB's answers — is there a square,
 *   an animated square, an animated portrait, and what does the animation
 *   weigh (the HEAD that checked it, `AnimatedAsset.bytes`) — are looked up
 *   for the next `METADATA_AHEAD` cards. That is the "type field": the card's
 *   shape and its poster are decided from it before anything is downloaded.
 * - **A byte budget, walked forward** (`planPrefetch`): from the next card on,
 *   each card's still is taken until `PREFETCH_BUDGET` is spent — the stills of every card in
 *   reach cost less than one heavy animation.
 * - **Each kind at its own distance.** A still: any card the budget reaches
 *   (cheap, decodes fast). A light animation (`LIGHT_ANIMATION`, an animated
 *   image of a megabyte or two): the very next card only. A heavy one, or a
 *   video: never ahead — it is fetched when its card is in front and has been
 *   for `SETTLE_MS`, and dropped (its download cancelled) when the card goes.
 * - **Still first, then the swap.** A card is drawn with its still; the
 *   animation crossfades in over it once it has a frame
 *   (`<AnimatedCoverImage>`).
 * - **Nothing during a drag.** Prefetching waits until the deck has settled
 *   (`SETTLE_MS`) and a drag cancels what had not started; the animation in
 *   front holds its frame while the finger moves.
 *
 * Pure — no React Native, no network — so `npm test` covers it. The screen is
 * `app/surprise.tsx`; a card's art is `<SurpriseCardArt>`.
 */

/** What may be fetched ahead of the card in front, in bytes. */
export const PREFETCH_BUDGET = 2.5 * 1024 * 1024;

/** How many cards ahead a still is ever fetched, however much budget is left. */
export const LOOKAHEAD = 5;

/** How many cards ahead SteamGridDB is asked what each card is. */
export const METADATA_AHEAD = 2;

/** An animated image at most this heavy is light enough to fetch with the next card's still. */
export const LIGHT_ANIMATION = 1.5 * 1024 * 1024;

/**
 * How long the deck must be still before anything is fetched — ahead, or the
 * animation of the card in front. The reference's ~200 ms "after the user
 * settles", counted from the moment the card has slid into place.
 */
export const SETTLE_MS = 200;

/**
 * How long a card waits for SteamGridDB to say what it is before it is drawn
 * as what is known. Long enough for a lookup the card before already started;
 * short enough that a first card is not held. Once drawn, a card keeps its
 * shape — an animated portrait found later does not turn a square into one.
 */
export const SHAPE_PATIENCE_MS = 1200;

/**
 * What a still weighs when nobody has said: SteamGridDB's squares are 512 or
 * 1024 across, a few hundred kilobytes; IGDB's `t_cover_big` is about sixty.
 * Estimates — the budget is a ceiling, not an invoice.
 */
const SQUARE_STILL_BYTES = 350 * 1024;
const COVER_STILL_BYTES = 60 * 1024;
const OTHER_STILL_BYTES = 150 * 1024;

export type CardShape = 'square' | 'portrait';

/** One animated file, as `useAnimatedCover` knows it. */
export type CardAnimation = {
  url: string;
  format: 'image' | 'video';
  /** The animation at its own size, or SteamGridDB's small preview of it. */
  quality?: 'full' | 'preview';
  bytes?: number | null;
};

/**
 * What is known of one game's art: each answer is the thing, `null` for none,
 * or `undefined` for not known yet.
 */
export type CardArtAnswers = {
  /** SteamGridDB's still square. */
  square: string | null | undefined;
  animatedSquare: CardAnimation | null | undefined;
  animatedPortrait: CardAnimation | null | undefined;
};

/**
 * The shape a card is drawn in, or `null` to hold a skeleton a moment longer.
 *
 * In order: an animated square, an animated portrait — the owner's "allow
 * for animated portraits to show instead of only square" — a still square,
 * the box art; and among the animations, any at full size before any that is
 * only SteamGridDB's small preview, so a sharp portrait beats a soft square
 * (Hades has the one and only the other, checked live). Never drawn before
 * the still square's answer (a portrait
 * swapped for a square a beat later is the flicker `useSquareCover` exists to
 * prevent). With animation on, the animated answers are waited for until
 * `patience` runs out; then the card is drawn as what is known.
 */
export function chooseCardShape(
  answers: CardArtAnswers,
  { animated, patience }: { animated: boolean; patience: boolean }
): CardShape | null {
  if (answers.square === undefined) return null;
  if (animated) {
    const full = (animation: CardAnimation | null | undefined) =>
      !!animation && animation.quality !== 'preview';
    if (full(answers.animatedSquare)) return 'square';
    if (full(answers.animatedPortrait)) return 'portrait';
    if (answers.animatedSquare) return 'square';
    if (answers.animatedPortrait) return 'portrait';
    const pending = answers.animatedSquare === undefined || answers.animatedPortrait === undefined;
    if (pending && !patience) return null;
  }
  return answers.square ? 'square' : 'portrait';
}

/** The animation a card of this shape plays, if any. */
export function animationFor(shape: CardShape, answers: CardArtAnswers): CardAnimation | null {
  return (shape === 'square' ? answers.animatedSquare : answers.animatedPortrait) ?? null;
}

/** What a still weighs, by where it lives. */
export function stillBytes(url: string): number {
  if (url.includes('steamgriddb.com')) return SQUARE_STILL_BYTES;
  if (url.includes('images.igdb.com')) return COVER_STILL_BYTES;
  return OTHER_STILL_BYTES;
}

/** One card ahead of the one in front, as the planner sees it. */
export type PlannedCard = {
  /** 1 for the next card, 2 for the one after… */
  distance: number;
  /** The still it will be drawn with, when its shape is known. */
  still: string | null;
  /** The animation it will play, when known. */
  animation: CardAnimation | null;
};

/**
 * The files to fetch ahead, in order: walk forward from the next card,
 * taking each card's still while the budget lasts, and the next card's
 * animation too when it is a light image. Stops at the first still that does
 * not fit — a card further on is never fetched before a nearer one.
 */
export function planPrefetch(cards: readonly PlannedCard[], budget = PREFETCH_BUDGET): string[] {
  const plan: string[] = [];
  let left = budget;
  for (const card of [...cards].sort((a, b) => a.distance - b.distance)) {
    if (card.distance < 1 || card.distance > LOOKAHEAD) continue;
    if (card.still) {
      const cost = stillBytes(card.still);
      if (cost > left) break;
      plan.push(card.still);
      left -= cost;
    }
    const animation = card.animation;
    if (
      card.distance === 1 &&
      animation?.format === 'image' &&
      typeof animation.bytes === 'number' &&
      animation.bytes <= LIGHT_ANIMATION &&
      animation.bytes <= left
    ) {
      plan.push(animation.url);
      left -= animation.bytes;
    }
  }
  return plan;
}
