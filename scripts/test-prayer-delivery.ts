import assert from 'node:assert/strict';
import { prisma } from '../src/lib/prisma';
import { runAzanRemindersForUser, resolvePrayerAnnouncementSound } from '../src/services/prayer-reminder.service';
import { pickExplicitAzanPatch } from '../src/services/azan.service';
import { preReminderTtlSeconds } from '../src/shared/utils/reminder-timing';

async function main() {
  const original = prisma.azanReminderSendLog.createMany;
  const originalNow = Date.now;
  const originalFind = prisma.user.findUnique;
  const originalNotification = prisma.notification.create;
  const now = new Date('2026-10-08T20:55:03Z'); // Cairo Thursday 23:55; prayer is on Friday
  const prayer = new Date('2026-10-08T21:10:00Z');
  Date.now = () => now.getTime();
  const user: any = { id: 'test-user', timezone: 'Africa/Cairo', latitude: 30.0444,
    longitude: 31.2357, city: 'Cairo', prayerCalculationMethod: 'EGYPT',
    azanPreferences: { localScheduledUntil: null, notificationSoundId: 'sc_near_auto' } };
  const prefs = await import('../src/services/azan.service');
  const built = prefs.buildAzanPreferencesFromUser(user);
  const memo = new Map<any, any>([[[built.lastLat ?? user.latitude, built.lastLng ?? user.longitude,
    user.timezone, built.calculationMethod, String(built.madhab).toUpperCase(), 'profile'].join('|'),
    { timezone: user.timezone, instants: [{ key: 'DHUHR', date: '2026-10-09', time: '00:10', timestamp: prayer }] }]]);
  let claims = 0;
  prisma.user.findUnique = (async () => user) as any;
  try {
    // No database/FCM calls are possible beyond the failed/duplicate claim.
    prisma.azanReminderSendLog.createMany = (async () => { claims++; throw new Error('claim database unavailable'); }) as any;
    assert.deepEqual(await runAzanRemindersForUser(user, 10, memo), { pushesAttempted: 0, pushesSent: 0 });
    assert.equal(claims, 1, 'fixture must hit an actual due reminder');
    prisma.azanReminderSendLog.createMany = (async () => { claims++; return { count: 0 }; }) as any;
    assert.deepEqual(await runAzanRemindersForUser(user, 10, memo), { pushesAttempted: 0, pushesSent: 0 });
    assert.equal(claims, 2);
    prisma.user.findUnique = (async () => ({...user, longitude: -74})) as any;
    assert.deepEqual(await runAzanRemindersForUser(user, 10, memo), { pushesAttempted: 0, pushesSent: 0 });
    assert.equal(claims, 2, "stale location snapshot must not consume an occurrence");
    prisma.user.findUnique = (async () => user) as any;
    // Local scheduling suppresses the server before it claims the event.
    user.azanPreferences.localScheduledUntil = prayer.toISOString();
    assert.deepEqual(await runAzanRemindersForUser(user, 10, memo), { pushesAttempted: 0, pushesSent: 0 });
    assert.equal(claims, 2);
    assert.equal(preReminderTtlSeconds(14.95), 897, 'do not extend pre reminder past prayer using rounded minutes');
    assert.equal(preReminderTtlSeconds(0.5), 30, 'one-minute reminders must not get a minimum TTL beyond prayer');
    assert.equal(preReminderTtlSeconds(-1), 0);
    assert.deepEqual(pickExplicitAzanPatch({ prayerTimeSoundMode: 'announcement' }), { prayerTimeSoundMode: 'announcement' });
    assert.throws(() => pickExplicitAzanPatch({ prayerTimeSoundMode: 'invalid' }));
    for (const key of ['FAJR', 'DHUHR', 'ASR', 'MAGHRIB', 'ISHA']) {
      assert.equal(resolvePrayerAnnouncementSound(key, 'Africa/Cairo', new Date('2026-10-08T09:00Z'))?.id, `sc_event_${key.toLowerCase()}`);
    }
    assert.equal(resolvePrayerAnnouncementSound('DHUHR', 'Africa/Cairo', prayer)?.id, 'sc_event_jumuah');
    // Concurrent workers contend on one durable occurrence: only one sender wins.
    user.azanPreferences.localScheduledUntil = null;
    const claimedKeys = new Set<string>();
    prisma.azanReminderSendLog.createMany = (async (args: any) => {
      const key = args.data[0].occurrenceKey;
      if (claimedKeys.has(key)) return { count: 0 };
      claimedKeys.add(key);
      return { count: 1 };
    }) as any;
    prisma.notification.create = (async () => { throw new Error('notification history unavailable in test'); }) as any;
    const payloads: any[] = [];
    const send: any = async (_id: string, payload: any) => { payloads.push(payload); return { sent: 1, failed: 0 }; };
    await Promise.all(Array.from({ length: 8 }, () => runAzanRemindersForUser(user, 10, memo, send)));
    assert.equal(payloads.length, 1);
    assert.equal(payloads[0].data.eventType, 'PRE_PRAYER');
    assert.equal(payloads[0].data.deliveryMode, 'OS_NOTIFICATION');
    assert.equal(payloads[0].nativeSound, 'sc_near_jumuah');
    assert.equal(payloads[0].ttlSeconds, 897);
    assert.equal(payloads[0].data.expiresAtUtc, prayer.toISOString());
    assert.equal(payloads[0].data.scheduledAtUtc, '2026-10-08T20:55:00.000Z');
    // At prayer time the separate occurrence must use the announcement, never the pre clip.
    Date.now = () => prayer.getTime() + 1500;
    user.azanPreferences.prayerTimeSoundMode = 'announcement';
    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads.length, 2);
    assert.equal(payloads[1].data.eventType, 'JUMUAH');
    assert.equal(payloads[1].data.soundType, 'PRAYER_EVENT');
    assert.equal(payloads[1].nativeSound, 'sc_event_jumuah');
    assert.equal(payloads[1].androidChannelId, 'azan_sc_event_jumuah');
    assert.equal(payloads[1].ttlSeconds, 898, 'at-time TTL also respects its absolute expiry');
    claimedKeys.clear();
    user.azanPreferences.soundEnabled = false;
    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads[2].nativeSound, null);
    assert.equal(payloads[2].androidChannelId, 'azan_silent');
    claimedKeys.clear();
    user.azanPreferences.soundEnabled = true;
    user.azanPreferences.prayerTimeSoundMode = 'azan';
    await runAzanRemindersForUser(user, 10, memo, send);
    assert.equal(payloads[3].data.soundType, 'AZAN');
    assert.equal(payloads[3].nativeSound, built.azanSoundId);
  } finally {
    prisma.azanReminderSendLog.createMany = original;
    Date.now = originalNow;
    prisma.user.findUnique = originalFind;
    prisma.notification.create = originalNotification;
  }
  console.log('Prayer delivery regression checks passed (mocked DB, no push sent).');
}
main().catch((err) => { console.error(err); process.exitCode = 1; });

