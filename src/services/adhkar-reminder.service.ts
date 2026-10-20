import { z } from 'zod';
import { prisma } from '../lib/prisma';
import { AppError } from '../lib/errors';
import { ErrorCodes } from '../config';
import { logger } from '../lib/logger';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { continuityDayEndsAt } from './continuity-core';

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
export const adhkarReminderPatchSchema = z.object({
  expectedRevision: z.number().int().nonnegative().max(2147483646),
  morningEnabled: z.boolean().optional(), morningTime: time.optional(),
  eveningEnabled: z.boolean().optional(), eveningTime: time.optional(), soundEnabled: z.boolean().optional(),
  bedtimeEnabled: z.boolean().optional(), bedtimeTime: time.optional(),
}).strict().refine(v => Object.keys(v).some(k => k !== 'expectedRevision'), 'At least one setting is required');
type Settings = { morningEnabled: boolean; morningTime: string; eveningEnabled: boolean; eveningTime: string; bedtimeEnabled: boolean; bedtimeTime: string; soundEnabled: boolean; revision: number; timezone: string };
export type AdhkarReminderKind = 'MORNING' | 'EVENING' | 'BEFORE_SLEEP';
export const ADHKAR_REMINDER_COPY = {
  MORNING: { titleAr: 'أذكار الصباح', titleEn: 'Morning adhkar', bodyAr: 'وقت هادئ لورد أذكار الصباح 🌿', bodyEn: 'Take a quiet moment for your morning adhkar.' },
  EVENING: { titleAr: 'أذكار المساء', titleEn: 'Evening adhkar', bodyAr: 'لا تنسَ ورد أذكار المساء 🌿', bodyEn: 'A gentle reminder for your evening adhkar.' },
  BEFORE_SLEEP: { titleAr: 'أذكار النوم', titleEn: 'Bedtime adhkar', bodyAr: 'اختم يومك بأذكار النوم 🌙', bodyEn: 'End your day with your bedtime adhkar.' },
};
export function adhkarReminderSettings(row: any): Settings & { deliveryMode: string; skipWhenCompleted: boolean; timezonePolicy: string; updatedAt: string | null } {
  return { morningEnabled: row.morningEnabled ?? false, morningTime: row.morningTime ?? '07:00',
    eveningEnabled: row.eveningEnabled ?? false, eveningTime: row.eveningTime ?? '17:00',
    bedtimeEnabled: row.bedtimeEnabled ?? false, bedtimeTime: row.bedtimeTime ?? '22:00',
    soundEnabled: row.soundEnabled ?? false, revision: row.revision ?? 0,
    timezone: resolveTimezone(row.timezone), deliveryMode: 'SERVER_ONLY', skipWhenCompleted: true,
    timezonePolicy: 'CURRENT_PROFILE_TIMEZONE', updatedAt: row.updatedAt?.toISOString() ?? null };
}
async function read(db: any, userId: string, lock = false) {
  if (lock) {
    const owners = await db.$queryRaw`SELECT id FROM users WHERE id = ${userId} FOR UPDATE`;
    if (!owners.length) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  }
  const rows = await db.$queryRaw`SELECT u.timezone, u."isActive", p.* FROM users u LEFT JOIN adhkar_reminder_preferences p ON p."userId" = u.id WHERE u.id = ${userId}`;
  if (!rows[0]) throw new AppError('User not found', 404, ErrorCodes.NOT_FOUND);
  return rows[0];
}
export async function getAdhkarReminderPreferences(userId: string) { return adhkarReminderSettings(await read(prisma, userId)); }
export async function updateAdhkarReminderPreferences(userId: string, raw: unknown) {
  const patch = adhkarReminderPatchSchema.parse(raw);
  return prisma.$transaction(async tx => {
    const current = adhkarReminderSettings(await read(tx, userId, true));
    if (current.revision !== patch.expectedRevision) throw new AppError('Adhkar reminder settings changed. Fetch current settings before retrying.', 409, ErrorCodes.CONFLICT);
    const v = { ...current, ...patch };
    const rows = await tx.$queryRaw<any[]>`INSERT INTO adhkar_reminder_preferences
      ("userId", "morningEnabled", "morningTime", "eveningEnabled", "eveningTime", "bedtimeEnabled", "bedtimeTime", "soundEnabled", revision, "updatedAt")
      VALUES (${userId}, ${v.morningEnabled}, ${v.morningTime}, ${v.eveningEnabled}, ${v.eveningTime}, ${v.bedtimeEnabled}, ${v.bedtimeTime}, ${v.soundEnabled}, 1, CURRENT_TIMESTAMP)
      ON CONFLICT ("userId") DO UPDATE SET "morningEnabled" = EXCLUDED."morningEnabled", "morningTime" = EXCLUDED."morningTime",
        "eveningEnabled" = EXCLUDED."eveningEnabled", "eveningTime" = EXCLUDED."eveningTime", "soundEnabled" = EXCLUDED."soundEnabled",
        "bedtimeEnabled" = EXCLUDED."bedtimeEnabled", "bedtimeTime" = EXCLUDED."bedtimeTime",
        revision = adhkar_reminder_preferences.revision + 1, "updatedAt" = CURRENT_TIMESTAMP RETURNING *`;
    return adhkarReminderSettings({ ...rows[0], timezone: current.timezone });
  });
}
export function evaluateAdhkarReminder(now: Date, timezone: string, hhmm: string, enabled: boolean, kind: AdhkarReminderKind) {
  const clock = getLocalClock(now, resolveTimezone(timezone));
  const target = Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3));
  const elapsedSeconds = (clock.hour * 60 + clock.minute - target) * 60 + now.getUTCSeconds() + now.getUTCMilliseconds() / 1000;
  return { eligible: enabled && elapsedSeconds >= 0 && elapsedSeconds <= 600, day: clock.dayKey,
    occurrenceKey: `ADHKAR_REMINDER|${clock.dayKey}|${kind}` };
}
/** Only the actual full matching category suppresses this reminder. GENERAL_WIRD
 * forces both legacy flags, so those booleans must not be used as proof here. */
export async function hasCompletedAdhkarReminderCategory(db: any, userId: string, day: string, kind: AdhkarReminderKind): Promise<boolean> {
  const rows = await db.$queryRaw`SELECT EXISTS (
    SELECT 1 FROM dhikr_categories c WHERE c.key::text = ${kind}
      AND EXISTS (SELECT 1 FROM dhikr_items i WHERE i."categoryId" = c.id)
      AND NOT EXISTS (SELECT 1 FROM dhikr_items i WHERE i."categoryId" = c.id AND
        COALESCE((SELECT max(d."countDone") FROM daily_dhikr_completions d WHERE d."userId" = ${userId}
          AND d.date = ${day}::date AND d."categoryId" = c.id AND d."itemId" = i.id), 0) < GREATEST(1, i."repeatCount"))
    ) AS completed`;
  return rows[0]?.completed === true;
}
export const adhkarReminderDelivery = { send: sendPushToUser, history: createNotification };
export async function runAdhkarReminders(now = new Date()) {
  const started = performance.now();
  const decisions = new Map<string, ReturnType<typeof evaluateAdhkarReminder>>();
  let cursor = '', usersScanned = 0, pushesAttempted = 0, pushesSent = 0;
  const skipped = { completed: 0, staleOrDisabled: 0, alreadyClaimed: 0, failed: 0 };
  for (;;) {
    const users: any[] = await prisma.$queryRaw`SELECT u.id, u.timezone, p.* FROM users u JOIN adhkar_reminder_preferences p ON p."userId" = u.id
      WHERE u."isActive" = true AND (p."morningEnabled" OR p."eveningEnabled" OR p."bedtimeEnabled") AND u.id > ${cursor}
        AND EXISTS (SELECT 1 FROM device_tokens t WHERE t."userId" = u.id) ORDER BY u.id LIMIT 200`;
    if (!users.length) break;
    cursor = users[users.length - 1].id;
    for (const user of users) {
      usersScanned++;
      for (const kind of ['MORNING', 'EVENING', 'BEFORE_SLEEP'] as const) {
        try {
          const settings = adhkarReminderSettings(user), prefix = kind === 'MORNING' ? 'morning' : kind === 'EVENING' ? 'evening' : 'bedtime';
          if (!settings[`${prefix}Enabled`]) continue;
          const cacheKey = settings.timezone + '|' + settings[`${prefix}Time`] + '|' + kind;
          let decision = decisions.get(cacheKey);
          if (!decision) {
            decision = evaluateAdhkarReminder(now, settings.timezone, settings[`${prefix}Time`], true, kind);
            if (decisions.size >= 4096) decisions.clear();
            decisions.set(cacheKey, decision);
          }
          if (!decision.eligible) continue;
          const claim = await prisma.$transaction(async tx => {
            const row = await read(tx, user.id, true), current = adhkarReminderSettings(row);
            const attempt = new Date(now.getTime() + performance.now() - started);
            const due = evaluateAdhkarReminder(attempt, current.timezone, current[`${prefix}Time`], current[`${prefix}Enabled`], kind);
            if (!row.isActive || current.revision !== settings.revision || current.timezone !== settings.timezone || !due.eligible || due.day !== decision.day) return 'staleOrDisabled';
            if (await hasCompletedAdhkarReminderCategory(tx, user.id, due.day, kind)) return 'completed';
            const inserted = await tx.$executeRaw`INSERT INTO adhkar_reminder_send_logs ("userId", date, kind) VALUES (${user.id}, ${due.day}::date, ${kind}) ON CONFLICT DO NOTHING`;
            return inserted === 1 ? 'claimed' : 'alreadyClaimed';
          });
          if (claim !== 'claimed') { skipped[claim]++; continue; }
          pushesAttempted++;
          // Recheck immediately before dispatch; an in-flight OS push cannot be recalled.
          const currentRow = await read(prisma, user.id), current = adhkarReminderSettings(currentRow);
          const attempt = new Date(now.getTime() + performance.now() - started);
          const due = evaluateAdhkarReminder(attempt, current.timezone, current[`${prefix}Time`], current[`${prefix}Enabled`], kind);
          if (!currentRow.isActive || current.revision !== settings.revision || current.timezone !== settings.timezone || !due.eligible || due.day !== decision.day || await hasCompletedAdhkarReminderCategory(prisma, user.id, due.day, kind)) {
            await prisma.$executeRaw`UPDATE adhkar_reminder_send_logs SET status = 'CANCELLED' WHERE "userId" = ${user.id} AND date = ${decision.day}::date AND kind = ${kind}`;
            skipped.staleOrDisabled++; continue;
          }
          const copy = ADHKAR_REMINDER_COPY[kind], deepLink = `/adhkar/${kind}`;
          const channel = settings.soundEnabled ? 'adhkar_reminders_default_v1' : 'adhkar_reminders_silent_v1';
          const expires = new Date(Math.min(attempt.getTime() + 3600000, continuityDayEndsAt(decision.day, settings.timezone, attempt).getTime()));
          const payload = { type: 'ADHKAR_REMINDER', eventType: 'ADHKAR_REMINDER', kind: 'adhkar_reminder', categoryKey: kind,
            deepLink, dayKey: decision.day, timezone: settings.timezone, occurrenceKey: decision.occurrenceKey,
            idempotencyKey: decision.occurrenceKey, dedupeKey: user.id + '|' + decision.occurrenceKey,
            source: 'SERVER', deliveryMode: 'OS_NOTIFICATION', androidChannelId: channel,
            soundEnabled: String(settings.soundEnabled), vibrationEnabled: 'false', expiresAtUtc: expires.toISOString(), ...copy };
          const result = await adhkarReminderDelivery.send(user.id, { title: copy.titleAr, body: copy.bodyAr, titleAr: copy.titleAr, bodyAr: copy.bodyAr,
            nativeSound: settings.soundEnabled ? 'default' : null, androidChannelId: channel,
            ttlSeconds: Math.max(1, Math.floor((expires.getTime() - attempt.getTime()) / 1000)), data: payload });
          pushesSent += result.sent;
          await prisma.$executeRaw`UPDATE adhkar_reminder_send_logs SET status = ${result.sent > 0 ? 'SENT' : 'FAILED'}, sent = ${result.sent}
            WHERE "userId" = ${user.id} AND date = ${decision.day}::date AND kind = ${kind}`;
          await adhkarReminderDelivery.history({ userId: user.id, ...copy, type: 'GENERAL', deepLink, payload }).catch(() => {
            logger.warn('[AdhkarReminder] Notification inbox write failed', { userId: user.id, kind });
          });
        } catch (error) {
          skipped.failed++;
          logger.warn('[AdhkarReminder] Delivery failed', { userId: user.id, kind, code: (error as any)?.code ?? 'UNAVAILABLE' });
        }
      }
    }
    if (users.length < 200) break;
  }
  return { usersScanned, pushesAttempted, pushesSent, skipped };
}
