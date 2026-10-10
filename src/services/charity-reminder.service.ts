import { createHash } from 'node:crypto';
import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { sendPushToUser } from './device.service';
import { createNotification } from './notification.service';
import { getLocalClock, resolveTimezone } from './salawat-reminder.service';

export const DEFAULT_CHARITY_REMINDER = { enabled: false, localTime: '12:00', weekdays: [5], language: 'ar' };
export async function getCharityReminder(userId: string) {
  const [pref, user] = await Promise.all([
    prisma.charityReminder.findUnique({ where: { userId } }),
    prisma.user.findUnique({ where: { id: userId }, select: { timezone: true } }),
  ]);
  return { enabled: pref?.enabled ?? false, localTime: pref?.localTime ?? '12:00', weekdays: pref?.weekdays ?? [5], language: pref?.language ?? 'ar',
    timezone: resolveTimezone(user?.timezone), deliveryOwner: 'BACKEND_FCM', sound: 'default', androidChannelId: 'noor_charity_v1', amountTracking: false };
}
export async function updateCharityReminder(userId: string, patch: { enabled?: boolean; localTime?: string; weekdays?: number[]; language?: string }) {
  await prisma.charityReminder.upsert({ where: { userId }, create: { userId, ...DEFAULT_CHARITY_REMINDER, ...patch }, update: patch });
  return getCharityReminder(userId);
}
export function charityReminderOccurrence(now: Date, timezone: string, pref: { localTime: string; weekdays: unknown }): string | null {
  const clock = getLocalClock(now, resolveTimezone(timezone));
  const weekday = new Date(`${clock.dayKey}T12:00:00Z`).getUTCDay();
  const [hour = NaN, minute = NaN] = pref.localTime.split(':').map(Number);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  const elapsedMinutes = clock.hour * 60 + clock.minute - (hour * 60 + minute);
  if (!Array.isArray(pref.weekdays) || !pref.weekdays.includes(weekday) || elapsedMinutes < 0 || elapsedMinutes > 5) return null;
  return `CHARITY|${clock.dayKey}`; // One occurrence per local day even after time edits or repeated DST hours.
}
export async function deliverCharityReminder(userId: string, occurrenceKey: string, language: string, sender = sendPushToUser) {
  try {
    await prisma.charitySendLog.create({ data: { userId, occurrenceKey } });
  } catch (error) {
    if ((error as { code?: string }).code !== 'P2002') logger.error('[CharityReminder] Durable claim unavailable; push suppressed', { userId });
    return { attempted: 0, sent: 0 };
  }
  const notificationId = createHash('sha256').update(`${userId}|${occurrenceKey}`).digest('hex').slice(0, 32);
  const ar = language === 'ar';
  await createNotification({ userId, type: 'GENERAL', titleAr: 'تذكير بالصدقة', titleEn: 'A gentle charity reminder',
    bodyAr: 'باب الخير واسع؛ تصدّق بما تيسر لك، ولو بالقليل.', bodyEn: 'Give what you can, however small. Every act of kindness matters.',
    deepLink: '/charity-reminder', payload: { type: 'CHARITY_REMINDER', notificationId, occurrenceKey } }).catch(() => {
      logger.warn('[CharityReminder] Inbox persistence failed', { userId });
    });
  try {
    const result = await sender(userId, {
      title: ar ? 'تذكير بالصدقة' : 'A gentle charity reminder',
      body: ar ? 'باب الخير واسع؛ تصدّق بما تيسر لك، ولو بالقليل.' : 'Give what you can, however small. Every act of kindness matters.',
      titleAr: 'تذكير بالصدقة', bodyAr: 'باب الخير واسع؛ تصدّق بما تيسر لك، ولو بالقليل.',
      nativeSound: 'default', androidChannelId: 'noor_charity_v1', ttlSeconds: 300,
      data: { type: 'CHARITY_REMINDER', notificationId, occurrenceKey, deepLink: '/charity-reminder',
        deliveryMode: 'OS_NOTIFICATION', audioOwner: 'NOTIFICATION_CHANNEL',
        expiresAtUtc: new Date(Date.now() + 300_000).toISOString() },
    });
    return { attempted: 1, sent: result.sent > 0 ? 1 : 0 };
  } catch (error) {
    logger.error('[CharityReminder] Transport failed after claim; automatic retry suppressed', { userId });
    return { attempted: 1, sent: 0 };
  }
}
export async function runCharityReminders(now = new Date()) {
  const summary = { usersScanned: 0, pushesAttempted: 0, pushesSent: 0, skipped: {} as Record<string, number> };
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.charityReminder.findMany({ where: { enabled: true, user: { isActive: true, deviceTokens: { some: {} } } },
      include: { user: { select: { timezone: true } } }, orderBy: { userId: 'asc' }, take: 500,
      ...(cursor ? { cursor: { userId: cursor }, skip: 1 } : {}) });
    for (const row of rows) {
      summary.usersScanned++;
      const key = charityReminderOccurrence(now, row.user.timezone, row);
      if (!key) continue;
      const current = await prisma.charityReminder.findUnique({ where: { userId: row.userId } });
      if (!current?.enabled || current.localTime !== row.localTime || !charityReminderOccurrence(now, row.user.timezone, current)) continue;
      const result = await deliverCharityReminder(row.userId, key, current.language);
      summary.pushesAttempted += result.attempted; summary.pushesSent += result.sent;
    }
    if (rows.length < 500) break;
    cursor = rows[rows.length - 1]!.userId;
  }
  return summary;
}
