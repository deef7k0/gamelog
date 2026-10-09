/**
 * How much of a long list exists at once.
 *
 * React Native's list defaults are built for rows of text: ten rows up front,
 * ten more per batch, and **ten screens either side** kept mounted after that
 * (`windowSize` 21). This app's rows are artwork — a cover with a pressable and
 * its animated style, a review card, a row of three covers — so the defaults
 * meant a two-hundred-game grid mounted every cover it had, in batches large
 * enough to hold the JS thread for seconds. That is what the dev console's
 * "You have a large list that is slow to update" is reporting: two scroll
 * events in a row arriving more than half a second late, because the thread
 * that delivers them was busy drawing rows nobody had scrolled to.
 *
 * So every long list spreads one of these. The studio page's grid set its own
 * first (two rows, under a screenful of banner) and that reasoning is the same.
 *
 * `removeClippedSubviews` is deliberately not here: on Android it has a history
 * of blanking rows inside nested transforms, and `<PressableScale>` puts one on
 * nearly every row.
 */

/**
 * A grid of covers, counted in **rows** — a `numColumns` list's items are its
 * rows. Four rows of three are a screenful; two screens either side keep ahead
 * of a scroll.
 */
export const CoverGridWindow = {
  initialNumToRender: 4,
  maxToRenderPerBatch: 4,
  windowSize: 5,
} as const;

/**
 * The library: covers four across (`SHELF_COLUMNS`). Its rows are shorter than
 * a grid of three's, about 140dp, so a screenful is six of them rather than
 * four. A batch stays at four rows: that
 * is sixteen covers, already a third more work than a batch of the grid above,
 * and the batch is what holds the JS thread. The same two screens either side.
 */
export const ShelfGridWindow = {
  initialNumToRender: 6,
  maxToRenderPerBatch: 4,
  windowSize: 5,
} as const;

/**
 * A list of rows that each hold artwork — a game, an event, a review. A
 * screenful and a little more up front, three screens either side.
 */
export const ArtRowWindow = {
  initialNumToRender: 8,
  maxToRenderPerBatch: 6,
  windowSize: 7,
} as const;
