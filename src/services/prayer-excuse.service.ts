import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { daysBetween, isDayKey, shiftDayKey } from '../shared/utils/hijri';

/**
 * Excuse mode ("وضع العذر"): a neutral pause of prayer tracking.
 * Days inside a period count as excused, not missed, in Journey / Home statistics.
 * Privacy: no reason is stored. An open period ends by itself after EXCUSE_MAX_OPEN_DAYS days.
 */
export const EXCUSE_MAX_OPEN_DAYS = 40;
export const EXCUSE_MAX_BACKDATE_DAYS = 15;

const dayKeySchema = z.string().refine(isDayKey, 'Expected YYYY-MM-DD');
export const excuseStartSchema = z.object({ startDate: dayKeySchema.optional(), muteReminders: z.boolean().optional() }).strict();
export const excuseEndSchema = z.object({ endDate: dayKeySchema.optional() }).strict();
export const excusePatchSchema = z.object({ muteReminders: z.boolean() }).strict();

export const EXCUSE_COPY = {
  titleAr: 'وضع العذر',
  titleEn: 'Excuse mode',
  descriptionAr: 'يوقف حساب الصلوات في إحصائياتك مؤقتًا دون أن تُحسب فائتة. تبقى الأذكار والدعاء وورد الاستماع متاحة.',
  descriptionEn: 'Pauses prayer tracking in your statistics without counting prayers as missed. Adhkar, dua and listening stay available.',
  endedReminderAr: 'إذا انتهى العذر قبل خروج وقت صلاةٍ فصلِّها.',
} as const;

type PeriodRow = { id: string; startDate: string; endDate: string | null; muteReminders: boolean };

/** Effective last excused day: the stored end, or (while open) today capped at the automatic limit. */
export function effectiveEnd(period: { startDate: string; endDate: string | null }, todayKey: string): string {
  if (period.endDate) return period.endDate;
  const cap = shiftDayKey(period.startDate, EXCUSE_MAX_OPEN_DAYS - 1);
  return todayKey < cap ? todayKey : cap;
}
export function isOpenAndActive(period: { startDate: string; endDate: string | null }, todayKey: string) {
  return period.endDate === null && todayKey <= shiftDayKey(period.startDate, EXCUSE_MAX_OPEN_DAYS - 1);
}

/** Pure: set of excused local day keys between `from` and `to` inclusive. */
export function excusedDaysIn(periods: Array<{ startDate: string; endDate: string | null }>, fromKey: string, toKey: string, todayKey: string) {
  const days = new Set<string>();
  for (const p of periods) {
    const end = effectiveEnd(p, todayKey);
    let cursor = p.startDate > fromKey ? p.startDate : fromKey;
    const last = end < toKey ? end : toKey;
    while (cursor <= last) { days.add(cursor); cursor = shiftDayKey(cursor, 1); }
  }
  return days;
}

async function userClock(db: any, userId: string, now: Date, lock = false) {
  const rows: any[] = lock
    ? await db.$queryRaw`SELECT "timezone" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
    : await db.$queryRaw`SELECT "timezone" FROM "users" WHERE "id" = ${userId}`;
  if (!rows.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  const timezone = resolveTimezone(rows[0].timezone);
  return { timezone, todayKey: getLocalClock(now, timezone).dayKey };
}
async function loadPeriods(db: any, userId: string, limit = 24): Promise<PeriodRow[]> {
  return db.$queryRaw`SELECT "id", "startDate"::text AS "startDate", "endDate"::text AS "endDate", "muteReminders" FROM "prayer_excuse_periods" WHERE "userId" = ${userId} ORDER BY "startDate" DESC LIMIT ${limit}`;
}

function dto(periods: PeriodRow[], todayKey: string, timezone: string) {
  const open = periods.find(p => p.endDate === null) ?? null;
  const active = open && isOpenAndActive(open, todayKey) ? open : null;
  const view = (p: PeriodRow) => {
    const end = effectiveEnd(p, todayKey);
    return { id: p.id, startDate: p.startDate, endDate: p.endDate, effectiveEndDate: end, days: daysBetween(p.startDate, end) + 1,
      open: p.endDate === null, autoEnded: p.endDate === null && !isOpenAndActive(p, todayKey), muteReminders: p.muteReminders };
  };
  return {
    active: Boolean(active),
    current: active ? view(active) : null,
    recent: periods.map(view),
    todayDate: todayKey,
    timezone,
    maxOpenDays: EXCUSE_MAX_OPEN_DAYS,
    maxBackdateDays: EXCUSE_MAX_BACKDATE_DAYS,
    privacy: { reasonStored: false },
    ...EXCUSE_COPY,
  };
}

export async function getPrayerExcuse(userId: string, now = new Date()) {
  const { timezone, todayKey } = await userClock(prisma, userId, now);
  return dto(await loadPeriods(prisma, userId), todayKey, timezone);
}

async function mutate(userId: string, now: Date, write: (db: any, todayKey: string, periods: PeriodRow[]) => Promise<void>) {
  return prisma.$transaction(async (db: any) => {
    const { timezone, todayKey } = await userClock(db, userId, now, true);
    const periods = await loadPeriods(db, userId, 200);
    // An open period past the automatic limit is closed for good at its cap.
    for (const p of periods) {
      if (p.endDate === null && !isOpenAndActive(p, todayKey)) {
        await db.$executeRaw`UPDATE "prayer_excuse_periods" SET "endDate" = ${effectiveEnd(p, todayKey)}::date, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${p.id}`;
        p.endDate = effectiveEnd(p, todayKey);
      }
    }
    await write(db, todayKey, periods);
    return dto(await loadPeriods(db, userId), todayKey, timezone);
  });
}

function conflict(message: string, reason: string) { return new AppError(message, 409, ErrorCodes.CONFLICT, { reason }); }
function invalid(message: string, reason: string) { return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, { reason }); }

export async function startPrayerExcuse(userId: string, raw: unknown, now = new Date()) {
  const v = excuseStartSchema.parse(raw ?? {});
  return mutate(userId, now, async (db, todayKey, periods) => {
    const start = v.startDate ?? todayKey;
    if (start > todayKey) throw invalid('startDate cannot be in the future', 'FUTURE_DAY');
    if (daysBetween(start, todayKey) > EXCUSE_MAX_BACKDATE_DAYS) throw invalid('startDate is too far in the past', 'TOO_OLD');
    if (periods.some(p => p.endDate === null)) throw conflict('Excuse mode is already on', 'ALREADY_ACTIVE');
    if (periods.some(p => p.endDate !== null && p.endDate >= start)) throw conflict('startDate overlaps a previous period', 'OVERLAP');
    await db.$executeRaw`INSERT INTO "prayer_excuse_periods" ("id", "userId", "startDate", "muteReminders") VALUES (${randomUUID()}, ${userId}, ${start}::date, ${v.muteReminders ?? false})`;
  });
}

export async function endPrayerExcuse(userId: string, raw: unknown, now = new Date()) {
  const v = excuseEndSchema.parse(raw ?? {});
  return mutate(userId, now, async (db, todayKey, periods) => {
    const open = periods.find(p => p.endDate === null);
    if (!open) throw conflict('Excuse mode is not on', 'NOT_ACTIVE');
    const end = v.endDate ?? todayKey;
    if (end > todayKey) throw invalid('endDate cannot be in the future', 'FUTURE_DAY');
    if (end < open.startDate) {
      // Ended before it started (turned on by mistake): remove it.
      await db.$executeRaw`DELETE FROM "prayer_excuse_periods" WHERE "id" = ${open.id}`;
      return;
    }
    await db.$executeRaw`UPDATE "prayer_excuse_periods" SET "endDate" = ${end}::date, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${open.id}`;
  });
}

export async function updatePrayerExcuse(userId: string, raw: unknown, now = new Date()) {
  const v = excusePatchSchema.parse(raw);
  return mutate(userId, now, async (db, _today, periods) => {
    const open = periods.find(p => p.endDate === null);
    if (!open) throw conflict('Excuse mode is not on', 'NOT_ACTIVE');
    await db.$executeRaw`UPDATE "prayer_excuse_periods" SET "muteReminders" = ${v.muteReminders}, "updatedAt" = CURRENT_TIMESTAMP WHERE "id" = ${open.id}`;
  });
}

export async function deletePrayerExcusePeriod(userId: string, periodId: string, now = new Date()) {
  z.string().uuid().parse(periodId);
  return mutate(userId, now, async db => {
    const deleted = await db.$executeRaw`DELETE FROM "prayer_excuse_periods" WHERE "userId" = ${userId} AND "id" = ${periodId}`;
    if (deleted !== 1) throw new AppError('Period not found', 404, ErrorCodes.NOT_FOUND);
  });
}

/** Excused local days for statistics. Never throws: statistics fall back to "no excuse" on any error. */
export async function getExcusedDayKeys(userId: string, fromKey: string, toKey: string, todayKey: string): Promise<Set<string>> {
  try {
    const rows: Array<{ startDate: string; endDate: string | null }> = await prisma.$queryRaw`SELECT "startDate"::text AS "startDate", "endDate"::text AS "endDate" FROM "prayer_excuse_periods"
      WHERE "userId" = ${userId} AND "startDate" <= ${toKey}::date AND ("endDate" IS NULL OR "endDate" >= ${fromKey}::date)`;
    return excusedDaysIn(rows, fromKey, toKey, todayKey);
  } catch {
    return new Set();
  }
}

/** SQL fragment semantics for reminder passes: users whose open excuse period mutes prayer reminders. */
export async function mutedPrayerReminderUserIds(userIds: string[], now = new Date()): Promise<Set<string>> {
  if (!userIds.length) return new Set();
  try {
    const earliestStart = shiftDayKey(now.toISOString().slice(0, 10), -(EXCUSE_MAX_OPEN_DAYS));
    const rows: Array<{ userId: string; startDate: string; timezone: string | null }> = await prisma.$queryRaw`SELECT p."userId", p."startDate"::text AS "startDate", u."timezone"
      FROM "prayer_excuse_periods" p JOIN "users" u ON u."id" = p."userId"
      WHERE p."endDate" IS NULL AND p."muteReminders" = true AND p."startDate" >= ${earliestStart}::date AND p."userId" = ANY(${userIds})`;
    const muted = new Set<string>();
    for (const r of rows) {
      const todayKey = getLocalClock(now, resolveTimezone(r.timezone)).dayKey;
      if (r.startDate <= todayKey && isOpenAndActive({ startDate: r.startDate, endDate: null }, todayKey)) muted.add(r.userId);
    }
    return muted;
  } catch {
    return new Set();
  }
}
