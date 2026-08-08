import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Chip, ScoreBadge } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { GameSearchResult } from '@/lib/games';

const POSTER_WIDTH = 74;

/** Shorten the verbose platform names providers return, for a tight metadata row. */
const PLATFORM_SHORT: Record<string, string> = {
  'PC (Microsoft Windows)': 'PC',
  Windows: 'PC',
  macOS: 'Mac',
  Mac: 'Mac',
  Linux: 'Linux',
  PlayStation5: 'PS5',
  'PlayStation 5': 'PS5',
  'PlayStation 4': 'PS4',
  'Xbox Series X|S': 'Xbox',
  'Xbox Series S/X': 'Xbox',
  'Xbox One': 'Xbox',
  'Nintendo Switch': 'Switch',
};

function shortPlatforms(platforms: string[]): string[] {
  const seen = new Set<string>();
  for (const platform of platforms) {
    const short = PLATFORM_SHORT[platform] ?? platform;
    // Collapse "PlayStation 4"/"PlayStation 5" style duplicates after shortening.
    if (short.length <= 8) seen.add(short);
    if (seen.size >= 4) break;
  }
  return [...seen];
}

export type GameListItemProps = {
  game: GameSearchResult;
  /** Small marker shown when the viewer has already logged this game. */
  badge?: string | null;
  /**
   * What tapping the row does instead of opening the game page.
   *
   * Exists for pickers — choosing a game to add to a collection has to *return*
   * a game, not navigate to it. Everywhere else omits this, because a search
   * result leading anywhere other than the game is a surprise.
   */
  onPress?: () => void;
  disabled?: boolean;
};

/**
 * One search result: poster on the left,
 * title and metadata stacked to the right, score pinned top-right.
 */
export function GameListItem({ game, badge, onPress, disabled }: GameListItemProps) {
  const theme = useTheme();
  const platforms = shortPlatforms(game.platforms);
  const subtitle = [game.releaseYear, game.developer].filter(Boolean).join(' · ');

  const row = (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={game.title}
      onPress={onPress}
      disabled={disabled}
      // Flattened: <Link asChild> clones this element and cannot merge an
      // array style prop — it throws rather than guessing a precedence.
      style={StyleSheet.flatten([
        styles.row,
        { borderTopColor: theme.border },
        disabled && styles.disabled,
      ])}>
      <Poster
        coverUrl={game.coverUrl}
        heroUrl={game.heroUrl}
        title={game.title}
        width={POSTER_WIDTH}
        rounded="image"
      />

      <View style={styles.body}>
        <View style={styles.titleRow}>
          <Text variant="bodyStrong" numberOfLines={2} style={styles.title}>
            {game.title}
          </Text>
          {game.score !== null && <ScoreBadge score={game.score} size="small" />}
        </View>

        {subtitle.length > 0 && (
          <Text variant="caption" color="textMuted" numberOfLines={1}>
            {subtitle}
          </Text>
        )}

        {(platforms.length > 0 || game.genres.length > 0) && (
          <View style={styles.chips}>
            {platforms.map((platform) => (
              <Chip key={platform} label={platform} />
            ))}
            {game.genres.slice(0, 2).map((genre) => (
              <Chip key={genre} label={genre} />
            ))}
          </View>
        )}

        {badge && (
          <Text variant="micro" color="success">
            {badge}
          </Text>
        )}
      </View>
    </PressableScale>
  );

  // A row that already has an onPress must not also be wrapped in a Link — the
  // Link would win and navigate away instead of running the handler.
  if (onPress) return row;

  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.id } }} asChild>
      {row}
    </Link>
  );
}

const styles = StyleSheet.create({
  /* A rule, not a container — see the note on <Card>. Rows in a list are a
     list, and giving each one an edge makes twenty objects out of one. */
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x16,
    paddingVertical: Spacing.x12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  disabled: { opacity: 0.55 },
  body: { flex: 1, gap: Spacing.x8 },
  titleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.x8 },
  title: { flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.x4 + 2 },
});
