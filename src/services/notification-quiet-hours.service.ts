import { z } from 'zod';
import { prisma } from '../lib/prisma';

/**
 * One quiet window for every reminder (adhkar, salawat, Quran, hifz, fasting, challenges, continuity…).
 * The Adhan and the reminder before the prayer are never held back: they are what the user set the app for.
 * Times are local to the user's timezone; the window may cross midnight (23:00 → 06:00).
 */
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Use HH:mm');
export const quietHoursPatchSchema = z.object({
  enabled: z.boolean().optional(),
  start: hhmm.optional(),
  end: hhmm.optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'Send at least one field');

export type QuietHours = { enabled: boolean; start: string; end: string };
export const DEFAULT_QUIET_HOURS: QuietHours = { enabled: false, start: '23:00', end: '05:00' };

/** Push data types that always go through, quiet window or not. */
export const QUIET_HOURS_EXEMPT_TYPES = new Set(['AZAN', 'FAJR_ALARM', 'TEST']);

export function normalizeQuietHours(raw: unknown): QuietHours {
  const r = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const ok = (v: unknown) => typeof v === 'string' && hhmm.safeParse(v).success;
  return {
    enabled: typeof r.enabled === 'boolean' ? r.enabled : DEFAULT_QUIET_HOURS.enabled,
    start: ok(r.start) ? (r.start as string) : DEFAULT_QUIET_HOURS.start,
    end: ok(r.end) ? (r.end as string) : DEFAULT_QUIET_HOURS.end,
  };
}

const minutes = (v: string) => Number(v.slice(0, 2)) * 60 + Number(v.slice(3, 5));

/** Local minutes since midnight in an IANA timezone (falls back to Africa/Cairo for an unknown zone). */
export function localMinutes(now: Date, timeZone: string): number {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  } catch {
    parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Cairo', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(now);
  }
  const h = Number(parts.find(p => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find(p => p.type === 'minute')?.value ?? 0);
  return (h % 24) * 60 + m;
}

/** True when `now` falls inside the window. start == end means the window is empty. */
export function isWithinQuietHours(q: QuietHours, now: Date, timeZone: string): boolean {
  if (!q.enabled) return false;
  const s = minutes(q.start), e = minutes(q.end), t = localMinutes(now, timeZone);
  if (s === e) return false;
  return s < e ? t >= s && t < e : t >= s || t < e;
}

export function isQuietHoursExempt(data: Record<string, string> | undefined): boolean {
  const type = String(data?.type ?? '').toUpperCase();
  return QUIET_HOURS_EXEMPT_TYPES.has(type);
}

export async function getQuietHours(userId: string): Promise<QuietHours & { timezone: string }> {
  const u = await prisma.user.findUnique({ where: { id: userId }, select: { notificationQuietHours: true, timezone: true } });
  return { ...normalizeQuietHours(u?.notificationQuietHours), timezone: u?.timezone ?? 'Africa/Cairo' };
}

export async function updateQuietHours(userId: string, body: unknown) {
  const patch = quietHoursPatchSchema.parse(body);
  const current = await getQuietHours(userId);
  const next: QuietHours = {
    enabled: patch.enabled ?? current.enabled,
    start: patch.start ?? current.start,
    end: patch.end ?? current.end,
  };
  await prisma.user.update({ where: { id: userId }, data: { notificationQuietHours: next } });
  return { ...next, timezone: current.timezone };
}

/** For the push path: is this user inside their quiet window right now? Never throws. */
export async function userIsInQuietHours(userId: string, now = new Date()): Promise<boolean> {
  try {
    const u = await prisma.user.findUnique({ where: { id: userId }, select: { notificationQuietHours: true, timezone: true } });
    if (!u) return false;
    return isWithinQuietHours(normalizeQuietHours(u.notificationQuietHours), now, u.timezone || 'Africa/Cairo');
  } catch {
    return false;
  }
}
