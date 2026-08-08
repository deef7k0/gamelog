import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, MIN_SCORE, clampScore, labelFor, scoreColor } from '@/constants/score';
import { FontFamily, Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const TRACK_HEIGHT = 14;
const DEFAULT_SCORE = 75;

export type ScoreInputProps = {
  /** 0-100, or null when unrated. */
  value: number | null;
  onChange: (value: number | null) => void;
  /**
   * Read-only: the score is derived from something else (advanced metrics), so
   * the track, the nudges and the clear button all go away. The readout stays at
   * full strength — it is still the headline number, just no longer editable.
   */
  disabled?: boolean;
  /** Replaces the "out of 100" sub-line. */
  hint?: string;
};

/**
 * Score picker: a big number, its verdict, a draggable track, and ±1 nudges.
 *
 * The track uses React Native's responder props directly rather than a
 * PanResponder or a slider dependency. PanResponder has to be created once and
 * held, which means either a stale `onChange` closure or writing a ref during
 * render (which the React Compiler rules reject); responder props are read
 * fresh at event time, so neither problem exists.
 *
 * The ± buttons are not redundant with the drag: hitting exactly 87 by dragging
 * on a phone-width track is impossible, and precise scores are the entire point
 * of a 100-point scale.
 */
export function ScoreInput({ value, onChange, disabled = false, hint }: ScoreInputProps) {
  const theme = useTheme();
  const [trackWidth, setTrackWidth] = useState(0);

  const score = value ?? DEFAULT_SCORE;
  const tint = value === null ? theme.textMuted : scoreColor(score, theme);

  function handleTrack(event: GestureResponderEvent) {
    if (trackWidth <= 0) return;
    onChange(clampScore((event.nativeEvent.locationX / trackWidth) * MAX_SCORE));
  }

  function nudge(delta: number) {
    onChange(clampScore(score + delta));
  }

  const filled = value === null ? 0 : (score - MIN_SCORE) / (MAX_SCORE - MIN_SCORE);

  return (
    <View style={styles.wrapper}>
      <View style={styles.readout}>
        <Text style={[styles.number, { color: tint }]}>{value === null ? '—' : score}</Text>

        <View style={styles.readoutText}>
          <Text variant="heading" style={{ color: tint }}>
            {value === null ? 'Not scored' : labelFor(score)}
          </Text>
          <Text variant="micro" color="textMuted">
            {hint ?? (value === null ? 'Tap the bar to score' : 'out of 100')}
          </Text>
        </View>

        {value !== null && !disabled && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Clear score"
            onPress={() => onChange(null)}
            scaleTo={0.85}>
            <Ionicons name="close-circle" size={22} color={theme.textMuted} />
          </PressableScale>
        )}
      </View>

      {/* Responder props are omitted entirely rather than no-op'd when disabled,
          so the track does not swallow touches meant for the scroll view. */}
      <View
        style={[
          styles.track,
          { backgroundColor: theme.surfaceElevated, opacity: disabled ? 0.55 : 1 },
        ]}
        onLayout={(event) => setTrackWidth(event.nativeEvent.layout.width)}
        {...(disabled
          ? null
          : {
              onStartShouldSetResponder: () => true,
              onMoveShouldSetResponder: () => true,
              onResponderGrant: handleTrack,
              onResponderMove: handleTrack,
            })}
        accessibilityRole={disabled ? 'progressbar' : 'adjustable'}
        accessibilityLabel="Score"
        accessibilityValue={{ min: MIN_SCORE, max: MAX_SCORE, now: value ?? undefined }}>
        <View
          style={[styles.fill, { width: `${filled * 100}%`, backgroundColor: tint }]}
          pointerEvents="none"
        />
      </View>

      {!disabled && (
        <View style={styles.nudges}>
          <Nudge label="−10" onPress={() => nudge(-10)} />
          <Nudge label="−1" onPress={() => nudge(-1)} />
          <View style={styles.spacer} />
          <Nudge label="+1" onPress={() => nudge(1)} />
          <Nudge label="+10" onPress={() => nudge(10)} />
        </View>
      )}
    </View>
  );
}

function Nudge({ label, onPress }: { label: string; onPress: () => void }) {
  const theme = useTheme();
  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={`Adjust score by ${label}`}
      onPress={onPress}
      scaleTo={0.9}
      style={StyleSheet.flatten([styles.nudge, { borderColor: theme.border }])}>
      <Text variant="caption" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x12 },
  readout: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  number: { fontSize: 46, fontFamily: FontFamily.bold, minWidth: 86 },
  readoutText: { flex: 1, gap: 1 },
  track: {
    height: TRACK_HEIGHT,
    borderRadius: Radius.pill,
    overflow: 'hidden',
    justifyContent: 'center',
  },
  fill: { height: '100%', borderRadius: Radius.pill },
  nudges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  spacer: { flex: 1 },
  nudge: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 50,
    alignItems: 'center',
  },
});
