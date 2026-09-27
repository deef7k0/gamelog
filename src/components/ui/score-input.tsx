import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { StyleSheet, View, type GestureResponderEvent } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { SCORE_TRACK_HEIGHT, ScoreBar, ScoreReadout } from '@/components/ui/score-meter';
import { Text } from '@/components/ui/text';
import { MAX_SCORE, MIN_SCORE, clampScore } from '@/constants/score';
import { Radius, Spacing, TapTarget } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

const DEFAULT_SCORE = 75;

/*
 * The track stays 14dp tall and becomes 44/48 to a thumb.
 *
 * The responder props and the accessibility role live on this padded wrapper,
 * not on the bar, so `locationX` is still measured against the bar's own width
 * (the padding is vertical only — same x origin, same width). DESIGN.md § 23
 * says a control that looks smaller is one whose padding is doing the work;
 * before this the props sat on the 14dp view itself and nothing was.
 */
const TRACK_INSET = (TapTarget - SCORE_TRACK_HEIGHT) / 2;

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
  /** Replaces "out of 100" beside the verdict. */
  hint?: string;
};

/**
 * Score picker: a big number, its verdict, a draggable track, and ±1 nudges.
 *
 * The number, the verdict and the bar are `<ScoreReadout>` and `<ScoreBar>`, the
 * same two the review page reads a score with — so what you set here is drawn
 * exactly as it will be read. This component adds the touch handling around
 * them and nothing visual of its own but the nudges and the clear button.
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

  function handleTrack(event: GestureResponderEvent) {
    if (trackWidth <= 0) return;
    onChange(clampScore((event.nativeEvent.locationX / trackWidth) * MAX_SCORE));
  }

  function nudge(delta: number) {
    onChange(clampScore(score + delta));
  }

  return (
    <View style={styles.wrapper}>
      <View style={styles.readoutRow}>
        <View style={styles.readout}>
          <ScoreReadout
            score={value}
            /* The nudges start from `DEFAULT_SCORE`, so an unscored readout that
               said only "tap the bar" left −1 producing an unexplained 74. */
            hint={
              hint ?? (value === null ? `Tap the bar, or nudge from ${DEFAULT_SCORE}` : undefined)
            }
          />
        </View>

        {value !== null && !disabled && (
          <PressableScale
            accessibilityRole="button"
            accessibilityLabel="Clear score"
            onPress={() => onChange(null)}
            /* A 22dp glyph in a tight row: hitSlop rather than padding, so the
               touch area reaches the floor without moving the readout. */
            hitSlop={(TapTarget - 22) / 2}
            scaleTo={0.85}>
            <Ionicons name="close-circle" size={22} color={theme.textMuted} />
          </PressableScale>
        )}
      </View>

      {/* Responder props are omitted entirely rather than no-op'd when disabled,
          so the track does not swallow touches meant for the scroll view. */}
      <View
        style={styles.trackHit}
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
        accessibilityValue={{ min: MIN_SCORE, max: MAX_SCORE, now: value ?? undefined }}
        /*
         * `adjustable` promises the increment/decrement gesture; without these it
         * announces itself as adjustable and then does nothing when swiped. The
         * drag path is `locationX` on a raw responder, which offers assistive
         * tech nothing at all, so these actions are the *only* way to score a
         * game with a screen reader.
         */
        {...(disabled
          ? null
          : {
              accessibilityActions: [
                { name: 'increment' as const },
                { name: 'decrement' as const },
              ],
              onAccessibilityAction: (event) => {
                if (event.nativeEvent.actionName === 'increment') nudge(1);
                if (event.nativeEvent.actionName === 'decrement') nudge(-1);
              },
            })}>
        <ScoreBar score={value} dim={disabled} />
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
      <Text variant="bodySmall" color="textSecondary">
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  /* The track's own padding is inside `trackHit`, so the gaps here are measured
     against the bar rather than against its touch area. */
  wrapper: { gap: Spacing.x4 },
  /* The readout takes the row; the clear button keeps its own width at the end.
     `center` here, `baseline` inside the readout: the button is a glyph, not a
     line of type, and a glyph has no baseline to share. */
  readoutRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x16 },
  readout: { flex: 1, minWidth: 0 },
  trackHit: { paddingVertical: TRACK_INSET, justifyContent: 'center' },
  nudges: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x8 },
  spacer: { flex: 1 },
  nudge: {
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 50,
    /* The floor, reached by height rather than by padding: growing the padding
       instead would have made a 50dp-wide pill nearly square. */
    minHeight: TapTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
