import Ionicons from '@expo/vector-icons/Ionicons';
import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { formatPlaytime } from '@/lib/gaming';
import type { OwnedGame } from '@/lib/gaming';

/**
 * One library entry: portrait art with a two-stat caption underneath.
 *
 * The caption is icon-plus-number rather than labelled text — "12h" next to a
 * clock and "24" next to a trophy — because at four tiles per row there is only
 * room for about six characters per stat. Spelling it out ("12 hours, 24
 * achievements") would wrap and break the grid rhythm.
 *
 * Steam's own portrait capsule is used for art. `library_600x900.jpg` does not
 * exist for every app — older and smaller titles never got one — so `Poster`
 * falls back to the landscape header and then to a lettered placeholder.
 */

/** Steam's portrait library capsule for an appid. */
export function steamCoverUrl(appId: string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/library_600x900.jpg`;
}

/** Landscape header, used as the fallback when there is no portrait capsule. */
export function steamHeaderUrl(appId: string): string {
  return `https://cdn.cloudflare.steamstatic.com/steam/apps/${appId}/header.jpg`;
}

export type GameTileProps = {
  game: OwnedGame;
  width: number;
  /** Hide the caption where the row is too short for it (profile widgets). */
  showStats?: boolean;
  /**
   * Whose library this is. When set, tapping opens that person's stats and
   * diary for the game rather than the shared game page — which is the point of
   * a library: it is *their* record of the game, not the game itself.
   */
  ownerId?: string;
};

export function GameTile({ game, width, showStats = true, ownerId }: GameTileProps) {
  const theme = useTheme();

  const unlocked = game.achievementsUnlocked ?? 0;
  const total = game.achievementsTotal;
  // `total === null` means the game has not been scanned yet; `0` means it has
  // been scanned and genuinely has no achievements. Only the latter hides the
  // trophy, so an unscanned game does not look achievement-free.
  const showTrophy = total === null || total > 0;

  const art = (
    <View style={[styles.tile, { width }]}>
      <Poster
        coverUrl={steamCoverUrl(game.appId)}
        heroUrl={steamHeaderUrl(game.appId)}
        title={game.name}
        width={width}
        rounded="image"
      />

      {showStats && (
        <View style={styles.stats}>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={11} color={theme.textMuted} />
            <Text variant="micro" color="textMuted" numberOfLines={1}>
              {formatPlaytime(game.playtimeMinutes)}
            </Text>
          </View>

          {showTrophy && (
            <View style={styles.stat}>
              <Ionicons
                name="trophy-outline"
                size={11}
                color={
                  total !== null && total > 0 && unlocked >= total
                    ? theme.platinum
                    : theme.textMuted
                }
              />
              <Text variant="micro" color="textMuted" numberOfLines={1}>
                {total === null ? '—' : unlocked}
              </Text>
            </View>
          )}
        </View>
      )}
    </View>
  );

  // Only titles cached in `games` have a detail page to open; the rest are still
  // shown, just not tappable, rather than routing to a dead screen.
  if (!game.gameId) return art;

  const href = ownerId
    ? ({
        pathname: '/diary/[user]/[game]',
        params: { user: ownerId, game: game.gameId, tab: 'stats' },
      } as const)
    : ({ pathname: '/game/[id]', params: { id: game.gameId } } as const);

  return (
    <Link href={href} asChild>
      <PressableScale accessibilityRole="button" accessibilityLabel={game.name} scaleTo={0.95}>
        {art}
      </PressableScale>
    </Link>
  );
}

/**
 * Column width for an N-across grid.
 *
 * Kept here so the widget, the library screen and the achievements screen all
 * derive the same width from the same rule instead of each hard-coding one.
 */
export function gridItemWidth(
  screenWidth: number,
  columns: number,
  horizontalPadding: number,
  gap: number
): number {
  const usable = screenWidth - horizontalPadding * 2 - gap * (columns - 1);
  return Math.floor(usable / columns);
}

const styles = StyleSheet.create({
  tile: { gap: Spacing.x4 },
  stats: { flexDirection: 'row', gap: Spacing.x8, paddingHorizontal: 1 },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
