import Ionicons from '@expo/vector-icons/Ionicons';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PressableScale } from '@/components/ui/pressable-scale';
import { Text } from '@/components/ui/text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { cancelAttendance, getEventAttendance, setAttendance, setReminder } from '@/lib/api';
import type { AttendanceMode } from '@/lib/database.types';
import type { GameEvent } from '@/lib/news';
import {
  REMINDER_LEAD_MINUTES,
  cancelEventReminder,
  remindersAvailable,
  scheduleEventReminder,
} from '@/lib/reminders';
import { useAuth } from '@/store/auth';

/** Why a reminder could not be set, in words the reader can act on. */
const REMINDER_FAILURE: Record<'denied' | 'past' | 'unavailable', string> = {
  denied: 'Allow notifications in your system settings to set reminders.',
  past: `This event starts too soon for a ${REMINDER_LEAD_MINUTES}-minute reminder.`,
  unavailable: 'Reminders need a development build — RSVP still works here.',
};

/**
 * RSVP controls for an event: how you are attending, plus a device reminder.
 *
 * The reminder is a local notification, so its id has to live somewhere on the
 * device to be cancellable. Keeping it in component state is enough for a
 * session; `event_attendance.reminder_at` is what persists the *fact* of a
 * reminder across launches so the toggle renders correctly.
 *
 * RSVP and reminders are deliberately independent. Expo Go on Android cannot
 * schedule local notifications at all, so the reminder button is hidden there
 * rather than offered and then failing — but attending an event is a server-side
 * record and works everywhere.
 */
export function EventRsvp({ event }: { event: GameEvent }) {
  const theme = useTheme();
  const queryClient = useQueryClient();
  const userId = useAuth((state) => state.session?.user.id);
  const eventId = `igdb:${event.id}`;

  const [notificationId, setNotificationId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const attendance = useQuery({
    queryKey: ['event-attendance', eventId, userId],
    queryFn: () => getEventAttendance(eventId, userId ?? null),
    enabled: !!eventId,
  });

  function invalidate() {
    queryClient.invalidateQueries({ queryKey: ['event-attendance', eventId] });
    // The wall shows attendance as activity.
    queryClient.invalidateQueries({ queryKey: ['wall', userId] });
  }

  const rsvp = useMutation({
    mutationFn: async (mode: AttendanceMode | null) => {
      if (!userId) throw new Error('You must be signed in.');

      if (mode === null) {
        // Cancelling attendance should not leave an orphaned reminder firing.
        if (notificationId) {
          await cancelEventReminder(notificationId);
          setNotificationId(null);
        }
        await cancelAttendance(userId, eventId);
        return;
      }

      await setAttendance(userId, event, mode, attendance.data?.mine?.reminder_at ?? null);
    },
    onSuccess: invalidate,
  });

  const reminder = useMutation({
    mutationFn: async () => {
      if (!userId) throw new Error('You must be signed in.');
      setNotice(null);

      // Toggling off.
      if (attendance.data?.mine?.reminder_at) {
        if (notificationId) await cancelEventReminder(notificationId);
        setNotificationId(null);
        await setReminder(userId, eventId, null);
        return;
      }

      if (!event.startsAt) {
        setNotice('This event has no announced start time yet.');
        return;
      }

      const result = await scheduleEventReminder(event.name, event.startsAt);
      if (!result.ok) {
        setNotice(REMINDER_FAILURE[result.reason]);
        return;
      }

      setNotificationId(result.notificationId);
      await setReminder(userId, eventId, result.firesAt.toISOString());
    },
    onSuccess: invalidate,
  });

  const mine = attendance.data?.mine ?? null;
  const total = attendance.data?.total ?? 0;
  const hasReminder = !!mine?.reminder_at;

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

  return (
    <PressableScale
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active }}
      onPress={onPress}
      scaleTo={0.94}
      style={StyleSheet.flatten([
        styles.mode,
        {
          backgroundColor: active ? theme.surfaceSelected : theme.surfaceElevated,
          borderColor: active ? theme.borderStrong : theme.border,
        },
      ])}>
      <Ionicons name={icon} size={15} color={active ? theme.text : theme.textMuted} />
      <Text variant="caption" color={active ? 'text' : 'textMuted'}>
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  wrapper: { gap: Spacing.x8, marginTop: Spacing.x4 },
  modes: { flexDirection: 'row', gap: Spacing.x8, flexWrap: 'wrap' },
  mode: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.x4 + 2,
    paddingVertical: Spacing.x8,
    paddingHorizontal: Spacing.x12,
    borderRadius: Radius.control,
    borderWidth: StyleSheet.hairlineWidth,
  },
  attendanceLine: { flexDirection: 'row', alignItems: 'center', gap: Spacing.x4 },
});
