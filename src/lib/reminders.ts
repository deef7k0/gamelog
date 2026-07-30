import { isRunningInExpoGo } from 'expo';
import { Platform } from 'react-native';

/**
 * Local reminders for event start times.
 *
 * These are **local** notifications scheduled on the device, not push.
 *
 * `expo-notifications` cannot be imported at module scope. Its entry point pulls
 * in `DevicePushTokenAutoRegistration.fx`, a side-effect module that registers a
 * push-token listener while it evaluates, and that listener call *throws* on
 * Android under Expo Go (push was removed from Expo Go in SDK 53). A static
 * import therefore takes down every module that transitively imports this file —
 * which is how a reminder helper managed to blank the whole News tab and leave
 * Expo Router reporting "missing the required default export".
 *
 * So the module is loaded lazily, on first use, behind a guard. Everything else
 * on the events surface — RSVP, attendance counts, wall activity — is server
 * side and works in Expo Go regardless.
 */

/** Loaded lazily; a type-position import is erased and costs nothing at runtime. */
type NotificationsApi = typeof import('expo-notifications');

/** How long before the event to fire. */
const LEAD_MINUTES = 30;

/**
 * Whether reminders can work in this build at all.
 *
 * Only Android + Expo Go is hard-blocked: that combination throws on import.
 * Expo Go on iOS merely warns, and local notifications still schedule there, so
 * it stays enabled.
 */
export const remindersAvailable: boolean = !(Platform.OS === 'android' && isRunningInExpoGo());

let modulePromise: Promise<NotificationsApi | null> | null = null;

/**
 * Import `expo-notifications` on demand, returning null when it is unusable.
 *
 * The promise is cached including its failure: a module that throws while
 * evaluating will throw identically on every retry, so re-attempting only costs
 * another exception.
 */
function loadNotifications(): Promise<NotificationsApi | null> {
  if (!remindersAvailable) return Promise.resolve(null);

  modulePromise ??= import('expo-notifications')
    .then((Notifications) => {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowBanner: true,
          shouldShowList: true,
          shouldPlaySound: true,
          shouldSetBadge: false,
        }),
      });
      return Notifications;
    })
    .catch(() => null);

  return modulePromise;
}

async function ensurePermission(Notifications: NotificationsApi): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  // `canAskAgain` is false once the user has denied it at the OS level; asking
  // again would silently resolve denied.
  if (!existing.canAskAgain) return false;

  const requested = await Notifications.requestPermissionsAsync();
  return requested.granted;
}

export type ScheduleResult =
  | { ok: true; notificationId: string; firesAt: Date }
  | { ok: false; reason: 'denied' | 'past' | 'unavailable' };

/**
 * Schedule a reminder ahead of an event.
 *
 * Returns `past` rather than throwing when the lead time has already elapsed —
 * an event starting in ten minutes cannot have a thirty-minute warning, and
 * that is a normal thing for the UI to explain. `unavailable` means the platform
 * cannot schedule at all, which the UI states rather than retrying.
 */
export async function scheduleEventReminder(
  eventName: string,
  startsAt: string
): Promise<ScheduleResult> {
  const Notifications = await loadNotifications();
  if (!Notifications) return { ok: false, reason: 'unavailable' };

  if (!(await ensurePermission(Notifications))) return { ok: false, reason: 'denied' };

  const start = new Date(startsAt).getTime();
  const firesAtMs = start - LEAD_MINUTES * 60_000;
  if (!Number.isFinite(firesAtMs) || firesAtMs <= Date.now()) {
    return { ok: false, reason: 'past' };
  }

  const firesAt = new Date(firesAtMs);

  try {
    if (Platform.OS === 'android') {
      // Android needs a channel or the notification is silently dropped.
      await Notifications.setNotificationChannelAsync('events', {
        name: 'Event reminders',
        importance: Notifications.AndroidImportance.DEFAULT,
      });
    }

    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: eventName,
        body: `Starts in ${LEAD_MINUTES} minutes.`,
        data: { kind: 'event-reminder' },
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.DATE,
        date: firesAt,
        ...(Platform.OS === 'android' ? { channelId: 'events' } : {}),
      },
    });

    return { ok: true, notificationId, firesAt };
  } catch {
    // Scheduling is a nicety; a host that rejects it should not fail the RSVP.
    return { ok: false, reason: 'unavailable' };
  }
}

export async function cancelEventReminder(notificationId: string): Promise<void> {
  const Notifications = await loadNotifications();
  if (!Notifications) return;

  await Notifications.cancelScheduledNotificationAsync(notificationId).catch(() => {
    // Already fired or cancelled — nothing to undo.
  });
}

/** Minutes of warning a reminder gives, for UI copy. */
export const REMINDER_LEAD_MINUTES = LEAD_MINUTES;
