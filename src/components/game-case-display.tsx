import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { GameCase, type GameCaseSize } from '@/components/game-case';
import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { CASE_TEMPLATES, caseKeysFor, platformKeyFor } from '@/constants/platform-cases';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type GameCaseDisplayProps = {
  coverUrl?: string | null;
  heroUrl?: string | null;
  title?: string | null;
  /** Every platform the game is on; drives which cases are offered. */
  platforms?: string[] | null;
  /**
   * The platform the viewer actually played on, if they logged one. Used as the
   * initial selection so your own copy shows in your own format.
   */
  playedOn?: string | null;
  edition?: string | null;
  size?: GameCaseSize;
};

/**
 * A game case plus its platform switcher.
 *
 * The case itself is a controlled, presentational component; selection state
 * lives here so the same picker works on every dedicated game screen without
 * each one reimplementing it.
 */
export function GameCaseDisplay({
  coverUrl,
  heroUrl,
  title,
  platforms,
  playedOn,
  edition,
  size = 'large',
}: GameCaseDisplayProps) {
  const theme = useTheme();

  const available = useMemo(() => caseKeysFor(platforms), [platforms]);

  // Prefer the format the viewer owns, but only if the game is actually on it.
  const initial = useMemo(() => {
    const played = playedOn ? platformKeyFor(playedOn) : null;
    return played && available.includes(played) ? played : available[0];
  }, [playedOn, available]);

  const [selected, setSelected] = useState(initial);

  // `platforms` can arrive after the first render (the detail query resolves
  // later than the cached summary), so fall back rather than render a case the
  // game is not on.
  const active = available.includes(selected) ? selected : available[0];

  return (
    <View style={styles.wrapper}>
      <GameCase
        coverUrl={coverUrl}
        heroUrl={heroUrl}
        platform={active}
        title={title}
        edition={edition}
        size={size}
      />

      {/* Only worth showing when there is genuinely a choice. */}
      {available.length > 1 && (
        <View style={styles.chips}>
          {available.map((key) => {
            const template = CASE_TEMPLATES[key];
            const isActive = key === active;
            return (
              <PressableScale
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`Show ${template.label} case`}
                accessibilityState={{ selected: isActive }}
                onPress={() => setSelected(key)}
                scaleTo={0.92}
                style={StyleSheet.flatten([
                  styles.chip,
                  {
                    backgroundColor: isActive ? `${template.accent}26` : theme.surface,
                    borderColor: isActive ? template.accent : theme.border,
                  },
                ])}>
                <Text
                  variant="micro"
                  style={{ color: isActive ? template.accent : theme.textMuted }}>
                  {template.spineLabel}
                </Text>
              </PressableScale>
            );
          })}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: { alignItems: 'center', gap: Spacing.three },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two, justifyContent: 'center' },
  chip: {
    paddingVertical: Spacing.one + 2,
    paddingHorizontal: Spacing.three,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
