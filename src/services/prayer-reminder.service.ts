import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getAzanPreferences } from './azan.service';
import { sendPushToUser } from './device.service';
import { getPrayerSchedule } from './prayer.service';
import { createNotification } from './notification.service';

type ScheduleRow = { name: string; time: string };

function minutesUntil(hhmm: string, now = new Date()): number {
  const [h, m] = hhmm.split(':').map((x) => Number(x));
  const target = new Date(now);
  target.setHours(h ?? 0, m ?? 0, 0, 0);
  return Math.round((target.getTime() - now.getTime()) / 60_000);
}

/**
 * Cron job: send FCM prayer reminders for users with backup enabled
 * when a prayer is within the next `windowMinutes` (default 10).
 */
export async function runPrayerReminderCron(windowMinutes = 10): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
}> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      deviceTokens: { some: {} },
    },
    select: { id: true, timezone: true, latitude: true, longitude: true },
    take: 500,
  });

  let pushesAttempted = 0;
  let pushesSent = 0;

  for (const user of users) {
    try {
      const prefs = await getAzanPreferences(user.id);
      if (!prefs.azanEnabled || prefs.fcmPrayerBackupEnabled === false) continue;

      const lat = prefs.lastLat ?? user.latitude;
      const lng = prefs.lastLng ?? user.longitude;
      if (lat == null || lng == null) continue;

      const schedule = await getPrayerSchedule(
        lat,
        lng,
        user.timezone,
        undefined,
        prefs.calculationMethod,
        String(prefs.madhab).toUpperCase(),
      );
      const rows = (schedule.schedule ?? []) as ScheduleRow[];

      for (const row of rows) {
        const key = row.name.toLowerCase();
        const enabled =
          (prefs.prayers as any)?.[key] === true ||
          (prefs.prayers as any)?.[key] === undefined;
        if (!enabled) continue;

        const mins = minutesUntil(row.time);
        const pre = prefs.preReminderEnabled ? prefs.preReminderMinutes : 0;
        const hitNow = mins >= 0 && mins <= windowMinutes;
        const hitPre =
          prefs.preReminderEnabled &&
          mins >= pre &&
          mins <= pre + windowMinutes;

        if (!hitNow && !hitPre) continue;

        const isPre = hitPre && !hitNow;
        const titleEn = isPre ? `${row.name} soon` : `Time for ${row.name}`;
        const titleAr = isPre ? `اقترب موعد ${row.name}` : `حان موعد صلاة ${row.name}`;
        const bodyEn = isPre
          ? `Reminder: ${row.name} in about ${pre} minutes (${row.time})`
          : `It's time for ${row.name} (${row.time})`;
        const bodyAr = isPre
          ? `تذكير: تبقى حوالي ${pre} دقيقة على ${row.name} (${row.time})`
          : `حان موعد صلاة ${row.name} (${row.time})`;

        pushesAttempted += 1;
        const result = await sendPushToUser(user.id, {
          title: titleEn,
          body: bodyEn,
          titleAr,
          bodyAr,
          data: {
            type: 'AZAN',
            prayer: row.name,
            time: row.time,
            kind: isPre ? 'pre_reminder' : 'prayer_time',
          },
        });
        pushesSent += result.sent;

        // Best-effort in-app notification
        await createNotification({
          userId: user.id,
          titleAr,
          titleEn,
          bodyAr,
          bodyEn,
          type: 'AZAN' as any,
          deepLink: '/prayer-times',
          payload: { prayer: row.name, time: row.time },
        }).catch(() => null);
      }
    } catch (err) {
      logger.warn('[Cron] Prayer reminder failed for user', {
        userId: user.id,
        message: (err as Error)?.message,
      });
    }
  }

  return { usersScanned: users.length, pushesAttempted, pushesSent };
}
