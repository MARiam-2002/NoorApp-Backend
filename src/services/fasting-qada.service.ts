import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { env, ErrorCodes } from '../config';
import { logger } from '../lib/logger';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { sendPushToUser } from './device.service';
import { isDueAtLocalMinute, REMINDER_LATE_TOLERANCE_MINUTES, PUSH_TTL_SECONDS } from '../shared/utils/reminder-timing';
import {
  daysBetween, hijriOfDayKey, isDayKey, qadaFastingBlockReason, ramadanStartDayKey, RAMADAN_MONTH, shiftDayKey,
  type FastingBlockReason,
} from '../shared/utils/hijri';

/**
 * Fasting qada ledger ("دفتر القضاء").
 * Privacy: the reason a fast was missed is never sent or stored. Rows hold day counts only.
 * Balances are computed on read: owed per Ramadan year (missed + adjustments), minus fidya days,
 * then made-up days are applied to the oldest year first.
 */

export const QADA_LIMITS = { maxAdjustmentDays: 400, maxEstimateYears: 80, maxEventsPage: 100, minHijriYear: 1300 } as const;

const timeSchema = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const requestKeySchema = z.string().trim().min(8).max(100);
export const qadaPreferencesPatchSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(2147483646).optional(),
  remindersEnabled: z.boolean().optional(),
  reminderTime: timeSchema.optional(),
  fastingWeekdays: z.array(z.number().int().min(0).max(6)).min(1).max(7).optional(),
  hijriOffsetDays: z.number().int().min(-2).max(2).optional(),
}).strict().refine(v => Object.keys(v).some(k => k !== 'expectedRevision'), 'Empty patch');
export const qadaAdjustmentSchema = z.object({
  hijriYear: z.number().int().min(QADA_LIMITS.minHijriYear),
  days: z.number().int().min(-QADA_LIMITS.maxAdjustmentDays).max(QADA_LIMITS.maxAdjustmentDays).refine(v => v !== 0, 'days must not be 0'),
  requestKey: requestKeySchema,
}).strict();
export const qadaFidyaSchema = z.object({
  hijriYear: z.number().int().min(QADA_LIMITS.minHijriYear),
  days: z.number().int().min(1).max(QADA_LIMITS.maxAdjustmentDays),
  requestKey: requestKeySchema,
}).strict();
export const qadaEstimateSchema = z.object({
  fromHijriYear: z.number().int().min(QADA_LIMITS.minHijriYear),
  toHijriYear: z.number().int().min(QADA_LIMITS.minHijriYear),
  daysPerYear: z.number().int().min(1).max(30),
  apply: z.boolean().optional(),
  requestKey: requestKeySchema.optional(),
}).strict().refine(v => v.toHijriYear >= v.fromHijriYear, 'toHijriYear must be >= fromHijriYear')
  .refine(v => v.toHijriYear - v.fromHijriYear < QADA_LIMITS.maxEstimateYears, 'Too many years')
  .refine(v => !v.apply || Boolean(v.requestKey), 'requestKey is required when apply is true');
export const qadaEventsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(QADA_LIMITS.maxEventsPage).optional(),
  before: z.string().datetime({ offset: true }).optional(),
}).strict();

export const QADA_COPY = {
  reminderTitleAr: 'تذكير بصيام الغد',
  reminderTitleEn: "Tomorrow's fast",
  reminderBodyAr: 'إن نويت صيام الغد فاجعل النية من الليل 🌙',
  reminderBodyEn: 'If you plan to fast tomorrow, make the intention tonight.',
  forgotCountNoteAr: 'إن لم تتذكر العدد فخذ بغالب ظنك، والأحوط أن تأخذ بالعدد الأكبر.',
  delayNoteAr: 'من أخّر القضاء بغير عذر حتى دخل رمضان التالي فعليه القضاء، واختلف العلماء في وجوب الفدية مع القضاء؛ اسأل من تثق بعلمه أو دار الإفتاء.',
  intentionNoteAr: 'صيام القضاء فرض، فتكون نيته من الليل قبل الفجر.',
  sources: [
    { titleAr: 'سورة البقرة ١٨٤', textAr: 'فَمَن كَانَ مِنكُم مَّرِيضًا أَوْ عَلَىٰ سَفَرٍ فَعِدَّةٌ مِّنْ أَيَّامٍ أُخَرَ' },
    { titleAr: 'صحيح مسلم ٣٣٥', textAr: 'كَانَ يُصِيبُنَا ذَلِكَ فَنُؤْمَرُ بِقَضَاءِ الصَّوْمِ وَلَا نُؤْمَرُ بِقَضَاءِ الصَّلَاةِ' },
    { titleAr: 'صحيح البخاري ١٩٥٠ ومسلم ١١٤٦', textAr: 'كَانَ يَكُونُ عَلَيَّ الصَّوْمُ مِنْ رَمَضَانَ، فَمَا أَسْتَطِيعُ أَنْ أَقْضِيَ إِلَّا فِي شَعْبَانَ' },
  ],
} as const;

type Preferences = { remindersEnabled: boolean; reminderTime: string; fastingWeekdays: number[]; hijriOffsetDays: number; revision: number };
const DEFAULT_PREFERENCES: Preferences = { remindersEnabled: false, reminderTime: '21:00', fastingWeekdays: [1, 4], hijriOffsetDays: 0, revision: 0 };

export type QadaEventRow = {
  id: string; kind: 'RAMADAN_MISSED' | 'MADE_UP' | 'ADJUSTMENT' | 'FIDYA'; hijriYear: number | null; ramadanDay: number | null;
  date: string | null; days: number; source: string | null; createdAt: Date | string;
};

export function fidyaConfig() {
  const amount = env.FIDYA_PER_DAY_AMOUNT ? Number(env.FIDYA_PER_DAY_AMOUNT) : null;
  return { perDayAmount: amount, currency: amount === null ? null : env.FIDYA_CURRENCY || 'EGP', sourceNote: env.FIDYA_SOURCE_NOTE || null };
}

function dayInfo(dayKey: string, offset: number) {
  const hijri = hijriOfDayKey(dayKey, offset);
  const blockedReason: FastingBlockReason | null = qadaFastingBlockReason(dayKey, offset);
  return { date: dayKey, weekday: new Date(dayKey + 'T12:00:00Z').getUTCDay(), hijri, canMakeUp: blockedReason === null, blockedReason };
}

/** First local day of the next Ramadan strictly after `todayKey` (or today's Ramadan start when today is in Ramadan). */
function ramadanContext(todayKey: string, offset: number) {
  const today = hijriOfDayKey(todayKey, offset);
  const inRamadan = today.month === RAMADAN_MONTH;
  const nextYear = today.month < RAMADAN_MONTH ? today.year : today.year + 1;
  const nextRamadanStart = ramadanStartDayKey(nextYear, offset);
  return { today, inRamadan, ramadanDay: inRamadan ? today.day : null, nextRamadanHijriYear: nextYear, nextRamadanStart,
    daysUntilNextRamadan: daysBetween(todayKey, nextRamadanStart),
    /** Latest Ramadan whose first day is today or earlier: the newest year a debt can belong to. */
    latestStartedRamadanYear: today.month >= RAMADAN_MONTH ? today.year : today.year - 1 };
}

/** Pure balance computation (unit tested). */
export function computeQadaSummary(events: QadaEventRow[], prefs: Preferences, todayKey: string) {
  const offset = prefs.hijriOffsetDays;
  const ctx = ramadanContext(todayKey, offset);
  const years = new Map<number, { missed: number; adjusted: number; fidya: number }>();
  const year = (y: number) => { let row = years.get(y); if (!row) { row = { missed: 0, adjusted: 0, fidya: 0 }; years.set(y, row); } return row; };
  let madeUpTotal = 0;
  const madeUpDates: string[] = [];
  for (const e of events) {
    if (e.kind === 'MADE_UP') { madeUpTotal += 1; if (e.date) madeUpDates.push(e.date); continue; }
    if (e.hijriYear === null) continue;
    if (e.kind === 'RAMADAN_MISSED') year(e.hijriYear).missed += 1;
    else if (e.kind === 'ADJUSTMENT') year(e.hijriYear).adjusted += e.days;
    else if (e.kind === 'FIDYA') year(e.hijriYear).fidya += e.days;
  }
  let pool = madeUpTotal;
  const byYear = [...years.entries()].sort((a, b) => a[0] - b[0]).map(([hijriYear, r]) => {
    const owedDays = Math.max(0, r.missed + r.adjusted);
    const fidyaDays = Math.min(r.fidya, owedDays);
    const toFast = owedDays - fidyaDays;
    const madeUpDays = Math.min(pool, toFast);
    pool -= madeUpDays;
    const remainingDays = toFast - madeUpDays;
    const deadline = ramadanStartDayKey(hijriYear + 1, offset);
    return { hijriYear, ramadanMissedDays: r.missed, adjustmentDays: r.adjusted, owedDays, fidyaDays, madeUpDays, remainingDays,
      deadline, overdue: remainingDays > 0 && todayKey >= deadline };
  });
  const remainingDays = byYear.reduce((s, y) => s + y.remainingDays, 0);
  const overdueDays = byYear.filter(y => y.overdue).reduce((s, y) => s + y.remainingDays, 0);
  // Days left before the next Ramadan on which a make-up fast is allowed (Eid / Tashreeq excluded).
  let availableFastingDays = 0;
  if (!ctx.inRamadan) {
    for (let d = 0; d < ctx.daysUntilNextRamadan; d++) if (!qadaFastingBlockReason(shiftDayKey(todayKey, d), offset)) availableFastingDays++;
  }
  const weeks = availableFastingDays / 7;
  const suggestedDaysPerWeek = remainingDays === 0 || ctx.inRamadan ? 0 : Math.min(7, Math.ceil((remainingDays / Math.max(weeks, 1 / 7)) * 10) / 10);
  const tomorrowKey = shiftDayKey(todayKey, 1);
  return {
    remainingDays,
    overdueDays,
    madeUpTotalDays: madeUpTotal,
    extraMadeUpDays: pool,
    byYear,
    today: { ...dayInfo(todayKey, offset), madeUp: madeUpDates.includes(todayKey) },
    tomorrow: { ...dayInfo(tomorrowKey, offset), madeUp: madeUpDates.includes(tomorrowKey) },
    ramadan: { inRamadan: ctx.inRamadan, ramadanDay: ctx.ramadanDay, currentHijriYear: ctx.today.year,
      latestStartedRamadanYear: ctx.latestStartedRamadanYear, nextRamadanHijriYear: ctx.nextRamadanHijriYear,
      nextRamadanStart: ctx.nextRamadanStart, daysUntilNextRamadan: ctx.daysUntilNextRamadan },
    pace: { availableFastingDays, suggestedDaysPerWeek, feasible: remainingDays <= availableFastingDays || ctx.inRamadan },
    fidya: { ...fidyaConfig(), coveredDays: byYear.reduce((s, y) => s + y.fidyaDays, 0) },
    notes: { delayAr: overdueDays > 0 ? QADA_COPY.delayNoteAr : null, intentionAr: QADA_COPY.intentionNoteAr, forgotCountAr: QADA_COPY.forgotCountNoteAr },
    sources: QADA_COPY.sources,
    preferences: prefs,
    privacy: { reasonStored: false },
  };
}

/** Rounded-up estimate for "I don't remember how many days" (pure). */
export function estimateQadaDays(fromHijriYear: number, toHijriYear: number, daysPerYear: number) {
  const years = toHijriYear - fromHijriYear + 1;
  return { years, daysPerYear, estimatedDays: years * daysPerYear, noteAr: QADA_COPY.forgotCountNoteAr };
}

async function loadUser(db: any, userId: string, lock = false) {
  const rows: any[] = lock
    ? await db.$queryRaw`SELECT u."id", u."timezone" FROM "users" u WHERE u."id" = ${userId} FOR UPDATE`
    : await db.$queryRaw`SELECT u."id", u."timezone" FROM "users" u WHERE u."id" = ${userId}`;
  if (!rows.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  return { timezone: resolveTimezone(rows[0].timezone) };
}
async function loadPreferences(db: any, userId: string): Promise<Preferences> {
  const rows: any[] = await db.$queryRaw`SELECT "remindersEnabled", "reminderTime", "fastingWeekdays", "hijriOffsetDays", "revision" FROM "fasting_qada_preferences" WHERE "userId" = ${userId}`;
  if (!rows.length) return { ...DEFAULT_PREFERENCES };
  const r = rows[0];
  return { remindersEnabled: r.remindersEnabled, reminderTime: r.reminderTime, fastingWeekdays: [...r.fastingWeekdays].map(Number).sort(), hijriOffsetDays: Number(r.hijriOffsetDays), revision: Number(r.revision) };
}
async function loadEvents(db: any, userId: string): Promise<QadaEventRow[]> {
  return db.$queryRaw`SELECT "id", "kind", "hijriYear", "ramadanDay", "date"::text AS "date", "days", "source", "createdAt" FROM "fasting_qada_events" WHERE "userId" = ${userId} ORDER BY "createdAt", "id"`;
}
function todayKeyFor(timezone: string, now: Date) { return getLocalClock(now, timezone).dayKey; }

async function summaryWith(db: any, userId: string, now: Date) {
  const { timezone } = await loadUser(db, userId);
  const [prefs, events] = await Promise.all([loadPreferences(db, userId), loadEvents(db, userId)]);
  return { timezone, ...computeQadaSummary(events, prefs, todayKeyFor(timezone, now)) };
}

export async function getQadaSummary(userId: string, now = new Date()) {
  return summaryWith(prisma, userId, now);
}

export async function listQadaEvents(userId: string, raw: unknown) {
  const q = qadaEventsQuerySchema.parse(raw ?? {});
  await loadUser(prisma, userId);
  const limit = q.limit ?? 50;
  const before = q.before ? new Date(q.before) : new Date('9999-12-31T00:00:00Z');
  const rows: QadaEventRow[] = await prisma.$queryRaw`SELECT "id", "kind", "hijriYear", "ramadanDay", "date"::text AS "date", "days", "source", "createdAt" FROM "fasting_qada_events" WHERE "userId" = ${userId} AND "createdAt" < ${before} ORDER BY "createdAt" DESC, "id" DESC LIMIT ${limit + 1}`;
  const items = rows.slice(0, limit).map(r => ({ ...r, createdAt: new Date(r.createdAt).toISOString() }));
  return { items, nextBefore: rows.length > limit ? items[items.length - 1]!.createdAt : null };
}

/** Writes run under the user row lock so balances, uniqueness and reminder decisions stay consistent. */
async function mutate(userId: string, now: Date, write: (db: any, ctx: { todayKey: string; prefs: Preferences }) => Promise<void>) {
  return prisma.$transaction(async (db: any) => {
    const { timezone } = await loadUser(db, userId, true);
    const prefs = await loadPreferences(db, userId);
    await write(db, { todayKey: todayKeyFor(timezone, now), prefs });
    return summaryWith(db, userId, now);
  });
}

function badRequest(message: string, reason?: string) {
  return new AppError(message, 400, ErrorCodes.VALIDATION_ERROR, reason ? { reason } : undefined);
}
function assertDebtYear(hijriYear: number, todayKey: string, offset: number) {
  const { latestStartedRamadanYear } = ramadanContext(todayKey, offset);
  if (hijriYear > latestStartedRamadanYear) throw badRequest('Ramadan of this Hijri year has not started yet', 'RAMADAN_NOT_STARTED');
}

export function parseRamadanDayParams(rawYear: string, rawDay: string) {
  const v = z.object({ hijriYear: z.coerce.number().int().min(QADA_LIMITS.minHijriYear).max(1600), ramadanDay: z.coerce.number().int().min(1).max(30) }).parse({ hijriYear: rawYear, ramadanDay: rawDay });
  return v;
}

export async function markRamadanDayMissed(userId: string, hijriYear: number, ramadanDay: number, now = new Date()) {
  return mutate(userId, now, async (db, { todayKey, prefs }) => {
    assertDebtYear(hijriYear, todayKey, prefs.hijriOffsetDays);
    const ctx = ramadanContext(todayKey, prefs.hijriOffsetDays);
    if (ctx.inRamadan && hijriYear === ctx.today.year && ramadanDay > ctx.today.day) throw badRequest('This Ramadan day is in the future', 'FUTURE_DAY');
    await db.$executeRaw`INSERT INTO "fasting_qada_events" ("id", "userId", "kind", "hijriYear", "ramadanDay", "days") VALUES (${randomUUID()}, ${userId}, 'RAMADAN_MISSED', ${hijriYear}, ${ramadanDay}, 1) ON CONFLICT DO NOTHING`;
  });
}
export async function unmarkRamadanDayMissed(userId: string, hijriYear: number, ramadanDay: number, now = new Date()) {
  return mutate(userId, now, async db => {
    await db.$executeRaw`DELETE FROM "fasting_qada_events" WHERE "userId" = ${userId} AND "kind" = 'RAMADAN_MISSED' AND "hijriYear" = ${hijriYear} AND "ramadanDay" = ${ramadanDay}`;
  });
}

export function parseMadeUpDate(raw: string) {
  if (!isDayKey(raw)) throw badRequest('date must be YYYY-MM-DD');
  return raw;
}
export async function markMadeUpDay(userId: string, date: string, now = new Date()) {
  return mutate(userId, now, async (db, { todayKey, prefs }) => {
    if (date > todayKey) throw badRequest('A make-up fast cannot be recorded before its day', 'FUTURE_DAY');
    if (date < '2000-01-01') throw badRequest('date is too old');
    const blocked = qadaFastingBlockReason(date, prefs.hijriOffsetDays);
    if (blocked) throw badRequest('Make-up fasting is not allowed on this day: ' + blocked, blocked);
    await db.$executeRaw`INSERT INTO "fasting_qada_events" ("id", "userId", "kind", "date", "days") VALUES (${randomUUID()}, ${userId}, 'MADE_UP', ${date}::date, 1) ON CONFLICT DO NOTHING`;
  });
}
export async function unmarkMadeUpDay(userId: string, date: string, now = new Date()) {
  return mutate(userId, now, async db => {
    await db.$executeRaw`DELETE FROM "fasting_qada_events" WHERE "userId" = ${userId} AND "kind" = 'MADE_UP' AND "date" = ${date}::date`;
  });
}

async function insertCounted(db: any, userId: string, kind: 'ADJUSTMENT' | 'FIDYA', hijriYear: number, days: number, source: string | null, requestKey: string) {
  await db.$executeRaw`INSERT INTO "fasting_qada_events" ("id", "userId", "kind", "hijriYear", "days", "source", "requestKey") VALUES (${randomUUID()}, ${userId}, ${kind}, ${hijriYear}, ${days}, ${source}, ${requestKey}) ON CONFLICT DO NOTHING`;
}
async function alreadyApplied(db: any, userId: string, requestKey: string) {
  const rows: any[] = await db.$queryRaw`SELECT 1 FROM "fasting_qada_events" WHERE "userId" = ${userId} AND ("requestKey" = ${requestKey} OR starts_with("requestKey", ${requestKey + ':'})) LIMIT 1`;
  return rows.length > 0;
}

export async function addQadaAdjustment(userId: string, raw: unknown, now = new Date()) {
  const v = qadaAdjustmentSchema.parse(raw);
  return mutate(userId, now, async (db, { todayKey, prefs }) => {
    if (await alreadyApplied(db, userId, v.requestKey)) return;
    assertDebtYear(v.hijriYear, todayKey, prefs.hijriOffsetDays);
    await insertCounted(db, userId, 'ADJUSTMENT', v.hijriYear, v.days, 'MANUAL', v.requestKey);
  });
}
export async function addQadaFidya(userId: string, raw: unknown, now = new Date()) {
  const v = qadaFidyaSchema.parse(raw);
  return mutate(userId, now, async (db, { todayKey, prefs }) => {
    if (await alreadyApplied(db, userId, v.requestKey)) return;
    assertDebtYear(v.hijriYear, todayKey, prefs.hijriOffsetDays);
    await insertCounted(db, userId, 'FIDYA', v.hijriYear, v.days, null, v.requestKey);
  });
}

export async function estimateQada(userId: string, raw: unknown, now = new Date()) {
  const v = qadaEstimateSchema.parse(raw);
  const estimate = estimateQadaDays(v.fromHijriYear, v.toHijriYear, v.daysPerYear);
  if (!v.apply) {
    const { timezone } = await loadUser(prisma, userId);
    const prefs = await loadPreferences(prisma, userId);
    assertDebtYear(v.toHijriYear, todayKeyFor(timezone, now), prefs.hijriOffsetDays);
    return { estimate, applied: false, summary: null };
  }
  const summary = await mutate(userId, now, async (db, { todayKey, prefs }) => {
    if (await alreadyApplied(db, userId, v.requestKey!)) return;
    assertDebtYear(v.toHijriYear, todayKey, prefs.hijriOffsetDays);
    for (let y = v.fromHijriYear; y <= v.toHijriYear; y++) await insertCounted(db, userId, 'ADJUSTMENT', y, v.daysPerYear, 'ESTIMATE', v.requestKey + ':' + y);
  });
  return { estimate, applied: true, summary };
}

export async function deleteQadaEvent(userId: string, eventId: string, now = new Date()) {
  z.string().uuid().parse(eventId);
  return mutate(userId, now, async db => {
    const deleted = await db.$executeRaw`DELETE FROM "fasting_qada_events" WHERE "userId" = ${userId} AND "id" = ${eventId}`;
    if (deleted !== 1) throw new AppError('Entry not found', 404, ErrorCodes.NOT_FOUND);
  });
}

/** Removes every qada row of this user (ledger, settings, reminder logs). */
export async function resetQada(userId: string, now = new Date()) {
  return mutate(userId, now, async db => {
    await db.$executeRaw`DELETE FROM "fasting_qada_events" WHERE "userId" = ${userId}`;
    await db.$executeRaw`DELETE FROM "fasting_qada_send_logs" WHERE "userId" = ${userId}`;
    await db.$executeRaw`DELETE FROM "fasting_qada_preferences" WHERE "userId" = ${userId}`;
  });
}

export async function updateQadaPreferences(userId: string, raw: unknown, now = new Date()) {
  const v = qadaPreferencesPatchSchema.parse(raw);
  return mutate(userId, now, async (db, { prefs }) => {
    if (v.expectedRevision !== undefined && v.expectedRevision !== prefs.revision) {
      throw new AppError('Preferences changed on another device', 409, ErrorCodes.CONFLICT, { revision: prefs.revision });
    }
    const next = {
      remindersEnabled: v.remindersEnabled ?? prefs.remindersEnabled,
      reminderTime: v.reminderTime ?? prefs.reminderTime,
      fastingWeekdays: v.fastingWeekdays ? [...new Set(v.fastingWeekdays)].sort() : prefs.fastingWeekdays,
      hijriOffsetDays: v.hijriOffsetDays ?? prefs.hijriOffsetDays,
    };
    await db.$executeRaw`INSERT INTO "fasting_qada_preferences" ("userId", "remindersEnabled", "reminderTime", "fastingWeekdays", "hijriOffsetDays", "revision")
      VALUES (${userId}, ${next.remindersEnabled}, ${next.reminderTime}, ${next.fastingWeekdays}::int[], ${next.hijriOffsetDays}, 1)
      ON CONFLICT ("userId") DO UPDATE SET "remindersEnabled" = EXCLUDED."remindersEnabled", "reminderTime" = EXCLUDED."reminderTime",
        "fastingWeekdays" = EXCLUDED."fastingWeekdays", "hijriOffsetDays" = EXCLUDED."hijriOffsetDays",
        "revision" = "fasting_qada_preferences"."revision" + 1, "updatedAt" = CURRENT_TIMESTAMP`;
  });
}

/** Pure reminder decision: evening before a planned fasting weekday, only when something is owed and tomorrow allows qada. */
export function evaluateQadaReminder(now: Date, timezone: string, prefs: Preferences, remainingDays: number, tomorrowMadeUp: boolean) {
  const clock = getLocalClock(now, timezone);
  const tomorrow = shiftDayKey(clock.dayKey, 1);
  const target = Number(prefs.reminderTime.slice(0, 2)) * 60 + Number(prefs.reminderTime.slice(3));
  const due = isDueAtLocalMinute(clock.hour * 60 + clock.minute - target, REMINDER_LATE_TOLERANCE_MINUTES);
  const weekday = new Date(tomorrow + 'T12:00:00Z').getUTCDay();
  const blocked = qadaFastingBlockReason(tomorrow, prefs.hijriOffsetDays);
  return { fastDate: tomorrow, eligible: prefs.remindersEnabled && due && prefs.fastingWeekdays.includes(weekday) && !blocked && remainingDays > 0 && !tomorrowMadeUp };
}

// Test seam: the regression suite replaces `send` so no real notification is sent.
export const qadaReminderDelivery = { send: sendPushToUser };

export async function runFastingQadaReminders(now = new Date()) {
  let cursor = '', claimed = 0, sent = 0;
  for (;;) {
    const users: any[] = await prisma.$queryRaw`SELECT u."id", u."timezone" FROM "users" u JOIN "fasting_qada_preferences" p ON p."userId" = u."id"
      WHERE p."remindersEnabled" = true AND u."isActive" = true AND u."id" > ${cursor}
        AND EXISTS (SELECT 1 FROM "device_tokens" d WHERE d."userId" = u."id") ORDER BY u."id" LIMIT 200`;
    if (!users.length) break;
    cursor = users[users.length - 1].id;
    for (const user of users) {
      try {
        const timezone = resolveTimezone(user.timezone);
        const acquired = await prisma.$transaction(async (db: any) => {
          await loadUser(db, user.id, true);
          const prefs = await loadPreferences(db, user.id);
          const todayKey = todayKeyFor(timezone, now);
          const summary = computeQadaSummary(await loadEvents(db, user.id), prefs, todayKey);
          const decision = evaluateQadaReminder(now, timezone, prefs, summary.remainingDays, summary.tomorrow.madeUp);
          if (!decision.eligible) return null;
          const inserted = await db.$executeRaw`INSERT INTO "fasting_qada_send_logs" ("userId", "fastDate") VALUES (${user.id}, ${decision.fastDate}::date) ON CONFLICT DO NOTHING`;
          return inserted === 1 ? decision.fastDate : null;
        });
        if (!acquired) continue;
        claimed++;
        const occurrenceKey = `FASTING_REMINDER|${acquired}`;
        // Neutral copy only: the notification never says "qada" or why a fast is owed.
        const data: Record<string, string> = {
          type: 'FASTING_REMINDER', eventType: 'FASTING_REMINDER', kind: 'fasting_reminder', deepLink: '/fasting/qada',
          titleAr: QADA_COPY.reminderTitleAr, titleEn: QADA_COPY.reminderTitleEn, bodyAr: QADA_COPY.reminderBodyAr, bodyEn: QADA_COPY.reminderBodyEn,
          fastDate: acquired, timezone, occurrenceKey, idempotencyKey: occurrenceKey, dedupeKey: user.id + '|' + occurrenceKey,
          source: 'SERVER', deliveryMode: 'OS_NOTIFICATION', soundEnabled: 'true', vibrationEnabled: 'true', androidChannelId: 'fasting_reminder_v1',
          scheduledAtUtc: now.toISOString(), expiresAtUtc: new Date(now.getTime() + PUSH_TTL_SECONDS.SCHEDULED_REMINDER * 1000).toISOString(),
        };
        const result = await qadaReminderDelivery.send(user.id, {
          title: QADA_COPY.reminderTitleAr, body: QADA_COPY.reminderBodyAr, titleAr: QADA_COPY.reminderTitleAr, bodyAr: QADA_COPY.reminderBodyAr,
          data, nativeSound: 'default', androidChannelId: 'fasting_reminder_v1', ttlSeconds: PUSH_TTL_SECONDS.SCHEDULED_REMINDER,
        });
        sent += result.sent;
        await prisma.$executeRaw`UPDATE "fasting_qada_send_logs" SET "status" = ${result.sent > 0 ? 'SENT' : 'FAILED'}, "sent" = ${result.sent} WHERE "userId" = ${user.id} AND "fastDate" = ${acquired}::date`;
      } catch (error) {
        // The claim stays: an automatic retry could duplicate a delivered message.
        logger.warn('[FastingQadaReminder] Delivery failed', { userId: user.id, message: error instanceof Error ? error.message : 'unknown' });
      }
    }
    if (users.length < 200) break;
  }
  if (claimed) logger.info('[FastingQadaReminder] Pass completed', { claimed, sent });
  return { claimed, sent };
}
