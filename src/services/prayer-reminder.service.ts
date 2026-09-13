import { prisma } from '../lib/prisma';
import { logger } from '../lib/logger';
import { getAzanPreferences } from './azan.service';
import { sendPushToUser } from './device.service';
import { getPrayerSchedule } from './prayer.service';
import { createNotification } from './notification.service';
import {
  getLocalClock,
  resolveTimezone,
  runSalawatReminders,
} from './salawat-reminder.service';
import { DEFAULT_PRAYER_LOCATION } from '../shared/constants/default-location';

type ScheduleRow = { name: string; time: string };

/**
 * Minutes from "now" (in the given IANA timezone) until a local HH:mm prayer time
 * on the same local calendar day. Positive = upcoming; negative = already passed.
 * Uses Intl (same pattern as Salawat) — not the Railway/server process timezone.
 */
export function minutesUntilPrayer(
  hhmm: string,
  timeZone: string,
  now = new Date(),
): number {
  const tz = resolveTimezone(timeZone);
  const [hRaw, mRaw] = String(hhmm).split(':');
  const h = Number(hRaw);
  const m = Number(mRaw);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return Number.POSITIVE_INFINITY;
  }

  const clock = getLocalClock(now, tz);
  const nowMinutes = clock.hour * 60 + clock.minute;
  const targetMinutes = h * 60 + m;
  return targetMinutes - nowMinutes;
}

/**
 * Azan FCM backup only — unchanged rules (prefs + prayer window).
 */
export async function runAzanBackupReminders(windowMinutes = 10): Promise<{
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

      // Prefer Azan prefs / profile location; fall back to Cairo for users without GPS yet.
      const lat = prefs.lastLat ?? user.latitude ?? DEFAULT_PRAYER_LOCATION.latitude;
      const lng = prefs.lastLng ?? user.longitude ?? DEFAULT_PRAYER_LOCATION.longitude;
      const profileTz = user.timezone ?? DEFAULT_PRAYER_LOCATION.timezone;

      const schedule = await getPrayerSchedule(
        lat,
        lng,
        profileTz,
        undefined,
        prefs.calculationMethod,
        String(prefs.madhab).toUpperCase(),
        prefs.locationSource === 'default_cairo' ||
          (user.latitude == null && user.longitude == null && prefs.isDefaultLocation)
          ? 'default_cairo'
          : 'profile',
      );
      const rows = (schedule.schedule ?? []) as ScheduleRow[];
      // Use the timezone that produced schedule HH:mm values (may be inferred from coords).
      const evaluationTz = resolveTimezone(
        schedule.timezone || profileTz || DEFAULT_PRAYER_LOCATION.timezone,
      );

      for (const row of rows) {
        const key = row.name.toLowerCase();
        const enabled =
          (prefs.prayers as any)?.[key] === true ||
          (prefs.prayers as any)?.[key] === undefined;
        if (!enabled) continue;

        const mins = minutesUntilPrayer(row.time, evaluationTz);
        const pre = prefs.preReminderEnabled ? prefs.preReminderMinutes : 0;
        const hitNow = mins >= 0 && mins <= windowMinutes;
        const hitPre =
          prefs.preReminderEnabled &&
          mins >= pre &&
          mins <= pre + windowMinutes;

        if (!hitNow && !hitPre) continue;

        const isPre = hitPre && !hitNow;
        const kind = isPre ? 'pre_reminder' : 'prayer_time';

        // Idempotency: skip if we already created an AZAN notification for this prayer+kind recently.
        const since = new Date(Date.now() - Math.max(windowMinutes, 10) * 60_000);
        const recent = await prisma.notification.findMany({
          where: {
            userId: user.id,
            type: 'AZAN' as any,
            createdAt: { gte: since },
          },
          select: { payload: true },
          take: 40,
        }).catch(() => []);
        const already = recent.some((n) => {
          const p = (n.payload ?? {}) as Record<string, unknown>;
          return p.prayer === row.name && p.kind === kind;
        });
        if (already) continue;

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
            kind,
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
          payload: { prayer: row.name, time: row.time, kind },
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

/**
 * Existing cron entrypoint (every ~10 minutes).
 * Runs Azan backup + Salawat reminders in the same job — no separate scheduler.
 */
export async function runPrayerReminderCron(windowMinutes = 10): Promise<{
  usersScanned: number;
  pushesAttempted: number;
  pushesSent: number;
  azan: { usersScanned: number; pushesAttempted: number; pushesSent: number };
  salawat: {
    usersScanned: number;
    pushesAttempted: number;
    pushesSent: number;
    skipped: Record<string, number>;
  };
}> {
  const azan = await runAzanBackupReminders(windowMinutes);
  const salawat = await runSalawatReminders();

  return {
    usersScanned: azan.usersScanned + salawat.usersScanned,
    pushesAttempted: azan.pushesAttempted + salawat.pushesAttempted,
    pushesSent: azan.pushesSent + salawat.pushesSent,
    azan,
    salawat,
  };
}
