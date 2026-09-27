import { Link } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { Poster } from '@/components/ui/poster';
import { PressableScale } from '@/components/ui/pressable-scale';
import { ScoreBadge, Skeleton } from '@/components/ui/surface';
import { Text } from '@/components/ui/text';
import { scoreColor } from '@/constants/score';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import type { StatGame, UserGameStats } from '@/lib/database.types';

export type LibraryStatsProps = {
  stats: UserGameStats | undefined;
  loading: boolean;
  failed: boolean;
  onRetry: () => void;
};

/**
 * The top of a library: what this person's games add up to.
 *
 * ## Written, then ruled, then the two ends of the scale
 *
 * It opens as a sentence — "142 games logged, 38 reviewed. Scores average 78." —
 * because the three numbers that matter most read better as a claim than as
 * three tiles. Under it, a ruled two-column ledger for the rest (physical and
 * digital, finished, 100%, platinum, hours): the same spec-sheet form as the back
 * of a case, and the right shape for figures somebody compares down a column.
 * Then the best and the worst thing they have scored, side by side with their
 * covers — the one part of a record people actually want to see.
 *
 * Deliberately not a grid of big numbers with small labels. That is every
 * dashboard's first draft, and it would give "hours logged" the same weight as
 * "reviews written", which is backwards for an app about criticism.
 *
 * Every figure comes from one aggregate on the server (`user_game_stats`, 0028),
 * so it is exact however long the list below it is.
 */
export function LibraryStats({ stats, loading, failed, onRetry }: LibraryStatsProps) {
  const theme = useTheme();

  if (loading) {
    return (
      <View style={styles.block} accessibilityLabel="Loading stats">
        <Skeleton width="85%" height={17} radius={Radius.sm} />
        <Skeleton width="55%" height={17} radius={Radius.sm} />
        <Skeleton width="100%" height={96} radius={Radius.image} />
      </View>
    );
  }

  if (failed || !stats) {
    return (
      <View style={[styles.block, styles.failed]}>
        <Text variant="bodySmall" color="textMuted">
          Stats didn’t load.
        </Text>
        <PressableScale
          accessibilityRole="button"
          accessibilityLabel="Try loading the stats again"
          onPress={onRetry}
          hitSlop={{ top: 14, bottom: 14, left: 8, right: 8 }}
          scaleTo={0.94}>
          <Text variant="bodySmall" color="primaryText">
            Try again
          </Text>
        </PressableScale>
      </View>
    );
  }

  const ledger: [string, number][] = [
    ['Physical', stats.physical],
    ['Digital', stats.digital],
    ['Finished', stats.finished],
    ['100%', stats.full],
    ['Platinum', stats.platinum],
    ['Hours logged', stats.hours],
  ];

  return (
    <View style={styles.block}>
      <Text variant="h2" accessibilityRole="header">
        {plural(stats.logged, 'game')} logged, {stats.reviews.toLocaleString()} reviewed.
        {stats.average != null ? (
          <>
            {' '}
            Scores average{' '}
            <Text variant="h2" style={{ color: scoreColor(stats.average, theme) }}>
              {stats.average}
            </Text>
            .
          </>
        ) : (
          <Text variant="h2" color="textSecondary">
            {' '}
            Nothing scored yet.
          </Text>
        )}
      </Text>

      <View style={[styles.ledger, { borderTopColor: theme.border }]}>
        {ledger.map(([label, value]) => (
          <View
            key={label}
            style={[styles.entry, { borderBottomColor: theme.border }]}
            accessible
            accessibilityLabel={`${label}: ${value.toLocaleString()}`}>
            <Text variant="bodySmall" color="textMuted">
              {label}
            </Text>
            <Text variant="h4" style={styles.figure}>
              {value.toLocaleString()}
            </Text>
          </View>
        ))}
      </View>

      {stats.highest && (
        <View style={styles.ends}>
          <End label="Best" game={stats.highest} />
          {/* One rated game is both ends; saying it twice would be a table
              filling its cells rather than a fact. */}
          {stats.lowest && stats.rated > 1 && <End label="Worst" game={stats.lowest} />}
        </View>
      )}
    </View>
  );
}

/** One end of the scale: its cover, what it was, and the score. */
function End({ label, game }: { label: string; game: StatGame }) {
  const theme = useTheme();
  return (
    <Link href={{ pathname: '/game/[id]', params: { id: game.game_id } }} asChild>
      <PressableScale
        accessibilityRole="link"
        accessibilityLabel={`${label}: ${game.title}, scored ${game.rating}`}
        scaleTo={0.97}
        style={StyleSheet.flatten([styles.end, { backgroundColor: theme.surface }])}>
        <Poster
          coverUrl={game.cover_url}
          heroUrl={game.hero_url}
          title={game.title}
          width={44}
          rounded="image"
        />
        <View style={styles.endText}>
          <Text variant="caption" color="textMuted">
            {label}
          </Text>
          <Text variant="h5" numberOfLines={2}>
            {game.title}
          </Text>
          <ScoreBadge score={game.rating} size="small" />
        </View>
      </PressableScale>
    </Link>
  );
}

function plural(count: number, word: string): string {
  return `${count.toLocaleString()} ${count === 1 ? word : `${word}s`}`;
}

const styles = StyleSheet.create({
  block: { gap: Spacing.x16, paddingTop: Spacing.x16, paddingBottom: Spacing.x24 },
  failed: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  /* Two columns of ruled rows: each entry is half the width, so the rules run
     edge to edge in pairs like a printed ledger. */
  ledger: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x24,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  entry: {
    width: '46%',
    flexGrow: 1,
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: Spacing.x8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  figure: { fontVariant: ['tabular-nums'] },
  ends: { flexDirection: 'row', gap: Spacing.x8 },
  end: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x12,
    padding: Spacing.x8,
    borderRadius: Radius.card,
  },
  endText: { flex: 1, gap: 2 },
});
