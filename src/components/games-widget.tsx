import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { Link } from 'expo-router';
import { memo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { PosterAspectRatio, Radius, Spacing, withAlpha } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPlaytime } from '@/lib/gaming';

/**
 * How many covers the shelf shows.
 *
 * Five is what fits across a phone at a size where each cover is still a
 * recognisable piece of box art. A sixth would take roughly 12dp off every card
 * to make room for itself.
 */
export const SHELF_LIMIT = 5;

/**
 * How much of each card the one in front of it covers, as a fraction.
 *
 * **This is the shelf's shape, and the widths are derived from it** — the
 * inverse of how every other artwork size in this app is set. Everywhere else a
 * fixed dp value is right, because the point is that retuning the spacing ladder
 * must not move the art. Here the art has one job the ladder cannot do for it:
 * span the row exactly, edge to edge, with no gutter left over. A fixed 92dp
 * card at a fixed 0.34 reveal came to 216dp of a 366dp row — the covers filled
 * three-fifths of the space they were given and each one showed a 31dp strip,
 * which is not enough of a cover to tell you which game it is.
 *
 * At 0.28, five cards on a 366dp row resolve to 94dp each with a 68dp strip
 * showing — more than double, and the row reaches both edges.
 */
const TARGET_OVERLAP = 0.28;

/**
 * The least a card may be covered by its neighbour.
 *
 * The binding constraint when there are fewer than five games: without it, the
 * "fill the width" rule would space three covers so far apart that they stopped
 * touching, and a stack with gaps in it is not a stack — it is a row that has
 * gone wrong. A shelf that falls short of the right edge is the better failure.
 */
const MIN_OVERLAP = 0.18;

/**
 * Bounds on a single cover.
 *
 * The ceiling is what stops a wide display from answering "fill the width" with
 * 180dp covers and a 271dp-tall widget — 132 is the width Home's lead rail uses
 * for a cover you are meant to look at, and a profile widget has no business
 * being larger than that. The floor is where box art stops being readable at
 * all. A tablet therefore leaves some room at the right, which is the correct
 * trade: this is a widget on a profile, not a hero.
 */
const CARD_MIN = 72;
const CARD_MAX = 132;

/**
 * Cover width and step for a shelf of `count` cards in `available` dp.
 *
 * Pure, and exported-shaped rather than inlined, because the two numbers have to
 * agree exactly — the container's height comes from the width and the last
 * card's right edge comes from the step, so computing either one separately is
 * how a shelf ends up overflowing its own container.
 */
function shelfGeometry(available: number, count: number): { card: number; step: number } {
  const raw = available / (1 + (count - 1) * (1 - TARGET_OVERLAP));
  const card = Math.round(Math.max(CARD_MIN, Math.min(CARD_MAX, raw)));

  if (count < 2) return { card, step: 0 };

  /* Spread to both edges, but never so far that the cards stop overlapping. */
  const spread = (available - card) / (count - 1);
  return { card, step: Math.min(spread, card * (1 - MIN_OVERLAP)) };
}

export type ShelfGame = {
  /** App-wide id when the game has a page; null for an unmatched Steam title. */
  gameId: string | null;
  title: string;
  coverUrl: string | null;
  heroUrl: string | null;
};

export type GamesWidgetProps = {
  /** Whose shelf this is — the heading reads "Ada's games". */
  ownerName: string;
  profileId: string;
  /** The five most recent, newest first. Fewer is fine; empty hides the stack. */
  games: readonly ShelfGame[];
  /** Steam achievements unlocked across the linked library. */
  achievementsUnlocked?: number | null;
  /** Total playtime in minutes, from Steam plus logged hours. */
  playtimeMinutes?: number | null;
};

/**
 * The profile's games shelf: overlapping recent covers over a compact stat line.
 *
 * ## Why a stack rather than a row
 *
 * A row of five covers is a grid with four items missing — it says "here are
 * five games" and nothing else. Overlapping them says *shelf*: a stack you
 * could thumb through, which is the thing a profile is actually claiming to be.
 *
 * **It spans the full width it is given**, and the overlap is what buys that:
 * five covers at their natural size would need more room than a phone has, so
 * they are sized and stepped from the measured row rather than from a fixed dp
 * value — see `TARGET_OVERLAP`. The earlier version fixed both numbers and came
 * to 216dp of a 366dp row, which left two fifths of the widget empty and showed
 * a 31dp strip of each cover. A 31dp strip of box art is not a game you can
 * name, so the stack was claiming to show five games while showing one.
 *
 * **The cards are level.** They offset to the right and nowhere else, so the row
 * keeps one unbroken top edge and one unbroken bottom edge. An earlier version
 * stepped each card down by a few dp as well, and the diagonal was the problem:
 * it read as a hand of cards dropped on a table rather than as a shelf, it made
 * the widget taller than its own artwork for no information gained, and it put
 * the block's only slanted line next to a column of otherwise flush-left type.
 * Depth here is the overlap and the shadow; it does not need a second axis.
 *
 * Each card carries a hairline and a shadow. Both are load-bearing: with no
 * outline, two dark covers next to each other merge into one shape and the row
 * collapses into a single block, and without the shadow the cards read as a flat
 * collage rather than as objects in front of one another.
 *
 * ## Why the achievements live here
 *
 * They used to be their own widget with four big numbers, directly under this
 * one — two sections about the same library, one of which was mostly whitespace.
 * Folded in, they become what they always were: a footnote about the shelf above
 * them. The two facts worth keeping are the ones nothing else on the profile
 * says — total achievements and total hours.
 */
/* Memoised: `games` is now a `useMemo`'d shelf rather than a fresh
 * `buildShelf()` call in the JSX, so the compare finally holds. */
export const GamesWidget = memo(function GamesWidget({
  ownerName,
  profileId,
  games,
  achievementsUnlocked,
  playtimeMinutes,
}: GamesWidgetProps) {
  const theme = useTheme();
  const { width: windowWidth } = useWindowDimensions();

  /*
   * The row's real width, measured.
   *
   * It cannot be computed: the widget is handed its width by a flex row on the
   * profile, and hard-coding "the display minus the page inset" would be a copy
   * of a number that lives in another file. `onLayout` is the only honest
   * source, and the window estimate below is what the first frame draws with so
   * nothing visibly resizes once the real figure lands — the two agree to within
   * a couple of dp in practice.
   *
   * No feedback loop: the cards are absolutely positioned, so what this sets is
   * their size and the container's *height*. The container's width comes from
   * the parent and is never a function of this.
   */
  const [measured, setMeasured] = useState(0);
  const available = measured || windowWidth - Spacing.x16 * 2;

  const shelf = games.slice(0, SHELF_LIMIT);
  const { card, step } = shelfGeometry(available, shelf.length);
  const hasStats = achievementsUnlocked != null || playtimeMinutes != null;

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((previous) => (previous === next ? previous : next));
  }

  return (
    <View style={[styles.widget, { borderTopColor: theme.border }]}>
      <Link href={{ pathname: '/library/[id]', params: { id: profileId } }} asChild>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel={`${ownerName}'s games. View all.`}
          scaleTo={0.98}
          style={styles.head}>
          {/* Possessive rather than "LIBRARY": the shelf mixes a Steam library
              with games logged in this app, and neither word covers both. */}
          <Text variant="h5" numberOfLines={1} style={styles.headTitle}>
            {ownerName}
            <Text variant="h5" color="textSecondary">
              ’s games
            </Text>
          </Text>

          <View style={styles.viewAll}>
            <Text variant="caption" color="primaryText">
              View all
            </Text>
            <Ionicons name="chevron-forward" size={13} color={theme.primaryText} />
          </View>
        </PressableScale>
      </Link>

      {shelf.length > 0 ? (
        <Link href={{ pathname: '/library/[id]', params: { id: profileId } }} asChild>
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel={`${shelf.length} recent games`}
            scaleTo={0.98}
            onLayout={onLayout}
            style={StyleSheet.flatten([
              styles.stack,
              /* Exactly one cover tall. Every card shares this height and sits
                 at the same top, which is what keeps the row's two long edges
                 straight. */
              { height: Math.round(card / PosterAspectRatio) },
            ])}>
            {/*
              Drawn back to front — the *last* game is furthest left, the most
              recent one sits in front. React Native has no `z-index` across
              siblings that beats paint order reliably, so the order in the tree
              is the stacking order, and reversing the data is how the newest
              ends up on top.
            */}
            {shelf
              .map((game, index) => ({ game, index }))
              .reverse()
              .map(({ game, index }) => (
                <View
                  key={`${game.gameId ?? game.title}-${index}`}
                  style={[
                    styles.card,
                    {
                      width: card,
                      height: Math.round(card / PosterAspectRatio),
                      /* `step`, not `card * reveal` — the step is what was
                         solved for so the last card's right edge lands on the
                         row's right edge. */
                      left: Math.round(index * step),
                      top: 0,
                      borderColor: withAlpha(theme.text, 0.16),
                      backgroundColor: theme.surfaceElevated,
                      /* Cast to the right, away from the card in front, so each
                         shadow lands on the cover it is meant to lift off. */
                      shadowColor: theme.shadowInk,
                    },
                  ]}>
                  {(game.coverUrl ?? game.heroUrl) ? (
                    <Image
                      source={{ uri: game.coverUrl ?? game.heroUrl ?? '' }}
                      style={styles.art}
                      contentFit="cover"
                      transition={200}
                      /* Box art never changes, so it belongs on disk — this
                         shelf is the first thing on a profile and was refetching
                         five covers on every visit. Keyed by game id so a
                         re-ordered shelf cannot show the previous cover under
                         the new title. */
                      cachePolicy="memory-disk"
                      recyclingKey={game.gameId ?? game.title}
                      accessibilityIgnoresInvertColors
                    />
                  ) : (
                    <View style={styles.placeholder}>
                      <Text variant="h4" color="textMuted">
                        {game.title.trim().charAt(0).toUpperCase() || '?'}
                      </Text>
                    </View>
                  )}
                </View>
              ))}
          </PressableScale>
        </Link>
      ) : (
        <Text variant="caption" color="textMuted">
          No games yet.
        </Text>
      )}

      {hasStats && (
        <View style={styles.stats}>
          {achievementsUnlocked != null && (
            <View style={styles.stat}>
              <Ionicons name="trophy" size={12} color={theme.platinum} />
              <Text variant="caption" color="textSecondary">
                {achievementsUnlocked.toLocaleString()} achievements
              </Text>
            </View>
          )}

          {playtimeMinutes != null && playtimeMinutes > 0 && (
            <View style={styles.stat}>
              <Ionicons name="time" size={12} color={theme.textMuted} />
              <Text variant="caption" color="textSecondary">
                {formatPlaytime(playtimeMinutes)} played
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  widget: {
    flex: 1,
    gap: Spacing.x12,
    paddingTop: Spacing.x16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  /* Shrinks rather than pushing "View all" off the row on a long display name. */
  headTitle: { flex: 1 },
  viewAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  /* Absolutely positioned children, so the row is exactly as wide as the
     overlap rather than as wide as five covers laid side by side. */
  stack: { position: 'relative' },
  card: {
    position: 'absolute',
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    /* Tight and short — the cards sit *just* in front of one another, and a
       soft wide shadow at this scale reads as a grey smudge between covers
       rather than as depth. Matches `Elevation.card`'s reasoning.

       Cast straight sideways, with no vertical component: the cards are level
       now, so a downward drop would blur a soft dark band along the one bottom
       edge they all share. Horizontal-only puts the whole shadow where the
       depth actually is — the seam between one cover and the next. */
    shadowOpacity: 0.45,
    shadowRadius: 5,
    shadowOffset: { width: 3, height: 0 },
    elevation: 4,
  },
  art: { width: '100%', height: '100%' },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  stats: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x16 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
