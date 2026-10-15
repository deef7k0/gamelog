import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { useSelectable } from '@/components/ui/selectable';
import { Text } from '@/components/ui/text';
import {
  ControlHeight,
  Radius,
  SmallControlRowGap,
  SmallControlSlop,
  Spacing,
} from '@/constants/theme';
import { useAccent } from '@/hooks/use-accent';
import { useEventAttendance } from '@/hooks/use-event-attendance';
import { useTheme } from '@/hooks/use-theme';
import type { GameEvent } from '@/lib/news';
import { remindersAvailable } from '@/lib/reminders';

/**
 * RSVP controls for an event: how you are attending, plus a device reminder.
 *
 * On a News event card. The event's own page carries the same record in its
 * foot bar; both go through `useEventAttendance`, so either can undo the other.
 *
 * RSVP and reminders are deliberately independent. Expo Go on Android cannot
 * schedule local notifications at all, so the reminder button is hidden there
 * rather than offered and then failing — but attending an event is a server-side
 * record and works everywhere.
 */
export function EventRsvp({ event }: { event: GameEvent }) {
  const theme = useTheme();
  const { mine, total, hasReminder, rsvp, reminder, notice } = useEventAttendance(event);

  /** "You and 12 others will be watching" — reads naturally at every count. */
  function attendanceLine(): string | null {
    if (total === 0) return null;
    if (!mine) {
      return `${total} ${total === 1 ? 'person is' : 'people are'} going`;
    }
    const others = total - 1;
    if (others === 0) return 'You are going';
    return `You and ${others} other${others === 1 ? '' : 's'} will be ${
      mine.mode === 'in_person' ? 'there in person' : 'watching'
    }`;
  }

  const line = attendanceLine();

  return (
    <View style={styles.wrapper}>
      <View style={styles.modes}>
        <ModeButton
          icon="tv-outline"
          label="Watching"
          active={mine?.mode === 'livestream'}
          onPress={() => rsvp.mutate(mine?.mode === 'livestream' ? null : 'livestream')}
        />
        <ModeButton
          icon="location-outline"
          label="In person"
          active={mine?.mode === 'in_person'}
          onPress={() => rsvp.mutate(mine?.mode === 'in_person' ? null : 'in_person')}
        />

        {/* Reminders only make sense once you have said you are going, and only
            where the platform can actually schedule one. */}
        {mine && remindersAvailable && (
          <ModeButton
            icon={hasReminder ? 'notifications' : 'notifications-outline'}
            label={hasReminder ? 'Reminder on' : 'Remind me'}
            active={hasReminder}
            onPress={() => reminder.mutate()}
          />
        )}
      </View>

      {line && (
        <View style={styles.attendanceLine}>
          <Ionicons name="people" size={13} color={theme.textMuted} />
          <Text variant="caption" color="textMuted">
            {line}
          </Text>
        </View>
      )}

      {notice && (
        <Text variant="caption" color="textMuted">
          {notice}
        </Text>
      )}

      {/* Where the button above cannot be offered, say why once somebody has
          said they are going — otherwise the reminder is simply missing. */}
      {mine && !remindersAvailable && (
        <Text variant="caption" color="textMuted">
          Reminders need the installed app. Expo Go on Android cannot schedule them.
        </Text>
      )}

      {(rsvp.error || reminder.error) && (
        <Text variant="caption" color="danger">
          {(rsvp.error ?? reminder.error) instanceof Error
            ? (rsvp.error ?? reminder.error)!.message
            : 'Could not update.'}
        </Text>
      )}
    </View>
  );
}

function ModeButton({
  icon,
  label,
  active,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  const theme = useTheme();
  const accent = useAccent();
  const look = useSelectable()(active);

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={0.94}
      hitSlop={SmallControlSlop}
      pressedColor={look.pressedColor}
      focusRing={look.focusRing}
      style={StyleSheet.flatten([styles.mode, look.style])}>
      <Ionicons name={icon} size={15} color={active ? accent.onSurface : theme.textSecondary} />
      <Text variant="bodySmall" color={look.label}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x8, marginTop: Spacing.x4 },
  modes: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    columnGap: Spacing.x8,
    rowGap: SmallControlRowGap,
  },
  /* A toggle pill: `ControlHeight.small`, lit in the app's selected state. */
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4 + 2,
    minHeight: ControlHeight.small,
    paddingVertical: Spacing.x4,
    paddingHorizontal: Spacing.x16,
    borderRadius: Radius.pill,
    borderWidth: 1,
  },
  attendanceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
