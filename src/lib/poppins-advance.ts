/**
 * Poppins' advance widths — how wide each letter is — read out of the font
 * files the app ships (`Poppins_400Regular.ttf`, `Poppins_700Bold.ttf`,
 * `Poppins_800ExtraBold.ttf`; the tests read them again and compare). For
 * laying text out before it is drawn: the review page's quote, sized to fill
 * its row (`fit-quote.ts`), and the review a share image is picked from,
 * whose every word has to be where a finger can find it (`review-highlight.ts`).
 *
 * Poppins, at the owner's direction (2026-10-17) — SimpMusic's own font. This
 * table held Inter's numbers before the switch; every value here was read
 * fresh off Poppins' real files, never derived from Inter's.
 *
 * No kerning: Poppins applies it sparingly and it only narrows a line.
 *
 * Pure.
 */

export type PoppinsWeight = 'regular' | 'bold' | 'extraBold';

/** The letters the tables hold, in order. */
const CHARS =
  ' !"#$%&\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~‘’“”–—…éèêëáàâäãåíìîïóòôöõúùûüñçÉÈÁÀÍÓÚÑÇßøæœ¡¿€£°×·•';

/** Thousandths of an em, for `CHARS`. */
const REGULAR = [
  267, 298, 292, 840, 622, 759, 739, 159, 454, 454, 486, 683, 198, 551, 210, 476, 628, 320, 575,
  589, 629, 628, 635, 546, 631, 630, 213, 264, 555, 723, 539, 524, 1013, 674, 613, 772, 707, 513,
  504, 778, 692, 246, 530, 599, 432, 861, 703, 786, 579, 788, 608, 587, 541, 675, 676, 976, 621,
  584, 541, 423, 658, 423, 629, 733, 257, 676, 676, 607, 676, 620, 329, 676, 640, 246, 248, 515,
  246, 1030, 640, 640, 676, 676, 373, 522, 364, 640, 561, 820, 479, 563, 455, 462, 291, 462, 519,
  219, 219, 380, 380, 677, 885, 581, 620, 620, 620, 620, 676, 676, 676, 676, 676, 676, 246, 246,
  246, 246, 640, 640, 640, 640, 640, 640, 640, 640, 640, 640, 607, 513, 513, 674, 674, 246, 786,
  675, 703, 772, 681, 640, 1097, 1080, 298, 519, 811, 620, 410, 643, 212, 412,
];
const BOLD = [
  212, 392, 411, 904, 658, 870, 798, 221, 477, 477, 534, 628, 287, 580, 282, 453, 652, 376, 571,
  605, 677, 650, 637, 535, 648, 615, 284, 347, 551, 696, 541, 538, 1080, 737, 659, 762, 727, 541,
  547, 762, 731, 295, 578, 697, 477, 918, 752, 786, 624, 788, 652, 615, 591, 705, 730, 1052, 715,
  671, 596, 510, 802, 510, 709, 780, 291, 679, 679, 605, 679, 616, 360, 679, 674, 295, 294, 618,
  295, 1059, 674, 637, 679, 679, 428, 558, 406, 674, 626, 866, 588, 632, 496, 499, 291, 499, 636,
  314, 314, 541, 541, 695, 930, 760, 616, 616, 616, 616, 679, 679, 679, 679, 679, 679, 321, 321,
  321, 321, 637, 637, 637, 637, 637, 674, 674, 674, 674, 674, 605, 541, 541, 737, 737, 295, 786,
  705, 752, 762, 760, 629, 1069, 1041, 392, 538, 796, 663, 463, 637, 299, 501,
];

/** ExtraBold: a review's quote, in onboarding's headline weight. */
const EXTRA_BOLD = [
  191, 423, 451, 919, 661, 904, 814, 243, 470, 470, 548, 589, 314, 578, 301, 426, 657, 387, 569,
  610, 691, 655, 635, 523, 653, 606, 302, 366, 524, 661, 519, 538, 1104, 755, 671, 758, 735, 548,
  561, 757, 743, 308, 584, 726, 491, 935, 765, 787, 636, 788, 661, 620, 604, 712, 747, 1076, 739,
  701, 613, 522, 840, 521, 733, 772, 307, 680, 680, 607, 680, 616, 373, 680, 686, 308, 307, 647,
  308, 1067, 686, 636, 680, 680, 447, 568, 421, 686, 649, 885, 628, 655, 507, 492, 277, 492, 674,
  346, 346, 595, 595, 689, 933, 815, 616, 616, 616, 616, 680, 680, 680, 680, 680, 680, 347, 347,
  347, 347, 636, 636, 636, 636, 636, 686, 686, 686, 686, 686, 607, 548, 548, 755, 755, 308, 787,
  712, 765, 758, 788, 625, 1061, 1031, 423, 538, 793, 671, 480, 609, 324, 519,
];

const TABLES: Record<PoppinsWeight, Map<string, number>> = {
  regular: new Map([...CHARS].map((char, index) => [char, REGULAR[index] / 1000])),
  bold: new Map([...CHARS].map((char, index) => [char, BOLD[index] / 1000])),
  extraBold: new Map([...CHARS].map((char, index) => [char, EXTRA_BOLD[index] / 1000])),
};

/**
 * A letter the tables do not hold — another script, an emoji — is taken as
 * wide as a wide capital: too wide is a line that ends early, too narrow a
 * line the phone would have to cut.
 */
const UNKNOWN = 0.8;

/** How wide `text` is at `size`, in dp. */
export function advanceWidth(
  text: string,
  size: number,
  weight: PoppinsWeight = 'regular'
): number {
  const table = TABLES[weight];
  let em = 0;
  for (const char of text) em += table.get(char) ?? UNKNOWN;
  return em * size;
}
