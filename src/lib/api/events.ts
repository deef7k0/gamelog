import type { AttendanceMode, EventAttendanceRow, Profile } from '../database.types';
import type { GameEvent } from '../news/types';
import { supabase } from '../supabase';

/**
 * Event attendance.
 *
 * Events originate from IGDB, which we cannot foreign-key against, so an event
 * is mirrored into our own `events` table the first time anyone RSVPs — the
 * same on-demand caching `games` uses.
 */

export type EventAttendance = {
  /** The viewer's own RSVP, or null if they have not responded. */
  mine: EventAttendanceRow | null;
  livestream: number;
  inPerson: number;
  total: number;
};

/** Mirror an IGDB event locally so attendance rows can reference it. */
export async function cacheEvent(event: GameEvent): Promise<void> {
  const { error } = await supabase.from('events').upsert(
    {
      id: `igdb:${event.id}`,
      source: 'igdb',
      source_id: event.id,
      name: event.name,
      description: event.description,
      starts_at: event.startsAt,
      live_stream_url: event.liveStreamUrl,
      cached_at: new Date().toISOString(),
    },
    { onConflict: 'id' }
  );
  if (error) throw new Error(error.message);
}

/** Counts for an event, plus the viewer's own response. */
export async function getEventAttendance(
  eventId: string,
  viewerId: string | null
): Promise<EventAttendance> {
  const { data, error } = await supabase
    .from('event_attendance')
    .select('*')
    .eq('event_id', eventId);

  if (error) throw new Error(error.message);

  const rows = data ?? [];
  return {
    mine: rows.find((row) => row.user_id === viewerId) ?? null,
    livestream: rows.filter((row) => row.mode === 'livestream').length,
    inPerson: rows.filter((row) => row.mode === 'in_person').length,
    total: rows.length,
  };
}

/**
 * RSVP to an event, or change how you are attending.
 *
 * Caches the event first — the attendance row has a FK to it, and the event may
 * never have been stored before.
 */
export async function setAttendance(
  userId: string,
  event: GameEvent,
  mode: AttendanceMode,
  reminderAt: string | null
): Promise<void> {
  await cacheEvent(event);

  const { error } = await supabase.from('event_attendance').upsert(
    {
      event_id: `igdb:${event.id}`,
      user_id: userId,
      mode,
      reminder_at: reminderAt,
    },
    { onConflict: 'event_id,user_id' }
  );
  if (error) throw new Error(error.message);
}

export async function cancelAttendance(userId: string, eventId: string): Promise<void> {
  const { error } = await supabase
    .from('event_attendance')
    .delete()
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

/** Record (or clear) that a device reminder exists for this RSVP. */
export async function setReminder(
  userId: string,
  eventId: string,
  reminderAt: string | null
): Promise<void> {
  const { error } = await supabase
    .from('event_attendance')
    .update({ reminder_at: reminderAt })
    .eq('user_id', userId)
    .eq('event_id', eventId);
  if (error) throw new Error(error.message);
}

export type EventAttendee = { profile: Profile; mode: AttendanceMode };

/** Who else is going — used for the "you and N others" line. */
export async function getEventAttendees(eventId: string): Promise<EventAttendee[]> {
  const { data, error } = await supabase
    .from('event_attendance')
    .select('mode, profile:profiles!event_attendance_user_id_fkey(*)')
    .eq('event_id', eventId)
    .limit(50);

  if (error) throw new Error(error.message);

  type Row = { mode: AttendanceMode; profile: Profile | null };
  return ((data ?? []) as unknown as Row[])
    .filter((row): row is { mode: AttendanceMode; profile: Profile } => row.profile !== null)
    .map((row) => ({ profile: row.profile, mode: row.mode }));
}
