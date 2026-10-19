import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sendPushToUser } from './device.service';
import { getLocalClock } from './salawat-reminder.service';
import { continuityDayEndsAt, shiftContinuityDay } from './continuity-core';
import { reconcileContinuityToday } from './continuity.service';

const endsCache = new Map<string, number>();
export function evaluateContinuityReminder(now: Date, timezone: string, beforeMinutes: number) {
  const day = getLocalClock(now, timezone).dayKey, key = timezone + '|' + day;
  let ends = endsCache.get(key);
  if (ends === undefined) {
    ends = continuityDayEndsAt(day, timezone, now).getTime();
    if (endsCache.size >= 512) endsCache.clear();
    endsCache.set(key, ends);
  }
  const due = ends - beforeMinutes * 60000;
  return { day, eligible: now.getTime() >= due && now.getTime() < Math.min(ends, due + 10 * 60000),
    expiresAtUtc: new Date(ends).toISOString(), dueAtUtc: new Date(due).toISOString() };
}
export const continuityReminderDelivery = { send: sendPushToUser };

/** At most one claim per account/day, shared by scheduler + external cron + replicas. */
export async function runContinuityReminders(now = new Date()) {
  const passStartedAt = Date.now();
  let cursor = '', claimed = 0, sent = 0;
  for (;;) {
    const users: any[] = await prisma.$queryRaw`SELECT p."userId", p.timezone, p."reminderMinutesBeforeMidnight"
      FROM continuity_preferences p JOIN users u ON u.id = p."userId"
      WHERE p."remindersEnabled" = true AND u."isActive" = true AND p."userId" > ${cursor}
        AND EXISTS (SELECT 1 FROM device_tokens d WHERE d."userId" = p."userId") ORDER BY p."userId" LIMIT 200`;
    if (!users.length) break;
    cursor = users[users.length - 1].userId;
    for (const user of users) {
      try {
        const decision = evaluateContinuityReminder(now, user.timezone, user.reminderMinutesBeforeMidnight);
        if (!decision.eligible) continue;
        const acquired = await prisma.$transaction(async tx => {
          // All credit writers take this lock too: a completion committed first wins.
          const current: any[] = await tx.$queryRaw`SELECT p.*, u."isActive", u.timezone AS "accountTimezone" FROM users u JOIN continuity_preferences p ON p."userId" = u.id WHERE u.id = ${user.userId} FOR UPDATE OF u`;
          const p = current[0];
          if (!p?.isActive || !p.remindersEnabled || p.timezone !== user.timezone || p.reminderMinutesBeforeMidnight !== user.reminderMinutesBeforeMidnight) return false;
          await reconcileContinuityToday(tx, user.userId, p, now);
          const days: any[] = await tx.$queryRaw`SELECT date::text AS date FROM continuity_days WHERE "userId" = ${user.userId} AND date IN (${decision.day}::date, ${shiftContinuityDay(decision.day, -1)}::date)`;
          if (days.some(d => d.date === decision.day) || !days.some(d => d.date === shiftContinuityDay(decision.day, -1))) return false;
          return (await tx.$executeRaw`INSERT INTO continuity_send_logs ("userId", date) VALUES (${user.userId}, ${decision.day}::date) ON CONFLICT DO NOTHING`) === 1;
        });
        if (!acquired) continue;
        claimed++;
        // Reduce the unavoidable completion-vs-in-flight-push race; never schedule a client duplicate.
        const allowed: any[] = await prisma.$queryRaw`SELECT p."userId" FROM continuity_preferences p JOIN users u ON u.id = p."userId"
          WHERE p."userId" = ${user.userId} AND p."remindersEnabled" = true AND u."isActive" = true
            AND p.timezone = ${user.timezone} AND p."reminderMinutesBeforeMidnight" = ${user.reminderMinutesBeforeMidnight}
            AND NOT EXISTS (SELECT 1 FROM continuity_days d WHERE d."userId" = p."userId" AND d.date = ${decision.day}::date)`;
        const attemptNow = new Date(now.getTime() + Date.now() - passStartedAt);
        const currentDecision = evaluateContinuityReminder(attemptNow, user.timezone, user.reminderMinutesBeforeMidnight);
        if (!allowed.length || !currentDecision.eligible || currentDecision.day !== decision.day) {
          await prisma.$executeRaw`UPDATE continuity_send_logs SET status = 'CANCELLED' WHERE "userId" = ${user.userId} AND date = ${decision.day}::date`;
          continue;
        }
        const occurrenceKey = `CONTINUITY|${decision.day}`;
        const result = await continuityReminderDelivery.send(user.userId, {
          title: 'استمرارك مع نور', body: 'خطوة بسيطة اليوم تكمل استمرارك 🌱',
          titleAr: 'استمرارك مع نور', bodyAr: 'خطوة بسيطة اليوم تكمل استمرارك 🌱',
          nativeSound: null, androidChannelId: 'continuity_silent_v1',
          ttlSeconds: Math.max(1, Math.min(3600, Math.floor((Date.parse(decision.expiresAtUtc) - attemptNow.getTime()) / 1000))),
          data: { type: 'CONTINUITY', eventType: 'CONTINUITY', kind: 'continuity_reminder', deepLink: '/continuity',
            titleAr: 'استمرارك مع نور', titleEn: 'Your consistency with Noor', bodyAr: 'خطوة بسيطة اليوم تكمل استمرارك 🌱', bodyEn: 'One small activity today keeps your consistency going.',
            dayKey: decision.day, timezone: user.timezone, occurrenceKey, idempotencyKey: occurrenceKey,
            dedupeKey: user.userId + '|' + occurrenceKey, source: 'SERVER', deliveryMode: 'OS_NOTIFICATION',
            soundEnabled: 'false', vibrationEnabled: 'false', androidChannelId: 'continuity_silent_v1',
            expiresAtUtc: decision.expiresAtUtc, scheduledAtUtc: decision.dueAtUtc },
        });
        sent += result.sent;
        await prisma.$executeRaw`UPDATE continuity_send_logs SET status = ${result.sent > 0 ? 'SENT' : 'FAILED'}, sent = ${result.sent} WHERE "userId" = ${user.userId} AND date = ${decision.day}::date`;
      } catch (error) {
        // Claim remains durable after an ambiguous provider failure. Automatic retries could duplicate a delivered message.
        logger.warn('[ContinuityReminder] Delivery failed', { userId: user.userId, message: error instanceof Error ? error.message : 'unknown' });
      }
    }
    if (users.length < 200) break;
  }
  if (claimed) logger.info('[ContinuityReminder] Pass completed', { claimed, sent });
  return { claimed, sent };
}
