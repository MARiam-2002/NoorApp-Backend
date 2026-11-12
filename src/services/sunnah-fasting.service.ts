/**
 * Sunnah fasting and Islamic occasions — part of the existing fasting area (next to make-up fasts), sharing its
 * Umm al-Qura calendar and the user's moon-sighting correction (fasting_qada_preferences.hijriOffsetDays).
 * Reminders go out the evening before, at most one per night, and never on a night the make-up reminder already covers.
 */
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { logger } from '../lib/logger';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { getHijriOffsetDays, qadaReminderContext, setHijriOffsetDays } from './fasting-qada.service';
import { isDueAtLocalMinute, REMINDER_LATE_TOLERANCE_MINUTES, PUSH_TTL_SECONDS } from '../shared/utils/reminder-timing';
import { dayKeyForHijri, hijriOfDayKey, isDayKey, shiftDayKey, daysBetween, qadaFastingBlockReason } from '../shared/utils/hijri';
import {
  FASTING_EVIDENCE, FORBIDDEN_FASTS, HIJRI_MONTHS_AR, OCCASIONS, SUNNAH_FASTS, SUNNAH_FAST_TYPES, WEEKDAYS_AR,
  type ForbiddenFast, type Occasion, type SunnahFastType,
} from '../shared/data/sunnah-fasting';

type Db = any;
const evidence = (ids: string[]) => ids.map(id => FASTING_EVIDENCE[id]!);

// ---------------------------------------------------------------- calendar
export function sunnahDay(dayKey: string, offset = 0) {
  const h = hijriOfDayKey(dayKey, offset);
  const weekday = new Date(dayKey + 'T12:00:00Z').getUTCDay();
  const block = qadaFastingBlockReason(dayKey, offset);
  const ramadan = block === 'RAMADAN';
  const forbidden: ForbiddenFast | null = block && block !== 'RAMADAN' ? block : null;
  const fasts: SunnahFastType[] = [];
  if (!ramadan && !forbidden) {
    if (weekday === 1) fasts.push('MONDAY');
    if (weekday === 4) fasts.push('THURSDAY');
    if (h.day >= 13 && h.day <= 15) fasts.push('WHITE_DAYS');
    if (h.month === 12 && h.day === 9) fasts.push('ARAFAH');
    if (h.month === 1 && h.day === 9) fasts.push('TASUA');
    if (h.month === 1 && h.day === 10) fasts.push('ASHURA');
    if (h.month === 10 && h.day >= 2) fasts.push('SIX_SHAWWAL');
  }
  const occasions = OCCASIONS.filter(o => h.month === o.month && h.day >= o.fromDay && h.day <= o.toDay).map(o => o.id);
  return {
    date: dayKey, weekday, weekdayAr: WEEKDAYS_AR[weekday]!,
    hijri: { ...h, monthNameAr: HIJRI_MONTHS_AR[h.month - 1]! },
    ramadan, forbidden: forbidden ? { type: forbidden, titleAr: FORBIDDEN_FASTS[forbidden].titleAr } : null,
    fasts: fasts.map(type => ({ type, titleAr: SUNNAH_FASTS[type].titleAr, shortAr: SUNNAH_FASTS[type].shortAr })),
    occasions,
  };
}

const fastMeta = () => SUNNAH_FAST_TYPES.map(type => ({ type, ...SUNNAH_FASTS[type], evidence: evidence(SUNNAH_FASTS[type].evidence) }));

/** Every day from `from` for `days` days (≤ 62): Hijri date, sunnah fasts, forbidden days, occasions. */
export function getSunnahCalendar(from: string, days: number, offset = 0) {
  if (!isDayKey(from)) throw new AppError('Invalid date', 400, ErrorCodes.VALIDATION_ERROR);
  if (!Number.isInteger(days) || days < 1 || days > 62) throw new AppError('days must be 1..62', 400, ErrorCodes.VALIDATION_ERROR);
  return {
    from, days, hijriOffsetDays: offset,
    items: Array.from({ length: days }, (_, i) => sunnahDay(shiftDayKey(from, i), offset)),
    fastTypes: fastMeta(),
    forbiddenTypes: (Object.keys(FORBIDDEN_FASTS) as ForbiddenFast[]).map(type => ({ type, ...FORBIDDEN_FASTS[type], evidence: evidence(FORBIDDEN_FASTS[type].evidence) })),
  };
}

function occasionRange(o: Occasion, hijriYear: number, offset: number) {
  const start = dayKeyForHijri({ year: hijriYear, month: o.month, day: o.fromDay }, offset);
  let end: string | null;
  if (o.toDay === 30) {
    const nextMonth = o.month === 12 ? { year: hijriYear + 1, month: 1 } : { year: hijriYear, month: o.month + 1 };
    const next = dayKeyForHijri({ ...nextMonth, day: 1 }, offset);
    end = next ? shiftDayKey(next, -1) : null;
  } else end = dayKeyForHijri({ year: hijriYear, month: o.month, day: o.toDay }, offset);
  return start && end ? { startDate: start, endDate: end } : null;
}

const occasionDto = (o: Occasion, range: { startDate: string; endDate: string }, today?: string) => ({
  id: o.id, titleAr: o.titleAr, subtitleAr: o.subtitleAr, deedsAr: o.deedsAr, evidence: evidence(o.evidence),
  hijri: { month: o.month, monthNameAr: HIJRI_MONTHS_AR[o.month - 1], fromDay: o.fromDay, toDay: o.toDay === 30 ? null : o.toDay },
  ...range, days: daysBetween(range.startDate, range.endDate) + 1,
  ...(today ? { daysUntilStart: daysBetween(today, range.startDate), active: today >= range.startDate && today <= range.endDate } : {}),
});

/** All occasions of a Hijri year with their Gregorian dates (with the user's correction). */
export function getOccasions(hijriYear: number, offset = 0, today?: string) {
  if (!Number.isInteger(hijriYear) || hijriYear < 1400 || hijriYear > 1500) throw new AppError('Invalid Hijri year', 400, ErrorCodes.VALIDATION_ERROR);
  return {
    hijriYear, hijriOffsetDays: offset,
    occasions: OCCASIONS.flatMap(o => { const r = occasionRange(o, hijriYear, offset); return r ? [occasionDto(o, r, today)] : []; }),
  };
}

/** Home / fasting card: today, tomorrow, the occasions active today, the next sunnah fast and the next occasion. */
export function getSunnahToday(today: string, offset = 0) {
  if (!isDayKey(today)) throw new AppError('Invalid date', 400, ErrorCodes.VALIDATION_ERROR);
  const t = sunnahDay(today, offset);
  let nextFast: { date: string; daysLeft: number; fasts: ReturnType<typeof sunnahDay>['fasts'] } | null = null;
  for (let i = 1; i <= 60 && !nextFast; i++) {
    const d = sunnahDay(shiftDayKey(today, i), offset);
    if (d.fasts.length) nextFast = { date: d.date, daysLeft: i, fasts: d.fasts };
  }
  const year = t.hijri.year;
  const upcoming = [year, year + 1].flatMap(y => OCCASIONS.flatMap(o => { const r = occasionRange(o, y, offset); return r ? [{ o, r }] : []; }));
  const active = upcoming.filter(x => today >= x.r.startDate && today <= x.r.endDate).map(x => occasionDto(x.o, x.r, today));
  const next = upcoming.filter(x => x.r.startDate > today).sort((a, b) => a.r.startDate.localeCompare(b.r.startDate))[0];
  return {
    today: t, tomorrow: sunnahDay(shiftDayKey(today, 1), offset), hijriOffsetDays: offset,
    activeOccasions: active,
    nextFast,
    nextOccasion: next ? { id: next.o.id, titleAr: next.o.titleAr, startDate: next.r.startDate, daysLeft: daysBetween(today, next.r.startDate) } : null,
  };
}

// ---------------------------------------------------------------- preferences (signed in)
export const sunnahPreferencesSchema = z.object({
  enabled: z.boolean().optional(),
  types: z.array(z.enum(SUNNAH_FAST_TYPES as unknown as [SunnahFastType, ...SunnahFastType[]])).max(7).optional(),
  occasionsEnabled: z.boolean().optional(),
  reminderTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/).optional(),
  hijriOffsetDays: z.number().int().min(-2).max(2).optional(),
}).strict().refine(v => Object.keys(v).length > 0, 'At least one field is required');

const DEFAULTS = { enabled: false, types: [...SUNNAH_FAST_TYPES], occasionsEnabled: true, reminderTime: '21:00' };
const prefDto = (r: any, offset: number, timezone: string) => ({
  enabled: r?.enabled ?? DEFAULTS.enabled, types: r?.types ? [...r.types] : DEFAULTS.types,
  occasionsEnabled: r?.occasionsEnabled ?? DEFAULTS.occasionsEnabled, reminderTime: r?.reminderTime ?? DEFAULTS.reminderTime,
  hijriOffsetDays: offset, timezone, revision: Number(r?.revision ?? 0), androidChannelId: 'sunnah_fasting_v1',
});

async function userTimezone(db: Db, userId: string, lock = false) {
  const rows: any[] = lock ? await db.$queryRaw`SELECT "timezone" FROM "users" WHERE "id"=${userId} FOR UPDATE` : await db.$queryRaw`SELECT "timezone" FROM "users" WHERE "id"=${userId}`;
  if (!rows.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  return resolveTimezone(rows[0].timezone);
}

export async function getSunnahPreferences(userId: string, db: Db = prisma) {
  const timezone = await userTimezone(db, userId);
  const rows: any[] = await db.$queryRaw`SELECT * FROM "sunnah_fasting_preferences" WHERE "userId"=${userId}`;
  return prefDto(rows[0], await getHijriOffsetDays(db, userId), timezone);
}

export async function updateSunnahPreferences(userId: string, raw: unknown, db: Db = prisma) {
  const v = sunnahPreferencesSchema.parse(raw);
  const run = async (tx: Db) => {
    await userTimezone(tx, userId, true);
    const types = v.types ? [...new Set(v.types)] : null;
    await tx.$executeRaw`INSERT INTO "sunnah_fasting_preferences" ("userId","enabled","types","occasionsEnabled","reminderTime","updatedAt")
      VALUES (${userId},${v.enabled ?? DEFAULTS.enabled},${types ?? DEFAULTS.types}::text[],${v.occasionsEnabled ?? DEFAULTS.occasionsEnabled},${v.reminderTime ?? DEFAULTS.reminderTime},CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO UPDATE SET
        "enabled"=COALESCE(${v.enabled ?? null}::boolean,"sunnah_fasting_preferences"."enabled"),
        "types"=COALESCE(${types}::text[],"sunnah_fasting_preferences"."types"),
        "occasionsEnabled"=COALESCE(${v.occasionsEnabled ?? null}::boolean,"sunnah_fasting_preferences"."occasionsEnabled"),
        "reminderTime"=COALESCE(${v.reminderTime ?? null}::text,"sunnah_fasting_preferences"."reminderTime"),
        "revision"="sunnah_fasting_preferences"."revision"+1,"updatedAt"=CURRENT_TIMESTAMP`;
    if (v.hijriOffsetDays !== undefined) await setHijriOffsetDays(tx, userId, v.hijriOffsetDays);
    return getSunnahPreferences(userId, tx);
  };
  return db === prisma ? prisma.$transaction(run) : run(db);
}

// ---------------------------------------------------------------- reminders
type Prefs = ReturnType<typeof prefDto>;
/** What to send tonight (local time = reminderTime) about tomorrow, or null. Pure: used by the runner and tests. */
export function evaluateSunnahReminder(now: Date, timezone: string, prefs: Prefs, qadaCoversTomorrow: boolean) {
  if (!prefs.enabled) return null;
  const clock = getLocalClock(now, timezone);
  const target = Number(prefs.reminderTime.slice(0, 2)) * 60 + Number(prefs.reminderTime.slice(3));
  if (!isDueAtLocalMinute(clock.hour * 60 + clock.minute - target, REMINDER_LATE_TOLERANCE_MINUTES)) return null;
  const tomorrow = sunnahDay(shiftDayKey(clock.dayKey, 1), prefs.hijriOffsetDays);
  if (tomorrow.ramadan || tomorrow.forbidden) return null;
  // SIX_SHAWWAL is a 28-day window: remind only on the eve of its first day (2 Shawwal).
  const fasts = tomorrow.fasts.filter(f => prefs.types.includes(f.type) && (f.type !== 'SIX_SHAWWAL' || tomorrow.hijri.day === 2));
  const occasion = prefs.occasionsEnabled
    ? OCCASIONS.find(o => o.remindEve && o.month === tomorrow.hijri.month && o.fromDay === tomorrow.hijri.day) ?? null : null;
  const dayKey = tomorrow.date, occurrenceKey = `SUNNAH|${dayKey}`;
  if (fasts.length && !qadaCoversTomorrow) {
    // Most specific fast first: Arafah / Ashura / Tasu'a / six of Shawwal / white days before the weekday.
    const order: SunnahFastType[] = ['ARAFAH', 'ASHURA', 'TASUA', 'SIX_SHAWWAL', 'WHITE_DAYS', 'MONDAY', 'THURSDAY'];
    const main = order.find(t => fasts.some(f => f.type === t))!;
    const names = fasts.map(f => f.shortAr);
    return { kind: 'FAST' as const, dayKey, occurrenceKey, fastTypes: fasts.map(f => f.type),
      titleAr: `غدًا ${SUNNAH_FASTS[main].titleAr}${names.length > 1 ? ` (${names.join(' · ')})` : ''}`,
      bodyAr: `${SUNNAH_FASTS[main].reminderBodyAr} إن نويت الصيام فاجعل النية من الليل 🌙` };
  }
  if (occasion) return { kind: 'OCCASION' as const, dayKey, occurrenceKey, occasionId: occasion.id, titleAr: occasion.reminderTitleAr!, bodyAr: occasion.reminderBodyAr! };
  return null;
}

// Test seam: the regression suite replaces `send` so no real notification is sent.
export const sunnahDelivery = { send: sendPushToUser, history: createNotification };

export async function runSunnahFastingReminders(now = new Date()) {
  let cursor = '', claimed = 0, sent = 0;
  for (;;) {
    const users: any[] = await prisma.$queryRaw`SELECT u."id", u."timezone" FROM "users" u JOIN "sunnah_fasting_preferences" p ON p."userId"=u."id"
      WHERE p."enabled"=true AND u."isActive"=true AND u."id">${cursor}
        AND EXISTS (SELECT 1 FROM "device_tokens" d WHERE d."userId"=u."id") ORDER BY u."id" LIMIT 200`;
    if (!users.length) break;
    cursor = users[users.length - 1].id;
    for (const user of users) {
      try {
        const timezone = resolveTimezone(user.timezone);
        const decision = await prisma.$transaction(async (db: any) => {
          const prefs = await getSunnahPreferences(user.id, db);
          const qada = await qadaReminderContext(db, user.id, timezone, now);
          const d = evaluateSunnahReminder(now, timezone, prefs, qada.coversTomorrow);
          if (!d) return null;
          const inserted = await db.$executeRaw`INSERT INTO "sunnah_fasting_send_logs" ("id","userId","occurrenceKey") VALUES (${randomUUID()},${user.id},${d.occurrenceKey}) ON CONFLICT DO NOTHING`;
          return inserted === 1 ? d : null;
        });
        if (!decision) continue;
        claimed++;
        const deepLink = '/fasting/sunnah';
        const data: Record<string, string> = {
          type: 'SUNNAH_FASTING', eventType: 'SUNNAH_FASTING', kind: 'sunnah_fasting_reminder', deepLink,
          reminderKind: decision.kind, fastDate: decision.dayKey,
          ...(decision.kind === 'FAST' ? { fastTypes: decision.fastTypes.join(',') } : { occasionId: decision.occasionId }),
          titleAr: decision.titleAr, bodyAr: decision.bodyAr, timezone, occurrenceKey: decision.occurrenceKey,
          idempotencyKey: decision.occurrenceKey, dedupeKey: `${user.id}|${decision.occurrenceKey}`, source: 'SERVER',
          deliveryMode: 'OS_NOTIFICATION', soundEnabled: 'true', vibrationEnabled: 'true', androidChannelId: 'sunnah_fasting_v1',
          scheduledAtUtc: now.toISOString(), expiresAtUtc: new Date(now.getTime() + PUSH_TTL_SECONDS.SCHEDULED_REMINDER * 1000).toISOString(),
        };
        const result = await sunnahDelivery.send(user.id, { title: decision.titleAr, body: decision.bodyAr, titleAr: decision.titleAr, bodyAr: decision.bodyAr,
          data, nativeSound: 'default', androidChannelId: 'sunnah_fasting_v1', ttlSeconds: PUSH_TTL_SECONDS.SCHEDULED_REMINDER });
        sent += result.sent;
        await sunnahDelivery.history({ userId: user.id, titleAr: decision.titleAr, titleEn: 'Sunnah fasting', bodyAr: decision.bodyAr, bodyEn: decision.bodyAr,
          type: 'GENERAL', deepLink, payload: data }).catch(() => null);
      } catch (error) {
        // The claim stays: an automatic retry could duplicate a delivered message.
        logger.warn('[SunnahFastingReminder] Delivery failed', { userId: user.id, message: error instanceof Error ? error.message : 'unknown' });
      }
    }
    if (users.length < 200) break;
  }
  if (claimed) logger.info('[SunnahFastingReminder] Pass completed', { claimed, sent });
  return { claimed, sent };
}
