import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { memo } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';

import { ProfileWidget } from '@/components/profile-section';
import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { FAVOURITES, favouriteCoverWidth } from '@/constants/profile-layout';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPlaytime } from '@/lib/gaming';

/**
 * How many covers the shelf shows: four, the favourites' row.
 *
 * It was five while the shelf was a stack of overlapping covers.
 */
export const SHELF_LIMIT = FAVOURITES.columns;

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
  /** The four most recent, newest first. Fewer is fine: the row keeps its shape. */
  games: readonly ShelfGame[];
  /** Steam achievements unlocked across the linked library. */
  achievementsUnlocked?: number | null;
  /** Total playtime in minutes, from Steam plus logged hours. */
  playtimeMinutes?: number | null;
  /**
   * Games owned digitally and physically (0028). They never overlap — a game
   * with a box counts as physical only — so the two add up to the collection.
   * Null while loading, and the line waits for both rather than jumping.
   */
  digitalCount?: number | null;
  physicalCount?: number | null;
};

/**
 * The profile's library: the four most recent games, under the favourites —
 * and drawn exactly as the favourites are.
 *
 * ```
 * ─────────────────────────────────────────
 * Ada’s games                     View all ›
 * [▮▮▮]  [▮▮▮]  [▮▮▮]  [▮▮▮]                   four covers, apart, newest first
 * ☁ 128 digital · ◉ 14 physical
 * 🏆 2,310 achievements ⏱ 1,204h played
 * ```
 *
 * ## Four separate covers, as the favourites are
 *
 * The owner's direction (2026-10-09): "Make the user's games on the profile
 * tab exactly like the favourites card. Drop the stacked games widget and use
 * the 4 separated games one." So this is the favourites' row with different
 * games in it — the same cover width (`favouriteCoverWidth`), the same gap,
 * the same dashed slot where there is no fourth. The two read as a pair: the
 * four they chose, and the four they played last.
 *
 * It was a stack of overlapping covers before that — a staircase of five, then
 * a five-cover stack (deleted 2026-10-22, when collections became mosaics); a profile's games
 * do not. **Do not bring a stack back here.**
 *
 * ## Not a card
 *
 * A hairline and a heading (`<ProfileWidget>`), the heading the way into the
 * library. It was boxed for a week with the favourites and the song; the owner
 * went back to the old layout (2026-10-12) and had the cards removed.
 *
 * ## What a cover does
 *
 * It opens its game. A Steam title nobody has logged has no page in the
 * catalogue, so that cover opens the library instead.
 *
 * ## Why the counts live here
 *
 * What the collection is made of, and what has been done with it, are footnotes
 * to the shelf above them — two short lines, not a block of four big numbers.
 * Each half of the digital · physical line opens the library on the matching
 * view.
 */
/* Memoised: `games` is a `useMemo`'d shelf, so the compare holds. */
export const GamesWidget = memo(function GamesWidget({
  ownerName,
  profileId,
  games,
  achievementsUnlocked,
  playtimeMinutes,
  digitalCount,
  physicalCount,
}: GamesWidgetProps) {
  const theme = useTheme();
  const { width } = useWindowDimensions();

  /* The favourites' own cover, to the dp: the two rows are one above the other
     and must line up. */
  const posterWidth = favouriteCoverWidth(Math.min(width, MaxContentWidth));
  const posterHeight = posterWidth / (2 / 3);

  const shown = games.slice(0, SHELF_LIMIT);

  const hasStats = achievementsUnlocked != null || playtimeMinutes != null;
  /* Hidden until both counts are in, and hidden for a profile with neither,
     where "0 digital · 0 physical" would be a line about nothing. */
  const hasSplit =
    digitalCount != null && physicalCount != null && digitalCount + physicalCount > 0;
  const library = { pathname: '/library/[id]', params: { id: profileId } } as const;

  return (
    /* Possessive rather than "Library": the shelf mixes a Steam library with
       games logged in this app, and neither word covers both. */
    <ProfileWidget
      title={ownerName}
      tail="’s games"
      href={library}
      accessibilityLabel={`${ownerName}'s games. View all.`}>
      {shown.length > 0 ? (
        <View style={styles.posters}>
          {shown.map((game, index) => (
            <Link
              /* The index is in the key because an unmatched Steam title has
                 no id and two can share a name. */
              key={`${game.gameId ?? game.title}-${index}`}
              href={game.gameId ? { pathname: '/game/[id]', params: { id: game.gameId } } : library}
              asChild>
              <PressableScale
                accessibilityRole="button"
                accessibilityLabel={game.gameId ? game.title : `${game.title}. Opens the library.`}
                scaleTo={0.94}>
                <Poster
                  coverUrl={game.coverUrl}
                  heroUrl={game.heroUrl}
                  title={game.title}
                  /* No `gameId`, so no Must Play badge — the owner's rule for
                     the profile's rows (2026-10-15). */
                  width={posterWidth}
                  rounded="image"
                />
              </PressableScale>
            </Link>
          ))}

          {/* Empty slots so the row keeps its shape below four games, as the
              favourites' does. */}
          {Array.from({ length: Math.max(0, SHELF_LIMIT - shown.length) }).map((_, index) => (
            <View
              key={`slot-${index}`}
              style={[
                styles.emptySlot,
                {
                  width: posterWidth,
                  height: posterHeight,
                  backgroundColor: theme.surfaceElevated,
                  borderColor: theme.border,
                },
              ]}
            />
          ))}
        </View>
      ) : (
        <Text variant="caption" color="textMuted">
          No games yet.
        </Text>
      )}

      {(hasSplit || hasStats) && (
        <View style={styles.captions}>
          {/* What the collection is made of, directly under the covers it is
              made of. Each half opens the library on the matching view — the
              physical one on the binder. */}
          {hasSplit && (
            <View style={styles.split}>
              <SplitLink
                profileId={profileId}
                tab="all"
                icon="cloud-outline"
                count={digitalCount ?? 0}
                word="digital"
              />
              <Text variant="caption" color="textMuted">
                ·
              </Text>
              <SplitLink
                profileId={profileId}
                tab="physical"
                icon="disc-outline"
                count={physicalCount ?? 0}
                word="physical"
              />
            </View>
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
      )}
    </ProfileWidget>
  );
});

/** One half of the digital · physical line, and the door to that view. */
function SplitLink({
  profileId,
  tab,
  icon,
  count,
  word,
}: {
  profileId: string;
  tab: 'all' | 'physical';
  icon: keyof typeof Ionicons.glyphMap;
  count: number;
  word: string;
}) {
  const theme = useTheme();
  const label = `${count.toLocaleString()} ${word} ${count === 1 ? 'game' : 'games'}`;
  return (
    <Link href={{ pathname: '/library/[id]', params: { id: profileId, tab } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={label}
        hitSlop={SPLIT_SLOP}
        scaleTo={0.96}
        style={StyleSheet.flatten(styles.stat)}>
        <Ionicons name={icon} size={13} color={theme.textMuted} />
        <Text variant="caption" color="textSecondary">
          <Text variant="caption" color="text">
            {count.toLocaleString()}
          </Text>{' '}
          {word}
        </Text>
      </PressableScale>
    </Link>
  );
}

/** A caption-high link is ~13dp; the slop lifts it to the platform floor. */
const SPLIT_SLOP = { top: 16, bottom: 16, left: 8, right: 8 };

const styles = StyleSheet.create({
  /* The favourites' row, restated: `space-between`, with eight as the least
     the covers may stand apart. Change one and change the other. */
  posters: { flexDirection: 'row', justifyContent: 'space-between', gap: FAVOURITES.gap },
  emptySlot: {
    borderRadius: Radius.image,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: 'dashed',
  },
  /* Under the covers, a caption's distance apart. */
  captions: { gap: Spacing.x8 },
  split: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.x16, rowGap: Spacing.x8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
