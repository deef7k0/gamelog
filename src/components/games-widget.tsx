import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { memo, useMemo, useState } from 'react';
import { StyleSheet, View, useWindowDimensions, type LayoutChangeEvent } from 'react-native';

import { ProfileBoxSection } from '@/components/profile-section';
import { CoverStack, type StackCover } from '@/components/ui/cover-stack';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { STACK_SIZE } from '@/constants/cover-stack';
import { boxInside } from '@/constants/profile-layout';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPlaytime } from '@/lib/gaming';

/**
 * How many covers the shelf shows: a full stack.
 *
 * Five is also what fitted across a phone when they stood in a row, at a size
 * where each cover was still a recognisable piece of box art.
 */
export const SHELF_LIMIT = STACK_SIZE;

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
  /**
   * Games owned digitally and physically (0028). They never overlap — a game
   * with a box counts as physical only — so the two add up to the collection.
   * Null while loading, and the line waits for both rather than jumping.
   */
  digitalCount?: number | null;
  physicalCount?: number | null;
};

/**
 * The profile's library: the five most recent games as one stack, under a
 * title that is the way into all of them — in a box of its own, under the
 * favourites'.
 *
 * ```
 * ┌ Ada's games ───────────────────── › ┐
 * │ ───────────────────────────────────  │
 * │ ▮▮▮▮▮▮▮[ ▮▮▮▮▮▮▮▮▮ ]▮▮▮▮▮▮▮         │   the newest in front; five span the box
 * │ ☁ 128 digital · ◉ 14 physical        │
 * │ 🏆 2,310 achievements ⏱ 1,204h played │
 * └──────────────────────────────────────┘
 * ```
 *
 * ## It is a card, and its own
 *
 * It stood on the page as a section — a title with a chevron, a rule, then the
 * stack — where the owner's reference has "Recent Activity". The owner asked
 * for it in a card; for one pass that was the favourites' card, the stack
 * seven-eighths of the box and centred, and the owner then had it "detached
 * from the favourites one" and the stack brought back to the margins of what
 * is round it. So this renders a section (`<ProfileBoxSection>`), the profile
 * gives it a box to itself, and five covers run from the title's left edge to
 * the chevron's right one. The title is still the door.
 *
 * The stack is drawn the way a second reference draws a list — five covers
 * overlapping, the middle one whole (`<CoverStack>`, `constants/cover-stack`).
 * A collection is drawn the same way wherever collections are listed, so a
 * profile's games and a collection's read as the same kind of thing: a shelf
 * with something pulled forward.
 *
 * ## What it replaced
 *
 * A level staircase: five covers stepping to the right, each covering the last
 * by a fifth, the newest in front at the right-hand end. The stack keeps the
 * count and the order and changes where the newest stands — in the middle, in
 * front — and what is behind it now recedes both ways.
 *
 * ## Why the counts live here
 *
 * What the collection is made of, and what has been done with it, are footnotes
 * to the shelf above them — two short lines, not a block of four big numbers
 * (which is what the achievements once were, in a widget of their own directly
 * under this one). They start at the left edge the title and a full stack
 * share. Each half of the digital · physical line opens the library on the
 * matching view.
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
  const { width: windowWidth } = useWindowDimensions();

  /*
   * The row the stack stands in: the inside of the box, measured, with the
   * figure the box is built from as what the first frame draws with — the two
   * agree on every phone, so nothing resizes when the real one lands. The
   * covers are absolutely placed inside the stack, so this sets their size and
   * the stack's height and never the section's own width: there is no loop.
   */
  const [measured, setMeasured] = useState(0);
  const row = measured || boxInside(Math.min(windowWidth, MaxContentWidth));

  function onLayout(event: LayoutChangeEvent) {
    const next = Math.round(event.nativeEvent.layout.width);
    setMeasured((previous) => (previous === next ? previous : next));
  }

  /* Stable for a stable shelf, so `<CoverStack>`'s memo holds. The index is in
     the key because an unmatched Steam title has no id and two can share a
     name. */
  const covers = useMemo<StackCover[]>(
    () =>
      games.slice(0, SHELF_LIMIT).map((game, index) => ({
        id: `${game.gameId ?? game.title}-${index}`,
        title: game.title,
        coverUrl: game.coverUrl,
        heroUrl: game.heroUrl,
      })),
    [games]
  );

  const hasStats = achievementsUnlocked != null || playtimeMinutes != null;
  /* Hidden until both counts are in, and hidden for a profile with neither,
     where "0 digital · 0 physical" would be a line about nothing. */
  const hasSplit =
    digitalCount != null && physicalCount != null && digitalCount + physicalCount > 0;
  const library = { pathname: '/library/[id]', params: { id: profileId } } as const;

  return (
    /* Possessive rather than "Library": the shelf mixes a Steam library with
       games logged in this app, and neither word covers both. */
    <ProfileBoxSection
      title={`${ownerName}’s games`}
      href={library}
      accessibilityLabel={`${ownerName}'s games. View all.`}>
      <View onLayout={onLayout}>
        {covers.length > 0 ? (
          <Link href={library} asChild>
            {/* The row, not only the covers: the stack is as wide as its row,
                and a press beside a short one opens the same library its title
                does. */}
            <PressableScale
              accessibilityRole="button"
              accessibilityLabel={`${covers.length} recent ${covers.length === 1 ? 'game' : 'games'}. Open the library.`}
              scaleTo={0.98}>
              <CoverStack covers={covers} width={row} />
            </PressableScale>
          </Link>
        ) : (
          <Text variant="body" color="textMuted">
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
      </View>
    </ProfileBoxSection>
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
  /* The reference sets its caption nine pixels under a 106-pixel stack; twelve
     under this one. The two lines are a caption's distance apart. */
  captions: { marginTop: Spacing.x12, gap: Spacing.x8 },
  split: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  stats: { flexDirection: 'row', flexWrap: 'wrap', columnGap: Spacing.x16, rowGap: Spacing.x8 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
