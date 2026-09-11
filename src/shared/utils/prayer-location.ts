/**
 * Prayer location helpers: timezone inference + local calendar day.
 * Used by prayer.service only — no second calculation engine.
 */

import { find as findTimezones } from 'geo-tz';
import { DEFAULT_PRAYER_LOCATION } from '../constants/default-location';

/**
 * Resolve IANA timezone for coordinates when Flutter/profile did not send one.
 * Falls back to Cairo only when lookup fails (should be rare over land).
 */
export function inferTimezoneFromCoordinates(
  latitude: number,
  longitude: number,
  fallback = DEFAULT_PRAYER_LOCATION.timezone,
): string {
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return fallback;
  }
  try {
    const zones = findTimezones(latitude, longitude);
    const zone = zones?.[0]?.trim();
    if (zone) {
      // Validate
      Intl.DateTimeFormat('en-US', { timeZone: zone }).format(new Date());
      return zone;
    }
  } catch {
    /* fall through */
  }
  return fallback;
}

/**
 * Calendar Y-M-D parts in a given IANA timezone.
 */
export function getZonedYmd(
  date: Date,
  timeZone: string,
): { year: number; month: number; day: number; dateStr: string } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const dateStr = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  return { year, month, day, dateStr };
}

/**
 * Build a Date that adhan treats as the given local calendar day on UTC hosts
 * (Vercel). Noon UTC avoids DST midnight edge cases for day-of-year math.
 */
export function zonedCalendarDateForAdhan(now: Date, timeZone: string): Date {
  const { year, month, day } = getZonedYmd(now, timeZone);
  return new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
}

export function addCalendarDaysUtcNoon(base: Date, days: number): Date {
  const next = new Date(base.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}
