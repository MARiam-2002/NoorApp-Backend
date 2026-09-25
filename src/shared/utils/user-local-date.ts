import { prisma } from '../../lib/prisma';
import {
  getLocalClock,
  resolveTimezone,
} from '../../services/salawat-reminder.service';

/**
 * Calendar day helpers keyed by the user's IANA timezone (worldwide midnight).
 * Prefer these over getTodayDateOnly() for any per-user daily ledger.
 */

export function dateOnlyFromDayKey(dayKey: string): Date {
  const parts = dayKey.split('-').map(Number);
  const y = parts[0] ?? 1970;
  const m = parts[1] ?? 1;
  const d = parts[2] ?? 1;
  return new Date(Date.UTC(y, m - 1, d));
}

export function localDayKeyForTimezone(timeZone: string, now = new Date()): string {
  return getLocalClock(now, resolveTimezone(timeZone)).dayKey;
}

export type UserLocalCalendarDay = {
  dayKey: string;
  /** UTC midnight Date for Prisma @db.Date keys */
  date: Date;
  timezone: string;
};

/**
 * Resolve today's calendar date in the user's stored IANA timezone.
 * Falls back to Africa/Cairo via resolveTimezone when missing/invalid.
 */
export async function getUserLocalCalendarDay(
  userId: string,
  now = new Date(),
): Promise<UserLocalCalendarDay> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { timezone: true },
  });
  const timezone = resolveTimezone(user?.timezone);
  const dayKey = localDayKeyForTimezone(timezone, now);
  return { dayKey, date: dateOnlyFromDayKey(dayKey), timezone };
}
