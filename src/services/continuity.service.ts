import { createHash, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { resolveTimezone } from './salawat-reminder.service';
import { localDayKeyForTimezone } from '../shared/utils/user-local-date';
import { ADHKAR_CATALOG_ITEMS } from '../shared/data/adhkar-catalog';
import { calculateContinuity, continuityDayEndsAt, continuityPreferencePatchSchema, CONTINUITY_POLICY,
  issueContinuityContext, offlineCompletionSchema, type OfflineCompletion, resolveContinuityCompletionDay, shiftContinuityDay } from './continuity-core';

export type ContinuitySettings = { userId: string; timezone: string; remindersEnabled: boolean; reminderMinutesBeforeMidnight: number; revision: number; createdAt: Date; updatedAt: Date; accountTimezone?: string };
const conflict = (message: string) => new AppError(message, 409, ErrorCodes.CONFLICT);
const digest = (value: unknown) => createHash('sha256').update(JSON.stringify(value)).digest('hex');

/** Same owner lock as reading/travel: serializes first insert, credits, preferences and reminders. */
export async function ensureContinuity(tx: any, userId: string, now = new Date()): Promise<ContinuitySettings> {
  const owners = await tx.$queryRaw`SELECT id, timezone FROM users WHERE id = ${userId} FOR UPDATE`;
  if (!owners.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  const rows = await tx.$queryRaw`SELECT * FROM continuity_preferences WHERE "userId" = ${userId}`;
  if (rows[0]) return { ...rows[0], accountTimezone: resolveTimezone(owners[0].timezone) };
  const timezone = resolveTimezone(owners[0].timezone);
  const today = localDayKeyForTimezone(timezone, now);
  const inserted = await tx.$queryRaw`INSERT INTO continuity_preferences ("userId", timezone) VALUES (${userId}, ${timezone}) RETURNING *`;
  // One-time import of actual saved accomplishments, not page views/cosmetic percentages.
  // Existing date-only history cannot be reinterpreted into a different timezone retrospectively.
  await tx.$executeRaw`INSERT INTO continuity_days ("userId", date, "sourceMask")
    SELECT ${userId}, d.date, bit_or(d.mask)::int FROM (
      SELECT date, (CASE WHEN "quranPagesRead" > 0 THEN 1 ELSE 0 END |
        CASE WHEN "morningAdhkarCompleted" OR "eveningAdhkarCompleted" OR "adhkarCompleted" THEN 2 ELSE 0 END) AS mask
        FROM daily_progress WHERE "userId" = ${userId}
      UNION ALL SELECT "completedOn" AS date, 1 AS mask FROM reading_units WHERE "userId" = ${userId}
    ) d WHERE d.mask > 0 AND d.date <= ${today}::date GROUP BY d.date ON CONFLICT DO NOTHING`;
  return { ...inserted[0], accountTimezone: timezone };
}
export async function creditContinuityDay(tx: any, userId: string, day: string, source: 'QURAN' | 'ADHKAR') {
  const rows = await tx.$queryRaw`INSERT INTO continuity_days ("userId", date, "sourceMask") VALUES (${userId}, ${day}::date, ${source === 'QURAN' ? 1 : 2})
    ON CONFLICT ("userId", date) DO UPDATE SET "sourceMask" = continuity_days."sourceMask" | EXCLUDED."sourceMask"
    WHERE continuity_days."sourceMask" <> (continuity_days."sourceMask" | EXCLUDED."sourceMask") RETURNING date`;
  return rows.length > 0;
}
/** Call before inserting reading units so an offline receipt cannot be imported under a second date. */
export async function prepareReadingContinuity(tx: any, userId: string, originalDay: string, offline?: OfflineCompletion, now = new Date(), bounds?: { originalDayOnly?: boolean; offeredAt?: Date }) {
  const settings = await ensureContinuity(tx, userId, now);
  if (offline) {
    const completion = resolveContinuityCompletionDay(userId, settings.timezone, offline, now);
    if (bounds?.offeredAt && completion.completedAt < bounds.offeredAt) throw conflict('Completion predates the offered reading session');
    if (bounds?.originalDayOnly && localDayKeyForTimezone(settings.accountTimezone!, completion.completedAt) !== originalDay) throw conflict('Ordinary reader receipt must belong to the current reading day; use an issued session for delayed past-day work');
    return completion.day;
  }
  const today = localDayKeyForTimezone(settings.timezone, now);
  // Legacy issued reading sessions retain their verified original date. New clients use the signed receipt.
  if (originalDay === localDayKeyForTimezone(settings.accountTimezone!, now)) return today;
  if (originalDay > today || originalDay < shiftContinuityDay(today, -7)) return null;
  return originalDay;
}
export async function recordCompletedAdhkarForContinuity(userId: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const settings = await ensureContinuity(tx, userId, now);
    await creditContinuityDay(tx, userId, localDayKeyForTimezone(settings.timezone, now), 'ADHKAR');
  });
}
export async function reconcileContinuityToday(tx: any, userId: string, settings: ContinuitySettings, now: Date) {
  const today = localDayKeyForTimezone(settings.timezone, now);
  // Repair a successful legacy progress write whose follow-up credit failed.
  // Only reconcile today's persisted evidence in the same timezone. Never
  // reinterpret travel dates or import session-start dates as extra offline days.
  if (settings.accountTimezone === settings.timezone) {
    await tx.$executeRaw`INSERT INTO continuity_days ("userId", date, "sourceMask")
      SELECT ${userId}, ${today}::date, bit_or(d.mask)::int FROM (
        SELECT (CASE WHEN "quranPagesRead" > 0 THEN 1 ELSE 0 END |
          CASE WHEN "morningAdhkarCompleted" OR "eveningAdhkarCompleted" OR "adhkarCompleted" THEN 2 ELSE 0 END) mask
          FROM daily_progress WHERE "userId" = ${userId} AND date = ${today}::date
        UNION ALL SELECT 1 mask FROM reading_units WHERE "userId" = ${userId} AND "completedOn" = ${today}::date
      ) d HAVING bit_or(d.mask) > 0
      ON CONFLICT ("userId", date) DO UPDATE SET "sourceMask" = continuity_days."sourceMask" | EXCLUDED."sourceMask"
      WHERE continuity_days."sourceMask" <> (continuity_days."sourceMask" | EXCLUDED."sourceMask")`;
  }
}
async function summaryInTransaction(tx: any, userId: string, settings: ContinuitySettings, now: Date) {
  const today = localDayKeyForTimezone(settings.timezone, now);
  await reconcileContinuityToday(tx, userId, settings, now);
  const rows = await tx.$queryRaw`SELECT date::text AS date FROM continuity_days WHERE "userId" = ${userId} AND date <= ${today}::date ORDER BY date`;
  const stats = calculateContinuity(rows.map((r: any) => r.date), today);
  return { available: true, ...stats, today, timezone: settings.timezone, serverTime: now.toISOString(),
    dayEndsAtUtc: continuityDayEndsAt(today, settings.timezone, now).toISOString(),
    preferences: { remindersEnabled: settings.remindersEnabled, reminderMinutesBeforeMidnight: settings.reminderMinutesBeforeMidnight, revision: settings.revision },
    policy: CONTINUITY_POLICY,
    messageAr: stats.completedToday ? 'أنجزت اليوم، نكمل معًا غدًا 🌱' : stats.currentStreak ? 'خطوة بسيطة اليوم تكمل استمرارك 🌱' : 'يوم جديد، نكمّل مع بعض 🌱',
    messageEn: stats.completedToday ? 'Today is complete. Continue tomorrow.' : stats.currentStreak ? 'One small activity today keeps your consistency going.' : 'A new day. Start again with Noor.',
  };
}
export async function getContinuitySummary(userId: string, now = new Date()) {
  return prisma.$transaction(async tx => summaryInTransaction(tx, userId, await ensureContinuity(tx, userId, now), now), { timeout: 15000 });
}
export async function getContinuitySummaryForHome(userId: string) {
  try { return await getContinuitySummary(userId); }
  catch (error) {
    logger.warn('[Continuity] Home summary unavailable', { userId, code: (error as any)?.code ?? 'UNAVAILABLE' });
    return { available: false as const, retryable: true as const };
  }
}
export async function getContinuityCalendar(userId: string, month?: string, now = new Date()) {
  return prisma.$transaction(async tx => {
    const settings = await ensureContinuity(tx, userId, now), today = localDayKeyForTimezone(settings.timezone, now);
    await reconcileContinuityToday(tx, userId, settings, now);
    const selected = month ?? today.slice(0, 7), [year, m] = selected.split('-').map(Number);
    const start = selected + '-01', end = new Date(Date.UTC(year!, m!, 1)).toISOString().slice(0, 10);
    const rows = await tx.$queryRaw<{ date: string; sourceMask: number }[]>`SELECT date::text AS date, "sourceMask" FROM continuity_days WHERE "userId" = ${userId} AND date >= ${start}::date AND date < ${end}::date ORDER BY date`;
    const byDay = new Map(rows.map((r: any) => [r.date, r.sourceMask as number]));
    return { month: selected, today, timezone: settings.timezone, serverTime: now.toISOString(),
      days: Array.from({ length: new Date(Date.UTC(year!, m!, 0)).getUTCDate() }, (_, index) => {
        const date = selected + '-' + String(index + 1).padStart(2, '0'), mask = (byDay.get(date) ?? 0) as number;
        return { date, completed: mask > 0, isToday: date === today, isFuture: date > today,
          sources: [...(mask & 1 ? ['QURAN'] : []), ...(mask & 2 ? ['ADHKAR'] : [])] };
      }) };
  });
}
export async function getContinuityOfflineContext(userId: string, now = new Date()) {
  return prisma.$transaction(async tx => issueContinuityContext(userId, (await ensureContinuity(tx, userId, now)).timezone, now));
}
export async function updateContinuityPreferences(userId: string, raw: unknown, now = new Date()) {
  const patch = continuityPreferencePatchSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const settings = await ensureContinuity(tx, userId, now);
    if (settings.revision !== patch.expectedRevision) throw conflict('Continuity preferences changed. Fetch and reconcile before retrying.');
    const rows = await tx.$queryRaw<ContinuitySettings[]>`UPDATE continuity_preferences SET
      "remindersEnabled" = COALESCE(${patch.remindersEnabled ?? null}::boolean, "remindersEnabled"),
      "reminderMinutesBeforeMidnight" = COALESCE(${patch.reminderMinutesBeforeMidnight ?? null}::int, "reminderMinutesBeforeMidnight"),
      revision = revision + 1, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = ${userId} RETURNING *`;
    return summaryInTransaction(tx, userId, { ...rows[0]!, accountTimezone: settings.accountTimezone }, now);
  });
}
export const continuityAdhkarCategorySchema = z.enum(['MORNING', 'EVENING', 'GENERAL_WIRD']);
type Category = z.infer<typeof continuityAdhkarCategorySchema>;
export const continuityAdhkarCompletionSchema = z.object({
  requestKey: z.string().uuid(), category: continuityAdhkarCategorySchema, targetVersion: z.string().regex(/^[a-f0-9]{64}$/),
  items: z.array(z.object({ itemId: z.string().min(1).max(200), countDone: z.number().int().nonnegative().max(100000) }).strict()).min(1).max(200)
    .refine(v => new Set(v.map(i => i.itemId)).size === v.length, 'Duplicate item IDs'),
  offline: offlineCompletionSchema.optional(),
}).strict();
export async function getContinuityAdhkarTargetFromDb(tx: any, category: Category) {
  const rows: { categoryId: string; itemId: string; repeatCount: number }[] = await tx.$queryRaw`SELECT c.id AS "categoryId", i.id AS "itemId", i."repeatCount"
    FROM dhikr_categories c JOIN dhikr_items i ON i."categoryId" = c.id WHERE c.key::text = ${category} ORDER BY i."orderInCategory", i.id`;
  const selected = category === 'GENERAL_WIRD' ? rows.slice(0, 8) : rows;
  const prefixes = { MORNING: 'm', EVENING: 'e', GENERAL_WIRD: 'g' };
  const requiredItems = selected.length ? selected.map(r => ({ itemId: r.itemId, repeatCount: r.repeatCount }))
    : ADHKAR_CATALOG_ITEMS[category].slice(0, category === 'GENERAL_WIRD' ? 8 : undefined).map(i => ({ itemId: `fb-${prefixes[category]}-${i.orderInCategory}`, repeatCount: i.repeatCount }));
  if (!requiredItems.length || requiredItems.some(i => !Number.isInteger(i.repeatCount) || i.repeatCount < 1)) throw new AppError('Adhkar target unavailable', 503, ErrorCodes.INTERNAL_SERVER_ERROR);
  return { category, targetVersion: digest({ category, requiredItems }), requiredItems, categoryId: selected[0]?.categoryId ?? null,
    progressMode: selected.length ? 'PERSISTED_DHIKR_LEDGER' : 'FALLBACK_CONTINUITY_ONLY' };
}
export async function getContinuityAdhkarTarget(userId: string, category: Category, now = new Date()) {
  return prisma.$transaction(async tx => { await ensureContinuity(tx, userId, now); return getContinuityAdhkarTargetFromDb(tx, category); });
}
export async function completeContinuityAdhkar(userId: string, raw: unknown, now = new Date()) {
  const input = continuityAdhkarCompletionSchema.parse(raw);
  // Canonical ordering makes harmless client item-order differences idempotent.
  const fingerprint = digest({ ...input, items: [...input.items].sort((a, b) => a.itemId.localeCompare(b.itemId)) });
  return prisma.$transaction(async tx => {
    const settings = await ensureContinuity(tx, userId, now);
    const prior = await tx.$queryRaw<{ fingerprint: string; result: any }[]>`SELECT fingerprint, result FROM continuity_operations WHERE "userId" = ${userId} AND "requestKey" = ${input.requestKey}`;
    if (prior[0]) { if (prior[0].fingerprint !== fingerprint) throw conflict('Request key was used for another completion'); return prior[0].result; }
    const { day } = resolveContinuityCompletionDay(userId, settings.timezone, input.offline, now);
    const target = await getContinuityAdhkarTargetFromDb(tx, input.category);
    if (target.targetVersion !== input.targetVersion) throw conflict('Adhkar target changed. Refresh before confirming.');
    const counts = new Map(input.items.map(i => [i.itemId, i.countDone]));
    if (input.items.length !== target.requiredItems.length || target.requiredItems.some(i => (counts.get(i.itemId) ?? -1) < i.repeatCount)) throw new AppError('The complete offered Adhkar portion is required', 400, ErrorCodes.VALIDATION_ERROR);
    if (target.categoryId) {
      // Max merge, never sum a replay or erase a higher count from another device.
      for (const item of target.requiredItems) await tx.$executeRaw`INSERT INTO daily_dhikr_completions
        (id, "userId", date, "categoryId", "itemId", "countDone", "updatedAt")
        VALUES (${randomUUID()}, ${userId}, ${day}::date, ${target.categoryId}, ${item.itemId}, ${item.repeatCount}, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", date, "categoryId", "itemId") DO UPDATE SET "countDone" = GREATEST(daily_dhikr_completions."countDone", EXCLUDED."countDone"), "updatedAt" = CURRENT_TIMESTAMP`;
      const morning = input.category !== 'EVENING', evening = input.category !== 'MORNING', both = input.category === 'GENERAL_WIRD';
      await tx.$executeRaw`INSERT INTO daily_progress (id, "userId", date, "morningAdhkarCompleted", "eveningAdhkarCompleted", "adhkarCompleted", "updatedAt")
        VALUES (${randomUUID()}, ${userId}, ${day}::date, ${morning}, ${evening}, ${both}, CURRENT_TIMESTAMP)
        ON CONFLICT ("userId", date) DO UPDATE SET "morningAdhkarCompleted" = daily_progress."morningAdhkarCompleted" OR EXCLUDED."morningAdhkarCompleted",
          "eveningAdhkarCompleted" = daily_progress."eveningAdhkarCompleted" OR EXCLUDED."eveningAdhkarCompleted",
          "adhkarCompleted" = daily_progress."adhkarCompleted" OR EXCLUDED."adhkarCompleted" OR
            ((daily_progress."morningAdhkarCompleted" OR EXCLUDED."morningAdhkarCompleted") AND (daily_progress."eveningAdhkarCompleted" OR EXCLUDED."eveningAdhkarCompleted")), "updatedAt" = CURRENT_TIMESTAMP`;
    }
    const changed = await creditContinuityDay(tx, userId, day, 'ADHKAR');
    const result = { creditedDate: day, timezone: settings.timezone, dayChanged: changed, globalAdhkarCredit: !!target.categoryId,
      summary: await summaryInTransaction(tx, userId, settings, now) };
    await tx.$executeRaw`INSERT INTO continuity_operations ("userId", "requestKey", fingerprint, result) VALUES (${userId}, ${input.requestKey}, ${fingerprint}, ${JSON.stringify(result)}::jsonb)`;
    return result;
  }, { timeout: 30000 });
}
export async function getContinuityShare(userId: string, now = new Date()) {
  const summary = await getContinuitySummary(userId, now);
  return { titleAr: 'استمراري مع نور', titleEn: 'My consistency with Noor', currentStreak: summary.currentStreak,
    bestStreak: summary.bestStreak, totalCompletedDays: summary.totalCompletedDays,
    textAr: `استمراري مع نور: ${summary.currentStreak} يومًا متتاليًا 🌱`,
    textEn: `My consistency with Noor: ${summary.currentStreak} consecutive days.`,
    includesWorshipDetails: false, generatedAt: now.toISOString() };
}
