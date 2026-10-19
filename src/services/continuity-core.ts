import { createHmac, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { env, ErrorCodes } from '../config';
import { AppError } from '../lib/errors';
import { localDayKeyForTimezone } from '../shared/utils/user-local-date';

export const CONTINUITY_POLICY = {
  version: 1, titleAr: 'استمرارك مع نور', titleEn: 'Your consistency with Noor',
  minimumReadingUnits: 1, eligibleSources: ['QURAN', 'ADHKAR'],
  graceDays: 0, paidRestoration: false, leaderboard: false, awardsPoints: false,
  offlineWindowDays: 7, reminderDelivery: 'SERVER_ONLY', timezonePolicy: 'FIXED_AT_ENROLMENT',
} as const;
export const offlineCompletionSchema = z.object({ context: z.string().min(20).max(1500), completedAt: z.string().datetime({ offset: true }) }).strict();
export type OfflineCompletion = z.infer<typeof offlineCompletionSchema>;
export const continuityPreferencePatchSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(2147483646),
  remindersEnabled: z.boolean().optional(),
  reminderMinutesBeforeMidnight: z.number().int().min(60).max(240).optional(),
}).strict().refine(v => v.remindersEnabled !== undefined || v.reminderMinutesBeforeMidnight !== undefined, 'Empty patch');
export const continuityMonthSchema = z.object({ month: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/).refine(v => Number(v.slice(0, 4)) >= 2000 && Number(v.slice(0, 4)) <= 2100, 'Unsupported year').optional() }).strict();
export function shiftContinuityDay(day: string, amount: number): string {
  const date = new Date(day + 'T12:00:00Z'); date.setUTCDate(date.getUTCDate() + amount); return date.toISOString().slice(0, 10);
}
export function calculateContinuity(days: string[], today: string) {
  const dates = [...new Set(days.filter(d => d <= today))].sort();
  const set = new Set(dates), completedToday = set.has(today);
  let bestStreak = 0, run = 0, previous: string | undefined;
  for (const day of dates) { run = previous && shiftContinuityDay(previous, 1) === day ? run + 1 : 1; bestStreak = Math.max(bestStreak, run); previous = day; }
  let cursor = completedToday ? today : shiftContinuityDay(today, -1), currentStreak = 0;
  while (set.has(cursor)) { currentStreak++; cursor = shiftContinuityDay(cursor, -1); }
  return { currentStreak, bestStreak, totalCompletedDays: dates.length, completedToday,
    lastCompletedDate: dates.at(-1) ?? null, status: completedToday ? 'COMPLETED_TODAY' : currentStreak > 0 ? 'CONTINUE_TODAY' : dates.length ? 'NEW_START' : 'GET_STARTED',
    milestones: [7, 30, 100].map(days => ({ days, achieved: bestStreak >= days })) };
}
/** Binary search the real next date boundary: DST days are not assumed to be 24h. */
export function continuityDayEndsAt(today: string, timezone: string, now = new Date()): Date {
  let low = now.getTime(), high = low + 72 * 3600000;
  if (localDayKeyForTimezone(timezone, now) !== today) throw new Error('Date boundary requires the current local day');
  while (high - low > 1) {
    const mid = Math.floor((low + high) / 2);
    if (localDayKeyForTimezone(timezone, new Date(mid)) <= today) low = mid; else high = mid;
  }
  return new Date(high);
}
type Context = { v: number; sub: string; timezone: string; issuedAt: number; expiresAt: number };
const signature = (body: string) => createHmac('sha256', env.JWT_SECRET).update('noor-continuity-offline-v1:' + body).digest();
export function issueContinuityContext(userId: string, timezone: string, now = new Date()) {
  const payload: Context = { v: 1, sub: userId, timezone, issuedAt: now.getTime(), expiresAt: now.getTime() + 7 * 86400000 };
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return { context: body + '.' + signature(body).toString('base64url'), timezone,
    issuedAt: now.toISOString(), expiresAt: new Date(payload.expiresAt).toISOString(), policy: CONTINUITY_POLICY };
}
export function resolveContinuityCompletionDay(userId: string, timezone: string, offline?: OfflineCompletion, now = new Date()) {
  if (!offline) return { day: localDayKeyForTimezone(timezone, now), completedAt: now };
  const fail = () => new AppError('Offline context invalid, expired or belongs to another account/timezone', 409, ErrorCodes.CONFLICT);
  const parsed = offlineCompletionSchema.parse(offline);
  const parts = parsed.context.split('.');
  if (parts.length !== 2) throw fail();
  const body = parts[0]!, supplied = Buffer.from(parts[1]!, 'base64url'), expected = signature(body);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw fail();
  let context: Context;
  try { context = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')); } catch { throw fail(); }
  if (context.v !== 1 || context.sub !== userId || context.timezone !== timezone || !Number.isFinite(context.issuedAt)
    || !Number.isFinite(context.expiresAt) || context.expiresAt - context.issuedAt !== 7 * 86400000
    || context.issuedAt > now.getTime() || context.expiresAt <= now.getTime()) throw fail();
  const completedAt = new Date(parsed.completedAt);
  // No arbitrary date strings, pre-issue backdating, future days or unbounded replay window.
  if (completedAt.getTime() < context.issuedAt || completedAt.getTime() > now.getTime() + 30000 || completedAt.getTime() >= context.expiresAt) throw fail();
  const day = localDayKeyForTimezone(timezone, completedAt);
  if (day > localDayKeyForTimezone(timezone, now)) throw fail();
  return { day, completedAt };
}
